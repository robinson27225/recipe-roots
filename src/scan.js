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
A page may hold one recipe or several. Handwritten comments in the margin go in "notes".
Return JSON only: {"recipes":[{"title": string, "ingredients": [string, ...], "directions": [string, ...], "notes": string or null}]}
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
export const numbersIn = (text) =>
  new Set((String(text).replace(/[¼½¾⅓⅔⅛]/g, (c) => ` ${FRACTIONS[c]} `).match(/\d+(?:[./]\d+)?/g) ?? []));

/**
 * Transcribe one scan. Returns drafts plus any quantity disagreements between the
 * transcription and an independent second reading of the image's numbers.
 */
export async function transcribeScan(llm, imagePath, opts) {
  const image = await dataUri(imagePath);
  const first = await askVision(llm, TRANSCRIBE, image, opts);
  const list = Array.isArray(first.recipes) ? first.recipes : [];
  const recipes = list
    .filter((r) => r && typeof r.title === 'string' && Array.isArray(r.ingredients) && r.ingredients.length)
    .map((r) => ({
      title: r.title.trim(),
      ingredients: r.ingredients.map(String).map((s) => s.trim()).filter(Boolean),
      directions: (Array.isArray(r.directions) ? r.directions : [r.directions ?? '']).map(String).map((s) => s.trim()).filter(Boolean),
      notes: typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim() : null,
    }));
  let seen = new Set();
  try { seen = numbersIn(((await askVision(llm, NUMBERS, image, opts)).numbers ?? []).join(' ')); } catch { /* second pass is advisory */ }
  const flags = recipes.map((r) => quantityDiff(r, seen));
  return { recipes, flags };
}

/** Numbers present in one reading but not the other (empty arrays mean they agree). */
export function quantityDiff(recipe, seen) {
  const written = numbersIn([...recipe.ingredients, ...recipe.directions].join(' '));
  return {
    onlyInTranscript: [...written].filter((n) => !seen.has(n)),
    onlyInSecondReading: [...seen].filter((n) => !written.has(n)),
  };
}
