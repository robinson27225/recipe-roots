import test from 'node:test';
import assert from 'node:assert/strict';
import { ageAtDeath, lifeSentence, cookProfile, sortCooks } from '../src/cook.js';
import { people } from './fixtures.js';
import { findMoves, buildStories } from '../src/migrations.js';
import { pickRecipes } from '../src/pantry.js';
import { templateChapter } from '../src/writer.js';

test('age is computed only from complete dates', () => {
  assert.equal(ageAtDeath('1903-05-20', '1958-05-19'), 54);   // the day before the birthday
  assert.equal(ageAtDeath('1903-05-20', '1958-05-20'), 55);
  assert.equal(ageAtDeath('1903-00-00', '1958-05-20'), null); // year-only birth: no guessing
  assert.equal(ageAtDeath('1903-05-20', '1958-00-00'), null);
  assert.equal(ageAtDeath(undefined, '1958-05-20'), null);
  assert.equal(ageAtDeath('1960-01-01', '1950-01-01'), null); // nonsense order
});

test('the life sentence says only what is known', () => {
  assert.equal(lifeSentence({ born: 1903, birthPlace: 'Audubon, Iowa', parents: ['George', 'Kathleen'], died: 1958, deathPlace: 'El Monte, California', age: 55 }),
    'Born in 1903 in Audubon, Iowa, to George and Kathleen. Died in 1958 in El Monte, California, aged 55.');
  assert.equal(lifeSentence({ born: 1903, died: 1958 }), 'Born in 1903. Died in 1958.');
  assert.equal(lifeSentence({ birthPlace: 'Cork, Ireland' }), 'Born in Cork, Ireland.');
  assert.equal(lifeSentence({ parents: ['Ann'] }), 'Child of Ann.');
  assert.equal(lifeSentence({ died: 1958, deathPlace: 'Boston' }), 'Died in 1958 in Boston.');
  assert.equal(lifeSentence({}), '');
});

test('a cook profile is built from the tree: parents, places, years, kitchen history, the move, and the family story', () => {
  const stories = buildStories(findMoves(people, 1));
  const chapters = stories.map((story) => { const recipes = pickRecipes(story, new Set()); return { story, recipes, text: { ...templateChapter(story, recipes), source: 'template' } }; });
  const patrick = people.get(4);                                   // Patrick Murphy: born Skibbereen 1860, died Boston 1930
  const p = cookProfile({ person: patrick, people, chapters, relation: 'grandfather', note: { story: 'He kept a pig behind the house.' } });
  assert.equal(p.name, 'Patrick Murphy');
  assert.equal(p.years, '1860–1930');
  assert.equal(p.life, 'Born in 1860 in Skibbereen, County Cork. Died in 1930 in Boston, Suffolk, aged 69.'); // 6 Jun 1860 to 1 Jan 1930: 69, not 70
  assert.equal(p.relation, 'grandfather');
  assert.equal(p.story, 'He kept a pig behind the house.');
  assert.deepEqual(p.chapter && [p.chapter.number, p.chapter.from, p.chapter.to], [1, 'Ireland', 'New England']);
  assert.ok(p.kitchen.length >= 1 && p.kitchen.every((k) => k.from <= 1930 && k.to >= 1872)); // overlaps their adult years
});

test('living parents are never named, and a cook outside every chapter has no move', () => {
  const tree = new Map(people);
  tree.set(3, { ...people.get(3), IsLiving: 1 });                  // Mary, Patrick's child, is a different matter: use Mary as the cook's parent
  const mary = { ...people.get(3), IsLiving: 0, Father: 4, Mother: 5 };
  const withLiving = new Map(tree); withLiving.set(4, { ...people.get(4), IsLiving: 1 });
  const p = cookProfile({ person: mary, people: withLiving, chapters: [] });
  assert.deepEqual(p.parents, ['Nora Walsh']);                      // Patrick is living in this tree: left out
  assert.equal(p.chapter, null);
});

test('cooks are ordered oldest first, with the undated last', () => {
  const names = sortCooks([{ name: 'C', born: 1900 }, { name: 'A', born: null }, { name: 'B', born: 1850 }, { name: 'Z', born: null }]).map((c) => c.name);
  assert.deepEqual(names, ['B', 'C', 'A', 'Z']);
});

import { resolvePerson } from '../src/relatives.js';

test('a living person the family agreed to name gets name, relation and parents, but no dates or places', () => {
  const people = new Map([
    [1, { Id: 1, Name: 'Lee-1', IsLiving: 1, Gender: 'Female', Father: 2, Mother: 3, BirthDate: '1950-02-03', BirthLocation: 'Olympia, Washington, USA', FirstName: 'Jo', LastNameAtBirth: 'Lee' }],
    [2, { Id: 2, Name: 'Lee-2', IsLiving: 0, Gender: 'Male', FirstName: 'Ed', LastNameAtBirth: 'Lee', BirthDate: '1920-01-01', DeathDate: '1990-01-01' }],
    [3, { Id: 3, Name: 'Lee-3', IsLiving: 0, Gender: 'Female', FirstName: 'Ann', LastNameAtBirth: 'Lee', BirthDate: '1922-01-01', DeathDate: '1999-01-01' }],
  ]);
  const p = { ...people.get(1), PermittedLiving: true };
  const prof = cookProfile({ person: p, people, relation: 'mother' });
  assert.equal(prof.born, null);
  assert.equal(prof.birthPlace, null);
  assert.equal(prof.years, '');
  assert.equal(prof.life, 'Child of Ed Lee and Ann Lee.');
  assert.deepEqual(prof.kitchen, []);                       // no dates, so no "in their time" box
  assert.equal(prof.relation, 'mother');
});

test('a name supplied with the recipe is used when the public profile shows only a surname', () => {
  const people = new Map([[1, { Id: 1, Name: 'Lee-1', IsLiving: 1, PermittedLiving: true, LastNameAtBirth: 'Lee' }]]);
  assert.equal(cookProfile({ person: people.get(1), people, name: 'Jo (Lee) Smith' }).name, 'Jo (Lee) Smith');
  assert.equal(cookProfile({ person: people.get(1), people }).name, 'Lee');
});

import { pedigree } from '../src/fan.js';

test('a permitted living person is the centre of their own fan chart, by supplied name only', () => {
  const self = { Id: 1, Name: 'Lee-1', IsLiving: 1, PermittedLiving: true, DisplayNameOverride: 'Jo (Lee) Smith', BirthDate: '1950-02-03', Father: 2 };
  const people = new Map([[1, self], [2, { Id: 2, Name: 'Lee-2', IsLiving: 0, FirstName: 'Ed', LastNameAtBirth: 'Lee', BirthDate: '1920-01-01' }]]);
  const [centre, father] = pedigree(people, 1);
  assert.deepEqual(centre, { name: 'Jo (Lee) Smith', years: '', place: '' });      // no dates or places
  assert.equal(father.name, 'Ed Lee');
  assert.equal(pedigree(new Map([[1, { ...self, PermittedLiving: false }]]), 1)[0], null);   // living and not permitted: not drawn
});
