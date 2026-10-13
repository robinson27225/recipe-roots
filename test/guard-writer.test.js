import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedYears, validateText } from '../src/guard.js';
import { writeChapter, factsFor } from '../src/writer.js';
import { pickRecipes } from '../src/pantry.js';
import { findMoves, buildStories } from '../src/migrations.js';
import { parseAncestry, isWikiTreeId, WikiTreeError } from '../src/wikitree.js';
import { people } from './fixtures.js';

const story = buildStories(findMoves(people, 1))[0];

test('guard rejects invented years and provenance claims', () => {
  const years = new Set([1893, 1890]);
  assert.ok(validateText('They arrived in 1893.', years).ok);
  assert.ok(validateText('Families in the 1890s ate soda bread.', years).ok); // decade of an allowed year
  assert.ok(!validateText('They arrived in 1887.', years).ok);
  assert.ok(!validateText('A recipe handed down through the family.', years).ok);
  assert.ok(!validateText('They sailed aboard the Etruria.', years).ok);
});
test('guard rejects invented kinship, speculation, meta text and number openers', () => {
  const years = new Set([1893]);
  const bad = ['Their great-grandfather also travelled there.', 'Her aunt came along.', 'They would have encountered pot pie.', 'This cookbook seeks to document the move.',
    'Stanislaw also travelled to join them.', '1893. Nora left Cork.'];
  for (const t of bad) assert.ok(!validateText(t, years).ok, t);
  assert.ok(validateText('Nora left Cork sometime before 1893, and families there might have eaten soda bread.', years).ok);
});
test('model never sees relations or death years', () => {
  const facts = JSON.stringify(factsFor(story, pickRecipes(story, new Set())));
  assert.ok(!/great-|grand|"died"|relation|Murphy|Walsh|"people"/.test(facts));
  assert.ok(!facts.includes('1930')); // Patrick's death year in the fixture
});
test('allowedYears come from the supplied facts only', () => {
  const recipes = pickRecipes(story, new Set());
  const years = allowedYears(factsFor(story, recipes));
  assert.ok(years.has(story.lo) && years.has(story.hi)); // the move window is fair game
  assert.ok(!years.has(1860) && !years.has(1865)); // birth years of people are not shown to the model
  assert.ok(!years.has(1750));
});
test('pantry respects era and returns origin + destination dishes', () => {
  const recipes = pickRecipes(story, new Set());
  assert.equal(recipes.length, 3);
  assert.ok(recipes.filter((r) => r.side === 'origin').every((r) => r.region === 'ireland' && r.from <= story.hi));
  assert.ok(recipes.some((r) => r.side === 'destination'));
});
test('pantry returns nothing for a medieval move', () => {
  const old = { ...story, id: 'x', lo: 1300, hi: 1350 };
  assert.equal(pickRecipes(old, new Set()).length, 0);
});

const mockModel = (reply) => async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(reply) } }] }) });
const llm = { baseUrl: 'http://x/v1', model: 'm', apiKey: 'k' };

test('a hallucinating model falls back to templates', async () => {
  const recipes = pickRecipes(story, new Set());
  const bad = { food_passage: 'Kitchens in 1847 were busy, and the SS Etruria brought flour. ' + Array(80).fill('word').join(' '), headnotes: {} };
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockModel(bad);
  try {
    const out = await writeChapter(story, recipes, { llm, offline: false, log: () => {} });
    assert.equal(out.source, 'template');
    assert.ok(!/1847|Etruria/.test(out.intro));
    assert.ok(out.intro.includes('Patrick Murphy'));
  } finally { globalThis.fetch = realFetch; }
});

test('a good model response passes through (global fetch mocked)', async () => {
  const recipes = pickRecipes(story, new Set());
  const words = (n) => Array(n).fill('simple').join(' ');
  const reply = { food_passage: `Families from Ireland often cooked soda bread and stew in those years. ${words(50)}`, headnotes: Object.fromEntries(recipes.map((r) => [r.id, `Families there often cooked this. ${words(20)}`])) };
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockModel(reply);
  try {
    const out = await writeChapter(story, recipes, { llm, offline: false, log: () => {} });
    assert.equal(out.source, 'model');
    assert.ok(out.intro.startsWith('Records on WikiTree place'), 'facts about people come from code, first');
    assert.ok(out.intro.includes('Patrick Murphy'));
  } finally { globalThis.fetch = realFetch; }
});

