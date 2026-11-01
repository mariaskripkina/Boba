// A polite limit on how many answers can come from one network in one day.
//
// WHY: the results unlock once enough answers exist. Without a limit, one person
// could press "Answer again" ten times and unlock them alone.
//
// HOW (in plain words):
//   1. Find the visitor's network address (an "IP address", like 203.0.113.7).
//   2. Scramble it with a secret ingredient (RATE_LIMIT_SALT) into a short code.
//      The scrambling is one-way: from the code you cannot get the address back,
//      and without the secret nobody can even test guesses against it.
//   3. Keep a tiny counter under that code. The counter deletes ITSELF after 24 hours.
//   4. Over the limit? Politely say "try again tomorrow". Otherwise carry on.
//
// WHAT IS STORED: a scrambled code and a number (1 to 5), for at most 24 hours,
// in Upstash only. Never the address itself, never the answers, never the language.
//
// HONEST LIMITS: this discourages, it does not make cheating impossible. See
// docs/repeat-submissions.md.

import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { keyFor, runCommands } from './store.js';

export const WINDOW_SECONDS = 24 * 60 * 60; // the counter forgets itself after this
export const DEFAULT_LIMIT = 5;             // answers per network per window
const MIN_SALT_LENGTH = 16;                 // a short secret is too easy to guess

// ---- settings --------------------------------------------------------------

export function limitSettings(env = process.env) {
  const asked = Number.parseInt(env.RATE_LIMIT_MAX, 10);
  const limit = Number.isInteger(asked) && asked >= 1 && asked <= 100 ? asked : DEFAULT_LIMIT;
  const salt = typeof env.RATE_LIMIT_SALT === 'string' && env.RATE_LIMIT_SALT.length >= MIN_SALT_LENGTH
    ? env.RATE_LIMIT_SALT
    : null;
  return { limit, salt };
}

// ---- finding and tidying the network address ---------------------------------

// Vercel sets these headers itself and overwrites any value the visitor sends,
// so they can be trusted on Vercel (see docs/repeat-submissions.md).
// Locally there is no Vercel in front, so we fall back to the socket address.
export function clientAddress(req) {
  const headers = req.headers || {};
  for (const name of ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for']) {
    const raw = headers[name];
    const first = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim();
    if (first && isIP(first.split('%')[0])) return first;
  }
  const fromSocket = req.socket?.remoteAddress;
  return fromSocket && isIP(fromSocket.split('%')[0]) ? fromSocket : null;
}

// "2001:db8::1" -> eight numbers, so we can look at its parts.
function expandIPv6(address) {
  let text = address.split('%')[0].toLowerCase();
  const tail = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/); // "::ffff:1.2.3.4" style ending
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number);
    text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = rest ? rest.split(':') : [];
  const gap = rest === undefined ? [] : Array(Math.max(0, 8 - left.length - right.length)).fill('0');
  return [...left, ...gap, ...right].map((group) => parseInt(group, 16));
}

// Two edge cases matter here:
//   - IPv4 written the IPv6 way ("::ffff:1.2.3.4") is the SAME person as plain IPv4.
//   - One IPv6 connection owns a whole /64 block (billions of addresses), and phones
//     rotate through it on purpose. Counting the exact address would let one phone
//     dodge the limit, so we count the whole block (its first four groups).
export function normalizeAddress(address) {
  if (!address) return null;
  const kind = isIP(address.split('%')[0]);
  if (kind === 4) return `4:${address}`;
  if (kind !== 6) return null;

  const groups = expandIPv6(address);
  if (groups.length !== 8 || groups.some(Number.isNaN)) return null;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return `4:${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  }
  return `6:${groups.slice(0, 4).map((g) => g.toString(16).padStart(4, '0')).join(':')}`;
}

// The one-way scramble. HMAC-SHA256 with the secret salt, shortened to 32 characters.
export function scramble(normalized, salt) {
  return createHmac('sha256', salt).update(`rate-limit:v1:${normalized}`).digest('hex').slice(0, 32);
}

// ---- the check --------------------------------------------------------------

let warnedAboutSalt = false;

// Call once per real submission, before saving it.
// Returns { allowed: true, release } or { allowed: false, retryAfter }.
// `release()` hands the slot back if saving then fails, so a server hiccup does not
// use up one of the visitor's five.
export async function takeSlot(req, env = process.env) {
  const { limit, salt } = limitSettings(env);

  if (!salt) {
    // Fail open on purpose: a missing setting must not take the survey down.
    // But say so loudly in the logs, because the limit is NOT protecting anything.
    if (!warnedAboutSalt) {
      warnedAboutSalt = true;
      console.warn('RATE_LIMIT_SALT is missing or shorter than 16 characters, so repeat-submission limiting is OFF.');
    }
    return { allowed: true, release: async () => {} };
  }

  const normalized = normalizeAddress(clientAddress(req));
  if (!normalized) {
    // No usable address. We cannot limit this one, and we must NOT put all such
    // visitors into one shared bucket (that would block innocent people).
    return { allowed: true, release: async () => {} };
  }

  const key = keyFor(`rl:${scramble(normalized, salt)}`);
  try {
    const [count, secondsLeft] = await runCommands([['INCR', key], ['TTL', key]]);

    // A counter with no expiry would block someone forever, so we make sure it has
    // one. (This also repairs a counter if a past request stopped half-way.)
    let remaining = Number(secondsLeft);
    if (!(remaining > 0)) {
      await runCommands([['EXPIRE', key, WINDOW_SECONDS]]);
      remaining = WINDOW_SECONDS;
    }

    if (Number(count) > limit) return { allowed: false, retryAfter: remaining };

    return {
      allowed: true,
      release: async () => {
        try { await runCommands([['DECR', key]]); } catch { /* best effort */ }
      },
    };
  } catch (error) {
    // If the counter itself fails, let the answer through. Saving will then fail
    // by itself if storage is really down. Never log the address.
    console.error('rate limit check failed:', error.message);
    return { allowed: true, release: async () => {} };
  }
}
