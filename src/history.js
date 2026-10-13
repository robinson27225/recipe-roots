import FOOD_HISTORY from '../data/foodhistory.js';
import { isUS } from './regions.js';

const applies = (entry, regionKeys) =>
  !entry.regions || entry.regions.some((r) => (r === 'usa' ? regionKeys.some(isUS) : regionKeys.includes(r)));

/**
 * Food-history notes overlapping [lo, hi] for the given regions. Place-specific notes are preferred (they say
 * more), then the notes nearest the middle of the window (so a long life isn't described only by its first
 * years); the result is in date order.
 */
export function kitchenHistory({ lo, hi, regionKeys }, limit = 3, entries = FOOD_HISTORY) {
  const hits = entries.filter((e) => e.from <= hi && e.to >= lo && applies(e, regionKeys));
  const middle = (lo + hi) / 2;
  const distance = (e) => Math.abs((Math.max(e.from, lo) + Math.min(e.to, hi)) / 2 - middle); // of the part of the note that overlaps
  const ranked = [...hits].sort((a, b) => Number(Boolean(b.regions)) - Number(Boolean(a.regions)) || distance(a) - distance(b) || a.from - b.from);
  return ranked.slice(0, limit).sort((a, b) => a.from - b.from);
}
