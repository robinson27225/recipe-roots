import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenHistory } from '../src/history.js';

const E = (from, to, text, regions) => ({ from, to, text, ...(regions ? { regions } : {}) });
const entries = [
  E(1870, 1910, 'early'), E(1896, 1930, 'mid'), E(1920, 1945, 'later', ['usa']), E(1950, 1975, 'late'),
  E(1700, 1800, 'too old'), E(1980, 2000, 'too new'),
];

test('only notes that overlap the window are used, and a note for the right place beats a general one', () => {
  const texts = kitchenHistory({ lo: 1905, hi: 1960, regionKeys: ['usa-new-england'] }, 4, entries).map((e) => e.text);
  assert.ok(!texts.includes('too old') && !texts.includes('too new'));
  assert.ok(texts.includes('later'));                                    // the US-specific one is in
  assert.equal(kitchenHistory({ lo: 1905, hi: 1960, regionKeys: ['usa-new-england'] }, 1, entries)[0].text, 'later'); // and it ranks first
  assert.equal(kitchenHistory({ lo: 1905, hi: 1960, regionKeys: ['germany'] }, 5, entries).some((e) => e.text === 'later'), false); // not for another country
});

test('a long life is described by the middle of it, not just its first years; the result is in date order', () => {
  const got = kitchenHistory({ lo: 1905, hi: 1980, regionKeys: ['france'] }, 2, entries).map((e) => e.text);
  assert.deepEqual(got, ['mid', 'late']);                                // nearest the middle (1942), not 'early' (1870-1910)
  const order = kitchenHistory({ lo: 1860, hi: 1990, regionKeys: ['france'] }, 4, entries).map((e) => e.from);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});
