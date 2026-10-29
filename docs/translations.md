# Boba Lab translations

Boba Lab speaks English, Russian and Uzbek (Latin script). This page explains how
the language system works, the style decisions, and the glossary that keeps the
terminology consistent.

**Status: DRAFT for review.** Russian and Uzbek currently contain a small sample
(38 of 205 messages). Everything else falls back to English until the glossary
below is approved. Nothing here is final until a fluent speaker has read it.

## How it works (short version)

- All visible text lives in `public/js/i18n/locales/` (one file per language).
- Survey answers keep the same internal ids in every language (`try`, `europe`,
  `50`), so the data is one combined dataset. Only the *labels* change.
- The chosen language is remembered only in the visitor's own browser. It is never
  sent to the server and never stored with answers (tests enforce this).
- A missing translation falls back to English, so the site never shows blanks.

## Adding a language later (for example Uzbek Cyrillic)

1. Copy `locales/en.js` to a new file, for example `locales/uz-cyrl.js`, and translate it.
2. Add one entry to `public/js/i18n/languages.js` (code, short label, its own name, `load`).
3. Run `npm test`. It fails if you used a key that does not exist, forgot a `{placeholder}`, or left an empty message.
4. If the language needs letters the fonts lack, check `public/fonts/` (Cyrillic is already covered).
5. Once it is complete, add its code to `COMPLETE` in `test/i18n.test.js`, so missing keys fail from then on.

## Style decisions (approved)

| Language | Decision |
|---|---|
| Russian | Friendly, casual «ты». Avoid gendered past-tense verbs (use present or future). Keep the project name **Boba Lab** in Latin letters. |
| Uzbek (Latin) | Natural, youthful, friendly. «siz» only where direct address is needed. Not stiff or bureaucratic. |
| Uzbek letters | `ʻ` (U+02BB) in oʻ and gʻ. `ʼ` (U+02BC) for the tutuq belgisi, as in taʼm. Never a plain keyboard apostrophe. A test enforces this. |

## Glossary (DRAFT: please correct anything that sounds unnatural)

| English | Русский | Oʻzbekcha | Note |
|---|---|---|---|
| Boba Lab (project name) | Boba Lab | Boba Lab | Never translated |
| boba / bubble tea (the drink) | бабл-ти (drink), боба (pearls, the culture) | boba or bubble tea, whichever fits the sentence | Approved |
| tea base | чай-основа | choy asosi | |
| flavor | вкус | taʼm | |
| sweetness | сладость | shirinlik | |
| toppings | топпинги | qoʻshimchalar | |
| tapioca pearls | тапиока | tapioka marjonlari | Needs review |
| popping boba | поппинг-боба | portlovchi boba | Needs review |
| grass jelly | травяное желе | oʻt jelesi | Needs review |
| lychee jelly | желе из личи | lichi jelesi | |
| egg pudding | яичный пудинг | tuxumli puding | |
| red bean | красная фасоль | qizil loviya | |
| cheese foam | сырная пенка | pishloqli koʻpik | |
| brown sugar | коричневый сахар | jigarrang shakar | |
| Build your boba | Собери свой бабл-ти | Bobangizni tuzing | Sample, in use |
| Surprise me | Удиви меня | Meni ajablantiring | Needs review |
| survey | опрос | soʻrovnoma | Sample, in use |
| results | результаты | natijalar | Sample, in use |
| part of the world | часть мира | dunyoning qismi | Sample, in use |
| Prefer not to say | Не хочу говорить | Aytishni xohlamayman | Sample, in use |
| Demo data | Демо-данные | Demo maʼlumotlar | Sample, in use |
| You / Your region | Ты / Твой регион | Siz / Sizning hududingiz | |

## Grammar that is not word-for-word

Drink names cannot be translated word by word, so each language gets its own
small naming rules (the `grammar` part of a locale file). Planned examples:

| English | Русский | Oʻzbekcha |
|---|---|---|
| Taro oolong tea | Улун с таро | Taroli oolong choyi |
| 50% sweet, with tapioca pearls and cheese foam | Сладость 50%, с тапиокой и сырной пенкой | 50% shirin, tapioka marjonlari va pishloqli koʻpik bilan |

Russian also needs three plural forms («1 человек», «2 человека», «5 человек»).
The engine handles this with the browser's built-in plural rules.

## Review status

| Language | Messages | Reviewed by a fluent speaker |
|---|---|---|
| English | 205 of 205 | n/a (source) |
| Russian | 38 of 205 (sample) | not yet |
| Uzbek (Latin) | 38 of 205 (sample) | not yet |
