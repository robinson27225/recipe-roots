// Build a demo book for a made-up family, with the full "family kitchen": cooks, categories, personal stories,
// a transcribed card, a handwritten page, and period cookbooks beside the family dishes.
//   node examples/fictional-demo.mjs [--offline] [--model gemma3:4b] [--out out/demo]
// Uses the real writer, fan charts, kitchen history, period lookup and two-pass PDF; only the tree is invented.
import { mkdir, readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { people, rootId } from './fictional-family.js';
import { findMoves, buildStories, displayName, relationLabel, generations } from '../src/migrations.js';
import { relativeRelation } from '../src/relatives.js';
import { pickRecipes } from '../src/pantry.js';
import { writeChapter } from '../src/writer.js';
import { renderBook } from '../src/book.js';
import { buildWithPageNumbers } from '../src/render.js';
import { loadFamilyRecipes, parseFamilyPeople } from '../src/family.js';
import { attachFamilyPeriods } from '../src/familyperiod.js';
import { DEFAULTS, modelAvailable } from '../src/llm.js';

const { values: v } = parseArgs({ options: { offline: { type: 'boolean', default: false }, model: { type: 'string', default: DEFAULTS.model }, out: { type: 'string', default: 'out/demo' } } });
const here = path.dirname(fileURLToPath(import.meta.url));
const llm = { ...DEFAULTS, model: v.model };
const offline = v.offline || !(await modelAvailable(llm));
if (offline && !v.offline) console.error('No model server found; using templated text and no model-built recipe layouts.');

const used = new Set();
const chapters = [];
for (const story of buildStories(findMoves(people, rootId)).slice(0, 2)) {
  const recipes = pickRecipes(story, used);
  if (recipes.length < 2) continue;
  chapters.push({ story, recipes, text: await writeChapter(story, recipes, { llm, offline, log: console.error }) });
  console.error(`chapter ${story.from.label} → ${story.to.label}: ${chapters.at(-1).text.source}`);
}

// Attach each family recipe to its cook, the way the CLI does against WikiTree (here against the invented tree).
const gens = generations(people, rootId);
const byName = new Map([...people.values()].map((p) => [p.Name, p]));
const familyRecipes = (await loadFamilyRecipes(path.join(here, 'fictional-recipes.json'))).map((r) => {
  const person = byName.get(r.ancestor);
  const g = gens.get(person.Id);
  return { ...r, person, ancestorName: displayName(person), direct: g !== undefined, relation: g !== undefined ? relationLabel(g, person.Gender) : relativeRelation(person, gens) };
});
const n = await attachFamilyPeriods(familyRecipes, { llm, offline, stickers: false, log: console.error });
console.error(`${familyRecipes.length} family recipes; ${n} set beside the same dish from a period cookbook`);
const peopleNotes = parseFamilyPeople(await readFile(path.join(here, 'fictional-people.json'), 'utf8'));

await mkdir(v.out, { recursive: true });
const render = (pages) => renderBook({
  title: 'The Hale Table', subtitle: 'A demonstration book for a fictional family', dedication: 'For everyone who ever asked for the recipe.',
  chapters, rootId: 'Demo-Hale-1', modelLabel: v.model, people, familyRecipes, peopleNotes, pages,
});
const built = await buildWithPageNumbers({ render, htmlFile: path.join(v.out, 'book.html'), pdfFile: path.join(v.out, 'book.pdf') });
console.error(`Wrote ${path.join(v.out, 'book.pdf')} (${built.passes} renders, page numbers ${built.pages ? 'filled in' : 'unavailable'})`);
