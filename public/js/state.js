// The one shared "current drink". The builder changes it, and the cups, the
// summary and the survey's "share my drink" box all read it.
//
// Keeping it in one place means everything on the page always agrees.

import { DEFAULT_DRINK } from './menu.js';

let drink = { ...DEFAULT_DRINK, toppings: [...DEFAULT_DRINK.toppings] };
const listeners = new Set();

export function getDrink() {
  return { ...drink, toppings: [...drink.toppings] };
}

// Change part of the drink, then tell everyone who is listening.
// `source` says who changed it ('init', 'builder', 'surprise'), so listeners
// can decide whether to play an animation.
export function setDrink(changes, source = 'builder') {
  drink = { ...drink, ...changes };
  for (const listener of listeners) listener(getDrink(), source);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
