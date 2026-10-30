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
//   2. Anything that is not Production needs a valid PREVIEW_NAMESPACE before it may
//      touch Redis. Missing or invalid means "storage off" (fail closed). It never
//      falls back to the Production namespace.
//   3. The two namespaces can never overlap. Preview names always start with
//      "boba-preview:", which no Production key can match, and the label cannot
//      contain ":" or "*", so it cannot "escape" into another namespace.
//   4. Every command is checked just before sending. A command whose key is outside
//      this environment's namespace, or whose command name is not on the allowed list
//      (FLUSHALL, KEYS, EVAL and friends), is refused and never leaves the server.
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

// Decide the namespace for the current environment.
// Returns { ok: true, kind, namespace } or { ok: false, kind: 'blocked', reason }.
//   kind 'production' : the live site
//   kind 'preview'    : a preview (or local run) with a valid PREVIEW_NAMESPACE
//   kind 'local'      : this computer, temporary in-memory store (no Redis involved)
export function resolveNamespace(env = process.env) {
  // Rule 1: the live site. Only the exact word "production" counts, and nothing else
  // in the environment can change which namespace it gets.
  if (env.VERCEL_ENV === 'production') {
    return { ok: true, kind: 'production', namespace: PRODUCTION_NAMESPACE };
  }

  // Rule 2: everything else needs an explicit, valid preview label.
  const label = checkLabel(env.PREVIEW_NAMESPACE);
  if (label.ok) {
    return { ok: true, kind: 'preview', namespace: `${PREVIEW_ROOT}:${label.label}:v1` };
  }

  // No label. That is fine ONLY on a local computer with no Redis at all, where the
  // temporary in-memory store is used. Anywhere a real Redis could be reached
  // (any Vercel deployment, or a computer holding Redis credentials) we stop.
  if (!env.VERCEL && !hasCredentials(env)) {
    return { ok: true, kind: 'local', namespace: PRODUCTION_NAMESPACE };
  }
  return { ok: false, kind: 'blocked', reason: label.reason };
}

// ---- the guard ----------------------------------------------------------------------------

// Throws unless EVERY command is allowed and EVERY key is inside `namespace`.
// Nothing is sent when it throws, so one bad command stops the whole batch.
export function assertInNamespace(commands, namespace, allowed = APP_COMMANDS) {
  const prefix = `${namespace}:`; // the trailing colon matters: "boba:v1" must not match "boba:v10:..."
  if (!Array.isArray(commands)) throw new Error('Refused: commands must be a list.');

  for (const command of commands) {
    if (!Array.isArray(command) || typeof command[0] !== 'string') throw new Error('Refused: malformed command.');
    const name = command[0].toUpperCase();
    if (!allowed.has(name)) throw new Error(`Refused: ${name} is not allowed here.`);

    let keys;
    if (name === 'DBSIZE') {
      keys = []; // takes no key. Only appears in allowed sets that explicitly include it.
    } else if (name === 'SCAN') {
      // A scan is only safe if it is limited to this namespace with MATCH.
      const at = command.findIndex((arg, index) => index > 1 && String(arg).toUpperCase() === 'MATCH');
      if (at === -1) throw new Error('Refused: SCAN must use MATCH inside the namespace.');
      keys = [command[at + 1]];
    } else if (name === 'DEL') {
      keys = command.slice(1);
      if (keys.length === 0) throw new Error('Refused: DEL needs keys.');
    } else {
      keys = [command[1]];
    }

    for (const key of keys) {
      if (typeof key !== 'string' || !key.startsWith(prefix) || key.length === prefix.length) {
        throw new Error(`Refused: ${name} is outside this environment's namespace.`);
      }
    }
  }
}

// Wrap a "send these commands" function so it can only send guarded commands.
export function guardedRunner(send, namespace, allowed = APP_COMMANDS) {
  return async (commands) => {
    assertInNamespace(commands, namespace, allowed);
    return send(commands);
  };
}
