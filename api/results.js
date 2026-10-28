// GET /api/results: the public totals behind the charts.
//
// Privacy rule: until at least MIN_RESPONSES people have answered, we do NOT
// send any breakdown at all. With only one or two answers, a chart could
// reveal what one person chose. We only say how many responses exist so far.

import { sendJson } from '../lib/http.js';
import { readTotals, storeConfigured } from '../lib/store.js';

const DEFAULT_MIN = 10;

const sum = (counts) => Object.values(counts || {}).reduce((a, b) => a + b, 0);

// The same rule applies to each question, not just the overall total.
// Many people skip questions, and a question answered by only 2 people could
// reveal what those 2 chose. So any group smaller than `min` is left out.
export function applyMinimum(totals, min) {
  const answers = {};
  for (const [id, counts] of Object.entries(totals.answers)) {
    answers[id] = sum(counts) >= min ? counts : {};
  }
  const showDrinks = totals.drinksTotal >= min;
  const drinks = {};
  for (const [id, counts] of Object.entries(totals.drinks)) {
    drinks[id] = showDrinks ? counts : {};
  }
  return { ...totals, answers, drinks };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Use GET.' }, { Allow: 'GET' });
  }

  const min = Math.max(1, Number.parseInt(process.env.MIN_RESPONSES, 10) || DEFAULT_MIN);

  if (!storeConfigured()) {
    return sendJson(res, 200, { configured: false, ready: false, min, total: 0 });
  }

  try {
    const totals = await readTotals();
    if (totals.total < min) {
      return sendJson(res, 200, { configured: true, ready: false, min, total: totals.total });
    }
    // Totals change slowly, so a short cache keeps the page fast and the database calm.
    return sendJson(
      res,
      200,
      { configured: true, ready: true, min, ...applyMinimum(totals, min) },
      { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' }
    );
  } catch (error) {
    console.error('readTotals failed:', error.message);
    return sendJson(res, 500, { error: 'Could not load results right now.' });
  }
}
