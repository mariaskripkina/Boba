// "Build Your Boba": the choices (tea, flavor, sweetness, toppings) and the
// live summary. All it does is read and change the shared drink in state.js.

import { h } from './dom.js';
import { TEAS, FLAVORS, SWEETNESS, TOPPINGS, MAX_TOPPINGS, byId, drinkName, orderText } from './menu.js';
import { getDrink, setDrink, subscribe } from './state.js';

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

function group(title, hint, chips, extraClass = '') {
  return h('fieldset', { class: `group ${extraClass}`.trim() },
    h('legend', {}, title),
    hint ? h('p', { class: 'group__hint', id: `hint-${title.replace(/\W+/g, '-').toLowerCase()}` }, hint) : null,
    h('div', { class: 'chips' }, chips),
  );
}

export function initBuilder() {
  const controls = document.getElementById('builder-controls');
  const nameEl = document.getElementById('drink-name');
  const detailEl = document.getElementById('drink-detail');
  const copyButton = document.getElementById('copy-order');
  const copyStatus = document.getElementById('copy-status');

  controls.replaceChildren(
    group('Tea base', null,
      TEAS.map((t) => chip({ type: 'radio', name: 'tea', value: t.id, label: t.name, color: t.color }))),
    group('Flavor', null,
      FLAVORS.map((f) => chip({ type: 'radio', name: 'flavor', value: f.id, label: f.name, color: f.tint }))),
    group('Sweetness', null,
      SWEETNESS.map((s) => chip({ type: 'radio', name: 'sweet', value: s.id, label: s.label })), 'group--compact'),
    group('Toppings', `Pick up to ${MAX_TOPPINGS}.`,
      TOPPINGS.map((t) => chip({ type: 'checkbox', name: 'toppings', value: t.id, label: t.name, color: t.color }))),
  );

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
    const sweet = byId(SWEETNESS, drink.sweet);
    const tops = drink.toppings.map((id) => byId(TOPPINGS, id)?.name).filter(Boolean);
    detailEl.textContent =
      `${sweet ? sweet.label : drink.sweet + '%'} sweet, ` + (tops.length ? tops.join(', ').toLowerCase() : 'no toppings');
  }
  subscribe(render);
  render(getDrink());

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
    copyStatus.textContent = copied ? `Copied: ${text}` : 'Could not copy. Select the text above instead.';
    copyButton.classList.toggle('is-done', copied);
    copyButton.textContent = copied ? 'Copied' : 'Copy my order';
    setTimeout(() => {
      copyButton.textContent = 'Copy my order';
      copyButton.classList.remove('is-done');
    }, 2200);
  });
}
