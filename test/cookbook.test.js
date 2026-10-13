import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVolume, splitBody, ingredientLines, matchTree, toFamilyRecipe, unwrap } from '../src/cookbook.js';
import { parseFamilyRecipes, attachRelatives } from '../src/family.js';
import { people } from './fixtures.js';

// Pages are built the way tools/pdf-runs.swift reports them (font, size, text), with the layouts seen in the real PDFs.
const run = (text, size, font = 'Calibri') => ({ font, size, text });
const header = ({ title, ancestor, wikitreer, role = 'Ancestor', s = 1 }) => [
  run('Recipe\n', 30, 'Calibri-Bold'), run(`${title}\n`, 29 * s), run(`${role}\n`, 24 * s, 'Calibri-Bold'), run(`${ancestor}\n`, 24 * s),
  run('WikiTreer\n', 19 * s, 'Calibri-Bold'), run(`${wikitreer}\n`, 19 * s), run('back to Table of Contents ', 18), run('~ 20 ~\n', 18),
];
const link = (text, id) => ({ text, url: `https://www.wikitree.com/wiki/${id}` });
const page = (runs, links = []) => ({ runs, links });

test('parses a normal recipe page: title, people, IDs, ingredients, directions, story, page number', () => {
  const [r] = parseVolume([page([
    ...header({ title: 'Baked Beans', ancestor: 'Irene Evelyn (Hennager) Thomas', wikitreer: 'Mindy Silva' }),
    run('Ingredients\n1 large can beans\n½ cup molasses\nDirections:\nPut everything in a pot. Cook until simmering and until', 13),
    run(' ', 13, 'Calibri-Bold'), run('the\nbacon', 13), run(' ', 13, 'Calibri-Bold'), run('is cooked.\n', 13),
    run('I believe this recipe came from\nmy grandmother, Irene.', 12, 'Calibri-Italic'),
  ], [link('Irene Evelyn (Hennager) Thomas', 'Hennager-12'), link('Mindy Silva', 'Silva-1055')])], { volume: 2 });
  assert.equal(r.title, 'Baked Beans');
  assert.equal(r.ancestorId, 'Hennager-12');
  assert.equal(r.wikiTreerId, 'Silva-1055');
  assert.deepEqual(r.ingredients, ['1 large can beans', '½ cup molasses']);
  assert.match(r.directions[0], /until the bacon is cooked\./); // bold whitespace runs keep the real spaces
  assert.equal(r.story, 'I believe this recipe came from my grandmother, Irene.'); // story is not duplicated into directions
  assert.doesNotMatch(r.directions[0], /believe this recipe/);
  assert.equal(r.page, 20);
});

test('copes with the layout shrinking text, and with the "Descendant" label', () => {
  const [r] = parseVolume([page([
    ...header({ title: 'Faux Strough', ancestor: 'Tori Brunson', wikitreer: 'Pat Brunson', role: 'Descendant', s: 25 / 24 }),
    run('Ingredients\n1 pound ground beef\nDirections:\nBrown the beef.', 14),
  ], [link('Tori Brunson', 'Brunson-1'), link('Pat Brunson', 'Brunson-2')])], { volume: 15 });
  assert.equal(r.role, 'Descendant');
  assert.equal(r.title, 'Faux Strough');
  assert.deepEqual(r.ingredients, ['1 pound ground beef']);
});

test('continuation pages add to the same recipe; clippings with a citation link become sources', () => {
  const cont = (extra, links) => page([...header({ title: 'Beans (cont.)', ancestor: 'Emma Brinton', wikitreer: 'Warren Kuntz' }), ...extra], [link('Emma Brinton', 'Southwick-1'), link('Warren Kuntz', 'Kuntz-9'), ...links]);
  const [r] = parseVolume([
    page([...header({ title: 'Beans', ancestor: 'Emma Brinton', wikitreer: 'Warren Kuntz' }), run('Ingredients\n2 cups beans\nDirections:\nSoak overnight.', 13)], [link('Emma Brinton', 'Southwick-1'), link('Warren Kuntz', 'Kuntz-9')]),
    cont([run('Then boil for an hour.', 13)], []),
    cont([run('Yoder, F. "A Recipe", The Washington Times, 1916', 12)], [{ text: 'Yoder', url: 'https://chroniclingamerica.loc.gov/x' }]),
  ], { volume: 2 });
  assert.equal(r.directions.length, 2);
  assert.match(r.directions[1], /boil for an hour/);
  assert.match(r.sources[0], /Washington Times/);
});

test('free-form recipes (no headings) are kept whole as directions; multi-part ingredients keep their headings', () => {
  const free = splitBody('Pie crust:\n1 pound Crisco\n5 cups flour\nBlend the Crisco into the flour.');
  assert.deepEqual(free.ingredients, []);
  assert.match(free.directions[0], /1 pound Crisco 5 cups flour Blend/);
  const multi = splitBody('Ingredients (Brown part)\n1 cup brown sugar\nIngredients (White part)\n2 cups flour\nDirections:\nMix.');
  assert.deepEqual(multi.ingredients, ['Brown part:', '1 cup brown sugar', 'White part:', '2 cups flour']);
  assert.deepEqual(multi.directions, ['Mix.']);
});

test('ingredient lines that wrapped in the PDF are rejoined when clearly unfinished', () => {
  assert.deepEqual(ingredientLines('2 cups canned corn (I use 1 can of\nkernel corn and 1 can of cream corn)\n1 beaten egg'),
    ['2 cups canned corn (I use 1 can of kernel corn and 1 can of cream corn)', '1 beaten egg']);
  assert.equal(unwrap('Bake at 350°\nF for an hour.'), 'Bake at 350° F for an hour.');
});

