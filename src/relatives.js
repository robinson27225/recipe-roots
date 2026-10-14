// Recipes can come from anyone in the family, not just the direct line: great-aunts,
// great-uncles, a grandmother's sister. Public WikiTree profiles outside the
// ancestor line are looked up on demand and described by where their parents sit.
import { fetchAncestry, FIELDS, WikiTreeError } from './wikitree.js';
import { generations, displayName, relationLabel } from './migrations.js';

const living = (p) => p?.IsLiving === 1 || p?.IsLiving === '1';

export function siblingLabel(g, gender) {
  const sib = gender === 'Female' ? 'sister' : gender === 'Male' ? 'brother' : 'sibling';
  if (g === 0) return sib;
  const au = gender === 'Female' ? 'aunt' : gender === 'Male' ? 'uncle' : 'aunt or uncle';
  if (g === 1) return au;
  if (g === 2) return `great-${au}`;
  return `${g - 1}x great-${au}`;
}

/**
 * Label for someone outside the direct line. A person whose parent is a direct
 * ancestor at generation gp is a sibling of the ancestor at gp-1, so an aunt,
 * great-aunt and so on. Anyone we can't place that way is simply "relative".
 */
export function relativeRelation(person, gens) {
  const known = [person.Father, person.Mother].map((id) => gens.get(id)).filter((g) => g !== undefined);
  if (!known.length) return 'relative';
  const gp = Math.min(...known);
  if (gp === 0) return person.Gender === 'Female' ? 'daughter' : person.Gender === 'Male' ? 'son' : 'child';
  return siblingLabel(gp - 1, person.Gender);
}

/**
 * Find a person by WikiTree ID: in the ancestor line, or else fetched from WikiTree
 * (with two generations of their own ancestors so a fan chart can be drawn).
 * Returns { person, relation, direct, people } where `people` includes anything newly
 * fetched, or null when they can't be found or are living.
 */
export async function resolvePerson(wikiTreeId, people, rootId, { fetchImpl, cacheDir, allowLiving = null } = {}) {
  // A living person is only ever returned when the family said so ("permission": true): then as a copy flagged
  // PermittedLiving, which the book treats gently (no dates or places, only name, relation, parents and photo).
  const permitted = (p) => ({ ...p, PermittedLiving: true });
  const mayShow = (p) => !living(p) || allowLiving?.has(wikiTreeId);
  const gens = generations(people, rootId);
  const inLine = [...people.values()].find((p) => p.Name === wikiTreeId);
  if (inLine) {
    if (!mayShow(inLine)) return null;
    return { person: living(inLine) ? permitted(inLine) : inLine, relation: relationLabel(gens.get(inLine.Id), inLine.Gender), direct: true, people };
  }
  let fetched;
  try { fetched = await fetchAncestry(wikiTreeId, { generations: 2, fetchImpl, cacheDir }); }
  catch (e) { if (e instanceof WikiTreeError) return null; throw e; }
  const person = fetched.people.get(fetched.rootId);
  if (!person || !mayShow(person)) return null;
  const merged = new Map([...fetched.people, ...people]); // the main tree wins on any overlap
  return { person: living(person) ? permitted(person) : person, relation: relativeRelation(person, gens), direct: false, people: merged };
}

/** Siblings of every ancestor (aunts, uncles, great-aunts...), via one batched API call per 100. */
export async function listRelatives(people, rootId, { fetchImpl = fetch } = {}) {
  const gens = generations(people, rootId);
  const names = [...gens.keys()].map((id) => people.get(id)?.Name).filter(Boolean);
  const found = [];
  for (let i = 0; i < names.length; i += 100) {
    const url = new URL('https://api.wikitree.com/api.php');
    url.search = new URLSearchParams({ action: 'getRelatives', keys: names.slice(i, i + 100).join(','), getSiblings: '1', fields: FIELDS, appId: 'RecipeRoots' });
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'RecipeRoots/0.1 (hacktoberfest side-hustle project)' }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new WikiTreeError(`WikiTree API returned HTTP ${res.status}.`);
    const body = (await res.json())[0];
    for (const item of body?.items ?? []) {
      const anchor = item.person;
      for (const s of Object.values(anchor?.Siblings ?? {})) {
        if (living(s) || !s.Name || people.has(s.Id)) continue; // already in the direct line, or living
        found.push({ wikiTreeId: s.Name, name: displayName(s), relation: siblingLabel(gens.get(anchor.Id) ?? 0, s.Gender), siblingOf: displayName(anchor), born: s.BirthDate, died: s.DeathDate });
      }
    }
  }
  return found;
}
