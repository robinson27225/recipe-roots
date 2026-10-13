// Period receipts are paragraphs. This puts one into a standard recipe layout (ingredients, then method) next
// to the verbatim original, without inventing anything:
//   1. A receipt that already opens with an ingredient list is reformatted deterministically: no AI, words unchanged.
//   2. A prose receipt is restructured by the model, then CHECKED against the original. Every quantity word and digit,
//      every ingredient word, and every step's food words must come from the original text, and no temperature,
//      time or ingredient may appear that the original doesn't give. Anything that fails is dropped, and the page
//      simply shows the original.
import { chatJson } from './llm.js';
import { tokens } from './period.js';

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'fifteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'half', 'halves', 'quarter', 'quarters', 'third', 'thirds', 'fourth', 'fourths', 'dozen', 'whole', 'double', 'few', 'several'];
const FRACTIONS = '¼½¾⅓⅔⅛';

/** Quantities in a text: digits, fractions and number words. The guard needs each of these to appear in the source. */
export function quantityTokens(text) {
  const t = String(text).toLowerCase();
  const out = new Set(t.match(new RegExp(`\\d+(?:[./]\\d+)?|[${FRACTIONS}]`, 'g')) ?? []);
  for (const w of t.split(/[^a-z]+/)) if (NUMBER_WORDS.includes(w)) out.add(w);
  return out;
}

