// Tiny helpers shared by the API files, using only built-in Node features.
// Vercel and our local dev server both call a handler as handler(req, res).

export function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(data));
}

// Read the request body as JSON, refusing anything bigger than `limit` bytes.
// Vercel may have already parsed it into req.body; locally we read the stream.
export async function readJson(req, limit = 10_000) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Request is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (size === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
