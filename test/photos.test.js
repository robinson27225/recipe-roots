import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { photoUrl, fetchPhoto, fetchPhotos, photoDate, photoCaption } from '../src/photos.js';
import { renderBook } from '../src/book.js';
import { pickRecipes } from '../src/pantry.js';
import { findMoves, buildStories } from '../src/migrations.js';
import { templateChapter } from '../src/writer.js';
import { people } from './fixtures.js';

const withPhoto = (o) => ({ Id: 7, Name: 'Murphy-10', IsLiving: 0, PhotoData: { path: '/photo.php/f/fb/Murphy-10.jpg' }, ...o });
const imageResponse = (bytes = Buffer.from('fakejpeg'), type = 'image/jpeg', ok = true) => async () => ({ ok, headers: { get: () => type }, arrayBuffer: async () => bytes });
const tmp = () => mkdtemp(path.join(os.tmpdir(), 'rr-photos-'));

test('photoUrl only accepts WikiTree photo paths', () => {
  assert.equal(photoUrl(withPhoto()), 'https://www.wikitree.com/photo.php/f/fb/Murphy-10.jpg');
  assert.equal(photoUrl({ PhotoData: null }), null);
  assert.equal(photoUrl({ PhotoData: { path: 'https://evil.example/x.jpg' } }), null);
});
// A router standing in for WikiTree: getPhotos returns JSON, photo URLs return images.
const wikitree = ({ photos = [], thumbOk = true, calls = [] } = {}) => async (url) => {
  const u = String(url);
  calls.push(u);
  if (u.includes('api.wikitree.com')) return { ok: true, json: async () => [{ photos }] };
  if (u.includes('300px') && !thumbOk) return { ok: false, headers: { get: () => 'text/html' }, arrayBuffer: async () => Buffer.from('') };
  return imageResponse(Buffer.from(u.includes('300px') ? 'thumb' : 'original'))();
};
const info = { ImageName: 'Murphy-10.jpg', Title: 'Murphy on his horse', Location: 'Fort Kinney, Clark, Texas, USA', Date: '1920-00-00', URL_300: '/photo.php/thumb/f/fb/Murphy-10.jpg/300px-Murphy-10.jpg' };

