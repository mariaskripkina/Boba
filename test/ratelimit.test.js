// Automated checks for the repeat-submission limit.
// Run them with:  npm test
//
// What these protect (in plain words):
//   - the 6th answer from one network in a day is refused, and counts nothing;
//   - different networks, and a new day, start fresh;
//   - the same person written two ways (IPv4 / IPv6 tricks) is still one person;
//   - the real network address is never stored or sent anywhere;
//   - a missing secret, an unknown address or a broken counter never blocks real people;
//   - a failed save gives the visitor their answer slot back.

import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Always start from the temporary in-memory store, with the limit switched on.
for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VERCEL', 'RATE_LIMIT_MAX']) {
  delete process.env[name];
}
process.env.MIN_RESPONSES = '3';
const SALT = 'a-test-salt-that-is-long-enough-123';
process.env.RATE_LIMIT_SALT = SALT;

const { resetMemoryStore, advanceMemoryClock, runCommands, readTotals } = await import('../lib/store.js');
const { clientAddress, normalizeAddress, scramble, limitSettings, takeSlot, WINDOW_SECONDS, DEFAULT_LIMIT } = await import('../lib/ratelimit.js');
const survey = (await import('../api/survey.js')).default;
const { startFakeUpstash } = await import('../test-helpers/fake-upstash.js');
const { default: en } = await import('../public/js/i18n/locales/en.js');

// ---- helpers: fake request / response -------------------------------------------------

function fakeRequest(body, headers = {}, socketAddress) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = 'POST';
  req.headers = headers;
  if (socketAddress) req.socket = { remoteAddress: socketAddress };
  return req;
}

async function submit(ip, body = { answers: { adventure: 'try' } }, extra = {}) {
  const res = { statusCode: 200, headers: {}, body: '', setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, end(c) { this.body += c || ''; } };
  const headers = ip ? { 'x-forwarded-for': ip } : {};
  await survey(fakeRequest(body, headers, extra.socket), res);
  return { status: res.statusCode, headers: res.headers, json: JSON.parse(res.body) };
}

beforeEach(() => {
  resetMemoryStore();
  process.env.RATE_LIMIT_SALT = SALT;
  delete process.env.RATE_LIMIT_MAX;
});

// ---- settings --------------------------------------------------------------------------

test('the limit defaults to 5 per 24 hours and can be tuned within sane bounds', () => {
  assert.equal(DEFAULT_LIMIT, 5);
  assert.equal(WINDOW_SECONDS, 86_400);
  assert.equal(limitSettings({ RATE_LIMIT_SALT: SALT }).limit, 5);
  assert.equal(limitSettings({ RATE_LIMIT_SALT: SALT, RATE_LIMIT_MAX: '12' }).limit, 12);
  for (const bad of ['0', '-3', '101', 'many', '']) {
    assert.equal(limitSettings({ RATE_LIMIT_SALT: SALT, RATE_LIMIT_MAX: bad }).limit, 5, `RATE_LIMIT_MAX="${bad}" should fall back to 5`);
  }
});

test('a missing or too-short salt counts as "not set"', () => {
  assert.equal(limitSettings({}).salt, null);
  assert.equal(limitSettings({ RATE_LIMIT_SALT: 'short' }).salt, null);
  assert.equal(limitSettings({ RATE_LIMIT_SALT: SALT }).salt, SALT);
});

// ---- addresses ---------------------------------------------------------------------------

