# Keeping Preview and Production data apart

One Upstash database is shared by the live site and by Preview deployments. Redis has no
folders, so the first part of each key name (the **namespace**) is the only thing separating
test data from live data. This page says exactly what the namespaces are, how the code
enforces them, what it cannot protect against, and what you do in Vercel.

## 1. Exact namespace configuration

| Environment | How it is recognised | Namespace (key prefix) | Example key |
|---|---|---|---|
| **Production** | `VERCEL_ENV` is exactly `production` | `boba:v1` (fixed in code, the existing keys, unchanged) | `boba:v1:total` |
| **Preview** | anything else, with a valid `PREVIEW_NAMESPACE` | `boba-preview:<label>:v1` | `boba-preview:rate-limit-test:v1:total` |
| **Preview, label missing or invalid** | | **none: storage is switched off** | no Redis command is sent |
| **This computer, no Redis credentials** | no `VERCEL`, no Upstash variables | temporary in-memory store | nothing is sent anywhere |
| **This computer WITH Redis credentials but no label** | | **none: storage is switched off** | |

A valid label: lowercase letters and digits, single hyphens between them, 3 to 40 characters.
Refused: capitals, spaces, `:`, `*`, `/`, empty values, and the reserved words `production`,
`prod`, `live`, `main`, `master`, `boba`, `default`. Because labels cannot contain `:`, a Preview
can never write a name that starts with `boba:v1:`, and `boba-preview:` keys can never match
`boba:v1:`.

All key kinds follow the namespace: totals, answer counters, regional counters, drink counters,
and the rate-limit counters (`<namespace>:rl:<32 hex>`).

## 2. How the rules are enforced (code: `lib/namespace.js`, `lib/store.js`)

1. **Production ignores Preview settings.** If `VERCEL_ENV === 'production'`, the namespace is
   `boba:v1` whatever `PREVIEW_NAMESPACE` says.
2. **Fail closed.** A non-Production environment with a missing or invalid label gets no namespace.
   Saving returns "storage not configured", results show "not configured", and nothing is sent to Redis.
   There is no fallback to `boba:v1`.
3. **A guard checks every batch of commands before it is sent.** Every key must start with
   `<this environment's namespace>:`. Only these commands are allowed from the website:
   `INCR, DECR, HINCRBY, EXPIRE, TTL, GET, HGETALL`. `FLUSHALL, KEYS, EVAL, SET, RENAME` and any
   other command are refused. One bad command stops the whole batch.
4. **One door to Redis.** Only `lib/store.js` talks to Redis, and only `lib/namespace.js` knows
   namespace names (a test fails if any other file hard-codes one).
5. **Reads, writes, rate limiting, snapshots and reset all use the same guard.**
   - `scripts/snapshot.js` needs `--production` or `--preview` (it never guesses), reads only,
     and counts the whole database (`DBSIZE`) only for a Production snapshot.
   - `scripts/reset-preview.js` can only name a Preview namespace. It has no Production option,
     refuses to run if `VERCEL_ENV` says production, is a dry run by default, and deleting needs
     `--delete --confirm <label>` typed exactly. **It has never been run against the real database.**
6. `/api/results` now includes `"storage": "production"` or `"storage": "preview"` (or `local`),
   so you can see which namespace a deployment is using. It reveals no secret.

## 3. Tests proving isolation (`test/isolation.test.js`, run with `npm test`)

A pretend Upstash database holds Production data (50 answers) and Preview data side by side,
and logs every command it receives. The tests show:

- A Preview saves answers only under its own prefix. Production keys are byte-for-byte unchanged,
  and **not one command even mentions a Production key**.
