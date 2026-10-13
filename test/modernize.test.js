import test from 'node:test';
import assert from 'node:assert/strict';
import { quantityTokens, checkAgainstSource, structureFromList, structureReceipt } from '../src/modernize.js';
import { renderBook } from '../src/book.js';
import { pickRecipes } from '../src/pantry.js';
import { findMoves, buildStories } from '../src/migrations.js';
import { templateChapter } from '../src/writer.js';
import { people } from './fixtures.js';

// Filippini (1907), Welsh rarebit: a typical prose receipt.
const SOURCE = "Place a gill of Bass's ale in a small saucepan with a tablespoon Worcestershire sauce and a saltspoon cayenne pepper, and as soon as it briskly boils add one pound very rich, fresh, finely chopped American cheese, and continually stir with a wooden spoon until melted; dress on hot toast and serve.";
const GOOD = {
  ingredients: ["a gill of Bass's ale", 'a tablespoon Worcestershire sauce', 'a saltspoon cayenne pepper', 'one pound very rich, fresh, finely chopped American cheese', 'hot toast'],
  steps: ['Place the ale, Worcestershire sauce and cayenne pepper in a small saucepan.', 'As soon as it briskly boils, add the cheese.', 'Stir continually with a wooden spoon until melted.', 'Dress on hot toast and serve.'],
  notes: ['The original gives no quantity of toast.'],
};

test('a faithful restructuring passes the check', () => {
  const r = checkAgainstSource(GOOD, SOURCE);
  assert.deepEqual(r.problems, []);
  assert.ok(r.ok);
});

test('inventions are caught: a new ingredient, a new number, digits for words, a temperature, a missing half', () => {
  const bad = (patch) => checkAgainstSource({ ...GOOD, ...patch }, SOURCE);
  assert.ok(!bad({ ingredients: [...GOOD.ingredients, 'a teaspoon cinnamon'] }).ok);                       // invented ingredient
  assert.match(bad({ ingredients: [...GOOD.ingredients, 'a teaspoon cinnamon'] }).problems.join(), /cinnamon/);
  assert.match(bad({ ingredients: ['two ounces butter', ...GOOD.ingredients] }).problems.join(), /quantity "two"/); // a number the original never gives
  assert.match(bad({ ingredients: ['1 pound very rich, fresh, finely chopped American cheese'] }).problems.join(), /quantity "1"/); // digits where the receipt used words
  assert.match(bad({ steps: [...GOOD.steps, 'Bake at 350° for ten minutes.'] }).problems.join(), /temperature/);
  assert.ok(!bad({ steps: [] }).ok);
  assert.ok(!bad({ ingredients: [] }).ok);
  assert.ok(!bad({ steps: ['Sprinkle with paprika and nutmeg.'] }).ok);                                    // two foreign food words in a step
});

test('number words and fractions count as quantities', () => {
  assert.deepEqual([...quantityTokens('half a pint, two ounces and 3/4 cup, ½ tsp')].sort(), ['3/4', 'half', 'two', '½'].sort());
});

test('a receipt that already opens with an ingredient list is reformatted without any model', () => {
  const quote = '4 or 5 sour apples\n⅓ cup sugar\n¼ teaspoon grated nutmeg\n\nLine pie plate with paste. Pare, core, and cut the apples into eighths. Dot over with butter.';
  const s = structureFromList(quote);
  assert.deepEqual(s.ingredients, ['4 or 5 sour apples', '⅓ cup sugar', '¼ teaspoon grated nutmeg']);
  assert.deepEqual(s.steps, ['Line pie plate with paste.', 'Pare, core, and cut the apples into eighths.', 'Dot over with butter.']);
  assert.equal(s.how, 'list');
  assert.equal(structureFromList(SOURCE), null); // prose is not a list
});

const mockModel = (...replies) => { let i = 0; return async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(replies[Math.min(i++, replies.length - 1)]) } }] }) }); };
const llm = { baseUrl: 'http://x/v1', model: 'm', apiKey: 'k' };

test('the model path: accepts a faithful answer, retries once on an invented one, and gives up quietly', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = mockModel(GOOD);
    assert.equal((await structureReceipt(SOURCE, { llm })).how, 'model');
    const invented = { ...GOOD, ingredients: [...GOOD.ingredients, 'a teaspoon cinnamon'] };
    globalThis.fetch = mockModel(invented, GOOD);                              // first attempt invents, second is faithful
    const logs = [];
    assert.equal((await structureReceipt(SOURCE, { llm, log: (m) => logs.push(m) })).how, 'model');
    assert.match(logs[0], /rejected/);
    globalThis.fetch = mockModel(invented);                                    // never faithful: nothing is shown
    assert.equal(await structureReceipt(SOURCE, { llm }), null);
    globalThis.fetch = async () => { throw new Error('offline'); };            // model unreachable
    assert.equal(await structureReceipt(SOURCE, { llm }), null);
  } finally { globalThis.fetch = real; }
});

test('no model offline, and a cut-short receipt is never turned into a "complete" recipe', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('must not be called'); };
  try {
    assert.equal(await structureReceipt(SOURCE, { llm, offline: true }), null);
    assert.equal(await structureReceipt(`${SOURCE.slice(0, 120)} …`, { llm }), null);
  } finally { globalThis.fetch = real; }
});

