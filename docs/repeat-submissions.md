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
- **The site's privacy wording is now slightly out of date** (see the next section).
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

## Proposed wording changes (waiting for your approval, NOT applied)

Three sentences say or imply "only totals are saved". With this feature a scrambled code
exists for up to 24 hours, so they should change before the branch is merged:

| Where | Now | Proposed |
|---|---|---|
| Survey privacy line (`survey.privacy`) | No names, emails or exact locations. Only totals are saved, so nobody's individual answers exist anywhere. | No names, emails or exact locations. Answers only go into totals, so nobody's individual answers exist anywhere. To stop one person flooding the results, a scrambled code made from your network address is kept for 24 hours, then deleted. |
| Thanks note (`survey.thanksNote`) | Nothing about you was saved, only the totals went up. | Your answers were not saved, only the totals went up. |
| About page (`about.p3`) | ...The site saves only totals... | ...The site saves only totals. To stop repeat submissions it briefly keeps a scrambled, unreadable code made from your network address (never the address itself), which deletes itself within 24 hours... |

Russian and Uzbek versions follow in the translation stage, using the glossary.

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

## Setting it up (nothing goes live until you merge and deploy)

1. Make a secret (at least 16 characters). In a terminal:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Vercel: Project, Settings, Environment Variables, add **`RATE_LIMIT_SALT`**.
   Choose **Production** (previews have no storage). Tick "Sensitive" if offered.
   Adding it now changes nothing on the live site, because the current live code ignores it.
3. Optional: **`RATE_LIMIT_MAX`** (default 5, allowed 1 to 100).
4. If the salt is missing, the limit is simply OFF and a warning is logged.
   After launch, confirm it is on by sending 6 test answers from one network
   (use a throwaway moment, then clear counters only after your explicit approval).

## Testing

- Automated: `npm test` (now 72 tests, including a pretend Upstash server).
- Local: `npm run dev` switches the limit on with a throwaway salt. Send 6 answers.
- Vercel preview: previews have no storage, so the survey shows "storage not configured"
  and the limit cannot be seen there. To try it on a preview you would connect a separate,
  empty Upstash database to the Preview environment only. Do not reuse the live one.

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
