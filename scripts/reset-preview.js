// Clears the TEST data of ONE Preview namespace. It can never touch Production.
//
//   node scripts/reset-preview.js                              DRY RUN (the default): only lists
//   node scripts/reset-preview.js --delete --confirm <label>   really deletes
//
// Why it cannot touch Production:
//   - It only knows the Preview namespace "boba-preview:<label>:v1", built from
//     PREVIEW_NAMESPACE. There is no option, flag or setting that selects "boba:v1".
//   - A PREVIEW_NAMESPACE that is missing, invalid, or reserved ("production", "boba"...)
//     stops it before anything is sent.
//   - It refuses to run at all if VERCEL_ENV says "production".
//   - It can only send SCAN and DEL, and every key must start with the Preview namespace,
//     or the command is refused before it is sent (lib/namespace.js).
//   - Deleting needs --delete AND --confirm <label>, typed exactly. Typing the label proves
//     you meant THIS preview namespace.
//
// A reset of the LIVE counters is deliberately NOT part of this tool. That will only be
// built when you approve it, after a snapshot (scripts/snapshot.js --production).
//
// It reads the same two settings as the website: UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN (or the KV_REST_API_ names). It never prints them.

import { pathToFileURL } from 'node:url';
import { checkLabel, previewNamespace, guardedRunner } from '../lib/namespace.js';
import { upstashConfig, sendToUpstash } from '../lib/upstash.js';

export const RESET_COMMANDS = new Set(['SCAN', 'DEL']);

// Decide the target from the command line and settings, or explain why not.
export function chooseTarget(args, env = process.env) {
  if (env.VERCEL_ENV === 'production') {
    return { error: 'Refusing to run: this environment says it is Production.' };
  }
  const label = checkLabel(env.PREVIEW_NAMESPACE);
  if (!label.ok) return { error: `Refusing to run: ${label.reason}.` };

  const deleting = args.includes('--delete');
  if (deleting) {
    const at = args.indexOf('--confirm');
    const typed = at >= 0 ? args[at + 1] : undefined;
    if (typed !== label.label) {
      return { error: `To delete, type the label exactly:  --delete --confirm ${label.label}` };
    }
  }
  return { label: label.label, namespace: previewNamespace(label.label), deleting };
}

// Find every key in the namespace. Reads only.
export async function planReset(run, namespace) {
  const prefix = `${namespace}:`;
  const keys = [];
  let cursor = '0';
  do {
    const [[next, batch]] = await run([['SCAN', cursor, 'MATCH', `${prefix}*`, 'COUNT', 200]]);
    keys.push(...batch);
    cursor = String(next);
  } while (cursor !== '0');
  return [...new Set(keys)].filter((k) => k.startsWith(prefix)).sort();
}

// Delete exactly the given keys. Checks again that each one is inside the namespace,
// on top of the guard, so a mistake would have to get past two separate checks.
export async function executeReset(run, namespace, keys) {
  const prefix = `${namespace}:`;
  for (const key of keys) {
    if (!key.startsWith(prefix)) throw new Error('Refusing: a key outside the Preview namespace was in the list. Nothing was deleted.');
  }
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 50) {
    const [count] = await run([['DEL', ...keys.slice(i, i + 50)]]);
    deleted += Number(count) || 0;
  }
  const remaining = await planReset(run, namespace);
  return { deleted, remaining: remaining.length };
}

// ---- running it from the command line -----------------------------------------

async function main() {
  const target = chooseTarget(process.argv.slice(2));
  if (target.error) {
    console.error(target.error);
    process.exit(1);
  }
  const config = upstashConfig();
  if (!config) {
    console.error('No Upstash settings found. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN first.');
    process.exit(1);
  }

  const run = guardedRunner((commands) => sendToUpstash(config, commands), target.namespace, RESET_COMMANDS);
  const keys = await planReset(run, target.namespace);

  console.log(`Preview namespace: ${target.namespace}:*`);
  console.log(`Keys found in it:  ${keys.length}`);
  console.log('Production keys and every other namespace are never listed and never touched.');

  if (!target.deleting) {
    console.log('\nDRY RUN: nothing was deleted. To delete these keys, run:');
    console.log(`  node scripts/reset-preview.js --delete --confirm ${target.label}`);
    return;
  }
  const result = await executeReset(run, target.namespace, keys);
  console.log(`\nDeleted ${result.deleted} key(s). Keys left in this namespace: ${result.remaining}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Reset failed:', error.message);
    process.exit(1);
  });
}