test('finds an ancestor ID by shared name words when the link text is shorter', () => {
  const [r] = parseVolume([page([
    ...header({ title: 'Peach Cream Pie', ancestor: 'Donna Jean (Lambka) Kimbel', wikitreer: 'Sally Kimbel' }),
    run('Ingredients\n1 pie shell\nDirections:\nBake.', 14),
  ], [link('Donna Kimbel', 'Kimbel-161'), link('Sally Kimbel', 'Kimbel-162')])], { volume: 10 });
  assert.equal(r.ancestorId, 'Kimbel-161');
  assert.equal(r.wikiTreerId, 'Kimbel-162');
});

test('pages without the recipe banner are ignored (index pages, part openers)', () => {
  assert.deepEqual(parseVolume([page([run('Side Dishes', 40), run('Part One', 20)]), page([run('Index by Ancestor\n', 20)])], { volume: 2 }), []);
});

// ---- matching against a tree (fixture: Patrick Murphy-11 and Nora Walsh-20 are grandparents; root Sample-1 is living) ----
const rec = (o) => ({ volume: 2, page: 5, title: 'Soup', ancestorName: 'X', ancestorId: null, wikiTreerName: 'Cook', wikiTreerId: null, ingredients: ['1 potato'], directions: [], story: null, sources: [], ...o });

test('matchTree: ancestors, relatives and "shared by you", never living people or the subject', () => {
  const recipes = [
    rec({ title: 'A', ancestorId: 'Murphy-11' }),                       // direct ancestor
    rec({ title: 'B', ancestorId: 'Murphy-99' }),                       // a great-aunt, supplied as a relative
    rec({ title: 'C', ancestorId: 'Stranger-1', wikiTreerId: 'Sample-1' }), // shared by the tree's own subject
    rec({ title: 'D', ancestorId: 'Stranger-2' }),                      // nobody we know
    rec({ title: 'E', ancestorId: 'Sample-1' }),                        // the living subject: excluded
  ];
  const relatives = [{ wikiTreeId: 'Murphy-99', relation: 'great-aunt' }];
  const hits = matchTree(recipes, people, 1, relatives);
  assert.deepEqual(hits.map((h) => [h.recipe.title, h.via, h.relation]), [['A', 'ancestor', 'grandfather'], ['B', 'relative', 'great-aunt'], ['C', 'shared-by', 'you']]);
  const living = new Map(people); living.set(4, { ...people.get(4), IsLiving: 1 });
  assert.equal(matchTree([rec({ ancestorId: 'Murphy-11' })], living, 1).length, 0);
});

test('toFamilyRecipe credits the cookbook, volume, page and the member who shared it', () => {
  const f = toFamilyRecipe(rec({ title: 'Soup', ancestorId: 'Murphy-11', wikiTreerName: 'Mindy Silva', wikiTreerId: 'Silva-1055', volume: 2, page: 20, story: 'Nana cooked it.' }));
  assert.equal(f.ancestor, 'Murphy-11');
  assert.equal(f.contributor, 'Mindy Silva');
  assert.match(f.source, /WikiTree 15th Anniversary Cookbook, vol\. 2, p\. 20; shared by Mindy Silva \(wikitree\.com\/wiki\/Silva-1055\)/);
  assert.equal(parseFamilyRecipes(JSON.stringify([f]))[0].source, f.source); // round-trips through the family-recipes loader
});

test('family recipes may have only directions (free-form), but not nothing', () => {
  assert.equal(parseFamilyRecipes(JSON.stringify([{ title: 'T', ancestor: 'A-1', directions: ['Mix.'] }]))[0].ingredients.length, 0);
  assert.throws(() => parseFamilyRecipes(JSON.stringify([{ title: 'T', ancestor: 'A-1' }])), /ingredients/);
});

// ---- privacy: anyone who can't be confirmed deceased is left out unless permission is given ----
const livingTree = (() => { const m = new Map(people); m.set(4, { ...people.get(4), IsLiving: 1 }); return m; })();
const base = { directions: ['Boil.'], ingredients: ['1 potato'] };
const noNetwork = { fetchImpl: async () => ({ ok: true, json: async () => [{ status: 'Invalid profile' }] }), cacheDir: '/nonexistent/rr-cache' };

test("a living or unreadable person's recipe is left out, with a reason, unless permission is given", async () => {
  const warnings = [];
  const raw = parseFamilyRecipes(JSON.stringify([
    { ...base, title: 'Living', ancestor: 'Murphy-11' },                                   // living in this tree
    { ...base, title: 'Unknown', ancestor: 'Nobody-1' },                                   // can't be found
    { ...base, title: 'Allowed', ancestor: 'Nobody-2', permission: true, ancestorName: 'Jean Smith' },
    { ...base, title: 'Fine', ancestor: 'Walsh-20' },                                      // deceased, in the tree
  ]));
  const { recipes } = await attachRelatives(raw, livingTree, 1, { warn: (w) => warnings.push(w), ...noNetwork });
  assert.deepEqual(recipes.map((r) => r.title), ['Allowed', 'Fine']);
  assert.equal(recipes[0].ancestorName, 'Jean Smith');
  assert.equal(recipes[0].person, null); // no photo or fan chart for someone we couldn't verify
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /"permission": true/);
});

test('without a supplied name, a permitted unknown person is shown by their WikiTree ID, not guessed at', async () => {
  const raw = parseFamilyRecipes(JSON.stringify([{ ...base, title: 'T', ancestor: 'Nobody-3', permission: true }]));
  const { recipes } = await attachRelatives(raw, people, 1, noNetwork);
  assert.equal(recipes[0].ancestorName, 'Nobody-3');
});
