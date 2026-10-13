// Family-supplied recipes: the real thing, written by relatives, shown verbatim.
// The model never touches these. File format (JSON array):
//   { "title": "Beef Roll", "ancestor": "Robertson-21484",   // anyone in the family: great-aunts and uncles too "contributor": "Jo Smith",
//     "ingredients": ["1 lb beef", ...], "directions": "Mince the beef..." | ["step", ...],
//     "story": "optional: who made it, when you ate it",
//     "image": "scans/card.jpg"      (optional, relative to this file: printed as its own page)
//     "pageOnly": true               (optional: the scan IS the page; ingredients/directions not needed)
//     "category": "Soups & Stews"     (optional: file it under this chapter of the index; otherwise it is suggested from the title)
//     "showScan": false,           (optional: leave the scan out even though an image is given)
//     "source": "Find a Grave memorial 123, accessed 2023"   (optional: a citation printed under the recipe)
//     "permission": true                (optional: the person, or their family, agreed to be named. Needed for anyone
//                                      who is living or whose profile is private, who are otherwise left out)
//     "ancestorName": "Jean Smith"      (optional: the name to print when the profile can't be read; used with "permission")
//     "photoNote": "Taken at the farm, 1948" }   (optional: extra caption for the person's profile photo,
//                                      e.g. what the WikiTree photo page's comment says; the API can't supply that)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { dataUri } from './scan.js';
import { displayName } from './migrations.js';
import { resolvePerson } from './relatives.js';
import { CATEGORIES } from './categories.js';

export class FamilyRecipeError extends Error {}

export function parseFamilyRecipes(raw) {
  let data;
  try { data = JSON.parse(raw); } catch (e) { throw new FamilyRecipeError(`Family recipes file is not valid JSON: ${e.message}`); }
  if (!Array.isArray(data)) throw new FamilyRecipeError('Family recipes file must be a JSON array of recipes.');
  return data.map((r, i) => {
    const where = `Family recipe #${i + 1}${r?.title ? ` ("${r.title}")` : ''}`;
    if (!r || typeof r !== 'object') throw new FamilyRecipeError(`${where} must be an object.`);
    if (typeof r.title !== 'string' || !r.title.trim()) throw new FamilyRecipeError(`${where} needs a "title".`);
    r = { ...r, ancestor: r.ancestor ?? r.relative }; // "relative" is an accepted alias
    if (typeof r.ancestor !== 'string' || !r.ancestor.trim()) throw new FamilyRecipeError(`${where} needs an "ancestor" (or "relative"): the WikiTree ID of whoever it came from.`);
    const pageOnly = r.pageOnly === true;
    if (pageOnly && typeof r.image !== 'string') throw new FamilyRecipeError(`${where} is "pageOnly" but has no "image".`);
    const ingredients = pageOnly ? [] : r.ingredients ?? [];
    if (!Array.isArray(ingredients) || ingredients.some((x) => typeof x !== 'string')) throw new FamilyRecipeError(`${where}: "ingredients" must be a list of strings.`);
    const directions = pageOnly ? [] : Array.isArray(r.directions) ? r.directions : typeof r.directions === 'string' ? r.directions.split(/\n+/) : [];
    if (directions.some((x) => typeof x !== 'string')) throw new FamilyRecipeError(`${where}: "directions" must be text or a list of steps.`);
    // A free-form recipe may have only directions, or only ingredients; it needs at least something to print.
    if (!pageOnly && !ingredients.length && !directions.length) throw new FamilyRecipeError(`${where} needs "ingredients" and/or "directions" (or "pageOnly" with an "image").`);
    return {
      title: r.title.trim(), ancestor: r.ancestor.trim(), contributor: r.contributor?.trim() || null,
      ingredients: ingredients.map((x) => x.trim()).filter(Boolean),
      directions: directions.map((x) => x.trim()).filter(Boolean), story: r.story?.trim() || null,
      thirdParty: r.thirdParty === true, rightsHolder: r.rightsHolder && typeof r.rightsHolder === 'object' ? r.rightsHolder : null,
      permission: r.permission === true, suppliedName: typeof r.ancestorName === 'string' ? r.ancestorName.trim() || null : null,
      category: CATEGORIES.includes(r.category) ? r.category : null,
      source: typeof r.source === 'string' ? r.source.trim() || null : null,
      image: typeof r.image === 'string' ? r.image : null, photoNote: typeof r.photoNote === 'string' ? r.photoNote.trim() || null : null, pageOnly, showScan: r.showScan !== false,
      transcribedByAI: r.transcribedByAI === true, reviewed: r.reviewed === true,
    };
  });
}

