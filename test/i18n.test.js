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

// Languages whose translation is finished: a missing key in any of them fails the tests.
const COMPLETE = ['en', 'ru', 'uz-latn'];
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

// Names and technical terms that are meant to stay as they are in every language.
const KEPT_AS_IS = /Boba Lab|JavaScript/g;

test('Russian text contains no leftover English words (except the project name)', () => {
  for (const [key, value] of Object.entries(flatten(ru.messages))) {
    for (const text of textsOf(value)) {
      const cleaned = text.replace(/\{\w+\}/g, '').replace(KEPT_AS_IS, '');
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


// ====================================================================================
// COMPLETENESS: nothing visible may be left untranslated (English, Russian, Uzbek)
// ====================================================================================

const flatRu = flatten(ru.messages);
const flatUz = flatten(uz.messages);
const hasLetters = (text) => /\p{L}/u.test(text.replace(/\{\w+\}/g, '').replace(KEPT_AS_IS, ''));

// Words that are genuinely the same in English and the other language (names, loan words).
// Anything else that is identical to English means "forgot to translate".
const SAME_AS_ENGLISH_OK = {
  ru: new Set([]),
  'uz-latn': new Set(['menu.flavor.taro', 'menu.flavor.mango', 'menu.flavor.taro']),
};

test('Russian and Uzbek have exactly the same keys as English, nothing missing and nothing extra', () => {
  const keysEn = Object.keys(flatEn).sort();
  assert.deepEqual(Object.keys(flatRu).sort(), keysEn, 'ru keys differ from en');
  assert.deepEqual(Object.keys(flatUz).sort(), keysEn, 'uz-latn keys differ from en');
  assert.ok(keysEn.length >= 200, 'English should have all of its messages');
});

test('no Russian or Uzbek message is just the English text left in place', () => {
  for (const [code, flat] of [['ru', flatRu], ['uz-latn', flatUz]]) {
    for (const [key, value] of Object.entries(flat)) {
      const english = JSON.stringify(flatEn[key]);
      if (JSON.stringify(value) !== english) continue;
      const letters = textsOf(value).some(hasLetters);
      assert.ok(!letters || SAME_AS_ENGLISH_OK[code].has(key), `${code}.${key} is identical to English: ${english}`);
    }
  }
});

test('Russian messages are written in Cyrillic; Uzbek messages contain no Cyrillic at all', () => {
  for (const [key, value] of Object.entries(flatRu)) {
    for (const text of textsOf(value)) {
      if (hasLetters(text)) assert.ok(/[А-Яа-яЁё]/.test(text), `ru.${key} has no Russian letters: ${text}`);
    }
  }
  for (const [key, value] of Object.entries(flatUz)) {
    for (const text of textsOf(value)) assert.equal(/[А-Яа-яЁё]/.test(text), false, `uz-latn.${key} contains Cyrillic: ${text}`);
  }
});

test('Russian is informal «ты»: it never uses the formal «вы» forms', () => {
  const formal = /(?:^|[^а-яё])(?:вы|вас|вам|вами|ваш|ваша|ваше|ваши|вашего|вашей|вашему|вашим|вашем|вашу)(?:[^а-яё]|$)/i;
  for (const [key, value] of Object.entries(flatRu)) {
    for (const text of textsOf(value)) assert.equal(formal.test(text), false, `ru.${key} uses formal "вы": ${text}`);
  }
});

test('Russian avoids gendered past-tense verbs about the visitor (-л / -ла after "ты" wording)', () => {
  // The approved style: present or future tense, never "ты видел/видела".
  const gendered = /\b(?:был|была|видел|видела|выбрал|выбрала|ответил|ответила|пробовал|пробовала|собрал|собрала|хотел|хотела|мог|могла)\b/i;
  for (const [key, value] of Object.entries(flatRu)) {
    for (const text of textsOf(value)) assert.equal(gendered.test(text), false, `ru.${key} has a gendered past-tense verb: ${text}`);
  }
});

test('Uzbek never puts endings on "boba", "bubble tea" or "Boba Lab" (approved rule)', () => {
  const ending = /\b(?:boba|bubble tea|Boba Lab)(?:ni|ng|ngiz|ga|da|dan|ning|si|lar|larni|dagi|ning)\b/i;
  for (const [key, value] of Object.entries(flatUz)) {
    for (const text of textsOf(value)) assert.equal(ending.test(text), false, `uz-latn.${key} has an ending on boba: ${text}`);
  }
});

test('Uzbek uses «topping», never the rejected word «qoʻshimcha», and the approved key phrases', () => {
  const all = Object.values(flatUz).flatMap(textsOf).join('\n');
  assert.equal(/qoʻshimcha/i.test(all), false);
  assert.equal(flatUz['hero.title'], 'Stakanda nima bor?');
  assert.equal(flatUz['hero.ctaBuild'], 'Boba tayyorlang');
  assert.equal(flatUz['nav.build'], 'Tayyorlash');
  assert.equal(flatUz['surprise.button'], 'Ajablantirib yuboring');
  assert.equal(flatUz['builder.noToppings'], 'topping yoʻq');
  assert.equal(flatUz['menu.topping.tapioca'], 'Tapioka sharchalari');
  assert.equal(flatUz['menu.topping.popping'], 'Sharbatli boba');
  assert.equal(flatUz['menu.topping.grass-jelly'], 'Giyohli jele');
  assert.equal(flatUz['meta.title'], 'Boba Lab: bubble tea tayyorlang va taʼmlarni solishtiring');
  assert.equal(flatRu['hero.title'], 'Что в твоём стаканчике?');
  assert.equal(flatRu['hero.ctaBuild'], 'Собери свой бабл-ти');
  assert.equal(flatRu['surprise.button'], 'Удиви меня');
  assert.equal(flatRu['menu.topping.popping'], 'Поппинг-боба');
  assert.equal(flatRu['menu.topping.grass-jelly'], 'Травяное желе');
});

test('Uzbek ʻ only follows o or g, and ʼ always sits between letters', () => {
  for (const [key, value] of Object.entries(flatUz)) {
    for (const text of textsOf(value)) {
      assert.equal(/[^ogOG]ʻ|^ʻ/.test(text), false, `uz-latn.${key}: ʻ must only follow o or g: ${text}`);
      assert.equal(/(?:^|[^\p{L}])ʼ|ʼ(?:[^\p{L}]|$)/u.test(text), false, `uz-latn.${key}: ʼ must sit between letters: ${text}`);
    }
  }
});

test('Russian plural forms are chosen correctly for every kind of number', () => {
  const rules = new Intl.PluralRules('ru');
  const summary = ru.messages.results.summary;
  const expectedEnding = { 1: 'участник.', 2: 'участника.', 5: 'участников.', 11: 'участников.', 12: 'участников.', 21: 'участник.', 22: 'участника.', 25: 'участников.', 101: 'участник.', 111: 'участников.' };
  for (const [count, ending] of Object.entries(expectedEnding)) {
    const form = summary[rules.select(Number(count))];
    assert.ok(form.endsWith(ending), `${count} -> "${form}" should end with ${ending}`);
  }
  for (let n = 0; n < 1200; n += 1) {
    for (const key of ['summary', 'answeredQuestion', 'regionPeople']) {
      assert.ok(ru.messages.results[key][rules.select(n)], `ru results.${key} has no form for ${n}`);
    }
  }
  const uzRules = new Intl.PluralRules('uz-Latn');
  for (let n = 0; n < 50; n += 1) assert.ok(uz.messages.results.summary[uzRules.select(n)], `uz summary has no form for ${n}`);
});

// ---- drink names and order text (the "grammar" of each language) ---------------------------

const labels = (flat) => ({
  tea: (id) => flat[`menu.tea.${id}`],
  flavor: (id) => flat[`menu.flavor.${id}`],
  topping: (id) => flat[`menu.topping.${id}`],
});
const TOPPING_SETS = [[], ['tapioca'], ['tapioca', 'cheese-foam'], ['popping', 'grass-jelly', 'pudding'], ...TOPPINGS.map((x) => [x.id])];

test('Russian and Uzbek build every drink name and order text, with no gaps', () => {
  for (const [code, locale, flat] of [['ru', ru, flatRu], ['uz-latn', uz, flatUz]]) {
    const L = labels(flat);
    let count = 0;
    for (const tea of TEAS) for (const flavor of FLAVORS) for (const sweet of SWEETNESS) for (const toppings of TOPPING_SETS) {
      const drink = { tea: tea.id, flavor: flavor.id, sweet: sweet.id, toppings };
      for (const text of [locale.grammar.drinkName(drink, L), locale.grammar.orderDetails(drink, L)]) {
        assert.ok(typeof text === 'string' && text.length > 3, `${code} ${JSON.stringify(drink)}`);
        assert.equal(/undefined|null|\[object|\{/.test(text), false, `${code}: ${text}`);
        assert.equal(/[А-Яа-яЁё]/.test(text), code === 'ru', `${code}: wrong script in "${text}"`);
        if (code === 'ru') assert.equal(/[A-Za-z]/.test(text), false, `ru: Latin letters in "${text}"`);
      }
      assert.ok(locale.grammar.orderDetails(drink, L).includes(`${sweet.id}%`), `${code}: sweetness missing`);
      count += 1;
    }
    assert.ok(count > 1000);
  }
});

test('drink names read the way the approved examples do', () => {
  const drink = { tea: 'oolong', flavor: 'taro', sweet: '50', toppings: ['tapioca', 'cheese-foam'] };
  const ruL = labels(flatRu);
  const uzL = labels(flatUz);
  assert.equal(ru.grammar.drinkName(drink, ruL), 'Улун с таро');
  assert.equal(ru.grammar.orderDetails(drink, ruL), 'Сладость 50%, с тапиокой и сырной пенкой');
  assert.equal(ru.grammar.orderDetails({ ...drink, toppings: [] }, ruL), 'Сладость 50%, без топпингов');
  assert.equal(ru.grammar.orderDetails({ ...drink, toppings: ['popping', 'grass-jelly', 'pudding'] }, ruL), 'Сладость 50%, с поппинг-бобой, травяным желе и яичным пудингом');
  assert.equal(ru.grammar.drinkName({ ...drink, tea: 'black', flavor: 'classic' }, ruL), 'Чёрный чай с молоком');
  assert.equal(uz.grammar.drinkName(drink, uzL), 'Taroli oolong choyi');
  assert.equal(uz.grammar.orderDetails(drink, uzL), '50% shirin, tapioka sharchalari va pishloqli koʻpik bilan');
  assert.equal(uz.grammar.orderDetails({ ...drink, toppings: [] }, uzL), '50% shirin, topping yoʻq');
  assert.equal(uz.grammar.drinkName({ ...drink, tea: 'green', flavor: 'mango' }, uzL), 'Mangoli yashil choy');
});

// ---- every piece of text the site can show is wired to the language files ------------------------

const publicFile = (name) => fs.readFileSync(path.join(root, 'public', name), 'utf8');
const jsFiles = fs.readdirSync(path.join(root, 'public/js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`);

test('every key the page and scripts use exists in English, Russian and Uzbek', () => {
  const used = new Set();
  const html = publicFile('index.html').replace(/<!--[\s\S]*?-->/g, ''); // the explanation comment mentions data-i18n="key"
  for (const [, key] of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(key);
  for (const [, pairs] of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of pairs.split(';')) used.add(pair.split(':')[1].trim());
  }
  for (const file of jsFiles) {
    const code = publicFile(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // comments are not text on the page
    for (const [, key] of code.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(key);
    for (const [, key] of code.matchAll(/labelKey:\s*'([\w.]+)'/g)) used.add(key);
  }
  assert.ok(used.size > 80, `expected to find many keys, found ${used.size}`);
  for (const key of used) {
    for (const [code, flat] of [['en', flatEn], ['ru', flatRu], ['uz-latn', flatUz]]) assert.ok(key in flat, `${code} is missing "${key}", which the site uses`);
  }
});

test('every server error code the survey can show has a message in every language', () => {
  const source = publicFile('js/survey.js');
  const codes = source.match(/KNOWN_ERROR_CODES = \[([^\]]+)\]/)[1].match(/'(\w+)'/g).map((c) => c.replaceAll("'", ''));
  for (const code of [...codes, 'generic', 'network']) {
    for (const flat of [flatEn, flatRu, flatUz]) assert.ok(`survey.errors.${code}` in flat, `survey.errors.${code}`);
  }
  const server = fs.readFileSync(path.join(root, 'api/survey.js'), 'utf8') + fs.readFileSync(path.join(root, 'lib/http.js'), 'utf8');
  // method_not_allowed answers someone who opens the address in a browser; the site itself only ever POSTs.
  const neverShown = new Set(['method_not_allowed']);
  for (const [, sent] of server.matchAll(/code:\s*'(\w+)'/g)) {
    assert.ok(codes.includes(sent) || neverShown.has(sent), `server can send "${sent}" but the site has no message for it`);
  }
});

test('index.html has no visible text that is not wired to the language files', () => {
  let html = publicFile('index.html');
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<head>[\s\S]*?<\/head>/, '').replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  html = html.replace(/<p id="footer-text">[\s\S]*?<\/p>/, ''); // drawn by main.js from page.footer
  html = html.replace(/<(\w+)\b[^>]*data-i18n="[^"]+"[^>]*>[\s\S]*?<\/\1>/g, '');
  const leftover = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(leftover, 'Boba Lab', `these words are not translatable: "${leftover}"`);
  // Attributes people can hear (aria-label) must be wired too.
  for (const [tag] of publicFile('index.html').matchAll(/<[^>]*\baria-label="[^"]*"[^>]*>/g)) {
    assert.match(tag, /data-i18n-attr="[^"]*aria-label:/, `aria-label is not translated in: ${tag}`);
  }
});

test('no script writes an English sentence straight onto the page', () => {
  // Visible words must come from t(). Look for quoted text with a space and a capital
  // letter being handed to an element or to textContent.
  const suspicious = /(?:textContent\s*=\s*|h\([^)]*?,\s*\{[^}]*\},\s*)['"`]([A-Z][a-z]+(?:\s+[a-z]+)+[^'"`]*)['"`]/g;
  for (const file of jsFiles) {
    const code = publicFile(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const [, text] of code.matchAll(suspicious)) assert.fail(`${file} writes English text directly: "${text}"`);
  }
});

test('every language can be switched to and from, and its name is shown in its own language', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code), ['en', 'ru', 'uz-Latn']);
  assert.deepEqual(LANGUAGES.map((l) => l.name), ['English', 'Русский', 'Oʻzbekcha']);
  for (const locale of [ru, uz]) {
    assert.equal(typeof locale.grammar.drinkName, 'function');
    assert.equal(typeof locale.grammar.orderDetails, 'function');
  }
});


// ---- the approved glossary in docs/translations.md is really what the website says -------------------------------

test('every APPROVED glossary entry appears on the website, in Russian and in Uzbek', () => {
  const doc = fs.readFileSync(path.join(root, 'docs/translations.md'), 'utf8');
  const section = doc.slice(doc.indexOf('## Glossary'), doc.indexOf('## How the boba / bubble tea rule'));
  const rows = section.split('\n').filter((line) => line.startsWith('|') && /\| Approved \|$/.test(line.trim()));
  assert.ok(rows.length >= 12, `expected the approved rows, found ${rows.length}`);

  // Everything the site can say, as plain text ({max} shown as 3, the way the glossary writes it).
  const texts = (flat) => Object.values(flat).flatMap(textsOf).map((x) => x.replace('{max}', '3').toLowerCase());
  const siteRu = texts(flatRu);
  const siteUz = texts(flatUz);
  const clean = (cell) => cell.replace(/\*\*/g, '').trim().toLowerCase();

  for (const row of rows) {
    const [english, russian, uzbek] = row.split('|').slice(1, 4).map((cell) => cell.trim());
    assert.ok(siteRu.some((text) => text === clean(russian)), `Russian glossary entry for "${english}" is not on the site: ${russian}`);
    assert.ok(siteUz.some((text) => text === clean(uzbek)), `Uzbek glossary entry for "${english}" is not on the site: ${uzbek}`);
  }
});

test('the old Uzbek sample wording is gone from the whole project (code, docs and tests)', () => {
  const old = /bobangizni|bobongizni|bobangiz|bobongiz|stakaningizda|\btuzish\b|\btuzing\b/i;
  const skip = new Set(['node_modules', '.git', 'snapshots']);
  const visit = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    if (skip.has(entry.name)) return [];
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    return entry.isDirectory() ? visit(relative) : [relative];
  });
  for (const file of visit('')) {
    if (!/\.(js|html|css|md|json)$/.test(file) || file === 'test/i18n.test.js') continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [number, line] of text.split('\n').entries()) {
      if (!old.test(line)) continue;
      // The only allowed mentions are rules that FORBID the old words ("no bobangiz") or explain the history.
      assert.ok(/\b(?:no|never|not|old|forbid|NEVER)\b|Stakaningizda"\)/.test(line), `${file}:${number + 1} still uses the old Uzbek wording: ${line.trim()}`);
    }
  }
});
