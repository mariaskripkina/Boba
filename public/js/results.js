// The results section: bar charts built from the real totals.
//
// Data integrity rules this file follows:
//   1. Real charts only ever show numbers that came from /api/results.
//   2. If there is not enough real data, we say so. We never fill the gap.
//   3. The "demo" preview uses made-up numbers and is labeled DEMO everywhere
//      it appears, so nobody can mistake it for real findings.
//
// Language: the numbers always arrive keyed by internal ids ("try", "europe").
// Only the labels you read are translated, so switching language never changes
// a number. The charts are simply drawn again.

import { h, local } from './dom.js';
import { QUESTIONS, COMPARE_QUESTIONS } from './schema.js';
import { TEAS, FLAVORS, SWEETNESS, TOPPINGS } from './menu.js';
import { teaName, flavorName, sweetLabel, toppingName, lower } from './menu-text.js';
import { MY_ANSWERS_KEY } from './survey.js';
import { t, onLanguageChange } from './i18n/index.js';

// Made-up numbers, only ever shown behind the "Preview with demo data" button.
const DEMO = {
  configured: true, ready: true, min: 10, total: 120, drinksTotal: 80, demo: true,
  answers: {
    taste:     { roasted: 22, floral: 18, fruity: 41, creamy: 29, earthy: 10 },
    sweetness: { 0: 6, 30: 31, 50: 44, 70: 27, 100: 12 },
    texture:   { chewy: 52, jelly: 21, creamy: 19, fruity: 14, smooth: 14 },
    adventure: { skip: 17, ask: 38, try: 47, seek: 18 },
    travel:    { rarely: 9, sometimes: 33, often: 49, always: 29 },
  },
  drinks: {
    tea:     { black: 20, green: 14, oolong: 19, jasmine: 17, barley: 10 },
    flavor:  { classic: 12, 'brown-sugar': 16, taro: 9, strawberry: 8, mango: 7, passion: 5, lychee: 8, peach: 6, osmanthus: 4, coconut: 5 },
    sweet:   { 0: 4, 30: 21, 50: 28, 70: 17, 100: 10 },
    topping: { tapioca: 36, popping: 14, 'grass-jelly': 9, 'lychee-jelly': 12, pudding: 11, 'red-bean': 6, 'cheese-foam': 13, none: 8 },
  },
  // Made up, and deliberately NOT using real region names: invented numbers next
  // to "Europe" or "East Asia" could be mistaken for claims about real people.
  // `labelKey` points at the (translated) "Region A (demo)" text.
  regional: {
    min: 10,
    questions: {
      sweetness: [
        { region: 'demo-a', labelKey: 'results.demoRegionA', n: 34, shares: { 0: 9, 30: 29, 50: 35, 70: 18, 100: 9 } },
        { region: 'demo-b', labelKey: 'results.demoRegionB', n: 26, shares: { 0: 4, 30: 23, 50: 38, 70: 23, 100: 12 } },
      ],
      adventure: [
        { region: 'demo-a', labelKey: 'results.demoRegionA', n: 34, shares: { skip: 12, ask: 32, try: 38, seek: 18 } },
        { region: 'demo-b', labelKey: 'results.demoRegionB', n: 26, shares: { skip: 19, ask: 31, try: 35, seek: 15 } },
      ],
    },
  },
};

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// Draw one bar chart. `rows` is [{ label, count, color?, mine? }].
// `denominator` is what the percentages are measured against.
function chart({ title, explain, rows, denominator, note, colorTop = true }) {
  const max = Math.max(...rows.map((r) => r.count), 0);
  const topCount = max;
  const enough = rows.some((r) => r.count > 0);

  const body = enough
    ? h('ul', { class: 'bars' },
        rows.map((row) => {
          const share = percent(row.count, denominator);
          const isTop = colorTop && row.count === topCount && topCount > 0;
          return h('li', { class: `bar${isTop ? ' bar--top' : ''}` },
            h('span', { class: 'bar__label' },
              row.label,
              row.mine ? h('span', { class: 'bar__you' }, t('results.you')) : null,
            ),
            h('span', { class: 'bar__track', 'aria-hidden': 'true' },
              h('span', { class: 'bar__fill', style: { '--w': `${Math.max(share, row.count ? 2 : 0)}%`, ...(row.color ? { '--bar': row.color } : {}) } }),
            ),
            h('span', { class: 'bar__value' }, `${share}%`, h('span', { class: 'bar__count' }, ` (${row.count})`)),
          );
        }),
      )
    : h('p', { class: 'chart__empty' }, t('results.chartEmpty'));

  const top = rows.find((r) => r.count === topCount && topCount > 0);
  const takeaway = enough && top
    ? h('p', { class: 'chart__takeaway' }, t('results.mostCommon', { label: lower(top.label), percent: percent(top.count, denominator) }))
    : null;

  return h('figure', { class: 'chart' },
    h('figcaption', {}, h('h3', {}, title), h('p', {}, explain)),
    body,
    takeaway,
    note ? h('p', { class: 'chart__note' }, note) : null,
  );
}