- A Preview's results start at 0 even though Production holds 50, so it cannot read Production numbers.
- A Preview's rate limiter uses Preview keys only. The Production limiter counter is untouched.
- A Preview with a missing or invalid label (27 bad examples) sends **zero** commands and Production is untouched.
- Direct attacks from a Preview (INCR, DECR, GET, HGETALL, HINCRBY, EXPIRE, DEL, FLUSHALL, FLUSHDB, KEYS, SCAN, DBSIZE, EVAL, SET, RENAME, mixed batches) are all refused before reaching Redis.
- The reverse: Production writes and reads only `boba:v1`, leaves every Preview namespace unchanged, ignores any `PREVIEW_NAMESPACE`, and direct attacks on Preview keys are refused.
- One Preview cannot see another Preview, including one whose label starts the same way (`test-a` vs `test-ab`).
- Only the exact word `production` selects Production; `Production`, `prod`, `staging`, and blank do not.
- Look-alike prefixes (`boba:v10:`, `boba:v1`, capitals) are refused.
- Snapshot and reset tools stay inside their namespace, refuse unsafe settings before sending anything, and never print credentials.
- Static checks: no other file hard-codes a namespace or talks to Redis directly.

## 4. Remaining security limitations (honest list)

1. **This is a rule in our code, not a wall in the database.** The Preview and Production share
   one Redis password. Anyone holding that token (or code that bypasses `lib/store.js`) can read
   or delete anything. Only a separate database or a separate token with its own permissions
   would remove this.
2. **Preview deployments run code from branches.** A future branch that changes `lib/namespace.js`
   or the guard, or any Preview that is given the live credentials, is only as safe as its review.
   Review changes to these files carefully before merging.
3. **Vercel decides `VERCEL_ENV`.** If a Production deployment were ever misreported, the
   namespace would be wrong. This is the same signal Vercel uses for its own environment variables.
4. **Shared quota and speed.** Preview traffic counts toward the same monthly command limit
   (500,000 on the Free plan) and the same database size.
5. **The scripts can still hurt Preview data** (by design). `reset-preview.js` deletes only Preview keys.
6. **Tests use a pretend Upstash server.** They have not yet been run against the real one.
   The Preview check in section 5 does that safely.
7. **Preview data is real data on a real server.** Never type real personal details into a Preview.
   It stores only aggregate counts and hashed rate-limit counters, like Production.
8. **Production still has no automatic backup of its own counters.** Use read-only snapshots.
9. **Existing Production test data is still there.** Clearing it is a separate step needing your approval.

## 5. Your steps in Vercel (nothing here touches Production)

Vercel: your project, **Settings**, **Environment Variables**. For each variable below, choose
**only the Preview environment**, and limit it to the branch `feature/rate-limit`.
Never tick Production or Development.

| Variable | Type | Value |
|---|---|---|
| `PREVIEW_NAMESPACE` | Config | `rate-limit-test` |
| `RATE_LIMIT_SALT` | **Secret** | a NEW random string, different from the one you will use in Production |
| `UPSTASH_REDIS_REST_URL` | Config | the REST URL of the existing database |
| `UPSTASH_REDIS_REST_TOKEN` | **Secret** | its token (read and write) |

Generate the salt: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Steps:

1. **Before anything**, take a read-only baseline of live data (use Upstash's read-only token):
   `node scripts/snapshot.js --production --save`. Note the `total`.
2. Add the four variables above, Preview only, branch `feature/rate-limit` only. Do **not**
   reconnect or re-tick Preview on the Upstash integration.
3. Variables apply only to new deployments: Deployments, latest `feature/rate-limit`, three dots, **Redeploy**.
4. Open the preview's `/api/results`. It must show `"storage":"preview"` and `"total":0`.
   If it says `"configured":false`, a variable is missing or the label is invalid (that is the
   fail-closed behaviour working).
5. Submit a few test answers on the preview. Submit 6 from one network: the 6th is refused.
6. Open the **live** site's `/api/results`: its total must be unchanged.
7. Take the snapshot again (`--production`): total and key counts must equal step 1. In the Upstash Data Browser, preview keys appear under `boba-preview:rate-limit-test:v1:`.
8. To clear Preview test data later: `PREVIEW_NAMESPACE=rate-limit-test node scripts/reset-preview.js`
   (dry run), then add `--delete --confirm rate-limit-test` if the list looks right.
9. To undo everything: delete the four Preview variables and redeploy.

Do not add anything to Production until you have reviewed the Preview and approved it.
When Production later gets `RATE_LIMIT_SALT`, it needs no `PREVIEW_NAMESPACE`; if one is there,
it is ignored.
