# Recipe Roots

Turn a public [WikiTree](https://www.wikitree.com) ancestry into a print-ready family cookbook (6×9 in PDF): the places your ancestors came from, the food history of their eras, traditional dishes from those kitchens, and **your own family's recipes, scanned from the originals**.

```bash
brew install ollama && ollama pull gemma3:4b      # any OpenAI-compatible open-weight model works
node src/cli.js Wilder-1 --title "The Wilder Table" --dedication "For Grandma"
# -> out/Wilder-1/book.pdf
```

Needs Node 20+ and Chrome/Chromium for the PDF (`CHROME_PATH` if not found). The only dependency is `pg`, and only used with a database.
Demo books (PDFs in [docs/](docs)): [one built from the author's own WikiTree tree](docs/demo-book.pdf), with one scanned handwritten recipe (`node src/cli.js Robinson-27225 --family-recipes examples/robinson-demo/family-recipes.json --title "The Robinson Table"`), and [a fully fictional one](docs/demo-fictional.pdf) with ten recipes and eight cooks (`node examples/fictional-demo.mjs`).

## What goes in the book
- **Chapters from real migrations** found in the tree: a fan chart of the lead ancestor, who moved where and when (as an honest window), a short "in the kitchen, in those years" note, and three traditional dishes.
- **A kitchen timeline** across all the eras in the book (canning, baking soda, refrigerated rail cars, rationing…), from a small hedged list in `data/foodhistory.js`.
- **The family kitchen (Part Two):** the recipes your relatives wrote down, shown exactly as shared, arranged around *who cooked them*:
  - a **page for each cook** (oldest first): portrait if you have one, a one-line life from the tree (born, parents, died, age only when full dates are known), your own words about them, their fan chart, and an **"In their time"** box of food history for the years they lived. Great-aunts, great-uncles and other relatives work, not only the direct line;
  - their recipes sorted into **categories** (suggested from the title, then the ingredients; override with `"category"`), with the original scan after any transcription;
  - the **period version of the same dish** on the facing page when a public-domain cookbook has one;
  - a **contents page with real page numbers and links**, plus indices **by category** and **by cook**.

## Period receipts: how they wrote it
Your ancestors' heritage and era also choose **public-domain cookbooks from their own time**, and the book quotes the same dish as that era wrote it, word for word, on a facing page ("How they wrote it, in 1906"), credited to the book, author, year and Project Gutenberg number. Because the sources are public domain in the United States, this is safe to print and sell. It is on by default (`--no-period` to skip); the books are downloaded once from gutenberg.org and cached.

- **Heritage and era pick the books** (`data/period-books.js`). A book written for the story's own region comes before a general American one; within each group, the nearest in time wins. A Southern line gets *Housekeeping in Old Virginia* (1877) and *The Virginia Housewife* (1860); Pennsylvania lines get Eliza Leslie's Philadelphia *Directions for Cookery* (1840) and *Pennsylvania Dutch Cooking* (undated, credited as undated, never given an invented year); New England lines get Child (1832), *The New England Cook Book* (1836) and Farmer (1906); San Francisco gets *The Cookery Blue Book* (1891); Italian lines get *The Italian Cook Book* (1919).
- **Matching is strict and deterministic.** A receipt counts only if its title names the same dish, with at most a few harmless extra words (baked, Boston, a Roman numeral). "Marrowfat Beans Baked" is not "Boston Baked Beans", "Johnny Cake" is not "Skillet Cornbread", plain "Biscuits" are not "Buttermilk Biscuits", "Baked Chicken and Noodles" (a casserole) is not stewed chicken and noodles. No match means no quotation, never a guess.
- **Nothing is rewritten.** Quotations are cut only at sentence ends, marked with "…" when shortened; italic markup and section ornaments are the only things removed. Each quotation gets its own facing page with the book, author, year and Gutenberg number.
- **Coverage today:** 19 books (18 on Gutenberg, 1 on the Internet Archive), and **28 of the 56** pantry dishes have a period receipt in at least one of them. Dishes with none are mostly continental (Spätzle, Pierogi, Köttbullar, Lefse, Pasta e Fagioli) and the Irish and Welsh baking the American books don't print. There is **no Midwestern cookbook on Gutenberg that we could find** (*Buckeye Cookery* is not there), so Midwestern lines draw on the general American books.
- **Left out on purpose:** *The International Jewish Cook Book* (1919) has good coverage, but a WikiTree profile doesn't say anyone's religion, and offering it by region alone would be presumptuous. Also left out: a French-language book, books with no matching dishes, and one whose recipes are embedded in prose.
- **Adding a book:** `node tools/book-report.mjs <Gutenberg number>` shows its year clues, how many receipts the parser reads, sample titles and the dishes it would match. Register it in `data/period-books.js` only if the year is clear (or `null` if undated), the receipts look like receipts, and the book itself states its heritage. The parser reads five heading styles (ALL-CAPS, centred, italic-inline, numbered, `=equals=`).
- **A standard recipe layout beside the original.** Period receipts are single paragraphs, so under each quotation the book sets the receipt as *ingredients, then method*, with the original kept above it. A receipt that already opens with an ingredient list is **reformatted without any AI**. A prose receipt is restructured by the model and then **checked against the original**: every quantity and ingredient must be in the text (quantities in the original's own words: "a gill", "half a pint"; no conversions, no digits unless the receipt has them), no temperature or ingredient may be added, steps must be short and non-repeating, and a receipt cut short by a length limit or a page break is never made into a "complete" recipe. A failed check just means the page shows the original. What the original leaves out ("no oven temperature") is stated, not filled in. **Measured on eight real 1907 receipts with Gemma 3 4B: five came through, three were correctly withheld.** Nothing here is kitchen-tested.
- **Heritage stickers.** WikiTree profiles carry community-added stickers (the API returns them as `Templates`): "Scotland Sticker", "Jewish Roots Sticker", a Religion Project entry. For the deceased people in a chapter, a sticker can offer a period cookbook for that stated heritage: *The International Jewish Cook Book* (1919) for a Jewish Roots sticker; *Pennsylvania Dutch Cooking* for a Pennsylvania German, Amish or Mennonite one. It is never inferred from a place name, religion is never printed beyond the cookbook's own title, and `--no-stickers` turns it off.
- **Internet Archive books** work too (OCR text; page numbers and running heads are stripped, split words rejoined). The page says "machine-read scan; small errors are possible". *The International Cook Book* (Filippini, 1907) is registered this way: the Archive's record carries a blanket "possibly protected" notice, but it was published in New York in 1907, so it is public domain in the US.
- **The public-domain rule is enforced in code, not memory:** a book published in the US **before 1926** (conservative; the line has since moved to 1931), or an undated book cleared by Project Gutenberg. A later book is never offered, even if someone registers it.
- **Not used (yet):** [Public Domain Recipes](https://publicdomainrecipes.com) (states its recipes are public domain; modern, tagged by cuisine, not by era) and the Wikibooks Cookbook (CC BY-SA 4.0: its share-alike term would apply to a book that adapts its text).
- **Not an open-ended web search.** The model does not browse the web for recipes: that would return copyrighted blog text, which a book you sell can't use. Retrieval is limited to sources with a clear free licence.

## Recipes from the WikiTree 15th Anniversary Cookbook
If you have downloaded volumes of the cookbook as PDFs, Recipe Roots can read them and find the recipes that belong to your family:

```bash
node src/cli.js cookbook ~/Downloads/cookbook-pdfs                                  # list every recipe it can read
node src/cli.js cookbook ~/Downloads/cookbook-pdfs --tree Smith-123 --write family-recipes.json --me Smith-123 --honor-code-signed --confirm-permission
node src/cli.js Smith-123 --family-recipes family-recipes.json
```
The PDFs have a text layer, and every recipe's ancestor and contributor ("WikiTreer") is hyperlinked to a WikiTree profile, so matching uses profile IDs, not guessed names. A recipe matches when it is **for** someone in your tree (ancestor, or a sibling of one: a great-aunt, say) or **shared by** someone in it (for example, recipes you contributed yourself). Imported recipes keep their story, are credited "Shared by …", and carry a printed source line (cookbook, volume, page).

- **Rights, and the gate:** these recipes belong to the members who contributed them. Nothing from the cookbook is bundled here. `--write` only writes recipes **you** contributed unless you also pass `--me`, `--honor-code-signed` and `--confirm-permission` (see "Whose photos and recipes?" below); imported recipes are marked third-party and are dropped at build time unless the gate is open, and each one is listed in `permissions.md`. Passing the gate is not the permission itself: get the contributor's agreement and check WikiTree's terms before selling printed copies.
- **Privacy:** anyone who is living, private or not found on WikiTree is **left out** unless the recipe carries `"permission": true` (add `"ancestorName"` too). A profile you can't read could belong to a living person.
- **macOS only for now:** the PDF reader uses PDFKit (`tools/pdf-runs.swift`, compiled on first use).
- **What it reads reliably:** titles, ancestors, contributors, profile IDs, page numbers, the contributor's story (set in italics). **What it can't:** recipes that are photographs (the tool reports these as image-only; use `scan` on those pages), and layouts where directions flow around a photo, which can leave a line in the ingredient list, so glance over each imported recipe. Ingredient lines that wrapped in the PDF are rejoined by a heuristic.

## Photos
- **Your own family photos** (`--my-photos <dir>`): name each file for the person pictured, `Smith-1234.jpg` or `Smith-1234__at-the-farm-1948.jpg` (the part after `__` becomes the caption). They appear beside that person, credited "family collection", and are never restricted. They take priority over WikiTree's photo.
- **WikiTree profile photos** (`--wikitree-photos`, through the gate described below): the person's primary photo appears in the credit block and as a small avatar in chapter lists, credited to the profile it came from. The caption comes from the photo's own WikiTree details (title, place, date), shown only when they say something: a title that is just the person's name or an upload default like "Image 1" is dropped.
- **The photo page's comment and uploader are not available through the WikiTree API** (and the pages are bot-protected), so they can't be collected automatically. Paste anything worth printing into a family recipe's `"photoNote"`.
- It uses the 300px thumbnail the API names (about 15 KB), falling back to the original, which is plenty for a 1-inch portrait.
- Living people's photos are never fetched; a missing or unreachable photo is simply skipped.

## Whose photos and recipes? (permission, and the Honor Code gate)
By default a book contains only content that is **safe to sell**: WikiTree *facts* (names, dates, places), the curated heritage dishes (matched to your ancestors' regions and eras), the kitchen history, and **your own family's recipes and photos**.

Photos and recipes that **other WikiTree members** uploaded or wrote are different. They belong to those members, and a book you sell needs their permission. So they are off unless **all three** hold:

| | |
|---|---|
| `--me <your WikiTree ID>` | checked against WikiTree: must be a real member account |
| `--honor-code-signed` | you attest you are a **Wiki Genealogist**, i.e. an Honor Code signatory ([membership levels](https://www.wikitree.com/wiki/Help:Membership)). Your profile shows "Honor Code Signatory" |
| `--confirm-permission` | you have each owner's permission to reproduce their photo or recipe in a book you may sell |

```bash
node src/cli.js Smith-123                                   # facts + curated dishes only
node src/cli.js Smith-123 --my-photos ./family-photos       # + your own photos (never restricted)
node src/cli.js Smith-123 --family-recipes mine.json        # + your own recipes (never restricted)
node src/cli.js Smith-123 --wikitree-photos --me Smith-123 --honor-code-signed --confirm-permission   # + WikiTree photos
```
When any third-party item is used, the build writes **`permissions.md`** next to the book: each photo and recipe, its owner, and where it came from, so you know exactly whom to ask before you sell.

**What this can and can't enforce.** WikiTree shows Honor Code status on the profile page, but **not in its API**, and pages can't be read by a script, so the tool **cannot verify** it. `--honor-code-signed` is an attestation, recorded as one in `permissions.md`, and the gate otherwise **fails closed** (no flags, no WikiTree photos or recipes). It is a guardrail for honest users, not protection against someone who simply passes the flags or pastes a recipe into their own JSON. Real enforcement needs WikiTree's help: an API field for membership level, or a login flow.

## Bringing in family recipes

Photos or PDFs of recipe cards and books, assigned to a specific person:

```bash
node src/cli.js ancestors Wilder-1 --relatives          # find the WikiTree IDs, incl. aunts/uncles
node src/cli.js scan ./my-scans --tree Wilder-1 --contributor "Cousin Jo"
node src/cli.js Wilder-1 --family-recipes family-recipes.json
```

Each scan is assigned to a person by **file name** (`Smith-1234__beef-roll.jpg`), else by **folder name** (`my-scans/Smith-1234/card.jpg`), else `--ancestor`. Nothing is guessed: unassigned files stop the run before any work is done. `--tree` confirms who each ID is ("Smith-1234 → Jean Smith (great-aunt)").

- **Transcribe** (default): Gemma 3's vision reads the card into ingredients and directions, exactly as written (`[illegible]` instead of guessing). A second pass reads only the numbers and flags any disagreement, because a misread "tsp"/"tbsp" ruins a recipe. The page stays marked *Transcribed by AI, check amounts* until you set `"reviewed": true`.
- **`--page-only`**: no transcription; the scan itself is the page. Best for handwriting, and needs no model.
- The scanned image is printed on the page after its transcription (`--no-scan-page` to leave it out).
- Edit `family-recipes.json` freely: fix the model's mistakes, change `ancestor`, add a `story`, a `source` citation (printed under the credit), a `photoNote`, or set `showScan`.
- Anyone who is living or whose profile can't be read is left out unless the recipe has `"permission": true`.

Scans never leave the machine: the vision model runs locally.

**Proofreading:** `node src/cli.js review family-recipes.json` writes `review.html` beside the file: every scan next to what the model read, the recipes still unchecked marked, and any amounts the two readings disagreed on called out. Fix `family-recipes.json`, then set `"reviewed": true`.

**The people behind the recipes:** `--family-people people.json` takes `{ "Smith-1234": { "story": "She baked on Sundays.", "photoNote": "At the farm, 1948" } }`. The story is printed in the family's words on that cook's page, never rewritten. Everything about a person's life that *isn't* in your file comes from the tree, written by code, not by the model.

**Page numbers:** Chrome can't count pages for a contents list, so the book is rendered, the page of each section is read back from the PDF (PDFKit on macOS, `pdftotext` elsewhere), and it is rendered again until the numbers stop moving (normally two passes). If the PDF can't be read, the contents page is printed without numbers rather than with wrong ones.

## How the text is written (and why)
Small open models are good at prose and unreliable about people, so the work is split:
1. **Code writes every fact about people** (names, kinship, places, years) straight from the tree. Living people are never included.
2. **The model writes only about the food.** It is never shown a name, relation, or birth/death date, so it has nothing to invent a biography from. It sees the places, era background, kitchen history and each recipe's note.
3. **A guard checks every draft:** years not in the supplied facts, kinship words, speculation stated as fact ("would have"), invented motives, meta commentary, number-first openers, or any person's name are rejected. Failed parts get one retry with the reasons, then fall back to templates *individually*. The book's "About" page says truthfully which chapters are model-written.

This design came from reading real output: an earlier version let the model write about people, and Gemma 3 4B invented relationships ("their great-grandfather… to join them") that a year-checking guard could not catch.

## Recipe search with Postgres + pgvector (optional)
```bash
export DATABASE_URL=postgres://localhost:5433/recipe_roots   # or a Tiger Cloud connection string
node src/cli.js ingest                                       # embeds the pantry with EmbeddingGemma
node src/cli.js Wilder-1                                     # now picks dishes by semantic search
```
Dishes are filtered by region and year in SQL, then ranked by similarity to what a family from that place and era might have cooked. Search is deliberately **exact, with no ANN index**: the filters leave a handful of rows, and ANN indexes lose recall under selective filters. If a homeland has no dishes in the pantry, the nearest cuisines are offered as clearly labelled **"stand-ins"**. That search is approximate (it ranked Denmark → Germany/Netherlands, Hungary → Poland/Germany well; Finland and Portugal poorly), and improves as the pantry grows. Without a database the tool uses a deterministic picker.

**The receipt library (hybrid search).** `node src/cli.js ingest-receipts` loads every receipt from the 19 public-domain cookbooks (about 19,000) into Postgres, each with an EmbeddingGemma vector, plus a keyword index: **BM25 via Tiger Data's `pg_textsearch`** on Tiger Cloud, or Postgres's built-in full-text search where that extension isn't installed. A search runs both rankings over the same filtered rows (only the books that fit the cook's era and region) and fuses them with Reciprocal Rank Fusion in one SQL query. It is used by `--similar-period`, for a family recipe whose title matches no receipt exactly:
- a receipt that is **the same dish under another spelling** ("Shoofly Pie" / "SHOO-FLY PIE", "Spaetzle" / "SPAETZLEN OR SPATZEN", "Johnnycake" / "JOHNNY CAKE") is used as the dish itself, when the vector search ranks it in its top three;
- otherwise the closest receipt is offered only if **both rankings put it in their top five and its title shares the dish's own noun**, and the page says "A similar dish" and "Not the same dish".
Anything weaker shows nothing. Measured on the 56-dish pantry: strict title matching finds 27; the hybrid search adds 2 spelling variants and 1 similar dish, and finds nothing for the other 26 (mostly continental dishes the American books don't print). A shared place word ("Swedish") or ingredient ("blueberry") is not enough, which is why an earlier looser rule was dropped.

**Tiger Cloud:** tested on a free Tiger Cloud service (PostgreSQL 18.6, pgvector 0.8.7, TimescaleDB 2.30): `ingest` loaded all 56 dishes and a build ran its semantic search there. Two connection details: Tiger's certificate is signed by a private CA that Node doesn't trust, so a plain `sslmode=require` URL fails with `self-signed certificate in certificate chain`. Add `&uselibpqcompat=true` (node-postgres then behaves like `psql`: encrypted, but the server's certificate isn't verified). To verify it as well, download the service's CA certificate from the Tiger console and use `sslmode=verify-full&sslrootcert=/path/to/ca.pem`. The URL carries a password: keep it in the environment, not in a file.

## Does restructuring a recipe get around copyright?
Not as a safe assumption, and nothing here relies on it. In the US, a bare list of ingredients and a basic method are generally not protected by copyright, but the *expression* around them is: the descriptive wording, headnotes, stories, photographs, and a book's selection and arrangement. Re-laying-out someone's recipe is not a safe harbour: a layout that stays close to the original's wording is still derived from it, and our checker deliberately forces it to. So:
- For **public-domain sources** (everything under "Period receipts") copyright isn't the issue at all, so the recipe layout is there for **usability**, and the original is kept for authenticity and credit.
- For **other WikiTree members' recipes and photos**, the obstacle is not only law but permission, WikiTree's terms and the community's trust (the Honor Code gate above). Restructuring a member's recipe does not change that, and the member's story and photo are creative expression either way.
- **"Public domain in the United States"** is what we claim. If you sell abroad, term rules differ (often life plus 70 years); for the nineteenth- and early-twentieth-century books here that is rarely a problem, but it is not guaranteed.
- This is engineering notes, not legal advice. Before selling, ask someone who can give it.

## Honest limitations
- **Pantry recipes are not the family's recipes** and every page says so. 56 dishes in 18 regions, written from standard published versions and checked for plausibility, but **not kitchen-tested**: cook one before you gift it. Stories with no era-appropriate dishes are skipped, and chapters prefer different corridors so a book doesn't repeat itself. Contributions to `data/pantry.js` and `data/pantry-heritage.js` help most.
- **The guard can't verify meaning.** It blocks invented years, kin, names and some speculation, but a model can still connect dots loosely (e.g. tying a dish to Fannie Farmer). Read the book before you print it.
- **Handwriting:** transcription read clean cards (a typed card and a handwriting-style font) correctly, but the first real handwritten card (a two-column pudding recipe, quantities down the left and "mix well" notes on the right) went badly with Gemma 3 4B: it read **½ cup cocoa as "2 c."** and **2 T butter as "2 t"**, split the one card into two recipes (now merged by title), and filed some ingredients under directions (now moved back). The number cross-check flagged the cocoa (and marks the doubtful lines in `review.html`) but didn't catch the butter. **Treat handwriting transcription as a draft to proofread against the scan, and use `--page-only` for anything you care about**, which prints the scan itself as the page and needs no model.
- **WikiTree:** profiles whose ancestry isn't public return "permission denied"; there is no login flow. WikiTree's recipe pages are behind bot protection and have no API, so they are not scraped; recipes come from your own scans. Searching ~830 ancestor bios across 7 public trees found recipe words in exactly one, so auto-discovery isn't practical.
- Tested against local Postgres 17 + pgvector 0.8.7 and a free Tiger Cloud service (PostgreSQL 18.6, pgvector 0.8.7); the Tiger run used encrypted but unverified TLS (see above) and was one ingest plus one build, not a load test.
- Print-on-demand specs (bleed, spine, cover wrap) aren't implemented: the PDF is an interior at 6×9 in.

## Tests
```bash
npm test      # 102 tests: regions, migrations, guard, writer (mock model), family recipes and people, photos, cookbook parser, permission gate, pantry, period receipts, receipt structuring, categories, cook pages, page-number pass, kitchen history, review sheet
```
