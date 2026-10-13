// Check a Project Gutenberg cookbook before adding it to data/period-books.js:
//   node tools/book-report.mjs 42450
// Prints the year clues in the book's own text, how many receipts the parser reads, a sample of titles,
// and which pantry dishes it would match. Register a book only if the year is clear, the receipts look
// like receipts, and the heritage is stated by the book itself.
import { fetchBook, parseReceipts, titleMatch } from '../src/period.js';
import PANTRY from '../data/pantry.js';

// A Gutenberg ebook number (42450), or an Internet Archive identifier (b28142214).
const arg = process.argv[2];
if (!arg) { console.error('usage: node tools/book-report.mjs <Gutenberg ebook number | Internet Archive identifier>'); process.exit(1); }
const book = /^\d+$/.test(arg) ? { id: Number(arg) } : { id: arg, source: 'archive' };
const id = book.id;
const text = await fetchBook(book);
if (!text) { console.error(`Couldn't fetch #${id}.`); process.exit(1); }
const clues = [...text.slice(0, 40000).matchAll(/(?:copyright(?:ed)?|entered according[^\n]{0,60}|in the year|©|published|edition)[^\n]{0,40}?\b(1[6-9]\d\d)\b/gi)].map((m) => m[1]);
const receipts = parseReceipts(text);
console.log(`#${id}: ${text.length >> 10} KB; year clues: ${[...new Set(clues)].join(', ') || 'none found (check the title page; an undated book is registered with year: null)'}`);
console.log(`receipts read: ${receipts.length}; sample titles:`);
for (let i = 0; i < 8 && receipts.length; i++) console.log('  -', receipts[Math.floor((i * receipts.length) / 8)].title);
const hits = PANTRY.map((d) => [d, receipts.map((r) => ({ r, s: titleMatch(d, r.title) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0]]).filter(([, h]) => h);
console.log(`pantry dishes matched: ${hits.length}`);
for (const [d, h] of hits) console.log(`  ${d.name.padEnd(30)} <- "${h.r.title}"`);
