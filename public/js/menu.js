// The Boba Lab menu: every tea, flavor, sweetness level and topping lives here.
//
// Why one file? The website (in your browser) AND the survey server both read
// this list. That way they always agree about what counts as a valid choice,
// and adding a new flavor is a one-place edit.

export const TEAS = [
  { id: 'black',   name: 'Black tea',         color: '#A5612F' },
  { id: 'green',   name: 'Green tea',         color: '#BFC97E' },
  { id: 'oolong',  name: 'Oolong tea',        color: '#CF9249' },
  { id: 'jasmine', name: 'Jasmine green tea', color: '#DDDD92' },
  { id: 'barley',  name: 'Barley tea',        color: '#BE865A' },
];

// `tint` is the flavor's color, `mix` is how strongly it colors the drink,
// and `milk` is how much creamy milk color gets blended in on top.
export const FLAVORS = [
  { id: 'classic',     name: 'Classic milk',  tint: '#E8D2B5', mix: 0.35, milk: 0.55 },
  { id: 'brown-sugar', name: 'Brown sugar',   tint: '#7A4524', mix: 0.50, milk: 0.35 },
  { id: 'taro',        name: 'Taro',          tint: '#B9A0D6', mix: 0.65, milk: 0.50 },
  { id: 'strawberry',  name: 'Strawberry',    tint: '#F08FA6', mix: 0.65, milk: 0.25 },
  { id: 'mango',       name: 'Mango',         tint: '#F7B733', mix: 0.65, milk: 0.10 },
  { id: 'passion',     name: 'Passion fruit', tint: '#F29A32', mix: 0.60, milk: 0.00 },
  { id: 'lychee',      name: 'Lychee',        tint: '#F6E3E0', mix: 0.55, milk: 0.30 },
  { id: 'peach',       name: 'Peach',         tint: '#F8B48F', mix: 0.60, milk: 0.10 },
  { id: 'osmanthus',   name: 'Osmanthus',     tint: '#F0CD6E', mix: 0.50, milk: 0.20 },
  { id: 'coconut',     name: 'Coconut',       tint: '#F4EEE4', mix: 0.50, milk: 0.60 },
];

export const SWEETNESS = [
  { id: '0',   label: '0%',   words: 'unsweetened' },
  { id: '30',  label: '30%',  words: 'lightly sweet' },
  { id: '50',  label: '50%',  words: 'half sweet' },
  { id: '70',  label: '70%',  words: 'sweet' },
  { id: '100', label: '100%', words: 'full sweet' },
];

// `kind` decides how the topping is drawn in the cup:
//   sphere = round pearls, cube = jelly cubes, block = pudding, foam = cap on top.
export const TOPPINGS = [
  { id: 'tapioca',     name: 'Tapioca pearls', kind: 'sphere', color: '#2B1810', shine: true  },
  { id: 'popping',     name: 'Popping boba',   kind: 'sphere', color: '#F26B8A', shine: true  },
  { id: 'grass-jelly', name: 'Grass jelly',    kind: 'cube',   color: '#3F4A3A'               },
  { id: 'lychee-jelly',name: 'Lychee jelly',   kind: 'cube',   color: '#F3EBDD'               },
  { id: 'pudding',     name: 'Egg pudding',    kind: 'block',  color: '#F6CB5B'               },
  { id: 'red-bean',    name: 'Red bean',       kind: 'bean',   color: '#7B2A2E'               },
  { id: 'cheese-foam', name: 'Cheese foam',    kind: 'foam',   color: '#FBF1E1'               },
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

// "Taro oolong tea"
export function drinkName(drink) {
  const tea = byId(TEAS, drink.tea) || TEAS[0];
  const flavor = byId(FLAVORS, drink.flavor) || FLAVORS[0];
  return `${flavor.name} ${tea.name.toLowerCase()}`;
}

// "Taro oolong tea, 50% sweet, with tapioca pearls and cheese foam"
export function orderText(drink) {
  const names = drink.toppings
    .map((id) => byId(TOPPINGS, id))
    .filter(Boolean)
    .map((t) => t.name.toLowerCase());
  const base = `${drinkName(drink)}, ${drink.sweet}% sweet`;
  if (names.length === 0) return `${base}, no toppings`;
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${base}, with ${list}`;
}
