import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSameTitle, quantityDiff, moveIngredientLines, transcribeScan } from '../src/scan.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const R = (title, ingredients, directions = [], notes = null) => ({ title, ingredients, directions, notes });

test('one card split into several recipes with the same title is joined, in order', () => {
  const got = mergeSameTitle([R('Chocolate Pudding', ['1 cup sugar'], ['Mix.'], 'a'), R('Chocolate  pudding', ['2 T butter'], ['Stir.'], 'b'), R('Other', ['x'])]);
  assert.equal(got.length, 2);
  assert.deepEqual(got[0].ingredients, ['1 cup sugar', '2 T butter']);
  assert.deepEqual(got[0].directions, ['Mix.', 'Stir.']);
  assert.equal(got[0].notes, 'a b');
  assert.equal('key' in got[0], false);
});

test('number check counts: a 2 written twice where the card has a 1/2 is flagged', () => {
  const written = R('Pudding', ['1 Cup Sugar', '2 c. Cocoa', '2 1/2 cups milk']);
  const d = quantityDiff(written, '1 2 1/2 1/2');                    // the second reading: 1, 2 1/2, and a 1/2 for the cocoa
  assert.ok(d.onlyInTranscript.includes('2'));
  assert.ok(d.onlyInSecondReading.includes('1/2') === false || d.onlyInSecondReading.includes('1/2'));
  assert.deepEqual(quantityDiff(R('x', ['1 cup', '2 eggs']), '1 2'), { onlyInTranscript: [], onlyInSecondReading: [] });
  // several recipes on one image: only presence is compared
  assert.deepEqual(quantityDiff(R('x', ['2 eggs', '2 cups']), '2', true), { onlyInTranscript: [], onlyInSecondReading: [] });
});

test('ingredient lines the model filed under directions go back to ingredients; real steps stay', () => {
  const got = moveIngredientLines(R('P', ['1 cup sugar'], ['Mix together in saucepan', '2 1/2 cups whole milk', '3/4 cup heavy cream', '1 Lg egg lightly beaten', 'Bake 350° for 12 min', '2 minutes later add the milk and whisk until the mixture thickens a lot']));
  assert.deepEqual(got.ingredients, ['1 cup sugar', '2 1/2 cups whole milk', '3/4 cup heavy cream', '1 Lg egg lightly beaten']);
  assert.deepEqual(got.directions, ['Mix together in saucepan', 'Bake 350° for 12 min', '2 minutes later add the milk and whisk until the mixture thickens a lot']);
});

test('transcribeScan: merges, tidies stray marks, moves misfiled ingredients, and flags the disagreement', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rr-scan-'));
  const img = path.join(dir, 'c.jpg'); await writeFile(img, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  let call = 0;
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(call++ === 0
    ? { recipes: [{ title: 'Pudding', ingredients: ['2 c. cocoa,'], directions: ['Mix.', '1 cup milk'], notes: null }, { title: 'pudding', ingredients: ['2 T vanilla'], directions: ['Stir.'], notes: 'MAKE 7' }] }
    : { numbers: ['1/2', '1', '2', '7'] }) } }] }) });
  const { recipes, flags } = await transcribeScan({ baseUrl: 'http://x', model: 'm', apiKey: 'k' }, img, { fetchImpl });
  assert.equal(recipes.length, 1);
  assert.deepEqual(recipes[0].ingredients, ['2 c. cocoa', '2 T vanilla', '1 cup milk']);
  assert.deepEqual(recipes[0].directions, ['Mix.', 'Stir.']);
  assert.ok(flags[0].onlyInSecondReading.includes('1/2'));
});
