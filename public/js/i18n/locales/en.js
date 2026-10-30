// English: the SOURCE language. Every other language file copies this structure.
//
// Rules for translators (and for future you):
//   - Keep the keys exactly as they are. Only change the text on the right.
//   - Keep {placeholders} like {min} or {count}. They are filled in by the code.
//   - A message with one/other (or one/few/many/other) is a plural: "1 person",
//     "5 people". Languages with more plural forms add the extra ones.
//   - Option ids such as "try", "europe" or "black" are NOT here and never
//     change. Only their display names are, so every language counts into the
//     same combined results.

export default {
  messages: {
    meta: {
      title: 'Boba Lab: build a boba and see how your taste compares',
      description: "Build your own boba tea, answer a short anonymous survey, and see how your taste compares with other people's.",
      ogTitle: 'Boba Lab',
      ogDescription: "Build your own boba tea and see how your taste compares with other people's.",
    },

    lang: { label: 'Language' },

    page: {
      skip: 'Skip to the builder',
      brandAria: 'Boba Lab, back to the top',
      noscript: 'Boba Lab needs JavaScript to build drinks and run the survey. Please turn it on and reload.',
      footer: 'Boba Lab, {year}. Made with curiosity and a lot of tea.',
    },

    nav: {
      label: 'Main',
      build: 'Build',
      survey: 'Survey',
      results: 'Results',
      about: 'About',
    },

    hero: {
      title: "What's in your cup?",
      lead: "Pick a tea, a flavor and a few toppings. Then see how your taste compares with other people's.",
      ctaBuild: 'Build your boba',
      ctaSurvey: 'Take the survey',
      cupButtonAria: 'Shake the cup',
      hint: 'Tap the cup to shake it',
    },

    builder: {
      title: 'Build your boba',
      intro: 'Choose as you go. The cup changes with every pick.',
      previewAria: 'Your drink',
      groupTea: 'Tea base',
      groupFlavor: 'Flavor',
      groupSweetness: 'Sweetness',
      groupToppings: 'Toppings',
      toppingsHint: 'Pick up to {max}.',
      detail: '{sweet} sweet, {toppings}',
      noToppings: 'no toppings',
      copy: 'Copy my order',
      copied: 'Copied',
      copiedStatus: 'Copied: {text}',
      copyFailed: 'Could not copy. Select the text above instead.',
    },

    // Display names. The ids (black, taro, 50, tapioca ...) live in menu.js.
    menu: {
      tea: {
        black: 'Black tea',
        green: 'Green tea',
        oolong: 'Oolong tea',
        jasmine: 'Jasmine green tea',
        barley: 'Barley tea',
      },
      flavor: {
        classic: 'Classic milk',
        'brown-sugar': 'Brown sugar',
        taro: 'Taro',
        strawberry: 'Strawberry',
        mango: 'Mango',
        passion: 'Passion fruit',
        lychee: 'Lychee',
        peach: 'Peach',
        osmanthus: 'Osmanthus',
        coconut: 'Coconut',
      },
      sweet: { 0: '0%', 30: '30%', 50: '50%', 70: '70%', 100: '100%' },
      topping: {
        tapioca: 'Tapioca pearls',
        popping: 'Popping boba',
        'grass-jelly': 'Grass jelly',
        'lychee-jelly': 'Lychee jelly',
        pudding: 'Egg pudding',
        'red-bean': 'Red bean',
        'cheese-foam': 'Cheese foam',
      },
    },

    surprise: {
      title: 'Want to try something new?',
      intro: 'Get an idea for a combination you might not have tried. They are suggestions, not rankings.',
      button: 'Surprise me',
      again: 'Surprise me again',
      tryIt: 'Try it in my builder',
      another: 'Another idea',
      ideas: {
        'osmanthus-oolong': "Osmanthus smells a bit like apricot and flowers, and it sits nicely on oolong's toasty base.",
        'passion-jasmine': "Tart passion fruit cuts through jasmine's perfume, and the popping boba adds little bursts.",
        'coconut-grass': 'Grass jelly is herbal and a little bitter, which balances creamy coconut.',
        'barley-bean': 'Toasty on toasty, with no caffeine. Red bean adds a soft, earthy sweetness.',
        'mango-green': 'Ripe mango over a grassy green tea. Lychee jelly keeps it light.',
        'peach-oolong': 'Peach and oolong share a soft, fruity-roasted note that many people find easy to like.',
        'taro-pudding': 'Taro tastes nutty and a little like vanilla. Egg pudding makes it feel like dessert.',
        'strawberry-foam': 'Sweet strawberry under salty, creamy foam. It sounds odd, and the contrast is the point.',
        'lychee-jasmine': 'Two perfumed flavors together, with grass jelly to ground them.',
        'osmanthus-barley': 'A gentle, caffeine-free cup that is floral, toasty and a little sweet.',
      },
    },

    survey: {
      title: 'Five quick questions',
      intro: 'About a minute. Every question is optional, and it is anonymous.',
      lead: 'Answer any question you like. Skipping is fine.',

      q: {
        taste: {
          title: 'Which flavor direction sounds best right now?',
          explain: 'The flavor direction people reach for first.',
          options: {
            roasted: 'Roasted and toasty',
            floral: 'Floral and light',
            fruity: 'Fruity and bright',
            creamy: 'Creamy and sweet',
            earthy: 'Earthy and grassy',
          },
        },
        sweetness: {
          title: 'How sweet do you usually order your drink?',
          explain: 'Sweetness is one of the biggest differences between people.',
          options: {
            0: 'Not sweet (0%)',
            30: 'Lightly (30%)',
            50: 'Half (50%)',
            70: 'Sweet (70%)',
            100: 'Full sweet (100%)',
          },
        },
        texture: {
          title: 'Which texture matters most to you?',
          explain: 'Texture is a big reason people love or skip boba.',
          options: {
            chewy: 'Chewy, like pearls',
            jelly: 'Soft and jiggly, like jelly',
            creamy: 'Creamy, like milk foam',
            fruity: 'Juicy, like fruit pieces',
            smooth: 'Smooth, no toppings',
          },
        },
        adventure: {
          title: 'You see a flavor on the menu you have never heard of. You...',
          explain: 'How willing people are to try an unfamiliar flavor.',
          options: {
            skip: 'Stick with what I know',
            ask: 'Ask what it tastes like first',
            try: 'Order it',
            seek: 'Hope to find something like it',
          },
        },
        travel: {
          title: 'When you travel, how often do you try local food or drinks you cannot name?',
          explain: 'A quick read on openness to new experiences.',
          options: {
            rarely: 'Rarely',
            sometimes: 'Sometimes',
            often: 'Often',
            always: 'Almost always',
          },
        },
      },

      region: {
        title: 'Which part of the world do you live in?',
        optional: ' (optional)',
        hint: 'Optional. It only adds to broad regional totals.',
        preferNot: 'Prefer not to say',
      },
      regions: {
        'east-asia': 'East Asia',
        'southeast-asia': 'Southeast Asia',
        'south-asia': 'South Asia',
        'central-asia': 'Central Asia and Caucasus',
        mena: 'Middle East and North Africa',
        'sub-saharan': 'Sub-Saharan Africa',
        europe: 'Europe',
        'north-america': 'North America',
        'latin-america': 'Latin America and Caribbean',
        oceania: 'Oceania',
      },

      shareDrink: 'Also add the drink I built to the totals',
      shareHint: 'Optional. It only adds to counts like "how many people chose oolong".',
      honeypot: 'Leave this empty',
      privacy: "No names, emails or exact locations. Only totals are saved, so nobody's individual answers exist anywhere.",
      submit: 'Send my answers',
      sending: 'Sending...',
      needOne: 'Pick at least one answer, or tick the box to share your drink.',

      thanksTitle: 'Thanks, your cup is in.',
      thanksWithDrink: 'Your answers and your drink were added to the totals.',
      thanksAnswers: 'Your answers were added to the totals.',
      thanksNote: 'Nothing about you was saved, only the totals went up.',
      seeResults: 'See the results',
      answerAgain: 'Someone else is here? Answer again',
      alreadyAnswered: 'This browser has already sent answers. If you are someone else, welcome! If it is you again, there is no need: it would count twice in the totals.',

      // The server sends a short code; the site shows the matching message here.
      errors: {
        generic: 'Something went wrong. Please try again.',
        network: 'Could not reach the server. Check your connection and try again.',
        storage_not_configured: 'Survey storage is not switched on yet, so this answer was not saved.',
        too_large: 'Request is too large.',
        bad_json: 'Something went wrong. Please try again.',
        invalid_submission: 'Something went wrong. Please try again.',
        save_failed: 'Could not save your answers. Please try again.',
        rate_limited: 'Several answers have already come from this network today, so new ones are paused to keep the results fair. Please try again tomorrow.',
      },
    },

    results: {
      title: 'What people picked',
      intro: 'Totals from everyone who has answered, updated as new answers come in.',
      loading: 'Loading results...',
      takeSurvey: 'Take the survey',
      showDemo: 'Preview with demo data',
      hideDemo: 'Hide the demo',

      loadErrorTitle: 'Results are not loading right now',
      loadErrorText: 'Check your connection and reload the page. Your answers are safe.',
      notOnTitle: 'Results are not switched on yet',
      notOnText: 'The survey is not collecting answers yet, so there is nothing to show. Check back soon.',
      notEnoughTitle: 'Not enough answers yet',
      notEnoughText: "Charts appear after {min} people answer, so no single person's choices can be picked out. Be one of them.",
      meterAria: '{total} of {min} responses so far',
      meterText: '{total} of {min} responses so far',

      demoTitle: 'Demo data',
      demoText: 'These numbers are made up to show how results will look. They are not from real people.',
      headingTaste: 'About taste',
      headingDrinks: 'About the drinks',
      headingRegions: 'Across regions',
      headingTasteDemo: 'About taste (demo)',
      headingDrinksDemo: 'About the drinks (demo)',
      headingRegionsDemo: 'Across regions (demo)',

      summary: { one: '{count} person has answered so far.', other: '{count} people have answered so far.' },
      summaryMine: ' Your own choices are marked "You".',
      caveat: 'These results come from people who chose to answer, mostly people who found this page. They are a snapshot, not a study of everyone.',

      you: 'You',
      yourRegion: 'Your region',
      chartEmpty: 'Not enough answers to show this one yet.',
      mostCommon: 'Most common: {label} ({percent}%).',
      answeredQuestion: { one: '{count} person answered this question.', other: '{count} people answered this question.' },
      noToppings: 'No toppings',

      drinksNotEnough: 'Drink charts appear once {min} people share their drink ({n} so far).',
      teaTitle: 'Tea bases people built',
      teaExplain: "The tea under everyone's drink.",
      flavorTitle: 'Flavors people built',
      flavorExplain: 'Which flavors showed up most.',
      sweetTitle: 'Sweetness people chose',
      sweetExplain: 'How sweet the shared drinks were.',
      toppingTitle: 'Toppings people added',
      toppingExplain: 'Each drink can have up to three, so these add up to more than 100%.',

      regionIntro: "People who chose to answer, grouped by the broad part of the world they said they live in. A region is a huge and varied place, and these are small snapshots of this survey's participants. They are not a statement about any country or culture.",
      regionEmpty: 'Regional comparisons appear once at least {min} people from a region have answered the same question. Smaller groups are never shown, so no one can be picked out.',
      regionExplain: 'Each region shows the share of its own participants who chose each answer.',
      regionNote: 'Only regions with at least {min} answers to this question are shown. Percentages are rounded.',
      regionPeople: { one: '{count} person answered', other: '{count} people answered' },
      regionOther: 'Other regions combined',
      demoRegionA: 'Region A (demo)',
      demoRegionB: 'Region B (demo)',
    },

    about: {
      title: 'Why Boba Lab exists',
      p1: 'Boba Lab is a personal project about taste. I love boba, and I am curious why one person wants a fully sweet brown sugar milk tea while another wants unsweetened jasmine with grass jelly.',
      p2: 'Boba is enjoyed in many places and in many ways. When you answer, you add your cup to the picture, from wherever you are.',
      p3: 'The survey asks for no names or emails. The one place-related question is optional and broad: a part of the world such as "Europe" or "Central Asia and Caucasus", never a country or a city. The site saves only totals, like how many people picked chewy textures, so no one\'s individual answers exist anywhere. Your language choice is remembered only on your own device.',
      p4: 'The results come from people who choose to answer, so treat them as a conversation, not a study. The more people take part, the more interesting the picture gets.',
      ctaSurvey: 'Take the survey',
      share: 'Share Boba Lab',
      shareText: "Build a boba and see how your taste compares with other people's.",
      linkCopied: 'Link copied.',
      copyThisLink: 'Copy this link: {url}',
    },
  },

  // Grammar helpers. English puts the flavor before the tea ("Taro oolong tea").
  // Other languages can build names differently (for example Russian
  // "Улун с таро"), so each language may provide its own version of these.
  //   L.tea(id), L.flavor(id), L.topping(id) return the display names.
  grammar: {
    drinkName(drink, L) {
      return `${L.flavor(drink.flavor)} ${L.tea(drink.tea).toLowerCase()}`;
    },
    // "50% sweet, with tapioca pearls and cheese foam"
    orderDetails(drink, L) {
      const names = drink.toppings.map((id) => L.topping(id)).filter(Boolean).map((n) => n.toLowerCase());
      const sweet = `${drink.sweet}% sweet`;
      if (names.length === 0) return `${sweet}, no toppings`;
      const list = names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      return `${sweet}, with ${list}`;
    },
  },
};
