// The results section: bar charts built from the real totals.
//
// Data integrity rules this file follows:
//   1. Real charts only ever show numbers that came from /api/results.
//   2. If there is not enough real data, we say so. We never fill the gap.
//   3. The "demo" preview uses made-up numbers and is labeled DEMO everywhere
//      it appears, so nobody can mistake it for real findings.

import { h, local } from './dom.js';
import { QUESTIONS, REGIONS, COMPARE_QUESTIONS } from './schema.js';
import { TEAS, FLAVORS, SWEETNESS, TOPPINGS } from './menu.js';
import { MY_ANSWERS_KEY } from './survey.js';

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
  regional: {
    min: 10,
    questions: {
      sweetness: [
        { region: 'demo-a', label: 'Region A (demo)', n: 34, shares: { 0: 9, 30: 29, 50: 35, 70: 18, 100: 9 } },
        { region: 'demo-b', label: 'Region B (demo)', n: 26, shares: { 0: 4, 30: 23, 50: 38, 70: 23, 100: 12 } },
      ],
      adventure: [
        { region: 'demo-a', label: 'Region A (demo)', n: 34, shares: { skip: 12, ask: 32, try: 38, seek: 18 } },
        { region: 'demo-b', label: 'Region B (demo)', n: 26, shares: { skip: 19, ask: 31, try: 35, seek: 15 } },
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
              row.mine ? h('span', { class: 'bar__you' }, 'You') : null,
            ),
            h('span', { class: 'bar__track', 'aria-hidden': 'true' },
              h('span', { class: 'bar__fill', style: { '--w': `${Math.max(share, row.count ? 2 : 0)}%`, ...(row.color ? { '--bar': row.color } : {}) } }),
            ),
            h('span', { class: 'bar__value' }, `${share}%`, h('span', { class: 'bar__count' }, ` (${row.count})`)),
          );
        }),
      )
    : h('p', { class: 'chart__empty' }, 'Not enough answers to show this one yet.');

  const top = rows.find((r) => r.count === topCount && topCount > 0);
  const takeaway = enough && top
    ? h('p', { class: 'chart__takeaway' }, `Most common: ${top.label.toLowerCase()} (${percent(top.count, denominator)}%).`)
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
      title: q.title,
      explain: q.explain,
      denominator,
      rows: q.options.map((o) => ({
        label: o.label,
        count: counts[o.value] || 0,
        mine: mine?.answers?.[q.id] === o.value,
      })),
      note: denominator ? `${denominator} people answered this question.` : null,
    });
  });
}

