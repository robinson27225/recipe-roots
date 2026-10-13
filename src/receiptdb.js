// The receipt library: every receipt from the public-domain cookbooks, searchable in Postgres.
//
// Strict title matching (period.js) finds the SAME dish. This finds the CLOSEST dish when there isn't one, by
// hybrid search: BM25 keyword ranking (Tiger Data's pg_textsearch) and vector similarity (pgvector), fused with
// Reciprocal Rank Fusion in SQL. A receipt is only offered as "a similar dish" when BOTH rankings put it near the
// top (see acceptSimilar), and the book labels it as not the same dish.
//
// Without the pg_textsearch extension (a plain local Postgres) the keyword half falls back to Postgres's built-in
// full-text search, so the tool still works; Tiger Cloud uses BM25.
import PERIOD_BOOKS from '../data/period-books.js';
import { fetchBook, parseReceipts, isPublicDomain } from './period.js';
import { toVector } from './db.js';

const BODY_MAX = 6000;       // characters of a receipt kept
const DOC_CHARS = 700;       // characters of a receipt that are searched
export const RRF_K = 60;

/** The text that is searched for a receipt: its title, then the start of its body. */
export const receiptDoc = (r) => `${r.title}. ${String(r.body).replace(/\s+/g, ' ').slice(0, DOC_CHARS)}`;

const STOP = new Set('a an and the of with in for to or on at from by is are be it its this that as then until into over add put let take set make cup cups tsp tbsp teaspoon teaspoons tablespoon tablespoons pound pounds ounce ounces oz lb lbs pinch half quart pint gill piece pieces minutes minute hour hours quarter one two three four five six seven eight nine ten some little very well'.split(' '));

/** Content words of a recipe (title first, then ingredients): the keyword half of the query. */
export function queryWords(title, ingredients = []) {
  const words = (s) => String(s).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  const seen = new Set();
  const out = [];
  for (const w of [...words(title), ...words(title), ...ingredients.flatMap(words)]) if (!seen.has(w)) { seen.add(w); out.push(w); }
  return out.slice(0, 24);
}

export async function hasBm25(db) {
  try {
    const { rows } = await db.query("SELECT 1 FROM pg_available_extensions WHERE name = 'pg_textsearch'");
    return rows.length > 0;
  } catch { return false; }
}

