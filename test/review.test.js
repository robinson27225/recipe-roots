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
