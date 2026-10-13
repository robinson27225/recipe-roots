// Reads the WikiTree 15th Anniversary Cookbook PDFs (or any volume laid out the same way) into
// structured recipes that are tied to WikiTree profile IDs, so a family tree can be matched against them.
//
// The PDFs have a real text layer. Each recipe starts with a "Recipe" banner and names an Ancestor and a
// WikiTreer (the member who shared it); both names are hyperlinked to their profiles. Fonts separate the
// parts: ingredients/directions (13pt), the contributor's story (italic 12pt), clippings (plain 12pt).
//
// The recipes belong to the members who shared them. This module reads the files you give it; it does
// not bundle or redistribute any of the cookbook.
import { spawn } from 'node:child_process';
import { access, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generations, relationLabel } from './migrations.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const norm = (s) => squash(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '');
const PROFILE = /wikitree\.com\/wiki\/([^#?/]+)$/;

/** Join hard-wrapped PDF lines back into sentences. */
export function unwrap(text) {
  return squash(text.replace(/-\n(?=[a-z])/g, '').replace(/\n/g, ' '));
}

/**
 * Ingredient lines wrap in the PDF. Rejoin a line onto the previous one when that one is clearly
 * unfinished (open bracket, trailing comma or connective). Imperfect by nature, so imported recipes
 * should still be glanced over.
 */
export function ingredientLines(block) {
  const out = [];
  for (const raw of block.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const prev = out.at(-1);
    const open = prev && (prev.split('(').length > prev.split(')').length);
    const dangling = prev && /(,|\band|\bor|\bof|\bwith|\bin)$/i.test(prev);
    if (prev && (open || dangling || /^[)]/.test(raw))) out[out.length - 1] = `${prev} ${raw}`;
    else out.push(raw);
  }
  return out;
}

const isBold = (r) => /bold/i.test(r.font);
const isItalic = (r) => /italic|oblique/i.test(r.font);
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2);

/** Pull the printed page number ("~ 20 ~") from a page's runs, if any. */
function printedPage(runs) {
  for (const r of runs) { const m = r.text.match(/~\s*(\d+)\s*~/); if (m) return Number(m[1]); }
  return null;
}

/** WikiTree ID for a name from the page's profile links: exact-ish text match first, then shared name words. */
function profileId(links, name, exclude = null) {
  const profiles = links.map((l) => ({ id: l.url.match(PROFILE)?.[1], text: l.text })).filter((l) => l.id && l.id !== exclude);
  const want = norm(name);
  for (const l of profiles) {
    const t = norm(l.text);
    if (t && (want.startsWith(t.slice(0, 12)) || t.startsWith(want.slice(0, 12)))) return decodeURIComponent(l.id);
  }
  const mine = tokens(name);
  for (const l of profiles) { // e.g. link text "Donna Kimbel" for "Donna Jean (Lambka) Kimbel"
    const shared = tokens(l.text).filter((t) => mine.includes(t));
    if (shared.length >= 2) return decodeURIComponent(l.id);
  }
  return null;
}

/**
 * Split a recipe body into ingredients and directions. Headings are matched by text, not font:
 * "Ingredients", "Ingredients (Brown part)", "Directions:". A body with neither heading
 * (a free-form recipe) is kept whole as directions rather than guessed at.
 */
export function splitBody(text) {
  const ingredients = [];
  const directions = [];
  let mode = 'free';
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    if (mode === 'ing') ingredients.push(...ingredientLines(buf.join('\n')));
    else if (buf.join('').trim()) directions.push(unwrap(buf.join('\n')));
    buf = [];
  };
  for (const line of text.split('\n')) {
    const ing = line.match(/^\s*Ingredients\b\s*(.*)$/i);
    const dir = /^\s*Directions?\s*:?\s*$/i.test(line) || /^\s*(?:Instructions|Method)\s*:?\s*$/i.test(line);
    if (ing) { flush(); mode = 'ing'; const sub = ing[1].replace(/^[(:\s]+|[)\s]+$/g, ''); if (sub) ingredients.push(`${sub}:`); continue; }
    if (dir) { flush(); mode = 'dir'; continue; }
    buf.push(line);
  }
  flush();
  return { ingredients, directions };
}

