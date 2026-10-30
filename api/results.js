// GET /api/results: the public totals behind the charts.
//
// Privacy rule: until at least MIN_RESPONSES people have answered, we do NOT
// send any breakdown at all. With only one or two answers, a chart could
// reveal what one person chose. We only say how many responses exist so far.

import { sendJson } from '../lib/http.js';
import { readTotals, storeConfigured, storageKind } from '../lib/store.js';
import { REGIONS } from '../public/js/schema.js';

const DEFAULT_MIN = 10;

const sum = (counts) => Object.values(counts || {}).reduce((a, b) => a + b, 0);

// Turn { try: 7, ask: 3 } into { try: 70, ask: 30 } (whole percents).
// The browser only ever receives these shares, never the raw counts.
const toShares = (counts, n) =>
  Object.fromEntries(Object.entries(counts).map(([answer, count]) => [answer, Math.round((count / n) * 100)]));

// Regional comparisons, with the same "no small groups" rule as everything else.
//   - A region is shown for a question only if at least `min` people from that
//     region answered THAT question.
//   - Regions below the minimum are never shown on their own. They may be
//     combined into "other", but only if there are 2+ of them AND the combined
//     group also reaches the minimum.
//   - Regions always come back in the same fixed order (never ranked by size
//     or by how they answered), so the page does not invite a league table.
export function buildRegional(cross, min) {
  const order = (region) => (region === 'other' ? REGIONS.length : REGIONS.findIndex((r) => r.id === region));
  const questions = {};

  for (const [questionId, byRegion] of Object.entries(cross || {})) {
    const groups = [];
    const pooled = {};
    let pooledN = 0;
    let pooledRegions = 0;

    for (const [region, counts] of Object.entries(byRegion)) {
      if (order(region) === -1) continue; // ignore anything that is not a known region
      const n = sum(counts);
      if (n >= min) {
        groups.push({ region, n, shares: toShares(counts, n) });
      } else if (n > 0) {
        pooledRegions += 1;
        pooledN += n;
        for (const [answer, count] of Object.entries(counts)) pooled[answer] = (pooled[answer] || 0) + count;
      }
    }

    if (pooledRegions >= 2 && pooledN >= min) {
      groups.push({ region: 'other', n: pooledN, shares: toShares(pooled, pooledN) });
    }
    if (groups.length > 0) questions[questionId] = groups.sort((a, b) => order(a.region) - order(b.region));
  }
  return { min, questions };
}

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
  // `cross` holds raw regional counts, so it must never be sent as it is.
  // We replace it with the filtered, percentage-only `regional` block.
  const { cross, ...rest } = totals;
  return { ...rest, answers, drinks, regional: buildRegional(cross, min) };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Use GET.', code: 'method_not_allowed' }, { Allow: 'GET' });
  }

  const min = Math.max(1, Number.parseInt(process.env.MIN_RESPONSES, 10) || DEFAULT_MIN);

  if (!storeConfigured()) {
    return sendJson(res, 200, { configured: false, ready: false, min, total: 0 });
  }

  try {
    const totals = await readTotals();
    if (totals.total < min) {
      return sendJson(res, 200, { configured: true, storage: storageKind(), ready: false, min, total: totals.total });
    }
    // "storage" says which environment answered ("production" or "preview"), so it is
    // easy to check that a preview is NOT showing the live numbers.
    // Totals change slowly, so a short cache keeps the page fast and the database calm.
    return sendJson(
      res,
      200,
      { configured: true, storage: storageKind(), ready: true, min, ...applyMinimum(totals, min) },
      { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' }
    );
  } catch (error) {
    console.error('readTotals failed:', error.message);
    return sendJson(res, 500, { error: 'Could not load results right now.', code: 'results_failed' });
  }
}
