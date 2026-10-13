import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseReceipts, titleMatch, excerpt, booksFor, findPeriodReceipts, fetchBook, namesFor } from '../src/period.js';
import { renderBook } from '../src/book.js';
import { pickRecipes } from '../src/pantry.js';
import { findMoves, buildStories } from '../src/migrations.js';
import { templateChapter } from '../src/writer.js';
import PANTRY from '../data/pantry.js';
import { people } from './fixtures.js';

const dish = (id) => PANTRY.find((d) => d.id === id);

// A miniature of Child (ALL-CAPS headings, with a table of contents) and Farmer (centred headings, ingredient lists).
const CHILD = `
CONTENTS.

    BAKED INDIAN PUDDING.
    HASTY PUDDING.
    APPLE PIE.


BAKED INDIAN PUDDING.

Indian pudding is good baked. Scald a quart of milk (skimmed milk
will do,) and stir in seven table spoonfuls of sifted _Indian_ meal, a
tea-spoonful of salt, and a tea-cupful of molasses.


HASTY PUDDING.

Boil water, a quart, three pints, or two quarts, according to the size
of your family; sift your meal and stir it in thoroughly.

                           * * * * *
`;
const FARMER = `
                         Boston Baked Beans

                         1 qt pea beans
                         1 tbsp salt
                         3 tbsp sugar

Pick over beans and soak over night. In morning drain, cover with fresh
water and cook until skins will burst. Bake slowly six or eight hours.


                         Marrowfat Beans Baked

Soak the beans and bake them in a slow oven until they are tender and brown.
`;

test('parses ALL-CAPS and centred-title layouts, and ignores table-of-contents lines', () => {
  const child = parseReceipts(CHILD);
  assert.deepEqual(child.map((r) => r.title), ['BAKED INDIAN PUDDING', 'HASTY PUDDING']); // the contents list is not receipts
  assert.match(child[0].body, /seven table spoonfuls/);
  const farmer = parseReceipts(FARMER);
  assert.deepEqual(farmer.map((r) => r.title), ['Boston Baked Beans', 'Marrowfat Beans Baked']);
  assert.match(farmer[0].body, /1 qt pea beans/);
});

test('title matching is strict: the same dish, not a similar one', () => {
  assert.ok(titleMatch(dish('indian-pudding'), 'BAKED INDIAN PUDDING') > 0);
  assert.ok(titleMatch(dish('baked-beans'), 'Boston Baked Beans') > 0);
  assert.ok(titleMatch(dish('welsh-rarebit'), 'Welsh Rarebit I') > 0);
  assert.ok(titleMatch(dish('fried-apples'), 'APPLES FRIED') > 0);
  assert.equal(titleMatch(dish('baked-beans'), 'MARROWFAT BEANS BAKED'), 0);       // a different bean
  assert.equal(titleMatch(dish('indian-pudding'), 'Mock Indian Pudding'), 0);      // a substitute
  assert.equal(titleMatch(dish('apple-butter'), 'APPLES STEWED IN BUTTER'), 0);    // a different thing
  assert.equal(titleMatch(dish('buttermilk-biscuits'), 'Rye Biscuit'), 0);
  assert.equal(titleMatch(dish('bread-butter-pudding'), 'BROWN BREAD PUDDING'), 0);
  assert.equal(titleMatch(dish('cornbread'), 'JOHNNY CAKE'), 0);                  // related, not the same dish
  assert.equal(titleMatch(dish('buttermilk-biscuits'), 'BISCUITS'), 0);            // plain biscuits are not buttermilk biscuits
  assert.ok(titleMatch(dish('buttermilk-biscuits'), 'BUTTERMILK BISCUIT') > 0);
  assert.equal(titleMatch(dish('chicken-and-noodles'), 'BAKED CHICKEN AND NOODLES'), 0); // a casserole
  assert.ok(titleMatch(dish('chicken-and-noodles'), 'CHICKEN AND NOODLES') > 0);
  assert.ok(titleMatch(dish('baked-beans'), 'BAKED BEANS') > 0 && titleMatch(dish('indian-pudding'), 'BAKED INDIAN PUDDING') > 0); // 'baked' is still harmless elsewhere
  assert.equal(titleMatch(dish('indian-pudding'), 'PREFACE'), 0);
  assert.deepEqual(namesFor({ id: 'nope', name: 'Some Dish' }), ['Some Dish']);
});

