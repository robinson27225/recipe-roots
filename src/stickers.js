// WikiTree "stickers" are templates on a profile ("Scotland Sticker", "Jewish Roots Sticker", a "Religion Project"
// entry...) that the community adds on purpose; the API returns them as the profile's `Templates`. They are an
// explicit, structured statement about heritage, which is better than guessing from a place name.
//
// How they are used here, and nothing more: to choose period cookbooks for a chapter (a "Jewish Roots" sticker
// offers The International Jewish Cook Book; an Amish/Mennonite or Pennsylvania German sticker offers
// Pennsylvania Dutch Cooking). Only deceased people in the chapters are looked at. Religion is never printed:
// the only trace in the book is the title of the cookbook quoted. `--no-stickers` turns it all off.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.wikitree.com/api.php';
const living = (p) => p?.IsLiving === 1 || p?.IsLiving === '1';

/** A profile's templates, [{ name, params }], or null (living, unreadable, or the API is down). */
export async function fetchStickers(person, { cacheDir = '.cache', fetchImpl = fetch } = {}) {
  if (!person?.Name || living(person)) return null;
  const file = path.join(cacheDir, 'stickers', `${person.Name.replace(/[^\w.-]/g, '_')}.json`);
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { /* not cached */ }
  try {
    const url = new URL(API);
    url.search = new URLSearchParams({ action: 'getProfile', key: person.Name, fields: 'Name,Templates,IsLiving', appId: 'RecipeRoots' });
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'RecipeRoots/0.1 (hacktoberfest side-hustle project)' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const profile = (await res.json())?.[0]?.profile;
    if (!profile || living(profile)) return null;
    const templates = Array.isArray(profile.Templates) ? profile.Templates.map((t) => ({ name: String(t.name), params: t.params ?? {} })) : [];
    try { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(templates)); } catch { /* uncached is fine */ }
    return templates;
  } catch { return null; }
}

// "Scotland Sticker" -> scotland, etc. (WikiTree's National heritage stickers; see Template:Scotland_Sticker).
const COUNTRIES = {
  scotland: 'scotland', england: 'england', wales: 'wales', ireland: 'ireland', 'northern ireland': 'ireland',
  germany: 'germany', italy: 'italy', poland: 'poland', sweden: 'sweden', norway: 'norway', denmark: 'denmark',
  finland: 'finland', netherlands: 'netherlands', france: 'france', switzerland: 'switzerland', austria: 'austria',
  hungary: 'hungary', russia: 'russia', ukraine: 'ukraine', lithuania: 'lithuania', portugal: 'portugal',
  spain: 'spain', greece: 'greece', mexico: 'mexico', canada: 'canada', quebec: 'quebec',
};

/**
 * What a profile's stickers say.
 *   regions: region keys from national stickers (the person has roots in or was born in these)
 *   tags:    'jewish' (Jewish Roots sticker, or a Religion Project entry saying so) and
 *            'pennsylvania-german' (a Pennsylvania German sticker, or Amish/Mennonite)
 *   notes:   plain-language reasons, for the build log
 */
export function stickerSignals(templates) {
  const regions = new Set();
  const tags = new Set();
  const notes = [];
  for (const t of templates ?? []) {
    const name = t.name.trim();
    const national = name.match(/^(.+?) Sticker$/i);
    if (national && COUNTRIES[national[1].toLowerCase()]) { regions.add(COUNTRIES[national[1].toLowerCase()]); notes.push(`${name}`); continue; }
    if (/jewish roots/i.test(name)) { tags.add('jewish'); notes.push(name); continue; }
    if (/pennsylvania (german|dutch)/i.test(name)) { tags.add('pennsylvania-german'); notes.push(name); continue; }
    if (/^religion project$/i.test(name)) {
      const religion = String(t.params?.religion ?? '');
      if (/jew/i.test(religion)) { tags.add('jewish'); notes.push('Religion Project (Jewish)'); }
      else if (/amish|mennonite/i.test(religion)) { tags.add('pennsylvania-german'); notes.push(`Religion Project (${religion})`); }
    }
  }
  return { regions, tags, notes };
}

/** The union of signals over a chapter's people, plus a log line saying what was found and on whom. */
export async function storySignals(story, people, opts) {
  const tags = new Set();
  const regions = new Set();
  const found = [];
  for (const p of story.people) {
    const templates = await fetchStickers(people.get(p.id), opts);
    if (!templates) continue;
    const s = stickerSignals(templates);
    s.tags.forEach((t) => tags.add(t));
    s.regions.forEach((r) => regions.add(r));
    if (s.tags.size) found.push(`${p.name}: ${s.notes.join(', ')}`);
  }
  return { tags, regions, found };
}
