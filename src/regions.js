// Maps free-text WikiTree locations ("Cork, County Cork, Ireland") onto coarse
// culinary/migration regions. US places resolve to a macro-region so that
// westward and northward moves inside the country are visible too.

const R = (label, aliases) => ({ label, aliases });

export const REGIONS = {
  ireland: R('Ireland', ['Ireland', 'Northern Ireland', 'Eire']),
  england: R('England', ['England', 'Cornwall', 'Yorkshire', 'Lancashire', 'Devon', 'Kent']),
  scotland: R('Scotland', ['Scotland']),
  wales: R('Wales', ['Wales']),
  germany: R('Germany', ['Germany', 'Deutschland', 'Prussia', 'Bavaria', 'Baden', 'Wurttemberg', 'Württemberg', 'Hesse', 'Hessen', 'Saxony', 'Hanover', 'Rhineland', 'Westphalia', 'Pomerania', 'Mecklenburg', 'Oldenburg', 'Schleswig-Holstein', 'Palatinate']),
  italy: R('Italy', ['Italy', 'Italia', 'Sicily', 'Sardinia', 'Calabria', 'Campania', 'Lombardy', 'Tuscany', 'Piedmont', 'Veneto', 'Abruzzo', 'Naples']),
  poland: R('Poland', ['Poland', 'Polska']),
  sweden: R('Sweden', ['Sweden', 'Sverige']),
  norway: R('Norway', ['Norway', 'Norge']),
  denmark: R('Denmark', ['Denmark']),
  finland: R('Finland', ['Finland']),
  netherlands: R('the Netherlands', ['Netherlands', 'The Netherlands', 'Holland', 'Friesland', 'Zeeland', 'Gelderland', 'Groningen']),
  france: R('France', ['France']),
  switzerland: R('Switzerland', ['Switzerland']),
  austria: R('Austria', ['Austria']),
  czech: R('Bohemia', ['Bohemia', 'Czech Republic', 'Czechoslovakia', 'Moravia']),
  hungary: R('Hungary', ['Hungary']),
  russia: R('Russia', ['Russia', 'Russian Empire']),
  ukraine: R('Ukraine', ['Ukraine']),
  lithuania: R('Lithuania', ['Lithuania']),
  spain: R('Spain', ['Spain']),
  portugal: R('Portugal', ['Portugal', 'Azores']),
  greece: R('Greece', ['Greece']),
  mexico: R('Mexico', ['Mexico']),
  quebec: R('Quebec', ['Quebec', 'Québec', 'Lower Canada', 'New France']),
  canada: R('Canada', ['Canada', 'Ontario', 'Nova Scotia', 'New Brunswick', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Newfoundland', 'Prince Edward Island', 'Upper Canada']),
  'usa-new-england': R('New England', ['Maine', 'New Hampshire', 'Vermont', 'Massachusetts', 'Rhode Island', 'Connecticut']),
  'usa-mid-atlantic': R('the Mid-Atlantic', ['New York', 'New Jersey', 'Pennsylvania', 'Delaware', 'Maryland', 'District of Columbia']),
  'usa-south': R('the American South', ['Virginia', 'West Virginia', 'North Carolina', 'South Carolina', 'Georgia', 'Florida', 'Alabama', 'Mississippi', 'Louisiana', 'Tennessee', 'Kentucky', 'Arkansas', 'Texas', 'Oklahoma']),
  'usa-midwest': R('the Midwest', ['Ohio', 'Indiana', 'Illinois', 'Michigan', 'Wisconsin', 'Minnesota', 'Iowa', 'Missouri', 'Kansas', 'Nebraska', 'North Dakota', 'South Dakota']),
  'usa-west': R('the American West', ['California', 'Oregon', 'Washington', 'Idaho', 'Montana', 'Wyoming', 'Nevada', 'Utah', 'Colorado', 'Arizona', 'New Mexico', 'Alaska', 'Hawaii']),
};

// Longest aliases first so "West Virginia" wins over "Virginia".
const LOOKUP = Object.entries(REGIONS)
  .flatMap(([key, r]) => r.aliases.map((a) => ({ key, alias: a, re: new RegExp(`(^|[^\\p{L}])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu') })))
  .sort((a, b) => b.alias.length - a.alias.length);

/**
 * Resolve a location string to { key, label } by scanning comma-separated
 * parts from the end ("... , England, United Kingdom" resolves to England).
 * Returns null when nothing is recognised.
 */
export function regionOf(location) {
  if (!location || typeof location !== 'string') return null;
  const parts = location.split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const hit = LOOKUP.find((l) => l.re.test(parts[i]));
    if (hit) return { key: hit.key, label: REGIONS[hit.key].label };
  }
  return null;
}

/** Specific place for display: the first two comma parts ("Cork, County Cork"). */
export function placeOf(location) {
  if (!location) return '';
  return location.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(', ');
}

export const isUS = (key) => key?.startsWith('usa-');
