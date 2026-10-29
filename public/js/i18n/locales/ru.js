// Русский (Russian). SAMPLE ONLY, for review: the rest still falls back to English.
//
// Style decisions (approved):
//   - friendly, casual "ты" (never "вы")
//   - keep the project name "Boba Lab" in Latin letters
//   - "бабл-ти" for the drink, "боба" where it fits better (pearls, the culture)
//   - avoid gendered past-tense verbs ("видел/видела") by using present or future

export default {
  messages: {
    meta: {
      title: 'Boba Lab: собери свой бабл-ти и сравни вкусы',
      description: 'Собери свой бабл-ти, пройди короткий анонимный опрос и узнай, как твой вкус сочетается со вкусами других людей.',
      ogTitle: 'Boba Lab',
      ogDescription: 'Собери свой бабл-ти и сравни свой вкус со вкусами других людей.',
    },

    lang: { label: 'Язык' },

    nav: {
      label: 'Главное меню',
      build: 'Собрать',
      survey: 'Опрос',
      results: 'Результаты',
      about: 'О проекте',
    },

    hero: {
      title: 'Что в твоём стаканчике?',
      lead: 'Выбери чай, вкус и пару топпингов. А потом сравни свой вкус со вкусами других людей.',
      ctaBuild: 'Собери свой бабл-ти',
      ctaSurvey: 'Пройти опрос',
      cupButtonAria: 'Потрясти стаканчик',
      hint: 'Нажми на стаканчик, чтобы потрясти его',
    },

    survey: {
      q: {
        adventure: {
          title: 'Видишь в меню незнакомый вкус. Что сделаешь?',
          explain: 'Насколько люди готовы пробовать незнакомые вкусы.',
          options: {
            skip: 'Возьму что-нибудь привычное',
            ask: 'Сначала спрошу, какой он на вкус',
            try: 'Закажу сразу',
            seek: 'Поищу что-нибудь похожее',
          },
        },
      },

      region: {
        title: 'В какой части мира ты живёшь?',
        optional: ' (по желанию)',
        hint: 'Необязательно. Ответ просто добавляется к общим цифрам по крупным регионам.',
        preferNot: 'Не хочу говорить',
      },
      regions: {
        'east-asia': 'Восточная Азия',
        'southeast-asia': 'Юго-Восточная Азия',
        'south-asia': 'Южная Азия',
        'central-asia': 'Центральная Азия и Кавказ',
        mena: 'Ближний Восток и Северная Африка',
        'sub-saharan': 'Африка к югу от Сахары',
        europe: 'Европа',
        'north-america': 'Северная Америка',
        'latin-america': 'Латинская Америка и Карибы',
        oceania: 'Океания',
      },
    },

    results: {
      demoTitle: 'Демо-данные',
      demoText: 'Эти цифры выдуманы, чтобы показать, как будут выглядеть результаты. Это не данные реальных людей.',
    },
  },
};
