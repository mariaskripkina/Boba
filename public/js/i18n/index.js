// The translation engine.
//
// What it does, in one paragraph: the rest of the site never writes visible
// text itself. It asks this file, for example t('hero.title'), and gets the
// words in the visitor's language. Survey answers are NOT translated here:
// they keep their internal ids (like "try" or "europe") in every language, so
// the data stays in one combined dataset.
//
// Privacy: the chosen language is remembered only in this browser
// (localStorage) so the site opens in it next time. It is never sent to the
// server and never stored together with survey answers.

import { LANGUAGES, DEFAULT_LANGUAGE, STORAGE_KEY } from './languages.js';
import en from './locales/en.js';

const loaded = { [DEFAULT_LANGUAGE]: en };
let current = DEFAULT_LANGUAGE;
const listeners = new Set();

// ---- choosing a language ----------------------------------------------------

const byCode = (code) => LANGUAGES.find((l) => l.code === code);

// "ru", "RU", "russian", "uz-uz" ... -> the matching language code, or null.
export function matchLanguage(text) {
  if (!text || typeof text !== 'string') return null;
  const value = text.trim().toLowerCase();
  const exact = LANGUAGES.find((l) => l.code.toLowerCase() === value || l.aliases.includes(value));
  if (exact) return exact.code;
  // "ru-RU" or "uz-Latn-UZ": try just the first part ("ru", "uz").
  const first = value.split(/[-_]/)[0];
  const loose = LANGUAGES.find((l) => l.aliases.includes(first));
  return loose ? loose.code : null;
}

// Pure function (easy to test): link first, then the saved choice, then the
// browser's own language list, then English.
export function pickLanguage({ query = '', saved = null, browser = [] } = {}) {
  const fromLink = matchLanguage(new URLSearchParams(query).get('lang'));
  if (fromLink) return fromLink;
  const fromSaved = matchLanguage(saved);
  if (fromSaved) return fromSaved;
  for (const tag of browser) {
    const fromBrowser = matchLanguage(tag);
    if (fromBrowser) return fromBrowser;
  }
  return DEFAULT_LANGUAGE;
}

function readSaved() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function writeSaved(code) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode: fine, just not remembered */ }
}

// ---- translating ---------------------------------------------------------------

function lookup(messages, key) {
  let node = messages;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

// A message can be a plain string, or an object of plural forms:
//   { one: '{count} person', other: '{count} people' }
// Russian has more forms (one / few / many / other); the browser knows the rules.
function choosePlural(forms, count, htmlLang) {
  let category = 'other';
  try { category = new Intl.PluralRules(htmlLang).select(count); } catch { /* keep "other" */ }
  return forms[category] ?? forms.other;
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

// t('builder.title')
// t('survey.thanks', { name: 'x' })     -> fills {name}
// t('results.peopleAnswered', { count: 5 }) -> picks the right plural form
export function t(key, vars = {}) {
  const htmlLang = byCode(current)?.code ?? DEFAULT_LANGUAGE;
  let message = lookup(loaded[current]?.messages, key);
  if (message === undefined) message = lookup(en.messages, key); // missing? fall back to English
  if (message === undefined) return key;                          // still missing: show the key (easy to spot)
  if (typeof message === 'object') {
    message = choosePlural(message, Number(vars.count), htmlLang);
    if (message === undefined) return key;
  }
  return fill(message, vars);
}

// Some languages need their own grammar for building names, for example
// English "Taro oolong tea" vs Russian "Улун с таро". A locale can provide
// these small functions; any it does not provide fall back to English.
export function grammar() {
  return { ...en.grammar, ...(loaded[current]?.grammar ?? {}) };
}

export const getLanguage = () => current;
export const getLanguages = () => LANGUAGES;
export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- updating the page ---------------------------------------------------------

// Static text in index.html is marked up like this:
//   <h2 data-i18n="builder.title">Build your boba</h2>
//   <a data-i18n-attr="aria-label:hero.cupButtonAria" ...>
// The English text stays in the HTML as a fallback (and for anyone without JavaScript).
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
      const [attribute, key] = pair.split(':').map((s) => s.trim());
      if (attribute && key) el.setAttribute(attribute, t(key));
    }
  }
}

function updateDocument() {
  document.documentElement.lang = byCode(current).code;
  document.title = t('meta.title');
  const setMeta = (selector, value) => document.querySelector(selector)?.setAttribute('content', value);
  setMeta('meta[name="description"]', t('meta.description'));
  setMeta('meta[property="og:title"]', t('meta.ogTitle'));
  setMeta('meta[property="og:description"]', t('meta.ogDescription'));
  applyStatic();
}

async function ensureLoaded(code) {
  if (loaded[code]) return;
  const entry = byCode(code);
  const module = await entry.load();
  loaded[code] = module.default;
}

// Called once when the page starts. Returns the language that is now active.
export async function initI18n() {
  const code = pickLanguage({
    query: location.search,
    saved: readSaved(),
    browser: navigator.languages?.length ? navigator.languages : [navigator.language],
  });
  try {
    await ensureLoaded(code);
    current = code;
  } catch {
    current = DEFAULT_LANGUAGE; // a translation file failed to load: stay in English
  }
  updateDocument();
  return current;
}

// Called when someone clicks the language switcher.
export async function setLanguage(code) {
  const wanted = matchLanguage(code);
  if (!wanted || wanted === current) return current;
  try {
    await ensureLoaded(wanted);
  } catch {
    return current; // could not load it; keep what we have
  }
  current = wanted;
  writeSaved(current);

  // Put the language in the address bar, so a copied link opens in this language.
  try {
    const url = new URL(location.href);
    url.searchParams.set('lang', current);
    history.replaceState(null, '', url);
  } catch { /* not important */ }

  updateDocument();
  for (const listener of listeners) listener(current);
  return current;
}
