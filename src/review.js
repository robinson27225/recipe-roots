// A proofreading sheet for scanned family recipes: each scan beside what the model read from it, so a person can
// check amounts and names against the original before the book is printed. Plain HTML, no model, no network.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** recipes: the raw entries of family-recipes.json. Returns the html; image paths are relative to that file. */
const FR = { '¼': '1/4', '½': '1/2', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8' };
const tokens = (line) => new Set(String(line).replace(/[¼½¾⅓⅔⅛]/g, (c) => ` ${FR[c]} `).match(/\d+(?:[./]\d+)?/g) ?? []);

export function renderReview(recipes, { title = 'Check your scanned recipes' } = {}) {
  const todo = recipes.filter((r) => r.transcribedByAI && !r.reviewed);
  const card = (r) => {
    const check = r.check && (r.check.onlyInTranscript?.length || r.check.onlyInSecondReading?.length);
    const flagged = new Set(r.check?.onlyInTranscript ?? []);          // numbers the transcript has that the second reading doesn't agree with
    const li = (x) => `<li${[...tokens(x)].some((n) => flagged.has(n)) ? ' class="chk"' : ''}>${esc(x)}</li>`;
    return `<section class="card${r.transcribedByAI && !r.reviewed ? ' todo' : ''}">
  <div class="scan">${r.image ? `<img src="${esc(r.image)}" alt="Scan of ${esc(r.title)}">` : '<p class="none">No scan.</p>'}</div>
  <div class="text">
    <h2>${esc(r.title)}</h2>
    <p class="meta">${esc(r.ancestor)}${r.category ? ` · ${esc(r.category)}` : ''}${r.transcribedByAI ? (r.reviewed ? ' · <b class="ok">reviewed</b>' : ' · <b class="no">not yet reviewed</b>') : ''}</p>
    ${check ? `<p class="flag">Check the amounts: the two readings of the scan disagreed on [${esc([...(r.check.onlyInTranscript ?? []), ...(r.check.onlyInSecondReading ?? [])].join(', '))}].</p>` : ''}
    ${r.pageOnly ? '<p class="none">Printed as a page, exactly as scanned. Nothing was transcribed.</p>' : `
    <h3>Ingredients</h3><ul>${(r.ingredients ?? []).map(li).join('')}</ul>
    <h3>Directions</h3><ol>${(r.directions ?? []).map(li).join('')}</ol>
    ${r.yield ? `<h3>Yield</h3><p>${esc(r.yield)}</p>` : ''}
    ${r.story ? `<h3>Notes</h3><p>${esc(r.story)}</p>` : ''}`}
  </div>
</section>`;
  };
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font: 16px/1.45 Georgia, serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; color: #222; background: #fbf8f2; }
  h1 { margin-bottom: .2rem } .lead { color: #555; margin-top: 0 }
  .card { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; padding: 1rem 0; border-top: 1px solid #ddd; break-inside: avoid; }
  .card.todo { border-left: 4px solid #a0522d; padding-left: 1rem }
  img { max-width: 100%; border: 1px solid #ccc; background: #fff }
  h2 { margin: 0 } h3 { font: small-caps 600 .95rem sans-serif; letter-spacing: .08em; margin: 1rem 0 .2rem; color: #355 }
  .meta { color: #666; margin: .1rem 0 } .flag { background: #fdeccd; padding: .4rem .6rem; border-radius: 4px }
  li.chk { background: #fdeccd; border-radius: 3px }
  .ok { color: #2e6b3a } .no { color: #a0522d } .none { color: #777; font-style: italic }
  @media (max-width: 700px) { .card { grid-template-columns: 1fr } }
</style>
<h1>${esc(title)}</h1>
<p class="lead">${todo.length ? `${todo.length} recipe${todo.length === 1 ? '' : 's'} read by the model still need checking.` : 'Nothing is waiting to be checked.'} Compare each scan with the text beside it, fix anything in family-recipes.json, then set <code>"reviewed": true</code>. Handwriting is the hardest thing to read: check every number.</p>
${recipes.map(card).join('\n')}
</html>`;
}
