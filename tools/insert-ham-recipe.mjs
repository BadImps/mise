/* One-off insert of the CaribbeanPot "Caribbean Christmas Ham" page.
   Transcribed verbatim from the publisher's own page — no schema.org Recipe
   block exists on this 2012 post. Run: node tools/insert-ham-recipe.mjs */
import fs from 'node:fs';
import vm from 'node:vm';

const file = 'js/caribbean-sources.js';
const text = fs.readFileSync(file, 'utf8');
const start = text.indexOf('= [');
const context = vm.createContext({ window: {} });
vm.runInContext(text, context);
const records = context.window.MISE_CARIBBEAN_SOURCES;

const id = 'carib-trinidad-tobago-caribbean-christmas-ham';
if (records.some((r) => r.id === id)) {
  console.log('already present; nothing to do');
  process.exit(0);
}

const ham = {
  id,
  country: 'Trinidad & Tobago',
  name: 'Caribbean Christmas Ham',
  source: 'CaribbeanPot.com',
  sourceUrl: 'https://caribbeanpot.com/caribbean-christmas-ham/',
  author: 'Chris De La Rosa',
  ingredients: [
    'Ham (smoked/bone in) — about 8lbs',
    '5 sprigs thyme',
    '8 cloves',
    '2 scallions',
    '1 cup pineapple juice',
    '1 table spoon grated ginger',
    '1 tablespoon orange marmalade',
    '1/2 cup brown sugar (golden)',
    '2 table spoon honey',
    'pinch of cinnamon',
    '5-8 slices of pineapple',
    '10-15 cloves',
    'tooth picks for securing the pineapple slices',
  ],
  description: 'Christmas ham is a must in just about every pork-eating home in the Caribbean. ChrisDeLaRosa applies the Caribbean glaze — pineapple juice, ginger, orange marmalade, brown sugar and honey — and bastes the ham until it is shiny and caramelized.',
  instructions: [
    { '@type': 'HowToStep', text: 'If using a shoulder ham with a fat cap on the top, be sure to place that side up when roasting. As the fat melt it will keep the ham nice and juicy.' },
    { '@type': 'HowToStep', text: 'If your ham is encased in a cloth mesh be sure to leave it on at this point, but you\'ll have to remove it before get it in the oven. Give the ham a rinse (btw I used a smoked leg), then place it in a deep pot. Cover with water, add the scallions, cloves and fresh thyme. Bring to a boil, then reduce to a gentle boil and cook for about 30 minutes. This will help remove some of the smoky impurities and infuse it with the herbal notes.' },
    { '@type': 'HowToStep', text: 'Please use a roasting pan with a rack, so you can add a couple cups of water to the pan without the ham sitting directly in it. If you find that the water dries out before it\'s fully cooked, do add a cup or 2 more. This will help keep the ham moist.' },
    { '@type': 'HowToStep', text: 'Drain and get ready to finish cooking in the oven. Set your oven to 350F and you\'ll be using the lower rack. Remove the cloth mesh if your ham is covered in one, then wrap the entire ham in tin foil and place in a roasting tray. On average you\'ll need to cook for 20 minutes per pound.' },
    { '@type': 'HowToStep', text: 'As we wait for the ham to roast evenly, lets prepare the glaze. In a sauce pan add all the ingredients mentioned above, bring it to a boil then simmer for about 5 minutes. Remember to whisk it so the sugar melts and everything is blended.' },
    { '@type': 'HowToStep', text: 'When you ham is fully cooked (use the 20 minutes per pound guide), it\'s time to dress it up and start the glazing process. Trim off the skin and most of the fat (a little good), then stick in the cloves in a pattern evenly. Attach slices of the pineapple with the toothpicks and hit it a good dose of the glaze (I used a brush). Then place back in the oven for 10 minutes.' },
    { '@type': 'HowToStep', text: 'Repeat the glaze a couple more times.. brush and place in the oven for 10 minutes. You will start getting a lovely shiny finish on the ham, the slices of pineapple will start getting lovely caramelized edges and the entire kitchen will have a lovely aroma. Remember to brush on the glaze evenly. For additional color I turned on my broiler (about 450 - 500 F) and allowed the ham to sit in there for about 5 minutes. Be sure to keep an eye on it as the high heat can burn it very fast.' },
    { '@type': 'HowToStep', text: 'You\'re free to add as many layers of glaze as you like. For me.. 3 layers was enough.' },
    { '@type': 'HowToStep', text: 'Allow the ham to rest (cover in tin foil) before slicing.' },
  ],
  yields: null,
  prepTime: null,
  cookTime: null,
  totalTime: null,
  image: 'https://caribbeanpot.com/wp-content/uploads/2012/12/caribbean-ham-recipe-12.jpg',
  imageCredit: 'CaribbeanPot.com (photograph on source page)',
};

records.push(ham);
const stamped = text.slice(0, start) + '= ' + JSON.stringify(records, null, 2) + ';\n';
fs.writeFileSync(file, stamped, 'utf8');
console.log('wrote', records.length, 'records (was', records.length - 1 + ')');
