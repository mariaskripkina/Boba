// The survey form: draws the questions, sends the answers, and shows what happened.
//
// Privacy notes for anyone reading this code:
//   - No names, emails, locations or accounts are asked for or sent.
//   - Your answers are sent once to /api/survey, which only adds them to totals.
//   - Your own answers are also kept in THIS browser (localStorage) so the
//     results page can show "you". That copy never leaves your device.

import { h, local } from './dom.js';
import { QUESTIONS, MIN_ANSWERS_NOTE, REGIONS, REGION_QUESTION, REGION_PREFER_NOT_TO_SAY } from './schema.js';
import { getDrink } from './state.js';

export const MY_ANSWERS_KEY = 'boba-lab-my-answers';

export function initSurvey() {
  const root = document.getElementById('survey-root');
  let sending = false;

  function showThanks(withDrinkNote) {
    root.replaceChildren(
      h('div', { class: 'thanks', role: 'status' },
        h('h3', {}, 'Thanks, your cup is in.'),
        h('p', {}, withDrinkNote
          ? 'Your answers and your drink were added to the totals.'
          : 'Your answers were added to the totals.'),
        h('p', {}, 'Nothing about you was saved, only the totals went up.'),
        h('div', { class: 'thanks__actions' },
          h('a', { class: 'btn btn--primary', href: '#results' }, 'See the results'),
          h('button', { type: 'button', class: 'btn btn--quiet', onclick: showForm }, 'Someone else is here? Answer again'),
        ),
      ),
    );
  }

  function showForm() {
    const status = h('p', { class: 'form-status', id: 'survey-status', role: 'status', 'aria-live': 'polite' });
    const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--wide' }, 'Send my answers');

    const shareBox = h('input', { type: 'checkbox', id: 'share-drink', name: 'shareDrink' });
    const form = h('form', { class: 'survey-form', novalidate: true, 'aria-describedby': 'survey-status' },
      h('p', { class: 'survey-form__lead' }, MIN_ANSWERS_NOTE),

      QUESTIONS.map((q) =>
        h('fieldset', { class: 'question' },
          h('legend', {}, q.title),
          h('div', { class: 'chips' },
            q.options.map((o) =>
              h('label', { class: 'chip' },
                h('input', { type: 'radio', name: q.id, value: o.value }),
                h('span', { class: 'chip__body' }, o.label),
              ),
            ),
          ),
        ),
      ),

      // Optional: a broad part of the world. Skipping it (or choosing "Prefer
      // not to say") sends no region at all.
      h('fieldset', { class: 'question question--region' },
        h('legend', {}, REGION_QUESTION.title, h('span', { class: 'question__optional' }, ' (optional)')),
        h('p', { class: 'question__hint' }, REGION_QUESTION.hint),
        h('div', { class: 'chips' },
          [...REGIONS.map((r) => ({ value: r.id, label: r.label })),
           { value: REGION_PREFER_NOT_TO_SAY, label: 'Prefer not to say' }].map((o) =>
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
          h('span', {}, 'Also add the drink I built to the totals'),
        ),
        h('p', { class: 'share__hint' }, 'Optional. It only adds to counts like "how many people chose oolong".'),
      ),

      // Bot trap: a field people never see. Real visitors leave it empty.
      h('div', { class: 'visually-hidden', 'aria-hidden': 'true' },
        h('label', {}, 'Leave this empty', h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' })),
      ),

      h('p', { class: 'privacy' },
        'No names, emails or exact locations. Only totals are saved, so nobody\'s individual answers exist anywhere.'),
      submit,
      status,
    );

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
        status.textContent = 'Pick at least one answer, or tick the box to share your drink.';
        status.className = 'form-status form-status--error';
        return;
      }

      sending = true;
      submit.disabled = true;
      submit.textContent = 'Sending...';
      status.textContent = '';
      status.className = 'form-status';

      try {
        const response = await fetch('/api/survey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers, drink, region, website: data.get('website') || '' }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          status.textContent = result.message || result.error || 'Something went wrong. Please try again.';
          status.className = 'form-status form-status--error';
          return;
        }

        local.set(MY_ANSWERS_KEY, { answers, drink: drink || null, region: region || null });
        showThanks(Boolean(drink));
        document.dispatchEvent(new CustomEvent('boba:submitted'));
      } catch {
        status.textContent = 'Could not reach the server. Check your connection and try again.';
        status.className = 'form-status form-status--error';
      } finally {
        sending = false;
        submit.disabled = false;
        submit.textContent = 'Send my answers';
      }
    });

    root.replaceChildren(form);
  }

  if (local.get(MY_ANSWERS_KEY)) showThanks(Boolean(local.get(MY_ANSWERS_KEY)?.drink));
  else showForm();
}
