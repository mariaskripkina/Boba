// Automated checks for the read-only launch snapshot tool (scripts/snapshot.js).
// Run them with:  npm test
//
// What these protect (in plain words):
//   - the tool can ONLY read: anything that could change data is refused before it is sent;
//   - it finds exactly the counters a reset of "boba:v1:*" would clear, and nothing else;
//   - it does not read the short-lived rate-limit counters, and warns about unknown keys;
//   - the "--expect" comparison tells a safe reset apart from one that might lose real answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startFakeUpstash, FAKE_TOKEN } from '../test-helpers/fake-upstash.js';

const { readOnly, takeSnapshot, describe, categorize, consistencyNotes, READ_ONLY_COMMANDS } = await import('../scripts/snapshot.js');

// Talk to the fake server the same way the website does (plain HTTPS pipeline).
const runner = (fake) => async (commands) => {
  const response = await fetch(`${fake.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${FAKE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  return (await response.json()).map((entry) => {
    if (entry.error) throw new Error(entry.error);
    return entry.result;
  });
};

// Put pretend data into the fake server: 4 submissions, 2 with a region.
function seed(fake) {
  fake.data.set('boba:v1:total', 4);
  fake.data.set('boba:v1:drinks', 2);
  fake.data.set('boba:v1:q:adventure', { try: 3, ask: 1 });
  fake.data.set('boba:v1:q:sweetness', { '50': 4 });
  fake.data.set('boba:v1:x:adventure', { 'europe|try': 2 });
  fake.data.set('boba:v1:drink:tea', { oolong: 2 });
  fake.data.set('boba:v1:rl:0123456789abcdef0123456789abcdef', 4);
  fake.data.set('someone-elses-key', 'hello');
}

test('the safety belt refuses anything that could change data, before it is sent', async () => {
  const sent = [];
  const guarded = readOnly(async (commands) => { sent.push(commands); return []; });
  for (const command of ['SET', 'DEL', 'FLUSHALL', 'FLUSHDB', 'INCR', 'DECR', 'HINCRBY', 'EXPIRE', 'EVAL', 'UNLINK', 'hset', 'del']) {
    await assert.rejects(() => guarded([['GET', 'a'], [command, 'boba:v1:total']]), /Refused/, command);
  }
  assert.equal(sent.length, 0, 'nothing may be sent when any command in the batch is unsafe');
  await guarded([['GET', 'a'], ['hgetall', 'b']]); // reading is fine, in any letter case
  assert.equal(sent.length, 1);
  assert.deepEqual([...READ_ONLY_COMMANDS].sort(), ['DBSIZE', 'GET', 'HGETALL', 'SCAN', 'TYPE']);
});

test('keys are sorted into plain categories', () => {
  assert.equal(categorize('boba:v1:total'), 'total');
  assert.equal(categorize('boba:v1:drinks'), 'drinksTotal');
  assert.equal(categorize('boba:v1:q:adventure'), 'answers');
  assert.equal(categorize('boba:v1:x:travel'), 'regional');
  assert.equal(categorize('boba:v1:drink:tea'), 'drinkParts');
  assert.equal(categorize('boba:v1:rl:abc'), 'rateLimit');
  assert.equal(categorize('boba:v1:something-new'), 'unknown');
});

test('the snapshot finds exactly our counters, changes nothing, and never reads the rate-limit counters', async () => {
  const fake = await startFakeUpstash();
  try {
    seed(fake);
    const before = JSON.stringify([...fake.data.entries()]);

    const snapshot = await takeSnapshot(readOnly(runner(fake)));

    assert.equal(snapshot.total, 4);
    assert.equal(snapshot.drinksTotal, 2);
    assert.deepEqual(snapshot.answers.adventure, { try: 3, ask: 1 });
    assert.deepEqual(snapshot.answers.sweetness, { '50': 4 });
    assert.deepEqual(snapshot.regional.adventure, { 'europe|try': 2 });
    assert.deepEqual(snapshot.drinkParts.tea, { oolong: 2 });
    assert.equal(snapshot.rateLimitCounters, 1);
    assert.deepEqual(snapshot.unknownKeys, []);
    assert.equal(snapshot.keysWithOurPrefix, 7);
    assert.equal(snapshot.keysInDatabase, 8);

    assert.equal(JSON.stringify([...fake.data.entries()]), before, 'the data must be untouched');
    const used = new Set(fake.log.map(([command]) => command));
    for (const command of used) assert.ok(READ_ONLY_COMMANDS.has(command), `unexpected command ${command}`);
    const readKeys = fake.log.filter(([c]) => c === 'GET' || c === 'HGETALL').map(([, key]) => key);
    assert.equal(readKeys.some((k) => k.includes(':rl:')), false, 'rate-limit counters must not be read');
    assert.equal(readKeys.includes('someone-elses-key'), false, 'other keys must not be read');
  } finally {
    await fake.close();
  }
});

test('keys we do not recognise are called out, because a reset would delete them too', async () => {
  const fake = await startFakeUpstash();
  try {
    seed(fake);
    fake.data.set('boba:v1:mystery', 'who knows');
    const snapshot = await takeSnapshot(readOnly(runner(fake)));
    assert.deepEqual(snapshot.unknownKeys, [{ key: 'boba:v1:mystery', type: 'string' }]);
    assert.match(describe(snapshot), /ATTENTION: keys with our prefix that this tool does not recognise/);
    assert.match(describe(snapshot), /boba:v1:mystery/);
  } finally {
    await fake.close();
  }
});

test('the report says what a reset would and would not touch', async () => {
  const fake = await startFakeUpstash();
  try {
    seed(fake);
    const report = describe(await takeSnapshot(readOnly(runner(fake))));
    assert.match(report, /Nothing was changed/);
    assert.match(report, /Submissions counted: 4/);
    assert.match(report, /WOULD clear/);
    assert.match(report, /1 short-lived rate-limit counters/);
    assert.match(report, /would NOT touch the other 1 key/);
    assert.equal(report.includes(fake.url), false, 'the report must not show connection details');
    assert.equal(report.includes(FAKE_TOKEN), false, 'the report must not show the token');
  } finally {
    await fake.close();
  }
});

test('--expect tells a safe reset apart from one that could lose real answers', async () => {
  const fake = await startFakeUpstash();
  try {
    seed(fake);
    const snapshot = await takeSnapshot(readOnly(runner(fake)));
    assert.match(describe(snapshot, 4), /MATCH: the total \(4\) equals the 4 test submission/);
    assert.match(describe(snapshot, 3), /MISMATCH.*DO NOT reset|DO NOT reset/s);
    assert.match(describe(snapshot, 3), /1 submission\(s\) came from somewhere else/);
    assert.match(describe(snapshot, 9), /LOWER than the 9/);
    assert.match(describe(snapshot), /No: only totals are stored, by design/);
  } finally {
    await fake.close();
  }
});

test('numbers that cannot all be true are flagged', () => {
  const notes = consistencyNotes({ total: 2, drinksTotal: 5, answers: { adventure: { try: 3 } }, regional: { adventure: { 'europe|try': 4 } } });
  assert.equal(notes.length, 3);
  assert.deepEqual(consistencyNotes({ total: 4, drinksTotal: 2, answers: { adventure: { try: 4 } }, regional: { adventure: { 'europe|try': 2 } } }), []);
});

test('an empty database gives a clean, empty report', async () => {
  const fake = await startFakeUpstash();
  try {
    const snapshot = await takeSnapshot(readOnly(runner(fake)));
    assert.equal(snapshot.total, 0);
    assert.match(describe(snapshot, 0), /MATCH/);
  } finally {
    await fake.close();
  }
});
