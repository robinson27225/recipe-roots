import { writeFile } from 'node:fs/promises';
import { htmlToPdf, pagesForMarkers } from './pdf.js';

/**
 * Build a book whose contents and indices carry page numbers. `render(pages)` returns the book's HTML for a given
 * page map: `undefined` for the first draft, a Map once we know, `false` when this machine can't read page numbers.
 * Renders, reads where each marked section landed, renders again with those numbers, and repeats until the numbers
 * stop changing (a longer contents page can push everything after it back), at most four renders in all.
 * Returns { pages, passes, stable }.
 */
export async function buildWithPageNumbers({ render, htmlFile, pdfFile, makePdf = true, cacheDir }) {
  let html = render(undefined);
  await writeFile(htmlFile, html);
  if (!makePdf) return { pages: null, passes: 1, stable: true };
  await htmlToPdf(htmlFile, pdfFile);
  let pages = await pagesForMarkers(pdfFile, { cacheDir });
  if (!pages.size) { // can't read page numbers here: print the contents as a plain list
    await writeFile(htmlFile, render(false));
    await htmlToPdf(htmlFile, pdfFile);
    return { pages: null, passes: 2, stable: true };
  }
  let passes = 1;
  while (passes < 4) {
    html = render(pages);
    await writeFile(htmlFile, html);
    await htmlToPdf(htmlFile, pdfFile);
    passes++;
    const next = await pagesForMarkers(pdfFile, { cacheDir });
    const same = next.size === pages.size && [...next].every(([k, v]) => pages.get(k) === v);
    pages = next;
    if (same) return { pages, passes, stable: true };
  }
  return { pages, passes, stable: false };
}
