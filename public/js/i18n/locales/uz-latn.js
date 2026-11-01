// Oʻzbekcha, Latin script (Uzbek). Complete translation of every message in en.js.
//
// Style decisions (approved, see docs/translations.md):
//   - natural, youthful, friendly wording; "siz" where direct address is needed;
//     never stiff or bureaucratic
//   - "boba" in short headings and buttons, "bubble tea" in descriptive text
//   - NEVER put Uzbek endings on "boba", "bubble tea" or "Boba Lab" (no bobani, bobangiz):
//     reword the sentence so the word stays bare
//   - "topping" / "toppinglar" (not qoʻshimcha)
//   - quotes are «shu shaklda»
//
// Letters (important): Uzbek Latin has TWO different marks, and neither is a
// plain keyboard apostrophe:
//   ʻ  U+02BB  in oʻ and gʻ        (for example: oʻz, koʻrsating, gʻoya)
//   ʼ  U+02BC  the "tutuq belgisi"  (for example: taʼm, maʼlumot)
// A test fails if a plain apostrophe or curly quote sneaks into this file.
//
// Drink names are not word-for-word ("Taroli oolong choyi"), so this file has its
// own small naming rules in `grammar` at the bottom.

export default {
  messages: {
    meta: {
      title: 'Boba Lab: bubble tea tayyorlang va taʼmlarni solishtiring',
      description: 'Oʻzingizga yoqqan bubble tea tayyorlang, qisqa anonim soʻrovnomada qatnashing va taʼmingiz boshqalarnikiga qanchalik mos kelishini bilib oling.',
      ogTitle: 'Boba Lab',
      ogDescription: 'Boba tayyorlang va taʼmingiz boshqalarnikiga qanchalik mos kelishini koʻring.',
    },

    lang: { label: 'Til' },

    page: {
      skip: 'Tayyorlash boʻlimiga oʻtish',
      brandAria: 'Boba Lab, tepaga qaytish',
      noscript: 'Boba Lab ishlashi uchun JavaScript kerak: usiz ichimlik tayyorlab ham, soʻrovnomada qatnashib ham boʻlmaydi. Uni yoqing va sahifani yangilang.',
      footer: 'Boba Lab, {year}. Qiziqish va koʻp choy bilan yaratilgan.',
    },

    nav: {
      label: 'Asosiy menyu',
      build: 'Tayyorlash',
      survey: 'Soʻrovnoma',
      results: 'Natijalar',
      about: 'Loyiha haqida',
    },

    hero: {
      title: 'Stakanda nima bor?',
      lead: 'Choy, taʼm, topping: oʻzingizga yoqqanini tanlang. Keyin boshqalar nimani tanlaganini koʻring.',
      ctaBuild: 'Boba tayyorlang',
      ctaSurvey: 'Soʻrovnomada qatnashing',
      cupButtonAria: 'Stakanni silkitish',
      hint: 'Silkitish uchun stakanni bosing',
    },

    builder: {
      title: 'Boba tayyorlang',
      intro: 'Oʻzingiz xohlaganicha tanlang. Har bir tanlov bilan stakan ham oʻzgaradi.',
      previewAria: 'Sizning ichimligingiz',
      groupTea: 'Choy asosi',
      groupFlavor: 'Taʼm',
      groupSweetness: 'Shirinlik',
      groupToppings: 'Toppinglar',
      toppingsHint: 'Eng koʻpi bilan {max} ta tanlang.',
      detail: '{sweet} shirin, {toppings}',
      noToppings: 'topping yoʻq',
      copy: 'Buyurtmani nusxalash',
      copied: 'Nusxalandi',
      copiedStatus: 'Nusxalandi: {text}',
      copyFailed: 'Nusxalab boʻlmadi. Yuqoridagi matnni oʻzingiz belgilang.',
    },

    menu: {
      tea: {
        black: 'Qora choy',
        green: 'Yashil choy',
        oolong: 'Oolong choyi',
        jasmine: 'Yasminli yashil choy',
        barley: 'Arpa choyi',
      },
      flavor: {
        classic: 'Klassik sut',
        'brown-sugar': 'Jigarrang shakar',
        taro: 'Taro',
        strawberry: 'Qulupnay',
        mango: 'Mango',
        passion: 'Marakuya',
        lychee: 'Lichi',
        peach: 'Shaftoli',
        osmanthus: 'Osmantus',
        coconut: 'Kokos',
      },
      sweet: { 0: '0%', 30: '30%', 50: '50%', 70: '70%', 100: '100%' },
      topping: {
        tapioca: 'Tapioka sharchalari',
        popping: 'Sharbatli boba',
        'grass-jelly': 'Giyohli jele',
        'lychee-jelly': 'Lichi jelesi',
        pudding: 'Tuxumli puding',
        'red-bean': 'Qizil loviya',
        'cheese-foam': 'Pishloqli koʻpik',
      },
    },

    surprise: {
      title: 'Yangi narsani sinab koʻrmoqchimisiz?',
      intro: 'Hali sinamagan boʻlishingiz mumkin boʻlgan kombinatsiya gʻoyasini oling. Bular tavsiyalar, reyting emas.',
      button: 'Ajablantirib yuboring',
      again: 'Yana ajablantiring',
      tryIt: 'Tayyorlashda sinab koʻrish',
      another: 'Boshqa gʻoya',
      ideas: {
        'osmanthus-oolong': 'Osmantus biroz oʻrik va gullarga oʻxshab hid taratadi va oolongning qovurilgan asosiga yaxshi mos tushadi.',
        'passion-jasmine': 'Nordon marakuya yasmin atrini kesib oʻtadi, sharbatli boba esa kichik portlashlar qoʻshadi.',
        'coconut-grass': 'Giyohli jele oʻtsimon va biroz achchiq, bu esa qaymoqli kokosni muvozanatga keltiradi.',
        'barley-bean': 'Qovurilgan ustiga qovurilgan taʼm, kofeinsiz. Qizil loviya yumshoq, tuproqsimon shirinlik qoʻshadi.',
        'mango-green': 'Pishgan mango oʻtsimon yashil choy ustida. Lichi jelesi uni yengil qiladi.',
        'peach-oolong': 'Shaftoli va oolongda yumshoq, mevali-qovurilgan umumiy nota bor, uni koʻpchilik yoqtiradi.',
        'taro-pudding': 'Taro yongʻoqsimon va biroz vanilga oʻxshaydi. Tuxumli puding uni desertga aylantiradi.',
        'strawberry-foam': 'Shoʻr, qaymoqli koʻpik ostidagi shirin qulupnay. Gʻalati tuyuladi, lekin aynan kontrast asosiy gʻoya.',
        'lychee-jasmine': 'Ikki xushboʻy taʼm birga, giyohli jele esa ularni yerga bogʻlab turadi.',
        'osmanthus-barley': 'Mayin, kofeinsiz ichimlik: gulli, qovurilgan va biroz shirin.',
      },
    },

    survey: {
      title: 'Beshta tezkor savol',
      intro: 'Taxminan bir daqiqa. Har bir savol ixtiyoriy, hammasi anonim.',
      lead: 'Istagan savolingizga javob bering. Oʻtkazib yuborsangiz ham boʻladi.',

      q: {
        taste: {
          title: 'Hozir qaysi taʼm yoʻnalishi sizga koʻproq yoqadi?',
          explain: 'Odamlar birinchi boʻlib qaysi taʼmga qoʻl uzatishadi.',
          options: {
            roasted: 'Qovurilgan, tostga oʻxshash',
            floral: 'Gulli va yengil',
            fruity: 'Mevali va yorqin',
            creamy: 'Qaymoqli va shirin',
            earthy: 'Tuproqli va oʻtsimon',
          },
        },
        sweetness: {
          title: 'Ichimlikni odatda qanchalik shirin qilib buyurtma berasiz?',
          explain: 'Shirinlik odamlar orasidagi eng katta farqlardan biri.',
          options: {
            0: 'Shirin emas (0%)',
            30: 'Yengil (30%)',
            50: 'Yarim (50%)',
            70: 'Shirin (70%)',
            100: 'Toʻla shirin (100%)',
          },
        },
        texture: {
          title: 'Qaysi tuzilma siz uchun eng muhim?',
          explain: 'Tuzilma boba sevilishi yoki oʻtkazib yuborilishining katta sabablaridan biri.',
          options: {
            chewy: 'Elastik, sharchalardek',
            jelly: 'Yumshoq va titrab turadigan, jeledek',
            creamy: 'Qaymoqli, sut koʻpigidek',
            fruity: 'Sersuv, meva boʻlaklaridek',
            smooth: 'Silliq, topping yoʻq',
          },
        },
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
        travel: {
          title: 'Sayohat paytida nomini bilmaydigan mahalliy taom yoki ichimliklarni qanchalik tez-tez sinab koʻrasiz?',
          explain: 'Yangi tajribalarga ochiqlikning tezkor oʻlchovi.',
          options: {
            rarely: 'Kamdan-kam',
            sometimes: 'Baʼzan',
            often: 'Tez-tez',
            always: 'Deyarli har doim',
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

      shareDrink: 'Tayyorlagan ichimligimni ham umumiy hisobga qoʻshish',
      shareHint: 'Majburiy emas. Bu faqat «necha kishi oolong tanlagan» kabi hisoblarga qoʻshiladi.',
      honeypot: 'Buni boʻsh qoldiring',
      privacy: 'Ism, email va aniq joylashuv soʻralmaydi. Javoblar faqat umumiy hisobga qoʻshiladi, shuning uchun alohida javoblar saqlanmaydi. Takroriy yuborishning oldini olish uchun tarmoq manzilingizdan (IP) hosil qilingan oʻqib boʻlmaydigan kod (manzilning oʻzi emas) 24 soatgacha saqlanadi, keyin oʻchiriladi. Hosting xizmati Vercel ham, har qanday hosting kabi, tarmoq manzilingizni oʻzi qayta ishlashi mumkin. Batafsil maʼlumot «Loyiha haqida» boʻlimida.',
      submit: 'Javoblarni yuborish',
      sending: 'Yuborilmoqda...',
      needOne: 'Kamida bitta javobni tanlang yoki ichimligingizni ulashish katagini belgilang.',

      thanksTitle: 'Rahmat, stakaningiz qoʻshildi.',
      thanksWithDrink: 'Javoblaringiz va ichimligingiz umumiy hisobga qoʻshildi.',
      thanksAnswers: 'Javoblaringiz umumiy hisobga qoʻshildi.',
      thanksNote: 'Alohida javoblaringiz saqlanmadi, faqat umumiy hisob oshdi.',
      seeResults: 'Natijalarni koʻrish',
      answerAgain: 'Boshqa odam bormi? Yana javob bering',
      alreadyAnswered: 'Bu brauzerdan javoblar allaqachon yuborilgan. Agar siz boshqa odam boʻlsangiz, xush kelibsiz! Agar yana oʻzingiz boʻlsangiz, hojat yoʻq: umumiy hisobda ikki marta sanalardi.',

      errors: {
        generic: 'Nimadir xato ketdi. Qayta urinib koʻring.',
        network: 'Serverga ulanib boʻlmadi. Internet aloqangizni tekshirib, qayta urinib koʻring.',
        storage_not_configured: 'Soʻrovnoma xotirasi hali yoqilmagan, shuning uchun bu javob saqlanmadi.',
        too_large: 'Soʻrov juda katta.',
        bad_json: 'Nimadir xato ketdi. Qayta urinib koʻring.',
        invalid_submission: 'Nimadir xato ketdi. Qayta urinib koʻring.',
        save_failed: 'Javoblarni saqlab boʻlmadi. Qayta urinib koʻring.',
        rate_limited: 'Bugun bu tarmoqdan bir nechta javob kelib boʻldi, shuning uchun natijalar adolatli boʻlishi uchun yangilari vaqtincha toʻxtatilgan. Ertaga qayta urinib koʻring.',
      },
    },

    results: {
      title: 'Odamlar nimani tanlagan',
      intro: 'Javob bergan hamma odamlarning umumiy hisobi. Yangi javoblar kelgan sari yangilanadi.',
      loading: 'Natijalar yuklanmoqda...',
      takeSurvey: 'Soʻrovnomada qatnashing',
      showDemo: 'Demo maʼlumotlar bilan koʻrish',
      hideDemo: 'Demoni yashirish',

      loadErrorTitle: 'Natijalar hozir yuklanmayapti',
      loadErrorText: 'Internet aloqangizni tekshirib, sahifani yangilang. Javoblaringiz xavfsiz.',
      notOnTitle: 'Natijalar hali yoqilmagan',
      notOnText: 'Soʻrovnoma hali javob yigʻmayapti, shuning uchun koʻrsatadigan narsa yoʻq. Birozdan keyin qaytib keling.',
      notEnoughTitle: 'Javoblar hali yetarli emas',
      notEnoughText: 'Diagrammalar {min} kishi javob bergandan keyin chiqadi, shunda hech kimning tanlovini ajratib boʻlmaydi. Ulardan biri boʻling.',
      meterAria: 'Hozircha {total} / {min} ta javob',
      meterText: 'Hozircha {total} / {min} ta javob',

      demoTitle: 'Demo maʼlumotlar',
      demoText: 'Bu raqamlar natijalar qanday koʻrinishini koʻrsatish uchun oʻylab topilgan. Ular haqiqiy odamlardan olinmagan.',
      headingTaste: 'Taʼm haqida',
      headingDrinks: 'Ichimliklar haqida',
      headingRegions: 'Hududlar kesimida',
      headingTasteDemo: 'Taʼm haqida (demo)',
      headingDrinksDemo: 'Ichimliklar haqida (demo)',
      headingRegionsDemo: 'Hududlar kesimida (demo)',

      summary: {
        one: 'Hozircha {count} kishi javob bergan.',
        other: 'Hozircha {count} kishi javob bergan.',
      },
      summaryMine: ' Oʻz tanlovlaringiz «Siz» deb belgilangan.',
      caveat: 'Bu natijalar javob berishni tanlagan odamlardan, asosan shu sahifani topganlardan olingan. Bu bir lahzalik koʻrinish, hamma odamlar haqidagi tadqiqot emas.',

      you: 'Siz',
      yourRegion: 'Sizning hududingiz',
      chartEmpty: 'Buni koʻrsatish uchun javoblar hali yetarli emas.',
      mostCommon: 'Eng koʻp tanlangani: {label} ({percent}%).',
      answeredQuestion: {
        one: '{count} kishi bu savolga javob bergan.',
        other: '{count} kishi bu savolga javob bergan.',
      },
      noToppings: 'Topping yoʻq',

      drinksNotEnough: 'Ichimlik diagrammalari {min} kishi ichimligini ulashgach chiqadi (hozircha {n} ta).',
      teaTitle: 'Tanlangan choy asoslari',
      teaExplain: 'Har bir ichimlik asosidagi choy.',
      flavorTitle: 'Tanlangan taʼmlar',
      flavorExplain: 'Qaysi taʼmlar koʻproq uchradi.',
      sweetTitle: 'Tanlangan shirinlik',
      sweetExplain: 'Ulashilgan ichimliklar qanchalik shirin edi.',
      toppingTitle: 'Qoʻshilgan toppinglar',
      toppingExplain: 'Har bir ichimlikka uchtagacha topping qoʻshish mumkin, shuning uchun yigʻindi 100% dan koʻp boʻladi.',

      regionIntro: 'Javob berishni tanlagan odamlar ular yashaydigan dunyoning yirik qismlari boʻyicha guruhlangan. Hudud juda katta va xilma-xil joy, bu yerda esa shu soʻrovnoma ishtirokchilarining kichik koʻrinishlari bor. Bu biror davlat yoki madaniyat haqida fikr emas.',
      regionEmpty: 'Hududlar boʻyicha taqqoslash hududdan kamida {min} kishi bir xil savolga javob bergach paydo boʻladi. Kichikroq guruhlar hech qachon koʻrsatilmaydi, shunda hech kimni ajratib boʻlmaydi.',
      regionExplain: 'Har bir hudud oʻz ishtirokchilarining har bir javobni tanlagan ulushini koʻrsatadi.',
      regionNote: 'Faqat shu savolga kamida {min} ta javob kelgan hududlar koʻrsatiladi. Foizlar yaxlitlangan.',
      regionPeople: {
        one: '{count} kishi javob bergan',
        other: '{count} kishi javob bergan',
      },
      regionOther: 'Boshqa hududlar birgalikda',
      demoRegionA: 'A hudud (demo)',
      demoRegionB: 'B hudud (demo)',
    },

    about: {
      title: 'Boba Lab nega mavjud',
      p1: 'Boba Lab taʼm haqidagi shaxsiy loyiha. Boba menga juda yoqadi, va nega bir kishi toʻla shirin jigarrang shakarli sutli choy istasa, boshqasi shirinliksiz yasmin choyini giyohli jele bilan xohlashi qiziq.',
      p2: 'Boba koʻp joylarda va turli usullarda sevib ichiladi. Javob berganingizda siz oʻz stakaningizni umumiy manzaraga qoʻshasiz, qayerda boʻlsangiz ham.',
      p3: 'Soʻrovnomada ism ham, email ham soʻralmaydi. Joyga oid yagona savol ixtiyoriy va keng: dunyoning bir qismi, masalan «Yevropa» yoki «Markaziy Osiyo va Kavkaz», hech qachon davlat yoki shahar emas. Sayt javoblarni umumiy hisobga qoʻshadi, masalan nechta odam elastik tuzilmani tanlagani, shuning uchun alohida javoblar saqlanmaydi. Takroriy yuborishning oldini olish uchun u yana tarmoq manzilingizdan hosil qilingan oʻqib boʻlmaydigan kodni (manzilning oʻzini emas) 24 soatgacha saqlaydi va keyin oʻchiradi. Bu kod javoblaringiz bilan bogʻlanmagan. Boba Lab tarmoq manzilingizni saqlamaydi, lekin hosting xizmati Vercel, har qanday hosting kabi, uni qabul qiladi va oʻz qoidalariga koʻra qayta ishlashi mumkin. Tanlagan tilingiz va oʻz javoblaringiz («Siz» belgisi uchun) faqat oʻz qurilmangizda eslab qolinadi.',
      p4: 'Natijalar javob berishni tanlagan odamlardan olinadi, shuning uchun ularni tadqiqot emas, suhbat deb qabul qiling. Koʻproq odam qatnashsa, manzara qiziqarliroq boʻladi.',
      ctaSurvey: 'Soʻrovnomada qatnashing',
      share: 'Doʻstlarga ulashing',
      shareText: 'Boba tayyorlang va taʼmingiz boshqalarnikiga qanchalik mos kelishini koʻring.',
      linkCopied: 'Havola nusxalandi.',
      copyThisLink: 'Bu havolani nusxalang: {url}',
    },
  },

  // Drink names in Uzbek are built differently from English:
  //   English "Taro oolong tea"  ->  Oʻzbekcha "Taroli oolong choyi"  (flavor + "-li", then the tea)
  grammar: {
    drinkName(drink, L) {
      const withFlavor = {
        classic: 'Sutli',
        'brown-sugar': 'Jigarrang shakarli',
        taro: 'Taroli',
        strawberry: 'Qulupnayli',
        mango: 'Mangoli',
        passion: 'Marakuyali',
        lychee: 'Lichili',
        peach: 'Shaftolili',
        osmanthus: 'Osmantusli',
        coconut: 'Kokosli',
      }[drink.flavor];
      const tea = L.tea(drink.tea).toLocaleLowerCase('uz');
      return withFlavor ? `${withFlavor} ${tea}` : L.tea(drink.tea);
    },

    // "50% shirin, tapioka sharchalari va pishloqli koʻpik bilan"
    orderDetails(drink, L) {
      const names = drink.toppings.map((id) => L.topping(id)).filter(Boolean).map((n) => n.toLocaleLowerCase('uz'));
      const sweet = `${drink.sweet}% shirin`;
      if (names.length === 0) return `${sweet}, topping yoʻq`;
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} va ${names[names.length - 1]}`;
      return `${sweet}, ${list} bilan`;
    },
  },
};
