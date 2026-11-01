// The Boba Lab menu: the ids and colors of every tea, flavor, sweetness level
// and topping.
//
// Why only ids and colors here? The WORDS ("Black tea", "Чёрный чай") now live in
// the language files (i18n/locales/*.js), so one drink has one id but a
// name in every language. The website (in your browser) AND the survey server
// both read this file. That way they always agree about what counts as a valid
// choice, and adding a new flavor is a one-place edit (plus its name in each language).
//
// This file must stay free of any browser-only code, because the server uses it too.

export const TEAS = [
  { id: 'black',   color: '#A5612F' },
  { id: 'green',   color: '#BFC97E' },
  { id: 'oolong',  color: '#CF9249' },
  { id: 'jasmine', color: '#DDDD92' },
  { id: 'barley',  color: '#BE865A' },
];

// `tint` is the flavor's color, `mix` is how strongly it colors the drink,
// and `milk` is how much creamy milk color gets blended in on top.
export const FLAVORS = [
  { id: 'classic',     tint: '#E8D2B5', mix: 0.35, milk: 0.55 },
  { id: 'brown-sugar', tint: '#7A4524', mix: 0.50, milk: 0.35 },
  { id: 'taro',        tint: '#B9A0D6', mix: 0.65, milk: 0.50 },
  { id: 'strawberry',  tint: '#F08FA6', mix: 0.65, milk: 0.25 },
  { id: 'mango',       tint: '#F7B733', mix: 0.65, milk: 0.10 },
  { id: 'passion',     tint: '#F29A32', mix: 0.60, milk: 0.00 },
  { id: 'lychee',      tint: '#F6E3E0', mix: 0.55, milk: 0.30 },
  { id: 'peach',       tint: '#F8B48F', mix: 0.60, milk: 0.10 },
  { id: 'osmanthus',   tint: '#F0CD6E', mix: 0.50, milk: 0.20 },
  { id: 'coconut',     tint: '#F4EEE4', mix: 0.50, milk: 0.60 },
];

export const SWEETNESS = [
  { id: '0' },
  { id: '30' },
  { id: '50' },
  { id: '70' },
  { id: '100' },
];

// `kind` decides how the topping is drawn in the cup:
//   sphere = round pearls, cube = jelly cubes, block = pudding, foam = cap on top.
export const TOPPINGS = [
  { id: 'tapioca',     kind: 'sphere', color: '#2B1810', shine: true  },
  { id: 'popping',     kind: 'sphere', color: '#F26B8A', shine: true  },
  { id: 'grass-jelly', kind: 'cube',   color: '#3F4A3A'               },
  { id: 'lychee-jelly',kind: 'cube',   color: '#F3EBDD'               },
  { id: 'pudding',     kind: 'block',  color: '#F6CB5B'               },
  { id: 'red-bean',    kind: 'bean',   color: '#7B2A2E'               },
  { id: 'cheese-foam', kind: 'foam',   color: '#FBF1E1'               },
];

export const MAX_TOPPINGS = 3;

// Starting drink shown the first time the page opens.
export const DEFAULT_DRINK = {
  tea: 'black',
  flavor: 'brown-sugar',
  sweet: '50',
  toppings: ['tapioca'],
};

// ---- small helpers -------------------------------------------------------

export const byId = (list, id) => list.find((item) => item.id === id);

// Blend two hex colors. t=0 gives color a, t=1 gives color b.
export function mixColors(a, b, t) {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const out = pa.map((value, i) => Math.round(value + (pb[i] - value) * t));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const MILK_COLOR = '#F4E6D3';

// The color of the liquid in the cup for a given drink.
export function liquidColor(drink) {
  const tea = byId(TEAS, drink.tea) || TEAS[0];
  const flavor = byId(FLAVORS, drink.flavor) || FLAVORS[0];
  const flavored = mixColors(tea.color, flavor.tint, flavor.mix);
  return mixColors(flavored, MILK_COLOR, flavor.milk);
}
