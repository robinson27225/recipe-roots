import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGate, checkMember, isOwnContribution } from '../src/gate.js';
import { buildLedger } from '../src/ledger.js';
import { parsePhotoName } from '../src/myphotos.js';
import { toFamilyRecipe } from '../src/cookbook.js';
import { parseFamilyRecipes } from '../src/family.js';

const profile = (p) => async () => ({ ok: true, json: async () => [{ status: 0, profile: p }] });
const member = profile({ Name: 'Robinson-27225', IsMember: 1 });

test('the gate opens only when ALL of: a real member, an Honor Code attestation, and a permission confirmation', async () => {
  const open = await evaluateGate({ me: 'Robinson-27225', honorCodeSigned: true, confirmPermission: true, fetchImpl: member });
  assert.equal(open.allowed, true);
  assert.equal(open.me, 'Robinson-27225');
  assert.deepEqual(open.reasons, []);
});

test('it fails closed, and names everything that is missing', async () => {
  const none = await evaluateGate({ fetchImpl: member });
  assert.equal(none.allowed, false);
  assert.equal(none.reasons.length, 3);
  assert.match(none.reasons[0], /--me/);
  assert.match(none.reasons[1], /Wiki Genealogist/);
  assert.match(none.reasons[1], /can't check this itself/); // honest about the attestation
  assert.match(none.reasons[2], /--confirm-permission/);
  const noAttest = await evaluateGate({ me: 'Robinson-27225', confirmPermission: true, fetchImpl: member });
  assert.equal(noAttest.allowed, false);
  const noPermission = await evaluateGate({ me: 'Robinson-27225', honorCodeSigned: true, fetchImpl: member });
  assert.equal(noPermission.allowed, false);
});

test('a guest, an ancestor profile, an unknown profile, a malformed ID, or an API failure never passes', async () => {
  const flags = { honorCodeSigned: true, confirmPermission: true };
  assert.equal((await evaluateGate({ me: 'Eisenhower-1', ...flags, fetchImpl: profile({ Name: 'Eisenhower-1', IsMember: 0 }) })).allowed, false); // not a member account
  assert.equal((await evaluateGate({ me: 'Nobody-1', ...flags, fetchImpl: profile({}) })).allowed, false);
  assert.equal((await evaluateGate({ me: 'not an id', ...flags, fetchImpl: member })).allowed, false);
  assert.equal((await evaluateGate({ me: 'Robinson-27225', ...flags, fetchImpl: async () => { throw new Error('offline'); } })).allowed, false);
  assert.equal((await evaluateGate({ me: 'Robinson-27225', ...flags, fetchImpl: async () => ({ ok: false, status: 500 }) })).allowed, false);
  assert.match((await checkMember('Eisenhower-1', { fetchImpl: profile({ Name: 'Eisenhower-1', IsMember: 0 }) })).reason, /isn't a WikiTree member/);
});

test("a recipe the user wrote themselves is theirs; anyone else's is third-party", () => {
  assert.equal(isOwnContribution({ wikiTreerId: 'Robinson-27225' }, 'Robinson-27225'), true);
  assert.equal(isOwnContribution({ wikiTreerId: 'Silva-1055' }, 'Robinson-27225'), false);
  assert.equal(isOwnContribution({ wikiTreerId: 'Robinson-27225' }, undefined), false);
  const rec = { title: 'T', ancestorId: 'A-1', ancestorName: 'A', wikiTreerName: 'Mindy Silva', wikiTreerId: 'Silva-1055', volume: 2, page: 20, ingredients: ['x'], directions: [], story: null };
  assert.equal(toFamilyRecipe(rec, { me: 'Robinson-27225' }).thirdParty, true);
  assert.equal(toFamilyRecipe({ ...rec, wikiTreerId: 'Robinson-27225' }, { me: 'Robinson-27225' }).thirdParty, false);
  assert.equal(toFamilyRecipe(rec).thirdParty, true); // no identity given: assume third-party
  const loaded = parseFamilyRecipes(JSON.stringify([toFamilyRecipe(rec)]))[0]; // survives the round trip through family-recipes.json
  assert.equal(loaded.thirdParty, true);
  assert.equal(loaded.rightsHolder.id, 'Silva-1055');
});

test('the permissions ledger lists every third-party item and who owns it, and is absent when there are none', () => {
  assert.equal(buildLedger({ me: 'Robinson-27225', photos: [], recipes: [] }), null);
  const md = buildLedger({
    me: 'Robinson-27225', honorCodeAttested: true, date: new Date('2026-10-12T12:00:00Z'),
    photos: [{ person: 'Firman Joseph Robinson', name: 'Robinson-27274', pageUrl: '/photo/jpg/Robinson-27274' }],
    recipes: [{ title: 'Baked Beans', rightsHolder: { name: 'Mindy Silva', id: 'Silva-1055' }, source: 'WikiTree 15th Anniversary Cookbook, vol. 2, p. 20' }],
  });
  assert.match(md, /Built 2026-10-12 by WikiTree member Robinson-27225/);
  assert.match(md, /attested by the user; not verifiable/);
  assert.match(md, /\*\*Baked Beans\*\*: written by Mindy Silva \(https:\/\/www\.wikitree\.com\/wiki\/Silva-1055\)/);
  assert.match(md, /https:\/\/www\.wikitree\.com\/photo\/jpg\/Robinson-27274/);
  assert.match(md, /not the permission itself/);
});

test('personal photos are matched to people by WikiTree ID in the file name', () => {
  assert.deepEqual(parsePhotoName('Smith-1234.jpg'), { id: 'Smith-1234', note: '' });
  assert.deepEqual(parsePhotoName('/x/Smith-1234__at-the-farm-1948.png'), { id: 'Smith-1234', note: 'at the farm 1948' });
  assert.deepEqual(parsePhotoName('Sachsen-Coburg_und_Gotha-4--wedding.jpg'), { id: 'Sachsen-Coburg_und_Gotha-4', note: 'wedding' });
  assert.equal(parsePhotoName('IMG_2041.jpg'), null);
  assert.equal(parsePhotoName('grandma.jpg'), null);
});
