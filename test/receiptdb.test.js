import test from 'node:test';
import assert from 'node:assert/strict';
import { queryWords, acceptHit, variantSpelling, searchReceipts, receiptDoc, RRF_K } from '../src/receiptdb.js';

test('query words: title words count double, quantities and units are dropped, no repeats', () => {
  const w = queryWords("Sunday Roast", ['2 lbs beef roast', '1 onion, sliced', '3 tablespoons flour']);
  assert.deepEqual(w.slice(0, 2), ['sunday', 'roast']);                 // the title first
  assert.ok(w.includes('beef') && w.includes('onion') && w.includes('flour'));
  assert.ok(!w.includes('lbs') && !w.includes('tablespoons') && !w.some((x) => /\d/.test(x)));
  assert.equal(new Set(w).size, w.length);
});

test('another spelling of the same name counts as the same dish; a different dish does not', () => {
  assert.ok(variantSpelling('Shoofly Pie', 'SHOO-FLY PIE'));
  assert.ok(variantSpelling('Spätzle', 'SPAETZLEN OR SPATZEN'));
  assert.ok(variantSpelling('Scottish Oatcakes', 'Scottish Oat-cakes'));
  assert.ok(!variantSpelling('Apple Pie', 'Mock Apple Pie'));           // an extra word makes it another dish
  assert.ok(!variantSpelling('Potato Salad', 'Hot Potato Salad'));
  assert.ok(!variantSpelling('Pie', 'Pic'));                            // short names must match exactly
  assert.ok(!variantSpelling('Colcannon', 'Cabbage Soup'));
});

test('search hits are accepted as the same dish (another spelling), a similar dish (both rankings agree), or not at all', () => {
  const hit = (title, bm, vec) => ({ title, bm_rank: bm, vec_rank: vec });
  // same dish under another spelling, found by the vector search alone
  assert.deepEqual(acceptHit([hit('SHOO-FLY PIE', null, 1)], { name: 'Shoofly Pie' }).kind, 'same');
  assert.equal(acceptHit([hit('SHOO-FLY PIE', null, 9)], { name: 'Shoofly Pie' }), null);          // not near the top of the vector ranking
  // similar: both rankings near the top and a title word in common
  const sim = acceptHit([hit('Roast Beef', 2, 3)], { name: 'Sunday Roast' });
  assert.deepEqual([sim.kind, sim.hit.title], ['similar', 'Roast Beef']);
  assert.equal(acceptHit([hit('Roast Beef', 2, null)], { name: 'Sunday Roast' }), null);            // only one ranking agrees
  assert.equal(acceptHit([hit('Roast Beef', 2, 9)], { name: 'Sunday Roast' }), null);               // not near the top of both
  assert.equal(acceptHit([hit('Lemon Pudding', 1, 1)], { name: 'Sunday Roast' }), null);            // no word in common
  assert.equal(acceptHit([hit('Turkey Stuffing (Swedish Style)', 3, 1)], { name: 'Köttbullar (Swedish Meatballs)' }), null); // a shared place word is not the dish
  assert.equal(acceptHit([hit('BAKED CHICKEN AND NOODLES', 3, 2)], { name: 'Chicken and Noodles' }).kind, 'similar');
  assert.equal(acceptHit([hit('DINNER', 1, 1)], { name: 'Roast Beef Dinner' }), null);                                                  // a mealtime word is not the dish
  assert.equal(acceptHit([hit('Scottish Fancies', 1, 3)], { name: 'Scottish Oatcakes' }), null);                                       // one shared word of two
  assert.equal(acceptHit([hit('CREAM OF CHICKEN AND NOODLES', 1, 1)], { name: 'Noodles with Chicken' }).kind, 'similar');            // two shared words, noun included          // the dish's own noun is shared
  assert.equal(acceptHit([hit('Lemon Pudding', 1, 1), hit('Roast Beef', 3, 4)], { name: 'Sunday Roast' }).hit.title, 'Roast Beef');
});

test('hybrid search runs BM25 on Tiger Cloud and falls back to full-text elsewhere, with the same shape of result', async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [{ id: 'a', book_id: 1, title: 'T', body: 'b', bm_rank: '1', vec_rank: null, rrf: '0.016' }] }; } };
  const args = { words: ['roast', 'beef'], vector: [0.1, 0.2], bookIds: [1, 2] };
  const bm = await searchReceipts(db, { ...args, bm25: true });
  assert.match(calls[0].sql, /<@>/);
  assert.equal(calls[0].params[0], 'roast beef');                       // BM25 takes plain text
  const ft = await searchReceipts(db, { ...args, bm25: false });
  assert.match(calls[1].sql, /to_tsquery/);
  assert.equal(calls[1].params[0], 'roast | beef');                     // full-text takes OR-ed terms
  assert.deepEqual(calls[1].params.slice(1, 3), [['1', '2'], '[0.1,0.2]']);   // book ids go as text
  assert.deepEqual(bm, ft);
  assert.deepEqual([bm[0].bm_rank, bm[0].vec_rank, bm[0].rrf], [1, null, 0.016]);   // numbers, with null for "not in that list"
  assert.deepEqual(await searchReceipts(db, { ...args, words: [] }), []);            // nothing to search for
  assert.equal(calls.length, 2);
});

test('what is searched for a receipt is its title and the start of its body', () => {
  const d = receiptDoc({ title: 'Apple Pie', body: `Line one.\n\n${'x'.repeat(2000)}` });
  assert.ok(d.startsWith('Apple Pie. Line one. xxxx'));
  assert.ok(d.length <= 'Apple Pie. '.length + 700);
});

import { periodBlock } from '../src/book.js';

test('a similar-dish receipt is labelled as not the same dish; an exact one is not', () => {
  const book = { title: 'The Myrtle Reed Cook Book', author: 'Myrtle Reed', year: 1916, id: 37680 };
  const similar = periodBlock({ book, title: 'CREAM OF CHICKEN AND NOODLES', text: 'Boil a fowl...', similar: true });
  assert.match(similar, /A similar dish, as they wrote it in 1916/);
  assert.match(similar, /Not the same dish/);
  const exact = periodBlock({ book, title: 'PUMPKIN PIE', text: 'Stew the pumpkin...' });
  assert.match(exact, /How they wrote it, in 1916/);
  assert.doesNotMatch(exact, /Not the same dish|similar dish/i);
});
