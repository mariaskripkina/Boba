# Repeat-submission protection

**Status: built on branch `feature/rate-limit`, tested, NOT merged, NOT deployed.**

## The problem

Results unlock once enough answers exist. Nothing used to identify who sent an answer,
so one person could press "Answer again" ten times and unlock the results alone.

## What the protection does

1. **Server limit (the real protection).** Each network address may send **5 answers per
   24 hours**. The 6th gets a polite "try again tomorrow" (HTTP 429) and counts nothing.
2. **Gentle browser reminder (not a lock).** If this browser already sent answers, the
   form shows a soft note. "Answer again" stays, because a friend may borrow the device.
   The server limit is what actually stops repeats.

Code: `lib/ratelimit.js` (the limit), `api/survey.js` (where it is called),
`lib/store.js` (a few extra storage commands), `public/js/survey.js` (the reminder).

## How the limit works, step by step

1. Read the network address from the header Vercel sets itself
   (`x-vercel-forwarded-for`, then `x-real-ip`, then `x-forwarded-for`).
   Vercel overwrites these, so a visitor cannot fake them.
2. Tidy it: IPv4 written the IPv6 way counts as the same address. An IPv6 visitor is counted
   by their whole /64 block, because phones rotate addresses inside it on purpose.
3. Scramble it: HMAC-SHA256 with the secret `RATE_LIMIT_SALT`, cut to 32 characters.
4. Store one counter under `boba:v1:rl:<code>` in Upstash, with a **24 hour expiry**.
5. Over 5? Refuse. Otherwise save the answer as before.

If saving fails afterwards, the visitor's slot is handed back.

## What is stored, and for how long

| Thing | Stored? |
|---|---|
| Real network address | **No.** Never written anywhere by our code. |
| Scrambled code + a number from 1 to 5 | Yes, in Upstash only, deleted automatically after 24 hours |
| The visitor's answers, language, or any identifier | No |

Tests check: no address or secret is ever sent to storage, every counter has an expiry,
and a counter without one is repaired so nobody is blocked forever.

## Remaining privacy limitations (please read)

- **The code is a pseudonym, not anonymous.** IPv4 addresses are few (about 4 billion).
  Anyone who has BOTH the secret `RATE_LIMIT_SALT` and a copy of the database could test
  "did this address send an answer in the last day?". Keep the salt secret and out of GitHub.
  Changing the salt makes old codes useless.
- **The site's privacy wording is now slightly out of date** (see "Proposed wording").
- **IP addresses are generally treated as personal data by privacy laws** (for example
  GDPR in Europe). Scrambling reduces the risk but does not remove the category. Before a
  public launch, especially one aimed at young people, check the rules that apply to you
  in Uzbekistan and in the countries you expand to. I am not a lawyer.

## Platform logs: could they still keep IP addresses?

What I checked in Vercel's documentation (read on 30 Oct 2026):

- **Vercel itself necessarily sees every visitor's IP** (it is the host), and processes it
  under its own privacy terms. Our code cannot prevent that.
- **Runtime Logs (dashboard)**: the log details Vercel lists do not include the IP address.
  Retention: 1 hour on Hobby, 1 day on Pro (30 days with Observability Plus).
- **Log Drains** (only if you set one up) DO include the client IP (`proxy.clientIp`).
  **To do:** in Vercel, open Settings, then Drains, and confirm there are none.
- **Our code** never logs the address. The only log lines are a warning when the salt is
  missing and an error message when storage fails. A test enforces that.
- **The site has no analytics scripts** (nothing under `public/` calls an analytics service).
  If you ever turn on Vercel Web Analytics or similar, revisit this.
- **Upstash** receives requests from Vercel's servers, not from visitors, so it never sees
  visitor addresses. It only sees the scrambled key. I did not verify Upstash's own log
  retention; check it in the Upstash dashboard before launch.
- **Not verified:** whether Vercel keeps IPs in internal infrastructure logs beyond the
  figures above. Its privacy policy and data-processing terms are the authority.

## Exactly what is processed, and for how long