test('the page shows the original, then the recipe layout, with an honest note on how it was made', () => {
  const story = buildStories(findMoves(people, 1))[0];
  const recipes = pickRecipes(story, new Set());
  const book = { id: 'b28142214', source: 'archive', title: 'The International Cook Book', author: 'Alexander Filippini', year: 1907 };
  const chapters = (structured) => {
    recipes[0].period = { book, title: 'Welsh Rarebit', text: SOURCE, structured };
    return [{ story, recipes, text: { ...templateChapter(story, recipes), source: 'template' } }];
  };
  const html = renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters: chapters({ ...GOOD, how: 'model' }), people, modelLabel: 'gemma3:4b' });
  assert.ok(html.indexOf('Place a gill of Bass') < html.indexOf('In a recipe layout')); // the verbatim original comes first
  assert.match(html, /<li>a saltspoon cayenne pepper<\/li>/);
  assert.match(html, /Restructured by an open-weight model \(gemma3:4b\) and checked against the original: every ingredient and quantity is in the text above, and nothing was added\. Not kitchen-tested\./);
  assert.match(html, /<b>Note:<\/b> The original gives no quantity of toast\./);
  assert.ok(html.indexOf('Restructured by an open-weight model') < html.indexOf('Ingredients</b>')); // the note comes before the layout, so it can never be orphaned on the next page
  const listed = renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters: chapters({ ingredients: ['1 cup flour'], steps: ['Bake.'], notes: [], how: 'list' }), people });
  assert.match(listed, /Reformatted from the receipt above: the wording is the original's\./);
  assert.doesNotMatch(renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters: chapters(null), people }), /In a recipe layout/);
});

import { tidyStructured } from '../src/modernize.js';

test('tidying is formatting only: capital and full stop, no bullets, equipment out of the ingredients, method out of the notes', () => {
  const t = tidyStructured({
    ingredients: ['- one pound cheese;', '2. a hot dish', 'six very hot egg dishes', 'half a pint of ale'],
    steps: ['melt the cheese', '1) Add the ale.'],
    notes: ['Dress on a hot dish. Serve.', 'The original gives no oven temperature.', 'The original gives no quantity of toast.'],
  }, 'Melt the cheese in a saucepan on the fire and serve on toast.');
  assert.deepEqual(t.ingredients, ['one pound cheese', 'half a pint of ale']);
  assert.deepEqual(t.steps, ['Melt the cheese.', 'Add the ale.', 'Dress on a hot dish. Serve.']);
  assert.deepEqual(t.notes, ['The original gives no quantity of toast.']); // no oven in the receipt, so no oven-temperature remark
  const baked = tidyStructured({ ingredients: ['flour'], steps: ['Bake.'], notes: ['The original gives no oven temperature.'] }, 'Bake the pie in a moderate oven.');
  assert.deepEqual(baked.notes, ['The original gives no oven temperature.']); // the receipt bakes, so the gap is real
});

test('a model that writes the whole receipt as one step, repeats itself, or returns one step is rejected on quality', async () => {
  const real = globalThis.fetch;
  try {
    const wholeAsOne = { ingredients: GOOD.ingredients, steps: [SOURCE], notes: [] };
    globalThis.fetch = mockModel(wholeAsOne);
    assert.equal(await structureReceipt(SOURCE, { llm }), null);
    const repeated = { ingredients: GOOD.ingredients, steps: ["Place in a small saucepan a gill of Bass's ale.", 'Place in a small saucepan the cheese.', 'Stir with a wooden spoon.'], notes: [] };
    globalThis.fetch = mockModel(repeated);
    assert.equal(await structureReceipt(SOURCE, { llm }), null);
    // a model that leaves off the full stops is fine: that is formatting
    globalThis.fetch = mockModel({ ingredients: GOOD.ingredients, steps: ['place the ale, Worcestershire sauce and cayenne pepper in a small saucepan', 'as soon as it briskly boils, add the cheese', 'stir continually with a wooden spoon until melted', 'dress on hot toast and serve'], notes: [] });
    const ok = await structureReceipt(SOURCE, { llm });
    assert.equal(ok.steps[0], 'Place the ale, Worcestershire sauce and cayenne pepper in a small saucepan.');
  } finally { globalThis.fetch = real; }
});

test('a receipt that ends mid-sentence (cut by a page break) is never structured', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('must not be called'); };
  try { assert.equal(await structureReceipt('Place in a bowl two ounces buckwheat flour, one ounce wheat flour, one whole egg, two gills cold milk, one teaspoon', { llm }), null); }
  finally { globalThis.fetch = real; }
});

import { mergeGapNotes } from '../src/modernize.js';

test('gaps the original leaves out are said once, in one sentence', () => {
  assert.deepEqual(mergeGapNotes(['The original gives no oven temperature.', 'The original gives no baking time.']), ['The original gives no oven temperature or baking time.']);
  assert.deepEqual(mergeGapNotes(['The original gives no oven temperature.', 'The original gives no baking time.', 'The original gives no quantity of salt.']), ['The original gives no oven temperature, baking time or quantity of salt.']);
  assert.deepEqual(mergeGapNotes(['The original gives no oven temperature.']), ['The original gives no oven temperature.']);
  assert.deepEqual(mergeGapNotes(['The original gives no baking time.', 'the original gives no baking time']), ['The original gives no baking time.']); // duplicates collapse
  assert.deepEqual(mergeGapNotes(['Serve with cream.', 'The original gives no baking time.']), ['The original gives no baking time.', 'Serve with cream.']);
  assert.deepEqual(mergeGapNotes([]), []);
  // end to end through the tidy step the model's answer goes through
  const t = tidyStructured({ ingredients: ['flour'], steps: ['Bake it.'], notes: ['The original gives no oven temperature.', 'The original gives no baking time.'] }, 'Bake the pie in a moderate oven.');
  assert.deepEqual(t.notes, ['The original gives no oven temperature or baking time.']);
});
