// Sorting a family's loose recipes into the chapters of a cookbook. Suggested from the title first (a title is
// the strongest signal), then the ingredients. A recipe's own "category" always wins, so a user can fix any
// suggestion in family-recipes.json.

export const CATEGORIES = [
  'Breads & Breakfast',
  'Soups & Stews',
  'Main Dishes',
  'Sides, Salads & Dips',
  'Cakes, Pies & Desserts',
  'Cookies & Candy',
  'Preserves, Sauces & Drinks',
  'Other',
];

const has = (text, words) => words.some((w) => new RegExp(`\\b${w}`, 'i').test(text));

// Checked in this order, which is what makes the edge cases come out right: "coffee cake" is breakfast baking
// (so it comes before "cake"), "Beef Roll" is a main dish (a protein word comes before "roll"), "Bread Pudding"
// is a dessert (pudding comes before bread), and "Chicken and Noodles" is a main dish (the plain vegetables
// are checked last).
const PROTEIN = ['chicken', 'beef', 'pork', 'ham\\b', 'lamb', 'turkey', 'fish', 'salmon', 'shrimp', 'trout', 'tuna', 'meat', 'roast', 'meatball', 'sausage', 'steak', 'ribs?\\b', 'liver', 'duck', 'venison', 'rabbit'];
const BY_TITLE = [
  ['Cakes, Pies & Desserts', ['apple.*dumpling', 'peach.*dumpling', 'fruit.*dumpling']], // a fruit dumpling is a dessert (the plain "dumpling" is a main dish)
  ['Breads & Breakfast', ['coffee cake', 'french toast', 'omelet', 'eggs? benedict']],
  ['Preserves, Sauces & Drinks', ['jam', 'jelly', 'preserve', 'pickle', 'relish', 'chutney', 'marmalade', 'syrup', 'sauce', 'gravy', 'tea\\b', 'punch', 'lemonade', 'cider', 'cocoa', 'drink', 'cordial', 'wine', 'compote', 'butter\\b(?!\\s*(cake|cookie|bread|scotch))']],
  ['Cookies & Candy', ['cookie', 'brownie', 'fudge', 'candy', 'candies', 'divinity', 'toffee', 'caramel', 'truffle', 'macaroon', 'biscotti', 'snickerdoodle', 'pfeffern', 'brittle', 'bars?\\b', 'noels', 'drop cakes', 'shortbread']],
  ['Soups & Stews', ['soup', 'stew', 'chowder', 'broth', 'bisque', 'gumbo', 'chili', 'borscht', 'goulash', 'slumgullion']],
  ['Sides, Salads & Dips', ['salad', 'slaw', 'coleslaw', 'dressing', 'dip\\b', 'stuffing', 'succotash', 'corn pudding', 'pickled eggs', 'stamppot']],
  ['Main Dishes', [...PROTEIN, 'meatloaf', 'meat loaf', 'casserole', 'pot pie', 'dumpling', 'pasta', 'spaghetti', 'cavatelli', 'lasagna', 'curry', 'taco', 'enchilada', 'tourti', 'rouladen', 'pierogi', 'sandwich', 'melts?\\b', 'tetrazzini', 'paella', 'tofu', 'loaf']],
  ['Cakes, Pies & Desserts', ['pudding', 'cobbler', 'crisp\\b', 'custard', 'tart\\b', 'pie\\b', 'pies\\b', 'cake\\b', 'cheesecake', 'torte', 'dessert', 'ice cream', 'trifle', 'mousse', 'frosting', 'icing', 'parfait', 'flan', 'strudel', 'apple.*dumpling', 'floating island', 'panna cotta', 'pavlova']],
  ['Breads & Breakfast', ['bread', 'biscuit', 'rolls?\\b', 'muffin', 'pancake', 'waffle', 'scone', 'cornbread', 'buns?\\b', 'doughnut', 'donut', 'granola', 'hash\\b', 'lefse', 'pretzel', 'johnnycake', 'johnny cake', 'crepe', 'oatmeal\\b', 'porridge', 'mush\\b']],
  ['Sides, Salads & Dips', ['beans?\\b', 'corn\\b', 'potato', 'greens', 'noodles?\\b', 'spaetzle', 'spätzle', 'rice\\b', 'vegetable', 'cabbage', 'squash', 'peas\\b']],
];

/** The category to file this recipe under: its own "category" if given, else a suggestion. */
export function categorize(recipe) {
  if (recipe.category && CATEGORIES.includes(recipe.category)) return recipe.category;
  const title = String(recipe.title ?? '');
  for (const [category, words] of BY_TITLE) if (has(title, words)) return category;
  // Nothing in the title: fall back on what goes in it.
  const ing = (recipe.ingredients ?? []).join(' ');
  const meat = has(ing, ['chicken', 'beef', 'pork', 'ham\\b', 'lamb', 'turkey', 'fish', 'sausage', 'bacon', 'steak']);
  const flour = has(ing, ['flour']);
  if (meat) return 'Main Dishes';
  if (flour && has(ing, ['yeast'])) return 'Breads & Breakfast'; // a yeast dough is bread, whatever else is (or isn't) in it
  if (flour && has(ing, ['sugar', 'eggs?\\b', 'butter', 'baking'])) return 'Cakes, Pies & Desserts';
  return 'Other';
}

/** Group recipes by category in the book's order; empty categories are left out. */
export function groupByCategory(recipes) {
  const groups = new Map(CATEGORIES.map((c) => [c, []]));
  for (const r of recipes) groups.get(categorize(r)).push(r);
  return [...groups].filter(([, list]) => list.length).map(([category, list]) => ({ category, recipes: list.sort((a, b) => a.title.localeCompare(b.title)) }));
}