test('quotations are verbatim: markup and ornaments go, words never change', () => {
  const [pudding, hasty] = parseReceipts(CHILD);
  const q = excerpt(pudding.body);
  assert.equal(q, 'Indian pudding is good baked. Scald a quart of milk (skimmed milk will do,) and stir in seven table spoonfuls of sifted Indian meal, a tea-spoonful of salt, and a tea-cupful of molasses.');
  assert.doesNotMatch(excerpt(hasty.body), /\* \* \*/); // section ornament dropped
  const list = excerpt(parseReceipts(FARMER)[0].body);
  assert.match(list, /1 qt pea beans\n1 tbsp salt\n3 tbsp sugar/); // an ingredient list stays a list
  const long = 'Word '.repeat(80).trim() + '.\n\n' + 'More '.repeat(80).trim() + '.';
  assert.match(excerpt(long, 300), /…$/); // truncation is marked, never silent
});

test('heritage and era pick the books: regional before general, then nearest in time', () => {
  const books = [
    { id: 1, year: 1832, regions: ['usa-new-england'] },
    { id: 2, year: 1857, regions: ['usa-general'] },
    { id: 3, year: 1877, regions: ['usa-south'] },
    { id: 4, year: 1906, regions: ['usa-new-england', 'usa-general'] },
    { id: 5, year: null, regions: ['usa-mid-atlantic'] },   // undated: matches on region alone
    { id: 6, year: 1919, regions: ['italy'] },
  ];
  const story = (from, to, lo, hi) => ({ from: { key: from }, to: { key: to }, lo, hi, mid: Math.round((lo + hi) / 2) });
  const ids = (s) => booksFor(s, books).map((b) => b.id);
  // Irish family in New England, 1840-1860: the two New England books first (nearest first), then the general one.
  assert.deepEqual(ids(story('ireland', 'usa-new-england', 1840, 1860)), [1, 4, 2]);
  // A Southern line gets the Southern book first even though the general 1857 book is a closer year.
  assert.deepEqual(ids(story('germany', 'usa-south', 1850, 1860)).slice(0, 2), [3, 2]);
  // Undated regional book is offered for its region whatever the era, after dated regional ones.
  assert.deepEqual(ids(story('usa-new-england', 'usa-mid-atlantic', 1700, 1720)), [5]);
  assert.ok(ids(story('usa-new-england', 'usa-mid-atlantic', 1850, 1860)).includes(5));
  // Italian family in New England around 1907: the 1832 book is too early, the 1906 New England book is nearest,
  // then the Italian-American book, then the general one. Both specific books outrank the general one.
  assert.deepEqual(ids(story('italy', 'usa-new-england', 1900, 1915)), [4, 6, 2]);
  assert.deepEqual(ids(story('germany', 'poland', 1850, 1860)), []);           // no US heritage, no US books
  assert.deepEqual(ids(story('usa-south', 'usa-midwest', 1500, 1520)), []); // far outside every dated book's era
});

const wrap = (body) => `Header\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\n${body}\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nLicense text`;
const book = { id: 1, title: 'The American Frugal Housewife', author: 'Lydia Maria Child', year: 1832, regions: ['usa-new-england'] };

test('fetchBook strips the Gutenberg wrapper and caches; failures return null, never throw', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rr-gut-'));
  let calls = 0;
  const ok = async () => { calls++; return { ok: true, text: async () => wrap(CHILD) }; };
  const text = await fetchBook(book, { cacheDir: dir, fetchImpl: ok });
  assert.ok(text.includes('BAKED INDIAN PUDDING') && !text.includes('License text') && !text.includes('Header'));
  await fetchBook(book, { cacheDir: dir, fetchImpl: ok });
  assert.equal(calls, 1);
  const down = async () => { throw new Error('offline'); };
  assert.equal(await fetchBook({ ...book, id: 2 }, { cacheDir: dir, fetchImpl: down }), null);
});

