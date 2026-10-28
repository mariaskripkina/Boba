// Automated checks for the survey rules and the two API endpoints.
// Run them with:  npm test
//
// These use Node's built-in test runner, so nothing needs installing.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

// Make sure we test with the temporary in-memory store, not a real database.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.VERCEL;
process.env.MIN_RESPONSES = '3';

const { validateSubmission } = await import('../public/js/schema.js');
const { resetMemoryStore } = await import('../lib/store.js');
const survey = (await import('../api/survey.js')).default;
const results = (await import('../api/results.js')).default;

// A fake request/response so we can call the handlers without a server.
function fakeRequest(method, body) {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const req = Readable.from(text ? [Buffer.from(text)] : []);
  req.method = method;
  return req;
}

function fakeResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(chunk) { this.body += chunk || ''; this.finished = true; },
  };
  return res;
}

async function call(handler, method, body) {
  const res = fakeResponse();
  await handler(fakeRequest(method, body), res);
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : null };
}

beforeEach(() => resetMemoryStore());

// ---- validation -----------------------------------------------------------

test('accepts a valid submission', () => {
  const r = validateSubmission({ answers: { texture: 'chewy', travel: 'often' } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.answers, { texture: 'chewy', travel: 'often' });
  assert.equal(r.drink, null);
});

test('accepts a shared drink and cleans it', () => {
  const r = validateSubmission({
    drink: { tea: 'oolong', flavor: 'taro', sweet: 50, toppings: ['tapioca', 'tapioca', 'cheese-foam'] },
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.drink, { tea: 'oolong', flavor: 'taro', sweet: '50', toppings: ['tapioca', 'cheese-foam'] });
});

test('rejects an empty submission', () => {
  assert.equal(validateSubmission({ answers: {} }).ok, false);
  assert.equal(validateSubmission({}).ok, false);
});

test('rejects unknown questions, answers and fields', () => {
  assert.equal(validateSubmission({ answers: { favorite_color: 'pink' } }).ok, false);
  assert.equal(validateSubmission({ answers: { texture: 'crunchy' } }).ok, false);
  assert.equal(validateSubmission({ answers: { texture: 'chewy' }, name: 'Sam' }).ok, false);
});

test('rejects bad drinks', () => {
  const good = { tea: 'black', flavor: 'taro', sweet: '50', toppings: [] };
  assert.equal(validateSubmission({ drink: { ...good, tea: 'coffee' } }).ok, false);
  assert.equal(validateSubmission({ drink: { ...good, sweet: '40' } }).ok, false);
  assert.equal(validateSubmission({ drink: { ...good, toppings: ['a', 'b', 'c', 'd'] } }).ok, false);
  assert.equal(validateSubmission({ drink: { ...good, toppings: ['mud'] } }).ok, false);
});

// ---- API ------------------------------------------------------------------

test('survey only accepts POST', async () => {
  const r = await call(survey, 'GET');
  assert.equal(r.status, 405);
});

test('survey rejects broken JSON and invalid answers', async () => {
  assert.equal((await call(survey, 'POST', '{not json')).status, 400);
  assert.equal((await call(survey, 'POST', { answers: { texture: 'crunchy' } })).status, 400);
});

test('survey rejects oversized requests', async () => {
  const huge = JSON.stringify({ answers: { texture: 'chewy' }, website: 'x'.repeat(20_000) });
  assert.equal((await call(survey, 'POST', huge)).status, 413);
});

test('results stay hidden until enough people have answered', async () => {
  let r = await call(results, 'GET');
  assert.equal(r.json.ready, false);
  assert.equal(r.json.total, 0);

  await call(survey, 'POST', { answers: { texture: 'chewy' } });
  await call(survey, 'POST', { answers: { texture: 'jelly' } });
  r = await call(results, 'GET');
  assert.equal(r.json.ready, false);
  assert.equal(r.json.total, 2);
  assert.equal(r.json.answers, undefined, 'no breakdown may be sent before the minimum');
});

test('results show totals once the minimum is reached', async () => {
  await call(survey, 'POST', { answers: { texture: 'chewy', travel: 'often' } });
  await call(survey, 'POST', { answers: { texture: 'chewy' } });
  await call(survey, 'POST', {
    answers: { texture: 'jelly' },
    drink: { tea: 'jasmine', flavor: 'lychee', sweet: '30', toppings: ['lychee-jelly'] },
  });

  const r = await call(results, 'GET');
  assert.equal(r.json.ready, true);
  assert.equal(r.json.total, 3);
  assert.deepEqual(r.json.answers.texture, { chewy: 2, jelly: 1 });
  // Only 1 person answered "travel" and 1 shared a drink: both are below the
  // minimum of 3, so they must stay hidden.
  assert.deepEqual(r.json.answers.travel, {});
  assert.equal(r.json.drinksTotal, 1);
  assert.deepEqual(r.json.drinks.tea, {});
});

test('a drink with no toppings is counted as "none"', async () => {
  for (let i = 0; i < 3; i++) {
    await call(survey, 'POST', { drink: { tea: 'black', flavor: 'classic', sweet: '0', toppings: [] } });
  }
  const r = await call(results, 'GET');
  assert.deepEqual(r.json.drinks.topping, { none: 3 });
});

test('bot trap: filled hidden field is accepted but not counted', async () => {
  const r = await call(survey, 'POST', { answers: { texture: 'chewy' }, website: 'http://spam.example' });
  assert.equal(r.status, 200);
  assert.equal((await call(results, 'GET')).json.total, 0);
});

test('the server never stores individual responses', async () => {
  await call(survey, 'POST', { answers: { texture: 'chewy', travel: 'often' } });
  const memory = globalThis.__bobaMemory;
  for (const [key, value] of memory.entries()) {
    assert.match(key, /^boba:v1:(total|drinks|q:|drink:)/);
    // Each value is a plain number or a {choice: count} map, nothing per-person.
    assert.ok(typeof value === 'number' || Object.values(value).every((n) => typeof n === 'number'));
  }
});

test('on Vercel without a database, saving says so instead of pretending', async () => {
  process.env.VERCEL = '1';
  try {
    const r = await call(survey, 'POST', { answers: { texture: 'chewy' } });
    assert.equal(r.status, 503);
    assert.equal(r.json.error, 'storage_not_configured');
    const res = await call(results, 'GET');
    assert.equal(res.json.configured, false);
  } finally {
    delete process.env.VERCEL;
  }
});

// ---- the real database path (Upstash), with a stand-in for the network ----

test('Upstash mode: sends counters over HTTPS with the secret token and reads replies', async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  process.env.UPSTASH_REDIS_REST_URL = 'https://example-db.upstash.io/';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'secret-token';
  process.env.VERCEL = '1';

  globalThis.fetch = async (url, options) => {
    const commands = JSON.parse(options.body);
    calls.push({ url, auth: options.headers.Authorization, commands });
    // Pretend to be the database: answer reads with realistic flat lists.
    return {
      ok: true,
      json: async () =>
        commands.map(([command, key]) => {
          if (command === 'GET') return { result: key.endsWith(':total') ? '12' : '4' };
          if (command === 'HGETALL') return { result: ['chewy', '7', 'jelly', '5'] };
          return { result: 1 };
        }),
    };
  };

  try {
    const saved = await call(survey, 'POST', {
      answers: { texture: 'chewy' },
      drink: { tea: 'black', flavor: 'taro', sweet: '50', toppings: ['tapioca'] },
    });
    assert.equal(saved.status, 200);
    assert.equal(calls[0].url, 'https://example-db.upstash.io/pipeline');
    assert.equal(calls[0].auth, 'Bearer secret-token');
    assert.deepEqual(calls[0].commands[0], ['INCR', 'boba:v1:total']);
    assert.ok(calls[0].commands.some((c) => c[0] === 'HINCRBY' && c[1] === 'boba:v1:q:texture' && c[2] === 'chewy'));

    const read = await call(results, 'GET');
    assert.equal(read.json.ready, true);
    assert.equal(read.json.total, 12);
    assert.deepEqual(read.json.answers.texture, { chewy: 7, jelly: 5 });
    assert.equal(JSON.stringify(read.json).includes('secret-token'), false, 'the token must never reach the browser');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.VERCEL;
  }
});

test('Upstash mode: a database error gives a friendly failure, not a crash', async () => {
  const realFetch = globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = 'https://example-db.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'secret-token';
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  try {
    const r = await call(survey, 'POST', { answers: { texture: 'chewy' } });
    assert.equal(r.status, 500);
    assert.equal(JSON.stringify(r.json).includes('secret-token'), false);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});

test('a question with fewer answers than the minimum is hidden, even when the total is enough', async () => {
  // 3 people answer "texture" (the minimum in tests), only 2 answer "travel".
  await call(survey, 'POST', { answers: { texture: 'chewy', travel: 'often' } });
  await call(survey, 'POST', { answers: { texture: 'jelly', travel: 'often' } });
  await call(survey, 'POST', { answers: { texture: 'chewy' } });
  const r = await call(results, 'GET');
  assert.equal(r.json.ready, true);
  assert.deepEqual(r.json.answers.texture, { chewy: 2, jelly: 1 });
  assert.deepEqual(r.json.answers.travel, {}, 'only 2 answers, so it must stay hidden');
});

test('drink charts stay hidden until enough people share a drink', async () => {
  const drink = { tea: 'black', flavor: 'taro', sweet: '50', toppings: [] };
  await call(survey, 'POST', { answers: { texture: 'chewy' }, drink });
  await call(survey, 'POST', { answers: { texture: 'chewy' }, drink });
  await call(survey, 'POST', { answers: { texture: 'chewy' } });
  const r = await call(results, 'GET');
  assert.equal(r.json.ready, true);
  assert.equal(r.json.drinksTotal, 2);
  assert.deepEqual(r.json.drinks.tea, {});
});
