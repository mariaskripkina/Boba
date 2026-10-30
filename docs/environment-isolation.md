# Keeping Preview and Production data apart

One Upstash database is shared by the live site and by Preview deployments. Redis has no
folders, so the first part of each key name (the **namespace**) is the only thing separating
test data from live data. This page says exactly what the namespaces are, how the code
enforces them, what it cannot protect against, and what you do in Vercel.

## 1. Exact namespace configuration

| Where it runs | Settings it sees | Result |
|---|---|---|
| **Production** | `VERCEL=1` **and** `VERCEL_ENV=production` | Namespace `boba:v1` (fixed in code, the existing keys, unchanged). `PREVIEW_NAMESPACE` is ignored. |
| **Vercel Preview or Development** | `VERCEL=1`, `VERCEL_ENV=preview` or `development`, valid `PREVIEW_NAMESPACE` | Namespace `boba-preview:<label>:v1`, e.g. `boba-preview:rate-limit-test:v1:total` |
| Vercel Preview/Development, label missing or invalid | | **Storage switched off.** No Redis command is sent. |
| **On Vercel, `VERCEL_ENV` missing or not exactly `production`/`preview`/`development`** | e.g. `Production`, `prod`, `staging`, empty | **Storage switched off**, even if a valid label is set. Never assumed to be Preview. |
| On Vercel with `VERCEL_ENV=production` but `VERCEL` not exactly `1` | | **Storage switched off** |
| **Not on Vercel**, no Redis credentials | | In-memory store only. Nothing is sent anywhere. |
| Not on Vercel, **with** Redis credentials, no label | | **Storage switched off** |
| Not on Vercel, with credentials and a valid label | | Real Redis, Preview namespace only |
| **Not on Vercel but `VERCEL_ENV=production`** (or any unexpected value) | | **Storage switched off.** "Production" is never trusted from a computer that is not Vercel. |

Production is selected by exactly one condition (`VERCEL === '1' && VERCEL_ENV === 'production'`).
A test tries 1,512 combinations of settings and proves nothing else ever selects it.

A valid label: lowercase letters and digits with single hyphens, 3 to 40 characters. Refused:
capitals, spaces, `:`, `*`, `/`, empty values, and the reserved words `production`, `prod`,
`live`, `main`, `master`, `boba`, `default`. A label can never make a key that starts with `boba:v1:`.

All key kinds follow the namespace: totals, answer counters, regional counters, drink counters,
and rate-limit counters (`<namespace>:rl:<32 hex>`).

## 2. How the rules are enforced (`lib/namespace.js`, `lib/store.js`)

1. **Fail closed.** No valid namespace means no storage. There is no fallback to `boba:v1`.
2. **A guard checks every batch of commands before it is sent.** One bad command stops the whole batch:
   - The command name must be on the allow-list. The website may only use
     `INCR, DECR, HINCRBY, EXPIRE, TTL, GET, HGETALL`. `FLUSHALL`, `KEYS`, `EVAL`, `SET`, `RENAME` and the like are refused.
   - **Exact arguments.** Each command must have exactly its own arguments and nothing more:
     `GET key`; `EXPIRE key seconds` (whole seconds, up to a year); `HINCRBY key field amount` (small whole number);
     `DEL` 1 to 100 keys; `DBSIZE` none. An extra argument (a smuggled second key, an option) is refused.
   - **Scans.** Only `SCAN <cursor> MATCH <namespace>:* [COUNT n]`, in that order. The pattern must equal the
     namespace pattern exactly; a second `MATCH`, any other option, or any other pattern is refused.
   - **Exact namespace.** Every key must start with `<namespace>:`, including the colon, and have something
     after it. `boba:v10:total`, `boba:v1total`, and `boba-preview:test-ab:v1:x` (for label `test-a`) are refused.
     Keys may contain only letters, digits and `: | . _ -`, so a key can never be a wildcard pattern.
   - **The namespace itself is validated.** The guard only works with `boba:v1` or `boba-preview:<valid label>:v1`.
3. **One door to Redis.** Only `lib/store.js` sends commands for the website, and it runs the guard first
   (the in-memory store is guarded too). The two admin scripts wrap their only sender directly in the guard.
4. **Only `lib/namespace.js` knows namespace names.**
5. `scripts/snapshot.js` needs `--production` or `--preview` and can only read (`GET, HGETALL, SCAN, TYPE`,
   plus `DBSIZE` for Production only). `scripts/reset-preview.js` can only name a Preview namespace, refuses to
   run if `VERCEL_ENV` says production, is a dry run by default, and deleting needs `--delete --confirm <label>`.
   **Neither has ever been run against the real database.**