/** Create the table and indexes (rebuilding when the embedding model or dimension changed). Returns { bm25 }. */
export async function ensureReceiptSchema(db, embedder, dim) {
  await db.query('CREATE EXTENSION IF NOT EXISTS vector');
  await db.query('CREATE TABLE IF NOT EXISTS rr_meta (key text PRIMARY KEY, value text NOT NULL)');
  let bm25 = false;
  if (await hasBm25(db)) {
    try { await db.query('CREATE EXTENSION IF NOT EXISTS pg_textsearch'); bm25 = true; } catch { bm25 = false; }
  }
  const wanted = `${embedder.model}|${dim}|2`;     // |2: book ids are text (an Internet Archive id isn't a number)
  const { rows } = await db.query("SELECT value FROM rr_meta WHERE key = 'receipt_embedding'");
  if (rows[0]?.value !== wanted) {
    await db.query('DROP TABLE IF EXISTS receipts');
    await db.query(`CREATE TABLE receipts (
      id text PRIMARY KEY, book_id text NOT NULL, book_title text NOT NULL, year int, regions text[] NOT NULL,
      title text NOT NULL, body text NOT NULL, doc text NOT NULL, embedding vector(${dim}) NOT NULL,
      tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', doc)) STORED)`);
    await db.query('CREATE INDEX receipts_book ON receipts (book_id)');
    await db.query('CREATE INDEX receipts_tsv ON receipts USING gin (tsv)');
    await db.query("INSERT INTO rr_meta VALUES ('receipt_embedding', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [wanted]);
  }
  if (bm25) await db.query("CREATE INDEX IF NOT EXISTS receipts_bm25 ON receipts USING bm25 (doc) WITH (text_config = 'english')");
  return { bm25 };
}

/**
 * Parse every public-domain book and load its receipts with embeddings. A book that can't be fetched is skipped and
 * reported. Returns { books: [{ id, title, receipts }], total, bm25 }.
 */
export async function ingestReceipts(db, embedder, { books = PERIOD_BOOKS, cacheDir = '.cache', fetchImpl = fetch, log = () => {} } = {}) {
  const loaded = [];
  let schema = null;
  for (const book of books.filter(isPublicDomain)) {
    const text = await fetchBook(book, { cacheDir, fetchImpl });
    if (!text) { log(`  ${book.title}: couldn't be fetched, skipped`); loaded.push({ id: book.id, title: book.title, receipts: 0 }); continue; }
    const receipts = parseReceipts(text).map((r) => ({ ...r, body: r.body.slice(0, BODY_MAX) }));
    if (!receipts.length) { log(`  ${book.title}: no receipts read, skipped`); loaded.push({ id: book.id, title: book.title, receipts: 0 }); continue; }
    const vectors = await embedder.embed(receipts.map(receiptDoc));
    schema ??= await ensureReceiptSchema(db, embedder, vectors[0].length);
    await db.query('BEGIN');
    try {
      await db.query('DELETE FROM receipts WHERE book_id = $1', [String(book.id)]);
      // Batches, because over a network (Tiger Cloud) one round trip per receipt would take a long time.
      for (let start = 0; start < receipts.length; start += 200) {
        const part = receipts.slice(start, start + 200);
        await db.query(
          `INSERT INTO receipts (id, book_id, book_title, year, regions, title, body, doc, embedding)
           SELECT id, $2, $3, $4, $5::text[], title, body, doc, embedding::vector
             FROM unnest($1::text[], $6::text[], $7::text[], $8::text[], $9::text[]) AS t(id, title, body, doc, embedding)`,
          [part.map((_, i) => `${book.id}:${start + i}`), String(book.id), book.title, book.year ?? null, book.regions,
            part.map((r) => r.title), part.map((r) => r.body), part.map(receiptDoc), vectors.slice(start, start + 200).map(toVector)],
        );
      }
      await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK'); throw e; }
    log(`  ${book.title}: ${receipts.length} receipts`);
    loaded.push({ id: book.id, title: book.title, receipts: receipts.length });
  }
  return { books: loaded, total: loaded.reduce((n, b) => n + b.receipts, 0), bm25: schema?.bm25 ?? false };
}

/** What is in the library, or null if it hasn't been loaded. */
export async function receiptInfo(db) {
  try {
    const { rows } = await db.query("SELECT value FROM rr_meta WHERE key = 'receipt_embedding'");
    if (!rows[0]) return null;
    const { rows: n } = await db.query('SELECT count(*)::int AS n, count(DISTINCT book_id)::int AS books FROM receipts');
    const bm25 = (await db.query("SELECT 1 FROM pg_indexes WHERE indexname = 'receipts_bm25'")).rows.length > 0;
    return { model: rows[0].value.split('|')[0], count: n[0].n, books: n[0].books, bm25 };
  } catch { return null; }
}

/**
 * Hybrid search within the given books. Two ranked lists (keywords, vectors), each over the same filtered rows,
 * fused by Reciprocal Rank Fusion. Returns [{ id, book_id, title, body, bm_rank, vec_rank, rrf }] best first;
 * a rank is null when that list didn't contain the receipt.
 */
export async function searchReceipts(db, { words, vector, bookIds, bm25 = true, pool = 30, limit = 5 }) {
  if (!words.length || !bookIds.length) return [];
  const keyword = bm25
    ? { rank: "ORDER BY r.doc <@> to_bm25query($1::text, 'receipts_bm25')", where: '' , param: words.join(' ') }
    : { rank: 'ORDER BY ts_rank_cd(r.tsv, to_tsquery(\'english\', $1)) DESC', where: 'AND r.tsv @@ to_tsquery(\'english\', $1)', param: words.join(' | ') };
  const { rows } = await db.query(
    `WITH kw AS (
       SELECT r.id, ROW_NUMBER() OVER (${keyword.rank}) AS rank
         FROM receipts r WHERE r.book_id = ANY($2) ${keyword.where}
         ${keyword.rank} LIMIT $4),
     vec AS (
       SELECT r.id, ROW_NUMBER() OVER (ORDER BY r.embedding <=> $3::vector) AS rank
         FROM receipts r WHERE r.book_id = ANY($2)
         ORDER BY r.embedding <=> $3::vector LIMIT $4)
     SELECT r.id, r.book_id, r.title, r.body, kw.rank AS bm_rank, vec.rank AS vec_rank,
            COALESCE(1.0 / (${RRF_K} + kw.rank), 0) + COALESCE(1.0 / (${RRF_K} + vec.rank), 0) AS rrf
       FROM receipts r LEFT JOIN kw ON kw.id = r.id LEFT JOIN vec ON vec.id = r.id
      WHERE kw.id IS NOT NULL OR vec.id IS NOT NULL
      ORDER BY rrf DESC LIMIT $5`,
    [keyword.param, bookIds.map(String), toVector(vector), pool, limit],
  );
  return rows.map((r) => ({ ...r, bm_rank: r.bm_rank == null ? null : Number(r.bm_rank), vec_rank: r.vec_rank == null ? null : Number(r.vec_rank), rrf: Number(r.rrf) }));
}

// Words that say when or why a dish was made, not what it is.
const GENERIC = new Set('dinner supper lunch luncheon breakfast dessert sunday holiday christmas easter special surprise delight treat dish meal favorite favourite family party summer winter quick easy simple best old fashioned homemade company'.split(' '));

const letters = (t) => String(t).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/[^a-z]/g, '');

/** Edit distance, stopping early once it exceeds `max`. */
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...row) > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * Is this receipt title the same dish under another spelling? "Shoofly Pie" / "SHOO-FLY PIE", "Spaetzle" /
 * "SPAETZLEN OR SPATZEN". Compares letters only (umlauts and ae/oe/ue folded), allows one slip in a name of six
 * letters or more, and checks each alternative of a title written "X or Y". Anything looser is not this function's job.
 */
