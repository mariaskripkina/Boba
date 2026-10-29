// Automated checks for the language system.
// Run them with:  npm test
//
// What these protect (in plain words):
//   - a translation can never add a key the site does not use (typos), and
//     languages marked "complete" can never miss one;
//   - {placeholders} survive translation, and plural forms are valid;
//   - Uzbek always uses the proper letters (ʻ and ʼ), never plain apostrophes;
//   - answers keep the same internal ids in every language;
//   - the SERVER never reads, receives or stores the visitor's language.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const { default: en } = await import('../public/js/i18n/locales/en.js');
const { default: ru } = await import('../public/js/i18n/locales/ru.js');
const { default: uz } = await import('../public/js/i18n/locales/uz-latn.js');
const { LANGUAGES } = await import('../public/js/i18n/languages.js');
const { pickLanguage, matchLanguage, t, grammar } = await import('../public/js/i18n/index.js');
const { QUESTIONS, REGIONS, validateSubmission } = await import('../public/js/schema.js');
const { TEAS, FLAVORS, SWEETNESS, TOPPINGS } = await import('../public/js/menu.js');
const { drinkName, orderDetails, orderText } = await import('../public/js/menu-text.js');

// Languages whose translation is finished. Add 'ru' / 'uz-latn' here when their
// full translation lands: from then on a missing key fails the tests.
const COMPLETE = ['en'];
const LOCALES = { en, ru, 'uz-latn': uz };

const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const isPlural = (value) => value !== null && typeof value === 'object';

// Turn the nested messages into a flat { 'a.b.c': value } list.
function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const isPluralForms = isPlural(value) && 'other' in value;
    if (isPlural(value) && !isPluralForms) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const textsOf = (value) => (isPlural(value) ? Object.values(value) : [value]);

const flatEn = flatten(en.messages);

// ---- structure -------------------------------------------------------------------

test('every language in the list has a translation file that loads', async () => {
  for (const language of LANGUAGES) {
    if (!language.load) continue;
    const module = await language.load();
    assert.ok(module.default?.messages, `${language.code} must export { messages }`);
  }
});

test('no translation contains a key that English does not have (catches typos)', () => {
  for (const [code, locale] of Object.entries(LOCALES)) {
    for (const key of Object.keys(flatten(locale.messages))) {
      assert.ok(key in flatEn, `${code}: unknown key "${key}"`);
    }
  }
});

test('finished languages have every key', () => {
  for (const code of COMPLETE) {
    const flat = flatten(LOCALES[code].messages);
    for (const key of Object.keys(flatEn)) assert.ok(key in flat, `${code}: missing key "${key}"`);
  }
});

test('no message is empty, and {placeholders} match English', () => {
  for (const [code, locale] of Object.entries(LOCALES)) {
    for (const [key, value] of Object.entries(flatten(locale.messages))) {
      const english = placeholders(textsOf(flatEn[key]).at(-1)); // the "other" form
      for (const text of textsOf(value)) {
        assert.equal(typeof text, 'string', `${code}.${key} must be text`);
        assert.ok(text.trim().length > 0, `${code}.${key} is empty`);
        assert.deepEqual(placeholders(text), english, `${code}.${key}: placeholders differ from English`);
      }
    }
  }
});

test('plural messages only use real plural forms, and Russian has all four', () => {
  for (const [code, locale] of Object.entries(LOCALES)) {
    for (const [key, value] of Object.entries(flatten(locale.messages))) {
      if (!isPlural(value)) continue;
      assert.ok('other' in value, `${code}.${key} needs an "other" form`);
      for (const form of Object.keys(value)) assert.ok(PLURAL_CATEGORIES.includes(form), `${code}.${key}: bad form "${form}"`);
      if (code === 'ru') {
        for (const form of ['one', 'few', 'many', 'other']) assert.ok(form in value, `ru.${key} needs "${form}"`);
      }
    }
  }
});

// ---- Uzbek letters, Russian text -------------------------------------------------------

