// Primary profile photos from WikiTree, used beside a person's name in the book.
// Rights are the uploader's, not ours: every photo is credited to the profile it came
// from, living people are never fetched, and --no-photos turns the whole thing off.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { displayName } from './migrations.js';

const MAX_BYTES = 3 * 1024 * 1024;
const living = (p) => p?.IsLiving === 1 || p?.IsLiving === '1';

/** Absolute URL of the original primary photo, or null when the profile has none. */
export function photoUrl(person) {
  const p = person?.PhotoData?.path;
  return typeof p === 'string' && p.startsWith('/photo.php/') ? `https://www.wikitree.com${p}` : null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "1920-00-00" -> "1920", "1920-05-00" -> "May 1920", "0000-00-00" -> null. */
export function photoDate(d) {
  const m = String(d ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || m[1] === '0000') return null;
  const month = Number(m[2]), day = Number(m[3]);
  if (!month) return m[1];
  return day ? `${day} ${MONTHS[month - 1]} ${m[1]}` : `${MONTHS[month - 1]} ${m[1]}`;
}

const GENERIC = new Set(['image', 'photo', 'photograph', 'picture', 'pic', 'img', 'jpg', 'jpeg', 'png', 'scan', 'file', 'of', 'the']);

/** A title is worth printing only if something is left after removing the person's name and upload-default words ("Image 1"). */
function meaningfulTitle(title, name) {
  const t = String(title ?? '').trim();
  if (!t) return null;
  const nameWords = new Set(String(name).toLowerCase().split(/\s+/));
  const left = t.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((w) => w && !nameWords.has(w) && !GENERIC.has(w) && !/^\d+$/.test(w));
  return left.length ? t : null;
}

/** Caption from the photo's own WikiTree details: title (unless it just repeats the name), place, date. */
export function photoCaption(info, name) {
  if (!info) return '';
  const title = meaningfulTitle(info.title, name);
  return [title, info.location?.trim() || null, photoDate(info.date)].filter(Boolean).join(' · ');
}

/**
 * Details of the primary photo from the API's getPhotos: title, place, date and a 300px thumbnail
 * path. The photo page's comment and uploader are not available through the API, so they can't be
 * collected here. Any failure gives null: details are a bonus, never a requirement.
 */
export async function fetchPhotoInfo(person, { cacheDir = '.cache', fetchImpl = fetch } = {}) {
  const file = path.join(cacheDir, 'photos', `${person.Name.replace(/[^\w.-]/g, '_')}.info.json`);
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { /* not cached */ }
  try {
    const url = new URL('https://api.wikitree.com/api.php');
    url.search = new URLSearchParams({ action: 'getPhotos', key: person.Name, limit: '50', appId: 'RecipeRoots' });
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'RecipeRoots/0.1 (hacktoberfest side-hustle project)' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const photos = (await res.json())?.[0]?.photos ?? [];
    const hit = photos.find((x) => x.ImageName === person.Photo);
    if (!hit) return null;
    const url300 = typeof hit.URL_300 === 'string' && hit.URL_300.startsWith('/photo.php/') ? `https://www.wikitree.com${hit.URL_300}` : null;
    const info = { title: hit.Title ?? '', location: hit.Location ?? '', date: hit.Date ?? '', url300, pageUrl: typeof hit.URL === 'string' && hit.URL.startsWith('/photo/') ? hit.URL : null };
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(info));
    return info;
  } catch { return null; }
}

/** Fetch one person's primary photo as { uri, name, caption } (name = WikiTree ID for the credit), or null. */
export async function fetchPhoto(person, { cacheDir = '.cache', fetchImpl = fetch } = {}) {
  const original = photoUrl(person);
  if (!original || living(person)) return null;
  const info = await fetchPhotoInfo(person, { cacheDir, fetchImpl });
  const caption = photoCaption(info, displayName(person));
  const file = path.join(cacheDir, 'photos', `${person.Name.replace(/[^\w.-]/g, '_')}${path.extname(person.PhotoData.path) || '.jpg'}`);
  let bytes, type;
  try {
    bytes = await readFile(file);
    type = mimeFor(file);
  } catch {
    // Prefer the 300px thumbnail the API names (right size for print, a fraction of the bytes); fall back to the original.
    for (const url of [info?.url300, original].filter(Boolean)) {
      try {
        const res = await fetchImpl(url, { headers: { 'User-Agent': 'RecipeRoots/0.1 (hacktoberfest side-hustle project)' }, signal: AbortSignal.timeout(30_000) });
        const t = (res.headers.get('content-type') ?? '').split(';')[0];
        if (!res.ok || !t.startsWith('image/')) continue; // e.g. a bot-challenge or error page
        const b = Buffer.from(await res.arrayBuffer());
        if (b.length > MAX_BYTES || b.length === 0) continue;
        bytes = b; type = t;
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, bytes);
        break;
      } catch { /* try the next source */ }
    }
    if (!bytes) return null; // a missing photo must never break the book
  }
  return { uri: `data:${type};base64,${bytes.toString('base64')}`, name: person.Name, caption, pageUrl: info?.pageUrl ?? null };
}

const mimeFor = (f) => ({ '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[path.extname(f).toLowerCase()] ?? 'image/jpeg');

/** Photos for many people: Map<personId, { uri, name }>. Sequential, so we stay polite to WikiTree. */
export async function fetchPhotos(persons, opts) {
  const out = new Map();
  for (const p of persons) {
    if (!p || out.has(p.Id)) continue;
    const photo = await fetchPhoto(p, opts);
    if (photo) out.set(p.Id, photo);
  }
  return out;
}
