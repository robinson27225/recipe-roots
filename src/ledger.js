// permissions.md: a plain list of every third-party photo and recipe in a finished book, with the
// owner and where it came from, so the person selling the book knows exactly whom to ask.

export function buildLedger({ me, honorCodeAttested, photos = [], recipes = [], date = new Date() }) {
  if (!photos.length && !recipes.length) return null;
  const day = date.toISOString().slice(0, 10);
  const lines = [
    '# Permissions to obtain before selling this book',
    '',
    `Built ${day}${me ? ` by WikiTree member ${me}` : ''}.`,
    `Honor Code (Wiki Genealogist) status: ${honorCodeAttested ? 'attested by the user; not verifiable through WikiTree\'s API' : 'not attested'}.`,
    'The user confirmed they have permission from each owner below. This list is a record of what needs it; it is not the permission itself.',
    '',
  ];
  if (recipes.length) {
    lines.push('## Recipes', '');
    for (const r of recipes) lines.push(`- **${r.title}**: written by ${r.rightsHolder?.name ?? 'a WikiTree member'}${r.rightsHolder?.id ? ` (https://www.wikitree.com/wiki/${r.rightsHolder.id})` : ''}. Source: ${r.source ?? 'WikiTree'}.`);
    lines.push('');
  }
  if (photos.length) {
    lines.push('## Photos', '', 'WikiTree photos belong to whoever uploaded them. The API does not name the uploader: the photo page does.', '');
    for (const p of photos) lines.push(`- ${p.person}: https://www.wikitree.com${p.pageUrl ?? `/wiki/${p.name}`} (profile ${p.name})`);
    lines.push('');
  }
  return lines.join('\n');
}
