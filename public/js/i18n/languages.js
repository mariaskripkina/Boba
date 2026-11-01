// The list of languages Boba Lab speaks.
//
// To ADD a language later, you do two things:
//   1. Copy locales/en.js to a new file (for example locales/uz-cyrl.js) and translate it.
//   2. Add one entry to the list below.
// Nothing else in the site needs to change.
//
// Fields:
//   code      the id used in links (?lang=ru), in the saved choice, and in <html lang>.
//   short     the 2-letter label shown on small screens in the language switcher.
//   name      the language's OWN name, shown on wider screens ("Русский", not "Russian").
//   aliases   other spellings that should also pick this language (links, browser settings).
//   load      how to fetch its translations. English is built in, so it has none.
//             The others are loaded only when someone actually picks them, which keeps
//             the first page fast for everyone else.

export const DEFAULT_LANGUAGE = 'en';

// Where the visitor's choice is remembered. It stays in THIS browser only.
// It is never sent to the server and never stored next to survey answers.
export const STORAGE_KEY = 'boba-lab-language';

export const LANGUAGES = [
  {
    code: 'en',
    short: 'EN',
    name: 'English',
    aliases: ['en', 'english'],
    load: null,
  },
  {
    code: 'ru',
    short: 'RU',
    name: 'Русский',
    aliases: ['ru', 'russian'],
    load: () => import('./locales/ru.js'),
  },
  {
    code: 'uz-Latn',
    short: 'UZ',
    // ʻ is the Uzbek Latin letter mark (U+02BB), not a plain apostrophe.
    name: 'Oʻzbekcha',
    aliases: ['uz', 'uz-latn', 'uzbek', 'uz-uz'],
    load: () => import('./locales/uz-latn.js'),
  },
];