test('findPeriodReceipts quotes matching dishes and degrades to nothing when the network is down', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rr-gut-'));
  const story = { from: { key: 'usa-new-england' }, to: { key: 'usa-new-england' }, lo: 1825, hi: 1840, mid: 1832 };
  const dishes = [dish('indian-pudding'), dish('hasty-pudding'), dish('succotash')];
  const ok = async () => ({ ok: true, text: async () => wrap(CHILD) });
  const found = await findPeriodReceipts(story, dishes, { books: [book], cacheDir: dir, fetchImpl: ok });
  assert.deepEqual([...found.keys()], ['indian-pudding', 'hasty-pudding']); // succotash isn't in this book: no quotation, no guess
  assert.equal(found.get('indian-pudding').book.year, 1832);
  const logs = [];
  const none = await findPeriodReceipts(story, dishes, { books: [{ ...book, id: 99 }], cacheDir: await mkdtemp(path.join(os.tmpdir(), 'rr-gut-')), fetchImpl: async () => { throw new Error('offline'); }, log: (m) => logs.push(m) });
  assert.equal(none.size, 0);
  assert.match(logs[0], /couldn't be fetched/);
});

test('an undated book is credited as undated, not given an invented year', () => {
  const story = buildStories(findMoves(people, 1))[0];
  const recipes = pickRecipes(story, new Set());
  recipes[0].period = { book: { id: 26558, title: 'Pennsylvania Dutch Cooking', author: 'Anonymous', year: null, note: 'undated' }, title: 'SCRAPPLE', text: 'Cook the meat.' };
  const chapters = [{ story, recipes, text: { ...templateChapter(story, recipes), source: 'template' } }];
  const html = renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters, people });
  assert.match(html, /How it was written down/);
  assert.match(html, /<i>Pennsylvania Dutch Cooking<\/i>, Anonymous \(undated\)\. Project Gutenberg #26558/);
  assert.doesNotMatch(html, /How they wrote it, in null|, null\./);
});

test('the book prints the quotation with its full credit, and says so on the About page', () => {
  const story = buildStories(findMoves(people, 1))[0];
  const recipes = pickRecipes(story, new Set());
  recipes[0].period = { book: { ...book, note: 'first published 1832' }, title: 'BAKED INDIAN PUDDING', text: 'Indian pudding is good baked.' };
  const chapters = [{ story, recipes, text: { ...templateChapter(story, recipes), source: 'template' } }];
  const html = renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters, people });
  assert.match(html, /How they wrote it, in 1832/);
  assert.match(html, /Indian pudding is good baked\./);
  assert.match(html, /"BAKED INDIAN PUDDING," <i>The American Frugal Housewife<\/i>, Lydia Maria Child \(first published 1832\), 1832\. Project Gutenberg #1; in the public domain/);
  assert.match(html, /quoted word for word from cookbooks of the period/);
  recipes.forEach((r) => delete r.period);
  assert.doesNotMatch(renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters, people }), /How they wrote it|word for word/);
});

// ---- Internet Archive sources and the public-domain rule ----
import PERIOD_BOOKS from '../data/period-books.js';
import { cleanOcr, isPublicDomain, PUBLIC_DOMAIN_BEFORE } from '../src/period.js';

test('every registered book is public domain in the US: published before 1926, or undated and cleared by Gutenberg', () => {
  assert.equal(PUBLIC_DOMAIN_BEFORE, 1926);
  for (const b of PERIOD_BOOKS) {
    assert.ok(isPublicDomain(b), `${b.title} (${b.year})`);
    if (b.year == null) assert.ok((b.source ?? 'gutenberg') === 'gutenberg', `${b.title}: an undated book must come from Gutenberg`);
  }
});

