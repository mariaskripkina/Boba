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
