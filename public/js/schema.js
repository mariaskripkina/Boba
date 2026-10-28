// The survey: its questions, and the rules for what a valid submission looks like.
//
// This file is used in two places:
//   1. In the browser, to draw the questions and the results charts.
//   2. On the server (api/survey.js), to CHECK every submission before counting it.
//
// Never trust the browser. Anyone can send anything to a public API, so the
// server only accepts answers that exactly match the options listed here.

import { TEAS, FLAVORS, SWEETNESS, TOPPINGS, MAX_TOPPINGS } from './menu.js';

export const QUESTIONS = [
  {
    id: 'taste',
    title: 'Which flavor direction sounds best right now?',
    options: [
      { value: 'roasted', label: 'Roasted and toasty' },
      { value: 'floral',  label: 'Floral and light' },
      { value: 'fruity',  label: 'Fruity and bright' },
      { value: 'creamy',  label: 'Creamy and sweet' },
      { value: 'earthy',  label: 'Earthy and grassy' },
    ],
    explain: 'The flavor direction people reach for first.',
  },
  {
    id: 'sweetness',
    title: 'How sweet do you usually order your drink?',
    options: [
      { value: '0',   label: 'Not sweet (0%)' },
      { value: '30',  label: 'Lightly (30%)' },
      { value: '50',  label: 'Half (50%)' },
      { value: '70',  label: 'Sweet (70%)' },
      { value: '100', label: 'Full sweet (100%)' },
    ],
    explain: 'Sweetness is one of the biggest differences between people.',
  },
  {
    id: 'texture',
    title: 'Which texture matters most to you?',
    options: [
      { value: 'chewy',  label: 'Chewy, like pearls' },
      { value: 'jelly',  label: 'Soft and jiggly, like jelly' },
      { value: 'creamy', label: 'Creamy, like milk foam' },
      { value: 'fruity', label: 'Juicy, like fruit pieces' },
      { value: 'smooth', label: 'Smooth, no toppings' },
    ],
    explain: 'Texture is a big reason people love or skip boba.',
  },
  {
    id: 'adventure',
    title: 'You see a flavor on the menu you have never heard of. You...',
    options: [
      { value: 'skip',   label: 'Stick with what I know' },
      { value: 'ask',    label: 'Ask what it tastes like first' },
      { value: 'try',    label: 'Order it' },
      { value: 'seek',   label: 'Hope to find something like it' },
    ],
    explain: 'How willing people are to try an unfamiliar flavor.',
  },
  {
    id: 'travel',
    title: 'When you travel, how often do you try local food or drinks you cannot name?',
    options: [
      { value: 'rarely',    label: 'Rarely' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'often',     label: 'Often' },
      { value: 'always',    label: 'Almost always' },
    ],
    explain: 'A quick read on openness to new experiences.',
  },
];

export const MIN_ANSWERS_NOTE = 'Answer any question you like. Skipping is fine.';

// ---- the optional "part of the world" question ------------------------------
//
// Deliberately BROAD: a country, city or neighborhood could point to one
// person, but a world region cannot. The list is fixed, so the server only
// accepts these exact ids.
export const REGIONS = [
  { id: 'east-asia',      label: 'East Asia' },
  { id: 'southeast-asia', label: 'Southeast Asia' },
  { id: 'south-asia',     label: 'South Asia' },
  { id: 'central-asia',   label: 'Central Asia and Caucasus' },
  { id: 'mena',           label: 'Middle East and North Africa' },
  { id: 'sub-saharan',    label: 'Sub-Saharan Africa' },
  { id: 'europe',         label: 'Europe' },
  { id: 'north-america',  label: 'North America' },
  { id: 'latin-america',  label: 'Latin America and Caribbean' },
  { id: 'oceania',        label: 'Oceania' },
];

// "Prefer not to say" is a choice in the form, but it is NOT a region: picking
// it sends no region at all, exactly like skipping the question.
export const REGION_PREFER_NOT_TO_SAY = 'prefer-not-to-say';

export const REGION_QUESTION = {
  title: 'Which part of the world do you live in?',
  hint: 'Optional. It only adds to broad regional totals.',
};

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
