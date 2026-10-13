#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fetchAncestry, WikiTreeError } from './wikitree.js';
import { findMoves, buildStories, displayName, listAncestors } from './migrations.js';
import PANTRY from '../data/pantry.js';
import { pickRecipes, pickRecipesSemantic } from './pantry.js';
import { connect, ingestPantry, pantryInfo } from './db.js';
import { makeEmbedder, EMBED_DEFAULTS } from './embed.js';
import { writeChapter } from './writer.js';
import { renderBook } from './book.js';
import { buildWithPageNumbers } from './render.js';
import { attachFamilyPeriods } from './familyperiod.js';
import { categorize } from './categories.js';
import { loadFamilyRecipes, attachRelatives, loadFamilyPeople, FamilyRecipeError } from './family.js';
import { resolvePerson, listRelatives } from './relatives.js';
import { fetchPhotos } from './photos.js';
import { evaluateGate, isOwnContribution } from './gate.js';
import { buildLedger } from './ledger.js';
import { loadMyPhotos } from './myphotos.js';
import { findPeriodReceipts } from './period.js';
import { storySignals } from './stickers.js';
import { structureReceipt } from './modernize.js';
import { readCookbookFolder, matchTree, toFamilyRecipe } from './cookbook.js';
import { renderReview } from './review.js';
import { ingestReceipts, receiptInfo } from './receiptdb.js';
import { collectScans, shrink, transcribeScan, ancestorFromPath } from './scan.js';
import { DEFAULTS, modelAvailable } from './llm.js';

const USAGE = `Recipe Roots: turn a WikiTree ancestry into a family cookbook.

Usage: recipe-roots <WikiTree-ID> [options]
       recipe-roots ingest [--database-url <url>]   load the recipe pantry into Postgres/pgvector
       recipe-roots ingest-receipts [--database-url <url>]
                                                    load every receipt from the public-domain cookbooks into Postgres for hybrid search
                                                    (BM25 + vectors; BM25 needs Tiger Cloud's pg_textsearch, else built-in full-text search)
       recipe-roots ancestors <WikiTree-ID> [--relatives] [--filter text]
                                                    list people with the IDs to assign recipes to; --relatives adds
                                                    great-aunts, great-uncles and other siblings of ancestors
       recipe-roots cookbook <folder-of-PDFs> [--tree <WikiTree-ID>] [--write family-recipes.json]
                                                    read WikiTree 15th Anniversary Cookbook PDFs you have downloaded, and find the
                                                    recipes for (or shared by) people in your tree (macOS only for now)
       recipe-roots review [family-recipes.json]    write review.html next to it: every scan beside what the model read, to proofread
       recipe-roots scan <image|pdf|folder> [--ancestor <WikiTree-ID>] [--tree <WikiTree-ID>] [--contributor <name>] [--recipes-file family-recipes.json]
         Each scan is assigned to an ancestor by file name (Smith-1234__beef-roll.jpg), else by folder name
         (scans/Smith-1234/card.jpg), else --ancestor. --tree checks the IDs against that tree and shows who they are.
                                                    transcribe scanned family recipes (photos or PDFs) with a vision model
         --page-only      don't transcribe: print each scan as a page (best for handwriting; no model needed)
         --no-scan-page   transcribe, but leave the original image out of the book

  --generations <n>   ancestor generations to read, 1-10 (default 6)
  --stories <n>       chapters to write (default 3)
  --model <name>      open-weight model (default ${DEFAULTS.model})
  --base-url <url>    OpenAI-compatible endpoint (default ${DEFAULTS.baseUrl})
  --database-url <u>  Postgres with pgvector (or DATABASE_URL): semantic recipe search
  --embed-model <m>   embedding model (default ${EMBED_DEFAULTS.model})
  --family-recipes <f> JSON file of recipes written by relatives (see README)
  --family-people <f>  JSON file of your own words about the cooks, printed on their pages: { "Smith-1234": { "story": "..." } }
  --offline           skip the model; use plain templated text
  --title <text>      book title
  --dedication <text> dedication page
  --out <dir>         output folder (default out/<WikiTree-ID>)
  --my-photos <dir>   your own family photos, named for the person (Smith-1234.jpg); never restricted
  --wikitree-photos   also use WikiTree profile photos. Needs --me, --honor-code-signed and --confirm-permission
  --wikitree-photos-for <IDs>  with --wikitree-photos: only for these people (comma-separated WikiTree IDs), for when you
                      have permission for some photos and not others
  --me <ID>           your WikiTree ID (or RR_ME). Photos and recipes from WikiTree are for Wiki Genealogists (Honor Code
                      signatories) who have the owners' permission; see README. Off by default.
  --honor-code-signed attest that you are a Wiki Genealogist (Honor Code signatory); it can't be checked automatically
  --confirm-permission confirm you have each owner's permission to reproduce their photo/recipe in a book you may sell
  --no-structure      show period receipts only as the original paragraph (no recipe-layout version)
  --no-stickers       don't read WikiTree heritage/religion stickers (used only to pick period cookbooks)
  --similar-period    when no cookbook has a family recipe's dish, offer the closest receipt, labelled as not the same dish
                      (needs --database-url and a prior ingest-receipts)
  --no-period         skip the "How they wrote it" quotations from public-domain period cookbooks (Project Gutenberg)
  --no-pdf            write HTML + JSON only
`;

