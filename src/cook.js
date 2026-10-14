// A cook's page: who they were and the world they cooked in, built only from what the tree says.
// Nothing here is written by a model. The personal story is the family's own words (family-people.json).
import { displayName } from './migrations.js';
import { regionOf, placeOf } from './regions.js';
import { kitchenHistory } from './history.js';

const yearOf = (d) => { const y = parseInt(String(d ?? '').slice(0, 4), 10); return y > 0 ? y : null; };
const living = (p) => p?.IsLiving === 1 || p?.IsLiving === '1';

/** Whole years between two full dates (YYYY-MM-DD), or null when either is only a year or partly unknown. */
export function ageAtDeath(birthDate, deathDate) {
  const full = (d) => /^\d{4}-(?!00)\d{2}-(?!00)\d{2}$/.test(String(d ?? ''));
  if (!full(birthDate) || !full(deathDate)) return null;
  const b = new Date(`${birthDate}T00:00:00Z`), d = new Date(`${deathDate}T00:00:00Z`);
  if (Number.isNaN(+b) || Number.isNaN(+d) || d < b) return null;
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** "Born in 1903 in Audubon, Iowa, to George and Kathleen. Died in 1958 in El Monte, California, aged 55." */
export function lifeSentence({ born, bornDecade, birthPlace, parents = [], died, deathPlace, age }) {
  const parts = [];
  if (born || bornDecade || birthPlace) {
    let s = 'Born';
    if (born) s += ` in ${born}`; else if (bornDecade) s += ` in the ${bornDecade}`;
    if (birthPlace) s += `${born ? ' in' : ' in'} ${birthPlace}`;
    if (parents.length) s += `, to ${parents.join(' and ')}`;
    parts.push(s);
  } else if (parents.length) parts.push(`Child of ${parents.join(' and ')}`);
  if (died || deathPlace) {
    let s = 'Died';
    if (died) s += ` in ${died}`;
    if (deathPlace) s += ` in ${deathPlace}`;
    if (age != null) s += `, aged ${age}`;
    parts.push(s);
  }
  return parts.length ? `${parts.join('. ')}.` : '';
}

/**
 * Everything a cook's opening page shows.
 *   person: the WikiTree person (non-living), people: the tree, chapters: the book's chapters (to link a move),
 *   note: the family's own words about this cook, { story } from family-people.json.
 */
export function cookProfile({ person, people, chapters = [], note = null, relation = null, name = null }) {
  // A living person the family agreed to name: name, relation, parents and photo, but no dates or places.
  const keepPrivate = person.PermittedLiving === true;
  // WikiTree shows a living person's birth decade publicly ("1930s"): used for the kitchen-history window, and printed as the decade.
  const decade = keepPrivate && /^\d{3}0s$/.test(person.BirthDateDecade ?? '') ? person.BirthDateDecade : null;
  const bornApprox = decade ? Number(decade.slice(0, 4)) + 5 : null;
  const born = keepPrivate ? null : yearOf(person.BirthDate), died = keepPrivate ? null : yearOf(person.DeathDate);
  const parents = [person.Father, person.Mother].map((id) => people.get(id)).filter((p) => p && !living(p)).map(displayName);
  const birthPlace = keepPrivate ? null : placeOf(person.BirthLocation), deathPlace = keepPrivate ? null : placeOf(person.DeathLocation);
  const lifeStart = born ?? bornApprox ?? (died ? died - 70 : null);
  const lo = lifeStart != null ? lifeStart + 12 : null;
  const hi = died ?? (born != null ? born + 75 : bornApprox != null ? Math.min(bornApprox + 75, new Date().getFullYear()) : null);
  // A permitted living person's own places stay private, so the kitchen history follows where their (deceased) parents lived.
  const parentPlaces = (people.size && [person.Father, person.Mother].map((id) => people.get(id)).filter((p) => p && !living(p))) || [];
  const regionKeys = keepPrivate
    ? [...new Set(parentPlaces.flatMap((p) => [regionOf(p.BirthLocation)?.key, regionOf(p.DeathLocation)?.key]).filter(Boolean))]
    : [regionOf(person.BirthLocation)?.key, regionOf(person.DeathLocation)?.key].filter(Boolean);
  const kitchen = lo != null && hi != null && hi >= lo ? kitchenHistory({ lo, hi: Math.min(hi, lo + 75), regionKeys }, 3) : [];
  const n = chapters.findIndex((c) => c.story.people.some((p) => p.id === person.Id));
  const chapter = n >= 0 ? { number: n + 1, from: chapters[n].story.from.label, to: chapters[n].story.to.label, lo: chapters[n].story.lo, hi: chapters[n].story.hi } : null;
  return {
    name: name ?? displayName(person), relation, born, bornApprox, died, birthPlace, deathPlace, parents,
    years: born || died ? `${born ?? '?'}–${died ?? '?'}` : decade ? `born in the ${decade}` : '',
    life: lifeSentence({ born, bornDecade: decade, birthPlace, parents, died, deathPlace, age: keepPrivate ? null : ageAtDeath(person.BirthDate, person.DeathDate) }),
    kitchen, chapter, story: note?.story ?? null,
  };
}

/** Cooks in the order the book presents them: oldest first, people with no birth year last. */
export function sortCooks(cooks) {
  return [...cooks].sort((a, b) => (a.born ?? 9999) - (b.born ?? 9999) || a.name.localeCompare(b.name));
}