test('valid model parts are kept even when another part fails', async () => {
  const recipes = pickRecipes(story, new Set());
  const words = (n) => Array(n).fill('simple').join(' ');
  const headnotes = Object.fromEntries(recipes.map((r, i) => [r.id, i === 0 ? '' : `Families often cooked this. ${words(20)}`]));
  const reply = { food_passage: `Families from Ireland often cooked soda bread in those years. ${words(50)}`, headnotes };
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockModel(reply);
  try {
    const out = await writeChapter(story, recipes, { llm, offline: false, log: () => {} });
    assert.equal(out.source, 'mixed');
    assert.ok(out.intro.includes('soda bread in those years'));
    assert.equal(out.headnotes[recipes[0].id], recipes[0].note); // the failed one fell back
    assert.ok(out.headnotes[recipes[1].id].startsWith('Families often cooked'));
  } finally { globalThis.fetch = realFetch; }
});

test('model text that names a person it was never told about is rejected', async () => {
  const recipes = pickRecipes(story, new Set());
  const words = (n) => Array(n).fill('simple').join(' ');
  const reply = { food_passage: `Nora Walsh baked soda bread every week. ${words(50)}`, headnotes: Object.fromEntries(recipes.map((r) => [r.id, `Families often cooked this. ${words(20)}`])) };
  const realFetch = globalThis.fetch;
  globalThis.fetch = mockModel(reply);
  try {
    const out = await writeChapter(story, recipes, { llm, offline: false, log: () => {} });
    assert.equal(out.source, 'mixed'); // headnotes were fine, the passage was not
    assert.ok(!out.intro.includes('baked soda bread every week'));
    assert.ok(out.intro.includes('traditional dishes from')); // template food paragraph took its place
  } finally { globalThis.fetch = realFetch; }
});

test('offline mode never calls the model', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('should not be called'); };
  try {
    const out = await writeChapter(story, pickRecipes(story, new Set()), { llm, offline: true });
    assert.equal(out.source, 'template');
  } finally { globalThis.fetch = realFetch; }
});

test('WikiTree id validation and permission errors', () => {
  assert.ok(isWikiTreeId('Windsor-1') && isWikiTreeId('Sachsen-Coburg_und_Gotha-4') && isWikiTreeId('Müller-12'));
  assert.ok(!isWikiTreeId('not an id') && !isWikiTreeId('Windsor'));
  assert.throws(() => parseAncestry([{ status: '', resultByKey: { 'A-1': { Id: 5, status: 'Ancestor/Descendant permission denied.' } }, people: { '-1': { Id: -1 } } }], 'A-1'), WikiTreeError);
});

import { renderBook } from '../src/book.js';
import { templateChapter } from '../src/writer.js';

test('book never claims a model wrote text that came from templates', () => {
  const recipes = pickRecipes(story, new Set());
  const chap = (source) => ({ story, recipes, text: { ...templateChapter(story, recipes), source } });
  const base = { title: 'T', subtitle: 'S', rootId: 'Sample-1', modelLabel: 'gemma3:4b' };
  const none = renderBook({ ...base, chapters: [chap('template')] });
  assert.match(none, /no AI model wrote any of it/);
  assert.doesNotMatch(none, /open-weight model/);
  const all = renderBook({ ...base, chapters: [chap('model')] });
  assert.match(all, /drafted by an open-weight model \(gemma3:4b\)/);
  const mixed = renderBook({ ...base, chapters: [chap('model'), chap('template')] });
  assert.match(mixed, /1 of 2 chapters/);
  const partial = renderBook({ ...base, chapters: [chap('mixed')] });
  assert.match(partial, /in whole or in part by an open-weight model/);
});

test('template text caps long name lists', () => {
  const big = { ...story, people: Array.from({ length: 7 }, (_, i) => ({ ...story.people[0], name: `Person ${i}` })) };
  const t = templateChapter(big, []);
  assert.match(t.intro, /4 other relatives/);
  assert.doesNotMatch(t.intro, /Person 6/);
});
