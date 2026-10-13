import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildWithPageNumbers } from '../src/render.js';
import { findChrome, pagesForMarkers } from '../src/pdf.js';

const chrome = await findChrome();
const real = { skip: !chrome || process.platform !== 'darwin' };

// A book whose contents page lists sections with page numbers, like the real one.
const book = (pages) => {
  const mk = (id) => `<span class="mk">[[${id}]]</span>`;
  const num = (id) => (pages instanceof Map ? pages.get(id) ?? '' : '');
  const toc = ['a', 'b', 'c'].map((id) => `<li data-id="${id}">${id.toUpperCase()} ........ <span class="pn">${pages === false ? '' : num(id)}</span></li>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>
    @page{size:6in 9in;margin:.8in;background:#fbf8f1} body{background:#fbf8f1;font:11pt Georgia} section{break-before:page}
    .mk{display:block;height:0;font-size:1px;line-height:1px;color:#fbf8f1} .pn{display:inline-block;width:.4in;text-align:right}
  </style><section>${mk('toc')}<ol>${toc}</ol></section><section>${mk('a')}<h2>A</h2></section><section>${mk('b')}<h2>B</h2></section><section>${mk('c')}<h2>C</h2></section>`;
};

test('the contents carry the page each section really landed on, and the build says it is stable', real, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rr-render-'));
  const out = await buildWithPageNumbers({ render: book, htmlFile: path.join(dir, 'b.html'), pdfFile: path.join(dir, 'b.pdf'), cacheDir: path.join(os.tmpdir(), 'rr-pages-cache') });
  assert.equal(out.stable, true);
  assert.ok(out.passes >= 2 && out.passes <= 3);
  const html = await readFile(path.join(dir, 'b.html'), 'utf8');
  const actual = await pagesForMarkers(path.join(dir, 'b.pdf'), { cacheDir: path.join(os.tmpdir(), 'rr-pages-cache') });
  for (const id of ['a', 'b', 'c']) {
    assert.match(html, new RegExp(`data-id="${id}">[^<]*<span class="pn">${actual.get(id)}</span>`), `${id} is on page ${actual.get(id)}`);
  }
  assert.deepEqual([actual.get('a'), actual.get('b'), actual.get('c')], [2, 3, 4]); // the contents is page 1 here; sections follow
});

test('with no PDF output requested it just writes the draft', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rr-render-'));
  const out = await buildWithPageNumbers({ render: book, htmlFile: path.join(dir, 'b.html'), pdfFile: path.join(dir, 'b.pdf'), makePdf: false });
  assert.deepEqual(out, { pages: null, passes: 1, stable: true });
  assert.match(await readFile(path.join(dir, 'b.html'), 'utf8'), /data-id="a"/);
});