| Step | What | Who handles it | Kept? |
|---|---|---|---|
| You press "Send" | Your answers (as ids), the optional region, the optional drink, plus the connection details every website receives (your network address, browser type) | Vercel (the host) and our server code | Answers: only added to totals, never kept individually. Network address: not stored by our code. |
| Making the code | Our code scrambles the address with the secret salt into a 32-character code | Our server function | Exists in memory for a split second, then is gone |
| Limit counter | That code plus a small number. The number goes up on every attempt, including refused ones, so it can be above 5 | Upstash | **Up to 24 hours** from the first answer in that window, then it deletes itself |
| Totals | Counters like "how many chose oolong" | Upstash | Until you reset them |
| Your own browser | Your answers (for the "You" markers) and your language | Your device only | Until you clear browser data |
| Hosting logs | Vercel's own request logs | Vercel | Runtime logs: 1 hour (Hobby) or 1 day (Pro). Our code writes nothing about visitors into them. |

The scrambled code and the totals sit in different places and nothing connects them. We
keep no per-answer timestamps. So the code does not reveal which answers came from whom.

## Proposed wording (waiting for your approval, NOT applied to the site)

Three existing sentences say or imply "only totals are saved". With this feature a
scrambled code exists for up to 24 hours, so they should change before the branch is merged.
The Russian and Uzbek drafts follow the glossary (casual «ты» in Russian, «siz» and the
proper ʻ and ʼ letters in Uzbek) and pass the same checks the site's tests use.
**They have not been read by a fluent speaker yet.**

### 1. Survey privacy line (`survey.privacy`)

**English:** No names, emails or exact locations. Your answers are only added to totals, so nobody's individual answers are saved. To stop repeat submissions, a scrambled code made from your network address (never the address itself) is kept for up to 24 hours, then deletes itself.

**Русский:** Без имён, почты и точного местоположения. Ответы только добавляются к общим цифрам, поэтому отдельные ответы нигде не сохраняются. Чтобы пресечь повторные отправки, не дольше 24 часов хранится нечитаемый код, полученный из адреса твоей сети (сам адрес не сохраняется), а потом он удаляется сам.

**Oʻzbekcha:** Ism, elektron pochta va aniq joylashuv soʻralmaydi. Javoblar faqat umumiy hisobga qoʻshiladi, shuning uchun alohida javoblar hech qayerda saqlanmaydi. Takroriy yuborishning oldini olish uchun tarmoq manzilingizdan (IP) hosil qilingan oʻqib boʻlmaydigan kod (manzilning oʻzi emas) 24 soatgacha saqlanadi, keyin oʻzi oʻchib ketadi.

### 2. Thank-you note (`survey.thanksNote`)

**English:** Your individual answers were not saved, only the totals went up.

**Русский:** Отдельные ответы не сохранились, выросли только общие цифры.

**Oʻzbekcha:** Alohida javoblaringiz saqlanmadi, faqat umumiy hisob oshdi.

### 3. About page paragraph (`about.p3`)

**English:** The survey asks for no names or emails. The one place-related question is optional and broad: a part of the world such as "Europe" or "Central Asia and Caucasus", never a country or a city. The site adds answers to totals, like how many people picked chewy textures, so no one's individual answers exist anywhere. To stop repeat submissions, it also keeps a scrambled code made from your network address (never the address itself) for up to 24 hours, then deletes it. That code is not linked to your answers. Your language choice is remembered only on your own device.

**Русский:** В опросе нет вопросов об имени или почте. Единственный вопрос про место необязательный и очень общий: часть мира, например «Европа» или «Центральная Азия и Кавказ», но не страна и не город. Сайт добавляет ответы к общим цифрам, например сколько человек выбрали жевательную текстуру, поэтому отдельные ответы нигде не хранятся. Чтобы пресечь повторные отправки, на срок до 24 часов сохраняется нечитаемый код, полученный из адреса твоей сети (сам адрес не сохраняется). Он не связан с твоими ответами и потом удаляется сам. Выбранный язык запоминается только на твоём устройстве.