function drinkCharts(data, mine) {
  const d = data.drinks;
  const n = data.drinksTotal;
  const my = mine?.drink;
  const enough = n >= data.min && Object.keys(d.tea || {}).length > 0;
  if (!enough) {
    return [h('p', { class: 'chart__empty' }, `Drink charts appear once ${data.min} people share their drink (${n} so far).`)];
  }
  const toppingRows = [...TOPPINGS.map((t) => ({ id: t.id, label: t.name })), { id: 'none', label: 'No toppings' }];
  return [
    chart({
      title: 'Tea bases people built',
      explain: 'The tea under everyone\'s drink.',
      denominator: n,
      rows: TEAS.map((t) => ({ label: t.name, count: d.tea[t.id] || 0, color: t.color, mine: my?.tea === t.id })),
      colorTop: false,
    }),
    chart({
      title: 'Flavors people built',
      explain: 'Which flavors showed up most.',
      denominator: n,
      rows: FLAVORS.map((f) => ({ label: f.name, count: d.flavor[f.id] || 0, color: f.tint, mine: my?.flavor === f.id })),
      colorTop: false,
    }),
    chart({
      title: 'Sweetness people chose',
      explain: 'How sweet the shared drinks were.',
      denominator: n,
      rows: SWEETNESS.map((s) => ({ label: s.label, count: d.sweet[s.id] || 0, mine: my?.sweet === s.id })),
    }),
    chart({
      title: 'Toppings people added',
      explain: 'Each drink can have up to three, so these add up to more than 100%.',
      denominator: n,
      rows: toppingRows.map((t) => ({
        label: t.label,
        count: d.topping[t.id] || 0,
        mine: my ? (t.id === 'none' ? my.toppings.length === 0 : my.toppings.includes(t.id)) : false,
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
  if (group.label) return group.label; // demo groups carry their own made-up label
  if (group.region === 'other') return 'Other regions combined';
  return REGIONS.find((r) => r.id === group.region)?.label ?? group.region;
}

function regionBlock(question, group, mine) {
  return h('div', { class: 'region-block' },
    h('h4', {},
      regionLabel(group),
      mine?.region && mine.region === group.region ? h('span', { class: 'bar__you' }, 'Your region') : null,
    ),
    h('p', { class: 'region-block__n' }, `${group.n} people answered`),
    h('ul', { class: 'bars' },
      question.options.map((option) => {
        const share = group.shares[option.value] || 0;
        return h('li', { class: 'bar' },
          h('span', { class: 'bar__label' }, option.label),
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

  const intro = h('p', { class: 'regional__intro' },
    'People who chose to answer, grouped by the broad part of the world they said they live in. ',
    'A region is a huge and varied place, and these are small snapshots of this survey\'s participants. ',
    'They are not a statement about any country or culture.');

  if (compared.length === 0) {
    return [
      intro,
      h('p', { class: 'chart__empty regional__empty' },
        `Regional comparisons appear once at least ${min} people from a region have answered the same question. `
        + 'Smaller groups are never shown, so no one can be picked out.'),
    ];
  }

  return [
    intro,
    ...compared.map(({ question, groups }) =>
      h('figure', { class: 'chart chart--regional' },
        h('figcaption', {}, h('h3', {}, question.title),
          h('p', {}, 'Each region shows the share of its own participants who chose each answer.')),
        h('div', { class: 'region-blocks' }, groups.map((group) => regionBlock(question, group, mine))),
        h('p', { class: 'chart__note' },
          `Only regions with at least ${min} answers to this question are shown. Percentages are rounded.`),
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
    }, active ? 'Hide the demo' : 'Preview with demo data');
  }

  function pearlMeter(total, min) {
    return h('ol', { class: 'pearl-meter', 'aria-label': `${total} of ${min} responses so far` },
      Array.from({ length: min }, (_, i) => h('li', { class: i < total ? 'is-filled' : '' })));
  }

  function emptyState(title, text, extra) {
    return h('div', { class: 'empty' },
      h('h3', {}, title),
      h('p', {}, text),
      extra,
      h('div', { class: 'empty__actions' },
        h('a', { class: 'btn btn--primary', href: '#survey' }, 'Take the survey'),
        demoToggle(false),
      ),
    );
  }

  function render() {
    const mine = local.get(MY_ANSWERS_KEY);

    if (mode === 'demo') {
      root.replaceChildren(
        h('div', { class: 'demo-banner', role: 'note' },
          h('strong', {}, 'Demo data'),
          h('p', {}, 'These numbers are made up to show how results will look. They are not from real people.'),
          demoToggle(true),
        ),
        h('div', { class: 'charts charts--demo' },
          h('h3', { class: 'charts__heading' }, 'About taste (demo)'),
          questionCharts(DEMO, null),
          h('h3', { class: 'charts__heading' }, 'About the drinks (demo)'),
          drinkCharts(DEMO, null),
          h('h3', { class: 'charts__heading' }, 'Across regions (demo)'),
          regionalCharts(DEMO, null),
        ),
      );
      return;
    }

    if (!live) {
      root.replaceChildren(h('p', { class: 'loading' }, 'Loading results...'));
      return;
    }

    if (live.error) {
      root.replaceChildren(
        emptyState('Results are not loading right now', 'Check your connection and reload the page. Your answers are safe.'),
      );
      return;
    }

    if (!live.configured) {
      root.replaceChildren(
        emptyState(
          'Results are not switched on yet',
          'The survey is not collecting answers yet, so there is nothing to show. Check back soon.',
        ),
      );
      return;
    }

    if (!live.ready) {
      root.replaceChildren(
        emptyState(
          'Not enough answers yet',
          `Charts appear after ${live.min} people answer, so no single person's choices can be picked out. Be one of them.`,
          h('div', { class: 'meter' }, pearlMeter(live.total, live.min), h('p', {}, `${live.total} of ${live.min} responses so far`)),
        ),
      );
      return;
    }

    root.replaceChildren(
      h('p', { class: 'results__summary' },
        `${live.total} ${live.total === 1 ? 'person has' : 'people have'} answered so far.`,
        mine ? ' Your own choices are marked "You".' : ''),
      h('div', { class: 'charts' },
        h('h3', { class: 'charts__heading' }, 'About taste'),
        questionCharts(live, mine),
        h('h3', { class: 'charts__heading' }, 'About the drinks'),
        drinkCharts(live, mine),
        h('h3', { class: 'charts__heading' }, 'Across regions'),
        regionalCharts(live, mine),
      ),
      h('p', { class: 'results__caveat' },
        'These results come from people who chose to answer, mostly people who found this page. They are a snapshot, not a study of everyone.'),
    );
  }

  document.addEventListener('boba:submitted', load);
  render();
  load();
}
