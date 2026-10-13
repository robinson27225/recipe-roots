import { regionOf, placeOf } from './regions.js';

const yearOf = (d) => {
  const y = parseInt(String(d ?? '').slice(0, 4), 10);
  return Number.isFinite(y) && y > 0 ? y : null;
};

export const displayName = (p) => {
  const last = p.LastNameAtBirth || p.LastNameCurrent || '';
  return [p.FirstName, p.MiddleName, last].filter(Boolean).join(' ').trim() || p.Name;
};

/** "mother", "grandfather", "great-grandmother", "2x great-grandfather"... */
export function relationLabel(gen, gender) {
  const g = gender === 'Female' ? 'mother' : gender === 'Male' ? 'father' : 'parent';
  if (gen <= 0) return 'you';
  if (gen === 1) return g;
  const base = g === 'parent' ? 'grandparent' : `grand${g}`;
  if (gen === 2) return base;
  if (gen === 3) return `great-${base}`;
  return `${gen - 2}x great-${base}`;
}

/** Generation number of every ancestor (root = 0) plus the child-in-line of each. */
export function generations(people, rootId) {
  return walk(people, rootId).gen;
}

function walk(people, rootId) {
  const gen = new Map([[rootId, 0]]);
  const childOf = new Map();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    const p = people.get(id);
    for (const parentId of [p?.Father, p?.Mother]) {
      if (parentId && people.has(parentId) && !gen.has(parentId)) {
        gen.set(parentId, gen.get(id) + 1);
        childOf.set(parentId, id);
        queue.push(parentId);
      }
    }
  }
  return { gen, childOf };
}

/**
 * Find individual moves between regions. Evidence is deliberately modest:
 *  - born in one region, died in another; or
 *  - born in one region, death unknown, but their child was born elsewhere.
 * Living people are never included.
 */
export function findMoves(people, rootId) {
  const { gen, childOf } = walk(people, rootId);
  const moves = [];
  for (const [id, g] of gen) {
    if (g === 0) continue;
    const p = people.get(id);
    if (!p || p.IsLiving === 1 || p.IsLiving === '1') continue;

    const from = regionOf(p.BirthLocation);
    const died = regionOf(p.DeathLocation);
    const child = people.get(childOf.get(id));
    const kidRegion = child ? regionOf(child.BirthLocation) : null;
    if (!from) continue;

    let to = null;
    let basis = '';
    if (died && died.key !== from.key) { to = died; basis = 'death'; }
    else if (!died && kidRegion && kidRegion.key !== from.key) { to = kidRegion; basis = 'child'; }
    if (!to) continue;

    const born = yearOf(p.BirthDate);
    const died_ = yearOf(p.DeathDate);
    const kidBorn = yearOf(child?.BirthDate);
    // Plausible window for the move; used only to place it in an era.
    let lo = born ? born + 16 : null;
    let hi = basis === 'child' ? kidBorn : (died_ ?? (born ? born + 60 : null));
    if (basis === 'death' && kidBorn && regionOf(child.BirthLocation)?.key === to.key && kidBorn < (hi ?? Infinity)) hi = kidBorn;
    if (lo && hi && lo > hi) lo = Math.max(hi - 10, born ?? hi - 10);
    if (!lo && hi) lo = hi - 15;
    if (lo && !hi) hi = lo + 15;
    if (!lo || !hi) continue; // can't place it in time

    moves.push({
      id, gen: g, from, to, basis, lo, hi, mid: Math.round((lo + hi) / 2),
      person: {
        id, wikiTreeId: p.Name, name: displayName(p), relation: relationLabel(g, p.Gender), gen: g,
        born: born, died: died_, birthPlace: placeOf(p.BirthLocation), deathPlace: placeOf(p.DeathLocation),
      },
    });
  }
  return moves;
}

/**
 * Cluster moves along the same corridor into stories: consecutive moves less than
 * 30 years apart, and no story spanning more than 45 years from its first move.
 * Returned closest-to-the-reader first; callers take what they need.
 */
export function buildStories(moves) {
  const byCorridor = new Map();
  for (const m of moves) {
    const k = `${m.from.key}>${m.to.key}`;
    (byCorridor.get(k) ?? byCorridor.set(k, []).get(k)).push(m);
  }
  const stories = [];
  for (const group of byCorridor.values()) {
    group.sort((a, b) => a.mid - b.mid);
    let cur = [];
    for (const m of group) {
      if (cur.length && (m.mid - cur[cur.length - 1].mid > 30 || m.mid - cur[0].mid > 45)) { stories.push(toStory(cur)); cur = []; }
      cur.push(m);
    }
    if (cur.length) stories.push(toStory(cur));
  }
  // Closest generation first (a great-grandmother's crossing beats a 1600s one), then bigger groups.
  stories.sort((a, b) => a.minGen - b.minGen || b.people.length - a.people.length || a.mid - b.mid);
  return stories.map((s, i) => ({ ...s, id: `story-${i + 1}` }));
}

function toStory(cluster) {
  const first = cluster[0];
  const lo = Math.min(...cluster.map((m) => m.lo));
  const hi = Math.max(...cluster.map((m) => m.hi));
  const mode = (arr) => [...arr.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return {
    from: first.from, to: first.to, lo, hi,
    mid: Math.round(cluster.reduce((s, m) => s + m.mid, 0) / cluster.length),
    originPlace: mode(cluster.map((m) => m.person.birthPlace).filter(Boolean)),
    destPlace: mode(cluster.map((m) => (m.basis === 'death' ? m.person.deathPlace : '')).filter(Boolean)),
    people: cluster.map((m) => m.person),
    minGen: Math.min(...cluster.map((m) => m.gen)),
  };
}

/** Every non-living ancestor with the WikiTree ID to use when assigning a recipe. */
export function listAncestors(people, rootId) {
  const { gen } = walk(people, rootId);
  return [...gen]
    .filter(([id, g]) => g > 0 && people.get(id) && !(people.get(id).IsLiving === 1 || people.get(id).IsLiving === '1'))
    .map(([id, g]) => {
      const p = people.get(id);
      return { wikiTreeId: p.Name, name: displayName(p), relation: relationLabel(g, p.Gender), gen: g, born: yearOf(p.BirthDate), died: yearOf(p.DeathDate), birthPlace: placeOf(p.BirthLocation) };
    })
    .sort((a, b) => a.gen - b.gen || a.name.localeCompare(b.name));
}
