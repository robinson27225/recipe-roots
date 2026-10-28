import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReview } from '../src/review.js';

test('review sheet puts each scan beside its transcription, flags unreviewed ones, and escapes text', () => {
  const html = renderReview([
    { title: 'Beef <Roll>', ancestor: 'Smith-1', category: 'Main Dishes', image: 'scans/a.jpg', ingredients: ['1 lb beef'], directions: ['Mince.'], transcribedByAI: true, reviewed: false, check: { onlyInTranscript: ['350'], onlyInSecondReading: [] } },
    { title: 'Done', ancestor: 'Smith-2', image: 'scans/b.jpg', ingredients: ['x'], directions: ['y'], transcribedByAI: true, reviewed: true },
    { title: 'Her card', ancestor: 'Smith-3', image: 'scans/c.jpg', pageOnly: true, ingredients: [], directions: [] },
  ]);
  assert.match(html, /1 recipe read by the model still need/);
  assert.match(html, /Beef &lt;Roll&gt;/);
  assert.match(html, /scans\/a\.jpg/);
  assert.match(html, /disagreed on \[350\]/);
  assert.match(renderReview([{ title: 'T', ancestor: 'S-1', ingredients: ['2 c. cocoa', '1 egg'], directions: [], transcribedByAI: true, check: { onlyInTranscript: ['2'], onlyInSecondReading: ['1/2'] } }]), /<li class="chk">2 c\. cocoa/);
  assert.match(html, /<b class="ok">reviewed<\/b>/);
  assert.match(html, /Nothing was transcribed/);
});

test('review sheet says so when nothing is waiting', () => {
  assert.match(renderReview([]), /Nothing is waiting to be checked/);
});

test('review sheet asks for the family story, open when there is none', () => {
  const none = renderReview([{ title: 'A', ancestor: 'S-1', ingredients: ['x'], directions: ['y'] }]);
  assert.match(none, /<details class="prompts" open>/);
  assert.match(none, /No family story yet/);
  assert.match(none, /Thanksgiving/);
  const has = renderReview([{ title: 'A', ancestor: 'S-1', ingredients: ['x'], directions: ['y'], story: 'Made every Easter.' }]);
  assert.match(has, /<details class="prompts">/);
  assert.match(has, /Add more to the story/);
});

import { applyEdits } from '../src/review.js';
import { serveReview } from '../src/reviewserver.js';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('edit mode renders boxes for the text, the story and the reviewed tick', () => {
  const html = renderReview([{ title: 'A', ancestor: 'S-1', ingredients: ['1 c x', '2 y'], directions: ['Mix.'], yield: 'makes 4', transcribedByAI: true, reviewed: false }], { edit: true });
  assert.match(html, /<textarea class="ing"[^>]*>1 c x\n2 y<\/textarea>/);
  assert.match(html, /class="yield" value="makes 4"/);
  assert.match(html, /class="story"/);
  assert.match(html, /rev-box/);
  assert.match(html, /Save changes/);
  assert.doesNotMatch(renderReview([{ title: 'A', ancestor: 'S-1', ingredients: [], directions: [] }]), /<textarea/); // read-only by default
});

test('applyEdits trims lines, sets story, marks reviewed and refuses a stale page', () => {
  const r = [{ title: 'A', ingredients: ['x'], directions: [], transcribedByAI: true, reviewed: false, check: { onlyInTranscript: ['1'] } }, { title: 'B', ingredients: [], directions: [] }];
  assert.equal(applyEdits(r, [{ i: 0, title: 'A', ingredients: ' 1 c flour \n\n2 eggs', directions: 'Mix.\nBake.', yield: '7', story: ' Easter bread. ', reviewed: true }]), 1);
  assert.deepEqual(r[0].ingredients, ['1 c flour', '2 eggs']);
  assert.equal(r[0].story, 'Easter bread.');
  assert.equal(r[0].reviewed, true);
  assert.equal(r[0].check, undefined);
  assert.equal(applyEdits(r, [{ i: 1, title: 'B', story: '' }]), 0);
  assert.throws(() => applyEdits(r, [{ i: 0, title: 'Other', story: 'x' }]), /changed since/);
});

test('review server serves the page under its token, saves edits with a backup, and nothing else', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rr-review-'));
  const file = path.join(dir, 'family-recipes.json');
  await writeFile(file, JSON.stringify([{ title: 'Bread', ancestor: 'S-1', ingredients: ['1 c flour'], directions: ['Bake.'], story: null, transcribedByAI: true, reviewed: false }]));
  await writeFile(path.join(dir, 'secret.txt'), 'no');
  const { server, url } = await serveReview(file);
  try {
    assert.match(await (await fetch(url)).text(), /<textarea class="ing"/);
    assert.equal((await fetch(new URL('../', url))).status, 404);                       // no token, no page
    assert.equal((await fetch(url + 'secret.txt')).status, 404);                        // only images are served
    assert.equal((await fetch(url + '..%2Fsecret.txt')).status, 404);
    const res = await fetch(url + 'save', { method: 'POST', body: JSON.stringify({ edits: [{ i: 0, title: 'Bread', ingredients: '2 c flour', story: 'Sunday bread.', reviewed: true }] }) });
    assert.deepEqual(await res.json(), { ok: true, changed: 1 });
    const saved = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual([saved[0].ingredients, saved[0].story, saved[0].reviewed], [['2 c flour'], 'Sunday bread.', true]);
    assert.equal(JSON.parse(await readFile(`${file}.bak`, 'utf8'))[0].ingredients[0], '1 c flour');
  } finally { server.close(); }
});