/**
 * Parse the pages of one volume (as produced by tools/pdf-runs.swift) into recipes.
 * Font sizes change from page to page (the layout shrinks text on busy pages), so roles are found
 * relative to each page's own "Ancestor" and "WikiTreer" labels. "(cont.)" pages add directions,
 * story or clippings to the recipe they continue.
 */
export function parseVolume(pages, { volume }) {
  const recipes = [];
  const byKey = new Map();
  let part = '';
  for (const [i, page] of pages.entries()) {
    const { runs, links } = page;
    const labelOf = (word) => runs.find((r) => isBold(r) && r.text.trim() === word);
    const banner = labelOf('Recipe');
    const wtLabel = labelOf('WikiTreer');
    // The person's role is "Ancestor" for most recipes, "Descendant" (and similar) for others.
    const ancLabel = ['Ancestor', 'Descendant', 'Relative'].map(labelOf).find(Boolean)
      ?? (banner && wtLabel ? runs.find((r) => isBold(r) && /^\p{L}+$/u.test(r.text.trim()) && r !== banner && r !== wtLabel && r.size > wtLabel.size + 1 && r.size < banner.size - 1) : null);
    if (!banner || !ancLabel || !wtLabel) { if (i === 0) part = squash(runs.map((r) => r.text).join(' ')); continue; }

    const regular = runs.filter((r) => !isBold(r) && !isItalic(r));
    const ancestor = regular.find((r) => near(r.size, ancLabel.size));
    const wikitreer = regular.find((r) => near(r.size, wtLabel.size));
    const titleRun = regular.find((r) => r.size > ancLabel.size + 2);
    if (!titleRun || !ancestor) continue;

    const rawTitle = squash(titleRun.text);
    const cont = /\(cont\.\)$/i.test(rawTitle);
    const title = rawTitle.replace(/\s*\(cont\.\)$/i, '');
    const ancestorName = squash(ancestor.text);
    const wikiTreerName = wikitreer ? squash(wikitreer.text) : null;
    const key = `${title}|${ancestorName}`;

    // Body text is everything clearly smaller than the WikiTreer label and not navigation (18pt).
    const limit = wtLabel.size - 2.5;
    const small = runs.filter((r) => r.size <= limit);
    // The body size is whichever size carries the most characters, so a short subtitle can't decide it.
    const weight = new Map();
    for (const r of small.filter((r) => !isBold(r) && !isItalic(r))) {
      const k = Math.round(r.size * 2) / 2;
      weight.set(k, (weight.get(k) ?? 0) + r.text.trim().length);
    }
    const bodySize = [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    const keep = (r) => near(r.size, bodySize, 1.6) || (isBold(r) && !r.text.trim()); // bold whitespace holds the real spaces
    const story = small.filter(isItalic).map((r) => r.text).join(' '); // italics are only ever the contributor's story
    const body = small.filter((r) => !isItalic(r) && (isBold(r) ? !r.text.trim() : true) && keep(r)).map((r) => r.text).join('');
    const hasCitation = links.some((l) => !PROFILE.test(l.url));
    const pageNo = printedPage(runs);

    let rec = byKey.get(key);
    if (!rec) {
      const ancestorId = profileId(links, ancestorName);
      rec = {
        volume, page: pageNo, part, title, role: ancLabel.text.trim(), ancestorName, ancestorId,
        wikiTreerName, wikiTreerId: wikiTreerName ? profileId(links, wikiTreerName, ancestorId) : null,
        ingredients: [], directions: [], story: null, sources: [],
      };
      recipes.push(rec); byKey.set(key, rec);
    } else if (!rec.ancestorId) rec.ancestorId = profileId(links, ancestorName);

    if (body.trim()) {
      if (cont && hasCitation) rec.sources.push(unwrap(body));
      else {
        const parts = splitBody(body);
        rec.ingredients.push(...parts.ingredients);
        rec.directions.push(...parts.directions);
      }
    }
    if (story.trim()) rec.story = [rec.story, unwrap(story)].filter(Boolean).join(' ');
  }
  return recipes;
}

/** Compile the PDF dumper once (macOS only: it uses PDFKit) and return its path. */
export async function pdfRunsTool(cacheDir = '.cache') {
  if (process.platform !== 'darwin') throw new Error('Reading cookbook PDFs needs macOS for now (the PDF reader uses PDFKit).');
  const bin = path.join(cacheDir, 'bin', 'pdf-runs');
  try { await access(bin); return bin; } catch { /* build it */ }
  await mkdir(path.dirname(bin), { recursive: true });
  await run('swiftc', ['-O', path.join(here, '..', 'tools', 'pdf-runs.swift'), '-o', bin]);
  return bin;
}

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const out = []; let err = '';
  p.stdout.on('data', (d) => out.push(d)); p.stderr.on('data', (d) => (err += d));
  p.on('error', reject);
  p.on('close', (c) => (c === 0 ? resolve(Buffer.concat(out).toString('utf8')) : reject(new Error(`${cmd} exited ${c}: ${err.slice(-200)}`))));
});

