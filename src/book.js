import { regionLabel } from './pantry.js';
import { kitchenHistory } from './history.js';
import { pedigree, fanChartSvg } from './fan.js';
import { regionOf } from './regions.js';
import { cookProfile, sortCooks } from './cook.js';
import { categorize, groupByCategory, CATEGORIES } from './categories.js';
import { readFileSync } from 'node:fs';

// The WikiTree heart in pastel yellow (tools/recolor-logo.swift), embedded so the PDF is self-contained.
// WikiTree's own round placeholders for profiles without a photo (assets/), so the lists keep their shape.
const roundIcon = (name) => { try { return `data:image/png;base64,${readFileSync(new URL(`../assets/wikitree-${name}-round.png`, import.meta.url)).toString('base64')}`; } catch { return null; } };
const PLACEHOLDER = { Male: roundIcon('male'), Female: roundIcon('female') };
/** The photo's data URI, or WikiTree's round placeholder for that gender, or null (unknown gender). Only when the book uses photos at all. */
export const avatarFor = (photo, gender, photosInUse) => photo?.uri ?? (photosInUse ? PLACEHOLDER[gender] ?? null : null);

const HEART = (() => {
  try { return `data:image/png;base64,${readFileSync(new URL('../assets/wikitree-heart-yellow.png', import.meta.url)).toString('base64')}`; } catch { return null; }
})();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paras = (t) => t.split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join('\n');
const span = (lo, hi) => (lo === hi ? `${lo}` : `${lo} and ${hi}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lifespan = (p) => (p.born || p.died ? `${p.born ?? '?'}–${p.died ?? '?'}` : '');
const yearOf = (d) => { const y = parseInt(String(d ?? '').slice(0, 4), 10); return y > 0 ? y : null; };

const CSS = `
:root { --ink:#2b2a27; --green:#2f4a3a; --clay:#a8512f; --paper:#fbf8f1; --rule:#d9cfbd; }
@page { size: 6in 9in; margin: 0.8in 0.7in 0.9in; background: var(--paper);
  @bottom-center { content: counter(page); font: 9pt Georgia, serif; color: #8a8372; } }
@page cover { margin: 0; @bottom-center { content: none; } }
@page plain { @bottom-center { content: none; } }
* { box-sizing: border-box; }
html { font: 10.5pt/1.5 'Iowan Old Style', Palatino, Georgia, serif; color: var(--ink); }
body { margin: 0; background: var(--paper); }
h1,h2,h3 { font-weight: 600; line-height: 1.2; margin: 0; color: var(--green); }
a { color: inherit; text-decoration: none; }
p { margin: 0 0 0.7em; orphans: 3; widows: 3; hyphens: auto; }
.cover { page: cover; break-after: page; height: 9in; background: var(--green); color: var(--paper);
  display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0.9in; }
.cover h1 { color: var(--paper); font-size: 34pt; letter-spacing: .01em; }
.cover .sub { margin-top: .5in; font-size: 12pt; font-style: italic; opacity: .9; }
.cover .orn { font-size: 20pt; color: #d9a074; margin: .35in 0; }
.cover .mark { width: 1.1in; height: auto; margin: .4in 0 .1in; }
.cover .by { position: absolute; bottom: .6in; font-size: 8.5pt; letter-spacing: .18em; text-transform: uppercase; opacity: .7; }
.front { page: plain; break-after: page; display: flex; flex-direction: column; justify-content: center; min-height: 6.2in; }
.front.center { text-align: center; }
.front h2, .timeline h2, .family-open h2 { font-size: 15pt; margin-bottom: .2in; }
.dedication { font-style: italic; font-size: 13pt; }
.note { font-size: 9.5pt; border-left: 3px solid var(--clay); padding: .05in .18in; background: #f3ecdd; margin: .2in 0; }
.timeline { break-before: page; break-after: page; page-break-inside: avoid; }
.timeline .sub { color: #6b6556; font-style: italic; margin-bottom: .2in; }
.timeline ol { list-style: none; margin: 0; padding: 0; }
.timeline li { display: flex; gap: .15in; padding: .05in 0; border-bottom: 1px solid var(--rule); font-size: 9.5pt; }
.timeline li b { color: var(--clay); min-width: .45in; font-variant-numeric: tabular-nums; }
.chapter-open { break-before: page; break-after: page; }
.chapter-open .num { color: var(--clay); font-size: 9pt; letter-spacing: .2em; text-transform: uppercase; margin: .6in 0 .15in; }
.chapter-open h2 { font-size: 24pt; margin-bottom: .1in; }
.chapter-open .years { font-style: italic; color: #6b6556; margin-bottom: .25in; }
.chapter-open .rule { height: 2px; width: .8in; background: var(--clay); margin: .2in 0 .3in; }
.chapter-open figure { margin: .1in 0 0; } .chapter-open figcaption { font-size: 8.5pt; color: #6b6556; text-align: center; margin-top: .06in; }
.chapter-open .fan { width: 66%; margin: 0 auto; }
.chapter-open .kitchen { margin-top: .2in; }
.chapter-text { break-after: page; }
.recipe.family.tight { font-size: 9.6pt; line-height: 1.4; }
.recipe.family.tight p, .recipe.family.tight li { margin-bottom: .3em; }
.chapter-text.tight { font-size: 9.4pt; line-height: 1.42; }
.chapter-text.tight p { margin-bottom: .55em; }
a.wt { color: inherit; text-decoration: none; border-bottom: 1px dotted currentColor; }
.wtid { font-variant-numeric: tabular-nums; letter-spacing: .01em; }
.fan { width: 100%; height: auto; display: block; }
.people { list-style: none; padding: 0; margin: 0 0 .25in; font-size: 9.5pt; }
.people li { padding: .04in 0; border-bottom: 1px solid var(--rule); display: flex; justify-content: space-between; gap: .2in; }
.people .rel { color: #6b6556; font-style: italic; }
.people .rel { white-space: nowrap; flex: none; align-self: center; }
.people .who-line { display: flex; align-items: center; gap: .1in; }
.avatar { width: .34in; height: .34in; border-radius: 50%; object-fit: cover; border: 1px solid var(--rule); flex: none; }
.info { display: flex; justify-content: space-between; align-items: flex-start; gap: .2in; margin-bottom: .05in; }
.portrait { margin: 0; flex: none; width: 1.05in; text-align: center; }
.portrait.ph img { width: 1in; height: 1in; max-height: none; border-radius: 50%; border: 0; object-fit: contain; }
.portrait img { width: 100%; max-height: 1.35in; object-fit: cover; border-radius: 6px; border: 1px solid var(--rule); }
.portrait figcaption { font-size: 6.5pt; color: #8a8372; margin-top: .03in; line-height: 1.25; }
.kitchen { break-inside: avoid; font-size: 9.5pt; background: #f3ecdd; border-left: 3px solid var(--green); padding: .08in .18in; margin: .25in 0 0; }
.kitchen h4 { margin: 0 0 .06in; font-size: 8.5pt; letter-spacing: .15em; text-transform: uppercase; color: var(--green); }
.kitchen p { margin: 0 0 .5em; }
.recipe { break-before: page; }
.recipe .side { color: var(--clay); font-size: 8.5pt; letter-spacing: .18em; text-transform: uppercase; }
.recipe h3 { font-size: 19pt; margin: .05in 0 .12in; }
.recipe .meta { font-size: 9pt; color: #6b6556; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding: .06in 0; margin: .15in 0 .2in; display: flex; gap: .3in; }
.recipe .head { font-style: italic; }
.period { break-before: page; padding: .15in .1in 0; }
.period h4 { margin: 0 0 .22in; font-size: 11pt; letter-spacing: .14em; color: var(--clay); }
.period blockquote { margin: 0; padding-left: .2in; border-left: 3px solid var(--clay); font-size: 10.5pt; line-height: 1.5; font-style: italic; white-space: pre-line; }
.structured { margin-top: .16in; padding-top: .1in; border-top: 1px solid var(--rule); font-size: 9pt; break-inside: avoid; }
.structured h5 { margin: 0 0 .08in; font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; color: var(--green); font-weight: 600; }
.structured .cols { display: flex; gap: .25in; } .structured .cols > div { flex: 1; }
.structured ul, .structured ol { margin: .04in 0 0; padding-left: 1.1em; } .structured li { margin-bottom: .03in; }
.structured .gaps { margin: .08in 0 0; font-size: 8.5pt; } .structured .how { margin: 0 0 .08in; font-size: 7.5pt; color: #6b6556; font-style: italic; }
.period cite { display: block; margin-top: .25in; font-size: 8.5pt; color: #6b6556; font-style: normal; line-height: 1.4; }
.recipe h4 { font-size: 9pt; letter-spacing: .15em; text-transform: uppercase; color: var(--clay); margin: .2in 0 .08in; }
.recipe ul { margin: 0; padding-left: 1.1em; } .recipe ul li { margin-bottom: .2em; }
.recipe ol { margin: 0; padding-left: 1.3em; } .recipe ol li { margin-bottom: .45em; }
.family-open { break-before: page; break-after: page; }
.family-open .num { color: var(--clay); font-size: 9pt; letter-spacing: .2em; text-transform: uppercase; margin: 1.2in 0 .15in; }
.family-open h2 { font-size: 24pt; }
.family .lab { color: var(--clay); font-size: 8.5pt; letter-spacing: .18em; text-transform: uppercase; margin-right: .12in; }
.family .who { font-size: 10pt; margin: 0 0 .04in; }
.family ul.two { columns: 2; column-gap: .3in; padding-left: 1.1em; font-size: 10pt; }
.family .directions p { margin-bottom: .5em; }
.family .story { background: #e6efd9; border-radius: 10px; padding: .12in .2in; font-style: italic; font-size: 9.5pt; margin: .2in 0; }
.story-row { display: flex; gap: .15in; align-items: center; margin: .2in 0 .05in; break-inside: avoid; }
.story-row .story { flex: 1 1 58%; margin: 0; }
.story-row .side-fan { flex: 0 0 38%; margin: 0; width: auto; }
.family > figure { width: 60%; margin: .1in auto 0; break-inside: avoid; }
.source { font-size: 8pt; color: #6b6556; margin: .06in 0 0; }
.check { font-size: 8.5pt; color: var(--clay); border: 1px solid var(--clay); border-radius: 6px; padding: .04in .12in; }
.scan-page .scan { display: block; max-width: 100%; max-height: 4.5in; margin: .15in auto; border: 1px solid var(--rule); }
.small-fan { width: 62%; margin: .1in auto 0; }
.original { break-before: page; break-inside: avoid; text-align: center; } .original img { max-width: 100%; max-height: 7in; border: 1px solid var(--rule); }
.index { page: plain; break-before: page; font-size: 9pt; }
.index h2 { margin-bottom: .2in; font-size: 15pt; }
.index li { margin-bottom: .05in; }
.small { font-size: 8.5pt; color: #6b6556; }

.mk { display: block; height: 0; font-size: 1px; line-height: 1px; color: #fbf8f1; overflow: visible; }
.toc-page { page: plain; break-before: page; break-after: page; }
.toc-page h2, .ix h2 { font-size: 15pt; margin-bottom: .18in; }
.toc, .ixl { list-style: none; margin: 0; padding: 0; font-size: 9.5pt; }
.toc li, .ixl li { margin: 0; }
.toc li a, .ixl li a { display: flex; align-items: baseline; gap: .06in; padding: .028in 0; }
.toc .t, .ixl .t { flex: 0 1 auto; }
.toc .dots, .ixl .dots { flex: 1 1 auto; border-bottom: 1px dotted #b8ad97; transform: translateY(-.03in); min-width: .2in; }
.toc .pn, .ixl .pn { flex: 0 0 .32in; text-align: right; font-variant-numeric: tabular-nums; color: #6b6556; }
.toc li.head { margin-top: .12in; font-weight: 600; color: var(--green); font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; }
.toc li.head a { padding: 0; } .toc li.l1 a { padding-left: .18in; font-size: 9pt; }
.cook-open { break-before: page; break-after: page; }
.cook-open .side { color: var(--clay); font-size: 8.5pt; letter-spacing: .18em; text-transform: uppercase; margin-top: .25in; }
.cook-open h2 { font-size: 22pt; margin: .04in 0 .04in; }
.cook-open .years { font-style: italic; color: #6b6556; margin-bottom: .16in; }
.cook-head { display: flex; gap: .2in; align-items: flex-start; margin-bottom: .1in; }
.cook-head .portrait { width: 1.25in; } .cook-head .portrait img { max-height: 1.6in; }
.cook-head .life { margin: 0 0 .06in; font-size: 10.5pt; }
.cook-open .story { margin: .12in 0; }
.cook-fan { width: 64%; margin: .04in auto 0; }
.cook-open.has-photo .cook-fan { width: 50%; } 
.cook-open .kitchen { margin-top: .12in; font-size: 9pt; }
.cook-recipes { margin-top: .12in; }
.cat { font-size: 7.5pt; letter-spacing: .16em; text-transform: uppercase; color: #8a8372; margin: -.08in 0 .1in; }
.ix { page: plain; break-before: page; }
.ix h3 { font-size: 9pt; letter-spacing: .14em; text-transform: uppercase; color: var(--clay); margin: .18in 0 .04in; }
`;


const mk = (id) => `<span class="mk" id="${id}">[[${id}]]</span>`;
const pageOf = (pages, id) => (pages instanceof Map ? (pages.get(id) ?? '') : '');
/** A contents/index line. `pages === false` means "no page numbers on this machine": a plain list. */
const line = (label, id, pages, cls = '') => `<li${cls ? ` class="${cls}"` : ''}><a href="#${id}"><span class="t">${esc(label)}</span>${pages === false ? '' : `<span class="dots"></span><span class="pn">${pageOf(pages, id)}</span>`}</a></li>`;

/** The verbatim period quotation, with its credit and (if there is one) the recipe layout, on its own facing page. */
export function periodBlock(period, modelLabel) {
  const b = period.book;
  const heading = period.similar
    ? (b.year ? `A similar dish, as they wrote it in ${b.year}` : 'A similar dish, as it was written down')
    : (b.year ? `How they wrote it, in ${b.year}` : 'How it was written down');
  const similarNote = period.similar ? '<p class="how">Not the same dish: the closest receipt this cookbook has to the recipe on the previous page, found by searching its receipts by keyword and by meaning.</p>' : '';
  return `<div class="period"><h4>${heading}</h4>${similarNote}<blockquote>${esc(period.text)}</blockquote><cite>"${esc(period.title)}," <i>${esc(b.title)}</i>, ${esc(b.author)}${b.note ? ` (${esc(b.note)})` : ''}${b.year ? `, ${b.year}` : ''}. ${b.source === 'archive' ? `Internet Archive, ${esc(b.id)} (machine-read scan; small errors are possible)` : `Project Gutenberg #${esc(b.id)}`}; in the public domain in the United States.</cite>${structuredBlock(period.structured, modelLabel)}</div>`;
}

/** The receipt in a standard layout, set under the verbatim original, with an honest note on how it was made. */
function structuredBlock(s, modelLabel) {
  if (!s) return '';
  const how = s.how === 'list'
    ? 'Reformatted from the receipt above: the wording is the original\'s.'
    : `Restructured by an open-weight model${modelLabel ? ` (${esc(modelLabel)})` : ''} and checked against the original: every ingredient and quantity is in the text above, and nothing was added. Not kitchen-tested.`;
  return `<div class="structured"><h5>In a recipe layout</h5>
    <p class="how">${how}</p>
    <div class="cols"><div><b>Ingredients</b><ul>${s.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
    <div><b>Method</b><ol>${s.steps.map((i) => `<li>${esc(i)}</li>`).join('')}</ol></div></div>
    ${s.notes?.length ? `<p class="gaps"><b>Note:</b> ${s.notes.map(esc).join(' ')}</p>` : ''}</div>`;
}

function recipe(r, headnote, story, modelLabel, anchor) {
  const where = r.side === 'origin' ? story.from.label : story.to.label;
  const kicker = r.neighbour ? `A stand-in from ${regionLabel(r.region)}`
    : r.region === 'usa-general' ? 'An American classic' : `A traditional dish of ${where}`;
  return `
<section class="recipe">${anchor ? mk(anchor) : ''}
  <div class="side">${esc(kicker)}</div>
  <h3>${esc(r.name)}</h3>
  <p class="head">${esc(headnote)}</p>
  <div class="meta"><span><b>Serves</b> ${esc(r.serves)}</span><span><b>Time</b> ${esc(r.time)}</span><span><b>Course</b> ${esc(r.course)}</span></div>
  <h4>Ingredients</h4>
  <ul>${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
  <h4>Method</h4>
  <ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
  ${r.period ? periodBlock(r.period, modelLabel) : ''}
</section>`;
}

/**
 * A long cast of relatives plus a long model-written introduction can run a few lines onto a second page that
 * holds almost nothing. Past this much text the page is set a little smaller instead (about 90 characters of
 * height per listed person, as for the people list above the text).
 */
export const chapterTextClass = (peopleCount, intro) => {
  const text = String(Array.isArray(intro) ? intro.join(' ') : intro ?? '');
  return text.length + 90 * peopleCount >= 1700 ? 'chapter-text tight' : 'chapter-text';
};

function chapter(c, n, people, photos, modelLabel) {
  const { story, recipes, text } = c;
  const place = story.originPlace && story.originPlace.toLowerCase().endsWith(story.from.label.toLowerCase()) ? story.originPlace : [story.originPlace, story.from.label].filter(Boolean).join(', ');
  const lead = [...story.people].sort((a, b) => a.gen - b.gen)[0];
  const fan = people ? fanChartSvg(pedigree(people, lead.id)) : '';
  const history = kitchenHistory({ lo: story.lo - 10, hi: story.hi + 10, regionKeys: [story.from.key, story.to.key] });
  const kitchen = history.length ? `<div class="kitchen"><h4>In the kitchen, in those years</h4>${history.map((h) => `<p>${esc(h.text)}</p>`).join('')}</div>` : '';
  return `
<section class="chapter-open">
  <div class="num">Chapter ${n}</div>
  <h2>${esc(cap(story.from.label))} to ${esc(story.to.label)}</h2>
  <div class="years">sometime between ${span(story.lo, story.hi)} · from ${esc(place)}</div>
  <div class="rule"></div>
  ${fan ? `<figure>${fan}<figcaption>${esc(lead.name)}, ${esc(lead.relation)}: parents and grandparents</figcaption></figure>` : ''}
  ${kitchen}
</section>
<section class="${chapterTextClass(story.people.length, text.intro)}">
  <ul class="people">${story.people.map((p) => `<li><span class="who-line">${(() => { const uri = avatarFor(photos?.get(p.id), people?.get(p.id)?.Gender, photos?.size > 0); return uri ? `<img class="avatar" src="${uri}" alt="">` : ''; })()}<span>${p.wikiTreeId ? wtLink(esc(p.name), p.wikiTreeId) : esc(p.name)} <span class="small">${esc(lifespan(p))}${p.wikiTreeId ? ` · ${wtId(p.wikiTreeId)}` : ''}</span></span></span><span class="rel">${esc(p.relation)}</span></li>`).join('')}</ul>
  ${paras(text.intro)}
</section>
${recipes.map((r, j) => recipe(r, text.headnotes[r.id], story, modelLabel, `c${n}r${j + 1}`)).join('\n')}`;
}

/** A family recipe page. With a cook page before it the cook's portrait and fan chart live there, so this page is just the recipe. */
/** A live link to a person's WikiTree profile (the PDF keeps it clickable). */
const WIKITREE = 'https://www.wikitree.com/wiki/';
export const wtUrl = (id) => `${WIKITREE}${encodeURIComponent(id)}`;
export const wtLink = (text, id) => `<a class="wt" href="${esc(wtUrl(id))}">${text}</a>`;
export const wtId = (id) => `<span class="wtid">${wtLink(esc(id), id)}</span>`;

/** "Makes 7 ramekins": print what the card says, adding a label only when it doesn't already start with one. */
export function yieldLine(y) {
  const text = String(y ?? '').trim();
  if (!text) return '';
  return /^(makes?|serves?|yields?)\b/i.test(text) ? esc(text) : `<span class="lab">Makes</span>${esc(text)}`;
}

/**
 * Roughly how many lines a family recipe fills (two ingredient columns, directions wrapped at ~70 characters, a
 * note box): a long card is set a little smaller so its last line doesn't land alone on the next page.
 */
export function recipeLines(r) {
  const wrap = (s, n = 70) => Math.max(1, Math.ceil(String(s).length / n));
  return Math.ceil(r.ingredients.length / 2) + r.directions.reduce((n, d) => n + wrap(d), 0)
    + (r.story ? wrap(r.story, 60) + 2 : 0) + (r.transcribedByAI && !r.reviewed ? 3 : 0) + (r.yield ? 1 : 0) + (r.source ? 1 : 0);
}

function familyRecipe(r, { id, profiled, modelLabel }) {
  const who = profiled ? '' : `<p class="who"><span class="lab">${r.direct ? 'Ancestor' : r.person ? 'Relative' : 'Cook'}</span>${esc(r.ancestorName)}${r.relation ? `, ${esc(r.relation)}` : ''} <span class="small">· ${wtId(r.ancestor)}</span></p>`;
  const head = `${mk(id)}
  <div class="side">${r.pageOnly ? 'In their own hand' : profiled ? `From the kitchen of ${esc(r.ancestorName)}` : 'From the family kitchen'}</div>
  <h3>${esc(r.title)}</h3>
  <p class="cat">${esc(r.category)}</p>
  ${who}
  ${r.yield ? `<p class="who">${yieldLine(r.yield)}</p>` : ''}
  ${r.contributor ? `<p class="who"><span class="lab">Shared by</span>${esc(r.contributor)}</p>` : ''}
  ${r.source ? `<p class="source">Source: ${esc(r.source)}</p>` : ''}`;
  const period = r.period ? `<section class="period-page">${periodBlock(r.period, modelLabel)}</section>` : '';

  if (r.pageOnly) { // the scan is the page: handwriting is the point
    return `
<section class="recipe family scan-page">${head}
  <img class="scan" src="${r.imageData}" alt="Scan of the original recipe: ${esc(r.title)}">
  ${r.story ? `<div class="story">${esc(r.story)}</div>` : ''}
</section>${period}`;
  }
  return `
<section class="recipe family${recipeLines(r) > 19 ? ' tight' : ''}">${head}
  ${r.ingredients.length ? `<h4>Ingredients</h4>\n  <ul class="two">${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
  ${r.directions.length ? `<h4>Directions</h4>\n  <div class="directions">${r.directions.map((d) => `<p>${esc(d)}</p>`).join('')}</div>` : ''}
  ${r.story ? `<div class="story">${esc(r.story)}</div>` : ''}
  ${r.transcribedByAI && !r.reviewed ? `<p class="check">Transcribed by AI from the scan${r.imageData && r.showScan ? ' on the next page' : ''}. Check amounts against the original.</p>` : ''}
</section>
${r.imageData && r.showScan ? `<section class="original"><img src="${r.imageData}" alt="Scan of the original recipe: ${esc(r.title)}"><p class="small">The original, as scanned.</p></section>` : ''}${period}`;
}

/** A cook's opening page: portrait, life, the family's own story, fan chart, and the kitchens of their time. */
function cookPage(cook, id, { people, photos }) {
  const { profile } = cook;
  const photo = photos?.get(cook.person.Id);
  const note = cook.photoNote ? `${esc(cook.photoNote)}<br>` : '';
  const placeholder = !photo && photos?.size > 0 ? PLACEHOLDER[cook.person?.Gender] : null;
  const portrait = placeholder ? `<figure class="portrait ph"><img src="${placeholder}" alt=""></figure>` : photo ? `<figure class="portrait"><img src="${photo.uri}" alt="${esc(profile.name)}"><figcaption>${photo.caption ? `${esc(photo.caption)}<br>` : ''}${note}${photo.credit ? `Photo: ${esc(photo.credit)}` : `Photo: WikiTree ${photo.pageUrl ? `<a class="wt" href="https://www.wikitree.com${esc(photo.pageUrl)}">photo page</a>, ` : ''}profile ${wtId(photo.name)}`}</figcaption></figure>` : '';
  const fanPeople = people && cook.person.PermittedLiving ? new Map(people).set(cook.person.Id, { ...cook.person, DisplayNameOverride: profile.name }) : people;
  const fan = people ? fanChartSvg(pedigree(fanPeople, cook.person.Id)) : '';
  const move = profile.chapter ? `<p class="small">Their move from ${esc(profile.chapter.from)} to ${esc(profile.chapter.to)} is in <a href="#ch${profile.chapter.number}">Chapter ${profile.chapter.number}</a>.</p>` : '';
  return `
<section class="cook-open${photo ? ' has-photo' : ''}">${mk(id)}
  <div class="side">From the kitchen of</div>
  <h2>${cook.person?.Name ? wtLink(esc(profile.name), cook.person.Name) : esc(profile.name)}</h2>
  <div class="years">${esc([profile.years, profile.relation].filter(Boolean).join(' · '))}${cook.person?.Name ? ` · ${wtId(cook.person.Name)}` : ''}</div>
  <div class="cook-head">${portrait}<div>${profile.life ? `<p class="life">${esc(profile.life)}</p>` : ''}${move}</div></div>
  ${profile.story ? `<div class="story">${esc(profile.story)}</div>` : ''}
  ${fan ? `<figure class="cook-fan">${fan}</figure>` : ''}
  ${profile.kitchen.length ? `<div class="kitchen"><h4>In their time</h4>${profile.kitchen.map((k) => `<p>${esc(k.text)}</p>`).join('')}</div>` : ''}
</section>`;
}

/**
 * Part two: the family's own recipes, arranged by cook (oldest first), each cook introduced by a page of their own.
 * Returns the html, plus what the contents and indices need.
 */
function familyPart(familyRecipes, { people, chapters, photos, peopleNotes, modelLabel }) {
  const groups = new Map();
  familyRecipes.forEach((r, i) => {
    r.category = categorize(r);
    const key = r.person ? `p${r.person.Id}` : `x${r.ancestor}`;
    if (!groups.has(key)) groups.set(key, { key, person: r.person, name: r.ancestorName, relation: r.relation, direct: r.direct, recipes: [], photoNote: null });
    const g = groups.get(key);
    g.recipes.push(r);
    g.photoNote ??= r.photoNote;
    r.anchor = `r${i + 1}`;
  });
  const cooks = [...groups.values()].map((c) => {
    if (c.person) {
      const note = peopleNotes?.[c.recipes[0].ancestor] ?? null;
      c.profile = cookProfile({ person: c.person, people, chapters, note, relation: c.relation, name: c.name });
      c.photoNote = note?.photoNote ?? c.photoNote;
      c.name = c.profile.name; c.born = c.profile.born ?? c.profile.bornApprox;
    } else c.born = null;
    c.recipes.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.title.localeCompare(b.title));
    return c;
  });
  const ordered = sortCooks(cooks);
  ordered.forEach((c, i) => { c.anchor = `ck${i + 1}`; });

  const html = `
<section class="family-open">${mk('p2')}<div class="num">Part two</div><h2>The family kitchen</h2>
  <p style="margin-top:.2in">Recipes written down by the family, shown as they were shared. They are arranged by cook, oldest first, each cook introduced by a page of their own; the indices at the back find a recipe by its kind or by its cook.</p></section>
${ordered.map((c) => `${c.person ? cookPage(c, c.anchor, { people, photos }) : ''}${c.recipes.map((r) => familyRecipe(r, { id: r.anchor, profiled: Boolean(c.person), modelLabel })).join('\n')}`).join('\n')}`;
  return { html, cooks: ordered };
}

/** The two indices: recipes by category, and recipes by cook. */
/**
 * Every recipe in the book, filed by category: the chapters' traditional dishes and the family's own. A family
 * recipe is credited to its cook, a chapter dish to its chapter. `cooks` (the family kitchen) may be empty.
 */
export function chapterEntries(chapters) {
  return chapters.flatMap((c, i) => c.recipes.map((r, j) => ({
    title: r.name, category: categorize({ title: r.name, ingredients: r.ingredients }), anchor: `c${i + 1}r${j + 1}`, by: `Chapter ${i + 1}`,
  })));
}

function indexPages(cooks, chapterRecipes, pages) {
  const entries = [
    ...chapterRecipes,
    ...cooks.flatMap((c) => c.recipes.map((r) => ({ title: r.title, category: r.category, anchor: r.anchor, by: c.name }))),
  ];
  const byCategory = groupByCategory(entries);
  const byCook = cooks.length ? `
<section class="ix">${mk('ix2')}<h2>Recipes by cook</h2>
  ${cooks.map((c) => `<h3>${esc(c.name)}${c.profile?.years ? ` (${esc(c.profile.years)})` : ''}</h3><ul class="ixl">${c.recipes.map((r) => line(r.title, r.anchor, pages)).join('')}</ul>`).join('')}
</section>` : '';
  return `
<section class="ix">${mk('ix1')}<h2>Recipes by category</h2>
  ${byCategory.map((g) => `<h3>${esc(g.category)}</h3><ul class="ixl">${g.recipes.map((r) => line(`${r.title}, ${r.by}`, r.anchor, pages)).join('')}</ul>`).join('')}
</section>${byCook}`;
}

/** Say only what is true about how each chapter's text was produced. */
function provenance(chapters, modelLabel) {
  const n = chapters.filter((c) => c.text.source !== 'template').length;
  if (n === 0) return 'The chapter text was assembled directly from those records; no AI model wrote any of it.';
  const m = modelLabel ? ` (${esc(modelLabel)})` : '';
  if (chapters.every((c) => c.text.source === 'model')) return `The chapter text was drafted by an open-weight model${m} and checked against those records before printing. Every fact about the people comes straight from the records, not from the model, which wrote only about the food.`;
  return `The text of ${n} of ${chapters.length} chapters was drafted in whole or in part by an open-weight model${m} and checked against those records before printing; the rest was assembled directly from the records. Every fact about the people comes straight from the records, not from the model, which wrote only about the food.`;
}

export function renderBook({ title, subtitle, dedication, chapters, rootId, modelLabel, people = null, familyRecipes = [], photos = null, peopleNotes = {}, pages }) {
  const allPeople = chapters.flatMap((c) => c.story.people);
  const seen = new Set();
  const index = allPeople.filter((p) => !seen.has(p.id) && seen.add(p.id));

  // Book-wide kitchen timeline across every era and region in the book.
  const years = [...allPeople.flatMap((p) => [p.born, p.died]), ...familyRecipes.flatMap((r) => [yearOf(r.person?.BirthDate), yearOf(r.person?.DeathDate)])].filter(Boolean);
  const regionKeys = [...new Set([...chapters.flatMap((c) => [c.story.from.key, c.story.to.key]), ...familyRecipes.map((r) => regionOf(r.person?.BirthLocation)?.key).filter(Boolean)])];
  const timeline = years.length ? kitchenHistory({ lo: Math.min(...years), hi: Math.max(...years), regionKeys }, 9) : [];
  const wikiPhotos = [...(photos?.values() ?? [])].some((p) => !p.personal);
  const familyPhotos = [...(photos?.values() ?? [])].some((p) => p.personal);

  const hasFamily = familyRecipes.length > 0;
  const family = hasFamily ? familyPart(familyRecipes, { people, chapters, photos, peopleNotes, modelLabel }) : null;

  const chapterRecipes = chapterEntries(chapters);

  // Contents: where to find things, with page numbers once a first render has told us where they landed.
  const toc = [
    { head: 'Where they came from' },
    ...(timeline.length ? [{ label: 'A kitchen timeline', id: 'tl' }] : []),
    ...chapters.map((c, i) => ({ label: `Chapter ${i + 1}: ${cap(c.story.from.label)} to ${c.story.to.label}`, id: `ch${i + 1}` })),
    ...(family ? [{ head: 'The family kitchen' }, { label: 'About this part', id: 'p2' },
      ...family.cooks.map((c) => ({ label: `${c.name}${c.relation ? `, ${c.relation}` : ''}${c.profile?.years ? ` (${c.profile.years})` : ''}`, id: c.person ? c.anchor : c.recipes[0].anchor, level: 1 })),
      ] : []),
    ...(chapterRecipes.length || family ? [{ head: 'Finding a recipe' }, { label: 'Recipes by category', id: 'ix1' }, ...(family ? [{ label: 'Recipes by cook', id: 'ix2' }] : [])] : []),
    { head: 'The people' }, { label: 'The people in this book', id: 'pp' },
  ];
  const contents = toc.map((t) => (t.head ? `<li class="head"><span class="t">${esc(t.head)}</span></li>` : line(t.label, t.id, pages, t.level ? `l${t.level}` : ''))).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
<section class="cover">
  <h1>${esc(title)}</h1>
  ${HEART ? `<img class="mark" src="${HEART}" alt="WikiTree heart logo">` : '<div class="orn">❦</div>'}
  <div class="sub">${esc(subtitle)}</div>
  <div class="by">Recipe Roots</div>
</section>
${dedication ? `<section class="front center"><p class="dedication">${esc(dedication)}</p></section>` : ''}
<section class="front">
  <h2>About this book</h2>
  <p>Every chapter here begins with real records. The people, places and years come from public WikiTree profiles, starting from <b>${wtLink(esc(rootId), rootId)}</b>. Where records show someone born in one place and later living in another, this book follows that move.</p>
  <p>The dishes in the chapters are traditional foods from those places and eras, chosen from a curated collection. <b>They are not recorded family recipes.</b> They are the kind of meals families like these might have cooked, and a way to taste the world they left and the one they came to.${hasFamily ? ' <i>The family kitchen</i> is different: those recipes were written down by relatives, and appear here exactly as they were shared, each introduced by a page about the person who cooked it.' : ''}</p>
  <p>Dates of moves are approximate windows estimated from birth, death and children's birthplaces.</p>
  <p>${provenance(chapters, modelLabel)}</p>
  ${wikiPhotos ? '<p>Where a WikiTree profile has a primary photo, it appears beside that person, credited to the profile it came from. Those photos belong to the people who uploaded them.</p>' : ''}
  ${familyPhotos ? '<p>Photos credited to the family collection were supplied by the family.</p>' : ''}
  ${[...chapters.flatMap((c) => c.recipes), ...familyRecipes].some((r) => r.period) ? '<p>Passages under <i>How they wrote it</i> are quoted word for word from cookbooks of the period that are in the public domain in the United States. Spelling and measures are original, and sometimes surprising.</p>' : ''}
  <p class="note">Add your own: a blank page after each chapter is a good place for the recipes your family really does pass down.</p>
</section>
<section class="toc-page">${mk('toc')}<h2>Contents</h2><ol class="toc">${contents}</ol></section>
${timeline.length ? `<section class="timeline">${mk('tl')}
  <h2>A kitchen timeline</h2>
  <p class="sub">What was changing in kitchens during the years of the people in this book.</p>
  <ol>${timeline.map((t) => `<li><b>${t.from}</b><span>${esc(t.text)}</span></li>`).join('')}</ol>
  <p class="small" style="margin:.12in 0 0">General background on food history, not facts about any one family.</p>
</section>` : ''}
${chapters.map((c, i) => chapter(c, i + 1, people, photos, modelLabel).replace('<section class="chapter-open">', `<section class="chapter-open">${mk(`ch${i + 1}`)}`)).join('\n')}
${family ? family.html : ''}
${chapterRecipes.length || family ? indexPages(family?.cooks ?? [], chapterRecipes, pages) : ''}
<section class="index">${mk('pp')}
  <h2>The people in this book</h2>
  <ul>${index.map((p) => `<li>${wtLink(esc(p.name), p.wikiTreeId)}, ${esc(p.relation)} ${esc(lifespan(p) && `(${lifespan(p)})`)}<br><span class="small">${wtLink(`wikitree.com/wiki/${esc(p.wikiTreeId)}`, p.wikiTreeId)}</span></li>`).join('')}</ul>
  <p class="small" style="margin-top:.3in">Relationships are stated from the profile of ${wtLink(esc(rootId), rootId)}: "grandmother" means that person's grandmother, and so on. Names and IDs link to the people's WikiTree profiles.</p>
  <p class="small">Genealogical data from WikiTree, the free shared family tree. Recipe pantry and book generator: Recipe Roots, open source.</p>
</section>
</body></html>`;
}
