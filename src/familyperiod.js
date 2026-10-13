// "The same dish, in print": for each family recipe, find how the public-domain cookbooks of the cook's own era and
// region wrote it up, using the same strict title matching as the chapter dishes. A cook's years and the places they
// were born and died stand in for a chapter's window and route. Nothing is invented: no match, no page.
import { regionOf, REGIONS } from './regions.js';
import { findPeriodReceipts, booksFor, excerpt } from './period.js';
import PERIOD_BOOKS from '../data/period-books.js';
import { queryWords, searchReceipts, acceptHit } from './receiptdb.js';
import { structureReceipt } from './modernize.js';
import { fetchStickers, stickerSignals } from './stickers.js';

const yearOf = (d) => { const y = parseInt(String(d ?? '').slice(0, 4), 10); return y > 0 ? y : null; };

/**
 * A family recipe's title as the cookbooks would have named the dish: "Nora's Oatmeal Cookies" -> "Oatmeal Cookies".
 * Possessives and family words are dropped; the dish words themselves are left alone.
 */
export function dishNameFrom(title) {
  return String(title)
    .replace(/\b[\p{L}]+['’]s\b/giu, ' ')
    .replace(/\b(grandma|grandmother|grandpa|grandfather|mom|mother|dad|father|aunt|uncle|nana|papaw|mamaw|family|favorite|favourite|best|old[- ]fashioned|famous|special|secret|homemade)\b/gi, ' ')
    .replace(/\s+/g, ' ').replace(/^[\s,&-]+|[\s,&-]+$/g, '').trim();
}

/** The window and route of a cook's adult life, shaped like a chapter's story, or null when we can't place them. */
export function storyFromCook(person) {
  const born = yearOf(person?.BirthDate), died = yearOf(person?.DeathDate);
  if (born == null && died == null) return null;
  const lo = (born ?? died - 70) + 15;
  const hi = Math.min(died ?? lo + 60, lo + 65);
  const from = regionOf(person.BirthLocation), to = regionOf(person.DeathLocation) ?? from;
  const start = from ?? to;
  if (!start) return null;
  const label = (r) => REGIONS[r.key]?.label ?? r.key;
  return { from: { key: start.key, label: label(start) }, to: { key: (to ?? start).key, label: label(to ?? start) }, lo, hi: Math.max(hi, lo), mid: Math.round((lo + Math.max(hi, lo)) / 2) };
}

/**
 * Attach `period` (the quotation, and its recipe layout where one can be made) to every family recipe that has a
 * readable cook and a matching dish in the cookbooks of their time and place.
 */
/**
 * No receipt in the era's books has this dish's name: look by hybrid search (keywords and meaning). A receipt that is
 * the same dish under another spelling is used as the dish itself; otherwise the closest one is accepted only if both
 * rankings agree, and is marked `similar`. Returns a period-shaped result, or null.
 */
export async function similarReceipt(recipe, name, story, { db, embedder, bm25 = true }) {
  const bookIds = booksFor(story).map((b) => b.id);
  if (!bookIds.length) return null;
  const [vector] = await embedder.embed([`${name}. ${recipe.ingredients.slice(0, 10).join('; ')}`]);
  // Keywords come from the dish's name alone: ingredient words match too many unrelated receipts. The vector
  // search sees the ingredients as well.
  const hits = await searchReceipts(db, { words: queryWords(name), vector, bookIds, bm25 });
  const found = acceptHit(hits, { name });
  const book = found && PERIOD_BOOKS.find((b) => String(b.id) === found.hit.book_id);
  return book ? { book, title: found.hit.title, text: excerpt(found.hit.body), similar: found.kind === 'similar' } : null;
}

export async function attachFamilyPeriods(recipes, { llm, offline = false, stickers = true, similar = null, log = () => {} } = {}) {
  let attached = 0;
  for (const r of recipes) {
    if (!r.person || r.pageOnly) continue;
    const story = storyFromCook(r.person);
    const name = dishNameFrom(r.title);
    if (!story || name.split(/\s+/).filter(Boolean).length === 0) continue;
    if (stickers) {
      const templates = await fetchStickers(r.person);
      story.tags = templates ? stickerSignals(templates).tags : new Set();
    }
    // "Apple Pie (double crust)": try the title as written, then without the bracketed note.
    const bare = name.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    let hit = null;
    for (const candidate of new Set([name, bare].filter(Boolean))) {
      const dish = { id: `family:${r.anchor ?? r.title}`, name: candidate };
      hit = (await findPeriodReceipts(story, [dish], { log })).get(dish.id);
      if (hit) break;
    }
    if (!hit && similar) { try { hit = await similarReceipt(r, name, story, similar); } catch (e) { log(`  similar-dish search failed for "${r.title}" (${e.message})`); } }
    if (!hit) continue;
    r.period = { ...hit, structured: await structureReceipt(hit.text, { llm, offline, log }) };
    attached++;
  }
  return attached;
}