const { values: v, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    generations: { type: 'string', default: '6' }, stories: { type: 'string', default: '3' },
    model: { type: 'string', default: DEFAULTS.model }, 'base-url': { type: 'string', default: DEFAULTS.baseUrl },
    'api-key': { type: 'string', default: DEFAULTS.apiKey }, offline: { type: 'boolean', default: false },
    title: { type: 'string' }, 'family-recipes': { type: 'string' }, 'family-people': { type: 'string' },
    relatives: { type: 'boolean', default: false }, write: { type: 'string' }, ancestor: { type: 'string' }, tree: { type: 'string' }, filter: { type: 'string' }, contributor: { type: 'string' }, 'page-only': { type: 'boolean', default: false }, 'no-scan-page': { type: 'boolean', default: false }, 'recipes-file': { type: 'string', default: 'family-recipes.json' }, dedication: { type: 'string' }, out: { type: 'string' },
    'database-url': { type: 'string', default: process.env.DATABASE_URL }, 'embed-model': { type: 'string', default: EMBED_DEFAULTS.model },
    'no-pdf': { type: 'boolean', default: false }, 'no-period': { type: 'boolean', default: false }, 'similar-period': { type: 'boolean', default: false }, 'no-stickers': { type: 'boolean', default: false }, 'no-structure': { type: 'boolean', default: false }, me: { type: 'string', default: process.env.RR_ME }, 'honor-code-signed': { type: 'boolean', default: false }, 'confirm-permission': { type: 'boolean', default: false }, 'wikitree-photos': { type: 'boolean', default: false }, 'wikitree-photos-for': { type: 'string' }, 'my-photos': { type: 'string' }, help: { type: 'boolean', short: 'h', default: false },
  },
});

const twoArgs = ['scan', 'ancestors', 'cookbook'].includes(positionals[0]);
const reviewArgs = positionals[0] === 'review' && positionals.length <= 2; // the file is optional
if (v.help || (reviewArgs ? false : twoArgs ? positionals.length !== 2 : positionals.length !== 1)) { console.log(USAGE); process.exit(v.help ? 0 : 1); }
const id = positionals[0];
const log = (m) => console.error(m);
const llmCfg = { baseUrl: v['base-url'], model: v.model, apiKey: v['api-key'] };
const embedder = makeEmbedder({ baseUrl: v['base-url'], apiKey: v['api-key'], model: v['embed-model'] });