6. `/api/results` includes `"storage": "production"`, `"preview"` or `"local"`, so you can see which namespace a
   deployment uses. When storage is switched off it says `"configured": false`.

## 3. Tests (`test/isolation.test.js`, run with `npm test`)

A pretend Upstash database holds Production data (50 answers) and Preview data side by side and logs every command:

- A Preview writes only under its own prefix; Production is unchanged and **not even mentioned in any command**.
  A Preview's results start at 0. Production, in turn, never touches any Preview namespace and ignores `PREVIEW_NAMESPACE`.
- Direct attacks from either side (INCR, DEL, FLUSHALL, KEYS, SCAN, EVAL, mixed batches) are refused before reaching Redis.
- **Regression tests for the review findings:** a SCAN with a second `MATCH` is refused (19 variants), and extra
  arguments on `GET`/`TYPE`/`INCR`/`DECR`/`HGETALL`/`TTL`/`DBSIZE` are refused. The old guard allowed these.
- Every command is tested for exactly its own argument count and types.
- Prefix confusion for Production (`boba:v10`, `boba:v1total`) and for Preview labels (`test-a` vs `test-ab`, `abc` vs `abcd`).
- Environment detection: every unexpected `VERCEL_ENV`, `VERCEL` not `1`, a computer claiming `production`, and an
  exhaustive check of 1,512 combinations proving that only `VERCEL=1` plus `VERCEL_ENV=production` reaches Production.
  End to end, a Vercel deployment with a missing or odd `VERCEL_ENV` sends **zero** commands even with a valid label.
- **Recursive repository scan:** across every file (not just `api/` and `lib/`), only `lib/upstash.js`, `lib/store.js`,
  `lib/namespace.js` and the two reviewed scripts may mention Redis or its settings; no other server file may use the network
  (the one exception is `isIP`, an address-format checker); the browser may only call `/api/survey` and `/api/results`;
  a new file in `scripts/` or any new package fails the test until it is reviewed.

## ## 4. Remaining security limitations (honest list)

1. **This is a rule in our code, not a wall in the database.** The Preview and Production share
   one Redis password. Anyone holding that token (or code that bypasses `lib/store.js`) can read
   or delete anything. Only a separate database or a separate token with its own permissions
   would remove this.
2. **Preview deployments run code from branches.** A future branch that changes `lib/namespace.js`
   or the guard, or any Preview that is given the live credentials, is only as safe as its review.
   Review changes to these files carefully before merging.
3. **We trust Vercel's `VERCEL` and `VERCEL_ENV`.** If Vercel itself misreported a deployment as production, the
   namespace would be wrong. A missing or odd value now switches storage off instead. Check once that
   Settings, Environment Variables, **"Automatically expose System Environment Variables"** is on; otherwise the live site would
   lose storage after a merge. Also check no custom variable named `VERCEL_ENV` exists on any environment.
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

0. **Check once, changes nothing:** Settings, Environment Variables. Make sure
   **"Automatically expose System Environment Variables"** is ticked (Vercel then provides `VERCEL` and
   `VERCEL_ENV` itself), and that the list contains **no variable you added called `VERCEL` or `VERCEL_ENV`**.
   If the setting were off, storage would be switched off everywhere (the safe direction).
1. **Before anything**, take a read-only baseline of live data (use Upstash's read-only token):
   `node scripts/snapshot.js --production --save`. Note the `total`.
2. Add the four variables above, Preview only, branch `feature/rate-limit` only. Do **not**
   reconnect or re-tick Preview on the Upstash integration.
3. Variables apply only to new deployments: Deployments, latest `feature/rate-limit`, three dots, **Redeploy**.
4. Open the preview's `/api/results`. It must show `"storage":"preview"` and `"total":0`.
   If it says `"configured":false`, a variable is missing, the label is invalid, or Vercel did not provide
   `VERCEL_ENV` (that is the fail-closed behaviour working; the server log shows the reason, never a secret).
5. Submit a few test answers on the preview. Submit 6 from one network: the 6th is refused.
6. Open the **live** site's `/api/results`: its total must be unchanged.
7. Take the snapshot again (`--production`): total and key counts must equal step 1. In the Upstash Data Browser, preview keys appear under `boba-preview:rate-limit-test:v1:`.
8. To clear Preview test data later: `PREVIEW_NAMESPACE=rate-limit-test node scripts/reset-preview.js`
   (dry run), then add `--delete --confirm rate-limit-test` if the list looks right.
9. To undo everything: delete the four Preview variables and redeploy.

Do not add anything to Production until you have reviewed the Preview and approved it.
When Production later gets `RATE_LIMIT_SALT`, it needs no `PREVIEW_NAMESPACE`; if one is there,
it is ignored.
