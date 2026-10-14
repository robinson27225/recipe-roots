import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.wikitree.com/api.php';
export const FIELDS = [
  'Id', 'Name', 'FirstName', 'MiddleName', 'LastNameAtBirth', 'LastNameCurrent',
  'BirthDate', 'BirthDateDecade', 'BirthLocation', 'DeathDate', 'DeathLocation',
  'Gender', 'Father', 'Mother', 'IsLiving', 'Photo', 'PhotoData',
].join(',');
const DAY = 24 * 60 * 60 * 1000;

export class WikiTreeError extends Error {}

/** WikiTree IDs look like Surname-123 (or Surname_Suffix-123). */
export const isWikiTreeId = (s) => /^[\p{L}][\p{L}\p{N}_'.-]*-\d+$/u.test(s ?? '');

/**
 * Fetch a profile and its ancestors from the public WikiTree API.
 * Returns { rootId, people: Map<id, person> }. Responses are cached on disk
 * for a day so repeated runs are polite to WikiTree.
 */
export async function fetchAncestry(wikiTreeId, { generations = 6, cacheDir = '.cache', fetchImpl = fetch } = {}) {
  if (!isWikiTreeId(wikiTreeId)) {
    throw new WikiTreeError(`"${wikiTreeId}" doesn't look like a WikiTree ID (expected something like Windsor-1).`);
  }
  const depth = Math.min(Math.max(generations, 1), 10);
  const cacheFile = path.join(cacheDir, `${wikiTreeId}.${depth}.v3.json`);

  let body = await readCache(cacheFile);
  if (!body) {
    const url = new URL(API);
    url.search = new URLSearchParams({
      action: 'getPeople', keys: wikiTreeId, ancestors: String(depth), fields: FIELDS, appId: 'RecipeRoots',
    });
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': 'RecipeRoots/0.1 (hacktoberfest side-hustle project)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new WikiTreeError(`WikiTree API returned HTTP ${res.status}.`);
    body = await res.json();
    const parsed = parseAncestry(body, wikiTreeId); // throws on an error response, so only good answers are cached
    try { // the cache is a courtesy to WikiTree: failing to write it must never fail the run
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cacheFile, JSON.stringify({ __cachedAt: Date.now(), body }));
    } catch { /* read-only or missing folder: carry on uncached */ }
    return parsed;
  }
  return parseAncestry(body, wikiTreeId);
}

export function parseAncestry(body, wikiTreeId) {
  const result = Array.isArray(body) ? body[0] : body;
  if (result?.status) throw new WikiTreeError(`WikiTree says: ${result.status}`);
  const hit = result?.resultByKey?.[wikiTreeId];
  const rootId = hit?.Id;
  if (hit?.status && /permission denied/i.test(hit.status)) {
    throw new WikiTreeError(`${wikiTreeId} isn't open to the public API (WikiTree says: "${hit.status}"). Only profiles with public ancestry can be read without logging in.`);
  }
  if (!rootId || !result.people?.[rootId]) {
    throw new WikiTreeError(`No public profile found for ${wikiTreeId}. Check the spelling, e.g. Windsor-1.`);
  }
  const people = new Map(Object.values(result.people).map((p) => [p.Id, p]));
  return { rootId, people };
}

async function readCache(file) {
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    return Date.now() - raw.__cachedAt < DAY ? raw.body : null;
  } catch { return null; }
}
