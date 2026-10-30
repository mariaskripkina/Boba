// Which "namespace" (key prefix) this copy of the website is allowed to use in Redis,
// and a guard that checks EVERY command before it is sent.
//
// WHY THIS EXISTS
// The live site and Vercel previews would share ONE Upstash database. Redis has no
// folders, so the only thing keeping test data away from live data is the first part
// of every key name (its "namespace"). If a preview ever used the live namespace, test
// answers would be added to the real totals. So:
//
//   Production  always uses  boba:v1                       (the existing keys, unchanged)
//   Preview     uses         boba-preview:<label>:v1       (<label> comes from PREVIEW_NAMESPACE)
//
// THE RULES (each one is enforced in code and proven by test/isolation.test.js)
//   1. Production ignores PREVIEW_NAMESPACE completely. Whatever it says, Production
//      uses boba:v1.
//   2. Production is recognised ONLY when Vercel says so explicitly (VERCEL=1 and
//      VERCEL_ENV=production). Anything missing or unexpected can never select it.
//      On Vercel, a missing or unrecognised VERCEL_ENV switches storage off.
//      Preview (and "development") need a valid PREVIEW_NAMESPACE before they may touch
//      Redis. Missing or invalid means "storage off" (fail closed). It never falls
//      back to the Production namespace.
//   3. The two namespaces can never overlap. Preview names always start with
//      "boba-preview:", which no Production key can match, and the label cannot
//      contain ":" or "*", so it cannot "escape" into another namespace.
//   4. Every command is checked just before sending. The command name must be on the
//      allowed list (FLUSHALL, KEYS, EVAL and friends are not), it must have exactly the
//      arguments that command takes (no extras), and every key must be inside this
//      environment's namespace, including the ":" after it. Otherwise the whole batch is
//      refused and never leaves the server.
//
// HONEST LIMIT: all of this is rules inside our own code. The Redis password is the
// same in Production and Preview, so it cannot be enforced by the database itself.

export const PRODUCTION_NAMESPACE = 'boba:v1';
export const PREVIEW_ROOT = 'boba-preview';

// A label is lowercase letters and digits, optionally joined by single hyphens,
// 3 to 40 characters. No colon, star, slash, space or capital letter can get through.
const LABEL_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_LABELS = new Set(['production', 'prod', 'live', 'main', 'master', 'boba', 'default']);

// The only Redis commands the website itself ever needs.
export const APP_COMMANDS = new Set(['INCR', 'DECR', 'HINCRBY', 'EXPIRE', 'TTL', 'GET', 'HGETALL']);

export function checkLabel(value) {
  if (typeof value !== 'string') return { ok: false, reason: 'PREVIEW_NAMESPACE is not set' };
  const label = value.trim(); // a stray space or newline from copy and paste is harmless
  if (label === '') return { ok: false, reason: 'PREVIEW_NAMESPACE is empty' };
  if (label.length < 3 || label.length > 40) return { ok: false, reason: 'PREVIEW_NAMESPACE must be 3 to 40 characters' };
  if (!LABEL_PATTERN.test(label)) return { ok: false, reason: 'PREVIEW_NAMESPACE may only use lowercase letters, digits and single hyphens' };
  if (RESERVED_LABELS.has(label)) return { ok: false, reason: 'PREVIEW_NAMESPACE uses a reserved word' };
  return { ok: true, label };
}

export function previewNamespace(label) {
  const checked = checkLabel(label);
  if (!checked.ok) throw new Error(checked.reason);
  return `${PREVIEW_ROOT}:${checked.label}:v1`;
}

const hasCredentials = (env) =>
  Boolean((env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL) && (env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN));

// The only values Vercel itself ever gives VERCEL_ENV. Anything else is "unexpected".
const VERCEL_ENVIRONMENTS = new Set(['production', 'preview', 'development']);

// Decide the namespace for the current environment.
// Returns { ok: true, kind, namespace } or { ok: false, kind: 'blocked', reason }.
//   kind 'production' : the live site (explicitly announced by Vercel, nothing else)
//   kind 'preview'    : a preview / development run with a valid PREVIEW_NAMESPACE
//   kind 'local'      : this computer, temporary in-memory store (no Redis involved)
export function resolveNamespace(env = process.env) {
  const blocked = (reason) => ({ ok: false, kind: 'blocked', reason });
  const vercelEnv = env.VERCEL_ENV;
  const hasVercelEnv = typeof vercelEnv === 'string' && vercelEnv !== '';

  if (env.VERCEL) {
    // On Vercel the environment must be named exactly, or storage stays off.
    if (!VERCEL_ENVIRONMENTS.has(vercelEnv)) {
      return blocked(hasVercelEnv
        ? 'VERCEL_ENV is not one of production, preview or development'
        : 'VERCEL_ENV is missing (is "Automatically expose System Environment Variables" switched on?)');
    }
    if (vercelEnv === 'production') {
      // Rule 1: the live site. Needs BOTH signals, and nothing else can change the namespace.
      if (env.VERCEL !== '1') return blocked('VERCEL is not "1" although VERCEL_ENV says production');
      return { ok: true, kind: 'production', namespace: PRODUCTION_NAMESPACE };
    }
  } else if (vercelEnv === 'production') {
    // "production" claimed on a machine that is not Vercel: never trusted.
    return blocked('VERCEL_ENV says production but this is not a Vercel deployment');
  } else if (hasVercelEnv && !VERCEL_ENVIRONMENTS.has(vercelEnv)) {
    return blocked('VERCEL_ENV is not one of production, preview or development');
  }

  // Rule 2: everything else needs an explicit, valid preview label.
  const label = checkLabel(env.PREVIEW_NAMESPACE);
  if (label.ok) {
    return { ok: true, kind: 'preview', namespace: `${PREVIEW_ROOT}:${label.label}:v1` };
  }

  // No label. Fine ONLY on a computer that is not on Vercel and holds no Redis credentials:
  // there the temporary in-memory store is used and nothing is ever sent anywhere.
  if (!env.VERCEL && !hasCredentials(env)) {
    return { ok: true, kind: 'local', namespace: PRODUCTION_NAMESPACE };
  }
  return blocked(label.reason);
}

