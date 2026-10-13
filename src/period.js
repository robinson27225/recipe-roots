// "How they wrote it": for a dish in a chapter, find the same dish in a public-domain cookbook from
// the ancestors' era and quote it VERBATIM, with the book, author and year. Heritage and era choose the
// books; matching is conservative and deterministic, and nothing is ever rewritten, so nothing is invented.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import PERIOD_BOOKS from '../data/period-books.js';
import { isUS } from './regions.js';

const UA = 'RecipeRoots/0.1 (hacktoberfest side-hustle project; polite, cached)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Where a book's plain text comes from. Gutenberg is the default; Internet Archive items use their OCR text. */
export const sourceOf = (book) => book.source ?? 'gutenberg';
const textUrl = (book) => (sourceOf(book) === 'archive'
  ? `https://archive.org/download/${book.id}/${book.file ?? `${book.id}_djvu.txt`}`
  : `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`);

/**
 * OCR text puts two spaces between words and splits words across lines ("straw-\nberry"). Collapse the spaces
 * (keeping a line's indentation, which marks centred headings) and rejoin split words.
 */
/** Edit distance, for recognising a running head the OCR has misread ("THE INTERNA TIONAL COOK BOOK"). */
function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const tmp = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
  }
  return row[b.length];
}
const lettersOnly = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

export function cleanOcr(text, book = {}) {
  const title = lettersOnly(book.title);
  const isRunningHead = (l) => { const t = lettersOnly(l); return Boolean(title) && t.length >= 8 && editDistance(t, title) <= Math.max(2, Math.floor(title.length * 0.12)); };
  return text
    .split('\n')
    .filter((l) => !/^\s*\d{1,4}\s*$/.test(l) && !isRunningHead(l))  // page numbers and running heads (even when misread)
    .join('\n')
    .replace(/^( *)(.*)$/gm, (_, indent, rest) => indent + rest.replace(/ {2,}/g, ' '))
    .replace(/([a-z])-[ \t]*\n(?=[a-z])/g, '$1')   // "tea- \nspoon" -> "teaspoon"
    .replace(/ +([;:,.!?])/g, '$1');                // OCR "up ; half" -> "up; half" (spacing only; no word is touched)
}

/** Download (once; cached) a book's plain text; returns the body without any Gutenberg wrapper, or null. */
export async function fetchBook(book, { cacheDir = '.cache', fetchImpl = fetch } = {}) {
  const kind = sourceOf(book);
  const file = path.join(cacheDir, kind, `${book.id}.txt`);
  let raw;
  try { raw = await readFile(file, 'utf8'); } catch { /* not cached */ }
  if (!raw) {
    for (let attempt = 1; attempt <= 3 && !raw; attempt++) {
      try {
        const res = await fetchImpl(textUrl(book), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120_000) });
        if (res.ok) raw = await res.text();
      } catch { /* retry */ }
      if (!raw) await sleep(2000 * attempt);
    }
    if (!raw) return null;
    try { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, raw); } catch { /* uncached is fine */ }
  }
  if (kind === 'archive') return cleanOcr(raw, book);
  const start = raw.search(/\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n/);
  const end = raw.search(/\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG/);
  return raw.slice(start >= 0 ? raw.indexOf('\n', start) + 1 : 0, end >= 0 ? end : undefined);
}

// Works published in the United States before this year are in the public domain there. (The line has since moved
// to 1931; 1926 is a conservative cut-off and what we enforce.) Undated books are only registered when the
// source itself has cleared them, as Project Gutenberg has.
export const PUBLIC_DOMAIN_BEFORE = 1926;
export const isPublicDomain = (book) => book.year == null || book.year < PUBLIC_DOMAIN_BEFORE;

const indentOf = (line) => line.match(/^ */)[0].length;
const isCaps = (s) => /[A-Z]/.test(s) && s === s.toUpperCase();

/**
 * Split a book into receipts. Heading styles seen in the books we use:
 *   BAKED INDIAN PUDDING.        an ALL-CAPS line ending in a period (Child, 1832)
 *        Indian Pudding          a centred Title Case line (Farmer, 1906)
 *   _To Stew Onions._--Peel...   an italic title opening the paragraph (Leslie, 1857)
 *   154. _Hot Cream Cakes._      a numbered line (The New England Cook Book, 1836)
 *   =Quick Icing.=               a title wrapped in equals signs (The Cookery Blue Book)
 * A heading must be followed by real text, which rules out table-of-contents lines.
 */