**Oʻzbekcha:** Soʻrovnomada ism yoki elektron pochta soʻralmaydi. Joyga oid yagona savol ixtiyoriy va juda umumiy: dunyoning bir qismi, masalan, "Yevropa" yoki "Markaziy Osiyo va Kavkaz", hech qachon mamlakat yoki shahar emas. Sayt javoblarni umumiy hisobga qoʻshadi, masalan, necha kishi bir xil variantni tanlagani, shuning uchun hech kimning alohida javobi hech qayerda saqlanmaydi. Takroriy yuborishning oldini olish uchun tarmoq manzilingizdan hosil qilingan oʻqib boʻlmaydigan kod (manzilning oʻzi emas) 24 soatgacha saqlanadi va oʻzi oʻchib ketadi. Bu kod javoblaringiz bilan bogʻlanmagan. Tanlagan tilingiz faqat oʻz qurilmangizda eslab qolinadi.

Two points to review in the Uzbek text: "tarmoq manzili (IP)" for "network address" is not in the
glossary yet, and the About example "chewy textures" is reworded generically in Uzbek
because the glossary has no term for it. The Russian About text keeps «жевательную текстуру».

## Who this helps, and who it hurts

| Situation | Result |
|---|---|
| Family, friends or classmates on one network | Up to 5 answers in total per day. Raise `RATE_LIMIT_MAX` for schools or events. |
| Mobile carriers that share one address among many phones | Possible false blocks. Another reason the limit is generous. |
| One person, several browsers, same network | Still limited (it counts the network, not the browser). |
| Cleared browser data | The reminder disappears, the server limit still applies. |
| Switching Wi-Fi / mobile data / VPN | Counts as a different network. **This is the gap.** |

It discourages casual and accidental repeats. It does not stop a determined person, and
to reach 10 answers someone now needs at least two networks. For a survey with no prizes
or money at stake, that is proportionate.

## Checking that no IP-containing log drains are enabled

I could not check this for you: this session has no connection to your Vercel account.
Please check it yourself (it takes a minute):

1. Vercel dashboard, switch to your team (top-left), then **Team Settings**, then **Drains**.
2. **Drains are a Pro and Enterprise feature.** If your team is on Hobby (see Settings, Billing),
   none can exist, and you are done.
3. If the list is empty, there are no drains. Done.
4. If there are drains, open each. A drain of type **Logs** contains the visitor's IP
   (`proxy.clientIp`). Drain types Traces, Speed Insights and Web Analytics carry other data.
   Anything you do not recognise: use the three-dot menu, then **Pause** or **Delete**.
5. Also open **Integrations** in the team sidebar and look for logging or observability
   tools (Datadog, Dash0 and similar), since an installed one can have its own drain.
6. Optional: send me a screenshot of the Drains page (it shows no secret values) and I will read it.

## A safe, separate database for testing on a Preview

**The goal:** the preview can save test answers without ever touching the live database.

**Complication found:** Upstash's pricing page (read 30 Oct 2026) lists the Free plan as
**1 database per account**, and the live one already uses it. Plans change, so confirm in the
Upstash console. That leaves these options, best first:

| Option | Isolation | Cost / effort |
|---|---|---|
| **A. A second, paid Upstash database** | Fully separate database and token | Check the price in the Upstash console |
| **B. A second free Upstash account** | Fully separate | Free, but check Upstash's terms first; I would not rely on it |
| **C. Prefix isolation in the same database** | Weaker: same database and token, different key names. Needs a small code change (a `STORAGE_PREFIX` used only on previews, which refuses to start on a preview without it) and your approval | No cost; slight risk if the guard were wrong |
| **D. No preview test; test once at launch** | n/a | The real-storage path is tested against a pretend Upstash server, but not yet against the real one. A final test in Production before launch uses numbers that will be reset anyway |

If you pick A or B, do it like this (**never reconnect or re-tick Preview on the existing
Upstash integration: that could hand Preview the live database**):

1. In the **Upstash console** (not through Vercel), create a new Redis database named for example
   `boba-lab-preview`. Copy its REST URL and REST token. Make sure the name and URL differ from the live one.