if (id === 'cookbook') {
  try {
    const vols = await readCookbookFolder(positionals[1]);
    const all = vols.flatMap((x) => x.recipes);
    const noText = all.filter((r) => !r.ingredients.length && !r.directions.length);
    log(`Read ${vols.length} PDF(s): ${all.length} recipes tied to ${new Set(all.map((r) => r.ancestorId).filter(Boolean)).size} WikiTree profiles.${noText.length ? ` ${noText.length} are image-only (use \`scan\` on those pages): ${noText.map((r) => r.title).join(', ')}.` : ''}`);
    if (!v.tree) {
      for (const r of all) console.log(`vol ${String(r.volume).padStart(2)} p.${String(r.page ?? '?').padStart(3)}  ${r.title} — ${r.ancestorName}${r.ancestorId ? ` (${r.ancestorId})` : ''}, shared by ${r.wikiTreerName ?? '?'}`);
      log('Add --tree <your WikiTree ID> to find the recipes that belong to your family.');
      process.exit(0);
    }
    const { rootId, people } = await fetchAncestry(v.tree, { generations: Number(v.generations) });
    const hits = matchTree(all, people, rootId, await listRelatives(people, rootId));
    if (!hits.length) { log(`None of these recipes are for, or shared by, anyone in ${v.tree}'s ${people.size - 1} ancestors (or their siblings).`); process.exit(0); }
    for (const h of hits) {
      const r = h.recipe;
      const why = h.via === 'shared-by' ? `shared by ${h.relation === 'you' ? 'you' : `your ${h.relation}`}` : `for your ${h.relation}`;
      console.log(`${r.title} — ${r.ancestorName}${r.ancestorId ? ` (${r.ancestorId})` : ''}: ${why}; vol ${r.volume} p.${r.page ?? '?'}, shared by ${r.wikiTreerName ?? '?'}`);
    }
    if (v.write) {
      let existing = [];
      try { existing = JSON.parse(await readFile(v.write, 'utf8')); } catch { /* new file */ }
      let added = 0;
      let blocked = 0;
      const gate = await evaluateGate({ me: v.me, honorCodeSigned: v['honor-code-signed'], confirmPermission: v['confirm-permission'] });
      for (const h of hits.filter((x) => x.via !== 'shared-by' || x.recipe.ancestorId)) {
        if (!isOwnContribution(h.recipe, v.me) && !gate.allowed) { blocked++; continue; }
        const fr = toFamilyRecipe(h.recipe, { me: v.me });
        if (existing.some((e) => e.title === fr.title && e.ancestor === fr.ancestor)) continue;
        existing.push(fr); added++;
      }
      if (blocked) log(`Did not write ${blocked} recipe(s) written by other WikiTree members:\n${gate.reasons.map((r) => `  - ${r}`).join('\n')}`);
      await writeFile(v.write, JSON.stringify(existing, null, 2));
      if (!added) log(`Nothing new to write to ${v.write}.`);
      else log(`Wrote ${added} recipe(s) to ${v.write}, each credited to the cookbook and the member who shared it.\nAnyone who is living, private or not found is left out of the book unless you add "permission": true to their recipe.\nThese recipes belong to the WikiTree members who contributed them: get the contributor's permission and check WikiTree's terms before selling printed copies. Ingredient lines that wrapped in the PDF may need a quick tidy.`);
    }
  } catch (e) { log(e instanceof WikiTreeError ? e.message : `Error: ${e.message}`); process.exit(1); }
  process.exit(0);
}

if (id === 'ancestors') {
  try {
    const { rootId, people } = await fetchAncestry(positionals[1], { generations: Number(v.generations) });
    const q = v.filter?.toLowerCase();
    const rows = listAncestors(people, rootId).map((a) => ({ ...a, extra: a.birthPlace ? `, b. ${a.birthPlace}` : '' }));
    if (v.relatives) {
      for (const r of await listRelatives(people, rootId)) {
        const yr = (d) => parseInt(String(d ?? '').slice(0, 4), 10) || null;
        rows.push({ wikiTreeId: r.wikiTreeId, name: r.name, born: yr(r.born), died: yr(r.died), relation: r.relation, gen: 99, birthPlace: '', extra: `, sibling of ${r.siblingOf}` });
      }
    }
    for (const a of rows.filter((a) => !q || `${a.name} ${a.wikiTreeId} ${a.birthPlace}`.toLowerCase().includes(q))) {
      console.log(`${a.wikiTreeId.padEnd(26)} ${a.name} (${a.born ?? '?'}–${a.died ?? '?'}), ${a.relation}${a.extra}`);
    }
  } catch (e) { log(e instanceof WikiTreeError ? e.message : `Error: ${e.message}`); process.exit(1); }
  process.exit(0);
}

if (id === 'review') {
  const file = path.resolve(positionals[1] ?? 'family-recipes.json');
  let recipes;
  try { recipes = JSON.parse(await readFile(file, 'utf8')); } catch (e) { log(`Couldn't read ${file}: ${e.message}`); process.exit(1); }
  if (!Array.isArray(recipes)) { log(`${file} should be a JSON array of recipes.`); process.exit(1); }
  const out = path.join(path.dirname(file), 'review.html');
  await writeFile(out, renderReview(recipes));
  log(`Wrote ${out}: ${recipes.filter((r) => r.transcribedByAI && !r.reviewed).length} of ${recipes.length} recipes still need checking. Open it in a browser.`);
  process.exit(0);
}

if (id === 'scan') {
  const file = v['recipes-file'];
  const dir = path.dirname(file);
  let existing = [];
  try { existing = JSON.parse(await readFile(file, 'utf8')); } catch { /* new file */ }
  const scans = await collectScans(positionals[1], path.join('.cache', 'scans'));
  if (!scans.length) { log('No images or PDFs found there (jpg, png, webp, gif, pdf).'); process.exit(1); }
  // Don't read the copies this command itself wrote to <recipes-file folder>/scans last time.
  const ownCopies = path.resolve(dir, 'scans') + path.sep;
  for (let i = scans.length - 1; i >= 0; i--) if (path.resolve(scans[i].source).startsWith(ownCopies)) scans.splice(i, 1);
  for (const s of scans) s.ancestor = ancestorFromPath(s.source, v.ancestor);
  const unassigned = [...new Set(scans.filter((s) => !s.ancestor).map((s) => s.source))];
  if (unassigned.length) {
    log(`These scans aren't assigned to an ancestor, so nothing was read:\n${unassigned.map((f) => `  ${f}`).join('\n')}\nName them like Smith-1234__beef-roll.jpg, put them in a folder named for the ancestor's WikiTree ID, or pass --ancestor. (Find IDs with: recipe-roots ancestors <your-ID>)`);
    process.exit(1);
  }
  if (v.tree) { // confirm each assigned person is findable (any public relative, not only the direct line)
    const { rootId: treeRoot, people } = await fetchAncestry(v.tree, { generations: Number(v.generations) });
    const bad = [];
    for (const idv of new Set(scans.map((s) => s.ancestor))) {
      const hit = await resolvePerson(idv, people, treeRoot);
      if (hit) log(`  ${idv} → ${displayName(hit.person)} (${hit.relation})`); else bad.push(idv);
    }
    if (bad.length) { log(`Couldn't find these as public, non-living profiles: ${bad.join(', ')}. Check the IDs (list them with: recipe-roots ancestors ${v.tree} --relatives).`); process.exit(1); }
  }
  let added = 0;
  for (const [i, scan] of scans.entries()) {
    const src = scan.file, who = scan.ancestor;
    const slug = path.basename(src, path.extname(src)).replace(/[^\w.-]+/g, '-');
    const rel = path.join('scans', `${who}-${slug}.jpg`);
    if (existing.some((r) => r.image === rel)) { log(`  ${path.basename(src)}: already in ${file}, skipping`); continue; }
    await shrink(src, path.join(dir, rel));
    if (v['page-only']) {
      const title = path.basename(scan.source, path.extname(scan.source)).replace(/^.+?-\d+(?:__|--)/, '').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
      existing.push({ title, ancestor: who, contributor: v.contributor ?? null, category: categorize({ title }), ingredients: [], directions: [], story: null, image: rel, pageOnly: true });
      added++; log(`  ${path.basename(src)} → page "${title}" (rename it in ${file} if you like)`);
      continue;
    }
    try {
      const { recipes, flags } = await transcribeScan(llmCfg, path.join(dir, rel));
      if (!recipes.length) log(`  ${path.basename(src)}: no recipe found`);
      recipes.forEach((r, j) => {
        const f = flags[j];
        const bad = f.onlyInTranscript.length || f.onlyInSecondReading.length;
        existing.push({ title: r.title, ancestor: who, category: categorize(r), contributor: v.contributor ?? null, ingredients: r.ingredients, directions: r.directions, ...(r.yield ? { yield: r.yield } : {}), story: r.notes, image: rel, transcribedByAI: true, reviewed: false, ...(bad ? { check: { onlyInTranscript: f.onlyInTranscript, onlyInSecondReading: f.onlyInSecondReading } } : {}), ...(v['no-scan-page'] ? { showScan: false } : {}) });
        added++;
        log(`  ${path.basename(src)} → "${r.title}" (${r.ingredients.length} ingredients)${bad ? `\n    ⚠ check amounts: transcript-only [${f.onlyInTranscript.join(', ')}], second-reading-only [${f.onlyInSecondReading.join(', ')}]` : ''}`);
      });
    } catch (e) { log(`  ${path.basename(src)}: failed (${e.message})`); }
    if (i === 0) await mkdir(dir, { recursive: true });
  }
  await writeFile(file, JSON.stringify(existing, null, 2));
  log(`Wrote ${added} draft recipe(s) to ${file}. ${v['page-only'] ? '' : 'Open it, fix anything the model misread, and set "reviewed": true.'} Then: recipe-roots <ID> --family-recipes ${file}`);
  process.exit(0);
}

if (id === 'ingest-receipts') {
  if (!v['database-url']) { log('Set --database-url or DATABASE_URL (e.g. postgres://localhost:5433/recipe_roots).'); process.exit(1); }
  const db = await connect(v['database-url']);
  try {
    const r = await ingestReceipts(db, embedder, { log });
    log(`Loaded ${r.total} receipts from ${r.books.filter((b) => b.receipts).length} books with ${embedder.model}; keyword ranking: ${r.bm25 ? 'BM25 (pg_textsearch)' : 'built-in full-text search (pg_textsearch not available here)'}.`);
  } catch (e) { log(`Error: ${e.message}`); process.exitCode = 1; } finally { await db.end(); }
  process.exit(process.exitCode ?? 0);
}

if (id === 'ingest') {
  if (!v['database-url']) { log('Set --database-url or DATABASE_URL (e.g. postgres://localhost:5433/recipe_roots).'); process.exit(1); }
  const db = await connect(v['database-url']);
  try {
    const r = await ingestPantry(db, embedder, PANTRY);
    log(`Ingested ${r.count} dishes with ${r.model} (${r.dim} dimensions).`);
  } catch (e) { log(`Error: ${e.message}`); process.exitCode = 1; } finally { await db.end(); }
  process.exit(process.exitCode ?? 0);
}

// Optional semantic recipe search. Any failure falls back to the built-in picker.
let db = null;           // the connection (also used for the receipt library)
let pantryDb = null;     // set only when the dish pantry is loaded and usable
if (v['database-url']) {
  try {
    db = await connect(v['database-url']);
  } catch (e) {
    log(`Database unavailable (${e.message}); using the built-in recipe picker.`);
  }
  if (db) {
    try {
      const info = await pantryInfo(db);
      if (!info) throw new Error('pantry not loaded; run `recipe-roots ingest` first');
      if (info.model !== v['embed-model']) throw new Error(`pantry was embedded with ${info.model}, not ${v['embed-model']}; re-run ingest`);
      log(`Semantic recipe search on: ${info.count} dishes in Postgres (${info.model}).`);
      pantryDb = db;
    } catch (e) {
      log(`pgvector dish search unavailable (${e.message}); using the built-in recipe picker.`);
    }
  }
}

try {
  log(`Reading ${id} from WikiTree…`);
  let { rootId, people } = await fetchAncestry(id, { generations: Number(v.generations) });
  log(`  ${people.size - 1} ancestors found.`);

  const moves = findMoves(people, rootId);
  const candidates = buildStories(moves);
  if (!candidates.length) {
    log('No migrations found in the public records (needs birth and death/child places in different regions). Try more --generations.');
    process.exit(2);
  }
  log(`  ${candidates.length} candidate migration stories.`);

  const llm = llmCfg;
  let offline = v.offline;
  if (!offline && !(await modelAvailable(llm))) {
    log(`Model server not reachable at ${llm.baseUrl}; falling back to templated text. (Start Ollama, or pass --offline to silence this.)`);
    offline = true;
  }

  const used = new Set();
  const chapters = [];
  // Prefer a different corridor for each chapter (closest first); repeat one only if there aren't enough.
  const seenCorridors = new Set();
  const firsts = new Set();
  const ordered_has = (s) => firsts.has(s);
  const ordered = [
    ...candidates.filter((s) => { const k = `${s.from.key}>${s.to.key}`; if (seenCorridors.has(k)) return false; seenCorridors.add(k); firsts.add(s); return true; }),
    ...candidates.filter((s) => !ordered_has(s)),
  ];
  for (const story of ordered) {
    if (chapters.length >= Number(v.stories)) break;
    const trial = new Set(used);
    let recipes;
    try {
      recipes = pantryDb ? await pickRecipesSemantic(story, trial, { db: pantryDb, embedder }) : pickRecipes(story, trial);
    } catch (e) {
      log(`  semantic search failed (${e.message}); using the built-in picker for this chapter.`);
      recipes = pickRecipes(story, trial);
    }
    if (recipes.length < 2) { log(`  skipping ${story.from.label} → ${story.to.label} ${story.lo}–${story.hi}: not enough era-appropriate recipes in the pantry yet`); continue; }
    recipes.forEach((r) => used.add(r.id));
    log(`Writing chapter: ${story.from.label} → ${story.to.label} (${recipes.map((r) => r.name + (r.neighbour ? ' [neighbouring cuisine]' : '')).join(', ')})`);
    if (!v['no-period']) { // quote the dish as an era cookbook wrote it (public domain, verbatim), chosen by heritage and time
      if (!v['no-stickers'] && !story.tags) { // WikiTree heritage stickers on the deceased people in this chapter
        const sig = await storySignals(story, people);
        story.tags = sig.tags;
        if (sig.found.length) log(`  heritage stickers used to pick period cookbooks: ${sig.found.join('; ')}`);
      }
      const found = await findPeriodReceipts(story, recipes, { log });
      for (const r of recipes) if (found.has(r.id)) r.period = found.get(r.id);
      if (!v['no-structure']) { // a standard layout beside the verbatim original (list receipts: no AI; prose: model, checked against the text)
        for (const r of recipes.filter((x) => x.period)) r.period.structured = await structureReceipt(r.period.text, { llm: llmCfg, offline, log });
        const n = recipes.filter((x) => x.period?.structured).length;
        if (n) log(`  ${n} period receipt(s) set in a recipe layout`);
      }
      if (found.size) log(`  ${found.size} period receipt(s): ${recipes.filter((r) => r.period).map((r) => `${r.name} (${r.period.book.year})`).join(', ')}`);
    }
    const text = await writeChapter(story, recipes, { llm, offline, log });
    log(`  text source: ${text.source}`);
    chapters.push({ story, recipes, text });
  }

  if (!chapters.length) { log('None of the migrations had enough recipes in the pantry. Contributions to data/pantry.js are welcome!'); process.exit(2); }
  let familyRecipes = [];
  if (v['family-recipes']) {
    const att = await attachRelatives(await loadFamilyRecipes(v['family-recipes']), people, rootId, { warn: log });
    familyRecipes = att.recipes;
    people = att.people; // includes any great-aunts etc. fetched for fan charts
    log(`  ${familyRecipes.length} family recipe(s) read.`);
  }
  // --- who may use third-party (WikiTree-owned) photos and recipes? Fails closed. ---
  const needsGate = v['wikitree-photos'] || familyRecipes.some((r) => r.thirdParty);
  const gate = needsGate ? await evaluateGate({ me: v.me, honorCodeSigned: v['honor-code-signed'], confirmPermission: v['confirm-permission'] }) : null;
  if (gate && !gate.allowed) log(`WikiTree photos and recipes written by other members are off:\n${gate.reasons.map((r) => `  - ${r}`).join('\n')}`);
  const heldBack = familyRecipes.filter((r) => r.thirdParty && !gate?.allowed);
  if (heldBack.length) log(`  Left out ${heldBack.length} third-party recipe(s): ${heldBack.map((r) => r.title).join(', ')}.`);
  familyRecipes = familyRecipes.filter((r) => !r.thirdParty || gate?.allowed);

  // --- the family's own words about the cooks, and how the same dishes were written in the cooks' own time ---
  const peopleNotes = v['family-people'] ? await loadFamilyPeople(v['family-people']) : {};
  for (const idv of Object.keys(peopleNotes)) {
    if (!familyRecipes.some((r) => r.ancestor === idv)) log(`  family-people: ${idv} has a note but no recipe in this book, so the note isn't printed.`);
  }
  if (!v['no-period'] && familyRecipes.length) {
    let similar = null;
    if (v['similar-period']) {
      const info = db ? await receiptInfo(db) : null;
      if (!info) log('  --similar-period needs --database-url and `recipe-roots ingest-receipts` first; skipping it.');
      else if (info.model !== v['embed-model']) log(`  --similar-period: the receipt library was embedded with ${info.model}, not ${v['embed-model']}; re-run ingest-receipts.`);
      else { similar = { db, embedder, bm25: info.bm25 }; log(`  similar-dish search on: ${info.count} receipts from ${info.books} books (${info.bm25 ? 'BM25 + vectors' : 'full-text + vectors'}).`); }
    }
    const n = await attachFamilyPeriods(familyRecipes, { llm: llmCfg, offline, stickers: !v['no-stickers'], similar, log });
    if (n) log(`  ${n} family recipe(s) set beside a period cookbook receipt`);
  }

  // --- photos: your own family photos always; WikiTree's only through the gate ---
  const photos = new Map();
  const wanted = [...chapters.flatMap((c) => c.story.people.map((p) => people.get(p.id))), ...familyRecipes.map((r) => r.person)].filter(Boolean);
  if (v['my-photos']) {
    for (const [pid, ph] of await loadMyPhotos(v['my-photos'], people, { warn: log })) photos.set(pid, ph);
    log(`  ${photos.size} of your own family photo(s) used.`);
  }
  if (v['wikitree-photos'] && gate?.allowed) {
    const only = v['wikitree-photos-for'] ? new Set(v['wikitree-photos-for'].split(',').map((x) => x.trim()).filter(Boolean)) : null;
    const fetched = await fetchPhotos(wanted.filter((p) => !photos.has(p.Id) && (!only || only.has(p.Name))));
    for (const [pid, ph] of fetched) photos.set(pid, ph);
    log(`  ${fetched.size} WikiTree profile photo(s) used. They belong to their uploaders: see permissions.md.`);
  }
  const root = people.get(rootId);
  const surname = root.LastNameAtBirth || displayName(root);
  const outDir = v.out ?? path.join('out', id);
  await mkdir(outDir, { recursive: true });
  const ledger = buildLedger({
    me: gate?.allowed ? v.me : null, honorCodeAttested: Boolean(gate?.allowed && v['honor-code-signed']),
    photos: [...photos].filter(([, p]) => !p.personal).map(([pid, p]) => ({ person: displayName(people.get(pid)), name: p.name, pageUrl: p.pageUrl })),
    recipes: familyRecipes.filter((r) => r.thirdParty).map((r) => ({ title: r.title, rightsHolder: r.rightsHolder, source: r.source })),
  });
  if (ledger) { await writeFile(path.join(outDir, 'permissions.md'), ledger); log(`Wrote ${path.join(outDir, 'permissions.md')}: who to ask before you sell this book.`); }
  await writeFile(path.join(outDir, 'stories.json'), JSON.stringify(chapters.map((c) => ({ ...c.story, recipes: c.recipes.map((r) => r.id), textSource: c.text.source })), null, 2));
  const render = (pages) => renderBook({
    title: v.title ?? `The ${surname} Table`,
    subtitle: 'Recipes from the places our ancestors came from',
    dedication: v.dedication, chapters, rootId: id, people, familyRecipes, photos, peopleNotes, pages,
    modelLabel: chapters.some((c) => c.text.source !== 'template') ? v.model : null,
  });
  const built = await buildWithPageNumbers({ render, htmlFile: path.join(outDir, 'book.html'), pdfFile: path.join(outDir, 'book.pdf'), makePdf: !v['no-pdf'] });
  if (v['no-pdf']) log(`Wrote ${path.join(outDir, 'book.html')} (a draft: page numbers need the PDF)`);
  else {
    log(`Wrote ${path.join(outDir, 'book.pdf')}${built.pages ? ` (contents and indices carry page numbers, ${built.passes} renders)` : ' (this machine can\'t read page numbers back, so the contents is a plain list)'}`);
    if (!built.stable) log('  Warning: page numbers were still shifting after four renders; check the contents page.');
  }
  await db?.end();
} catch (e) {
  await db?.end().catch(() => {});
  log(e instanceof WikiTreeError || e instanceof FamilyRecipeError ? e.message : `Error: ${e.message}`);
  process.exit(1);
}
