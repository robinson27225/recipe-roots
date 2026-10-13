// More traditional dishes for the regions most American family trees pass through, plus a few more
// from the British Isles, Germany and Canada. Same rules as data/pantry.js: real, widely documented
// preparations, tagged by region and the earliest year we are comfortable saying they were cooked there.
// Written from standard published versions and checked for plausibility, but NOT kitchen-tested.
export default [
  // ---- Mid-Atlantic (Pennsylvania German, New York) ----
  { id: 'scrapple', region: 'usa-mid-atlantic', from: 1750, name: 'Scrapple', course: 'Breakfast', serves: '8', time: '2 hr + chilling',
    note: 'A Pennsylvania German way to use every part of the hog at butchering time: pork and broth thickened with cornmeal, set in a pan, sliced and fried.',
    ingredients: ['450 g pork shoulder or scraps', '1 litre water', '150 g cornmeal', '40 g buckwheat flour (optional)', '1½ tsp salt', '1 tsp ground sage', '½ tsp black pepper', '¼ tsp thyme', 'Butter or lard for frying'],
    steps: ['Simmer the pork in the water for 1½ hours until very tender. Lift out and shred finely; keep the broth.', 'Return 750 ml of broth to the pot. Whisk in the cornmeal, buckwheat flour and seasonings and cook, stirring, for 30 minutes until very thick.', 'Stir in the pork, pour into a greased loaf pan and chill overnight until firm.', 'Slice 1 cm thick and fry in butter until crisp and brown on both sides.'] },
  { id: 'shoofly-pie', region: 'usa-mid-atlantic', from: 1850, name: 'Shoofly Pie', course: 'Dessert', serves: '8', time: '1 hr 10',
    note: 'A molasses and crumb pie of Pennsylvania Dutch country, often eaten at breakfast with coffee.',
    ingredients: ['1 unbaked 23 cm pie crust', 'Crumbs: 190 g flour, 100 g brown sugar, 60 g cold butter, ½ tsp cinnamon', 'Filling: 120 ml molasses, 120 ml boiling water, 1 egg yolk, ½ tsp baking soda'],
    steps: ['Heat the oven to 190°C / 375°F. Rub the flour, sugar, butter and cinnamon into coarse crumbs.', 'Dissolve the baking soda in the boiling water; stir in the molasses and egg yolk.', 'Pour the filling into the crust and scatter the crumbs over the top.', 'Bake 35–40 minutes until set. Cool before slicing.'] },
  { id: 'apple-butter', region: 'usa-mid-atlantic', from: 1750, name: 'Apple Butter', course: 'Preserve', serves: '3 jars', time: '4 hr',
    note: 'Apples cooked down slowly with cider until dark and spreadable, a fall task in Pennsylvania German and Appalachian kitchens.',
    ingredients: ['2 kg tart apples, quartered (cores and peel can stay)', '500 ml apple cider', '150 g sugar (to taste)', '1 tsp cinnamon', '¼ tsp ground cloves', 'Pinch of salt'],
    steps: ['Simmer the apples and cider, covered, for 30 minutes until falling apart. Press through a sieve or food mill.', 'Return the purée to the pot (or a slow cooker) with the sugar, spices and salt.', 'Cook on the lowest heat, uncovered and stirring now and then, for 3 hours until deep brown and thick enough to hold a mound on a spoon.', 'Spoon into clean jars and keep refrigerated, or process in a water bath for longer storage.'] },
  { id: 'buckwheat-cakes', region: 'usa-mid-atlantic', from: 1800, name: 'Buckwheat Pancakes', course: 'Breakfast', serves: '4', time: '25 min',
    note: 'Buckwheat was a common crop in Pennsylvania and New York, and its pancakes were a winter staple.',
    ingredients: ['120 g buckwheat flour', '60 g plain flour', '1 tsp baking powder', '½ tsp salt', '1 egg', '300 ml buttermilk', '2 tbsp melted butter', 'Butter for the pan; maple syrup'],
    steps: ['Whisk the flours, baking powder and salt. In another bowl beat the egg, buttermilk and melted butter.', 'Stir the wet into the dry until just combined.', 'Cook ladlefuls on a buttered griddle, 2 minutes a side. Serve with maple syrup.'] },
  { id: 'apple-dumplings', region: 'usa-mid-atlantic', from: 1800, name: 'Baked Apple Dumplings', course: 'Dessert', serves: '6', time: '1 hr 15',
    note: 'Whole apples wrapped in pastry and baked in syrup, a Pennsylvania Dutch favourite.',
    ingredients: ['6 small tart apples, peeled and cored', 'Pastry for a double-crust pie, rolled into six squares', '6 tbsp brown sugar and 1 tsp cinnamon, mixed', '30 g butter', 'Syrup: 200 g sugar, 250 ml water, 1 tbsp butter, ½ tsp cinnamon'],
    steps: ['Heat the oven to 190°C / 375°F. Stand each apple on a pastry square, fill the core with the sugar mixture and a dot of butter.', 'Bring the corners up around the apple, pinch to seal, and set in a baking dish.', 'Simmer the syrup ingredients for 3 minutes and pour around (not over) the dumplings.', 'Bake 45 minutes, basting once, until golden and the apples are tender.'] },

  // ---- The South and Appalachia ----
  { id: 'buttermilk-biscuits', region: 'usa-south', from: 1800, name: 'Buttermilk Biscuits', course: 'Bread', serves: '8', time: '30 min',
    note: 'Tall, tender biscuits made with cold fat and buttermilk, served at breakfast and with supper across the South.',
    ingredients: ['250 g (2 cups) plain flour', '1 tbsp baking powder', '½ tsp salt', '60 g cold butter or lard', '180 ml buttermilk, plus a little to brush'],
    steps: ['Heat the oven to 230°C / 450°F. Mix the flour, baking powder and salt, and cut in the fat until crumbly.', 'Stir in the buttermilk just until a rough dough forms. Pat out 2.5 cm thick and fold it over twice.', 'Cut straight down with a floured cutter, without twisting. Place close together on a baking sheet and brush with buttermilk.', 'Bake 12–15 minutes until risen and golden.'] },
  { id: 'chicken-and-dumplings', region: 'usa-south', from: 1850, name: 'Chicken and Dumplings', course: 'Main', serves: '6', time: '1 hr 45',
    note: 'A stewed chicken with rolled dumplings cooked in the broth: a Sunday and church-supper dish through the South and Appalachia.',
    ingredients: ['1 whole chicken (about 1.5 kg)', '2.5 litres water', '1 onion and 2 celery stalks, chopped', '2 tsp salt, ½ tsp pepper', 'Dumplings: 250 g flour, 1 tsp baking powder, ½ tsp salt, 50 g shortening, 120 ml cold milk or broth'],
    steps: ['Simmer the chicken with the onion, celery and seasoning for 1 hour. Lift out, pick the meat and return it to the pot.', 'Rub the shortening into the flour, baking powder and salt, add the liquid, and roll the dough out thin. Cut into strips.', 'Bring the broth to a steady simmer and drop in the strips one at a time. Cover and cook 15 minutes without stirring much.', 'Adjust the seasoning and serve in bowls.'] },
  { id: 'fried-apples', region: 'usa-south', from: 1800, name: 'Fried Apples', course: 'Side', serves: '4', time: '30 min',
    note: 'Sliced apples cooked down in butter or bacon fat, served with breakfast or pork in Southern and Appalachian homes.',
    ingredients: ['1 kg tart apples, cored and sliced thick', '40 g butter or bacon fat', '60 g sugar', '½ tsp cinnamon', 'Pinch of salt'],
    steps: ['Melt the butter in a wide skillet over medium heat. Add the apples, sugar, cinnamon and salt.', 'Cover for 5 minutes, then uncover and cook, turning gently, 15 minutes more until tender and glazed with syrup.'] },
  { id: 'sweet-potato-pie', region: 'usa-south', from: 1800, name: 'Sweet Potato Pie', course: 'Dessert', serves: '8', time: '1 hr 30',
    note: 'A spiced custard pie of baked sweet potatoes, a Southern holiday staple.',
    ingredients: ['1 unbaked 23 cm pie crust', '500 g sweet potatoes, baked and peeled', '100 g sugar', '2 eggs', '120 ml milk', '60 g melted butter', '1 tsp vanilla', '½ tsp cinnamon, ¼ tsp nutmeg, pinch of salt'],
    steps: ['Heat the oven to 190°C / 375°F. Mash the sweet potatoes until smooth.', 'Beat in the sugar, eggs, milk, butter, vanilla and spices.', 'Pour into the crust and bake 45–50 minutes until the centre is just set. Cool completely.'] },

  // ---- The Midwest ----
  { id: 'chicken-and-noodles', region: 'usa-midwest', from: 1850, name: 'Chicken and Noodles', course: 'Main', serves: '6', time: '2 hr',
    note: 'Homemade egg noodles in rich chicken broth, traditionally ladled over mashed potatoes, a farm-table dish across Indiana and Ohio.',
    ingredients: ['1 whole chicken (about 1.5 kg)', '2.5 litres water, 1 onion, 2 celery stalks, salt and pepper', 'Noodles: 250 g flour, 2 eggs, ½ tsp salt, about 60 ml water', 'Mashed potatoes to serve'],
    steps: ['Simmer the chicken with the onion, celery and seasoning for 1 hour. Lift out, pick the meat and strain the broth.', 'Mix the flour, eggs, salt and just enough water to make a stiff dough. Roll very thin, rest 20 minutes, and cut into wide ribbons.', 'Bring the broth to a boil, drop in the noodles and simmer 10–12 minutes. Return the chicken.', 'Ladle over mashed potatoes.'] },

  // ---- New England ----
  { id: 'succotash', region: 'usa-new-england', from: 1700, name: 'Succotash', course: 'Side', serves: '6', time: '30 min',
    note: 'Corn and shell beans cooked together, from a Narragansett dish adopted by New England settlers.',
    ingredients: ['300 g shelled lima or shell beans', '300 g corn kernels', '30 g butter', '120 ml cream or milk', 'Salt and pepper'],
    steps: ['Simmer the beans in salted water for 15 minutes until nearly tender.', 'Add the corn and cook 5 minutes more. Drain, return to the pot with the butter and cream, and heat through. Season well.'] },
  { id: 'hasty-pudding', region: 'usa-new-england', from: 1700, name: 'Hasty Pudding', course: 'Breakfast', serves: '4', time: '30 min',
    note: 'Cornmeal stirred into boiling water or milk, a quick everyday supper of colonial New England, eaten with molasses.',
    ingredients: ['120 g cornmeal', '1 litre water or milk', '½ tsp salt', 'Molasses and butter to serve'],
    steps: ['Bring the liquid and salt to a boil. Rain in the cornmeal while whisking.', 'Cook over low heat, stirring, for 20 minutes until thick. Serve hot with molasses and butter.'] },

  // ---- Germany ----
  { id: 'rouladen', region: 'germany', from: 1800, name: 'Rouladen', course: 'Main', serves: '4', time: '2 hr',
    note: 'Thin slices of beef rolled around bacon, onion and pickle and braised in gravy, a German Sunday dish.',
    ingredients: ['8 thin slices beef round (about 800 g)', '2 tbsp mustard', '4 slices bacon, halved', '1 onion, sliced', '2 pickles, cut in strips', '2 tbsp oil', '500 ml beef stock', 'Salt and pepper'],
    steps: ['Spread each slice with mustard, season, and lay on a half-slice of bacon, some onion and a strip of pickle. Roll up and tie or pin.', 'Brown the rolls in oil in a heavy pot. Add the stock, cover and simmer gently 1½ hours until tender.', 'Lift out the rolls and reduce the gravy; thicken with a little flour paste if you like. Serve with potatoes or red cabbage.'] },
  { id: 'pfeffernuesse', region: 'germany', from: 1700, name: 'Pfeffernüsse', course: 'Baking', serves: '40 cookies', time: '45 min + resting',
    note: 'Small spiced cookies made for Christmas in German homes, long flavoured with pepper among the spices.',
    ingredients: ['2 eggs', '150 g sugar', '250 g flour', '50 g ground almonds', '1 tsp baking powder', '1 tsp cinnamon', '½ tsp each ground cloves, nutmeg and cardamom', '¼ tsp black pepper', 'Icing sugar'],
    steps: ['Beat the eggs and sugar until pale. Fold in the flour, almonds, baking powder and spices to make a stiff dough. Chill overnight.', 'Heat the oven to 180°C / 350°F. Roll the dough into walnut-sized balls and set on a lined sheet.', 'Bake 10–12 minutes. Cool, then dust with icing sugar.'] },

  // ---- Ireland, England, Scotland, Wales ----
  { id: 'champ', region: 'ireland', from: 1750, name: 'Champ', course: 'Side', serves: '4–6', time: '35 min',
    note: 'Mashed potato with scallions and butter, from the north of Ireland.',
    ingredients: ['1 kg floury potatoes, peeled', '8 spring onions, finely sliced', '250 ml milk', '60 g butter, plus more for the well', 'Salt and pepper'],
    steps: ['Boil the potatoes in salted water until tender, about 20 minutes.', 'Warm the milk with the spring onions for 5 minutes.', 'Drain and mash the potatoes, beat in the hot milk and onions, and season. Serve with a well of butter in the centre.'] },
  { id: 'cornish-pasty', region: 'england', from: 1800, name: 'Cornish Pasty', course: 'Main', serves: '4', time: '1 hr 45',
    note: 'A pastry parcel of beef, potato, swede and onion, carried down the tin and copper mines of Cornwall.',
    ingredients: ['Pastry: 500 g flour, 125 g lard, 125 g butter, about 150 ml cold water, 1 tsp salt', '350 g beef skirt or chuck, finely diced', '250 g potato, thinly sliced', '125 g swede, thinly sliced', '1 onion, chopped', 'Salt, pepper; 1 beaten egg'],
    steps: ['Rub the fats into the flour and salt, mix in the water to a firm dough, and chill 30 minutes.', 'Roll out and cut four 20 cm rounds. Layer potato, swede, onion and beef on one half of each, seasoning every layer.', 'Brush the edges with egg, fold over and crimp firmly. Brush with egg.', 'Bake at 220°C / 425°F for 15 minutes, then 170°C / 340°F for 45 minutes.'] },
  { id: 'oatcakes', region: 'scotland', from: 1700, name: 'Scottish Oatcakes', course: 'Bread', serves: '12', time: '35 min',
    note: 'Thin, crisp oatmeal biscuits baked on a griddle or in the oven, a staple of the Scottish table.',
    ingredients: ['200 g medium oatmeal, plus more for rolling', '½ tsp salt', '¼ tsp baking soda', '2 tbsp melted butter or bacon fat', 'About 100 ml hot water'],
    steps: ['Heat the oven to 180°C / 350°F. Mix the oatmeal, salt and baking soda, stir in the fat, then enough hot water to make a firm dough.', 'Roll out 5 mm thick on oatmeal and cut into rounds or triangles.', 'Bake on a sheet for 20–25 minutes until firm and lightly coloured. Cool on a rack.'] },
  { id: 'scones', region: 'scotland', from: 1750, name: 'Scones', course: 'Baking', serves: '8', time: '30 min',
    note: 'Quick-baked and lightly sweet, served at tea with butter and jam across Scotland and England.',
    ingredients: ['225 g plain flour', '1 tbsp baking powder', '40 g cold butter', '25 g sugar', 'Pinch of salt', '120 ml milk, plus extra to brush'],
    steps: ['Heat the oven to 220°C / 425°F. Rub the butter into the flour, baking powder, sugar and salt.', 'Stir in the milk to a soft dough, pat 2.5 cm thick and cut rounds with a floured cutter.', 'Brush with milk and bake 12–15 minutes until risen and golden.'] },
  { id: 'welsh-cakes', region: 'wales', from: 1850, name: 'Welsh Cakes', course: 'Baking', serves: '16', time: '30 min',
    note: 'Little griddle cakes with currants, cooked on a bakestone and eaten warm.',
    ingredients: ['225 g self-raising flour', '100 g butter, cold', '75 g sugar, plus extra', '50 g currants', '1 egg', 'A splash of milk'],
    steps: ['Rub the butter into the flour, then stir in the sugar and currants. Beat in the egg and enough milk for a firm dough.', 'Roll 6 mm thick and cut into rounds.', 'Cook on a lightly greased griddle over medium-low heat, 3 minutes a side, until golden. Sprinkle with sugar.'] },

  // ---- Canada ----
  { id: 'blueberry-grunt', region: 'canada', from: 1800, name: 'Blueberry Grunt', course: 'Dessert', serves: '6', time: '35 min',
    note: 'Berries stewed under steamed dumplings, a dessert of Nova Scotia and the Maritimes.',
    ingredients: ['500 g blueberries', '100 g sugar', '120 ml water', 'Dumplings: 190 g flour, 2 tsp baking powder, ½ tsp salt, 40 g butter, 120 ml milk'],
    steps: ['Simmer the berries, sugar and water in a wide pot with a tight lid until the berries burst, about 5 minutes.', 'Make the dumplings: rub the butter into the dry ingredients and stir in the milk.', 'Drop spoonfuls on top of the bubbling berries, cover and cook 15 minutes without lifting the lid. Serve warm with cream.'] },
];
