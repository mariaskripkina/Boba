// The survey form: draws the questions, sends the answers, and shows what happened.
//
// Privacy notes for anyone reading this code:
//   - No names, emails, exact locations or accounts are asked for or sent.
//   - Your answers are sent once to /api/survey, which only adds them to totals.
//   - The language you are using is NEVER part of what is sent. Answers travel as
//     ids (like "try" or "europe"), identical in every language.
//   - Your own answers are also kept in THIS browser (localStorage) so the
//     results page can show "you". That copy never leaves your device.

import { h, local } from './dom.js';
import { QUESTIONS, REGIONS, REGION_PREFER_NOT_TO_SAY } from './schema.js';
import { getDrink } from './state.js';
import { t, onLanguageChange } from './i18n/index.js';

export const MY_ANSWERS_KEY = 'boba-lab-my-answers';

// Error codes the server can send (see api/survey.js). Anything else shows the generic message.
const KNOWN_ERROR_CODES = ['storage_not_configured', 'too_large', 'bad_json', 'invalid_submission', 'save_failed'];

export function initSurvey() {
  const root = document.getElementById('survey-root');
  let sending = false;
  let view = 'form';          // which screen is showing: 'form' or 'thanks'
  let thanksWithDrink = false;

  function showThanks(withDrinkNote) {
    view = 'thanks';
    thanksWithDrink = withDrinkNote;
    root.replaceChildren(
      h('div', { class: 'thanks', role: 'status' },
        h('h3', {}, t('survey.thanksTitle')),
        h('p', {}, withDrinkNote ? t('survey.thanksWithDrink') : t('survey.thanksAnswers')),
        h('p', {}, t('survey.thanksNote')),
        h('div', { class: 'thanks__actions' },
          h('a', { class: 'btn btn--primary', href: '#results' }, t('survey.seeResults')),
          h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => showForm() }, t('survey.answerAgain')),
        ),
      ),
    );
  }

  // `restore` lets us redraw the form in a new language WITHOUT losing what the
  // visitor already picked: { picks: { name: value }, shareDrink: boolean }.
  function showForm(restore = null) {
    view = 'form';
    const status = h('p', { class: 'form-status', id: 'survey-status', role: 'status', 'aria-live': 'polite' });
    const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--wide' }, t('survey.submit'));

    const shareBox = h('input', { type: 'checkbox', id: 'share-drink', name: 'shareDrink' });
    const form = h('form', { class: 'survey-form', novalidate: true, 'aria-describedby': 'survey-status' },
      h('p', { class: 'survey-form__lead' }, t('survey.lead')),

      QUESTIONS.map((q) =>
        h('fieldset', { class: 'question' },
          h('legend', {}, t(`survey.q.${q.id}.title`)),
          h('div', { class: 'chips' },
            q.options.map((o) =>
              h('label', { class: 'chip' },
                h('input', { type: 'radio', name: q.id, value: o.value }),
                h('span', { class: 'chip__body' }, t(`survey.q.${q.id}.options.${o.value}`)),
              ),
            ),
          ),
        ),
      ),

      // Optional: a broad part of the world. Skipping it (or choosing "Prefer
      // not to say") sends no region at all.
      h('fieldset', { class: 'question question--region' },
        h('legend', {}, t('survey.region.title'), h('span', { class: 'question__optional' }, t('survey.region.optional'))),
        h('p', { class: 'question__hint' }, t('survey.region.hint')),
        h('div', { class: 'chips' },
          [...REGIONS.map((r) => ({ value: r.id, label: t(`survey.regions.${r.id}`) })),
           { value: REGION_PREFER_NOT_TO_SAY, label: t('survey.region.preferNot') }].map((o) =>
            h('label', { class: 'chip' },
              h('input', { type: 'radio', name: 'region', value: o.value }),
              h('span', { class: 'chip__body' }, o.label),
            ),
          ),
        ),
      ),

      h('div', { class: 'share' },
        h('label', { class: 'check', for: 'share-drink' },
          shareBox,
          h('span', {}, t('survey.shareDrink')),
        ),
        h('p', { class: 'share__hint' }, t('survey.shareHint')),
      ),

      // Bot trap: a field people never see. Real visitors leave it empty.
      h('div', { class: 'visually-hidden', 'aria-hidden': 'true' },
        h('label', {}, t('survey.honeypot'), h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' })),
      ),

      h('p', { class: 'privacy' }, t('survey.privacy')),
      submit,
      status,
    );

    // Put back anything the visitor had already chosen.
    if (restore) {
      for (const [name, value] of Object.entries(restore.picks)) {
        const input = [...form.querySelectorAll(`input[type="radio"][name="${name}"]`)].find((i) => i.value === value);
        if (input) input.checked = true;
      }
      shareBox.checked = restore.shareDrink;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (sending) return;

      const data = new FormData(form);
      const answers = {};
      for (const q of QUESTIONS) {
        const value = data.get(q.id);
        if (value) answers[q.id] = value;
      }
      const drink = shareBox.checked ? getDrink() : undefined;
      // "Prefer not to say" and skipping both mean: send no region.
      const chosenRegion = data.get('region');
      const region = chosenRegion && chosenRegion !== REGION_PREFER_NOT_TO_SAY ? chosenRegion : undefined;

      if (Object.keys(answers).length === 0 && !drink) {
        status.textContent = t('survey.needOne');
        status.className = 'form-status form-status--error';
        return;
      }

      sending = true;
      submit.disabled = true;
      submit.textContent = t('survey.sending');
      status.textContent = '';
      status.className = 'form-status';

      try {
        // Only ids go over the wire. There is no language field, on purpose.
        const response = await fetch('/api/survey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers, drink, region, website: data.get('website') || '' }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          const code = KNOWN_ERROR_CODES.includes(result.code) ? result.code : 'generic';
          status.textContent = t(`survey.errors.${code}`);
          status.className = 'form-status form-status--error';
          return;
        }

        local.set(MY_ANSWERS_KEY, { answers, drink: drink || null, region: region || null });
        showThanks(Boolean(drink));
        document.dispatchEvent(new CustomEvent('boba:submitted'));
      } catch {
        status.textContent = t('survey.errors.network');
        status.className = 'form-status form-status--error';
      } finally {
        sending = false;
        submit.disabled = false;
        submit.textContent = t('survey.submit');
      }
    });

    root.replaceChildren(form);
  }

  // New language: draw whatever is on screen again, keeping the visitor's picks.
  onLanguageChange(() => {
    if (view === 'thanks') {
      showThanks(thanksWithDrink);
      return;
    }
    const form = root.querySelector('form');
    if (!form) return showForm();
    const data = new FormData(form);
    const picks = {};
    for (const name of [...QUESTIONS.map((q) => q.id), 'region']) {
      if (data.get(name)) picks[name] = data.get(name);
    }
    showForm({ picks, shareDrink: Boolean(data.get('shareDrink')) });
  });

  if (local.get(MY_ANSWERS_KEY)) showThanks(Boolean(local.get(MY_ANSWERS_KEY)?.drink));
  else showForm();
}
