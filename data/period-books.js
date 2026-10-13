// Public-domain cookbooks on Project Gutenberg, used to show how a dish was written up in its own era.
// All are in the public domain in the United States: published there before 1926 (enforced in code, see
// PUBLIC_DOMAIN_BEFORE), or an undated book cleared by Project Gutenberg. `year` is the edition the Gutenberg text comes from
// (read from the book's own title page or copyright notice; `null` = the book is undated). `regions` are
// the heritages the book speaks for ('usa-general' = any US region). A regional book outranks a general one.
//
// Add a book: download its text, read its year from the text, run the report in README ("Adding a book"),
// and register it only if the parser reads its layout and its heritage is stated by the book itself.
//
// Deliberately NOT registered:
//  - #6966 (French), #22114, #13177, #39586, #40943, #13545: wrong language, no matching dishes, or
//    recipes embedded in prose that the parser can't separate.
//
// `onlyWith` / `tags`: a book offered for a heritage that a WikiTree profile STATES with a sticker (stickers.js),
// never inferred from a place name. #12350 is offered only when someone in the chapter carries a Jewish Roots
// sticker (or a Religion Project entry saying so); religion is never printed beyond the cookbook's own title.
export default [
  // New England
  { id: 13493, title: 'The American Frugal Housewife', author: 'Lydia Maria Child', year: 1832, regions: ['usa-new-england'] },
  { id: 36689, title: 'The New England Cook Book', author: 'Anonymous', year: 1836, regions: ['usa-new-england'] },
  { id: 65061, title: 'The Boston Cooking-School Cook Book', author: 'Fannie Merritt Farmer', year: 1906, note: 'first published 1896', regions: ['usa-new-england', 'usa-general'] },
  // The South
  { id: 12519, title: 'The Virginia Housewife', author: 'Mary Randolph', year: 1860, note: 'first published 1824', regions: ['usa-south'] },
  { id: 42450, title: 'Housekeeping in Old Virginia', author: 'Marion Cabell Tyree (ed.)', year: 1877, regions: ['usa-south'] },
  // Pennsylvania and the Mid-Atlantic
  { id: 9624, title: 'Directions for Cookery, in its Various Branches', author: 'Eliza Leslie', year: 1840, regions: ['usa-mid-atlantic', 'usa-general'] },
  { id: 26558, title: 'Pennsylvania Dutch Cooking', author: 'Anonymous', year: null, note: 'undated', regions: ['usa-mid-atlantic'], tags: ['pennsylvania-german'] },
  // The West
  { id: 26374, title: 'The Cookery Blue Book', author: 'First Unitarian Society of San Francisco', year: 1891, regions: ['usa-west'] },
  // General American (the Midwest has no regional book on Gutenberg that we could find, so Midwestern lines draw on these)
  { id: 46254, title: "Mrs. Hale's Receipts for the Million", author: 'Sarah Josepha Hale', year: 1857, regions: ['usa-general'] },
  { id: 48804, title: 'Common Sense in the Household', author: 'Marion Harland', year: 1871, regions: ['usa-general'] },
  { id: 49944, title: 'Breakfast, Luncheon and Tea', author: 'Marion Harland', year: 1875, regions: ['usa-general'] },
  { id: 13923, title: 'The White House Cook Book', author: 'F. L. Gillette and Hugo Ziemann', year: 1887, regions: ['usa-general'] },
  { id: 34822, title: 'The Century Cook Book', author: 'Mary Ronald', year: 1895, regions: ['usa-general'] },
  { id: 26209, title: 'The Golden Age Cook Book', author: 'Henrietta Latham Dwight', year: 1898, regions: ['usa-general'] },
  { id: 37680, title: 'The Myrtle Reed Cook Book', author: 'Myrtle Reed', year: 1916, regions: ['usa-general'] },
  { id: 17438, title: "Mrs. Wilson's Cook Book", author: 'Mary A. Wilson', year: 1920, regions: ['usa-general'] },
  // Internet Archive (machine-read scans). Published in New York in 1907 (first edition 1906), so public domain in the
  // US. The Archive's record (a Wellcome Library digitisation) carries a blanket "possibly protected" rights notice;
  // the 1907 US publication date is what governs.
  { id: 'b28142214', source: 'archive', title: 'The International Cook Book', author: 'Alexander Filippini', year: 1907, note: 'first published 1906', regions: ['usa-general'] },
  // Offered only where a profile's own sticker says so
  { id: 12350, title: 'The International Jewish Cook Book', author: 'Florence Kreisler Greenbaum', year: 1919, regions: [], onlyWith: ['jewish'] },
  // Italian-American
  { id: 24407, title: 'The Italian Cook Book', author: 'Maria Gentile', year: 1919, regions: ['italy'] },
];