function questionCharts(data, mine) {
  return QUESTIONS.map((q) => {
    const counts = data.answers[q.id] || {};
    const denominator = Object.values(counts).reduce((a, b) => a + b, 0);
    return chart({
      title: t(`survey.q.${q.id}.title`),
      explain: t(`survey.q.${q.id}.explain`),
      denominator,
      rows: q.options.map((o) => ({
        label: t(`survey.q.${q.id}.options.${o.value}`),
        count: counts[o.value] || 0,
        mine: mine?.answers?.[q.id] === o.value,
      })),
      note: denominator ? t('results.answeredQuestion', { count: denominator }) : null,
    });
  });
}

function drinkCharts(data, mine) {
  const d = data.drinks;
  const n = data.drinksTotal;
  const my = mine?.drink;
  const enough = n >= data.min && Object.keys(d.tea || {}).length > 0;
  if (!enough) {
    return [h('p', { class: 'chart__empty' }, t('results.drinksNotEnough', { min: data.min, n }))];
  }
  const toppingRows = [...TOPPINGS.map((x) => ({ id: x.id, label: toppingName(x.id) })), { id: 'none', label: t('results.noToppings') }];
  return [
    chart({
      title: t('results.teaTitle'),
      explain: t('results.teaExplain'),
      denominator: n,
      rows: TEAS.map((x) => ({ label: teaName(x.id), count: d.tea[x.id] || 0, color: x.color, mine: my?.tea === x.id })),
      colorTop: false,
    }),
    chart({
      title: t('results.flavorTitle'),
      explain: t('results.flavorExplain'),
      denominator: n,
      rows: FLAVORS.map((x) => ({ label: flavorName(x.id), count: d.flavor[x.id] || 0, color: x.tint, mine: my?.flavor === x.id })),
      colorTop: false,
    }),
    chart({
      title: t('results.sweetTitle'),
      explain: t('results.sweetExplain'),
      denominator: n,
      rows: SWEETNESS.map((x) => ({ label: sweetLabel(x.id), count: d.sweet[x.id] || 0, mine: my?.sweet === x.id })),
    }),
    chart({
      title: t('results.toppingTitle'),
      explain: t('results.toppingExplain'),
      denominator: n,
      rows: toppingRows.map((x) => ({
        label: x.label,
        count: d.topping[x.id] || 0,
        mine: my ? (x.id === 'none' ? my.toppings.length === 0 : my.toppings.includes(x.id)) : false,
      })),
    }),
  ];
}

// ---- regional comparisons -----------------------------------------------------
//
// The server only sends a region when at least `min` people from it answered
// that question, and only as whole-number percentages. This code never
// recomputes or "fills in" anything: if a group is not in the data, it is not drawn.

function regionLabel(group) {
  if (group.labelKey) return t(group.labelKey); // demo groups: made-up "Region A (demo)"
  if (group.region === 'other') return t('results.regionOther');
  return t(`survey.regions.${group.region}`);
}

function regionBlock(question, group, mine) {
  return h('div', { class: 'region-block' },
    h('h4', {},
      regionLabel(group),
      mine?.region && mine.region === group.region ? h('span', { class: 'bar__you' }, t('results.yourRegion')) : null,
    ),
    h('p', { class: 'region-block__n' }, t('results.regionPeople', { count: group.n })),
    h('ul', { class: 'bars' },
      question.options.map((option) => {
        const share = group.shares[option.value] || 0;
        return h('li', { class: 'bar' },
          h('span', { class: 'bar__label' }, t(`survey.q.${question.id}.options.${option.value}`)),
          h('span', { class: 'bar__track', 'aria-hidden': 'true' },
            h('span', { class: 'bar__fill', style: { '--w': `${Math.max(share, share ? 2 : 0)}%` } })),
          h('span', { class: 'bar__value' }, `${share}%`),
        );
      }),
    ),
  );
}

