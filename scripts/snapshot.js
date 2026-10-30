// READ-ONLY snapshot of the live survey counters, to look at BEFORE any reset.
//
//   node scripts/snapshot.js                 show the report on screen
//   node scripts/snapshot.js --expect 4      also compare the total with how many
//                                            test answers you remember sending
//   node scripts/snapshot.js --save          also keep a copy in snapshots/ (never committed)
//
// What it does: looks at every key that starts with "boba:v1:" and reports what is
// there, sorted into plain categories. It lists what a reset WOULD clear.
// What it never does: change anything. It can only send these Redis commands:
// GET, HGETALL, SCAN, DBSIZE and TYPE. Anything else is refused before it is sent.
//
// It reads the same two settings as the website:
//   UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN   (or the KV_REST_API_ names)
// Tip: Upstash offers a READ-ONLY token. Using that one makes writing impossible,
// even by accident. The script never prints the URL or the token.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PREFIX = 'boba:v1:';
export const READ_ONLY_COMMANDS = new Set(['GET', 'HGETALL', 'SCAN', 'DBSIZE', 'TYPE']);

// The safety belt: wrap any "send commands" function so it can only read.
export function readOnly(run) {
  return async (commands) => {
    for (const [command] of commands) {
      if (!READ_ONLY_COMMANDS.has(String(command).toUpperCase())) {
        throw new Error(`Refused: "${command}" could change data. This tool only reads.`);
      }
    }
    return run(commands);
  };
}

// Sort a key name into a plain category.
export function categorize(key) {
  const name = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
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

// Collect the facts. `run` must already be wrapped with readOnly().
export async function takeSnapshot(run) {
  const keys = [];
  let cursor = '0';
  do {
    const [[next, batch]] = await run([['SCAN', cursor, 'MATCH', `${PREFIX}*`, 'COUNT', 200]]);
    keys.push(...batch);
    cursor = String(next);
  } while (cursor !== '0');
  const unique = [...new Set(keys)].sort();

  const [databaseSize] = await run([['DBSIZE']]);

  const snapshot = {
    takenAt: new Date().toISOString(),
    total: 0,
    drinksTotal: 0,
    answers: {},        // question -> { answer: count }
    drinkParts: {},     // tea / flavor / sweet / topping -> { value: count }
    regional: {},       // question -> { "region|answer": count }
    rateLimitCounters: 0,
    unknownKeys: [],    // [{ key, type }]
    keysInDatabase: Number(databaseSize) || 0,
    keysWithOurPrefix: unique.length,
  };

  const reads = [];
  for (const key of unique) {
    const kind = categorize(key);
    if (kind === 'total' || kind === 'drinksTotal') reads.push({ key, kind, command: ['GET', key] });
    else if (kind === 'answers' || kind === 'drinkParts' || kind === 'regional') reads.push({ key, kind, command: ['HGETALL', key] });
    else if (kind === 'rateLimit') snapshot.rateLimitCounters += 1; // counted only, never read
    else reads.push({ key, kind, command: ['TYPE', key] });
  }

  const results = reads.length ? await run(reads.map((r) => r.command)) : [];
  reads.forEach(({ key, kind }, index) => {
    const name = key.slice(PREFIX.length);
    const value = results[index];
    if (kind === 'total') snapshot.total = Number(value) || 0;
    else if (kind === 'drinksTotal') snapshot.drinksTotal = Number(value) || 0;
    else if (kind === 'answers') snapshot.answers[name.slice(2)] = pairsToCounts(value);
    else if (kind === 'drinkParts') snapshot.drinkParts[name.slice(6)] = pairsToCounts(value);
    else if (kind === 'regional') snapshot.regional[name.slice(2)] = pairsToCounts(value);
    else snapshot.unknownKeys.push({ key, type: value });
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

  add('BOBA LAB: READ-ONLY SNAPSHOT');
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
  add('A reset of "boba:v1:*" WOULD clear:');
  add(`  - ${Object.keys(snapshot.answers).length} answer counter groups, ${Object.keys(snapshot.regional).length} regional groups, ${Object.keys(snapshot.drinkParts).length} drink groups`);
  add('  - the submission total and the shared-drink total');
  add(`  - ${snapshot.rateLimitCounters} short-lived rate-limit counters (they delete themselves within 24 hours anyway)`);
  add(`A reset would NOT touch the other ${Math.max(0, snapshot.keysInDatabase - snapshot.keysWithOurPrefix)} key(s) in this database.`);

  if (snapshot.unknownKeys.length) {
    add();
    add('ATTENTION: keys with our prefix that this tool does not recognise (a reset would delete them too):');
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
    add('Nothing here should be a real participant. You can approve the reset.');
  } else if (snapshot.total > expected) {
    add(`MISMATCH: the total is ${snapshot.total} but you expect ${expected} test submission(s).`);
    add(`${snapshot.total - expected} submission(s) came from somewhere else. DO NOT reset until you know who they were.`);
  } else {
    add(`MISMATCH: the total is ${snapshot.total}, LOWER than the ${expected} you expect. Check your count before resetting.`);
  }
  return lines.join('\n');
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

  const hasUpstash = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)
    && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);
  if (!hasUpstash) {
    // Without these, the website code would quietly use a temporary in-memory store,
    // and we would "snapshot" nothing. Stop instead.
    console.error('No Upstash settings found. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN first (see docs/repeat-submissions.md).');
    process.exit(1);
  }

  const { runCommands } = await import('../lib/store.js');
  const snapshot = await takeSnapshot(readOnly(runCommands));
  console.log(describe(snapshot, expected));

  if (args.includes('--save')) {
    const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'snapshots');
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, `snapshot-${snapshot.takenAt.replace(/[:.]/g, '-')}.json`);
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