export function variantSpelling(name, receiptTitle) {
  const a = letters(name);
  if (!a) return false;
  return String(receiptTitle).split(/\s+(?:or|and)\s+|[,;/]/i).some((alt) => {
    const b = letters(alt);
    return b && (a === b || (a.length >= 6 && b.length >= 6 && editDistance(a, b, 1) <= 1));
  });
}

/**
 * Decide what a search found. `same`: a receipt under another spelling of the dish's name, best-ranked by the
 * vector search; `similar`: both rankings put it near the top and it shares a content word with the name. Nothing
 * weaker is offered. Returns { hit, kind } or null.
 */
export function acceptHit(hits, { name = '', top = 5, names = [name] } = {}) {
  const same = hits.filter((h) => h.vec_rank != null && h.vec_rank <= 3 && names.some((n) => variantSpelling(n, h.title)))
    .sort((a, b) => a.vec_rank - b.vec_rank)[0];
  if (same) return { hit: same, kind: 'same' };
  // The title must share the dish's own words, not just a place, an ingredient or a mealtime ("Swedish", "Blueberry",
  // "Dinner"): two of them when the name has two or more, and always its last one, the dish's noun.
  const stem = (w) => w.replace(/(?:es|s)$/, '');
  const mine = queryWords(String(name).replace(/\([^)]*\)/g, ' ')).filter((w) => !GENERIC.has(w));
  const head = mine.at(-1);
  const need = Math.min(2, mine.length);
  const similar = head && hits.find((h) => {
    if (h.bm_rank == null || h.vec_rank == null || h.bm_rank > top || h.vec_rank > top) return false;
    const theirs = new Set(queryWords(h.title).map(stem));
    return theirs.has(stem(head)) && mine.filter((w) => theirs.has(stem(w))).length >= need;
  });
  return similar ? { hit: similar, kind: 'similar' } : null;
}
