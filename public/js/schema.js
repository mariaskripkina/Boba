// The survey: its questions, and the rules for what a valid submission looks like.
//
// This file is used in two places:
//   1. In the browser, to know which questions and options exist.
//   2. On the server (api/survey.js), to CHECK every submission before counting it.
//
// Never trust the browser. Anyone can send anything to a public API, so the
// server only accepts answers that exactly match the ids listed here.
//
// IDs vs. WORDS: this file holds only ids (like "adventure" and "try"). The
// words people read ("You see a flavor on the menu...") live in the language
// files (i18n/locales/*.js). Whatever language someone uses, their answer is
// the same id, so every language counts into one combined dataset.
// This file must stay free of any browser-only code, because the server uses it too.

import { TEAS, FLAVORS, SWEETNESS, TOPPINGS, MAX_TOPPINGS } from './menu.js';

export const QUESTIONS = [
  { id: 'taste',     options: [{ value: 'roasted' }, { value: 'floral' }, { value: 'fruity' }, { value: 'creamy' }, { value: 'earthy' }] },
  { id: 'sweetness', options: [{ value: '0' }, { value: '30' }, { value: '50' }, { value: '70' }, { value: '100' }] },
  { id: 'texture',   options: [{ value: 'chewy' }, { value: 'jelly' }, { value: 'creamy' }, { value: 'fruity' }, { value: 'smooth' }] },
  { id: 'adventure', options: [{ value: 'skip' }, { value: 'ask' }, { value: 'try' }, { value: 'seek' }] },
  { id: 'travel',    options: [{ value: 'rarely' }, { value: 'sometimes' }, { value: 'often' }, { value: 'always' }] },
];

// ---- the optional "part of the world" question ------------------------------
//
// Deliberately BROAD: a country, city or neighborhood could point to one
// person, but a world region cannot. The list is fixed, so the server only
// accepts these exact ids.
export const REGIONS = [
  { id: 'east-asia' },
  { id: 'southeast-asia' },
  { id: 'south-asia' },
  { id: 'central-asia' },
  { id: 'mena' },
  { id: 'sub-saharan' },
  { id: 'europe' },
  { id: 'north-america' },
  { id: 'latin-america' },
  { id: 'oceania' },
];

// "Prefer not to say" is a choice in the form, but it is NOT a region: picking
// it sends no region at all, exactly like skipping the question.
export const REGION_PREFER_NOT_TO_SAY = 'prefer-not-to-say';

// Only these questions are compared across regions. Fewer comparisons means
// fewer small groups, which keeps the results more honest and more private.
export const COMPARE_QUESTIONS = ['sweetness', 'adventure', 'travel'];

// Lists of the valid values for the optional "share my drink" part.
const DRINK_FIELDS = {
  tea: TEAS.map((t) => t.id),
  flavor: FLAVORS.map((f) => f.id),
  sweet: SWEETNESS.map((s) => s.id),
  topping: TOPPINGS.map((t) => t.id),
};
export { DRINK_FIELDS };

// Check a submission. Returns { ok: true, answers, drink } with a CLEAN copy,
// or { ok: false, error: '...' } with a plain-language reason.
export function validateSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Send a JSON object.' };
  }

  // Only these top-level keys are allowed (`website` is the hidden bot trap).
  const allowedTop = new Set(['answers', 'drink', 'region', 'website']);
  for (const key of Object.keys(body)) {
    if (!allowedTop.has(key)) return { ok: false, error: `Unknown field: ${key}` };
  }

  const answers = {};
  if (body.answers !== undefined) {
    if (typeof body.answers !== 'object' || body.answers === null || Array.isArray(body.answers)) {
      return { ok: false, error: 'answers must be an object.' };
    }
    for (const [id, value] of Object.entries(body.answers)) {
      const question = QUESTIONS.find((q) => q.id === id);
      if (!question) return { ok: false, error: `Unknown question: ${id}` };
      if (typeof value !== 'string' || !question.options.some((o) => o.value === value)) {
        return { ok: false, error: `Invalid answer for ${id}.` };
      }
      answers[id] = value;
    }
  }

  let drink = null;
  if (body.drink !== undefined && body.drink !== null) {
    const d = body.drink;
    if (typeof d !== 'object' || Array.isArray(d)) return { ok: false, error: 'drink must be an object.' };
    const sweet = String(d.sweet);
    if (!DRINK_FIELDS.tea.includes(d.tea)) return { ok: false, error: 'Invalid tea.' };
    if (!DRINK_FIELDS.flavor.includes(d.flavor)) return { ok: false, error: 'Invalid flavor.' };
    if (!DRINK_FIELDS.sweet.includes(sweet)) return { ok: false, error: 'Invalid sweetness.' };
    if (!Array.isArray(d.toppings) || d.toppings.length > MAX_TOPPINGS) {
      return { ok: false, error: 'Invalid toppings.' };
    }
    const toppings = [...new Set(d.toppings)];
    if (!toppings.every((t) => DRINK_FIELDS.topping.includes(t))) {
      return { ok: false, error: 'Invalid topping.' };
    }
    drink = { tea: d.tea, flavor: d.flavor, sweet, toppings };
  }

  // Region is optional. null/undefined means "skipped". Anything else must be
  // exactly one of the ids in REGIONS.
  let region = null;
  if (body.region !== undefined && body.region !== null) {
    if (typeof body.region !== 'string' || !REGIONS.some((r) => r.id === body.region)) {
      return { ok: false, error: 'Invalid region.' };
    }
    region = body.region;
  }

  // A region alone is not a submission: it only means something next to an answer.
  if (Object.keys(answers).length === 0 && !drink) {
    return { ok: false, error: 'Answer at least one question or share your drink.' };
  }

  return { ok: true, answers, drink, region };
}