/**
 * Attach each recipe to the person it belongs to: anyone in the ancestor line, or any public
 * relative (great-aunt, great-uncle...) looked up on demand. Returns { recipes, people } where
 * `people` includes any relatives fetched.
 *
 * Privacy: a person who is living, or whose profile can't be read (private, or a wrong ID), might be
 * living, so their recipe is left out unless it carries "permission": true. With permission it is kept
 * under the name supplied, without a fan chart or photo.
 */
export async function attachRelatives(recipes, people, rootId, { warn = () => {}, ...opts } = {}) {
  let all = people;
  const out = [];
  for (const r of recipes) {
    const hit = await resolvePerson(r.ancestor, all, rootId, opts);
    if (!hit) {
      if (!r.permission) {
        warn(`Left out "${r.title}": ${r.ancestor} is living, private or not found, so can't be confirmed as deceased. Add "permission": true (and "ancestorName") to the recipe if they or their family agreed to be named, or check the ID with \`recipe-roots ancestors <ID> --relatives\`.`);
        continue;
      }
      out.push({ ...r, person: null, ancestorName: r.suppliedName ?? r.ancestor, relation: null, direct: false });
      continue;
    }
    all = hit.people;
    // Some public profiles expose only a surname; a fuller name supplied with the recipe is better than "Estes".
    const shown = displayName(hit.person);
    const name = r.suppliedName && r.suppliedName.split(/\s+/).length > shown.split(/\s+/).length ? r.suppliedName : shown;
    out.push({ ...r, person: hit.person, ancestorName: name, relation: hit.relation, direct: hit.direct });
  }
  return { recipes: out, people: all };
}

export async function loadFamilyRecipes(file) {
  const recipes = parseFamilyRecipes(await readFile(file, 'utf8'));
  for (const r of recipes) {
    if (!r.image) continue;
    try { r.imageData = await dataUri(path.resolve(path.dirname(file), r.image)); }
    catch { throw new FamilyRecipeError(`Family recipe "${r.title}": can't read image ${r.image} (paths are relative to the recipes file).`); }
  }
  return recipes;
}

/**
 * The family's own words about the people who cooked: { "Smith-1234": { "story": "...", "photoNote": "..." } }.
 * Printed on that cook's opening page exactly as written; nothing is added to or changed in it.
 */
export function parseFamilyPeople(raw) {
  let data;
  try { data = JSON.parse(raw); } catch (e) { throw new FamilyRecipeError(`The family-people file is not valid JSON: ${e.message}`); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new FamilyRecipeError('The family-people file must be a JSON object keyed by WikiTree ID, like { "Smith-1234": { "story": "..." } }.');
  const out = {};
  for (const [id, note] of Object.entries(data)) {
    if (id.startsWith('_')) continue; // "_comment" and friends
    if (!note || typeof note !== 'object') throw new FamilyRecipeError(`family-people: "${id}" must be an object with a "story".`);
    const story = typeof note.story === 'string' ? note.story.trim() : '';
    const photoNote = typeof note.photoNote === 'string' ? note.photoNote.trim() : '';
    if (story || photoNote) out[id] = { story: story || null, photoNote: photoNote || null };
  }
  return out;
}

export async function loadFamilyPeople(file) {
  return parseFamilyPeople(await readFile(file, 'utf8'));
}