// Words that carry no food: quantities' units, cooking verbs and glue. Anything else in a step must be in the source.
const GLUE = new Set(`a an the of and or to in on at by for with from into onto over under until till then when while as is are be it its they them this that these those which who whom there their
add adding mix mixed mixing stir stirred stirring beat beaten beating whisk fold folded place placed put set let leave remove removed take taken pour poured turn turned cover covered uncover drain drained dip dipped dish dressed serve served serving hot cold warm lukewarm boiling boil boiled simmer simmered cook cooked cooking bake baked baking fry fried frying roast roasted brown browned golden toast toasted melt melted heat heated warm cool cooled chill chilled strain strained press pressed roll rolled cut slice sliced chop chopped mince minced peel peeled core cored pare pared grate grated wash washed wipe wiped dry dried soak soaked sift sifted rub rubbed knead kneaded shape shaped fill filled spread spreads season seasoned sprinkle sprinkled lay laid arrange arranged repeat prepare prepared combine combined blend blended continue continued keep kept bring brought reduce reduced skim skimmed taste tasted
pan saucepan pot kettle bowl dish plate platter oven fire stove table mould mold spoon fork knife sieve cloth paper board tin pie crust
minute minutes hour hours second seconds time times side sides top bottom edge edges centre center middle part parts piece pieces each both all half other another same more less enough little much many well very quite just now once twice again also
gently briskly slowly quickly thoroughly lightly gradually constantly occasionally often lightly nicely fresh sound good large small medium thick thin tender soft hard stiff smooth thick light dark rich clean
ounce ounces pint pints quart quarts gill gills cup cups teaspoon teaspoons tablespoon tablespoons pound pounds saltspoon saltspoons spoonful spoonfuls pinch handful bunch clove cloves slice slices
too not no nor so if but than that about around above below through between during before after`.split(/\s+/).map((w) => w.replace(/s$/, '')));
const stemmed = (w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (text) => String(text).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').split(/[^a-z]+/).filter((w) => w.length >= 3).map(stemmed);

/** Check a structured version against the original receipt text. Returns { ok, problems }. */
export function checkAgainstSource(structured, source) {
  const problems = [];
  const src = String(source);
  const srcWords = new Set(words(src));
  const srcQty = quantityTokens(src);
  const all = [...structured.ingredients, ...structured.steps, ...(structured.notes ?? [])];
  if (!structured.ingredients.length) problems.push('no ingredients');
  if (!structured.steps.length) problems.push('no steps');
  for (const q of quantityTokens(all.join(' '))) if (!srcQty.has(q)) problems.push(`quantity "${q}" is not in the original`);
  for (const line of all) {
    if (/°|degrees?\b/i.test(line) && !/°|degrees?\b/i.test(src)) problems.push('a temperature the original does not give');
  }
  for (const line of structured.ingredients) {
    const foreign = words(line).filter((w) => !srcWords.has(w) && !GLUE.has(w) && !NUMBER_WORDS.includes(w));
    if (foreign.length) problems.push(`ingredient "${line}" uses words not in the original: ${foreign.join(', ')}`);
  }
  for (const line of structured.steps) {
    const foreign = words(line).filter((w) => !srcWords.has(w) && !GLUE.has(w) && !NUMBER_WORDS.includes(w));
    if (foreign.length > 1) problems.push(`step "${line.slice(0, 50)}" uses words not in the original: ${foreign.join(', ')}`);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Formatting only, never content: a step starts with a capital and ends with a full stop; an ingredient has no bullet,
 * number or trailing punctuation. Models routinely leave these off, and that is not a reason to discard a good answer.
 */
/**
 * "The original gives no oven temperature." + "The original gives no baking time." become one sentence:
 * "The original gives no oven temperature or baking time." Other notes are kept as they are.
 */
export function mergeGapNotes(notes) {
  const gap = /^The original (?:gives|states|specifies|mentions|provides) no (.+?)[.]?$/i;
  const missing = [];
  const rest = [];
  for (const n of notes) {
    const m = n.trim().match(gap);
    if (m) { const item = m[1].trim().replace(/\s+/g, ' '); if (!missing.some((x) => x.toLowerCase() === item.toLowerCase())) missing.push(item); }
    else rest.push(n);
  }
  if (!missing.length) return rest;
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} or ${missing.at(-1)}`;
  return [`The original gives no ${list}.`, ...rest];
}

export function tidyStructured(s, source = '') {
  const step = (t) => { const x = String(t).trim().replace(/^[-•*\d.)\s]+(?=[A-Za-z])/, ''); if (!x) return ''; const y = x[0].toUpperCase() + x.slice(1); return /[.!?]["”’)]?$/.test(y) ? y : `${y}.`; };
  const ing = (t) => String(t).trim().replace(/^[-•*\d.)\s]+(?=[A-Za-z])/, '').replace(/[.;,]+$/, '');
  // Equipment is not an ingredient ("a hot dish", "six very hot egg dishes", "a folded napkin").
  const equipment = /\b(dish(?:es)?|pan|bowl|saucepan|plate|platter|napkin|mould|mold|spoon|skimmer|sieve|cloth)\s*$/i;
  const notesAll = (s.notes ?? []).map(step).filter(Boolean);
  // A note is a statement about what the ORIGINAL leaves out. Anything else the model put there is method: move it into the steps.
  const isGap = (n) => /^The original\b/i.test(n);
  // "No oven temperature" / "no cooking time" are only worth saying when the receipt bakes or cooks in an oven.
  const oven = /\boven\b|\bbak(e|ed|ing)\b/i.test(source);
  const notes = mergeGapNotes(notesAll.filter(isGap).filter((n) => oven || !/oven temperature|baking time|cooking time/i.test(n)));
  return {
    ...s,
    ingredients: s.ingredients.map(ing).filter((t) => t && !equipment.test(t)),
    steps: [...s.steps.map(step).filter(Boolean), ...notesAll.filter((n) => !isGap(n))],
    notes,
  };
}

/**
 * Is this a recipe someone could use, beyond being faithful? Steps must be short sentences (not the whole receipt pasted
 * back as one line), must not repeat, and there must be more than one of them for a receipt of any length.
 */
export function qualityProblems(structured, source) {
  const problems = [];
  const sourceWords = String(source).split(/\s+/).length;
  const seen = new Set();
  for (const step of structured.steps) {
    const n = step.trim().split(/\s+/).length;
    if (!/^[A-Z"“(]/.test(step.trim()) || !/[.!?]["”)]?$/.test(step.trim())) problems.push(`step "${step.slice(0, 40)}" isn't a complete sentence (capital letter first, full stop last)`);
    if (n > 32) problems.push('a step is too long: split the method into short steps');
    const key = step.toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (seen.has(key)) problems.push('a step is repeated');
    seen.add(key);
  }
  if (sourceWords > 40 && structured.steps.length < 3) problems.push('too few steps for a receipt this long');
  for (const line of structured.ingredients) if (line.trim().split(/\s+/).length > 14) problems.push(`ingredient "${line.slice(0, 40)}" is a sentence, not an ingredient`);
  // The same words repeated again and again at the start of steps ("place in a small saucepan ... place in a small saucepan ...")
  const starts = structured.steps.map((s) => s.trim().split(/\s+/).slice(0, 4).join(' ').toLowerCase());
  if (new Set(starts).size < starts.length) problems.push('steps start with the same words; write each step once');
  return problems;
}

/** Rebuild lines from an excerpt: a list-like first paragraph (one item per line) followed by method paragraphs. */
export function structureFromList(quote) {
  const paras = quote.split(/\n\n/);
  const first = paras[0].split('\n');
  if (first.length < 2 || first.some((l) => l.length > 60)) return null; // not a list
  const steps = paras.slice(1).join(' ').replace(/\s*…\s*$/, '').split(/(?<=[.;])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  if (!steps.length) return null;
  return { ingredients: first.map((l) => l.trim()).filter(Boolean), steps, notes: [], how: 'list' };
}

const SYSTEM = `You turn an old cookery receipt into a standard recipe layout, without changing it.
Rules:
- Use ONLY ingredients, quantities and instructions that are in the receipt. Never add, substitute or "improve" anything.
- Copy quantities exactly as the receipt words them ("two ounces", "half a pint", "a gill", "one saltspoon"). Do NOT convert units, and do NOT write digits unless the receipt does.
- Do not add temperatures, oven settings or timings the receipt doesn't give. If something important is left out (no oven temperature, no cooking time), say so in "notes" ("The original gives no oven temperature").
- Keep ingredient names as the receipt names them.
- Write 3 to 8 steps. EACH step is one short, complete sentence that starts with a capital letter and ends with a full stop (at most about 25 words). Do not copy the whole receipt into one step, and never repeat a step.
- Ingredients are short noun phrases ("one pound finely chopped cheese"), not sentences.
Return JSON only: {"ingredients": [string, ...], "steps": [string, ...], "notes": [string, ...]}
One ingredient per item, in the order used. Steps are short sentences in the order done.`;

/**
 * A structured version of a period receipt, or null. `quote` is the verbatim excerpt that will be printed.
 * `how` is 'list' (reformatted deterministically) or 'model' (restructured by the model and verified).
 */
export async function structureReceipt(quote, { llm, offline = false, log = () => {} } = {}) {
  const fromList = structureFromList(quote);
  if (fromList) return fromList;
  if (offline || !llm) return null;
  const source = quote.replace(/\s*…\s*$/, '');
  // A receipt that was cut short (by our own length limit, or by a page break in the scan) can't become a complete recipe.
  if (/…\s*$/.test(quote) || !/[.!?]["”’)]?\s*$/.test(source.trim())) return null;
  let feedback = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = await chatJson(llm, [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Receipt:\n${source}${feedback}` },
      ], { temperature: 0.2 });
      const s = tidyStructured({ ingredients: (out.ingredients ?? []).map(String), steps: (out.steps ?? []).map(String), notes: (out.notes ?? []).map(String) }, source);
      const check = checkAgainstSource(s, source);
      const quality = check.ok ? qualityProblems(s, source) : [];
      if (check.ok && !quality.length) return { ...s, how: 'model' };
      check.problems.push(...quality);
      log(`    structured version rejected (${check.problems.slice(0, 2).join('; ')})`);
      feedback = `\n\nYour last answer was rejected: ${check.problems.slice(0, 4).join('; ')}. Use only what the receipt says, with its own number words, and try again.`;
    } catch (e) { log(`    structuring failed: ${e.message}`); }
  }
  return null;
}
