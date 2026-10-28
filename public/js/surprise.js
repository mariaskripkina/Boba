// "Surprise me": suggests a combination you probably have not tried.
//
// These are hand-picked ideas, not rankings or "the best". Each one is chosen
// because the flavors have a reason to work together. The notes say why.

import { h, prefersReducedMotion } from './dom.js';
import { drinkName, orderText } from './menu.js';
import { mountCup } from './cup.js';
import { getDrink, setDrink } from './state.js';

const IDEAS = [
  { id: 'osmanthus-oolong', tea: 'oolong', flavor: 'osmanthus', sweet: '30', toppings: ['lychee-jelly'],
    note: 'Osmanthus smells a bit like apricot and flowers, and it sits nicely on oolong\'s toasty base.' },
  { id: 'passion-jasmine', tea: 'jasmine', flavor: 'passion', sweet: '50', toppings: ['popping'],
    note: 'Tart passion fruit cuts through jasmine\'s perfume, and the popping boba adds little bursts.' },
  { id: 'coconut-grass', tea: 'black', flavor: 'coconut', sweet: '30', toppings: ['grass-jelly'],
    note: 'Grass jelly is herbal and a little bitter, which balances creamy coconut.' },
  { id: 'barley-bean', tea: 'barley', flavor: 'brown-sugar', sweet: '50', toppings: ['red-bean'],
    note: 'Toasty on toasty, with no caffeine. Red bean adds a soft, earthy sweetness.' },
  { id: 'mango-green', tea: 'green', flavor: 'mango', sweet: '50', toppings: ['lychee-jelly'],
    note: 'Ripe mango over a grassy green tea. Lychee jelly keeps it light.' },
  { id: 'peach-oolong', tea: 'oolong', flavor: 'peach', sweet: '30', toppings: ['popping'],
    note: 'Peach and oolong share a soft, fruity-roasted note that many people find easy to like.' },
  { id: 'taro-pudding', tea: 'black', flavor: 'taro', sweet: '50', toppings: ['pudding'],
    note: 'Taro tastes nutty and a little like vanilla. Egg pudding makes it feel like dessert.' },
  { id: 'strawberry-foam', tea: 'green', flavor: 'strawberry', sweet: '30', toppings: ['cheese-foam'],
    note: 'Sweet strawberry under salty, creamy foam. It sounds odd, and the contrast is the point.' },
  { id: 'lychee-jasmine', tea: 'jasmine', flavor: 'lychee', sweet: '50', toppings: ['grass-jelly'],
    note: 'Two perfumed flavors together, with grass jelly to ground them.' },
  { id: 'osmanthus-barley', tea: 'barley', flavor: 'osmanthus', sweet: '30', toppings: ['red-bean'],
    note: 'A gentle, caffeine-free cup that is floral, toasty and a little sweet.' },
];

export function initSurprise() {
  const button = document.getElementById('surprise-button');
  const result = document.getElementById('surprise-result');
  let lastId = null;
  let cup = null;

  // Choose an idea that is different from your current flavor and from the last one shown.
  function pick() {
    const current = getDrink();
    const options = IDEAS.filter((i) => i.flavor !== current.flavor && i.id !== lastId);
    const pool = options.length ? options : IDEAS.filter((i) => i.id !== lastId);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function show(idea) {
    lastId = idea.id;
    const drink = { tea: idea.tea, flavor: idea.flavor, sweet: idea.sweet, toppings: idea.toppings };
    const cupSlot = h('div', { class: 'surprise__cup' });

    result.replaceChildren(
      h('article', { class: 'idea' },
        cupSlot,
        h('div', { class: 'idea__text' },
          h('h3', {}, drinkName(drink)),
          h('p', { class: 'idea__meta' }, orderText(drink).replace(drinkName(drink) + ', ', '')),
          h('p', {}, idea.note),
          h('div', { class: 'idea__actions' },
            h('button', { type: 'button', class: 'btn btn--primary', onclick: () => tryIt(drink) }, 'Try it in my builder'),
            h('button', { type: 'button', class: 'btn', onclick: () => show(pick()) }, 'Another idea'),
          ),
        ),
      ),
    );
    cup = mountCup(cupSlot);
    cup.update(drink, { animate: true });
    button.textContent = 'Surprise me again';
  }

  function tryIt(drink) {
    setDrink(drink, 'surprise');
    document.getElementById('build').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  button.addEventListener('click', () => show(pick()));
}
