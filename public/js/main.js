// The starting point. This file connects all the other pieces when the page loads.

import { mountCup } from './cup.js';
import { initBuilder } from './builder.js';
import { initSurprise } from './surprise.js';
import { initSurvey } from './survey.js';
import { initResults } from './results.js';
import { getDrink, subscribe } from './state.js';

// 1. The two cups: a big one in the hero and a live preview in the builder.
const heroCup = mountCup(document.getElementById('hero-cup'), { label: '' });
const builderCup = mountCup(document.getElementById('builder-cup'));

// Show the starting drink. Only the hero cup plays the toppings-drop animation
// on load: one moment of motion, then everything else stays calm.
heroCup.update(getDrink(), { animate: true });
builderCup.update(getDrink(), { animate: false });

// Whenever the drink changes, update both cups. The builder cup animates
// because the person just did something. The hero cup updates quietly.
subscribe((drink) => {
  heroCup.update(drink, { animate: false });
  builderCup.update(drink, { animate: true });
});

// Tapping the hero cup shakes it and drops the toppings again.
document.getElementById('hero-cup-button').addEventListener('click', () => heroCup.shake(getDrink()));

// 2. The sections.
initBuilder();
initSurprise();
initSurvey();
initResults();

// 3. Share button in the About section.
const shareButton = document.getElementById('share-button');
const shareStatus = document.getElementById('share-status');
shareButton.addEventListener('click', async () => {
  const data = {
    title: 'Boba Lab',
    text: 'Build a boba and see how your taste compares with other people\'s.',
    url: location.origin + '/',
  };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(data.url);
    shareStatus.textContent = 'Link copied.';
  } catch (error) {
    if (error && error.name === 'AbortError') return; // they closed the share sheet
    shareStatus.textContent = `Copy this link: ${data.url}`;
  }
});

// 4. Small touches.
document.getElementById('year').textContent = new Date().getFullYear();
document.documentElement.classList.add('js');
