// READ-ONLY snapshot of the survey counters in ONE namespace, to look at BEFORE any reset.
//
//   node scripts/snapshot.js --production      look at the live counters  (keys "boba:v1:*")
//   node scripts/snapshot.js --preview         look at the Preview counters (needs PREVIEW_NAMESPACE)
//
// Two ways of looking (both read-only):
//   default        uses SCAN to list EVERY key in the namespace. Needs a normal Upstash token,
//                  because Upstash's Read-Only token does not allow SCAN.
//   --known-keys   reads only the fixed list of counters the website uses (GET and HGETALL, as
//                  plain HTTP GET requests). Works with the Read-Only token. It cannot see keys
//                  it does not know about, so it cannot spot strays or count rate-limit counters.
//
// Add any of these:
//   --expect 4    compare the total with how many test answers you remember sending
//   --save        also keep a copy in snapshots/ (never committed)
//
// You MUST say which one. With neither (or both) the tool stops: it never guesses.
//
// What it does: looks at every key inside that ONE namespace and reports what is there,
// sorted into plain categories. It lists what a reset of that namespace WOULD clear.
// What it never does: change anything. It can only send GET, HGETALL, SCAN and TYPE
// (plus DBSIZE for --production, which only counts keys). Every key must be inside the
// chosen namespace, or the command is refused before it is sent.
//
// It reads the same two settings as the website:
//   UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN   (or the KV_REST_API_ names)
// Tip: Upstash offers a READ-ONLY token. Using that one makes writing impossible,
// even by accident. The script never prints the URL or the token.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRODUCTION_NAMESPACE, checkLabel, previewNamespace, guardedRunner } from '../lib/namespace.js';
import { upstashConfig, sendToUpstash, sendReadsToUpstash } from '../lib/upstash.js';
import { QUESTIONS, DRINK_FIELDS, COMPARE_QUESTIONS } from '../public/js/schema.js';

const READ_COMMANDS = ['GET', 'HGETALL', 'SCAN', 'TYPE'];
export const SNAPSHOT_COMMANDS = {
  production: new Set([...READ_COMMANDS, 'DBSIZE']),
  preview: new Set(READ_COMMANDS), // no DBSIZE: a Preview has no business counting the whole database
};
// The "known keys" mode may only GET and HGETALL: no SCAN, no KEYS, no TYPE, no DBSIZE.
export const KNOWN_KEYS_COMMANDS = new Set(['GET', 'HGETALL']);

// The safety belt: a "send commands" function that can only read, and only inside `namespace`.
export function snapshotRunner(send, namespace, kind, mode = 'scan') {
  return guardedRunner(send, namespace, mode === 'known-keys' ? KNOWN_KEYS_COMMANDS : SNAPSHOT_COMMANDS[kind]);
}

// The counters the website writes. This list comes from the same schema the website uses.
export function knownKeyNames() {
  return [
    'total',
    'drinks',
    ...QUESTIONS.map((q) => `q:${q.id}`),
    ...Object.keys(DRINK_FIELDS).map((name) => `drink:${name}`),
    ...COMPARE_QUESTIONS.map((id) => `x:${id}`),
  ];
}

// Sort a key name into a plain category.
export function categorize(key, namespace = PRODUCTION_NAMESPACE) {
  const prefix = `${namespace}:`;
  const name = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  if (name === 'total') return 'total';
  if (name === 'drinks') return 'drinksTotal';
  if (name.startsWith('q:')) return 'answers';
  if (name.startsWith('drink:')) return 'drinkParts';
  if (name.startsWith('x:')) return 'regional';
  if (name.startsWith('rl:')) return 'rateLimit';
  return 'unknown';
}

const pairsToCounts = (flat) => {
  const counts = {};
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) counts[flat[i]] = Number(flat[i + 1]) || 0;
  else if (flat && typeof flat === 'object') for (const [k, v] of Object.entries(flat)) counts[k] = Number(v) || 0;
  return counts;
};
const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

