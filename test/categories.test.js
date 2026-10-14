import test from 'node:test';
import assert from 'node:assert/strict';
import { categorize, groupByCategory, CATEGORIES } from '../src/categories.js';

const cat = (title, ingredients = []) => categorize({ title, ingredients });

test('titles are filed the way a cook would file them', () => {
  const expect = {
    'Oatmeal Cookies': 'Cookies & Candy', 'Divinity Candy': 'Cookies & Candy', "Kay's Fudge": 'Cookies & Candy', 'Brown Candy': 'Cookies & Candy',
    'Potato Soup': 'Soups & Stews', 'Lamb Stew': 'Soups & Stews', 'Corn Chowder': 'Soups & Stews',
    'Beef Roll': 'Main Dishes', 'Chicken & Dumplings': 'Main Dishes', 'Meatloaf': 'Main Dishes', 'Cavatelli': 'Main Dishes', 'Tourtière': 'Main Dishes',
    'Potato Salad': 'Sides, Salads & Dips', 'Baked Beans': 'Sides, Salads & Dips', 'Cabbage Salad': 'Sides, Salads & Dips', 'Red Lantern Cheese Dip': 'Sides, Salads & Dips', 'Lemon Jell-O Frosted Salad': 'Sides, Salads & Dips',
    'Carrot Cake': 'Cakes, Pies & Desserts', 'Peach Cobbler': 'Cakes, Pies & Desserts', 'Pumpkin Chiffon Pie': 'Cakes, Pies & Desserts', 'Christmas Pudding': 'Cakes, Pies & Desserts', 'Bread Pudding': 'Cakes, Pies & Desserts',
    'French Bread': 'Breads & Breakfast', 'Buttermilk Biscuits': 'Breads & Breakfast', 'Coffee Cake': 'Breads & Breakfast', 'Blueberry Pancakes': 'Breads & Breakfast', 'Lefse': 'Breads & Breakfast',
    'Chicken Pot Pie': 'Main Dishes', 'Chicken & Wild Rice': 'Main Dishes', 'Chicken and Noodles': 'Main Dishes', 'Tuna Loaf': 'Main Dishes', 'Pork Pie': 'Main Dishes',
    'Chicken Salad': 'Sides, Salads & Dips', 'Corn Pudding': 'Sides, Salads & Dips', 'Apple Pie': 'Cakes, Pies & Desserts', 'Apple Dumplings': 'Cakes, Pies & Desserts',
    'Apple Butter': 'Preserves, Sauces & Drinks', 'Raw Cranberry Relish': 'Preserves, Sauces & Drinks', 'Dill Pickles': 'Preserves, Sauces & Drinks', 'Hot Spiced Tea': 'Preserves, Sauces & Drinks',
  };
  for (const [title, want] of Object.entries(expect)) assert.equal(cat(title), want, title);
});

test('a title with no clue falls back on the ingredients, then on Other', () => {
  assert.equal(cat("Grandma's Special", ['1 lb ground beef', '1 onion']), 'Main Dishes');
  assert.equal(cat("Grandma's Special", ['3 c. flour', '1 tbsp yeast', 'salt']), 'Breads & Breakfast');
  assert.equal(cat("Grandma's Special", ['2 c. flour', '1 c. sugar', '2 eggs']), 'Cakes, Pies & Desserts');
  assert.equal(cat("Grandma's Special", ['a little of this']), 'Other');
  assert.equal(cat('Mystery', []), 'Other');
});

test("a recipe's own category always wins, and an unknown one is ignored", () => {
  assert.equal(categorize({ title: 'Potato Salad', category: 'Main Dishes' }), 'Main Dishes');
  assert.equal(categorize({ title: 'Potato Salad', category: 'Casseroles of Doom' }), 'Sides, Salads & Dips');
});