test('fetches, credits the profile, captions it from the photo details, and caches on disk', async () => {
  const dir = await tmp(); const calls = [];
  const f = wikitree({ photos: [{ ImageName: 'Other.jpg', Title: 'nope' }, info], calls });
  const person = withPhoto({ Photo: 'Murphy-10.jpg', FirstName: 'Pat', LastNameAtBirth: 'Murphy' });
  const first = await fetchPhoto(person, { cacheDir: dir, fetchImpl: f });
  assert.match(first.uri, /^data:image\/jpeg;base64,/);
  assert.equal(first.name, 'Murphy-10');
  assert.equal(first.caption, 'Murphy on his horse · Fort Kinney, Clark, Texas, USA · 1920');
  assert.equal(Buffer.from(first.uri.split(',')[1], 'base64').toString(), 'thumb'); // the 300px thumbnail, not the original
  const n = calls.length;
  await fetchPhoto(person, { cacheDir: dir, fetchImpl: f });
  assert.equal(calls.length, n, 'second run is entirely from cache');
});
test('falls back to the original when the thumbnail is unavailable, and to no caption when details fail', async () => {
  const a = await fetchPhoto(withPhoto({ Photo: 'Murphy-10.jpg' }), { cacheDir: await tmp(), fetchImpl: wikitree({ photos: [info], thumbOk: false }) });
  assert.equal(Buffer.from(a.uri.split(',')[1], 'base64').toString(), 'original');
  const b = await fetchPhoto(withPhoto(), { cacheDir: await tmp(), fetchImpl: imageResponse() }); // getPhotos "returns" an image: unparseable
  assert.equal(b.caption, '');
  assert.match(b.uri, /^data:image/);
});
test('photoDate and photoCaption', () => {
  assert.equal(photoDate('1920-00-00'), '1920');
  assert.equal(photoDate('1920-05-00'), 'May 1920');
  assert.equal(photoDate('1920-05-03'), '3 May 1920');
  assert.equal(photoDate('0000-00-00'), null);
  assert.equal(photoCaption({ title: 'Firman Joseph Robinson', location: '', date: '0000-00-00' }, 'Firman Joseph Robinson'), ''); // title just repeats the name
  assert.equal(photoCaption({ title: 'David Eisenhower Image 1', location: '', date: '' }, 'David Jacob Eisenhower'), ''); // upload default
  assert.equal(photoCaption({ title: 'Photo of Mary', location: '', date: '1950-00-00' }, 'Mary Smith'), '1950');
  assert.equal(photoCaption({ title: 'Firman on his horse', location: 'Fort Kinney', date: '1920-00-00' }, 'Firman Joseph Robinson'), 'Firman on his horse · Fort Kinney · 1920');
  assert.equal(photoCaption(null, 'x'), '');
});
test('living people are never fetched', async () => {
  const f = () => { throw new Error('must not fetch'); };
  assert.equal(await fetchPhoto(withPhoto({ IsLiving: 1 }), { cacheDir: await tmp(), fetchImpl: f }), null);
});
test('challenge pages, errors and oversized files give null, never an exception', async () => {
  const dir = await tmp();
  assert.equal(await fetchPhoto(withPhoto(), { cacheDir: dir, fetchImpl: imageResponse(Buffer.from('<html>'), 'text/html') }), null);
  assert.equal(await fetchPhoto(withPhoto(), { cacheDir: dir, fetchImpl: imageResponse(Buffer.from('x'), 'image/jpeg', false) }), null);
  assert.equal(await fetchPhoto(withPhoto(), { cacheDir: dir, fetchImpl: imageResponse(Buffer.alloc(4 * 1024 * 1024)) }), null);
  assert.equal(await fetchPhoto(withPhoto(), { cacheDir: dir, fetchImpl: async () => { throw new Error('network'); } }), null);
});
test('fetchPhotos maps person ids and skips people without photos', async () => {
  const m = await fetchPhotos([withPhoto({ Id: 1 }), { Id: 2, Name: 'No-Photo-1', PhotoData: null }, null], { cacheDir: await tmp(), fetchImpl: imageResponse() });
  assert.deepEqual([...m.keys()], [1]);
});

test('the book shows the portrait with its credit, in the chapter list and beside a family recipe', () => {
  const story = buildStories(findMoves(people, 1))[0];
  const recipes = pickRecipes(story, new Set());
  const chapters = [{ story, recipes, text: { ...templateChapter(story, recipes), source: 'template' } }];
  const photos = new Map([[4, { uri: 'data:image/jpeg;base64,AAAA', name: 'Murphy-11', caption: 'At the farm · 1948' }]]); // Patrick, id 4 in the fixture
  const family = [{ title: 'Soup', ancestor: 'Murphy-11', person: people.get(4), ancestorName: 'Patrick Murphy', relation: 'grandfather', direct: true, ingredients: ['1 potato'], directions: ['Boil.'], story: null, contributor: 'Jo', people, photoNote: 'Photo comment: family collection' }];
  const html = renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters, people, familyRecipes: family, photos });
  assert.match(html, /class="avatar" src="data:image\/jpeg;base64,AAAA"/);
  assert.match(html, /<figcaption>At the farm · 1948<br>Photo comment: family collection<br>Photo: WikiTree profile <span class="wtid"><a class="wt" href="https:\/\/www\.wikitree\.com\/wiki\/Murphy-11">Murphy-11<\/a><\/span><\/figcaption>/);
  assert.match(html, /<a class="wt" href="https:\/\/www\.wikitree\.com\/wiki\/Murphy-11">/);   // names link to their profiles
  assert.match(html, /photos belong to the people who uploaded them/);
  const none = renderBook({ title: 'T', subtitle: 'S', rootId: 'Sample-1', chapters, people, familyRecipes: family });
  assert.doesNotMatch(none, /class="avatar"|class="portrait"|uploaded them/);
});
