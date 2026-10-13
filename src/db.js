// Postgres + pgvector storage for the recipe pantry. Works with a local Postgres
// or Tiger Cloud (Tiger Data): both are plain Postgres, so DATABASE_URL is the only config.
//
// Search is deliberately EXACT (no HNSW/IVFFlat index): every query filters by
// region and year first, which leaves a handful of rows, and ANN indexes lose
// recall when combined with selective filters.
import { REGIONS } from './regions.js';

export async function connect(url) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

export const toVector = (v) => `[${v.join(',')}]`;

export const dishDoc = (d) =>
  `${d.name} (${d.course}, ${REGIONS[d.region]?.label ?? 'United States'}). ${d.note} Ingredients: ${d.ingredients.slice(0, 8).join('; ')}.`;

export async function ingestPantry(db, embedder, dishes) {
  const vectors = await embedder.embed(dishes.map(dishDoc));
  const dim = vectors[0].length;
  if (!Number.isInteger(dim) || dim < 2 || dim > 16000) throw new Error(`Unexpected embedding dimension ${dim}`);

  await db.query('BEGIN');
  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS vector');
    await db.query('CREATE TABLE IF NOT EXISTS rr_meta (key text PRIMARY KEY, value text NOT NULL)');
    const { rows } = await db.query("SELECT value FROM rr_meta WHERE key = 'embedding'");
    const wanted = `${embedder.model}:${dim}`;
    if (rows[0]?.value !== wanted) {
      // Different model or dimension: vectors aren't comparable, so rebuild.
      await db.query('DROP TABLE IF EXISTS dishes');
      await db.query(`CREATE TABLE dishes (
        id text PRIMARY KEY, region text NOT NULL, from_year int NOT NULL,
        name text NOT NULL, course text, serves text, time text, note text,
        ingredients jsonb NOT NULL, steps jsonb NOT NULL,
        doc text NOT NULL, embedding vector(${dim}) NOT NULL)`);
      await db.query('CREATE INDEX dishes_region_year ON dishes (region, from_year)');
      await db.query("INSERT INTO rr_meta VALUES ('embedding', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [wanted]);
    }
    for (const [i, d] of dishes.entries()) {
      await db.query(
        `INSERT INTO dishes (id, region, from_year, name, course, serves, time, note, ingredients, steps, doc, embedding)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector)
         ON CONFLICT (id) DO UPDATE SET region=EXCLUDED.region, from_year=EXCLUDED.from_year, name=EXCLUDED.name, course=EXCLUDED.course,
           serves=EXCLUDED.serves, time=EXCLUDED.time, note=EXCLUDED.note, ingredients=EXCLUDED.ingredients, steps=EXCLUDED.steps,
           doc=EXCLUDED.doc, embedding=EXCLUDED.embedding`,
        [d.id, d.region, d.from, d.name, d.course, d.serves, d.time, d.note, JSON.stringify(d.ingredients), JSON.stringify(d.steps), dishDoc(d), toVector(vectors[i])],
      );
    }
    // Remove dishes that were deleted from the pantry file.
    await db.query('DELETE FROM dishes WHERE id <> ALL($1::text[])', [dishes.map((d) => d.id)]);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
  return { count: dishes.length, dim, model: embedder.model };
}

/** The embedding model recorded at ingest time, or null if the pantry isn't loaded. */
export async function pantryInfo(db) {
  try {
    const { rows } = await db.query("SELECT value FROM rr_meta WHERE key = 'embedding'");
    if (!rows[0]) return null;
    const { rows: n } = await db.query('SELECT count(*)::int AS n FROM dishes');
    const [model, dim] = [rows[0].value.slice(0, rows[0].value.lastIndexOf(':')), Number(rows[0].value.split(':').pop())];
    return { model, dim, count: n[0].n };
  } catch { return null; }
}

/**
 * Nearest dishes to a query vector.
 *   regions: restrict to these regions (omit for "anywhere")
 *   notRegions: exclude these regions
 *   maxYear: only dishes that existed by then
 */
export async function searchDishes(db, vector, { regions, notRegions = [], maxYear, exclude = [], limit = 3 }) {
  const { rows } = await db.query(
    `SELECT id, region, from_year AS "from", name, course, serves, time, note, ingredients, steps,
            1 - (embedding <=> $1::vector) AS score
       FROM dishes
      WHERE ($2::text[] IS NULL OR region = ANY($2))
        AND region <> ALL($3::text[])
        AND from_year <= $4
        AND id <> ALL($5::text[])
      ORDER BY embedding <=> $1::vector
      LIMIT $6`,
    [toVector(vector), regions ?? null, notRegions, maxYear, exclude, limit],
  );
  return rows.map((r) => ({ ...r, score: Number(r.score) }));
}