test('grouping follows the book order, drops empty categories and sorts by title', () => {
  const groups = groupByCategory([{ title: 'Zucchini Bread' }, { title: 'Apple Pie' }, { title: 'Banana Bread' }, { title: 'Lamb Stew' }]);
  assert.deepEqual(groups.map((g) => g.category), ['Soups & Stews', 'Cakes, Pies & Desserts', 'Breads & Breakfast'].sort((a, b) => CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b)));
  assert.deepEqual(groups.find((g) => g.category === 'Breads & Breakfast').recipes.map((r) => r.title), ['Banana Bread', 'Zucchini Bread']);
});

import { parseFamilyRecipes, parseFamilyPeople } from '../src/family.js';

test('a recipe file can name its own category; an unknown one is ignored and the suggestion is used', () => {
  const [a, b] = parseFamilyRecipes(JSON.stringify([
    { title: 'Beef Roll', ancestor: 'Smith-1', category: 'Soups & Stews', ingredients: ['beef'] },
    { title: 'Pound Cake', ancestor: 'Smith-1', category: 'Nonsense', ingredients: ['flour'] },
  ]));
  assert.equal(a.category, 'Soups & Stews');
  assert.equal(b.category, null);
  assert.equal(categorize(a), 'Soups & Stews');
  assert.equal(categorize(b), 'Cakes, Pies & Desserts');
});

test('family people notes: story and photo note by ID, comments ignored, empty entries dropped', () => {
  const got = parseFamilyPeople(JSON.stringify({ _comment: 'x', 'Smith-1': { story: ' She baked on Sundays. ' }, 'Smith-2': {}, 'Smith-3': { photoNote: 'At the farm' } }));
  assert.deepEqual(got, { 'Smith-1': { story: 'She baked on Sundays.', photoNote: null }, 'Smith-3': { story: null, photoNote: 'At the farm' } });
});

import { yieldLine } from '../src/book.js';

test('a recipe can say what it makes; the book prints the card\'s own words, labelled only when needed', () => {
  const [r] = parseFamilyRecipes(JSON.stringify([{ title: 'Pudding', ancestor: 'Smith-1', yield: ' Make 7 Ramekins ', ingredients: ['x'] }]));
  assert.equal(r.yield, 'Make 7 Ramekins');
  assert.equal(yieldLine('Make 7 Ramekins'), 'Make 7 Ramekins');
  assert.equal(yieldLine('Serves 6'), 'Serves 6');
  assert.match(yieldLine('7 ramekins'), /<span class="lab">Makes<\/span>7 ramekins/);
  assert.equal(yieldLine(null), '');
  assert.equal(yieldLine('<b>'), '<span class="lab">Makes</span>&lt;b&gt;');
});

import { attachRelatives } from '../src/family.js';
import { WikiTreeError } from '../src/wikitree.js';
const denied = async () => { throw new WikiTreeError('permission denied'); };

test('a living relative with permission is kept under the name and relation supplied, labelled as a cook', async () => {
  const [r] = parseFamilyRecipes(JSON.stringify([{ title: 'Coleslaw', ancestor: 'Smith-221', permission: true, ancestorName: 'Jo (Smith) Lee', relation: 'mother', ingredients: ['cabbage'] }]));
  const out = await attachRelatives([r], new Map(), 'Lee-1', { fetchImpl: denied });
  assert.equal(out.recipes.length, 1);
  assert.deepEqual([out.recipes[0].ancestorName, out.recipes[0].relation, out.recipes[0].person], ['Jo (Smith) Lee', 'mother', null]);
  const [none] = parseFamilyRecipes(JSON.stringify([{ title: 'Pie', ancestor: 'Smith-222', ingredients: ['apple'] }]));
  const dropped = await attachRelatives([none], new Map(), 'Lee-1', { fetchImpl: denied, warn: () => {} });
  assert.equal(dropped.recipes.length, 0);                    // without permission a person who can't be confirmed deceased is left out
});

test('"Coleslaw" is a side, not "Other"', () => {
  assert.equal(categorize({ title: 'Coleslaw', ingredients: ['cabbage'] }), 'Sides, Salads & Dips');
});
