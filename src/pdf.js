import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);

export async function findChrome() {
  for (const c of CANDIDATES) { try { await access(c); return c; } catch { /* next */ } }
  return null;
}

export async function htmlToPdf(htmlFile, pdfFile) {
  const chrome = await findChrome();
  if (!chrome) throw new Error('Chrome/Chromium not found. Set CHROME_PATH, or open book.html and print to PDF.');
  const args = ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${path.resolve(pdfFile)}`, pathToFileURL(path.resolve(htmlFile)).href];
  await new Promise((resolve, reject) => {
    const p = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Chrome exited ${code}: ${err.slice(-300)}`))));
  });
}

// ---- Page numbers for the contents page and indices ----
// Chrome's PDF engine can't print "page 14" next to a link, so the book is built twice. Every section that needs a
// number carries an invisible marker ([[r12]], in 1px text the colour of the paper). After the first render we read
// which page each marker landed on and put the numbers into the second render. The numbers match the footers
// because both count from the cover as page 1.
const MARKER = /\[\[([a-z]+\d*)\]\]/g;

/** Map of marker id -> page number (1-based), from the text of each page. The first appearance wins. */
export function extractMarkerPages(pageTexts) {
  const pages = new Map();
  pageTexts.forEach((text, i) => {
    for (const m of String(text).matchAll(MARKER)) if (!pages.has(m[1])) pages.set(m[1], i + 1);
  });
  return pages;
}

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const out = []; let err = '';
  p.stdout.on('data', (d) => out.push(d)); p.stderr.on('data', (d) => (err += d));
  p.on('error', reject);
  p.on('close', (c) => (c === 0 ? resolve(Buffer.concat(out).toString('utf8')) : reject(new Error(`${cmd} exited ${c}: ${err.slice(-200)}`))));
});

/** The text of each page of a PDF: PDFKit on macOS, else poppler's pdftotext. Rejects if neither is available. */
export async function pdfPageTexts(pdfFile, { cacheDir = '.cache' } = {}) {
  if (process.platform === 'darwin') {
    const { pdfRunsTool } = await import('./cookbook.js');
    const pages = JSON.parse(await run(await pdfRunsTool(cacheDir), [path.resolve(pdfFile)]));
    return pages.map((p) => p.runs.map((r) => r.text).join(''));
  }
  return (await run('pdftotext', ['-layout', path.resolve(pdfFile), '-'])).split('\f');
}

/**
 * Which page each marker is on, or an empty Map if this machine can't read PDF text (the book then simply
 * prints its contents without page numbers).
 */
export async function pagesForMarkers(pdfFile, opts) {
  try { return extractMarkerPages(await pdfPageTexts(pdfFile, opts)); } catch { return new Map(); }
}
