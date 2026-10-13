import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractMarkerPages, pagesForMarkers, htmlToPdf, findChrome } from '../src/pdf.js';

test('markers are mapped to the page they appear on; the first appearance wins; unrelated text is ignored', () => {
  const pages = extractMarkerPages(['Cover', '[[toc]] Contents [[p1]]', 'text [[ch1]] more [[ch1]]', '[[r12]] [[ch1]] and [not a marker] [[ ]]', '']);
  assert.deepEqual([...pages], [['toc', 2], ['p1', 2], ['ch1', 3], ['r12', 4]]);
  assert.equal(extractMarkerPages([]).size, 0);
});

test('markers for chapter dishes (letters and digits mixed, like c2r3) are read too', () => {
  const pages = extractMarkerPages(['[[c1r1]] one', 'x [[c2r3]] y [[ix1]]']);
  assert.deepEqual([...pages], [['c1r1', 1], ['c2r3', 2], ['ix1', 2]]);
});

test('a PDF that cannot be read gives no page numbers rather than an error', async () => {
  assert.equal((await pagesForMarkers('/nonexistent/file.pdf')).size, 0);
});

// The real round trip: render a three-page HTML with Chrome, read the markers back. Needs Chrome and a PDF text reader.
const chrome = await findChrome();
test('round trip through a real PDF: invisible markers come back with the right page numbers', { skip: !chrome || process.platform !== 'darwin' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rr-pages-'));
  const mk = (id) => `<span class="mk">[[${id}]]</span>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
    @page{size:6in 9in;margin:.8in;background:#fbf8f1} body{background:#fbf8f1;font:11pt Georgia}
    section{break-before:page} .mk{display:block;height:0;font-size:1px;line-height:1px;color:#fbf8f1}
  </style><section>${mk('a1')}<h2>One</h2></section><section>${mk('a2')}<h2>Two</h2></section><section>${mk('a3')}<h2>Three</h2></section>`;
  await writeFile(path.join(dir, 't.html'), html);
  await htmlToPdf(path.join(dir, 't.html'), path.join(dir, 't.pdf'));
  const pages = await pagesForMarkers(path.join(dir, 't.pdf'), { cacheDir: path.join(os.tmpdir(), 'rr-pages-cache') });
  assert.deepEqual([...pages].sort(), [['a1', 1], ['a2', 2], ['a3', 3]]);
});
