// WikiTree-sourced photos and cookbook recipes belong to the members who uploaded or wrote them, and
// a book that is sold needs their permission. So using them is gated, and the gate fails closed:
//
//   1. --me <WikiTree ID>      who is using the app. Checked against WikiTree: a real member account.
//   2. --honor-code-signed     attests the user is a Wiki Genealogist (an Honor Code signatory; see
//                              wikitree.com/wiki/Help:Membership). WikiTree shows this on the profile page
//                              but NOT in its API, and pages can't be read by a script, so the tool
//                              cannot verify it. It is recorded as an attestation, never as a fact.
//   3. --confirm-permission    the user has permission from each owner to reproduce the item in a book
//                              they may sell.
//
// Everything that is not WikiTree's (the curated dishes, the user's own scans, recipes and photos) is
// never gated. Enforcement beyond attestation needs WikiTree's help (an API field, or a login flow).
import { isWikiTreeId } from './wikitree.js';

const API = 'https://api.wikitree.com/api.php';

/** Is `id` a real WikiTree member account? Returns { ok, reason }. */
export async function checkMember(id, { fetchImpl = fetch } = {}) {
  if (!isWikiTreeId(id)) return { ok: false, reason: `"${id}" doesn't look like a WikiTree ID (for example Smith-123).` };
  try {
    const url = new URL(API);
    url.search = new URLSearchParams({ action: 'getProfile', key: id, fields: 'Name,IsMember,IsLiving', appId: 'RecipeRoots' });
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'RecipeRoots/0.1 (hacktoberfest side-hustle project)' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { ok: false, reason: `WikiTree API returned HTTP ${res.status}, so ${id} couldn't be checked.` };
    const profile = (await res.json())?.[0]?.profile;
    if (!profile?.Name) return { ok: false, reason: `No WikiTree profile found for ${id}.` };
    if (Number(profile.IsMember) !== 1) return { ok: false, reason: `${id} isn't a WikiTree member account.` };
    return { ok: true, name: profile.Name };
  } catch (e) {
    return { ok: false, reason: `Couldn't check ${id} with WikiTree (${e.message}).` };
  }
}

/**
 * Decide whether WikiTree photos and cookbook recipes may be used. All three conditions must hold.
 * Returns { allowed, me, reasons } where `reasons` lists everything still missing, in plain words.
 */
export async function evaluateGate({ me, honorCodeSigned = false, confirmPermission = false, fetchImpl } = {}) {
  const reasons = [];
  let member = { ok: false };
  if (!me) reasons.push('Say who you are with --me <your WikiTree ID>.');
  else {
    member = await checkMember(me, { fetchImpl });
    if (!member.ok) reasons.push(member.reason);
  }
  if (!honorCodeSigned) {
    reasons.push(`Using WikiTree photos or recipes is for Wiki Genealogists (Honor Code signatories). Your profile${me ? ` (wikitree.com/wiki/${me})` : ''} shows "Honor Code Signatory" if you are one. If so, pass --honor-code-signed. The tool can't check this itself: WikiTree doesn't expose it.`);
  }
  if (!confirmPermission) {
    reasons.push('Pass --confirm-permission to confirm you have the owner\'s permission to reproduce each photo and recipe in a book you may sell. The permissions.md ledger lists who to ask.');
  }
  return { allowed: reasons.length === 0, me: member.ok ? me : null, reasons };
}

/** A recipe is the user's own work when they are the member who contributed it. */
export const isOwnContribution = (recipe, me) => Boolean(me) && recipe.wikiTreerId === me;
