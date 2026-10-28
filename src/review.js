// A proofreading sheet for scanned family recipes: each scan beside what the model read from it, so a person can
// check amounts and names against the original before the book is printed. Plain HTML, no model, no network.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** recipes: the raw entries of family-recipes.json. Returns the html; image paths are relative to that file. */
const FR = { '¼': '1/4', '½': '1/2', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8' };
const tokens = (line) => new Set(String(line).replace(/[¼½¾⅓⅔⅛]/g, (c) => ` ${FR[c]} `).match(/\d+(?:[./]\d+)?/g) ?? []);

/** Questions a family story can answer. Printed on the sheet only; the book prints whatever the family writes in "story". */
export const STORY_PROMPTS = [
  'Which occasion was it for: a birthday, Thanksgiving, the Sabbath, a funeral supper?',
  'Where did the dish come from: the cook\'s own cultural background, a neighbour, a magazine?',
  'What do you remember about it: the smell, the kitchen, who asked for seconds?',
];

const lines = (a) => (a ?? []).join('\n');
const rows = (a, min) => Math.max(min, (a ?? []).length + 1);
/** The editable fields for one recipe (edit mode only; the local review server saves them back to the file). */
function editFields(r) {
  const story = `<label>Family story (printed as you write it)</label>
    <textarea class="story" rows="4" placeholder="${esc(STORY_PROMPTS.join('  '))}">${esc(r.story ?? '')}</textarea>`;
  if (r.pageOnly) return `<p class="none">Printed as a page, exactly as scanned. Nothing was transcribed.</p>${story}`;
  return `<label>Ingredients (one per line)</label><textarea class="ing" rows="${rows(r.ingredients, 4)}">${esc(lines(r.ingredients))}</textarea>
    <label>Directions (one per line)</label><textarea class="dir" rows="${Math.min(14, rows(r.directions, 4))}">${esc(lines(r.directions))}</textarea>
    <label>Yield</label><input class="yield" value="${esc(r.yield ?? '')}" placeholder="for example: makes 7 ramekins">
    ${story}
    ${r.transcribedByAI ? `<label class="rev"><input type="checkbox" class="rev-box"${r.reviewed ? ' checked' : ''}> I checked this against the card</label>` : ''}`;
}

/** Applies edits from the review page to the recipes array. Matches by position and title so a stale page can't overwrite the wrong recipe. */
export function applyEdits(recipes, edits) {
  const clean = (t) => String(t ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  let changed = 0;
  for (const e of Array.isArray(edits) ? edits : []) {
    const r = recipes[e?.i];
    if (!r || r.title !== e.title) throw new Error(`The file changed since this page was opened (recipe ${e?.i}: "${e?.title}"). Reload the page.`);
    const before = JSON.stringify(r);
    if (typeof e.ingredients === 'string') r.ingredients = clean(e.ingredients);
    if (typeof e.directions === 'string') r.directions = clean(e.directions);
    if (typeof e.yield === 'string') { if (e.yield.trim()) r.yield = e.yield.trim(); else delete r.yield; }
    if (typeof e.story === 'string') { const story = e.story.trim() || null; if ((r.story ?? null) !== story) r.story = story; }
    if (r.transcribedByAI && typeof e.reviewed === 'boolean') { r.reviewed = e.reviewed; if (e.reviewed) delete r.check; }
    if (JSON.stringify(r) !== before) changed++;
  }
  return changed;
}

const EDIT_SCRIPT = `<script>
const status = document.getElementById('status'), btn = document.getElementById('save');
const dirty = () => { status.textContent = 'Unsaved changes.'; };
document.querySelectorAll('textarea, input').forEach((el) => el.addEventListener('input', dirty));
btn.addEventListener('click', async () => {
  const edits = [...document.querySelectorAll('.card')].map((c) => ({ i: Number(c.dataset.i), title: c.dataset.title,
    ingredients: c.querySelector('.ing')?.value, directions: c.querySelector('.dir')?.value, yield: c.querySelector('.yield')?.value,
    story: c.querySelector('.story')?.value, reviewed: c.querySelector('.rev-box')?.checked }));
  status.textContent = 'Saving...';
  try {
    const res = await fetch('save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ edits }) });
    const out = await res.json();
    status.textContent = res.ok ? 'Saved' + (out.changed ? ' (' + out.changed + ' recipe' + (out.changed === 1 ? '' : 's') + ' changed).' : ': nothing had changed.') : 'Not saved: ' + out.error;
  } catch (e) { status.textContent = 'Not saved: ' + e.message; }
});
</script>`;

export function renderReview(recipes, { title = 'Check your scanned recipes', edit = false } = {}) {
  const todo = recipes.filter((r) => r.transcribedByAI && !r.reviewed);
  const card = (r, i) => {
    const check = r.check && (r.check.onlyInTranscript?.length || r.check.onlyInSecondReading?.length);
    const flagged = new Set(r.check?.onlyInTranscript ?? []);          // numbers the transcript has that the second reading doesn't agree with
    const li = (x) => `<li${[...tokens(x)].some((n) => flagged.has(n)) ? ' class="chk"' : ''}>${esc(x)}</li>`;
    return `<section class="card${r.transcribedByAI && !r.reviewed ? ' todo' : ''}" data-i="${i}" data-title="${esc(r.title)}">
  <div class="scan">${r.image ? `<img src="${esc(r.image)}" alt="Scan of ${esc(r.title)}">` : '<p class="none">No scan.</p>'}</div>
  <div class="text">
    <h2>${esc(r.title)}</h2>
    <p class="meta">${esc(r.ancestor)}${r.category ? ` · ${esc(r.category)}` : ''}${r.transcribedByAI ? (r.reviewed ? ' · <b class="ok">reviewed</b>' : ' · <b class="no">not yet reviewed</b>') : ''}</p>
    ${check ? `<p class="flag">Check the amounts: the two readings of the scan disagreed on [${esc([...(r.check.onlyInTranscript ?? []), ...(r.check.onlyInSecondReading ?? [])].join(', '))}].</p>` : ''}
    ${edit ? editFields(r) : `${r.pageOnly ? '<p class="none">Printed as a page, exactly as scanned. Nothing was transcribed.</p>' : `
    <h3>Ingredients</h3><ul>${(r.ingredients ?? []).map(li).join('')}</ul>
    <h3>Directions</h3><ol>${(r.directions ?? []).map(li).join('')}</ol>
    ${r.yield ? `<h3>Yield</h3><p>${esc(r.yield)}</p>` : ''}
    ${r.story ? `<h3>Notes</h3><p>${esc(r.story)}</p>` : ''}`}
    <details class="prompts"${r.story ? '' : ' open'}><summary>${r.story ? 'Add more to the story?' : 'No family story yet.'}</summary>
      <p>Write it in your own words in <code>"story"</code>. The book prints it as you wrote it, in italics. You might say:</p>
      <ul>${STORY_PROMPTS.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></details>`}
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
  .prompts { margin-top: 1rem; color: #555; font-size: .92rem } .prompts summary { cursor: pointer; font-weight: 600 }
  .ok { color: #2e6b3a } .no { color: #a0522d } .none { color: #777; font-style: italic }
  .bar { position: sticky; top: 0; background: #fbf8f2; padding: .6rem 0; border-bottom: 1px solid #ddd; z-index: 2 } .bar button { font: 600 1rem sans-serif; padding: .45rem 1rem; background: #2f4a3a; color: #fff; border: 0; border-radius: 5px; cursor: pointer } #status { margin-left: .8rem; color: #555 }
  label { display: block; font: small-caps 600 .95rem sans-serif; letter-spacing: .08em; margin: .9rem 0 .2rem; color: #355 } textarea, input.yield { width: 100%; box-sizing: border-box; font: 15px/1.4 Georgia, serif; padding: .4rem .5rem; border: 1px solid #bbb; border-radius: 4px; background: #fff } .rev { margin-top: .9rem; display: block; font: 600 1rem sans-serif }
  @media (max-width: 700px) { .card { grid-template-columns: 1fr } }
</style>
${edit ? '<div class="bar"><button id="save" type="button">Save changes</button> <span id="status">Nothing changed yet.</span></div>' : ''}
<h1>${esc(title)}</h1>
<p class="lead">${todo.length ? `${todo.length} recipe${todo.length === 1 ? '' : 's'} read by the model still need checking.` : 'Nothing is waiting to be checked.'} Compare each scan with the text beside it, fix anything in family-recipes.json, then set <code>"reviewed": true</code>. Handwriting is the hardest thing to read: check every number.</p>
${recipes.map(card).join('\n')}
${edit ? EDIT_SCRIPT : ''}
</html>`;
}
