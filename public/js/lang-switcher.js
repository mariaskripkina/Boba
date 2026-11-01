// The language switcher in the header.
//
// It is built ONCE from the language list (i18n/languages.js). After that, only
// the "pressed" state changes, so the button you just clicked keeps keyboard
// focus (redrawing the buttons would drop it).
//
// Each button shows a short code (EN, RU, UZ) on small screens and the
// language's own name on wide screens. Screen readers always get the full own
// name, and each button carries its own `lang` so it is pronounced correctly.

import { h } from './dom.js';
import { getLanguages, getLanguage, setLanguage, onLanguageChange } from './i18n/index.js';

export function initLanguageSwitcher() {
  const mount = document.getElementById('lang-switch');

  const buttons = getLanguages().map((language) =>
    h('button', {
      type: 'button',
      class: 'lang-switch__btn',
      lang: language.code,
      'aria-label': language.name,
      onclick: () => setLanguage(language.code),
    },
      h('span', { class: 'lang-switch__short', 'aria-hidden': 'true' }, language.short),
      h('span', { class: 'lang-switch__full', 'aria-hidden': 'true' }, language.name),
    ),
  );
  mount.replaceChildren(...buttons);

  function markCurrent() {
    const languages = getLanguages();
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(languages[index].code === getLanguage()));
    });
  }

  markCurrent();
  onLanguageChange(markCurrent);
}
