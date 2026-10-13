import test from 'node:test';
import assert from 'node:assert/strict';
import PANTRY from '../data/pantry.js';
import { REGIONS } from '../src/regions.js';
import { pickRecipes } from '../src/pantry.js';

test('every dish is complete and well-formed (it will be printed in someone\'s book)', () => {
  const ids = new Set();
  for (const d of PANTRY) {
    assert.ok(!ids.has(d.id), `duplicate id ${d.id}`); ids.add(d.id);
    assert.match(d.id, /^[a-z0-9-]+$/, d.id);
    assert.ok(d.region === 'usa-general' || REGIONS[d.region], `${d.id}: unknown region ${d.region}`);
    assert.ok(Number.isInteger(d.from) && d.from >= 1600 && d.from <= 1960, `${d.id}: implausible year ${d.from}`);
    for (const f of ['name', 'course', 'serves', 'time', 'note']) assert.ok(typeof d[f] === 'string' && d[f].trim(), `${d.id}: missing ${f}`);
    assert.ok(d.ingredients.length >= 2 && d.ingredients.every((x) => typeof x === 'string' && x.trim()), `${d.id}: ingredients`);
    assert.ok(d.steps.length >= 2 && d.steps.every((x) => typeof x === 'string' && x.trim()), `${d.id}: steps`);
  }
});

test('heritage lines most American trees pass through each have several dishes to choose from', () => {
  const count = (r) => PANTRY.filter((d) => d.region === r).length;
  for (const r of ['usa-mid-atlantic', 'usa-south', 'usa-midwest', 'usa-new-england', 'germany', 'ireland', 'england', 'scotland', 'wales']) assert.ok(count(r) >= 2, `${r} has ${count(r)}`);
  assert.ok(count('usa-mid-atlantic') >= 5 && count('usa-south') >= 5);
});

test('a chapter never repeats a dish another chapter already used', () => {
  const mk = (id, from, to, mid) => ({ id, from: { key: from }, to: { key: to }, lo: mid - 10, hi: mid + 10, mid });
  const used = new Set();
  const a = pickRecipes(mk('s1', 'usa-mid-atlantic', 'usa-midwest', 1850), used);
  const b = pickRecipes(mk('s2', 'usa-mid-atlantic', 'usa-midwest', 1860), used);
  const ids = [...a, ...b].map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
});