// Collect the facts. `run` must come from snapshotRunner(), so it can only read inside `namespace`.
export async function takeSnapshot(run, namespace, kind = 'production') {
  const prefix = `${namespace}:`;
  const keys = [];
  let cursor = '0';
  do {
    const [[next, batch]] = await run([['SCAN', cursor, 'MATCH', `${prefix}*`, 'COUNT', 200]]);
    keys.push(...batch);
    cursor = String(next);
  } while (cursor !== '0');
  const unique = [...new Set(keys)].filter((k) => k.startsWith(prefix)).sort();

  let keysInDatabase = null; // only the production snapshot is allowed to ask
  if (SNAPSHOT_COMMANDS[kind].has('DBSIZE')) {
    const [databaseSize] = await run([['DBSIZE']]);
    keysInDatabase = Number(databaseSize) || 0;
  }

  const snapshot = {
    takenAt: new Date().toISOString(),
    kind,
    namespace,
    total: 0,
    drinksTotal: 0,
    answers: {},        // question -> { answer: count }
    drinkParts: {},     // tea / flavor / sweet / topping -> { value: count }
    regional: {},       // question -> { "region|answer": count }
    rateLimitCounters: 0,
    unknownKeys: [],    // [{ key, type }]
    keysInDatabase,
    keysInNamespace: unique.length,
  };

  const reads = [];
  for (const key of unique) {
    const kind2 = categorize(key, namespace);
    if (kind2 === 'total' || kind2 === 'drinksTotal') reads.push({ key, kind: kind2, command: ['GET', key] });
    else if (kind2 === 'answers' || kind2 === 'drinkParts' || kind2 === 'regional') reads.push({ key, kind: kind2, command: ['HGETALL', key] });
    else if (kind2 === 'rateLimit') snapshot.rateLimitCounters += 1; // counted only, never read
    else reads.push({ key, kind: kind2, command: ['TYPE', key] });
  }

  const results = reads.length ? await run(reads.map((r) => r.command)) : [];
  reads.forEach(({ key, kind: kind2 }, index) => {
    const name = key.slice(prefix.length);
    const value = results[index];
    if (kind2 === 'total') snapshot.total = Number(value) || 0;
    else if (kind2 === 'drinksTotal') snapshot.drinksTotal = Number(value) || 0;
    else if (kind2 === 'answers') snapshot.answers[name.slice(2)] = pairsToCounts(value);
    else if (kind2 === 'drinkParts') snapshot.drinkParts[name.slice(6)] = pairsToCounts(value);
    else if (kind2 === 'regional') snapshot.regional[name.slice(2)] = pairsToCounts(value);
    else snapshot.unknownKeys.push({ key, type: value });
  });
  return snapshot;
}

// The same report, built WITHOUT SCAN: only the fixed list of counters is read (GET and HGETALL).
// What it cannot know is marked null: stray keys, rate-limit counters, the size of the database.
export async function takeKnownKeysSnapshot(run, namespace, kind = 'production') {
  const names = knownKeyNames();
  const results = await run(names.map((name) => [name === 'total' || name === 'drinks' ? 'GET' : 'HGETALL', `${namespace}:${name}`]));

  const snapshot = {
    takenAt: new Date().toISOString(),
    mode: 'known-keys',
    kind,
    namespace,
    total: 0,
    drinksTotal: 0,
    answers: {},
    drinkParts: {},
    regional: {},
    rateLimitCounters: null, // not looked at in this mode
    unknownKeys: null,       // cannot be looked for without SCAN
    keysInDatabase: null,
    keysInNamespace: 0,      // here: how many of the known counters exist
  };
  names.forEach((name, index) => {
    const value = results[index];
    if (name === 'total' || name === 'drinks') {
      if (value === null || value === undefined) return;
      snapshot.keysInNamespace += 1;
      snapshot[name === 'total' ? 'total' : 'drinksTotal'] = Number(value) || 0;
      return;
    }
    const counts = pairsToCounts(value);
    if (Object.keys(counts).length === 0) return;
    snapshot.keysInNamespace += 1;
    if (name.startsWith('q:')) snapshot.answers[name.slice(2)] = counts;
    else if (name.startsWith('drink:')) snapshot.drinkParts[name.slice(6)] = counts;
    else snapshot.regional[name.slice(2)] = counts;
  });
  return snapshot;
}

