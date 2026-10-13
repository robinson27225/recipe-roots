// Everything the model writes is checked against the facts we gave it. Small
// open-weight models are good storytellers and unreliable historians, so we
// reject drafts that introduce years or claim provenance we can't back up.

const YEAR = /(?<!\d)(1[0-9]{3}|20[0-9]{2})(?!\d)/g;

export function allowedYears(facts) {
  const years = new Set();
  const text = JSON.stringify(facts);
  for (const m of text.matchAll(YEAR)) {
    const y = Number(m[1]);
    years.add(y);
  }
  // "1890s" style references to a decade we were given are fine too.
  for (const y of [...years]) years.add(Math.floor(y / 10) * 10);
  return years;
}

// Things a small model tends to invent. Each is rejected outright: the page itself already
// shows kinship and sources, and the prose is only allowed to describe the move and the food.
const PROVENANCE = [
  /passed down/i, /handed down/i, /family recipe/i, /\btheir (?:own )?recipe\b/i,
  /\bsecret recipe\b/i, /\baboard\b/i, /\b(?:SS|S\.S\.|RMS|steamship) [A-Z]/,
  /\b(?:great-)*(?:grand(?:mother|father|parents?)|aunts?|uncles?|cousins?|nieces?|nephews?)\b/i, // kinship is listed on the page, not narrated
  /\bthis (?:cook)?book\b/i,            // no commentary about the book itself
  /\b(?:would|must) have\b/i,           // speculation stated as fact; "might have" is fine
  /\bto join (?:them|him|her|their)\b/i, // invented motives
];

export function validateText(text, years, { min = 0, max = Infinity, forbid = [] } = {}) {
  const problems = [];
  if (typeof text !== 'string' || !text.trim()) return { ok: false, problems: ['empty'] };
  if (/^\s*\d/.test(text)) problems.push('starts with a number');
  const words = text.trim().split(/\s+/).length;
  if (words < min) problems.push(`too short (${words} words)`);
  if (words > max) problems.push(`too long (${words} words)`);
  for (const m of text.matchAll(YEAR)) {
    if (!years.has(Number(m[1]))) problems.push(`unsupported year ${m[1]}`);
  }
  for (const w of forbid) if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) problems.push(`mentions "${w}", who it was never told about`);
  for (const re of PROVENANCE) if (re.test(text)) problems.push(`unsupported claim matching ${re}`);
  return { ok: problems.length === 0, problems };
}
