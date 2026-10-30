# Boba Lab translations

Boba Lab speaks English, Russian and Uzbek (Latin script). This page explains how
the language system works, the style decisions, and the glossary that keeps the
terminology consistent. **The glossary is the source of truth**: translations
follow it, and when it changes, the translations change with it.

**Status: glossary waiting for final approval.** Russian and Uzbek currently contain a small
sample in the code (38 of 205 messages). The remaining messages fall back to
English until this glossary is approved. Nothing is final until a fluent speaker
has read it.

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

## Style decisions

| Topic | Decision | Status |
|---|---|---|
| Russian tone | Friendly, casual «ты». Avoid gendered past-tense verbs (use present or future). | Approved |
| Uzbek tone | Natural, youthful, friendly, not literal. «siz» only where direct address is needed. Not stiff or bureaucratic. | Approved |
| Project name | **Boba Lab** is never translated, changed or declined, in any language. | Approved |
| "boba" vs "bubble tea" (Uzbek) | **boba** in short headings and buttons. **bubble tea** in descriptive text, where it sounds natural. | Approved |
| Endings on "boba" / "bubble tea" (Uzbek) | Never add Uzbek endings (no *bobangiz*, *bobani*). Reword the sentence so the word stays bare. | Approved |
| "boba" vs "бабл-ти" (Russian) | «бабл-ти» for the drink where natural. «боба» for the pearls, the culture, and where it fits better. | Approved |
| Uzbek letters | `ʻ` (U+02BB) in oʻ and gʻ. `ʼ` (U+02BC) for the tutuq belgisi, as in taʼm. Never a plain keyboard apostrophe. A test enforces this. | Approved |
| Uzbek word for "topping" | **topping** (plural **toppinglar**), not *qoʻshimcha*. Casual and consistent with the boba theme. | Approved |

## Glossary

"Approved" means you confirmed it. "Proposed" follows from an approved decision
or the sample you already reviewed, and is still waiting for your final OK.
"Sample, in use" is wording already on the preview that you have seen.

| English | Русский | Oʻzbekcha | Status |
|---|---|---|---|
| Boba Lab (project name) | Boba Lab | Boba Lab | Approved |
| What's in your cup? (headline) | Что в твоём стаканчике? | **Stakanda nima bor?** | Approved |
| Pick a tea, a flavor and a few toppings. Then see how your taste compares with other people's. (intro) | Выбери чай, вкус и пару топпингов. А потом сравни свой вкус со вкусами других людей. | **Choy, taʼm, topping: oʻzingizga yoqqanini tanlang. Keyin boshqalar nimani tanlaganini koʻring.** | Approved |
| Build your boba (button) | Собери свой бабл-ти | **Boba tayyorlang** | Approved |
| Build (menu link) | Собрать | **Tayyorlash** | Approved |
| Take the survey (button) | Пройти опрос | Soʻrovnomada qatnashing | Sample, in use |
| tea base | чай-основа | choy asosi | Proposed |
| flavor | вкус | taʼm | Approved |
| sweetness | сладость | shirinlik | Proposed |
| toppings | топпинги | **toppinglar** | Approved |
| no toppings | без топпингов | **topping yoʻq** | Approved |
| Pick up to 3. | Выбери до 3. | **Eng koʻpi bilan 3 ta tanlang.** | Approved |
| tapioca pearls | тапиока | **tapioka sharchalari** | Approved |
| popping boba | поппинг-боба | **sharbatli boba** | Approved |
| grass jelly | травяное желе | **giyohli jele** | Approved |
| lychee jelly | желе из личи | lichi jelesi | Proposed |
| egg pudding | яичный пудинг | tuxumli puding | Proposed |
| red bean | красная фасоль | qizil loviya | Proposed |
| cheese foam | сырная пенка | pishloqli koʻpik | Proposed |
| brown sugar | коричневый сахар | jigarrang shakar | Proposed |
| Surprise me (button) | Удиви меня | **Ajablantirib yuboring** | Approved |
| survey | опрос | soʻrovnoma | Sample, in use |
| results | результаты | natijalar | Sample, in use |
| part of the world | часть мира | dunyoning qismi | Sample, in use |
| Prefer not to say | Не хочу говорить | Aytishni xohlamayman | Sample, in use |
| Demo data | Демо-данные | Demo maʼlumotlar | Sample, in use |
| You / Your region | Ты / Твой регион | Siz / Sizning hududingiz | Proposed |

## How the boba / bubble tea rule looks in sentences (Uzbek)

| Where | Uzbek | Why | Status |
|---|---|---|---|
| Browser tab title | **Boba Lab: bubble tea tayyorlang va taʼmlarni solishtiring** | Descriptive text: "bubble tea", bare, no ending. Checked: reads well on a phone tab. | Approved |
| Page description | Oʻzingizga yoqqan bubble tea tayyorlang, qisqa anonim soʻrovnomada qatnashing va taʼmingiz boshqalarnikiga qanchalik mos kelishini bilib oling. | Same rule | Proposed |
| Share text | Boba tayyorlang va taʼmingiz boshqalarnikiga qanchalik mos kelishini koʻring. | Short, so "boba" | Proposed |

## Sample strings in the code that will change once this is approved

The website code has NOT been changed. These current Uzbek sample strings still
use the old wording and will be replaced:

| Where | Currently in the code | Will become |
|---|---|---|
| Headline | Stakaningizda nima bor? | Stakanda nima bor? |
| Intro | Choy, taʼm va bir nechta qoʻshimcha tanlang. Soʻng taʼmingizni boshqalarnikiga solishtirib koʻring. | The approved intro above |
| Build button | Bobangizni tuzing | Boba tayyorlang |
| Menu link "Build" | Tuzish | Tayyorlash |
| Tab title and description | use *bobangizni* | The proposed texts above |

Also to check later: the shorter headline "Stakanda" leaves room to make the Uzbek
title bigger again (the current size rule was set for the longer word).

## New English messages waiting for translation (added by `feature/rate-limit`)

These are in English only for now, so Russian and Uzbek visitors see English until the
survey stage of the translations. Translate them then, using the glossary.

| Key | English |
|---|---|
| `survey.alreadyAnswered` | This browser has already sent answers. If you are someone else, welcome! If it is you again, there is no need: it would count twice in the totals. |
| `survey.errors.rate_limited` | Several answers have already come from this network today, so new ones are paused to keep the results fair. Please try again tomorrow. |

The privacy sentences in `docs/repeat-submissions.md` will also need translating once approved.

## Grammar that is not word-for-word

Drink names cannot be translated word by word, so each language gets its own
small naming rules (the `grammar` part of a locale file). Planned examples:

| English | Русский | Oʻzbekcha |
|---|---|---|
| Taro oolong tea | Улун с таро | Taroli oolong choyi |
| 50% sweet, with tapioca pearls and cheese foam | Сладость 50%, с тапиокой и сырной пенкой | 50% shirin, tapioka sharchalari va pishloqli koʻpik bilan |

Russian also needs three plural forms («1 человек», «2 человека», «5 человек»).
The engine handles this with the browser's built-in plural rules.

## Review status

| Language | Messages | Reviewed by a fluent speaker |
|---|---|---|
| English | 205 of 205 | n/a (source) |
| Russian | 38 of 205 (sample) | sample reviewed |
| Uzbek (Latin) | 38 of 205 (sample) | glossary decisions reviewed and settled; full text not yet |