test('the network address comes from the headers Vercel sets, in order of trust, then the socket', () => {
  assert.equal(clientAddress({ headers: { 'x-vercel-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' } }), '1.1.1.1');
  assert.equal(clientAddress({ headers: { 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' } }), '2.2.2.2');
  assert.equal(clientAddress({ headers: { 'x-forwarded-for': '3.3.3.3, 10.0.0.1' } }), '3.3.3.3');
  assert.equal(clientAddress({ headers: { 'x-forwarded-for': 'not-an-address' }, socket: { remoteAddress: '4.4.4.4' } }), '4.4.4.4');
  assert.equal(clientAddress({ headers: {} }), null);
  assert.equal(clientAddress({}), null);
});

test('the same person written differently is still one person (IPv4-in-IPv6)', () => {
  const plain = normalizeAddress('203.0.113.7');
  assert.equal(normalizeAddress('::ffff:203.0.113.7'), plain);
  assert.equal(normalizeAddress('::ffff:cb00:7107'), plain); // the same address in hex form
  assert.notEqual(normalizeAddress('203.0.113.8'), plain);
});

test('an IPv6 connection is counted as its whole /64 block, so rotating addresses does not dodge the limit', () => {
  const a = normalizeAddress('2001:db8:1:2:aaaa:bbbb:cccc:dddd');
  assert.equal(normalizeAddress('2001:0db8:0001:0002:1111:2222:3333:4444'), a);
  assert.equal(normalizeAddress('2001:db8:1:2::1'), a);
  assert.notEqual(normalizeAddress('2001:db8:1:3::1'), a);
  assert.equal(normalizeAddress('fe80::1%eth0'), normalizeAddress('fe80::2'));
  assert.ok(normalizeAddress('::1'));
});

test('nonsense is not an address', () => {
  for (const bad of ['', null, undefined, 'abc', '999.1.1.1', '1.2.3']) assert.equal(normalizeAddress(bad), null);
});

// ---- the scramble ------------------------------------------------------------------------

test('the scrambled code is short, repeatable, secret-dependent, and does not contain the address', () => {
  const normalized = normalizeAddress('203.0.113.7');
  const code = scramble(normalized, SALT);
  assert.match(code, /^[0-9a-f]{32}$/);
  assert.equal(scramble(normalized, SALT), code);
  assert.notEqual(scramble(normalized, `${SALT}-changed`), code);
  assert.notEqual(scramble(normalizeAddress('203.0.113.8'), SALT), code);
  assert.equal(code.includes('203'), false);
});

// ---- the limit itself ----------------------------------------------------------------------

test('the 6th answer from one network in a day is refused with a kind message and counts nothing', async () => {
  for (let i = 1; i <= 5; i += 1) assert.equal((await submit('203.0.113.7')).status, 200, `answer ${i}`);

  const sixth = await submit('203.0.113.7');
  assert.equal(sixth.status, 429);
  assert.equal(sixth.json.code, 'rate_limited');
  const retryAfter = Number(sixth.headers['retry-after']);
  assert.ok(retryAfter > 86_000 && retryAfter <= 86_400, `Retry-After was ${retryAfter}`);
  assert.equal(JSON.stringify(sixth.json).includes('203.0.113.7'), false, 'the reply must not repeat the address');

  assert.equal((await readTotals()).total, 5, 'the refused answer must not be counted');
});

test('another network is not affected', async () => {
  for (let i = 0; i < 6; i += 1) await submit('203.0.113.7');
  assert.equal((await submit('198.51.100.9')).status, 200);
});

test('after 24 hours the counter has forgotten, and the visitor can answer again', async () => {
  for (let i = 0; i < 5; i += 1) await submit('203.0.113.7');
  assert.equal((await submit('203.0.113.7')).status, 429);

  advanceMemoryClock((WINDOW_SECONDS - 60) * 1000);
  assert.equal((await submit('203.0.113.7')).status, 429, 'still inside the window');

  advanceMemoryClock(120 * 1000);
  assert.equal((await submit('203.0.113.7')).status, 200, 'the window has passed');
});

test('RATE_LIMIT_MAX changes the limit (for example a school with many students)', async () => {
  process.env.RATE_LIMIT_MAX = '2';
  assert.equal((await submit('203.0.113.7')).status, 200);
  assert.equal((await submit('203.0.113.7')).status, 200);
  assert.equal((await submit('203.0.113.7')).status, 429);
});

test('IPv4 and its IPv6 spelling share one limit, and one IPv6 block shares one limit', async () => {
  for (let i = 0; i < 3; i += 1) await submit('203.0.113.7');
  for (let i = 0; i < 2; i += 1) assert.equal((await submit('::ffff:203.0.113.7')).status, 200);
  assert.equal((await submit('203.0.113.7')).status, 429);

  const rotating = ['2001:db8:5:6::1', '2001:db8:5:6:1:2:3:4', '2001:db8:5:6:abcd::9', '2001:db8:5:6::77', '2001:db8:5:6:9:9:9:9'];
  for (const ip of rotating) assert.equal((await submit(ip)).status, 200);
  assert.equal((await submit('2001:db8:5:6:f:f:f:f')).status, 429);
});

test('bad requests, bots and refused answers do not use up anyone\'s answers', async () => {
  for (let i = 0; i < 8; i += 1) {
    assert.equal((await submit('203.0.113.7', { answers: { adventure: 'not-a-real-option' } })).status, 400);
    assert.equal((await submit('203.0.113.7', { answers: { adventure: 'try' }, website: 'http://spam' })).status, 200);
  }
  assert.equal((await readTotals()).total, 0);
  for (let i = 0; i < 5; i += 1) assert.equal((await submit('203.0.113.7')).status, 200);
});

// ---- never blocking the wrong people -----------------------------------------------------------

test('without a salt the limit is OFF (survey keeps working) and a warning is logged once', async () => {
  delete process.env.RATE_LIMIT_SALT;
  const warn = mock.method(console, 'warn', () => {});
  try {
    for (let i = 0; i < 8; i += 1) assert.equal((await submit('203.0.113.7')).status, 200);
    assert.ok(warn.mock.callCount() <= 1, 'the warning should not repeat on every request');
    assert.equal(warn.mock.calls.every((c) => String(c.arguments[0]).includes('RATE_LIMIT_SALT')), true);
  } finally {
    warn.mock.restore();
  }
});

test('visitors with no readable address are never grouped into one shared bucket', async () => {
  for (let i = 0; i < 8; i += 1) assert.equal((await submit(null)).status, 200);
  assert.equal((await readTotals()).total, 8);
});

test('a counter that somehow has no expiry is repaired, so nobody is blocked forever', async () => {
  const key = `boba:v1:rl:${scramble(normalizeAddress('203.0.113.7'), SALT)}`;
  await runCommands([['INCR', key]]); // a counter without an expiry
  assert.deepEqual(await runCommands([['TTL', key]]), [-1]);

  const slot = await takeSlot(fakeRequest({}, { 'x-forwarded-for': '203.0.113.7' }));
  assert.equal(slot.allowed, true);
  const [ttl] = await runCommands([['TTL', key]]);
  assert.ok(ttl > 0 && ttl <= WINDOW_SECONDS, `TTL is now ${ttl}`);
});

// ---- privacy: what is actually stored ----------------------------------------------------------------

test('only a scrambled code and a small number are stored: no address, no answers, and it expires', async () => {
  await submit('203.0.113.7');
  await submit('2001:db8:5:6::1');

  const memory = globalThis.__bobaMemory;
  const limiterKeys = [...memory.keys()].filter((k) => k.startsWith('boba:v1:rl:'));
  assert.equal(limiterKeys.length, 2);
  for (const key of limiterKeys) {
    assert.match(key, /^boba:v1:rl:[0-9a-f]{32}$/);
    assert.equal(typeof memory.get(key), 'number');
    assert.ok(memory.get(key) >= 1 && memory.get(key) <= 5);
    const [ttl] = await runCommands([['TTL', key]]);
    assert.ok(ttl > 0 && ttl <= WINDOW_SECONDS, 'every counter must expire');
  }
  const everything = JSON.stringify([...memory.entries()]);
  for (const fragment of ['203.0.113', '2001:db8']) {
    assert.equal(everything.includes(fragment), false, `stored data contains "${fragment}"`);
  }
});

test('the code never logs or writes the address, and the limiter files contain no logging of requests', () => {
  const source = fs.readFileSync(path.join(root, 'lib/ratelimit.js'), 'utf8').replace(/\/\/.*$/gm, '');
  const logCalls = source.match(/console\.\w+\([^)]*\)/g) || [];
  for (const call of logCalls) assert.equal(/address|ip\b|normalized|key/i.test(call), false, `suspicious log call: ${call}`);
});

// ---- the real storage path (a pretend Upstash over HTTP) --------------------------------------------------

async function withFakeUpstash(run) {
  const fake = await startFakeUpstash();
  fake.connect();
  try { await run(fake); } finally { fake.disconnect(); await fake.close(); }
}

test('with real Upstash-style storage: the limit works, counters expire, and the address is never sent', async () => {
  await withFakeUpstash(async (fake) => {
    for (let i = 0; i < 5; i += 1) assert.equal((await submit('203.0.113.7')).status, 200);
    assert.equal((await submit('203.0.113.7')).status, 429);

    const limiterKey = [...fake.data.keys()].find((k) => k.startsWith('boba:v1:rl:'));
    assert.ok(fake.expiry.has(limiterKey), 'the counter must have an expiry in storage');
    assert.equal(fake.data.get('boba:v1:total') > 0, true);
    assert.equal(fake.data.get('boba:v1:total'), 5);

    const everythingSent = JSON.stringify(fake.log);
    assert.equal(everythingSent.includes('203.0.113.7'), false, 'the address must never be sent to storage');
    assert.equal(everythingSent.includes(SALT), false, 'the secret must never be sent to storage');

    fake.advanceClock((WINDOW_SECONDS + 5) * 1000);
    assert.equal((await submit('203.0.113.7')).status, 200);
  });
});

test('if saving fails, the visitor gets the answer slot back', async () => {
  await withFakeUpstash(async (fake) => {
    fake.state.failWhen = (command, key) => command === 'INCR' && key === 'boba:v1:total';
    const error = mock.method(console, 'error', () => {});
    try {
      for (let i = 0; i < 4; i += 1) assert.equal((await submit('203.0.113.7')).status, 500);
    } finally {
      error.mock.restore();
    }
    const limiterKey = [...fake.data.keys()].find((k) => k.startsWith('boba:v1:rl:'));
    assert.equal(fake.data.get(limiterKey), 0, 'each failed save should have been handed back');

    fake.state.failWhen = null;
    for (let i = 0; i < 5; i += 1) assert.equal((await submit('203.0.113.7')).status, 200, 'all five answers still available');
  });
});

test('if the counter storage is down, the limiter lets people through and logs no address', async () => {
  await withFakeUpstash(async (fake) => {
    fake.state.failAll = true;
    const error = mock.method(console, 'error', () => {});
    try {
      const slot = await takeSlot(fakeRequest({}, { 'x-forwarded-for': '203.0.113.7' }));
      assert.equal(slot.allowed, true);
      const logged = JSON.stringify(error.mock.calls.map((c) => c.arguments));
      assert.equal(logged.includes('203.0.113.7'), false);
      assert.ok(logged.includes('rate limit check failed'));
    } finally {
      error.mock.restore();
    }
  });
});

// ---- the website side ----------------------------------------------------------------------------------

test('the website knows how to show the rate_limited message, and the server code is "rate_limited"', () => {
  const client = fs.readFileSync(path.join(root, 'public/js/survey.js'), 'utf8');
  const known = client.match(/KNOWN_ERROR_CODES = \[([^\]]*)\]/)[1].match(/'(\w+)'/g).map((s) => s.slice(1, -1));
  assert.ok(known.includes('rate_limited'));
  assert.ok(en.messages.survey.errors.rate_limited.length > 20);
  for (const code of Object.keys(en.messages.survey.errors)) {
    if (!['generic', 'network'].includes(code)) assert.ok(known.includes(code), `client does not list "${code}"`);
  }
  assert.ok(en.messages.survey.alreadyAnswered.length > 20);
});

test('the browser reminder is gentle: it is a note, not a lock, and the "answer again" button stays', () => {
  const client = fs.readFileSync(path.join(root, 'public/js/survey.js'), 'utf8');
  assert.match(client, /survey-form__note/);
  assert.match(client, /t\('survey\.answerAgain'\)/);
  assert.equal(/disabled\s*=\s*true[^;]*alreadyAnswered|alreadyAnswered[^;]*disabled/i.test(client), false);
});