// ---- the guard ----------------------------------------------------------------------------

const PREVIEW_NAMESPACE_PATTERN = new RegExp(`^${PREVIEW_ROOT}:([^:]+):v1$`);

// True only for "boba:v1" or "boba-preview:<valid label>:v1". The guard refuses to work
// with any other namespace, so a mistake in the caller cannot widen what is allowed.
export function isValidNamespace(namespace) {
  if (namespace === PRODUCTION_NAMESPACE) return true;
  const match = typeof namespace === 'string' ? PREVIEW_NAMESPACE_PATTERN.exec(namespace) : null;
  return Boolean(match) && checkLabel(match[1]).ok && match[1] === match[1].trim();
}

// Key names the website makes use letters, digits and  : | - _  only. Spaces, control
// characters and search wildcards are refused so a key can never be mistaken for a pattern.
const PLAIN_KEY = /^[A-Za-z0-9:|._-]+$/;

const isText = (value) => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
const isWholeNumber = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

// How many arguments each command takes, and what they are. Returns the keys it touches.
// Throws on anything else: wrong count, wrong type, an extra argument, a second MATCH.
function keysOf(name, args, namespace) {
  const bad = (why) => { throw new Error(`Refused: ${name} ${why}.`); };
  switch (name) {
    case 'INCR': case 'DECR': case 'GET': case 'HGETALL': case 'TTL': case 'TYPE':
      if (args.length !== 1) bad('takes exactly 1 argument (the key)');
      return [args[0]];
    case 'EXPIRE':
      if (args.length !== 2) bad('takes exactly 2 arguments (key, seconds)');
      if (!isWholeNumber(args[1], 1, 31_536_000)) bad('needs whole seconds between 1 and a year');
      return [args[0]];
    case 'HINCRBY':
      if (args.length !== 3) bad('takes exactly 3 arguments (key, field, amount)');
      if (!isText(args[1])) bad('needs a text field');
      if (!isWholeNumber(args[2], -1000, 1000)) bad('needs a small whole amount');
      return [args[0]];
    case 'DBSIZE':
      if (args.length !== 0) bad('takes no arguments');
      return [];
    case 'DEL':
      if (args.length < 1 || args.length > 100) bad('takes 1 to 100 keys');
      return args;
    case 'SCAN': {
      // Exactly:  SCAN <cursor> MATCH <namespace>:*  [COUNT <n>]   in this order, nothing else.
      if (args.length !== 3 && args.length !== 5) bad('must be: cursor MATCH pattern [COUNT n]');
      const [cursor, matchWord, pattern, countWord, count] = args;
      if (!(typeof cursor === 'string' ? /^\d{1,20}$/.test(cursor) : isWholeNumber(cursor, 0, Number.MAX_SAFE_INTEGER))) bad('needs a numeric cursor');
      if (typeof matchWord !== 'string' || matchWord.toUpperCase() !== 'MATCH') bad('must use MATCH (exactly once)');
      if (pattern !== `${namespace}:*`) bad("must scan exactly this environment's namespace pattern");
      if (args.length === 5) {
        if (typeof countWord !== 'string' || countWord.toUpperCase() !== 'COUNT') bad('allows only COUNT after MATCH');
        if (!isWholeNumber(count, 1, 1000)) bad('needs COUNT between 1 and 1000');
      }
      return []; // the pattern was matched exactly above; there is no key to check
    }
    default:
      throw new Error(`Refused: ${name} is not allowed here.`);
  }
}

// Throws unless EVERY command is allowed, has exactly the right arguments, and EVERY key
// is inside `namespace`. Nothing is sent when it throws, so one bad command stops the batch.
export function assertInNamespace(commands, namespace, allowed = APP_COMMANDS) {
  if (!isValidNamespace(namespace)) throw new Error('Refused: not a valid namespace.');
  const prefix = `${namespace}:`; // the trailing colon matters: "boba:v1" must not match "boba:v10:..."
  if (!Array.isArray(commands) || commands.length === 0) throw new Error('Refused: commands must be a non-empty list.');

  for (const command of commands) {
    if (!Array.isArray(command) || typeof command[0] !== 'string') throw new Error('Refused: malformed command.');
    const name = command[0].toUpperCase();
    if (!allowed.has(name)) throw new Error(`Refused: ${name} is not allowed here.`);

    for (const key of keysOf(name, command.slice(1), namespace)) {
      if (typeof key !== 'string' || !key.startsWith(prefix) || key.length === prefix.length || !PLAIN_KEY.test(key)) {
        throw new Error(`Refused: ${name} is outside this environment's namespace.`);
      }
    }
  }
}

// Wrap a "send these commands" function so it can only send guarded commands.
export function guardedRunner(send, namespace, allowed = APP_COMMANDS) {
  if (!isValidNamespace(namespace)) throw new Error('Refused: not a valid namespace.');
  return async (commands) => {
    assertInNamespace(commands, namespace, allowed);
    return send(commands);
  };
}
