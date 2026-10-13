// Turn scans of family recipe cards and books into recipe drafts, using a
// vision-capable open-weight model (Gemma 3). The original image is always kept
// so the printed book can show it beside the transcription.
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonLoose } from './llm.js';
import { isWikiTreeId } from './wikitree.js';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const here = path.dirname(fileURLToPath(import.meta.url));

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
  p.on('error', reject);
  p.on('close', (c) => (c === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${c}: ${err.slice(-200)}`))));
});

/** Images and PDFs under `input` (a file or folder), PDFs rasterised to one image per page.
 *  Each result is { file, source }: the image to read, and the file the user actually supplied. */
export async function collectScans(input, workDir) {
  const info = await stat(input);
  const files = info.isDirectory() ? await walkDir(input) : [input];
  const out = [];
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (IMAGE_EXT.has(ext)) out.push({ file: f, source: f });
    else if (ext === '.pdf') out.push(...(await rasterizePdf(f, workDir)).map((file) => ({ file, source: f })));
  }
  return out;
}

async function walkDir(dir) {
  const out = [];
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkDir(full)));
    else out.push(full);
  }
  return out;
}

/**
 * Whose recipe is this scan? From the file name ("Smith-1234__beef-roll.jpg"), else
 * from its folder name ("scans/Smith-1234/card.jpg"), else the fallback. Never guessed.
 */
export function ancestorFromPath(file, fallback = null) {
  const m = path.basename(file).match(/^(.+?-\d+)(?:__|--)/);
  if (m && isWikiTreeId(m[1])) return m[1];
  const dir = path.basename(path.dirname(file));
  if (isWikiTreeId(dir)) return dir;
  return fallback;
}

async function rasterizePdf(pdf, workDir) {
  const dir = path.join(workDir, `${path.basename(pdf, '.pdf')}-pages`);
  await mkdir(dir, { recursive: true });
  try {
    await run('pdftoppm', ['-r', '150', '-png', pdf, path.join(dir, 'page')]);
  } catch {
    if (process.platform !== 'darwin') throw new Error('PDF scans need poppler (pdftoppm) on this system; or export the pages as images.');
    await run('swift', [path.join(here, '..', 'tools', 'pdf2png.swift'), pdf, dir, '2']);
  }
  return (await readdir(dir)).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(dir, f));
}

/** Downscale to a JPEG that is plenty for reading and printing, when `sips` (macOS) is available. */
export async function shrink(file, dest, maxDim = 1600) {
  await mkdir(path.dirname(dest), { recursive: true });
  try {
    await run('sips', ['-Z', String(maxDim), '-s', 'format', 'jpeg', '-s', 'formatOptions', '75', file, '--out', dest]);
  } catch {
    await copyFile(file, dest); // no resizer available: keep the original
  }
  return dest;
}

export const dataUri = async (file) => {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
  return `data:${mime};base64,${(await readFile(file)).toString('base64')}`;
};

const TRANSCRIBE = `You are transcribing a scanned page or card from a family recipe book.
Copy the text EXACTLY as written, including old spellings, abbreviations and units (tsp, c., oz.).
Do not correct mistakes, convert units, reorder anything, or add anything that is not on the page.
If a word or number cannot be read, write [illegible] in its place instead of guessing.
A page may hold one recipe or several. Handwritten comments in the margin go in "notes". How much the recipe makes or serves ("Makes 7 ramekins", "Serves 6"), if written, goes in "yield" and not in "notes".
Return JSON only: {"recipes":[{"title": string, "ingredients": [string, ...], "directions": [string, ...], "yield": string or null, "notes": string or null}]}
Put one ingredient per array item and one step or paragraph per directions item.`;

const NUMBERS = `List every number, fraction, temperature, time and quantity you can read in this image, exactly as written.
Return JSON only: {"numbers": [string, ...]}`;

async function askVision(llm, prompt, image, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${llm.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llm.apiKey}` },
    body: JSON.stringify({
      model: llm.model, temperature: 0, stream: false, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }],
    }),
    signal: AbortSignal.timeout(600_000),
  });
  if (!res.ok) throw new Error(`Vision model returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return parseJsonLoose((await res.json()).choices?.[0]?.message?.content ?? '');
}

const FRACTIONS = { '¼': '1/4', '½': '1/2', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8' };
const numberList = (text) => String(text).replace(/[¼½¾⅓⅔⅛]/g, (c) => ` ${FRACTIONS[c]} `).match(/\d+(?:[./]\d+)?/g) ?? [];
export const numbersIn = (text) => new Set(numberList(text));
/** How many times each number appears: a "2" that one reading has twice and the other once is a disagreement. */
export function numberCounts(text) {
  const counts = new Map();
  for (const n of numberList(text)) counts.set(n, (counts.get(n) ?? 0) + 1);
  return counts;
}

/** A card has one title. When the model splits one card into several recipes with the same title, join them in order. */
export function mergeSameTitle(recipes) {
  const out = [];
  for (const r of recipes) {
    const key = r.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const prior = out.find((o) => o.key === key);
    if (!prior) { out.push({ ...r, key }); continue; }
    prior.ingredients.push(...r.ingredients);
    prior.directions.push(...r.directions);
    prior.yield = prior.yield ?? r.yield ?? null;
    prior.notes = [prior.notes, r.notes].filter(Boolean).join(' ') || null;
  }
  return out.map(({ key, ...r }) => r);
}

/**
 * Cards written in two columns (ingredients on the left, "mix well" on the right) confuse the model, which then files
 * some ingredient lines under directions. A short line under directions that opens with an amount and a measure
 * ("2 1/2 cups whole milk") is an ingredient; move it, keeping the order. Wording is untouched.
 */
const AMOUNT_LINE = /^(?:\d+\s+)?[\d¼½¾⅓⅔⅛][\d\s/.¼½¾⅓⅔⅛-]*\s*(?:cups?|c\b\.?|tsp\b\.?|tbsp\b\.?|t\b|T\b|oz\b\.?|ounces?|lbs?\b\.?|pounds?|pinch|dash|sticks?|cans?|pkg\b\.?|lg\b\.?|large|small|medium)\s+\S/i;
export function moveIngredientLines(recipe) {
  const keep = [], moved = [];
  for (const d of recipe.directions) (d.split(/\s+/).length <= 9 && AMOUNT_LINE.test(d) ? moved : keep).push(d);
  return moved.length ? { ...recipe, ingredients: [...recipe.ingredients, ...moved], directions: keep } : recipe;
}

/** A stray pen mark or tick at the end of a line is not part of the recipe. */
const tidyLine = (s) => s.replace(/\s*[,;\\/|]+$/, '').trim();

/**
 * Transcribe one scan. Returns drafts plus any quantity disagreements between the
 * transcription and an independent second reading of the image's numbers.
 */
export async function transcribeScan(llm, imagePath, opts) {
  const image = await dataUri(imagePath);
  const first = await askVision(llm, TRANSCRIBE, image, opts);
  const list = Array.isArray(first.recipes) ? first.recipes : [];
  const recipes = mergeSameTitle(list
    .filter((r) => r && typeof r.title === 'string' && Array.isArray(r.ingredients) && r.ingredients.length)
    .map((r) => ({
      title: r.title.trim(),
      ingredients: r.ingredients.map(String).map(tidyLine).filter(Boolean),
      directions: (Array.isArray(r.directions) ? r.directions : [r.directions ?? '']).map(String).map(tidyLine).filter(Boolean),
      yield: typeof r.yield === 'string' && r.yield.trim() ? r.yield.trim() : null,
      notes: typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim() : null,
    })));
  recipes.forEach((r, i) => { recipes[i] = moveIngredientLines(r); });
  let seen = null;
  try { seen = ((await askVision(llm, NUMBERS, image, opts)).numbers ?? []).join(' '); } catch { /* second pass is advisory */ }
  // The second reading is of the whole image, so with several recipes on it each is checked against the same list
  // only when there is one; with more, a number is flagged only if it is in none of them.
  const flags = recipes.map((r) => (seen == null ? { onlyInTranscript: [], onlyInSecondReading: [] } : quantityDiff(r, seen, recipes.length > 1)));
  return { recipes, flags };
}

/**
 * Numbers that differ between the transcription and an independent second reading of the image (empty arrays mean
 * they agree). Counted, not just listed: a "2" written twice in one and once in the other (the other has "1/2")
 * is a disagreement. With several recipes sharing one image only presence is compared, since counts can't be split.
 */
export function quantityDiff(recipe, seenText, shared = false) {
  const written = numberCounts([...recipe.ingredients, ...recipe.directions].join(' '));
  const seen = numberCounts(seenText);
  const differs = (a, b) => [...a].filter(([n, c]) => (shared ? !b.has(n) : (b.get(n) ?? 0) < c)).map(([n]) => n);
  return { onlyInTranscript: differs(written, seen), onlyInSecondReading: differs(seen, written) };
}
