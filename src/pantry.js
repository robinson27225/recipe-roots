import PANTRY from '../data/pantry.js';
import CONTEXT from '../data/context.js';
import { isUS, REGIONS } from './regions.js';
import { searchDishes } from './db.js';

// Stable pseudo-random ordering so the same tree always yields the same book.
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/**
 * Choose recipes for a story: two from the homeland and one from the new home,
 * restricted to dishes plausible by the time of the move. `used` keeps dishes
 * from repeating across chapters.
 */
export function pickRecipes(story, used = new Set(), { pantry = PANTRY } = {}) {
  const fresh = (d) => !used.has(d.id);
  const order = (list) => [...list].sort((a, b) => hash(story.id + a.id) - hash(story.id + b.id));

  const origin = order(pantry.filter((d) => d.region === story.from.key && d.from <= story.hi && fresh(d)));
  const destRegions = isUS(story.to.key) ? [story.to.key, 'usa-general'] : [story.to.key];
  const dest = order(pantry.filter((d) => destRegions.includes(d.region) && d.from <= story.hi + 30 && fresh(d)));

  const picked = [
    ...spread(origin, 2).map((d) => ({ ...d, side: 'origin' })),
    ...spread(dest, 1).map((d) => ({ ...d, side: 'destination' })),
  ];
  // Top up to three from whichever side has spare dishes.
  for (const d of [...origin, ...dest]) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.id === d.id)) picked.push({ ...d, side: d.region === story.from.key ? 'origin' : 'destination' });
  }
  picked.forEach((d) => used.add(d.id));
  return picked;
}

/** Prefer dishes of different courses so a chapter isn't three soups. */
function spread(list, n) {
  const out = [];
  for (const d of list) {
    if (out.length >= n) break;
    if (!out.some((o) => o.course === d.course)) out.push(d);
  }
  for (const d of list) {
    if (out.length >= n) break;
    if (!out.includes(d)) out.push(d);
  }
  return out;
}

export function contextFor(story) {
  return CONTEXT.find((c) => c.region === story.from.key && c.from <= story.hi && c.to >= story.lo)?.text ?? null;
}

const ORIGIN_SLOTS = ['a hearty main dish or stew', 'a bread, baked good or dessert'];
const DEST_SLOTS = ['a comforting everyday dish'];

/**
 * Semantic version of pickRecipes: ask pgvector for the dishes closest to what a
 * family from this place and era might plausibly have cooked, one slot at a time
 * so a chapter isn't three soups. If the homeland has too few dishes in the pantry
 * (say, Denmark), widen to the nearest cuisines elsewhere and say so on the page.
 */
export async function pickRecipesSemantic(story, used, { db, embedder }) {
  const place = story.originPlace ? `${story.originPlace}, ${story.from.label}` : story.from.label;
  const destPlace = story.destPlace ? `${story.destPlace}, ${story.to.label}` : story.to.label;
  const originQueries = ORIGIN_SLOTS.map((w) => `${w} that a family from ${place} might have cooked around ${story.mid}`);
  const destQueries = DEST_SLOTS.map((w) => `${w} that a family living in ${destPlace} might have cooked around ${story.hi}`);
  const vectors = await embedder.embed([...originQueries, ...destQueries, `Traditional food of ${story.from.label}`]);
  const neighbourVec = vectors.at(-1);

  const taken = new Set(used);
  const picks = [];
  const take = (rows, extra) => {
    const hit = rows.find((r) => !taken.has(r.id));
    if (hit) { taken.add(hit.id); picks.push({ ...hit, ...extra }); }
    return Boolean(hit);
  };
  const destRegions = isUS(story.to.key) ? [story.to.key, 'usa-general'] : [story.to.key];

  for (const [i] of ORIGIN_SLOTS.entries()) {
    const own = await searchDishes(db, vectors[i], { regions: [story.from.key], maxYear: story.hi, exclude: [...taken], limit: 3 });
    if (!take(own, { side: 'origin' })) {
      // Place-only query: mixing in "a hearty main dish" made every country resolve to Cottage Pie.
      const near = await searchDishes(db, neighbourVec, { notRegions: [...destRegions, story.from.key], maxYear: story.hi, exclude: [...taken], limit: 3 });
      take(near, { side: 'origin', neighbour: true });
    }
  }
  const destVec = vectors[ORIGIN_SLOTS.length];
  take(await searchDishes(db, destVec, { regions: destRegions, maxYear: story.hi + 30, exclude: [...taken], limit: 3 }), { side: 'destination' });

  picks.forEach((d) => used.add(d.id));
  return picks;
}

export const regionLabel = (key) => REGIONS[key]?.label ?? key;
