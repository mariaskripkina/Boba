// POST /api/survey: receives one anonymous survey submission.
//
// What happens, in order:
//   1. Only POST is allowed.
//   2. We read the body and CHECK it against the survey rules (never trust the browser).
//   3. We add +1 to the matching totals. We do not store the submission itself.

import { sendJson, readJson } from '../lib/http.js';
import { validateSubmission } from '../public/js/schema.js';
import { recordSubmission, storeConfigured } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Use POST.' }, { Allow: 'POST' });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    const status = error.status || 400;
    return sendJson(res, status, { error: status === 413 ? 'Request is too large.' : 'Send valid JSON.' });
  }

  const result = validateSubmission(body);
  if (!result.ok) return sendJson(res, 400, { error: result.error });

  // The hidden "website" field is a trap for bots: people never see it, so
  // they never fill it in. If it has text, pretend it worked but count nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return sendJson(res, 200, { ok: true });
  }

  if (!storeConfigured()) {
    return sendJson(res, 503, {
      error: 'storage_not_configured',
      message: 'Survey storage is not switched on yet, so this answer was not saved.',
    });
  }

  try {
    await recordSubmission({ answers: result.answers, drink: result.drink, region: result.region });
  } catch (error) {
    console.error('recordSubmission failed:', error.message);
    return sendJson(res, 500, { error: 'Could not save your answers. Please try again.' });
  }

  return sendJson(res, 200, { ok: true });
}
