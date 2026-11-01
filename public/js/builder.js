// "Build Your Boba": the choices (tea, flavor, sweetness, toppings) and the
// live summary. All it does is read and change the shared drink in state.js.
//
// Words come from the language files, so when the language changes the
// choices are drawn again in the new language. The drink itself is kept as ids
// in state.js, so nothing the visitor picked is lost.

import { h } from './dom.js';
import { TEAS, FLAVORS, SWEETNESS, TOPPINGS, MAX_TOPPINGS } from './menu.js';
import { teaName, flavorName, sweetLabel, toppingName, drinkName, orderText, lower } from './menu-text.js';
import { getDrink, setDrink, subscribe } from './state.js';
import { t, onLanguageChange } from './i18n/index.js';

// One selectable pill. `type` is 'radio' (pick one) or 'checkbox' (pick several).
function chip({ type, name, value, label, color }) {
  return h('label', { class: 'chip' },
    h('input', { type, name, value }),
    h('span', { class: 'chip__body' },
      color ? h('i', { class: 'dot', style: { '--c': color }, 'aria-hidden': 'true' }) : null,
      label,
    ),
  );
}

function group(key, title, hint, chips, extraClass = '') {
  return h('fieldset', { class: `group ${extraClass}`.trim() },
    h('legend', {}, title),
    hint ? h('p', { class: 'group__hint', id: `hint-${key}` }, hint) : null,
    h('div', { class: 'chips' }, chips),
  );
}

export function initBuilder() {
  const controls = document.getElementById('builder-controls');
  const nameEl = document.getElementById('drink-name');
  const detailEl = document.getElementById('drink-detail');
  const copyButton = document.getElementById('copy-order');
  const copyStatus = document.getElementById('copy-status');

  function buildControls() {
    controls.replaceChildren(
      group('tea', t('builder.groupTea'), null,
        TEAS.map((x) => chip({ type: 'radio', name: 'tea', value: x.id, label: teaName(x.id), color: x.color }))),
      group('flavor', t('builder.groupFlavor'), null,
        FLAVORS.map((x) => chip({ type: 'radio', name: 'flavor', value: x.id, label: flavorName(x.id), color: x.tint }))),
      group('sweetness', t('builder.groupSweetness'), null,
        SWEETNESS.map((x) => chip({ type: 'radio', name: 'sweet', value: x.id, label: sweetLabel(x.id) })), 'group--compact'),
      group('toppings', t('builder.groupToppings'), t('builder.toppingsHint', { max: MAX_TOPPINGS }),
        TOPPINGS.map((x) => chip({ type: 'checkbox', name: 'toppings', value: x.id, label: toppingName(x.id), color: x.color }))),
    );
  }

  // When someone clicks a choice, update the shared drink.
  controls.addEventListener('change', (event) => {
    const input = event.target;
    if (input.name === 'toppings') {
      const picked = [...controls.querySelectorAll('input[name="toppings"]:checked')].map((i) => i.value);
      setDrink({ toppings: picked });
    } else {
      setDrink({ [input.name]: input.value });
    }
  });

  // When the drink changes (from here or from "Surprise me"), refresh the screen.
  function render(drink) {
    for (const input of controls.querySelectorAll('input[type="radio"]')) {
      input.checked = drink[input.name] === input.value;
    }
    const full = drink.toppings.length >= MAX_TOPPINGS;
    for (const input of controls.querySelectorAll('input[name="toppings"]')) {
      input.checked = drink.toppings.includes(input.value);
      input.disabled = full && !input.checked;
    }

    nameEl.textContent = drinkName(drink);
    const tops = drink.toppings.map((id) => lower(toppingName(id)));
    detailEl.textContent = t('builder.detail', {
      sweet: sweetLabel(drink.sweet),
      toppings: tops.length ? tops.join(', ') : t('builder.noToppings'),
    });
  }

  buildControls();
  subscribe(render);
  render(getDrink());

  // New language: draw the choices again in it, then show the same drink.
  onLanguageChange(() => {
    buildControls();
    render(getDrink());
    copyButton.classList.remove('is-done');
    copyButton.textContent = t('builder.copy');
  });

  // "Copy my order": handy for pasting into a chat or reading out at the counter.
  copyButton.addEventListener('click', async () => {
    const text = orderText(getDrink());
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const area = h('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', opacity: '0' } });
      area.value = text;
      document.body.append(area);
      area.select();
      try { copied = document.execCommand('copy'); } catch { /* ignore */ }
      area.remove();
    }
    copyStatus.textContent = copied ? t('builder.copiedStatus', { text }) : t('builder.copyFailed');
    copyButton.classList.toggle('is-done', copied);
    copyButton.textContent = copied ? t('builder.copied') : t('builder.copy');
    setTimeout(() => {
      copyButton.textContent = t('builder.copy');
      copyButton.classList.remove('is-done');
    }, 2200);
  });
}