2. In **Vercel**, project, Settings, **Environment Variables**, add two variables:
   `UPSTASH_REDIS_REST_URL` (type Config) and `UPSTASH_REDIS_REST_TOKEN` (type **Secret**).
   Environment: **Preview**, and limit it to the **branch `feature/rate-limit`** only.
   The code reads these names before the `KV_` ones, so set BOTH.
3. Also add `RATE_LIMIT_SALT` for the same Preview branch, with a different value from Production.
4. Variables only apply to new deployments. Open Deployments, the latest `feature/rate-limit`
   build, three-dot menu, **Redeploy**.
5. Check it is really separate:
   - Open the preview's `/api/results`. It should say `"configured":true` and `"total":0`.
   - Open the live site's `/api/results`: its total must be unchanged before and after your tests.
   - After 6 test answers from the preview, the 6th is refused. In the Upstash console for the
     NEW database, a key like `boba:v1:rl:<32 characters>` should exist with a TTL of about 86400
     seconds, and no key should contain your address.
6. To undo: delete the Preview variables, and delete the test database.

## Setting `RATE_LIMIT_SALT` securely

Nothing goes live until you merge and deploy. Adding the variable now changes nothing on the
live site, because the live code does not read it.

1. **Make the secret** (never in chat, GitHub, screenshots or the code). Any one of:
   - Terminal with Node: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Terminal with OpenSSL (Mac, Linux, Git Bash): `openssl rand -hex 32`
   - A password manager's generator, 32 or more characters.
   Copy it. It must be at least 16 characters, or the limit stays off.
2. **Add it in Vercel:** open the project, **Settings**, **Environment Variables**.
   - Name: `RATE_LIMIT_SALT`
   - Type: **Secret** (write-only after saving: nobody can read it back)
   - Value: paste
   - Environment: **Production** only
   - Click **Save**.
3. Do not tick **Development**: `npm run dev` uses its own throwaway salt.
4. For the Preview test database use a **different** value, limited to the branch. (If your team
   turns on the optional "Separate Production Secret Values" policy, Vercel requires this.)
5. **Redeploy to apply it:** variables only apply to new deployments. Production will pick it up
   when you approve the merge and deploy.
6. **Check it is on after launch:** send 6 answers from one network; the 6th must be refused.
   Also look in Vercel, Logs, for the warning "RATE_LIMIT_SALT is missing". There should be none.
7. **Rotating later:** edit the variable and paste a new value. Nothing breaks: everyone's
   counters simply start fresh.
8. Keep a copy only in a password manager. If it is lost, make a new one (step 7).

## Testing

- Automated: `npm test` (now 72 tests, including a pretend Upstash server).
- Local: `npm run dev` switches the limit on with a throwaway salt. Send 6 answers.
- Vercel preview: previews have no storage, so the survey shows "storage not configured"
  and the limit cannot be seen there until a separate test database is connected (see the
  section above). Never reuse the live database.

## Launch snapshot (READ-ONLY): what would a reset clear?

`scripts/snapshot.js` looks at every `boba:v1:*` key and reports what is there. It can only
send GET, HGETALL, SCAN, DBSIZE and TYPE; anything else is refused before it is sent.

1. In Upstash, copy the REST URL and the **read-only token** (it cannot write at all).
2. In a terminal, in the project folder (the values go in your terminal only, never in a file
   in the repo):
   ```
   export UPSTASH_REDIS_REST_URL="...paste..."
   export UPSTASH_REDIS_REST_TOKEN="...paste the READ-ONLY token..."
   node scripts/snapshot.js --expect 4 --save
   ```
   Replace 4 with how many test answers you remember sending (see the next paragraph).
3. Read the report. `MATCH` means the total equals your test count. `MISMATCH` means
   something else submitted, so **do not reset** until you know who.

The tool cannot tell test answers from real ones, because only totals exist by design.
That is why `--expect` exists: if the total equals your test count, nothing real can be in it.
A reset (`boba:v1:*`) would clear the counters and the short-lived limiter keys, and would
not touch any other keys in the database. It happens only after you approve it separately.
`snapshots/` is git-ignored: never commit snapshot files.

## Not in this change

No new product features, no changes to existing counters, no reset, no production changes.
