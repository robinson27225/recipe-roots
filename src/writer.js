import { chatJson } from './llm.js';
import { allowedYears, validateText } from './guard.js';
import { contextFor, regionLabel as regionLabelOf } from './pantry.js';
import { kitchenHistory } from './history.js';

// Division of labour, learned the hard way with a 4B model: code writes every fact about
// people (names, places, years, kinship) straight from the tree, and the model writes only
// about the FOOD. It is never shown a person's name, so it has nothing to invent a biography from.
const SYSTEM = `You write a short passage about the food of a place and era for a family cookbook, using only the facts you are given.

Rules you must follow:
- Use ONLY the places, years, background notes and recipe notes provided. Never invent facts.
- Years: only use years that appear in the facts.
- Write about the food and kitchens of the era in general ("families from Poland often cooked...", "kitchens of the time..."). Do not describe any particular person or what anyone felt, saw, met or why they moved.
- Be tentative about the past ("often", "might have"), never "would have" or "must have".
- A recipe marked neighbouringCuisine is a stand-in from another tradition because the book has no dish on file from the family's homeland: say so plainly and never imply the homeland cooked it.
- kitchenHistory lists broad background about food in those years. You may use at most one item from it, in its own words and with its own years.
- Never begin with a year or a number, never write about the book itself, and do not mention relatives of any kind.
- Plain, concrete language. No clichés about "rich tapestries".

Return JSON only: {"food_passage": string (70-120 words, one paragraph), "headnotes": {"<recipe id>": string (40-70 words)}}.`;

const firstPart = (place) => (place ? place.split(',')[0].trim() : null);

/** What the model is shown: places, window, background and recipes. No people at all. */
export function factsFor(story, recipes) {
  return {
    route: { from: story.from.label, to: story.to.label, originPlace: firstPart(story.originPlace), destinationPlace: firstPart(story.destPlace) },
    approximateWindow: [story.lo, story.hi],
    background: contextFor(story),
    kitchenHistory: kitchenHistory({ lo: story.lo - 10, hi: story.hi + 10, regionKeys: [story.from.key, story.to.key] }).map((h) => h.text),
    recipes: recipes.map((r) => ({ id: r.id, name: r.name, from: r.neighbour ? regionLabelOf(r.region) : r.side === 'origin' ? story.from.label : story.to.label, neighbouringCuisine: Boolean(r.neighbour), note: r.note })),
  };
}

const list = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr.at(-1)}`);
const NAME_CAP = 3;

/** The factual paragraph about the people, built from the tree with no model involved. */
export function peopleParagraph(story) {
  const shown = story.people.slice(0, NAME_CAP).map((p) => `${p.name} (${p.relation}${p.born ? `, born ${p.born}` : ''})`);
  const rest = story.people.length - NAME_CAP;
  const names = list(rest > 0 ? [...shown, `${rest} other relative${rest > 1 ? 's' : ''}`] : shown);
  const where = story.originPlace || story.from.label;
  const there = story.destPlace || story.to.label;
  return `Records on WikiTree place ${names} in ${where} at the start of this story, and later in ${there}. The move happened sometime between ${story.lo} and ${story.hi}; the records don't say exactly when.`;
}

export function templateFood(story) {
  const ctx = contextFor(story);
  return `${ctx ? ctx + ' ' : ''}The recipes in this chapter are traditional dishes from ${story.from.label} and ${story.to.label} in those years. They are not recorded family recipes, but they are the kinds of meals families like this one might have cooked.`;
}

export function templateChapter(story, recipes) {
  return { intro: `${peopleParagraph(story)}\n\n${templateFood(story)}`, headnotes: Object.fromEntries(recipes.map((r) => [r.id, r.note])) };
}

/** Draft the food passage and headnotes with the model; anything it can't get right falls back to templates. */
export async function writeChapter(story, recipes, { llm, offline = false, log = () => {} } = {}) {
  const people = peopleParagraph(story);
  const fallback = templateChapter(story, recipes);
  if (offline) return { ...fallback, source: 'template' };

  const facts = factsFor(story, recipes);
  const years = allowedYears(facts);
  // Names must never appear in model text: it was not given any, so a name means it made something up.
  const forbid = story.people.flatMap((p) => p.name.split(/\s+/)).filter((w) => w.length > 3);
  let passage = null;
  const notes = {};
  let feedback = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = await chatJson(llm, [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Facts:\n${JSON.stringify(facts, null, 2)}${feedback}` },
      ]);
      const problems = [];
      // Keep every part that passes; only the failures fall back to templates.
      if (!passage) {
        const v = validateText(out.food_passage, years, { min: 40, max: 170, forbid });
        if (v.ok) passage = out.food_passage.trim(); else problems.push(...v.problems.map((p) => `passage: ${p}`));
      }
      for (const r of recipes.filter((r) => !notes[r.id])) {
        const v = validateText(out.headnotes?.[r.id], years, { min: 15, max: 110, forbid });
        if (v.ok) notes[r.id] = out.headnotes[r.id].trim(); else problems.push(...v.problems.map((p) => `headnote ${r.id}: ${p}`));
      }
      if (!problems.length) break;
      log(`  attempt ${attempt} rejected: ${problems.join('; ')}`);
      feedback = `\n\nSome parts of your previous draft were rejected: ${problems.join('; ')}. Write the whole JSON again and fix them. Every recipe id needs a headnote.`;
    } catch (e) {
      log(`  attempt ${attempt} failed: ${e.message}`);
    }
  }
  const got = (passage ? 1 : 0) + recipes.filter((r) => notes[r.id]).length;
  return {
    intro: `${people}\n\n${passage ?? templateFood(story)}`,
    headnotes: Object.fromEntries(recipes.map((r) => [r.id, notes[r.id] ?? r.note])),
    // 'model' = all model-written parts passed; 'mixed' = some did; 'template' = none.
    source: got === 1 + recipes.length ? 'model' : got === 0 ? 'template' : 'mixed',
  };
}