// Spot numbers that cannot all be true at once. (A pipeline is not atomic, so a
// request that stopped half-way could leave a small mismatch.)
export function consistencyNotes(snapshot) {
  const notes = [];
  for (const [question, counts] of Object.entries(snapshot.answers)) {
    if (sum(counts) > snapshot.total) notes.push(`"${question}" has more answers (${sum(counts)}) than total submissions (${snapshot.total}).`);
  }
  for (const [question, counts] of Object.entries(snapshot.regional)) {
    const answered = sum(snapshot.answers[question] || {});
    if (sum(counts) > answered) notes.push(`Regional counts for "${question}" (${sum(counts)}) exceed its answers (${answered}).`);
  }
  if (snapshot.drinksTotal > snapshot.total) notes.push(`Shared drinks (${snapshot.drinksTotal}) exceed total submissions (${snapshot.total}).`);
  return notes;
}

// The plain-language report.
export function describe(snapshot, expected = null) {
  const lines = [];
  const add = (text = '') => lines.push(text);
  const label = snapshot.kind === 'preview' ? 'PREVIEW' : 'PRODUCTION (LIVE)';

  const known = snapshot.mode === 'known-keys';
  add(`BOBA LAB: READ-ONLY SNAPSHOT of ${label}${known ? ' (KNOWN KEYS ONLY)' : ''}`);
  add(`Namespace: ${snapshot.namespace}:*`);
  add(`Taken at ${snapshot.takenAt}. Nothing was changed.`);
  add();
  add(`Submissions counted: ${snapshot.total}`);
  add(`Drinks shared:       ${snapshot.drinksTotal}`);
  add();
  add('Answers per question (how many answers each question holds):');
  for (const [question, counts] of Object.entries(snapshot.answers).sort()) {
    add(`  ${question.padEnd(14)} ${String(sum(counts)).padStart(4)}   ${JSON.stringify(counts)}`);
  }
  if (!Object.keys(snapshot.answers).length) add('  (none)');
  add();
  add('Regional counters (region|answer):');
  for (const [question, counts] of Object.entries(snapshot.regional).sort()) {
    add(`  ${question.padEnd(14)} ${String(sum(counts)).padStart(4)}   ${JSON.stringify(counts)}`);
  }
  if (!Object.keys(snapshot.regional).length) add('  (none)');
  add();
  if (known) {
    add(`Known counters that exist: ${snapshot.keysInNamespace}. Only these fixed counters were read (GET and HGETALL).`);
    add('NOT checked in this mode: keys this tool does not know about, rate-limit counters, and the size of the database.');
    add('So this is NOT enough to approve a reset: run the normal snapshot (without --known-keys) for that.');
  } else {
    add(`A reset of "${snapshot.namespace}:*" WOULD clear:`);
    add(`  - ${Object.keys(snapshot.answers).length} answer counter groups, ${Object.keys(snapshot.regional).length} regional groups, ${Object.keys(snapshot.drinkParts).length} drink groups`);
    add('  - the submission total and the shared-drink total');
    add(`  - ${snapshot.rateLimitCounters} short-lived rate-limit counters (they delete themselves within 24 hours anyway)`);
    if (snapshot.keysInDatabase !== null) {
      add(`A reset would NOT touch the other ${Math.max(0, snapshot.keysInDatabase - snapshot.keysInNamespace)} key(s) in this database (for example any Preview namespaces).`);
    } else {
      add('A reset would NOT touch any key outside this namespace, including every Production key.');
    }
  }

  if (!known && snapshot.unknownKeys.length) {
    add();
    add('ATTENTION: keys in this namespace that this tool does not recognise (a reset would delete them too):');
    for (const { key, type } of snapshot.unknownKeys) add(`  - ${key} (${type})`);
  }

  const notes = consistencyNotes(snapshot);
  if (notes.length) {
    add();
    add('ATTENTION: numbers that do not add up:');
    for (const note of notes) add(`  - ${note}`);
  }

  add();
  if (expected === null) {
    add('Can we tell test answers from real ones? No: only totals are stored, by design.');
    add(`Re-run with  --expect <how many test submissions you sent>  to compare with ${snapshot.total}.`);
  } else if (snapshot.total === expected) {
    add(`MATCH: the total (${snapshot.total}) equals the ${expected} test submission(s) you expect.`);
    add(known ? 'Nothing here should be a real participant (known counters only; run the normal snapshot before any reset).' : 'Nothing here should be a real participant. You can approve the reset.');
  } else if (snapshot.total > expected) {
    add(`MISMATCH: the total is ${snapshot.total} but you expect ${expected} test submission(s).`);
    add(`${snapshot.total - expected} submission(s) came from somewhere else. DO NOT reset until you know who they were.`);
  } else {
    add(`MISMATCH: the total is ${snapshot.total}, LOWER than the ${expected} you expect. Check your count before resetting.`);
  }
  return lines.join('\n');
}

