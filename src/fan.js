// A WikiTree-cookbook-style fan chart: the ancestor at the centre, parents in
// the first ring, grandparents in the second. Built from the tree we already
// fetched, as an SVG string (no dependencies).
import { displayName } from './migrations.js';
import { placeOf } from './regions.js';

const yr = (d) => { const y = parseInt(String(d ?? '').slice(0, 4), 10); return y > 0 ? y : null; };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function cell(p) {
  if (!p || p.IsLiving === 1 || p.IsLiving === '1') return null; // living people never appear
  const b = yr(p.BirthDate), d = yr(p.DeathDate);
  return {
    name: displayName(p),
    years: b || d ? `${b ? `b. ${b}` : ''}${b && d ? '  ' : ''}${d ? `d. ${d}` : ''}` : '',
    place: placeOf(p.BirthLocation).split(',')[0] ?? '',
  };
}

/** [ancestor, father, mother, FF, FM, MF, MM], each a cell or null (unknown/private). */
export function pedigree(people, id) {
  const get = (x) => (x ? people.get(x) : null);
  const root = get(id);
  if (!root) return null;
  const f = get(root.Father), m = get(root.Mother);
  const gp = [get(f?.Father), get(f?.Mother), get(m?.Father), get(m?.Mother)];
  return [root, f, m, ...gp].map(cell);
}

const wrap = (text, max) => {
  const lines = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
};

const CX = 300, CY = 312;
const pt = (r, deg) => [CX + r * Math.cos((deg * Math.PI) / 180), CY - r * Math.sin((deg * Math.PI) / 180)];

function sector(r0, r1, a0, a1) { // degrees, a0 > a1, measured counter-clockwise from +x
  const [x1, y1] = pt(r1, a0), [x2, y2] = pt(r1, a1), [x3, y3] = pt(r0, a1), [x4, y4] = pt(r0, a0);
  return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r1},${r1} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)} L${x3.toFixed(1)},${y3.toFixed(1)} A${r0},${r0} 0 0 0 ${x4.toFixed(1)},${y4.toFixed(1)} Z`;
}

function label(c, x, y, rot, max, size) {
  if (!c) return `<text x="${x}" y="${y}" transform="rotate(${rot.toFixed(1)} ${x} ${y})" text-anchor="middle" class="fan-unk" font-size="${size}">unknown</text>`;
  const lines = [...wrap(c.name, max), c.years, c.place].filter(Boolean);
  const lh = size * 1.25;
  const y0 = y - ((lines.length - 1) * lh) / 2;
  const tspans = lines.map((t, i) => `<tspan x="${x}" y="${(y0 + i * lh).toFixed(1)}" class="${i === 0 || i < lines.length - 2 ? 'fan-n' : 'fan-s'}">${esc(t)}</tspan>`).join('');
  return `<text transform="rotate(${rot.toFixed(1)} ${x} ${y})" text-anchor="middle" font-size="${size}">${tspans}</text>`;
}

export function fanChartSvg(cells) {
  if (!cells) return '';
  const [me, ...rest] = cells;
  const fills1 = ['#cfe8e3', '#fbf1c4'];
  const fills2 = ['#bddcd3', '#c9e3b8', '#fbe3a9', '#f6cfae'];
  const parts = [];

  // outer ring: grandparents, radial text
  for (let i = 0; i < 4; i++) {
    const a0 = 180 - i * 45, a1 = a0 - 45, m = (a0 + a1) / 2;
    const c = rest[2 + i];
    parts.push(`<path d="${sector(152, 292, a0, a1)}" fill="${c ? fills2[i] : '#f1eee6'}" ${c ? '' : 'stroke-dasharray="4 3"'} class="fan-cell"/>`);
    const [x, y] = pt(222, m);
    const rot = m > 90 ? 180 - m : -m;
    parts.push(label(c, x.toFixed(1), y.toFixed(1), rot, 17, 11));
  }
  // inner ring: parents, tangential text
  for (let i = 0; i < 2; i++) {
    const a0 = 180 - i * 90, a1 = a0 - 90, m = (a0 + a1) / 2;
    const c = rest[i];
    parts.push(`<path d="${sector(54, 150, a0, a1)}" fill="${c ? fills1[i] : '#f1eee6'}" ${c ? '' : 'stroke-dasharray="4 3"'} class="fan-cell"/>`);
    const [x, y] = pt(102, m);
    parts.push(label(c, x.toFixed(1), y.toFixed(1), 90 - m, 14, 12));
  }
  // centre
  parts.push(`<circle cx="${CX}" cy="${CY}" r="52" fill="#e5f1df" class="fan-cell"/>`);
  parts.push(label(me, CX, CY - 12, 0, 13, 11.5));

  return `<svg class="fan" viewBox="0 0 600 368" role="img" aria-label="Fan chart of ${esc(me?.name)}">
<style>.fan-cell{stroke:#fff;stroke-width:2}.fan-n{font-weight:600;fill:#2b2a27}.fan-s{fill:#4d4a41;font-size:.88em}.fan-unk{fill:#9a9486;font-style:italic}</style>
${parts.join('\n')}</svg>`;
}
