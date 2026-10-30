// Proof that Preview and Production cannot touch each other's data.
// Run them with:  npm test
//
// The setup: ONE pretend Upstash database holds Production data (keys "boba:v1:...") and
// Preview data (keys "boba-preview:<label>:v1:..."), exactly like the real shared database
// would. Each test then acts as one environment and checks that the OTHER one's keys did
// not change, and that not a single command touched them (the fake server logs every command).
//
// What these protect (in plain words):
//   - Production always uses "boba:v1" and ignores any Preview setting;
//   - a Preview with a missing or invalid namespace is switched off and sends NOTHING;
//   - a Preview cannot read, change or delete a Production key, and Production cannot
//     touch a Preview key, even if code asks for it directly;
//   - the rate limiter, the snapshot tool and the reset tool all stay inside their namespace;
//   - no code can build keys, or reach Redis, without going through the guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VERCEL', 'VERCEL_ENV', 'PREVIEW_NAMESPACE', 'RATE_LIMIT_MAX']) {
  delete process.env[name];
}
process.env.MIN_RESPONSES = '3';
process.env.RATE_LIMIT_SALT = 'an-isolation-test-salt-long-enough';

const ns = await import('../lib/namespace.js');
const { keyFor, runCommands, storeConfigured, resetMemoryStore } = await import('../lib/store.js');
const survey = (await import('../api/survey.js')).default;
const results = (await import('../api/results.js')).default;
const { startFakeUpstash, FAKE_TOKEN } = await import('../test-helpers/fake-upstash.js');
const snapshotTool = await import('../scripts/snapshot.js');
const resetTool = await import('../scripts/reset-preview.js');

const PROD = 'boba:v1';
const previewOf = (label) => `boba-preview:${label}:v1`;
const VALID_LABELS = ['rate-limit-test', 'feature-rate-limit', 'abc', 'a1b2c3', 'test-2'];
const BAD_LABELS = [
  undefined, '', '   ', 'ab', 'x'.repeat(41), 'Prod', 'PROD', 'Test-A', 'production', 'prod', 'live', 'main', 'boba', 'default',
  'my label', 'a:b', 'boba:v1', 'test*', 'test?', 'a/b', '../x', '-test', 'test-', 'te--st', 'tést', 'test\u0000', 'test-a:v1',
];

// ---- helpers ---------------------------------------------------------------------------------

function seedProduction(fake) {
  fake.data.set(`${PROD}:total`, 50);
  fake.data.set(`${PROD}:drinks`, 20);
  fake.data.set(`${PROD}:q:adventure`, { try: 30, ask: 20 });
  fake.data.set(`${PROD}:q:sweetness`, { 50: 50 });
  fake.data.set(`${PROD}:x:adventure`, { 'europe|try': 12 });
  fake.data.set(`${PROD}:drink:tea`, { oolong: 20 });
  const limiterKey = `${PROD}:rl:${'a'.repeat(32)}`;
  fake.data.set(limiterKey, 3);
  fake.expiry.set(limiterKey, Date.now() + 86_400_000);
}

function seedPreview(fake, label, total) {
  const space = previewOf(label);
  fake.data.set(`${space}:total`, total);
  fake.data.set(`${space}:q:adventure`, { try: total });
  fake.data.set(`${space}:rl:${'b'.repeat(32)}`, 1);
}

async function withFake(run) {
  const fake = await startFakeUpstash();
  seedProduction(fake);
  try { await run(fake); } finally { fake.disconnect(); await fake.close(); }
}

// Every key (or key pattern) mentioned by the commands the fake server received.
function touchedKeys(log) {
  const keys = [];
  for (const [command, first, ...rest] of log) {
    if (command === 'DBSIZE') continue;
    if (command === 'SCAN') keys.push(rest[rest.indexOf('MATCH') + 1]);
    else if (command === 'DEL') keys.push(first, ...rest);
    else keys.push(first);
  }
  return keys;
}

function post(ip, body = { answers: { adventure: 'try' } }) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = 'POST';
  req.headers = ip ? { 'x-forwarded-for': ip } : {};
  return call(survey, req);
}

function get() {
  const req = Readable.from([]);
  req.method = 'GET';
  req.headers = {};
  return call(results, req);
}

