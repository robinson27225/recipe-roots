// Hand-curated starter pantry. Each dish is a real, traditional preparation tagged
// with a region (see src/regions.js) and `from`: the earliest year we are
// comfortable saying it was plausibly cooked in that place. The model never
// invents recipes; it only writes about these.
//
// Add dishes freely: a pull request that adds a region is the easiest way to
// make Recipe Roots better for your own family.

import heritage from './pantry-heritage.js';

const BASE = [
  // ---- Ireland ----
  { id: 'irish-soda-bread', region: 'ireland', from: 1840, name: 'Irish Soda Bread', course: 'Bread', serves: '1 loaf', time: '45 min',
    note: 'Bicarbonate of soda replaced yeast in many Irish kitchens in the 1800s, since it suited soft wheat, buttermilk and a hearth-top bastible pot.',
    ingredients: ['450 g (4 cups) plain flour, plus extra for dusting', '1 tsp baking soda', '1 tsp fine salt', '400 ml (1¾ cups) buttermilk'],
    steps: ['Heat the oven to 220°C / 425°F and flour a baking sheet.', 'Stir the flour, baking soda and salt together in a large bowl.', 'Pour in most of the buttermilk and mix quickly with your hand into a soft, shaggy dough, adding the rest only if needed.', 'Shape into a round about 4 cm thick without kneading. Cut a deep cross across the top.', 'Bake 30–35 minutes, until golden and it sounds hollow when tapped underneath. Cool on a rack under a clean cloth.'] },
  { id: 'colcannon', region: 'ireland', from: 1750, name: 'Colcannon', course: 'Side', serves: '4–6', time: '40 min',
    note: 'Mashed potato with kale or cabbage, a staple of Irish tables and traditionally associated with Halloween.',
    ingredients: ['1 kg floury potatoes, peeled and quartered', '300 g kale or green cabbage, shredded', '4 spring onions, sliced', '150 ml milk or cream', '60 g butter, plus more for the well', 'Salt and white pepper'],
    steps: ['Boil the potatoes in salted water until tender, about 20 minutes.', 'Meanwhile, simmer the kale in a little water for 5 minutes and drain well.', 'Warm the milk with the spring onions for 3–4 minutes.', 'Drain and mash the potatoes, then beat in the hot milk and onions, then fold in the kale and season.', 'Pile into a warm dish, make a well in the centre and fill it with butter.'] },
  { id: 'irish-stew', region: 'ireland', from: 1800, name: 'Irish Stew', course: 'Main', serves: '4–6', time: '2 hr',
    note: 'Traditionally just mutton or lamb, potatoes and onions cooked slowly in one pot.',
    ingredients: ['900 g lamb neck or shoulder, cut in chunks', '4 large potatoes, peeled', '2 large onions, sliced', '2 carrots, sliced (optional)', '750 ml water or light stock', '1 sprig thyme', 'Salt and pepper', 'Chopped parsley to finish'],
    steps: ['Layer the meat, onions and half the potatoes in a heavy pot, seasoning each layer.', 'Add the thyme and water, bring to a bare simmer, cover and cook 1½ hours.', 'Slice the remaining potatoes and lay them on top. Cook 30 minutes more, until the meat is tender and the potatoes at the bottom have thickened the broth.', 'Scatter with parsley and serve in deep bowls.'] },
  { id: 'boxty', region: 'ireland', from: 1800, name: 'Boxty (Potato Pancakes)', course: 'Breakfast', serves: '4', time: '30 min',
    note: 'A pancake made from both raw and mashed potato, found across the north and west of Ireland.',
    ingredients: ['250 g raw potato, grated', '250 g cold mashed potato', '125 g plain flour', '1 tsp baking soda', '1 tsp salt', '120 ml buttermilk', 'Butter for frying'],
    steps: ['Squeeze the grated potato dry in a clean cloth.', 'Mix with the mashed potato, flour, baking soda and salt. Stir in enough buttermilk to make a thick batter.', 'Fry spoonfuls in melted butter over medium heat, 4 minutes a side, until deep golden.', 'Serve hot with butter, or alongside bacon and eggs.'] },

  // ---- England ----
  { id: 'yorkshire-pudding', region: 'england', from: 1737, name: 'Yorkshire Pudding', course: 'Side', serves: '6', time: '35 min',
    note: 'First written down in the 1700s as a "dripping pudding", cooked beneath the roasting meat to catch its juices.',
    ingredients: ['140 g (1 cup) plain flour', '4 eggs', '200 ml (¾ cup) milk', '½ tsp salt', '4 tbsp beef dripping or vegetable oil'],
    steps: ['Whisk the flour, eggs, milk and salt into a smooth batter. Rest 30 minutes.', 'Heat the oven to 220°C / 425°F. Put a spoonful of fat into each cup of a 12-hole tin and heat until smoking.', 'Pour in the batter quickly, filling holes about half-full.', 'Bake 20–25 minutes without opening the door, until tall and golden.'] },
  { id: 'cottage-pie', region: 'england', from: 1790, name: 'Cottage Pie', course: 'Main', serves: '4–6', time: '1 hr 30',
    note: 'The name appears in print in the 1790s, when potatoes had become a cheap staple for the poor; leftover meat went under the mash.',
    ingredients: ['500 g minced beef (use lamb for Shepherd\'s Pie)', '1 onion and 2 carrots, finely chopped', '1 tbsp flour', '300 ml beef stock', '1 tbsp Worcestershire sauce', '1 kg potatoes, boiled', '50 g butter and a splash of milk', 'Salt and pepper'],
    steps: ['Brown the mince with the onion and carrots for 10 minutes. Stir in the flour.', 'Add stock and Worcestershire; simmer 25 minutes until thick. Season.', 'Mash the potatoes with butter and milk.', 'Spread the meat in a dish, top with mash and fork it into ridges.', 'Bake at 200°C / 400°F for 25 minutes until bubbling and browned on top.'] },
  { id: 'bread-butter-pudding', region: 'england', from: 1700, name: 'Bread and Butter Pudding', course: 'Dessert', serves: '6', time: '1 hr',
    note: 'A thrifty English way to use up stale bread, dressed up with dried fruit and custard.',
    ingredients: ['8 slices day-old bread, buttered', '75 g raisins or currants', '500 ml milk', '2 eggs plus 1 yolk', '50 g sugar', '¼ tsp nutmeg'],
    steps: ['Cut the bread into triangles and layer it, buttered side up, in a baking dish with the fruit.', 'Whisk the milk, eggs, sugar and nutmeg and pour over. Let soak 15 minutes.', 'Bake at 180°C / 350°F for 35–40 minutes until set and golden.'] },

  // ---- Scotland ----
  { id: 'scotch-broth', region: 'scotland', from: 1700, name: 'Scotch Broth', course: 'Soup', serves: '6', time: '2 hr',
    note: 'A barley and root-vegetable soup made on lamb or mutton bones.',
    ingredients: ['500 g lamb neck or shin on the bone', '50 g pearl barley', '1 onion, 1 carrot, 1 leek and 1 small turnip, diced', '2 litres water', 'Salt and pepper', 'Chopped parsley'],
    steps: ['Simmer the lamb and barley in the water for 1 hour, skimming now and then.', 'Add the vegetables and cook 45 minutes more.', 'Lift out the bones, return any meat to the pot, season, and add parsley.'] },
  { id: 'shortbread', region: 'scotland', from: 1700, name: 'Shortbread', course: 'Baking', serves: '16 fingers', time: '1 hr',
    note: 'Three ingredients and plenty of butter. The "short" means crumbly.',
    ingredients: ['225 g (1 cup) butter, softened', '100 g (½ cup) caster sugar, plus extra', '300 g (2½ cups) plain flour', 'Pinch of salt'],
    steps: ['Cream the butter and sugar. Work in the flour and salt to a soft dough; do not overmix.', 'Press into a lined 20 cm tin, prick with a fork and chill 20 minutes.', 'Bake at 150°C / 300°F for 40 minutes until pale gold. Sprinkle with sugar, cut into fingers while warm, and cool in the tin.'] },

  // ---- Wales ----
  { id: 'welsh-rarebit', region: 'wales', from: 1725, name: 'Welsh Rarebit', course: 'Supper', serves: '4', time: '15 min',
    note: 'Once written "Welsh rabbit" in the 1700s: cheese sauce on toast.',
    ingredients: ['200 g sharp cheddar, grated', '60 ml ale or milk', '1 tsp mustard', '1 tbsp butter', '1 tsp Worcestershire sauce', '4 slices toast'],
    steps: ['Melt the butter, then the cheese, ale and mustard together over low heat, stirring until smooth.', 'Spread thickly on toast and grill until bubbling and browned in places.'] },
  { id: 'bara-brith', region: 'wales', from: 1800, name: 'Bara Brith', course: 'Baking', serves: '1 loaf', time: '1 hr 20 + soaking',
    note: '"Speckled bread" is a tea-soaked fruit loaf served sliced and buttered.',
    ingredients: ['300 g mixed dried fruit', '250 ml strong hot tea', '150 g brown sugar', '1 egg, beaten', '300 g self-raising flour', '1 tsp mixed spice'],
    steps: ['Soak the fruit and sugar in the tea overnight.', 'Next day stir in the egg, flour and spice.', 'Pour into a lined 900 g loaf tin and bake at 160°C / 325°F for about 1 hour.', 'Cool, slice and butter.'] },

  // ---- Germany ----
  { id: 'sauerbraten', region: 'germany', from: 1700, name: 'Sauerbraten', course: 'Main', serves: '6–8', time: '3 hr + 3 days marinade',
    note: 'A pot roast marinated for days in vinegar and spices, then braised to tenderness.',
    ingredients: ['1.5 kg beef roast (chuck or bottom round)', '500 ml water', '250 ml red wine vinegar', '1 onion, sliced', '2 carrots, sliced', '8 peppercorns, 4 cloves, 2 bay leaves', '2 tbsp oil', '6 gingersnap biscuits, crushed', 'Salt'],
    steps: ['Boil the water, vinegar, vegetables and spices; cool. Pour over the beef in a non-reactive dish, cover and chill for 3 days, turning daily.', 'Pat the meat dry and brown in oil in a heavy pot.', 'Add the strained marinade, cover, and simmer gently 2½–3 hours until tender.', 'Strain the liquid, stir in the crushed gingersnaps and simmer into a gravy. Slice and serve with dumplings or red cabbage.'] },
  { id: 'kartoffelsalat', region: 'germany', from: 1800, name: 'Kartoffelsalat (Warm Potato Salad)', course: 'Side', serves: '4–6', time: '40 min',
    note: 'The south German style is dressed warm with broth and vinegar, no mayonnaise.',
    ingredients: ['800 g waxy potatoes', '1 small onion, finely chopped', '200 ml hot beef or vegetable broth', '3 tbsp white wine vinegar', '1 tsp mustard', '3 tbsp oil', 'Salt, pepper, chives'],
    steps: ['Boil the potatoes in their skins until tender; peel and slice while warm.', 'Whisk the broth, vinegar, mustard and oil; add the onion.', 'Pour over the warm potatoes, toss gently, and rest 20 minutes. Season and scatter with chives.'] },
  { id: 'spaetzle', region: 'germany', from: 1700, name: 'Spätzle', course: 'Side', serves: '4', time: '30 min',
    note: 'Little hand-shaped egg dumplings from Swabia and the south.',
    ingredients: ['300 g plain flour', '3 eggs', '120 ml water or milk', '1 tsp salt', 'Pinch of nutmeg', '2 tbsp butter'],
    steps: ['Beat the flour, eggs, liquid, salt and nutmeg to a thick, elastic batter. Rest 10 minutes.', 'Press or scrape the batter in small pieces into simmering salted water. They are done when they float.', 'Lift out, drain, and toss in hot butter.'] },

  // ---- Italy ----
  { id: 'pasta-e-fagioli', region: 'italy', from: 1800, name: 'Pasta e Fagioli', course: 'Soup', serves: '6', time: '1 hr 30 + soaking',
    note: 'Pasta and beans: a thrifty meal across Italy, with local variations in every province.',
    ingredients: ['250 g dried cannellini or borlotti beans, soaked overnight', '1 onion, 1 celery stalk and 1 carrot, finely chopped', '2 garlic cloves', '3 tbsp olive oil', '1 tbsp tomato paste', '1 sprig rosemary', '100 g small pasta (ditalini)', 'Salt, pepper, parmesan rind (optional)'],
    steps: ['Simmer the drained beans in fresh water with the rosemary and parmesan rind until tender, about 1 hour.', 'In a second pot, soften the vegetables and garlic in the olive oil. Stir in the tomato paste.', 'Add the beans and most of their liquid; mash a ladleful against the pot to thicken.', 'Add the pasta and cook until tender, adding water as needed. Finish with olive oil and pepper.'] },
  { id: 'polenta', region: 'italy', from: 1700, name: 'Polenta', course: 'Side', serves: '4–6', time: '45 min',
    note: 'Cornmeal porridge from northern Italy, served soft or cooled and fried.',
    ingredients: ['250 g coarse cornmeal', '1.2 litres water', '1 tsp salt', '30 g butter', '50 g grated parmesan'],
    steps: ['Bring the salted water to a boil. Rain in the cornmeal while whisking.', 'Cook on the lowest heat for 35–40 minutes, stirring often, until it pulls from the sides.', 'Beat in the butter and cheese. Serve soft, or pour into a pan, chill, slice and fry.'] },
  { id: 'ragu', region: 'italy', from: 1800, name: 'Sunday Ragù', course: 'Main', serves: '6–8', time: '3 hr 30',
    note: 'A long-simmered tomato and meat sauce, served over pasta, with the meat as a second course.',
    ingredients: ['500 g pork ribs', '500 g beef chuck, in large pieces', '1 onion, chopped', '3 garlic cloves', '3 tbsp olive oil', '800 g whole peeled tomatoes, crushed', 'Handful of basil', 'Salt and pepper'],
    steps: ['Brown the meats in the olive oil and set aside. Soften the onion and garlic in the same pot.', 'Add the tomatoes, return the meat and simmer on the lowest heat, partly covered, for 3 hours, stirring now and then.', 'Add the basil at the end. Toss the sauce with pasta and serve the meat afterwards.'] },

  // ---- Poland ----
  { id: 'pierogi-ruskie', region: 'poland', from: 1700, name: 'Pierogi Ruskie', course: 'Main', serves: '4–6', time: '1 hr 30',
    note: 'Dumplings stuffed with potato and farmer cheese, named for Red Ruthenia in the east of historic Poland.',
    ingredients: ['300 g plain flour', '1 egg', '150 ml warm water', '½ tsp salt', '400 g boiled potatoes, mashed', '200 g farmer cheese or quark', '1 onion, finely chopped and fried in butter', 'Salt and pepper', 'Butter and sour cream to serve'],
    steps: ['Knead the flour, egg, water and salt into a smooth dough. Rest 30 minutes.', 'Mix the potatoes, cheese and half the fried onion; season well.', 'Roll the dough thin, cut 8 cm rounds, fill, fold and pinch shut.', 'Simmer in salted water until they float, then 2 minutes more. Toss in butter and the remaining onion; serve with sour cream.'] },
  { id: 'bigos', region: 'poland', from: 1700, name: 'Bigos (Hunter\'s Stew)', course: 'Main', serves: '8', time: '2 hr 30',
    note: 'A slow stew of sauerkraut, fresh cabbage and meats that improves when reheated.',
    ingredients: ['500 g sauerkraut, drained', '500 g fresh cabbage, shredded', '400 g pork and kielbasa, diced', '1 onion, chopped', '15 g dried mushrooms, soaked', '2 bay leaves, 4 allspice berries', '6 prunes (optional)', 'Salt and pepper'],
    steps: ['Brown the meats with the onion in a large pot.', 'Add everything else with enough water to just cover.', 'Simmer gently 2 hours, stirring occasionally. Rest a day if you can, then reheat.'] },

  // ---- Sweden ----
  { id: 'kottbullar', region: 'sweden', from: 1800, name: 'Köttbullar (Swedish Meatballs)', course: 'Main', serves: '4–6', time: '45 min',
    note: 'Small spiced meatballs in cream gravy, a fixture of the Swedish table.',
    ingredients: ['500 g mixed beef and pork mince', '1 onion, grated', '50 g breadcrumbs soaked in 100 ml milk', '1 egg', '½ tsp ground allspice', '1 tsp salt', 'Butter for frying', 'For the gravy: 2 tbsp butter, 2 tbsp flour, 400 ml stock, 100 ml cream'],
    steps: ['Mix the mince, onion, soaked crumbs, egg, allspice and salt. Shape into small balls.', 'Fry in butter until browned and cooked through; set aside.', 'Make the gravy by stirring flour into the pan butter, whisking in stock and cream, and simmering until glossy.', 'Return the meatballs to the sauce and serve with potatoes and lingonberry jam.'] },

  // ---- Norway ----
  { id: 'lefse', region: 'norway', from: 1800, name: 'Lefse', course: 'Bread', serves: '8 rounds', time: '1 hr 15',
    note: 'A thin potato flatbread, often spread with butter and sugar.',
    ingredients: ['500 g potatoes, boiled and riced', '60 g butter', '60 ml cream', '1 tsp salt', '150 g flour, plus more for rolling'],
    steps: ['Mix the hot riced potatoes with butter, cream and salt. Chill thoroughly.', 'Work in the flour. Divide into 8 balls.', 'Roll each paper-thin on a floured surface and cook on a dry griddle, 1 minute a side, until freckled.', 'Stack under a damp cloth; spread with butter and sugar and roll up.'] },

  // ---- Netherlands ----
  { id: 'stamppot', region: 'netherlands', from: 1700, name: 'Boerenkool Stamppot', course: 'Main', serves: '4', time: '40 min',
    note: 'Mashed potato and kale with smoked sausage, a winter dish of the Low Countries.',
    ingredients: ['1 kg potatoes, peeled and cut up', '500 g kale, chopped', '250 g smoked sausage (rookworst)', '100 ml milk', '40 g butter', 'Salt, pepper, mustard'],
    steps: ['Boil the potatoes with the kale on top, and the sausage laid over everything, until tender, about 25 minutes.', 'Lift out the sausage. Drain, then mash potatoes and kale with the milk and butter. Season.', 'Serve with sliced sausage and mustard.'] },
  { id: 'oliebollen', region: 'netherlands', from: 1700, name: 'Oliebollen', course: 'Baking', serves: '20', time: '1 hr 30',
    note: 'Yeasted fritters with currants, eaten around New Year.',
    ingredients: ['500 g flour', '7 g dried yeast', '300 ml warm milk', '1 egg', '100 g raisins or currants', '1 apple, diced', '½ tsp salt', 'Oil for frying; icing sugar'],
    steps: ['Mix the flour, yeast, milk, egg and salt into a thick, sticky batter. Fold in the fruit. Cover and let rise 45 minutes.', 'Heat oil to 175°C / 350°F. Drop in scoops with two wet spoons.', 'Fry 6–8 minutes, turning, until deep golden. Drain and dust with icing sugar.'] },

  // ---- Quebec ----
  { id: 'tourtiere', region: 'quebec', from: 1750, name: 'Tourtière', course: 'Main', serves: '6–8', time: '1 hr 45',
    note: 'A spiced pork pie, traditionally eaten around Christmas Eve.',
    ingredients: ['Pastry for a double-crust 23 cm pie', '600 g ground pork', '1 onion, finely chopped', '2 garlic cloves', '1 potato, boiled and mashed', '120 ml water', '½ tsp each cloves, cinnamon and salt', '1 egg, beaten'],
    steps: ['Simmer the pork, onion, garlic, water and spices for 20 minutes until the liquid is gone. Mix in the mashed potato and cool.', 'Line a pie plate with pastry, fill, cover with the top crust, crimp, vent, and brush with egg.', 'Bake at 200°C / 400°F for 15 minutes, then 180°C / 350°F for 30 minutes.'] },
  { id: 'soupe-aux-pois', region: 'quebec', from: 1700, name: 'Soupe aux Pois', course: 'Soup', serves: '6–8', time: '2 hr',
    note: 'Yellow pea soup with a ham bone, a staple of French-Canadian kitchens.',
    ingredients: ['500 g dried yellow split peas', '1 smoked ham hock or bone', '1 onion and 1 carrot, diced', '2.5 litres water', '1 tsp dried savory', 'Salt and pepper'],
    steps: ['Put everything in a large pot and bring to a boil, skimming the foam.', 'Simmer 1½–2 hours, until the peas collapse and the meat falls from the bone.', 'Shred the ham back in, season, and serve with bread.'] },

  // ---- New England ----
  { id: 'baked-beans', region: 'usa-new-england', from: 1750, name: 'Boston Baked Beans', course: 'Main', serves: '8', time: '6 hr + soaking',
    note: 'Beans sweetened with molasses and baked all day, a Saturday-night tradition in New England.',
    ingredients: ['450 g dried navy beans, soaked overnight', '120 g salt pork, scored', '1 onion, halved', '80 ml molasses', '2 tbsp brown sugar', '1 tsp dry mustard', '1 tsp salt'],
    steps: ['Simmer the drained beans in fresh water for 30 minutes. Drain, keeping the liquid.', 'Put the onion and salt pork in a bean pot, add the beans, and stir the molasses, sugar, mustard and salt into 500 ml of reserved liquid. Pour over.', 'Bake covered at 150°C / 300°F for 5–6 hours, adding hot water if they dry out, and uncover for the last 30 minutes.'] },
  { id: 'brown-bread', region: 'usa-new-england', from: 1750, name: 'Boston Brown Bread', course: 'Bread', serves: '2 small loaves', time: '3 hr',
    note: 'A steamed bread of rye, cornmeal and molasses, classically served with baked beans.',
    ingredients: ['120 g rye flour', '120 g cornmeal', '120 g whole wheat flour', '1 tsp baking soda', '1 tsp salt', '240 ml buttermilk', '160 ml molasses', '100 g raisins (optional)'],
    steps: ['Stir the dry ingredients together, then the buttermilk and molasses, and fold in the raisins.', 'Fill two greased, floured 450 g cans two-thirds full and cover tightly with foil.', 'Steam on a rack in a pot of simmering water for 2½ hours. Slide out and cool slightly before slicing.'] },
  { id: 'fish-chowder', region: 'usa-new-england', from: 1750, name: 'New England Fish Chowder', course: 'Soup', serves: '6', time: '45 min',
    note: 'A milk-based chowder of local fish, potatoes and salt pork; older versions used crackers to thicken it.',
    ingredients: ['700 g haddock or cod', '100 g salt pork or bacon, diced', '1 onion, chopped', '3 potatoes, diced', '500 ml fish stock or water', '500 ml milk', '100 ml cream', 'Salt, pepper, oyster crackers'],
    steps: ['Render the pork, then soften the onion in the fat.', 'Add the potatoes and stock; simmer 10 minutes.', 'Lay in the fish and cook 8 minutes, then break it up gently.', 'Pour in the milk and cream, heat without boiling, season, and serve with crackers.'] },
  { id: 'indian-pudding', region: 'usa-new-england', from: 1700, name: 'Indian Pudding', course: 'Dessert', serves: '6', time: '2 hr 30',
    note: 'A colonial-era baked cornmeal and molasses pudding; "Indian" was the old word for cornmeal.',
    ingredients: ['1 litre milk', '80 g cornmeal', '120 ml molasses', '2 tbsp butter', '1 egg', '1 tsp ginger, ½ tsp cinnamon, ½ tsp salt'],
    steps: ['Scald 750 ml of the milk and whisk in the cornmeal; cook, stirring, until thick, about 10 minutes.', 'Stir in the molasses, butter, spices and egg. Pour into a buttered dish.', 'Pour the remaining cold milk over the top without stirring.', 'Bake at 150°C / 300°F for 2 hours. Serve warm with cream or ice cream.'] },

  // ---- Mid-Atlantic ----
  { id: 'pot-pie', region: 'usa-mid-atlantic', from: 1800, name: 'Pennsylvania Dutch Chicken Pot Pie', course: 'Main', serves: '6', time: '1 hr 45',
    note: 'In Pennsylvania Dutch country, "pot pie" is a stew with square noodles, not a pastry-topped pie.',
    ingredients: ['1 whole chicken (about 1.5 kg)', '2 potatoes, cubed', '1 onion and 2 celery stalks, chopped', 'Parsley, salt and pepper', 'Dough: 250 g flour, 1 egg, 60 ml water, ½ tsp salt'],
    steps: ['Simmer the chicken with the onion and celery in water to cover for 1 hour. Lift out, pick the meat, and keep the broth.', 'Mix the dough, roll very thin and cut into 4 cm squares.', 'Bring the broth to a boil with the potatoes. Drop in the squares, one by one, and simmer 15 minutes.', 'Return the chicken, add parsley, season and serve.'] },

  // ---- South ----
  { id: 'cornbread', region: 'usa-south', from: 1750, name: 'Skillet Cornbread', course: 'Bread', serves: '8', time: '35 min',
    note: 'Baked in a cast-iron skillet; traditional Southern versions use little or no sugar.',
    ingredients: ['150 g (1 cup) cornmeal', '60 g (½ cup) flour', '1 tsp baking powder', '½ tsp baking soda', '1 tsp salt', '240 ml buttermilk', '1 egg', '3 tbsp bacon fat or butter'],
    steps: ['Heat the oven to 220°C / 425°F with the fat in a 20 cm cast-iron skillet.', 'Mix the dry ingredients, then the buttermilk and egg.', 'Pour the hot fat into the batter, stir, and pour it all back into the skillet.', 'Bake 20 minutes until golden.'] },
  { id: 'collards', region: 'usa-south', from: 1750, name: 'Collard Greens with Smoked Ham Hock', course: 'Side', serves: '6', time: '2 hr',
    note: 'Greens simmered low with smoked pork; the broth is called "pot likker".',
    ingredients: ['1 kg collard greens, stemmed and chopped', '1 smoked ham hock', '1 onion, chopped', '1.5 litres water', '1 tbsp cider vinegar', 'Salt and pepper'],
    steps: ['Simmer the hock, onion and water for 45 minutes.', 'Add the washed collards and cook 45–60 minutes until silky.', 'Finish with the vinegar and salt; serve with the pot likker and cornbread.'] },
  { id: 'hoppin-john', region: 'usa-south', from: 1800, name: 'Hoppin\' John', course: 'Main', serves: '6', time: '1 hr 15 + soaking',
    note: 'Black-eyed peas and rice with smoked pork, a dish of the Carolina and Georgia coast.',
    ingredients: ['250 g dried black-eyed peas, soaked overnight', '100 g bacon or ham, diced', '1 onion and 1 celery stalk, chopped', '1 litre water or stock', '200 g long-grain rice', 'Salt, pepper, hot sauce'],
    steps: ['Fry the bacon, then soften the onion and celery in the fat.', 'Add the peas and liquid; simmer 40 minutes until almost tender.', 'Stir in the rice and cook covered 20 minutes more. Season and serve.'] },

  // ---- Midwest ----
  { id: 'fried-mush', region: 'usa-midwest', from: 1800, name: 'Cornmeal Mush (Fried)', course: 'Breakfast', serves: '4–6', time: '30 min + chilling',
    note: 'Cooked cornmeal, chilled in a loaf pan, sliced and fried, a frontier breakfast.',
    ingredients: ['150 g cornmeal', '750 ml water', '1 tsp salt', 'Butter or lard for frying', 'Maple syrup'],
    steps: ['Whisk the cornmeal into the cold salted water, bring to a boil, and cook 15 minutes, stirring.', 'Pour into a greased loaf pan and chill until firm.', 'Slice and fry in butter until crisp on both sides. Serve with syrup.'] },

  // ---- West ----
  { id: 'sourdough-pancakes', region: 'usa-west', from: 1849, name: 'Sourdough Pancakes', course: 'Breakfast', serves: '4', time: '30 min',
    note: 'Prospectors in the 1849 Gold Rush were so closely tied to their sourdough starter that "sourdough" became a nickname for them.',
    ingredients: ['240 ml active sourdough starter', '1 egg', '2 tbsp sugar', '½ tsp salt', '1 tsp baking soda dissolved in 1 tbsp water', '2 tbsp melted butter', 'Butter for the pan'],
    steps: ['Stir the starter, egg, sugar, salt and melted butter together.', 'Fold in the baking soda mixture; the batter will bubble up.', 'Ladle onto a hot buttered griddle and cook 2–3 minutes a side.'] },

  // ---- Generic US fallback ----
  { id: 'apple-pie', region: 'usa-general', from: 1750, name: 'Double-Crust Apple Pie', course: 'Dessert', serves: '8', time: '1 hr 30',
    note: 'Apples were widely grown in the American colonies, and pie was a practical way to keep them.',
    ingredients: ['Pastry for a double-crust 23 cm pie', '1 kg tart apples, peeled and sliced', '100 g sugar', '2 tbsp flour', '1 tsp cinnamon', '1 tbsp butter', '1 egg, beaten'],
    steps: ['Toss the apples with sugar, flour and cinnamon.', 'Fill the lined pie plate, dot with butter, top with the second crust, crimp, vent, and brush with egg.', 'Bake at 200°C / 400°F for 20 minutes, then 180°C / 350°F for 35 minutes, until bubbling.'] },
];

export default [...BASE, ...heritage];
