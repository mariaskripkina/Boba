// The WORDS for the menu, in the visitor's language. Browser-only.
//
// menu.js knows the ids and colors (and is shared with the server).
// This file turns an id into text: menuName('tea', 'black') -> "Black tea".

import { t, grammar, getLanguage } from './i18n/index.js';

export const teaName = (id) => t(`menu.tea.${id}`);
export const flavorName = (id) => t(`menu.flavor.${id}`);
export const sweetLabel = (id) => t(`menu.sweet.${id}`);
export const toppingName = (id) => t(`menu.topping.${id}`);

// Lowercase the way the current language does it.
export const lower = (text) => text.toLocaleLowerCase(getLanguage());

const LABELS = { tea: teaName, flavor: flavorName, topping: toppingName };

// "Taro oolong tea" (English), or however the current language builds a name.
export function drinkName(drink) {
  return grammar().drinkName(drink, LABELS);
}

// "50% sweet, with tapioca pearls and cheese foam"
export function orderDetails(drink) {
  return grammar().orderDetails(drink, LABELS);
}

// "Taro oolong tea, 50% sweet, with tapioca pearls and cheese foam"
export function orderText(drink) {
  return `${drinkName(drink)}, ${orderDetails(drink)}`;
}