function regionalCharts(data, mine) {
  const regional = data.regional;
  const min = regional?.min ?? data.min;
  const compared = COMPARE_QUESTIONS
    .map((id) => ({ question: QUESTIONS.find((q) => q.id === id), groups: regional?.questions?.[id] }))
    .filter((item) => item.question && item.groups && item.groups.length > 0);

  const intro = h('p', { class: 'regional__intro' }, t('results.regionIntro'));

  if (compared.length === 0) {
    return [intro, h('p', { class: 'chart__empty regional__empty' }, t('results.regionEmpty', { min }))];
  }

  return [
    intro,
    ...compared.map(({ question, groups }) =>
      h('figure', { class: 'chart chart--regional' },
        h('figcaption', {}, h('h3', {}, t(`survey.q.${question.id}.title`)),
          h('p', {}, t('results.regionExplain'))),
        h('div', { class: 'region-blocks' }, groups.map((group) => regionBlock(question, group, mine))),
        h('p', { class: 'chart__note' }, t('results.regionNote', { min })),
      ),
    ),
  ];
}

export function initResults() {
  const root = document.getElementById('results-root');
  let mode = 'live';
  let live = null;

  async function load() {
    root.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/results', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('bad status');
      live = await response.json();
    } catch {
      live = { error: true };
    }
    root.removeAttribute('aria-busy');
    render();
  }

  function demoToggle(active) {
    return h('button', {
      type: 'button',
      class: 'btn btn--quiet',
      'aria-pressed': String(active),
      onclick: () => { mode = active ? 'live' : 'demo'; render(); },
    }, active ? t('results.hideDemo') : t('results.showDemo'));
  }

  function pearlMeter(total, min) {
    return h('ol', { class: 'pearl-meter', 'aria-label': t('results.meterAria', { total, min }) },
      Array.from({ length: min }, (_, i) => h('li', { class: i < total ? 'is-filled' : '' })));
  }

  function emptyState(title, text, extra) {
    return h('div', { class: 'empty' },
      h('h3', {}, title),
      h('p', {}, text),
      extra,
      h('div', { class: 'empty__actions' },
        h('a', { class: 'btn btn--primary', href: '#survey' }, t('results.takeSurvey')),
        demoToggle(false),
      ),
    );
  }

  function render() {
    const mine = local.get(MY_ANSWERS_KEY);

    if (mode === 'demo') {
      root.replaceChildren(
        h('div', { class: 'demo-banner', role: 'note' },
          h('strong', {}, t('results.demoTitle')),
          h('p', {}, t('results.demoText')),
          demoToggle(true),
        ),
        h('div', { class: 'charts charts--demo' },
          h('h3', { class: 'charts__heading' }, t('results.headingTasteDemo')),
          questionCharts(DEMO, null),
          h('h3', { class: 'charts__heading' }, t('results.headingDrinksDemo')),
          drinkCharts(DEMO, null),
          h('h3', { class: 'charts__heading' }, t('results.headingRegionsDemo')),
          regionalCharts(DEMO, null),
        ),
      );
      return;
    }

    if (!live) {
      root.replaceChildren(h('p', { class: 'loading' }, t('results.loading')));
      return;
    }

    if (live.error) {
      root.replaceChildren(emptyState(t('results.loadErrorTitle'), t('results.loadErrorText')));
      return;
    }

    if (!live.configured) {
      root.replaceChildren(emptyState(t('results.notOnTitle'), t('results.notOnText')));
      return;
    }

    if (!live.ready) {
      root.replaceChildren(
        emptyState(
          t('results.notEnoughTitle'),
          t('results.notEnoughText', { min: live.min }),
          h('div', { class: 'meter' }, pearlMeter(live.total, live.min), h('p', {}, t('results.meterText', { total: live.total, min: live.min }))),
        ),
      );
      return;
    }

    root.replaceChildren(
      h('p', { class: 'results__summary' },
        t('results.summary', { count: live.total }),
        mine ? t('results.summaryMine') : ''),
      h('div', { class: 'charts' },
        h('h3', { class: 'charts__heading' }, t('results.headingTaste')),
        questionCharts(live, mine),
        h('h3', { class: 'charts__heading' }, t('results.headingDrinks')),
        drinkCharts(live, mine),
        h('h3', { class: 'charts__heading' }, t('results.headingRegions')),
        regionalCharts(live, mine),
      ),
      h('p', { class: 'results__caveat' }, t('results.caveat')),
    );
  }

  document.addEventListener('boba:submitted', load);
  // New language: draw the charts again from the numbers we already have.
  onLanguageChange(render);
  render();
  load();
}
