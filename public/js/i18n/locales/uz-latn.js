// Oʻzbekcha, Latin script (Uzbek). SAMPLE ONLY, for review: the rest still falls back to English.
//
// Style decisions (approved):
//   - friendly, natural wording for a youth-oriented project, "siz" where
//     direct address is needed, never stiff or bureaucratic
//   - "boba" or "bubble tea", whichever sounds natural in the sentence
//
// Letters (important): Uzbek Latin has TWO different marks, and neither is a
// plain keyboard apostrophe:
//   ʻ  U+02BB  in oʻ and gʻ        (for example: oʻz, koʻrsating, gʻalaba)
//   ʼ  U+02BC  the "tutuq belgisi"  (for example: taʼm, maʼlumot)
// A test fails if a plain apostrophe or curly quote sneaks into this file.

export default {
  messages: {
    meta: {
      title: 'Boba Lab: oʻz bobangizni tuzing va taʼmlarni solishtiring',
      description: 'Oʻz bobangizni tuzing, qisqa anonim soʻrovnomada qatnashing va taʼmingiz boshqalarnikiga qanchalik mos kelishini bilib oling.',
      ogTitle: 'Boba Lab',
      ogDescription: 'Oʻz bobangizni tuzing va taʼmingizni boshqalarnikiga solishtiring.',
    },

    lang: { label: 'Til' },

    nav: {
      label: 'Asosiy menyu',
      build: 'Tuzish',
      survey: 'Soʻrovnoma',
      results: 'Natijalar',
      about: 'Loyiha haqida',
    },

    hero: {
      title: 'Stakaningizda nima bor?',
      lead: 'Choy, taʼm va bir nechta qoʻshimcha tanlang. Soʻng taʼmingizni boshqalarnikiga solishtirib koʻring.',
      ctaBuild: 'Bobangizni tuzing',
      ctaSurvey: 'Soʻrovnomada qatnashing',
      cupButtonAria: 'Stakanni silkitish',
      hint: 'Silkitish uchun stakanni bosing',
    },

    survey: {
      q: {
        adventure: {
          title: 'Menyuda notanish taʼmni koʻrdingiz. Nima qilasiz?',
          explain: 'Odamlar notanish taʼmni sinab koʻrishga qanchalik tayyor.',
          options: {
            skip: 'Tanish narsani tanlayman',
            ask: 'Avval qanday taʼmi borligini soʻrayman',
            try: 'Darhol buyurtma beraman',
            seek: 'Shunga oʻxshash narsa qidiraman',
          },
        },
      },

      region: {
        title: 'Dunyoning qaysi qismida yashaysiz?',
        optional: ' (ixtiyoriy)',
        hint: 'Majburiy emas. Bu faqat yirik hududlar boʻyicha umumiy hisobga qoʻshiladi.',
        preferNot: 'Aytishni xohlamayman',
      },
      regions: {
        'east-asia': 'Sharqiy Osiyo',
        'southeast-asia': 'Janubi-sharqiy Osiyo',
        'south-asia': 'Janubiy Osiyo',
        'central-asia': 'Markaziy Osiyo va Kavkaz',
        mena: 'Yaqin Sharq va Shimoliy Afrika',
        'sub-saharan': 'Saxaradan janubdagi Afrika',
        europe: 'Yevropa',
        'north-america': 'Shimoliy Amerika',
        'latin-america': 'Lotin Amerikasi va Karib havzasi',
        oceania: 'Okeaniya',
      },
    },

    results: {
      demoTitle: 'Demo maʼlumotlar',
      demoText: 'Bu raqamlar natijalar qanday koʻrinishini koʻrsatish uchun oʻylab topilgan. Ular haqiqiy odamlardan olinmagan.',
    },
  },
};