async function call(handler, req) {
  const res = { statusCode: 200, headers: {}, body: '', setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, end(c) { this.body += c || ''; } };
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

// Run one of the scripts as a real separate program, pointed at the fake database.
function runScript(script, args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', script), ...args], { cwd: root, env: { PATH: process.env.PATH, ...env } });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}
const credentialsFor = (fake) => ({ UPSTASH_REDIS_REST_URL: fake.url, UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN });

// ---- 1. which namespace does each environment get? --------------------------------------------------

test('Production always gets "boba:v1" and ignores every Preview setting, even hostile ones', () => {
  for (const label of [undefined, '', 'rate-limit-test', 'INVALID LABEL', 'boba-preview:x', 'boba:v1', '*', 'production']) {
    const where = ns.resolveNamespace({ VERCEL: '1', VERCEL_ENV: 'production', PREVIEW_NAMESPACE: label });
    assert.deepEqual(where, { ok: true, kind: 'production', namespace: 'boba:v1' }, `PREVIEW_NAMESPACE=${JSON.stringify(label)}`);
  }
});

test('a Preview gets its own namespace, which can never overlap the Production one', () => {
  for (const label of VALID_LABELS) {
    const where = ns.resolveNamespace({ VERCEL: '1', VERCEL_ENV: 'preview', PREVIEW_NAMESPACE: label });
    assert.deepEqual(where, { ok: true, kind: 'preview', namespace: `boba-preview:${label}:v1` });
    assert.notEqual(where.namespace, PROD);
    assert.equal(`${where.namespace}:total`.startsWith(`${PROD}:`), false, 'a Preview key must never look like a Production key');
    assert.equal(`${PROD}:total`.startsWith(`${where.namespace}:`), false, 'a Production key must never look like a Preview key');
  }
  assert.equal(ns.resolveNamespace({ VERCEL_ENV: 'preview', PREVIEW_NAMESPACE: '  rate-limit-test\n' }).namespace, 'boba-preview:rate-limit-test:v1', 'stray whitespace from copy and paste is harmless');
});

test('a Preview with a missing or invalid namespace is switched OFF, never pointed at Production', () => {
  for (const label of BAD_LABELS) {
    for (const environment of [{ VERCEL: '1', VERCEL_ENV: 'preview' }, { VERCEL: '1' }, { VERCEL_ENV: 'development', UPSTASH_REDIS_REST_URL: 'https://x', UPSTASH_REDIS_REST_TOKEN: 't' }]) {
      const where = ns.resolveNamespace({ ...environment, PREVIEW_NAMESPACE: label });
      assert.equal(where.ok, false, `${JSON.stringify(label)} in ${JSON.stringify(environment)} must be blocked`);
      assert.equal(where.namespace, undefined, 'a blocked environment has no namespace at all');
    }
  }
});

test('only the exact word "production" means Production; look-alikes are treated as a Preview', () => {
  for (const vercelEnv of ['Production', 'PRODUCTION', 'prod', ' production', 'production ', 'staging', 'preview', 'development', '', undefined]) {
    const bare = ns.resolveNamespace({ VERCEL: '1', VERCEL_ENV: vercelEnv });
    assert.equal(bare.ok, false, `VERCEL_ENV=${JSON.stringify(vercelEnv)} with no label must be blocked`);
    const labelled = ns.resolveNamespace({ VERCEL: '1', VERCEL_ENV: vercelEnv, PREVIEW_NAMESPACE: 'rate-limit-test' });
    assert.equal(labelled.kind, 'preview');
    assert.equal(labelled.namespace, 'boba-preview:rate-limit-test:v1');
  }
});

test('a computer holding Redis credentials but no namespace is blocked (the "pasted live credentials" mistake)', () => {
  const where = ns.resolveNamespace({ UPSTASH_REDIS_REST_URL: 'https://live-db.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'live-token' });
  assert.equal(where.ok, false);
  const viaKv = ns.resolveNamespace({ KV_REST_API_URL: 'https://live-db.upstash.io', KV_REST_API_TOKEN: 'live-token' });
  assert.equal(viaKv.ok, false);
  assert.equal(ns.resolveNamespace({}).kind, 'local', 'with no Redis at all, the temporary in-memory store is fine');
});

test('previewNamespace refuses anything that is not a valid label', () => {
  for (const label of BAD_LABELS) assert.throws(() => ns.previewNamespace(label), undefined, JSON.stringify(label));
  assert.equal(ns.previewNamespace('abc'), 'boba-preview:abc:v1');
});

// ---- 2. the guard: nothing leaves the server unless it is inside the namespace ------------------------------------

test('the guard allows the website\'s own commands inside the namespace', () => {
  assert.doesNotThrow(() => ns.assertInNamespace([
    ['INCR', 'boba:v1:total'], ['HINCRBY', 'boba:v1:q:adventure', 'try', 1], ['EXPIRE', 'boba:v1:rl:x', 86400], ['TTL', 'boba:v1:rl:x'],
    ['DECR', 'boba:v1:rl:x'], ['GET', 'boba:v1:total'], ['HGETALL', 'boba:v1:q:adventure'],
  ], PROD));
});

test('the guard refuses every website command aimed at the OTHER environment, in both directions', () => {
  const preview = previewOf('test-a');
  for (const command of ['INCR', 'DECR', 'HINCRBY', 'EXPIRE', 'TTL', 'GET', 'HGETALL']) {
    assert.throws(() => ns.assertInNamespace([[command, `${PROD}:total`, 'f', 1]], preview), /Refused/, `${command}: Preview -> Production key`);
    assert.throws(() => ns.assertInNamespace([[command, `${preview}:total`, 'f', 1]], PROD), /Refused/, `${command}: Production -> Preview key`);
    assert.throws(() => ns.assertInNamespace([[command, `${previewOf('test-ab')}:total`, 'f', 1]], preview), /Refused/, `${command}: one Preview -> another Preview`);
  }
});

test('look-alike keys are refused too', () => {
  for (const key of ['boba:v10:total', 'boba:v1', 'boba:v1:', 'boba:v2:total', 'xboba:v1:total', 'BOBA:V1:total', '', undefined, null, 42, ['boba:v1:total']]) {
    assert.throws(() => ns.assertInNamespace([['GET', key]], PROD), /Refused/, JSON.stringify(key));
  }
  assert.throws(() => ns.assertInNamespace([['GET', 'boba-preview:test-a:v10:total']], previewOf('test-a')), /Refused/);
  assert.throws(() => ns.assertInNamespace([['GET', 'boba-preview:test-a:v1']], previewOf('test-a')), /Refused/);
});

test('dangerous commands are refused outright, in any letter case', () => {
  for (const command of ['FLUSHALL', 'FLUSHDB', 'KEYS', 'EVAL', 'EVALSHA', 'DEL', 'UNLINK', 'SCAN', 'DBSIZE', 'CONFIG', 'SET', 'MSET', 'RENAME', 'COPY', 'MOVE', 'SELECT', 'SWAPDB', 'RESTORE', 'DUMP', 'flushall', 'Keys']) {
    assert.throws(() => ns.assertInNamespace([[command, 'boba:v1:total']], PROD), /Refused/, command);
    assert.throws(() => ns.assertInNamespace([[command]], PROD), /Refused/, `${command} without a key`);
  }
});

test('one bad command in a batch stops the whole batch, and nothing is sent', async () => {
  const sent = [];
  const run = ns.guardedRunner(async (commands) => { sent.push(commands); return []; }, PROD);
  await assert.rejects(() => run([['INCR', 'boba:v1:total'], ['INCR', 'boba-preview:x:v1:total']]), /Refused/);
  await assert.rejects(() => run([['INCR', 'boba:v1:total'], ['FLUSHALL']]), /Refused/);
  await assert.rejects(() => run('not a list'), /Refused/);
  await assert.rejects(() => run([null]), /Refused/);
  assert.equal(sent.length, 0);
  await run([['INCR', 'boba:v1:total']]);
  assert.equal(sent.length, 1);
});

test('scans and deletes are only allowed inside the namespace, and only where a tool asks for them', () => {
  const scanAllowed = new Set(['SCAN', 'DEL']);
  const preview = previewOf('test-a');
  assert.doesNotThrow(() => ns.assertInNamespace([['SCAN', '0', 'MATCH', `${preview}:*`, 'COUNT', 200]], preview, scanAllowed));
  for (const bad of [['SCAN', '0'], ['SCAN', '0', 'COUNT', 100], ['SCAN', '0', 'MATCH', '*'], ['SCAN', '0', 'MATCH', 'boba:v1:*'], ['SCAN', '0', 'MATCH', 'boba-preview:*'], ['SCAN', '0', 'MATCH', 'boba-preview:test-a*'], ['DEL'], ['DEL', 'boba:v1:total'], ['DEL', `${preview}:a`, 'boba:v1:total']]) {
    assert.throws(() => ns.assertInNamespace([bad], preview, scanAllowed), /Refused/, JSON.stringify(bad));
  }
});

// ---- 3. end to end: a Preview cannot touch Production ---------------------------------------------------------------

test('a Preview saves answers ONLY under its own namespace; Production data is not changed and not even touched', async () => {
  await withFake(async (fake) => {
    fake.connect({ environment: 'preview', label: 'test-a' });
    seedPreview(fake, 'other-test', 7);
    const productionBefore = fake.slice(`${PROD}:`);
    const otherBefore = fake.slice(`${previewOf('other-test')}:`);
    fake.log.length = 0;

    for (let i = 0; i < 4; i += 1) assert.equal((await post('203.0.113.7', { answers: { adventure: 'try', sweetness: '50' }, region: 'europe', drink: { tea: 'oolong', flavor: 'taro', sweet: '50', toppings: ['tapioca'] } })).status, 200);

    assert.equal(fake.slice(`${PROD}:`), productionBefore, 'Production keys must be byte-for-byte unchanged');
    assert.equal(fake.slice(`${previewOf('other-test')}:`), otherBefore, 'another Preview namespace must be unchanged');
    assert.ok(fake.log.length > 0);
    for (const key of touchedKeys(fake.log)) {
      assert.ok(key.startsWith(`${previewOf('test-a')}:`), `a command touched "${key}", which is outside the Preview namespace`);
    }
    assert.equal(fake.data.get(`${previewOf('test-a')}:total`), 4);
  });
});

test('a Preview cannot READ Production numbers: its results start at zero even though Production has 50', async () => {
  await withFake(async (fake) => {
    fake.connect({ environment: 'preview', label: 'test-a' });
    const empty = await get();
    assert.equal(empty.json.total, 0, 'must not see the live total of 50');
    assert.equal(empty.json.storage, 'preview');
    assert.equal(empty.json.ready, false);

    for (let i = 0; i < 3; i += 1) await post('198.51.100.1');
    const after = await get();
    assert.equal(after.json.ready, true);
    assert.equal(after.json.total, 3);
    assert.deepEqual(after.json.answers.adventure, { try: 3 }, 'only the 3 Preview answers, not Production\'s 30/20 split');
        for (const key of touchedKeys(fake.log)) assert.ok(key.startsWith(`${previewOf('test-a')}:`), key);
  });
});

test('the rate limiter in a Preview uses Preview keys only; the Production limiter key is untouched', async () => {
  await withFake(async (fake) => {
    fake.connect({ environment: 'preview', label: 'test-a' });
    const productionBefore = fake.slice(`${PROD}:`);
    for (let i = 0; i < 5; i += 1) assert.equal((await post('203.0.113.7')).status, 200);
    assert.equal((await post('203.0.113.7')).status, 429);

    const limiterKeys = [...fake.data.keys()].filter((k) => k.includes(':rl:'));
    assert.ok(limiterKeys.some((k) => k.startsWith(`${previewOf('test-a')}:rl:`)));
    assert.equal(fake.slice(`${PROD}:`), productionBefore, 'the seeded Production limiter counter (value 3) is untouched');
    assert.equal(fake.data.get(`${PROD}:rl:${'a'.repeat(32)}`), 3);
  });
});

test('a Preview with a missing or invalid namespace sends NOTHING to Redis and Production stays untouched', async () => {
  await withFake(async (fake) => {
    const productionBefore = fake.slice(`${PROD}:`);
    for (const label of BAD_LABELS.filter((l) => !String(l).includes('\u0000'))) { // a real environment variable cannot hold a NUL character
      fake.connect({ environment: 'preview', label });
      fake.log.length = 0;

      assert.equal(storeConfigured(), false, `label ${JSON.stringify(label)}`);
      const saved = await post('203.0.113.7');
      assert.equal(saved.status, 503);
      assert.equal(saved.json.code, 'storage_not_configured');
      assert.equal((await get()).json.configured, false);
      assert.throws(() => keyFor('total'), /switched off/);
      await assert.rejects(() => runCommands([['INCR', `${PROD}:total`]]), /not configured/);

      assert.equal(fake.log.length, 0, `label ${JSON.stringify(label)}: no command may reach Redis`);
    }
    assert.equal(fake.slice(`${PROD}:`), productionBefore);
  });
});

test('a bare environment (Redis credentials, no environment information) is switched off too', async () => {
  await withFake(async (fake) => {
    fake.connect({ environment: 'bare' });
    assert.equal(storeConfigured(), false);
    assert.equal((await post('203.0.113.7')).status, 503);
    assert.equal(fake.log.length, 0);
  });
});

test('even code that tries directly cannot make a Preview read, change or delete a Production key', async () => {
  await withFake(async (fake) => {
    fake.connect({ environment: 'preview', label: 'test-a' });
    const productionBefore = fake.slice(`${PROD}:`);
    fake.log.length = 0;

    const attacks = [
      [['INCR', `${PROD}:total`]], [['DECR', `${PROD}:total`]], [['GET', `${PROD}:total`]], [['HGETALL', `${PROD}:q:adventure`]],
      [['HINCRBY', `${PROD}:q:adventure`, 'try', 100]], [['EXPIRE', `${PROD}:rl:${'a'.repeat(32)}`, 1]], [['TTL', `${PROD}:total`]],
      [['DEL', `${PROD}:total`]], [['DEL', `${previewOf('test-a')}:x`, `${PROD}:total`]], [['FLUSHALL']], [['FLUSHDB']], [['KEYS', '*']],
      [['SCAN', '0']], [['SCAN', '0', 'MATCH', `${PROD}:*`]], [['SCAN', '0', 'MATCH', '*']], [['DBSIZE']],
      [['EVAL', 'return redis.call("FLUSHALL")', 0]], [['SET', `${PROD}:total`, 0]], [['RENAME', `${PROD}:total`, `${previewOf('test-a')}:total`]],
      [['INCR', `${previewOf('test-a')}:total`], ['INCR', `${PROD}:total`]], // good first, bad second: all or nothing
    ];
    for (const commands of attacks) {
      await assert.rejects(() => runCommands(commands), /Refused/, JSON.stringify(commands));
    }
    assert.equal(fake.log.length, 0, 'not one command may reach Redis');
    assert.equal(fake.slice(`${PROD}:`), productionBefore);
  });
});

// ---- 4. end to end: Production cannot touch a Preview -----------------------------------------------------------------

test('Production saves answers ONLY under "boba:v1"; every Preview namespace is unchanged and untouched', async () => {
  await withFake(async (fake) => {
    fake.connect({ environment: 'production' });
    seedPreview(fake, 'test-a', 7);
    seedPreview(fake, 'other-test', 9);
    const previewsBefore = fake.slice('boba-preview:');
    fake.log.length = 0;

    for (let i = 0; i < 3; i += 1) assert.equal((await post('203.0.113.7')).status, 200);

    assert.equal(fake.slice('boba-preview:'), previewsBefore, 'every Preview namespace must be byte-for-byte unchanged');
    for (const key of touchedKeys(fake.log)) assert.ok(key.startsWith(`${PROD}:`), `a command touched "${key}", which is outside the Production namespace`);
    assert.equal(fake.data.get(`${PROD}:total`), 53);
  });
});

test('Production results show the live numbers and nothing from any Preview', async () => {
  await withFake(async (fake) => {
    fake.connect({ environment: 'production' });
    seedPreview(fake, 'test-a', 7);
    const live = await get();
    assert.equal(live.json.total, 50);
    assert.equal(live.json.storage, 'production');
    assert.deepEqual(live.json.answers.adventure, { try: 30, ask: 20 });
    for (const key of touchedKeys(fake.log)) assert.ok(key.startsWith(`${PROD}:`), key);
  });
});

test('Production ignores PREVIEW_NAMESPACE: a stray or hostile value cannot redirect it', async () => {
  await withFake(async (fake) => {
    seedPreview(fake, 'test-a', 7);
    const previewsBefore = fake.slice('boba-preview:');
    let n = 0;
    for (const label of ['test-a', 'rate-limit-test', 'not a valid label', 'boba-preview:test-a', '*', '']) {
      fake.connect({ environment: 'production', label });
      fake.log.length = 0;
      n += 1;
      assert.equal((await post(`203.0.113.${n}`)).status, 200); // a different address each time, so the 5-a-day limit is not hit
      assert.equal((await get()).json.storage, 'production');
      for (const key of touchedKeys(fake.log)) assert.ok(key.startsWith(`${PROD}:`), `label ${JSON.stringify(label)} -> ${key}`);
    }
    assert.equal(fake.slice('boba-preview:'), previewsBefore);
  });
});

test('even code that tries directly cannot make Production read, change or delete a Preview key', async () => {
  await withFake(async (fake) => {
    fake.connect({ environment: 'production' });
    seedPreview(fake, 'test-a', 7);
    const previewsBefore = fake.slice('boba-preview:');
    fake.log.length = 0;

    const attacks = [
      [['INCR', `${previewOf('test-a')}:total`]], [['GET', `${previewOf('test-a')}:total`]], [['HGETALL', `${previewOf('test-a')}:q:adventure`]],
      [['DEL', `${previewOf('test-a')}:total`]], [['SCAN', '0', 'MATCH', 'boba-preview:*']], [['FLUSHALL']], [['KEYS', 'boba-preview:*']],
    ];
    for (const commands of attacks) await assert.rejects(() => runCommands(commands), /Refused/, JSON.stringify(commands));
    assert.equal(fake.log.length, 0);
    assert.equal(fake.slice('boba-preview:'), previewsBefore);
  });
});

test('two different Preview namespaces cannot see each other either', async () => {
  await withFake(async (fake) => {
    seedPreview(fake, 'test-a', 7);
    seedPreview(fake, 'test-ab', 9);
    fake.connect({ environment: 'preview', label: 'test-a' });
    assert.equal((await get()).json.total, 7);
    fake.connect({ environment: 'preview', label: 'test-ab' });
    assert.equal((await get()).json.total, 9);
    await assert.rejects(() => runCommands([['GET', `${previewOf('test-a')}:total`]]), /Refused/);
  });
});

test('local memory mode is guarded too', async () => {
  resetMemoryStore();
  await assert.rejects(() => runCommands([['INCR', 'boba-preview:x:v1:total']]), /Refused/);
  await assert.rejects(() => runCommands([['FLUSHALL']]), /Refused/);
  await runCommands([['INCR', 'boba:v1:total']]);
  resetMemoryStore();
});

// ---- 5. nothing can build keys or reach Redis around the guard -----------------------------------------------------

const sourceFiles = (dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
const code = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('only lib/namespace.js knows namespace names; no other server file writes a key prefix', () => {
  for (const file of [...sourceFiles('api'), ...sourceFiles('lib'), ...sourceFiles('scripts')]) {
    if (file === path.join('lib', 'namespace.js')) continue;
    const text = code(file);
    assert.equal(/boba:v1|boba-preview/.test(text), false, `${file} must not hard-code a namespace`);
  }
});

test('only lib/store.js talks to Redis from the website, and the scripts always wrap it in a guard', () => {
  for (const file of [...sourceFiles('api'), ...sourceFiles('lib')]) {
    if (file === path.join('lib', 'store.js') || file === path.join('lib', 'upstash.js')) continue;
    assert.equal(/upstash\.js|sendToUpstash|fetch\(/.test(code(file)), false, `${file} must not reach Redis directly`);
  }
  for (const file of ['scripts/snapshot.js', 'scripts/reset-preview.js']) {
    const text = code(file);
    assert.ok(/guardedRunner|snapshotRunner/.test(text), `${file} must send commands through the guard`);
    assert.equal((text.match(/sendToUpstash\(/g) || []).length, 1, `${file} should have exactly one place that sends`);
  }
  const store = code('lib/store.js');
  assert.ok(/assertInNamespace\(commands/.test(store), 'store.run must check every batch');
  assert.equal(/boba:v1/.test(store), false);
});

test('the reset tool has no way to name the Production namespace', () => {
  const text = code('scripts/reset-preview.js');
  assert.equal(/PRODUCTION_NAMESPACE|boba:v1|--production/.test(text), false);
});

// ---- 6. the snapshot tool ------------------------------------------------------------------------------------------------

test('the snapshot tool must be told which namespace to look at, and never guesses', () => {
  assert.match(snapshotTool.chooseNamespace([]).error, /Say which one/);
  assert.match(snapshotTool.chooseNamespace(['--production', '--preview'], { PREVIEW_NAMESPACE: 'abc' }).error, /Not both/);
  assert.deepEqual(snapshotTool.chooseNamespace(['--production']), { kind: 'production', namespace: 'boba:v1' });
  assert.deepEqual(snapshotTool.chooseNamespace(['--production'], { PREVIEW_NAMESPACE: 'ignored-here' }), { kind: 'production', namespace: 'boba:v1' });
  assert.match(snapshotTool.chooseNamespace(['--preview'], {}).error, /PREVIEW_NAMESPACE/);
  for (const label of BAD_LABELS) assert.ok(snapshotTool.chooseNamespace(['--preview'], { PREVIEW_NAMESPACE: label }).error, JSON.stringify(label));
  assert.deepEqual(snapshotTool.chooseNamespace(['--preview'], { PREVIEW_NAMESPACE: 'abc' }), { kind: 'preview', namespace: 'boba-preview:abc:v1' });
});

test('a Preview snapshot sees only Preview data, a Production snapshot only Production data, and neither writes', async () => {
  await withFake(async (fake) => {
    seedPreview(fake, 'test-a', 7);
    const everythingBefore = fake.slice('');
    const send = async (commands) => {
      const response = await fetch(`${fake.url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${FAKE_TOKEN}` }, body: JSON.stringify(commands) });
      return (await response.json()).map((entry) => { if (entry.error) throw new Error(entry.error); return entry.result; });
    };

    fake.log.length = 0;
    const preview = await snapshotTool.takeSnapshot(snapshotTool.snapshotRunner(send, previewOf('test-a'), 'preview'), previewOf('test-a'), 'preview');
    assert.equal(preview.total, 7, 'the Preview snapshot must not see the live 50');
    assert.equal(preview.keysInDatabase, null, 'a Preview snapshot may not count the whole database');
    assert.equal(fake.log.some(([command]) => command === 'DBSIZE'), false);
    for (const key of touchedKeys(fake.log)) assert.ok(key.startsWith(`${previewOf('test-a')}:`), key);

    fake.log.length = 0;
    const production = await snapshotTool.takeSnapshot(snapshotTool.snapshotRunner(send, PROD, 'production'), PROD, 'production');
    assert.equal(production.total, 50, 'the Production snapshot must not add Preview numbers');
    assert.equal(production.keysInNamespace, 7);
    assert.ok(production.keysInDatabase > production.keysInNamespace, 'the database holds Preview keys too, which are not counted as Production');
    for (const key of touchedKeys(fake.log)) assert.ok(key.startsWith(`${PROD}:`), key);

    assert.equal(fake.slice(''), everythingBefore, 'snapshots must not change anything');
    await assert.rejects(() => snapshotTool.snapshotRunner(send, previewOf('test-a'), 'preview')([['GET', `${PROD}:total`]]), /Refused/);
    await assert.rejects(() => snapshotTool.snapshotRunner(send, previewOf('test-a'), 'preview')([['DBSIZE']]), /Refused/);
    await assert.rejects(() => snapshotTool.snapshotRunner(send, PROD, 'production')([['GET', `${previewOf('test-a')}:total`]]), /Refused/);
  });
});

test('the snapshot program refuses to run without --production or --preview, and never prints credentials', async () => {
  await withFake(async (fake) => {
    const base = credentialsFor(fake);
    fake.log.length = 0;
    const neither = await runScript('snapshot.js', [], base);
    assert.equal(neither.code, 1);
    assert.match(neither.err, /Say which one/);
    const noLabel = await runScript('snapshot.js', ['--preview'], base);
    assert.equal(noLabel.code, 1);
    assert.equal(fake.log.length, 0, 'refusals must happen before anything is sent');

    const ok = await runScript('snapshot.js', ['--preview', '--expect', '7'], { ...base, PREVIEW_NAMESPACE: 'test-a' });
    assert.equal(ok.code, 0, ok.err);
    assert.match(ok.out, /SNAPSHOT of PREVIEW/);
    assert.match(ok.out, /boba-preview:test-a:v1:\*/);
    assert.equal(ok.out.includes(fake.url) || ok.out.includes(FAKE_TOKEN) || ok.err.includes(FAKE_TOKEN), false);
  });
});

// ---- 7. the reset tool -----------------------------------------------------------------------------------------------------

test('the reset tool decides its target safely, and deleting needs the label typed exactly', () => {
  assert.match(resetTool.chooseTarget([], { VERCEL_ENV: 'production', PREVIEW_NAMESPACE: 'abc' }).error, /Production/);
  assert.match(resetTool.chooseTarget([], {}).error, /PREVIEW_NAMESPACE/);
  for (const label of BAD_LABELS) assert.ok(resetTool.chooseTarget([], { PREVIEW_NAMESPACE: label }).error, JSON.stringify(label));
  assert.deepEqual(resetTool.chooseTarget([], { PREVIEW_NAMESPACE: 'abc' }), { label: 'abc', namespace: 'boba-preview:abc:v1', deleting: false });
  assert.match(resetTool.chooseTarget(['--delete'], { PREVIEW_NAMESPACE: 'abc' }).error, /--confirm abc/);
  assert.match(resetTool.chooseTarget(['--delete', '--confirm', 'abd'], { PREVIEW_NAMESPACE: 'abc' }).error, /--confirm abc/);
  assert.match(resetTool.chooseTarget(['--delete', '--confirm', 'boba'], { PREVIEW_NAMESPACE: 'abc' }).error, /--confirm abc/);
  assert.equal(resetTool.chooseTarget(['--delete', '--confirm', 'abc'], { PREVIEW_NAMESPACE: 'abc' }).deleting, true);
});

test('resetting a Preview deletes only that Preview\'s keys; Production and other Previews survive', async () => {
  await withFake(async (fake) => {
    seedPreview(fake, 'test-a', 7);
    seedPreview(fake, 'test-ab', 9);
    const productionBefore = fake.slice(`${PROD}:`);
    const neighbourBefore = fake.slice(`${previewOf('test-ab')}:`);
    const send = async (commands) => {
      const response = await fetch(`${fake.url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${FAKE_TOKEN}` }, body: JSON.stringify(commands) });
      return (await response.json()).map((entry) => { if (entry.error) throw new Error(entry.error); return entry.result; });
    };
    const run = ns.guardedRunner(send, previewOf('test-a'), resetTool.RESET_COMMANDS);

    const keys = await resetTool.planReset(run, previewOf('test-a'));
    assert.equal(keys.length, 3);
    assert.ok(keys.every((k) => k.startsWith(`${previewOf('test-a')}:`)), 'the plan must list nothing outside the namespace (test-ab shares the same start)');
    assert.equal(fake.slice(`${previewOf('test-a')}:`).length > 2, true, 'a plan alone deletes nothing');

    const done = await resetTool.executeReset(run, previewOf('test-a'), keys);
    assert.deepEqual(done, { deleted: 3, remaining: 0 });
    assert.equal(fake.slice(`${previewOf('test-a')}:`), '[]');
    assert.equal(fake.slice(`${PROD}:`), productionBefore, 'Production untouched');
    assert.equal(fake.slice(`${previewOf('test-ab')}:`), neighbourBefore, 'the neighbouring Preview untouched');
    for (const key of touchedKeys(fake.log.filter(([c]) => c === 'DEL' || c === 'SCAN'))) assert.ok(key.startsWith(`${previewOf('test-a')}:`), key);
  });
});

test('the reset tool refuses a key list that contains a Production key, and deletes nothing', async () => {
  await withFake(async (fake) => {
    seedPreview(fake, 'test-a', 7);
    const productionBefore = fake.slice(`${PROD}:`);
    const run = ns.guardedRunner(async () => { throw new Error('must not be sent'); }, previewOf('test-a'), resetTool.RESET_COMMANDS);
    await assert.rejects(() => resetTool.executeReset(run, previewOf('test-a'), [`${previewOf('test-a')}:total`, `${PROD}:total`]), /Refusing/);
    for (const commands of [[['DEL', `${PROD}:total`]], [['SCAN', '0', 'MATCH', `${PROD}:*`]], [['FLUSHALL']], [['KEYS', '*']]]) {
      await assert.rejects(() => run(commands), /Refused/, JSON.stringify(commands));
    }
    assert.equal(fake.slice(`${PROD}:`), productionBefore);
  });
});

test('the reset program: dry run by default, refuses unsafe settings, and never touches Production', async () => {
  await withFake(async (fake) => {
    seedPreview(fake, 'test-a', 7);
    const productionBefore = fake.slice(`${PROD}:`);
    const base = credentialsFor(fake);

    const dry = await runScript('reset-preview.js', [], { ...base, PREVIEW_NAMESPACE: 'test-a' });
    assert.equal(dry.code, 0, dry.err);
    assert.match(dry.out, /DRY RUN: nothing was deleted/);
    assert.match(dry.out, /Keys found in it:  3/);
    assert.equal(fake.log.some(([c]) => c === 'DEL'), false);

    fake.log.length = 0;
    const refusals = [
      [['--delete'], { PREVIEW_NAMESPACE: 'test-a' }],
      [['--delete', '--confirm', 'wrong'], { PREVIEW_NAMESPACE: 'test-a' }],
      [['--delete', '--confirm', 'boba'], { PREVIEW_NAMESPACE: 'boba' }],
      [['--delete', '--confirm', 'production'], { PREVIEW_NAMESPACE: 'production' }],
      [['--delete', '--confirm', 'test-a'], { PREVIEW_NAMESPACE: 'test-a', VERCEL_ENV: 'production' }],
      [['--delete', '--confirm', 'x'], {}],
      [['--delete', '--confirm', 'test-a', '--production'], { PREVIEW_NAMESPACE: 'wrong-label' }],
    ];
    for (const [args, env] of refusals) {
      const result = await runScript('reset-preview.js', args, { ...base, ...env });
      assert.equal(result.code, 1, `${args.join(' ')} with ${JSON.stringify(env)} must be refused`);
    }
    assert.equal(fake.log.length, 0, 'every refusal happens before anything is sent');

    const real = await runScript('reset-preview.js', ['--delete', '--confirm', 'test-a'], { ...base, PREVIEW_NAMESPACE: 'test-a' });
    assert.equal(real.code, 0, real.err);
    assert.match(real.out, /Deleted 3 key\(s\)\. Keys left in this namespace: 0/);
    assert.equal(fake.slice(`${previewOf('test-a')}:`), '[]');
    assert.equal(fake.slice(`${PROD}:`), productionBefore, 'Production data is exactly as it was');
    assert.equal(real.out.includes(FAKE_TOKEN) || real.err.includes(FAKE_TOKEN), false);
  });
});