test('a book from 1926 or later is never offered, even if someone registers it', () => {
  const story = { from: { key: 'usa-general' }, to: { key: 'usa-south' }, lo: 1920, hi: 1950, mid: 1935 };
  const books = [{ id: 1, year: 1925, regions: ['usa-south'] }, { id: 2, year: 1926, regions: ['usa-south'] }, { id: 3, year: 1950, regions: ['usa-south'] }];
  assert.deepEqual(booksFor(story, books).map((b) => b.id), [1]);
  assert.equal(isPublicDomain({ year: 1925 }), true);
  assert.equal(isPublicDomain({ year: 1926 }), false);
});

test('OCR clean-up fixes spacing and split words only', () => {
  const ocr = '   Fish  Chowder\n\nAdd  half  tea- \nspoon  salt ; stir  and  serve  .\nhalf  a  straw-\nberry';
  const out = cleanOcr(ocr);
  assert.ok(out.startsWith('   Fish Chowder'));                 // a centred heading keeps its indent
  assert.match(out, /half teaspoon salt; stir and serve\./);
  assert.match(out, /half a strawberry/);
});

test('an Internet Archive book is fetched from archive.org, cleaned, and credited to the Archive', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rr-ia-'));
  const urls = [];
  const fetchImpl = async (u) => { urls.push(String(u)); return { ok: true, text: async () => 'Header\n\n1432. Fried  Apples.\n\nPeel  and  core three apples ; fry until golden and serve hot.\n' }; };
  const ia = { id: 'b28142214', source: 'archive', title: 'The International Cook Book', author: 'Alexander Filippini', year: 1907, regions: ['usa-general'] };
  const text = await fetchBook(ia, { cacheDir: dir, fetchImpl });
  assert.equal(urls[0], 'https://archive.org/download/b28142214/b28142214_djvu.txt');
  assert.match(text, /Peel and core three apples; fry until golden/);
  assert.equal((await readFile(path.join(dir, 'archive', 'b28142214.txt'), 'utf8')).includes('Peel  and  core'), true); // the raw download is cached unchanged
  const story = buildStories(findMoves(people, 1))[0];
  const recipes = pickRecipes(story, new Set());
  recipes[0].period = { book: ia, title: 'Fried Apples', text: 'Peel and core three apples.' };
  const chapters = [{ story, recipes, text: { ...templateChapter(story, recipes), source: 'template' } }];
  const html = renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters, people });
  assert.match(html, /Internet Archive, b28142214 \(machine-read scan; small errors are possible\); in the public domain in the United States/);
  assert.doesNotMatch(html, /Project Gutenberg #b28142214/);
});

test('page numbers and running heads are removed even when the OCR misreads the head, so a receipt is not cut at a page break', () => {
  const page = ['Place in a bowl two ounces flour, one teaspoon', '', '94', '', 'THE INTERNA TIONAL COOK BOOK', '', 'sugar and half a teaspoon baking powder.'].join('\n');
  const out = cleanOcr(page, { title: 'The International Cook Book' });
  assert.ok(!/INTERNA/.test(out) && !/^94$/m.test(out));
  assert.match(out, /one teaspoon\s+sugar and half a teaspoon/);
  // an ingredient line that merely resembles nothing in the title is untouched
  assert.match(cleanOcr('Add 94 eggs\n94\nCook book', { title: 'The International Cook Book' }), /Add 94 eggs/);
});

test('a sentence cut by a page break is rejoined into one paragraph; real paragraph breaks are kept', () => {
  const text = [
    '', '                         Buckwheat Cakes', '',
    'Place in a bowl two ounces buckwheat flour, one saltspoon salt, one teaspoon', '',
    'sugar, half teaspoon baking powder and a tablespoon molasses. Mix well.', '',
    'Lightly grease a large frying pan and cook the cakes until golden.', '',
  ].join('\n');
  const [r] = parseReceipts(text);
  assert.equal(r.body.split(/\n\s*\n/).length, 2);                       // the cut sentence is one paragraph; the next is separate
  assert.match(excerpt(r.body), /one teaspoon sugar, half teaspoon baking powder/);
});
