// The plain connection to Upstash Redis over HTTPS. Nothing here decides WHICH keys
// may be used: that is lib/namespace.js. Application code never calls this directly,
// it goes through lib/store.js (and the scripts wrap it in a guard first).

export function upstashConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

// Send a list of commands as one request. Throws if Upstash reports any error.
export async function sendToUpstash(config, commands) {
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

// Read-only sender for the "known keys" snapshot, which must work with Upstash's Read-Only token.
// It can only express GET and HGETALL, and it sends them as plain HTTP GET requests
// ("{url}/get/<key>"), the form Upstash documents for that token. There is no request body, and any
// other command name throws BEFORE a request exists, so nothing that changes data can be sent from here.
const READ_PATHS = { GET: 'get', HGETALL: 'hgetall' };

export async function sendReadsToUpstash(config, commands) {
  const results = [];
  for (const command of commands) {
    const name = Array.isArray(command) && typeof command[0] === 'string' ? command[0].toUpperCase() : '';
    if (!Object.hasOwn(READ_PATHS, name) || command.length !== 2 || typeof command[1] !== 'string') {
      throw new Error('Refused: only GET and HGETALL with exactly one key can be sent here.');
    }
    const response = await fetch(`${config.url}/${READ_PATHS[name]}/${encodeURIComponent(command[1])}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!response.ok) throw new Error(`Storage responded with ${response.status}`);
    const body = await response.json();
    if (body && body.error) throw new Error(`Storage error: ${body.error}`);
    results.push(body.result);
  }
  return results;
}
