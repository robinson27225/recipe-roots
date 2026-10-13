import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dishNameFrom, storyFromCook } from '../src/familyperiod.js';
import { titleMatch, booksFor } from '../src/period.js';

test("a family title becomes the dish's name: possessives and family words go, dish words stay", () => {
  const cases = {
    "Nora's Oatmeal Cookies": 'Oatmeal Cookies', "Grandma's Apple Pie": 'Apple Pie', 'Mom’s Christmas Cookies': 'Christmas Cookies',
    'Old-Fashioned Potato Salad': 'Potato Salad', "Aunt Edie's Famous Fried Apples": 'Fried Apples', 'Beef Roll': 'Beef Roll', 'Baked Beans': 'Baked Beans',
    "Kay's Fudge": 'Fudge', 'Potato Salad & Dressing': 'Potato Salad & Dressing',
  };
  for (const [from, want] of Object.entries(cases)) assert.equal(dishNameFrom(from), want, from);
  assert.equal(dishNameFrom("Grandma's"), '');
});

test('a cook stands in for a chapter: an adult-life window and a birth-to-death route', () => {
  const s = storyFromCook({ BirthDate: '1893-06-06', DeathDate: '1962-01-01', BirthLocation: 'Skibbereen, County Cork, Ireland', DeathLocation: 'Boston, Suffolk, Massachusetts, United States' });
  assert.deepEqual([s.from.key, s.to.key], ['ireland', 'usa-new-england']);
  assert.equal(s.lo, 1908);                                   // 15 when adult life begins
  assert.ok(s.hi <= s.lo + 65 && s.hi >= s.lo);
  assert.equal(storyFromCook({ BirthDate: '1893-06-06', BirthLocation: 'Atlantis' }), null);   // no region we know
  assert.equal(storyFromCook({ BirthLocation: 'Cork, Ireland' }), null);                         // no years
  const one = storyFromCook({ BirthDate: '1900-01-01', BirthLocation: 'Bavaria, Germany' });      // death place unknown: same region both ends
  assert.deepEqual([one.from.key, one.to.key], ['germany', 'germany']);
});

test('the cleaned name matches the cookbooks by the same strict rules as a chapter dish', () => {
  const dish = (title) => ({ id: 'f', name: dishNameFrom(title) });
  assert.ok(titleMatch(dish("Nora's Oatmeal Cookies"), 'OATMEAL COOKIES') > 0);
  assert.ok(titleMatch(dish("Grandma's Apple Pie"), 'Apple Pie I') > 0);
  assert.equal(titleMatch(dish("Grandma's Apple Pie"), 'Mock Apple Pie'), 0);
  assert.equal(titleMatch(dish('Potato Salad'), 'Hot Potato Salad with Bacon'), 0);   // extra words that make it another dish
});

test('a cook in Pennsylvania in the 1870s is offered the Pennsylvania books, nearest in time first', () => {
  const s = storyFromCook({ BirthDate: '1850-01-01', DeathDate: '1930-01-01', BirthLocation: 'Lancaster, Pennsylvania, USA', DeathLocation: 'Lancaster, Pennsylvania, USA' });
  const ids = booksFor(s).map((b) => b.id);
  assert.ok(ids.indexOf(9624) < ids.indexOf(65061) && ids.includes(26558)); // Leslie (Philadelphia) and Pennsylvania Dutch Cooking before the 1906 Boston book
});
