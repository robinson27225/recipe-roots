import test from 'node:test';
import assert from 'node:assert/strict';
import { findMoves, buildStories, relationLabel } from '../src/migrations.js';
import { people } from './fixtures.js';

test('finds both Irish emigrants by different evidence', () => {
  const moves = findMoves(people, 1);
  const by = Object.fromEntries(moves.map((m) => [m.person.name, m]));
  assert.equal(Object.keys(by).length, 2);
  assert.equal(by['Patrick Murphy'].basis, 'death');
  assert.equal(by['Nora Walsh'].basis, 'child');
  assert.equal(by['Nora Walsh'].hi, 1893); // arrived by the time Mary was born
  assert.ok(moves.every((m) => m.from.key === 'ireland' && m.to.key === 'usa-new-england'));
});
test('same-region lives and the living subject produce no moves', () => {
  const names = findMoves(people, 1).map((m) => m.person.name);
  assert.ok(!names.includes('Frank Sample') && !names.includes('Mary Murphy') && !names.includes('Sam Sample'));
});
test('moves along one corridor cluster into a single story', () => {
  const stories = buildStories(findMoves(people, 1));
  assert.equal(stories.length, 1);
  assert.equal(stories[0].people.length, 2);
  assert.equal(stories[0].originPlace, 'Skibbereen, County Cork');
});
test('living ancestors are excluded', () => {
  const copy = new Map(people);
  copy.set(4, { ...people.get(4), IsLiving: 1 });
  assert.equal(findMoves(copy, 1).filter((m) => m.person.name === 'Patrick Murphy').length, 0);
});
test('relation labels', () => {
  assert.equal(relationLabel(1, 'Female'), 'mother');
  assert.equal(relationLabel(2, 'Male'), 'grandfather');
  assert.equal(relationLabel(3, 'Female'), 'great-grandmother');
  assert.equal(relationLabel(5, undefined), '3x great-grandparent');
});
