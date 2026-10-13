// The user's own family photos. File names carry the WikiTree ID of the person pictured:
//   my-photos/Smith-1234.jpg      or      my-photos/Smith-1234__at-the-farm-1948.jpg
// These are the user's own, so they are never gated, and they take priority over WikiTree's photo.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { isWikiTreeId } from './wikitree.js';
import { shrink, dataUri } from './scan.js';

const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** "Smith-1234.jpg" / "Smith-1234__at-the-farm.jpg" -> { id, note }, else null. */
export function parsePhotoName(file) {
  const base = path.basename(file, path.extname(file));
  const m = base.match(/^(.+?-\d+)(?:__|--)(.*)$/) ?? base.match(/^(.+?-\d+)()$/);
  if (!m || !isWikiTreeId(m[1])) return null;
  return { id: m[1], note: m[2].replace(/[-_]+/g, ' ').trim() };
}

/** Map<personId, { uri, name, caption, credit }> for every photo whose person is in `people`. */
export async function loadMyPhotos(dir, people, { cacheDir = '.cache', warn = () => {} } = {}) {
  const byName = new Map([...people.values()].map((p) => [p.Name, p]));
  const out = new Map();
  for (const f of (await readdir(dir)).sort()) {
    if (!EXT.has(path.extname(f).toLowerCase())) continue;
    const parsed = parsePhotoName(f);
    if (!parsed) { warn(`Skipped ${f}: name it after the person's WikiTree ID, like Smith-1234.jpg`); continue; }
    const person = byName.get(parsed.id);
    if (!person) { warn(`Skipped ${f}: ${parsed.id} isn't in the tree being built.`); continue; }
    if (out.has(person.Id)) continue; // first photo for a person wins
    const small = await shrink(path.join(dir, f), path.join(cacheDir, 'my-photos', `${parsed.id}.jpg`), 600);
    out.set(person.Id, { uri: await dataUri(small), name: parsed.id, caption: parsed.note, credit: 'family collection', personal: true });
  }
  return out;
}