// ---- which namespace? (never guessed) ----------------------------------------------------------

// Turns the command-line words into { kind, namespace } or { error }.
export function chooseNamespace(args, env = process.env) {
  const production = args.includes('--production');
  const preview = args.includes('--preview');
  if (production === preview) {
    return { error: 'Say which one to look at: --production (the live counters) or --preview (needs PREVIEW_NAMESPACE). Not both, not neither.' };
  }
  if (production) return { kind: 'production', namespace: PRODUCTION_NAMESPACE };
  const label = checkLabel(env.PREVIEW_NAMESPACE);
  if (!label.ok) return { error: `--preview needs a valid PREVIEW_NAMESPACE (${label.reason}).` };
  return { kind: 'preview', namespace: previewNamespace(label.label) };
}

// ---- running it from the command line -----------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const expectIndex = args.indexOf('--expect');
  const expected = expectIndex >= 0 ? Number.parseInt(args[expectIndex + 1], 10) : null;
  if (expectIndex >= 0 && !Number.isInteger(expected)) {
    console.error('--expect needs a whole number, for example:  --expect 4');
    process.exit(1);
  }

  const chosen = chooseNamespace(args);
  if (chosen.error) {
    console.error(chosen.error);
    process.exit(1);
  }

  const config = upstashConfig();
  if (!config) {
    console.error('No Upstash settings found. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN first (see docs/environment-isolation.md).');
    process.exit(1);
  }

  // Each sender is wrapped DIRECTLY in its guard. "Known keys" mode uses the GET-only sender and a
  // GET/HGETALL-only allow-list; the normal mode keeps the original SCAN-based path unchanged.
  const knownKeys = args.includes('--known-keys');
  const snapshot = knownKeys
    ? await takeKnownKeysSnapshot(snapshotRunner((commands) => sendReadsToUpstash(config, commands), chosen.namespace, chosen.kind, 'known-keys'), chosen.namespace, chosen.kind)
    : await takeSnapshot(snapshotRunner((commands) => sendToUpstash(config, commands), chosen.namespace, chosen.kind), chosen.namespace, chosen.kind);
  console.log(describe(snapshot, expected));

  if (args.includes('--save')) {
    const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'snapshots');
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, `snapshot-${chosen.kind}${knownKeys ? '-known-keys' : ''}-${snapshot.takenAt.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
    console.log(`\nSaved a copy to ${path.relative(process.cwd(), file)} (this folder is git-ignored).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Snapshot failed:', error.message);
    process.exit(1);
  });
}