export function parseReceipts(text) {
  const split = text.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/^\n+/, '').replace(/\s+$/, '')).filter((p) => p.trim());
  // A sentence interrupted by a page break comes out as two paragraphs ("...one teaspoon" / "sugar, half a teaspoon...").
  // Rejoin when the first doesn't end a sentence and the second starts in lower case.
  const paras = [];
  for (const p of split) {
    const prev = paras.at(-1);
    if (prev && !/[.!?:;"”’)\]]\s*$/.test(prev) && /^[a-z]/.test(p.trim()) && prev.split('\n').length >= 1 && !/^\s{8,}/.test(prev)) paras[paras.length - 1] = `${prev}\n${p}`;
    else paras.push(p);
  }
  const clean = (t) => t.replace(/[_=*]/g, '').replace(/^\d+\.\s*/, '').replace(/[.:,\s]+$/, '').trim();
  // A heading is { title, inline } where `inline` is body text that shares the heading's paragraph.
  const heading = (p) => {
    const lines = p.split('\n');
    const first = lines[0].trim();
    const inlineItalic = p.match(/^_([^_\n]{3,60}?)[.,]?_[.,]?\s*(?:--|—|\.-|-)\s*([\s\S]+)$/); // _Title._--text
    if (inlineItalic) return { title: clean(inlineItalic[1]), inline: inlineItalic[2] };
    if (lines.length !== 1) return null;
    const t = first;
    if (t.length < 3 || t.length > 64) return null;
    const equals = t.match(/^=([^=]{3,60})=$/);                                               // =Quick Icing.=
    if (equals) return { title: clean(equals[1]) };
    const numbered = t.match(/^\d{1,4}\.\s+_?([A-Z][^_]{2,60}?)\.?_?$/);                      // 154. _Hot Cream Cakes._
    if (numbered) return { title: clean(numbered[1]) };
    if (isCaps(t.replace(/[.,—-]+$/, '')) && /^[A-Z][A-Z0-9 ,'’&()-]+\.?$/.test(t) && indentOf(lines[0]) <= 8) return { title: t.replace(/\.$/, '') };
    if (indentOf(lines[0]) >= 12 && !/[.:]$/.test(t) && /^[A-Z]/.test(t) && !/\d/.test(t.slice(0, 2))) return { title: t };
    return null;
  };
  const out = [];
  for (let i = 0; i < paras.length; i++) {
    const h = heading(paras[i]);
    if (!h) continue;
    const body = h.inline ? [h.inline] : [];
    for (let j = i + 1; j < paras.length && body.length < 10; j++) {
      if (heading(paras[j])) break;
      body.push(paras[j]);
    }
    // A list of headings (a table of contents) is not a receipt.
    const firstLines = (body[0] ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (firstLines.length >= 2 && firstLines.every((l) => l.length < 60 && isCaps(l.replace(/[.,]+$/, '')))) continue;
    const joined = body.join('\n\n');
    if (joined.replace(/\s+/g, ' ').length >= 40) out.push({ title: h.title, body: joined });
  }
  return out;
}

// ---- matching a dish to a receipt title ----
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'with', 'in', 'for', 'to', 'or', 'la', 'de', 'au']);
// Extra words a receipt title may carry and still be the same dish. Anything else (marrowfat, cream, rye, stewed...) means a different dish.
const HARMLESS = new Set(['baked', 'boston', 'old', 'fashioned', 'plain', 'common', 'good', 'nice', 'family', 'simple', 'new', 'england', 'i', 'ii', 'iii', 'iv', 'v', 'no', 'another', 'excellent', 'delicious']);
const deaccent = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const stem = (w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
export const tokens = (s) => deaccent(String(s).toLowerCase()).replace(/\([^)]*\)/g, ' ').split(/[^a-z]+/).filter((w) => w && !STOP.has(w)).map(stem);

// Names a dish went by, where the pantry's modern title differs from period wording.
const ALIASES = {
  'baked-beans': ['baked beans'], 'fish-chowder': ['chowder', 'fish chowder'], 'brown-bread': ['brown bread', 'boston brown bread'],
  'indian-pudding': ['indian pudding', 'baked indian pudding'], 'hasty-pudding': ['hasty pudding'], 'yorkshire-pudding': ['yorkshire pudding'],
  'welsh-rarebit': ['welsh rabbit', 'welsh rarebit'], 'shortbread': ['short bread', 'shortbread'], 'scotch-broth': ['scotch broth'],
  'bread-butter-pudding': ['bread and butter pudding'], 'cottage-pie': ['cottage pie', 'shepherd pie'], 'irish-stew': ['irish stew'],
  'apple-pie': ['apple pie'], 'chicken-and-noodles': ['chicken and noodles', 'chicken noodles'], 'sweet-potato-pie': ['sweet potato pie'], 'cornbread': ['corn bread', 'cornbread'],
  'fried-apples': ['fried apples'], 'apple-dumplings': ['apple dumplings'], 'buttermilk-biscuits': ['buttermilk biscuits', 'buttermilk biscuit'],
  'chicken-and-dumplings': ['chicken and dumplings', 'chicken with dumplings'],
  'scones': ['scones'], 'cornish-pasty': ['cornish pasty'], 'succotash': ['succotash'], 'buckwheat-cakes': ['buckwheat cakes', 'buckwheat pancakes'],
  'fried-mush': ['fried mush', 'corn meal mush', 'cornmeal mush'],
};

// Dishes where any extra word means a different dish (a baked casserole is not stewed chicken and noodles).
const STRICT = new Set(['chicken-and-noodles', 'chicken-and-dumplings']);

/** Names to try for a dish: its aliases, else its own title. */
export const namesFor = (dish) => ALIASES[dish.id] ?? [dish.name];

/**
 * Does this receipt title name this dish? Conservative: every word of one of the dish's names must be in
 * the title, and any extra words must be on a short list of harmless ones (baked, boston, I, II...), so
 * "Marrowfat Beans Baked" is not "Boston Baked Beans". Returns a score (higher is better) or 0.
 */
export function titleMatch(dish, receiptTitle) {
  const t = tokens(receiptTitle);
  if (!t.length) return 0;
  let best = 0;
  for (const name of namesFor(dish)) {
    const n = tokens(name);
    if (!n.length || !n.every((w) => t.includes(w))) continue;
    const extras = t.filter((w) => !n.includes(w));
    if (extras.length > 2 || extras.some((w) => !HARMLESS.has(w)) || (STRICT.has(dish.id) && extras.length)) continue;
    best = Math.max(best, 1 - extras.length * 0.25);
  }
  return best;
}

/**
 * Quote at paragraph boundaries; never edit a word. Italic underscores are markup, not text.
 * A receipt that opens with an ingredient list always keeps its method with it. Long quotations are
 * cut at a sentence end and marked with an ellipsis, never silently.
 */
export function excerpt(body, max = 1400) {
  const asText = (s) => {
    const lines = s.replace(/_/g, '').replace(/\[[A-Za-z0-9*]{1,3}\]/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
    const listLike = lines.length >= 3 && lines.every((l) => l.length < 48) && lines.reduce((n, l) => n + l.length, 0) / lines.length < 36;
    return { text: (listLike ? lines.join('\n') : lines.join(' ')).replace(/[ \t]+/g, ' '), listLike };
  };
  const paras = body.split(/\n\s*\n/).map(asText).filter((p) => p.text && !/^[\s*·•☸_—-]+$/.test(p.text)); // drop section ornaments (* * * * *)
  const must = paras[0]?.listLike ? 2 : 1; // an ingredient list is useless without its method
  const kept = [];
  let len = 0;
  for (const p of paras) {
    if (kept.length >= must && len + p.text.length > max) break;
    kept.push(p.text); len += p.text.length;
  }
  let text = kept.join('\n\n');
  if (text.length > max * 1.3) { // an enormous paragraph: stop at a sentence end and say so
    const cut = text.slice(0, max).lastIndexOf('. ');
    text = `${text.slice(0, cut > 200 ? cut + 1 : max)} …`;
  } else if (kept.length < paras.length) text += ' …';
  return text;
}

/**
 * Books whose heritage and era fit the story. A book written for the story's own region comes before a
 * general American one; within each group, nearest in time first. An undated book matches on region alone.
 */
export function booksFor(story, books = PERIOD_BOOKS) {
  const regions = new Set([story.from.key, story.to.key]);
  const us = [...regions].some(isUS);
  // Heritage tags come from stickers on the profiles themselves (see stickers.js). A book can speak for a tag
  // (`tags`: offered for its region OR for that tag) or exist only for it (`onlyWith`: offered for nothing else).
  const hasTag = (list) => (list ?? []).some((t) => story.tags?.has(t));
  const specific = (b) => b.regions.some((r) => regions.has(r)) || hasTag(b.tags) || hasTag(b.onlyWith);
  const general = (b) => us && b.regions.includes('usa-general');
  const eligible = (b) => (b.onlyWith ? hasTag(b.onlyWith) : specific(b) || general(b));
  const distance = (b) => (b.year == null ? 40 : Math.abs(b.year - story.mid));
  return books
    .filter(isPublicDomain) // defence in depth: never offer a book that isn't cleared
    .filter(eligible)
    .filter((b) => b.year == null || (b.year >= story.lo - 60 && b.year <= story.hi + 60))
    .sort((x, y) => Number(!specific(x)) - Number(!specific(y)) || distance(x) - distance(y));
}

/**
 * For each dish, the first matching receipt in an era- and region-appropriate book, as
 * { book, title, text }. Network trouble just means fewer (or no) quotations.
 */
export async function findPeriodReceipts(story, dishes, { books = PERIOD_BOOKS, cacheDir = '.cache', fetchImpl = fetch, log = () => {} } = {}) {
  const found = new Map();
  for (const book of booksFor(story, books)) {
    if (found.size === dishes.length) break;
    const text = await fetchBook(book, { cacheDir, fetchImpl });
    if (!text) { log(`  period cookbook "${book.title}" couldn't be fetched; skipping it`); continue; }
    const receipts = parseReceipts(text);
    for (const dish of dishes) {
      if (found.has(dish.id)) continue;
      const hit = receipts.map((r) => ({ r, s: titleMatch(dish, r.title) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0];
      if (hit) found.set(dish.id, { book, title: hit.r.title, text: excerpt(hit.r.body) });
    }
  }
  return found;
}
