// A tiny pretend Upstash server for the automated tests (Node built-ins only).
//
// It understands just the Redis commands Boba Lab uses, and answers the same way
// Upstash's web interface does. That lets the tests run the REAL storage code
// (the part that talks over HTTPS) without any account or internet.
//
// It also keeps a log of every command it received, so tests can check things like
// "no raw network address was ever sent" and "only read commands were used".

import http from 'node:http';

export const FAKE_TOKEN = 'test-token';

export async function startFakeUpstash() {
  const data = new Map();     // key -> number | { field: number }
  const expiry = new Map();   // key -> time (ms) it disappears
  const log = [];             // every command received: [COMMAND, key, ...]
  const state = {
    clockOffset: 0,
    failAll: false,                 // answer every request with HTTP 500
    failWhen: null,                 // (command, key) => true makes that one command fail
  };
  const now = () => Date.now() + state.clockOffset;

  const alive = (key) => {
    if (expiry.has(key) && expiry.get(key) <= now()) { data.delete(key); expiry.delete(key); }
    return data.has(key);
  };

  function execute([rawCommand, key, ...rest]) {
    const command = String(rawCommand).toUpperCase();
    log.push([command, key, ...rest]);
    if (state.failWhen?.(command, key)) throw new Error('simulated failure');
    if (key !== undefined && command !== 'SCAN') alive(key);

    switch (command) {
      case 'INCR': data.set(key, (Number(data.get(key)) || 0) + 1); return data.get(key);
      case 'DECR': data.set(key, (Number(data.get(key)) || 0) - 1); return data.get(key);
      case 'HINCRBY': {
        const hash = data.get(key) || {};
        hash[rest[0]] = (Number(hash[rest[0]]) || 0) + Number(rest[1]);
        data.set(key, hash);
        return hash[rest[0]];
      }
      case 'DEL': {
        let removed = 0;
        for (const k of [key, ...rest]) { if (alive(k)) { data.delete(k); expiry.delete(k); removed += 1; } }
        return removed;
      }
      case 'EXPIRE': if (!data.has(key)) return 0; expiry.set(key, now() + Number(rest[0]) * 1000); return 1;
      case 'TTL':
        if (!data.has(key)) return -2;
        return expiry.has(key) ? Math.ceil((expiry.get(key) - now()) / 1000) : -1;
      case 'GET': return data.has(key) ? String(data.get(key)) : null;
      case 'HGETALL': return Object.entries(data.get(key) || {}).flatMap(([f, v]) => [f, String(v)]);
      case 'TYPE': return !data.has(key) ? 'none' : typeof data.get(key) === 'object' ? 'hash' : 'string';
      case 'DBSIZE': for (const k of [...data.keys()]) alive(k); return data.size;
      case 'SCAN': {
        const pattern = rest[rest.indexOf('MATCH') + 1] ?? '*';
        const prefix = pattern.replace(/\*$/, '');
        for (const k of [...data.keys()]) alive(k);
        return ['0', [...data.keys()].filter((k) => k.startsWith(prefix))];
      }
      default: throw new Error(`fake Upstash does not know ${command}`);
    }
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (state.failAll) { res.statusCode = 500; return res.end('boom'); }
      if (req.headers.authorization !== `Bearer ${FAKE_TOKEN}` || req.url !== '/pipeline') {
        res.statusCode = 401;
        return res.end('{"error":"unauthorized"}');
      }
      const commands = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const answers = commands.map((command) => {
        try { return { result: execute(command) }; } catch (error) { return { error: error.message }; }
      });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(answers));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url, data, expiry, log, state,
    advanceClock: (ms) => { state.clockOffset += ms; },
    // Everything stored under a namespace (for example 'boba:v1:'), as comparable text.
    // Used to prove that one environment's data did not change.
    slice(prefix) {
      for (const k of [...data.keys()]) alive(k);
      return JSON.stringify([...data.entries()].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)));
    },
    // Point the website's storage code at this fake server (and back), pretending to be
    // a given environment: 'production' (the default), 'preview', 'development' (both need a
    // label), 'bare' (on Vercel, but VERCEL_ENV missing), 'laptop' (credentials on a computer
    // that is not Vercel), or any other word (an unexpected VERCEL_ENV value on Vercel).
    connect({ environment = 'production', label } = {}) {
      process.env.UPSTASH_REDIS_REST_URL = url;
      process.env.UPSTASH_REDIS_REST_TOKEN = FAKE_TOKEN;
      if (environment === 'laptop') delete process.env.VERCEL;
      else process.env.VERCEL = '1';
      if (environment === 'bare' || environment === 'laptop') delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = environment;
      if (label === undefined) delete process.env.PREVIEW_NAMESPACE;
      else process.env.PREVIEW_NAMESPACE = label;
    },
    disconnect() {
      for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'VERCEL', 'VERCEL_ENV', 'PREVIEW_NAMESPACE']) delete process.env[name];
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