test('Uzbek Latin uses the proper letters (ʻ and ʼ), never plain apostrophes', () => {
  const forbidden = /['‘’`´]/; // keyboard apostrophe, curly quotes, backtick, acute
  const all = Object.entries(flatten(uz.messages)).flatMap(([key, value]) => textsOf(value).map((text) => [key, text]));
  assert.ok(all.some(([, text]) => text.includes('ʻ')), 'expected ʻ (U+02BB) somewhere in the Uzbek text');
  assert.ok(all.some(([, text]) => text.includes('ʼ')), 'expected ʼ (U+02BC) somewhere in the Uzbek text');
  for (const [key, text] of all) assert.equal(forbidden.test(text), false, `uz-latn.${key} has a plain apostrophe: ${text}`);
  const name = LANGUAGES.find((l) => l.code === 'uz-Latn').name;
  assert.ok(name.includes('ʻ'), 'the switcher label must use ʻ too');
});

test('Russian text contains no leftover English words (except the project name)', () => {
  for (const [key, value] of Object.entries(flatten(ru.messages))) {
    for (const text of textsOf(value)) {
      const cleaned = text.replace(/\{\w+\}/g, '').replace(/Boba Lab/g, '');
      assert.equal(/[A-Za-z]/.test(cleaned), false, `ru.${key} has Latin letters: ${text}`);
    }
  }
});

// ---- ids never change with language ------------------------------------------------------

test('every id in the code has a name in English, and English names only exist for real ids', () => {
  const expected = new Set([
    ...TEAS.map((x) => `menu.tea.${x.id}`),
    ...FLAVORS.map((x) => `menu.flavor.${x.id}`),
    ...SWEETNESS.map((x) => `menu.sweet.${x.id}`),
    ...TOPPINGS.map((x) => `menu.topping.${x.id}`),
    ...REGIONS.map((x) => `survey.regions.${x.id}`),
    ...QUESTIONS.flatMap((q) => [
      `survey.q.${q.id}.title`,
      `survey.q.${q.id}.explain`,
      ...q.options.map((o) => `survey.q.${q.id}.options.${o.value}`),
    ]),
  ]);
  for (const key of expected) assert.ok(key in flatEn, `English is missing "${key}"`);
  const idKeys = Object.keys(flatEn).filter((k) => /^(menu\.|survey\.regions\.|survey\.q\.)/.test(k));
  for (const key of idKeys) assert.ok(expected.has(key), `English has "${key}" but the code has no such id`);
});

// ---- the engine ----------------------------------------------------------------------------

test('choosing a language: link, then saved choice, then browser, then English', () => {
  assert.equal(pickLanguage({ query: '?lang=ru', saved: 'uz-Latn', browser: ['en'] }), 'ru');
  assert.equal(pickLanguage({ query: '', saved: 'uz-Latn', browser: ['ru'] }), 'uz-Latn');
  assert.equal(pickLanguage({ query: '', saved: null, browser: ['de-DE', 'ru-RU', 'en'] }), 'ru');
  assert.equal(pickLanguage({ query: '', saved: null, browser: ['uz-UZ'] }), 'uz-Latn');
  assert.equal(pickLanguage({ query: '', saved: null, browser: ['fr'] }), 'en');
  assert.equal(pickLanguage({ query: '?lang=klingon', saved: 'nonsense', browser: [] }), 'en');
  assert.equal(pickLanguage({}), 'en');
});

test('language codes are matched forgivingly', () => {
  assert.equal(matchLanguage('RU'), 'ru');
  assert.equal(matchLanguage('uz'), 'uz-Latn');
  assert.equal(matchLanguage('uz-latn'), 'uz-Latn');
  assert.equal(matchLanguage('ru-RU'), 'ru');
  assert.equal(matchLanguage('xx'), null);
  assert.equal(matchLanguage(''), null);
  assert.equal(matchLanguage(null), null);
});

test('t() fills placeholders, picks plurals, and shows the key when nothing matches', () => {
  assert.equal(t('hero.ctaBuild'), 'Build your boba');
  assert.equal(t('builder.toppingsHint', { max: 3 }), 'Pick up to 3.');
  assert.equal(t('results.summary', { count: 1 }), '1 person has answered so far.');
  assert.equal(t('results.summary', { count: 12 }), '12 people have answered so far.');
  assert.equal(t('no.such.key'), 'no.such.key');
});

test('English drink names and order text are exactly what they were before translation existed', () => {
  const drink = { tea: 'oolong', flavor: 'taro', sweet: '50', toppings: ['tapioca', 'cheese-foam'] };
  assert.equal(drinkName(drink), 'Taro oolong tea');
  assert.equal(orderDetails(drink), '50% sweet, with tapioca pearls and cheese foam');
  assert.equal(orderText(drink), 'Taro oolong tea, 50% sweet, with tapioca pearls and cheese foam');
  assert.equal(orderDetails({ ...drink, toppings: [] }), '50% sweet, no toppings');
  assert.equal(orderDetails({ ...drink, toppings: ['pudding'] }), '50% sweet, with egg pudding');
  assert.equal(typeof grammar().drinkName, 'function');
});

// ---- language must never reach the data ------------------------------------------------------

test('a submission carrying a language field is rejected', () => {
  const ok = { answers: { adventure: 'try' } };
  assert.equal(validateSubmission(ok).ok, true);
  for (const field of ['lang', 'language', 'locale', 'uiLanguage']) {
    assert.equal(validateSubmission({ ...ok, [field]: 'ru' }).ok, false, `"${field}" must be rejected`);
  }
});

test('the server code never reads or stores the visitor\'s language', () => {
  const files = [
    ...fs.readdirSync(path.join(root, 'api')).map((f) => path.join('api', f)),
    ...fs.readdirSync(path.join(root, 'lib')).map((f) => path.join('lib', f)),
  ];
  for (const file of files) {
    const code = fs.readFileSync(path.join(root, file), 'utf8')
      .replace(/\/\/.*$/gm, ''); // ignore comments
    assert.equal(/accept-language|\blang(uage)?\b|\blocale\b/i.test(code), false, `${file} must not use language`);
  }
});

test('the language-related fonts and their license are bundled with the site', () => {
  const css = fs.readFileSync(path.join(root, 'public/css/styles.css'), 'utf8');
  const urls = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 10, 'expected the original and the added font files');
  for (const file of urls) assert.ok(fs.existsSync(path.join(root, 'public/fonts', file)), `missing font file ${file}`);
  assert.ok(fs.existsSync(path.join(root, 'public/fonts/Inter-LICENSE.txt')), 'Inter license file is required');
  assert.equal(/https?:\/\/[^)]*\.(woff2?|ttf|otf)/i.test(css), false, 'fonts must not come from outside servers');
});
