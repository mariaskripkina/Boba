// Where survey totals are kept.
//
// IMPORTANT PRIVACY DESIGN: we never save anyone's individual response.
// Each submission only adds +1 to a few counters, like "texture: chewy".
// After that, there is no way to look up "what did person #7 answer?"
// because that record never exists.
//
// Two storage modes:
//   - Production: Upstash Redis (a small hosted database with a free plan),
//     reached over plain HTTPS. The secret keys live in Vercel's settings.
//   - Local development: a temporary in-memory store so you can try everything
//     without any account. It resets whenever you restart the dev server.

import { QUESTIONS, DRINK_FIELDS } from '../public/js/schema.js';

const PREFIX = 'boba:v1';
const keyFor = (name) => `${PREFIX}:${name}`;

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

// On Vercel, the VERCEL variable is always set. We only allow the temporary
// in-memory store when NOT on Vercel, so a real deployment can never silently
// "lose" answers by using memory.
const useMemory = () => !upstashConfig() && !process.env.VERCEL;

export function storeConfigured() {
  return Boolean(upstashConfig()) || useMemory();
}

// ---- the in-memory store (local development only) ------------------------

const memory = (globalThis.__bobaMemory ??= new Map());

function runInMemory(commands) {
  return commands.map(([command, key, field, amount]) => {
    if (command === 'INCR') {
      memory.set(key, (Number(memory.get(key)) || 0) + 1);
      return memory.get(key);
    }
    if (command === 'HINCRBY') {
      const hash = memory.get(key) || {};
      hash[field] = (Number(hash[field]) || 0) + amount;
      memory.set(key, hash);
      return hash[field];
    }
    if (command === 'GET') return memory.has(key) ? String(memory.get(key)) : null;
    if (command === 'HGETALL') {
      const hash = memory.get(key) || {};
      return Object.entries(hash).flatMap(([f, v]) => [f, String(v)]);
    }
    throw new Error(`Unsupported command: ${command}`);
  });
}

// ---- Upstash over HTTPS ---------------------------------------------------

async function runOnUpstash(config, commands) {
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error(`Storage responded with ${response.status}`);
  const results = await response.json();
  return results.map((entry) => {
    if (entry && entry.error) throw new Error(`Storage error: ${entry.error}`);
    return entry.result;
  });
}

async function run(commands) {
  const config = upstashConfig();
  if (config) return runOnUpstash(config, commands);
  if (useMemory()) return runInMemory(commands);
  throw new Error('Storage is not configured.');
}

// ---- public functions -----------------------------------------------------

// Add one submission to the totals.
export async function recordSubmission({ answers, drink }) {
  const commands = [['INCR', keyFor('total')]];

  for (const [questionId, value] of Object.entries(answers)) {
    commands.push(['HINCRBY', keyFor(`q:${questionId}`), value, 1]);
  }

  if (drink) {
    commands.push(['INCR', keyFor('drinks')]);
    commands.push(['HINCRBY', keyFor('drink:tea'), drink.tea, 1]);
    commands.push(['HINCRBY', keyFor('drink:flavor'), drink.flavor, 1]);
    commands.push(['HINCRBY', keyFor('drink:sweet'), drink.sweet, 1]);
    for (const topping of drink.toppings) {
      commands.push(['HINCRBY', keyFor('drink:topping'), topping, 1]);
    }
    if (drink.toppings.length === 0) {
      commands.push(['HINCRBY', keyFor('drink:topping'), 'none', 1]);
    }
  }

  await run(commands);
}

// Turn Redis' flat list ["a","3","b","1"] into { a: 3, b: 1 }.
function pairsToCounts(result) {
  const counts = {};
  if (Array.isArray(result)) {
    for (let i = 0; i + 1 < result.length; i += 2) counts[result[i]] = Number(result[i + 1]) || 0;
  } else if (result && typeof result === 'object') {
    for (const [k, v] of Object.entries(result)) counts[k] = Number(v) || 0;
  }
  return counts;
}

// Read every total. Returns only whole-group counts.
export async function readTotals() {
  const hashKeys = [
    ...QUESTIONS.map((q) => ({ group: 'answers', name: q.id, key: keyFor(`q:${q.id}`) })),
    ...Object.keys(DRINK_FIELDS).map((name) => ({ group: 'drinks', name, key: keyFor(`drink:${name}`) })),
  ];

  const commands = [
    ['GET', keyFor('total')],
    ['GET', keyFor('drinks')],
    ...hashKeys.map(({ key }) => ['HGETALL', key]),
  ];
  const results = await run(commands);

  const totals = {
    total: Number(results[0]) || 0,
    drinksTotal: Number(results[1]) || 0,
    answers: {},
    drinks: {},
  };
  hashKeys.forEach(({ group, name }, index) => {
    totals[group][name] = pairsToCounts(results[index + 2]);
  });
  return totals;
}

// Used by tests to start from a clean slate.
export function resetMemoryStore() {
  memory.clear();
}
