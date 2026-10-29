// "Surprise me": suggests a combination you probably have not tried.
//
// These are hand-picked ideas, not rankings or "the best". Each one is chosen
// because the flavors have a reason to work together. The notes say why.
//
// The ideas below are just ids. Their explanations live in the language files
// (surprise.ideas.<id>), so each language can explain them in its own natural way.

import { h, prefersReducedMotion } from './dom.js';
import { drinkName, orderDetails } from './menu-text.js';
import { mountCup } from './cup.js';
import { getDrink, setDrink } from './state.js';
import { t, onLanguageChange } from './i18n/index.js';

const IDEAS = [
  { id: 'osmanthus-oolong', tea: 'oolong', flavor: 'osmanthus', sweet: '30', toppings: ['lychee-jelly'] },
  { id: 'passion-jasmine', tea: 'jasmine', flavor: 'passion', sweet: '50', toppings: ['popping'] },
  { id: 'coconut-grass', tea: 'black', flavor: 'coconut', sweet: '30', toppings: ['grass-jelly'] },
  { id: 'barley-bean', tea: 'barley', flavor: 'brown-sugar', sweet: '50', toppings: ['red-bean'] },
  { id: 'mango-green', tea: 'green', flavor: 'mango', sweet: '50', toppings: ['lychee-jelly'] },
  { id: 'peach-oolong', tea: 'oolong', flavor: 'peach', sweet: '30', toppings: ['popping'] },
  { id: 'taro-pudding', tea: 'black', flavor: 'taro', sweet: '50', toppings: ['pudding'] },
  { id: 'strawberry-foam', tea: 'green', flavor: 'strawberry', sweet: '30', toppings: ['cheese-foam'] },
  { id: 'lychee-jasmine', tea: 'jasmine', flavor: 'lychee', sweet: '50', toppings: ['grass-jelly'] },
  { id: 'osmanthus-barley', tea: 'barley', flavor: 'osmanthus', sweet: '30', toppings: ['red-bean'] },
];

export function initSurprise() {
  const button = document.getElementById('surprise-button');
  const result = document.getElementById('surprise-result');
  let lastId = null;
  let current = null; // the idea on screen, so we can redraw it in a new language
  let cup = null;

  // Choose an idea that is different from your current flavor and from the last one shown.
  function pick() {
    const drink = getDrink();
    const options = IDEAS.filter((i) => i.flavor !== drink.flavor && i.id !== lastId);
    const pool = options.length ? options : IDEAS.filter((i) => i.id !== lastId);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function show(idea, { animate = true } = {}) {
    lastId = idea.id;
    current = idea;
    const drink = { tea: idea.tea, flavor: idea.flavor, sweet: idea.sweet, toppings: idea.toppings };
    const cupSlot = h('div', { class: 'surprise__cup' });

    result.replaceChildren(
      h('article', { class: 'idea' },
        cupSlot,
        h('div', { class: 'idea__text' },
          h('h3', {}, drinkName(drink)),
          h('p', { class: 'idea__meta' }, orderDetails(drink)),
          h('p', {}, t(`surprise.ideas.${idea.id}`)),
          h('div', { class: 'idea__actions' },
            h('button', { type: 'button', class: 'btn btn--primary', onclick: () => tryIt(drink) }, t('surprise.tryIt')),
            h('button', { type: 'button', class: 'btn', onclick: () => show(pick()) }, t('surprise.another')),
          ),
        ),
      ),
    );
    cup = mountCup(cupSlot);
    cup.update(drink, { animate });
    button.textContent = t('surprise.again');
  }

  function tryIt(drink) {
    setDrink(drink, 'surprise');
    document.getElementById('build').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  button.addEventListener('click', () => show(pick()));

  // New language: show the same idea again, with its words in the new language.
  onLanguageChange(() => {
    if (current) show(current, { animate: false });
  });
}