/** Read every cookbook PDF in a folder: [{ file, volume, recipes }]. Paths are passed as arguments, never executed. */
export async function readCookbookFolder(dir, { cacheDir = '.cache' } = {}) {
  const tool = await pdfRunsTool(cacheDir);
  const files = (await readdir(dir)).filter((f) => /\.pdf$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const out = [];
  for (const f of files) {
    const pages = JSON.parse(await run(tool, [path.join(dir, f)]));
    const volume = Number(f.match(/-(\d+)\.pdf$/i)?.[1]) || f;
    out.push({ file: f, volume, recipes: parseVolume(pages, { volume }) });
  }
  return out;
}

/**
 * Match cookbook recipes against a family tree. Three kinds of hit:
 *   ancestor   - the recipe is for someone in the direct line
 *   relative   - for a sibling of someone in the direct line (a great-aunt, say); `relatives` is the
 *                list from listRelatives()
 *   shared-by  - the contributor (WikiTreer) is in the tree, e.g. a recipe you shared yourself
 * Living people are never matched.
 */
export function matchTree(recipes, people, rootId, relatives = []) {
  const gens = generations(people, rootId);
  const byName = new Map([...people.values()].map((p) => [p.Name, p]));
  const living = (p) => p?.IsLiving === 1 || p?.IsLiving === '1';
  const relMap = new Map(relatives.map((r) => [r.wikiTreeId, r]));
  const root = people.get(rootId);
  const out = [];
  for (const r of recipes) {
    const person = r.ancestorId ? byName.get(r.ancestorId) : null;
    if (person && !living(person) && person.Id !== rootId) {
      out.push({ recipe: r, via: 'ancestor', relation: relationLabel(gens.get(person.Id), person.Gender) });
    } else if (r.ancestorId && relMap.has(r.ancestorId)) {
      out.push({ recipe: r, via: 'relative', relation: relMap.get(r.ancestorId).relation });
    } else if (r.wikiTreerId && (r.wikiTreerId === root?.Name || (byName.has(r.wikiTreerId) && !living(byName.get(r.wikiTreerId)) && byName.get(r.wikiTreerId).Id !== rootId))) {
      out.push({ recipe: r, via: 'shared-by', relation: r.wikiTreerId === root?.Name ? 'you' : relationLabel(gens.get(byName.get(r.wikiTreerId).Id), byName.get(r.wikiTreerId).Gender) });
    }
  }
  return out;
}

/** A recipe in the shape of a family-recipes.json entry, credited to the cookbook and its WikiTreer. */
export function toFamilyRecipe(r, { me = null } = {}) {
  return {
    title: r.title, ancestor: r.ancestorId, ancestorName: r.ancestorName, contributor: r.wikiTreerName,
    ingredients: r.ingredients, directions: r.directions, story: r.story,
    source: `WikiTree 15th Anniversary Cookbook, vol. ${r.volume}${r.page ? `, p. ${r.page}` : ''}${r.wikiTreerId ? `; shared by ${r.wikiTreerName} (wikitree.com/wiki/${r.wikiTreerId})` : ''}`,
    reviewed: true,
    // The member who wrote it holds the rights. Recipes by anyone other than the user need permission to reproduce.
    thirdParty: !(me && r.wikiTreerId === me),
    rightsHolder: { name: r.wikiTreerName, id: r.wikiTreerId },
  };
}
