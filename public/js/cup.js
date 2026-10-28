// Draws the boba cup as an SVG picture and keeps it in sync with the drink.
//
// SVG is a way to describe pictures with shapes (circles, paths, rectangles)
// instead of pixels. That keeps the cup sharp at any size and lets us change
// colors and add toppings with a few lines of code.

import { TOPPINGS, byId, liquidColor, orderText } from './menu.js';
import { prefersReducedMotion } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const MILK = '#F4E6D3';
const INK = '#3E2419';

function svg(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (parent) parent.append(node);
  return node;
}

// The cup's walls lean inward toward the bottom. These two helpers answer
// "where is the left/right inside wall at height y?"
const wallLeft = (y) => 45 + (y - 86) * 0.1043;
const wallRight = (y) => 195 - (y - 86) * 0.1043;

// A tiny seeded random-number generator: the same seed always gives the same
// "random" numbers, so a given drink always looks the same.
function seededRandom(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  s = s || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// All the spots at the bottom of the cup where a topping piece can sit,
// listed from the very bottom upward.
function buildSlots() {
  const slots = [];
  for (let row = 0; row < 6; row++) {
    const y = 313 - row * 13.5;
    const left = wallLeft(y) + 7;
    const right = wallRight(y) - 7;
    const step = 14.4;
    const offset = row % 2 ? step / 2 : 0;
    for (let x = left + offset; x <= right; x += step) slots.push({ x, y });
  }
  return slots;
}
const SLOTS = buildSlots();
const PIECES_FOR = { 1: 24, 2: 30, 3: 36 };

let cupCounter = 0;

// Create a cup inside `container`. Returns functions to control it.
//   label: text read aloud for the picture (use null if nearby text says it all)
export function mountCup(container, { label = null } = {}) {
  const id = `cup${++cupCounter}`;
  const root = svg('svg', {
    viewBox: '0 0 240 340',
    class: 'cup',
    focusable: 'false',
    ...(label === null ? { 'aria-hidden': 'true' } : { role: 'img' }),
  });

  const defs = svg('defs', {}, root);
  const clip = svg('clipPath', { id: `${id}-clip` }, defs);
  svg('path', { d: 'M45 90 L195 90 L170.5 317 Q170 325 161 325 L79 325 Q70 325 69.5 317 Z' }, clip);

  // Back of the glass.
  svg('path', {
    d: 'M40 86 L200 86 L176 316 Q175 328 162 328 L78 328 Q65 328 64 316 Z',
    fill: '#FFFFFF', 'fill-opacity': '0.5',
  }, root);

  // Everything that sits inside the cup is clipped to the glass shape.
  const inside = svg('g', { 'clip-path': `url(#${id}-clip)` }, root);
  const liquid = svg('rect', { class: 'cup__liquid', x: 30, y: 106, width: 180, height: 230 }, inside);
  svg('rect', { x: 30, y: 106, width: 180, height: 5, fill: '#FFFFFF', 'fill-opacity': '0.28' }, inside);
  const toppings = svg('g', { class: 'cup__toppings' }, inside);
  const foam = svg('path', {
    class: 'cup__foam',
    d: 'M36 108 C58 98 80 114 104 106 S150 98 172 107 S204 102 212 108 L212 134 L30 134 Z',
    fill: '#FBF1E1', stroke: '#E9D6BC', 'stroke-width': '1.5',
  }, inside);

  // The straw goes through the lid and down into the drink.
  svg('line', { x1: 150, y1: 6, x2: 124, y2: 300, stroke: '#C94F72', 'stroke-width': 11, 'stroke-linecap': 'round' }, root);
  svg('line', { x1: 147, y1: 10, x2: 122, y2: 296, stroke: '#F9D9E1', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.7 }, root);

  // Glass shine and outline.
  svg('path', { d: 'M54 118 L66 300', stroke: '#FFFFFF', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.45, fill: 'none' }, root);
  svg('path', {
    d: 'M40 86 L200 86 L176 316 Q175 328 162 328 L78 328 Q65 328 64 316 Z',
    fill: 'none', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round',
  }, root);

  // Lid.
  svg('path', { d: 'M46 84 Q46 56 120 53 Q194 56 194 84 Z', fill: '#FFFFFF', 'fill-opacity': '0.6', stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' }, root);
  svg('rect', { x: 32, y: 80, width: 176, height: 13, rx: 6.5, fill: MILK, stroke: INK, 'stroke-width': 4 }, root);

  container.append(root);

  let previousKeys = new Set();

  function drawToppings(drink, animate) {
    toppings.replaceChildren();
    const chosen = drink.toppings.map((t) => byId(TOPPINGS, t)).filter((t) => t && t.kind !== 'foam');
    const keys = new Set();
    if (chosen.length) {
      const random = seededRandom(chosen.map((t) => t.id).join('|'));
      const total = Math.min(PIECES_FOR[chosen.length] ?? 36, SLOTS.length);
      const perTopping = Math.floor(total / chosen.length);

      // Make a list of which topping owns each spot, then shuffle it so the
      // toppings mix together like they do in a real cup.
      const owners = [];
      chosen.forEach((t) => { for (let i = 0; i < perTopping; i++) owners.push(t); });
      while (owners.length < total) owners.push(chosen[0]);
      for (let i = owners.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [owners[i], owners[j]] = [owners[j], owners[i]];
      }

      owners.forEach((topping, index) => {
        const slot = SLOTS[index];
        const key = `${index}:${topping.id}`;
        keys.add(key);
        const group = svg('g', { class: 'piece' }, toppings);
        const x = slot.x + (random() - 0.5) * 2.4;
        const y = slot.y + (random() - 0.5) * 2;
        drawPiece(group, topping, x, y, random);
        if (animate && !previousKeys.has(key)) {
          group.classList.add('piece--drop');
          group.style.setProperty('--fall', `${-(y - 96)}px`);
          group.style.setProperty('--delay', `${Math.round((SLOTS.length - index) * 9 + random() * 90)}ms`);
        }
      });
    }
    previousKeys = keys;
  }

  function drawPiece(group, topping, x, y, random) {
    const tilt = (random() - 0.5) * 40;
    if (topping.kind === 'sphere') {
      svg('circle', { cx: x, cy: y, r: 6.3, fill: topping.color }, group);
      if (topping.shine) svg('circle', { cx: x - 2.2, cy: y - 2.3, r: 1.7, fill: '#FFFFFF', opacity: 0.55 }, group);
    } else if (topping.kind === 'cube') {
      svg('rect', {
        x: x - 5.5, y: y - 5.5, width: 11, height: 11, rx: 2.6, fill: topping.color,
        stroke: 'rgba(62,36,25,.25)', 'stroke-width': 1, transform: `rotate(${tilt} ${x} ${y})`,
      }, group);
    } else if (topping.kind === 'block') {
      svg('rect', { x: x - 7, y: y - 6, width: 14, height: 12, rx: 3.2, fill: topping.color, transform: `rotate(${tilt / 2} ${x} ${y})` }, group);
      svg('rect', { x: x - 7, y: y - 6, width: 14, height: 3.4, rx: 1.7, fill: '#B8742F', transform: `rotate(${tilt / 2} ${x} ${y})` }, group);
    } else if (topping.kind === 'bean') {
      svg('ellipse', { cx: x, cy: y, rx: 4.8, ry: 3.4, fill: topping.color, transform: `rotate(${tilt * 2} ${x} ${y})` }, group);
    }
  }

  // Bring the picture up to date with a drink.
  function update(drink, { animate = true } = {}) {
    liquid.style.fill = liquidColor(drink);
    const hasFoam = drink.toppings.includes('cheese-foam');
    foam.classList.toggle('is-on', hasFoam);
    drawToppings(drink, animate && !prefersReducedMotion());
    if (label !== null) root.setAttribute('aria-label', label || orderText(drink));
  }

  // Shake the cup and let all the toppings settle again.
  function shake(drink) {
    previousKeys = new Set();
    update(drink, { animate: true });
    if (prefersReducedMotion()) return;
    root.classList.remove('cup--shake');
    void root.getBoundingClientRect(); // restart the animation
    root.classList.add('cup--shake');
  }

  return { update, shake, element: root };
}

