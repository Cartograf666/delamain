# Fixed-style pilot (current)

The pilot supersedes the checkpoint-only stop below. `?map=1&kit=1` loads
`styles.js` and the four data recipes in `kit.json`; `?map=1` keeps boxes and
`sprites=1` keeps its established path. Without `map=1`, no kit code loads.

Each recipe fixes its facade, ground/top rows, corner line, roof/equipment,
silhouette and nominal bay/storey proportions. Only style selection, setbacks
and stable window phases depend on the building hash. `styleDistricts` binds
recipes to districts with explicit height eligibility. The new source contains
two large panes per bay, not the checkpoint's four small windows. Glass tower:
vertical curtain wall; glass slab: strong cyan horizontal spandrels; office:
light blue concrete frames; house: navy masonry and pitched row roof.

`pack-styles.py` packs one additional generated flat 4×3 sheet to 32×28 modules.
It preserves the art, extracts two explicit pane interiors and records crops.
The original roof plans are reused. `GENERATIONS.md` records **1/8 additional
calls**, five calls across both kit stages. Three-dimensional notables do not
use image generation. `styles-base.png` and `styles-emissive.png` are 136×90;
combined original+style atlas decoded RGBA memory is **763,776 bytes**.

`KitStyles.loadBrowser(url, options)` loads both atlas pairs.
`KitStyles.plan(input,manifest)` / `KitStyles.render(kit,input,state,resolution)`
use original footprint units and `H = rawHeight ** 1.25 * 6.5` projected pixels.
Original height and lot dimensions stay exact; every module fits within 12%
of its recipe's nominal proportion or is clipped at the terminal bay/storey.
Whole-building sprites are never stretched. The raster anchor is the rear ground
corner for styles, and the footprint centre for notable sprites.

Map assembly retains one geometry mask per building at its current camera
resolution, plus a bounded 64 MiB state LRU. It reuses geometry masks across ten
window passes to avoid full-city eviction/reassembly. `styles.js` keeps a finite
flat-module cache. Camera tiers render at 1–4 pixels per projected grid unit;
this is uniform camera sampling, not a geometry fit. State 0 skips emission.

Reproduction: `python3 viz/assets/kit/pack-styles.py`, then
`node viz/tests/pilot2.test.cjs`. Existing `kit.test.cjs` still covers the original
checkpoint API below. Integration and 3D documentation: `../notable/README.md`.
Owner next action is to judge `shots/pilot2-overview.png`, the core/district zooms,
styles/notable sheets and boxes comparison linked by `viz-pilot2-REPORT.md`.
No owner acceptance or release is claimed.

---

## Original checkpoint documentation (historical API)

# Modular facade kit — owner checkpoint

Status: implemented and technically checked; awaiting the owner's yes/no.
No map integration. Branch `agent/viz-kit` started at the `agent/viz-map` tip
`ed72e9220c20d97ddbcedd97b8848c5a484ba068`. Nothing outside this kit and
`viz/tests/kit.test.cjs` was changed.

Open `shots/kit-sheet.png` for all modules at **exactly 3×** with five states.
Open `shots/kit-buildings.png` for 16 buildings and one repeated in five states.
These are headless-Chrome canvas exports from `assemble.js`, not hand composites.
Review appearance and approve/reject the kit before any map work.

## Art and source provenance

Flat orthographic elevations: no perspective, ground/sky, cast shadow or baked
left/right wall shading. Blue glass/concrete, amber and cool white windows.
References: `./work/city/render-final.png`
and `./work/refs/target-city.webp`.
Existing whole-building sprites were inspected as mood only, not reused.
All art comes from **4 Codex built-in image-generator calls**; budget 12.
`GENERATIONS.md` contains prompts recorded before calls. `raw/*.png` retains
all original outputs. `pack.py` cuts, aligns existing pixels, fixes seams and
separates emission. No procedural facade or roof artwork substitute is used.

## Grid, slots and naming

Wall tile: **32 × 16 px**, one bay × one floor, four panes. Roof: **32 × 32 px**,
one bay × one bay, top-down flat plan. No baked isometry.
Families: `glass`, `office`, `house`. Each has all nine combinations of
`ground|mid|top` × `edgeL|middle|edgeR`, two designs each, plus a third
`mid/middle`: **19 wall modules per family, 57 total**.
Names: `family-row-column-design`, design starts at 1.
Nine roof modules: `family-roof-flat`, `family-roof-machinery`, and
`glass-roof-helipad` / `office-roof-setback` / `house-roof-setback`.
Office/house setback caps are included in the sheet as optional variants;
the current deterministic assembler selects flat/machinery for those families.

Source wall sheets are four columns × five rows. Row-major order:
ground edgeL 1/2, ground middle 1/2, ground edgeR 1/2,
mid edgeL 1/2, mid middle 1/2/3, mid edgeR 1/2,
top edgeL 1/2, top middle 1/2, top edgeR 1/2, spare (not packed).
Roof sheet is three family rows × three variant columns.

Canonical pane interiors are x=[3..8), [10..15), [17..22), [24..29), y=[4..12).
Emission rectangles include one-pixel resampling edges: [2,3,7,10], [9,3,7,10],
[16,3,7,10], [23,3,7,10]. All wall modules share these exact positions.
Opposite wall borders match pixel-for-pixel; every family shares its seam bands.

## Atlas and states

`kit.json` version 1 describes each module's `id`, family, row, column, design,
size, `[x,y,w,h]` atlas rect and windows `{rect,threshold}`. `sources` records
original sheet and crop rect. Both RGBA atlases are **272 × 306 px**:
`atlas-base.png`, `atlas-emissive.png`. Packing cells are 34 px with a duplicated
one-pixel gutter. Decoded atlas total: **665,856 bytes (0.635 MiB)**.
PNG byte counts and measured runtime data are in the report/test JSON.

States: **0,25,50,75,100**. Each module has a stable permutation of four window
thresholds, one pane added per quarter. A building's cell hash applies a stable
0..3 phase rotation, varying light by floor/bay. The phase does not change with
state. At 100 all panes are on; at 0 emission is transparent. Base pixels never
change with state. Roofs are non-emissive; equipment highlights and the H are
paint. The page can bloom the returned `emissive` canvas only.

## Inputs, proportions and assembly

Public input: `{id,w,d,h,type,zone?}`, finite positive dimensions, maximum 128.
The actual city source is `{boxes:[[x0,y0,x1,y1,h,type],...]}` rather than named
objects. `fromCity(city, pack.districts)` adapts it without changing the source.
`w=x1-x0`, `d=y1-y0`; `h` is the raw city height, not the existing renderer's
`h**1.25` lift. This kit is a checkpoint and is not a drop-in map projection.

Family: glass for type hero/core/glass/tower/high, zone core, or h>=6; otherwise
office for type office/mid or h>=2.5; otherwise house. `land` uses height rules,
remaining blue rather than inheriting the old brown/gold material.
One world footprint unit = one bay. Floors = max(2, round(2*h)); bays =
max(3, round(w/d)). These mappings are explicit technical defaults for review.
The two-floor minimum supplies ground and top. Ground occupies only floor 0;
then mid rows; final row is top. Every wall has left edge, middles, right edge.

Each axis fit = clamp(requested/count, **0.88,1.12**). `plan.w/d/h.residual`
reports `count*scale-requested`. All 4367 actual footprints fit exactly; some
short heights retain a quantization residual (max 0.16 floor, 0.08 input h).
No whole sprite is stretched. Each module receives only those fit scales plus
a separate, uniform camera `resolution`, which is not a geometry fit.

FNV-1a over the building id and explicit cell keys selects designs. Vertical
runs last six floors; walls of 10+ bays repeat a two-bay rhythm. Glass towers
at 20+ floors and at least 5 bays per side get one setback; at 36+ floors and
7+ bays per side get two. Each tier retreats one complete bay from every edge.
One-tier floor split: 68%/remaining; two-tier split: 55%/25%/remaining, rounded
down except the remainder. Upper tiers begin with mid, not entrance rows.

Left wall transform has slope +0.5; right -0.5. Right base wall receives 30%
navy shading at assembly, while source modules remain identical. Roof transform
maps flat x/y to `(x-y,(x+y)/2)`, a 2:1 diamond. Flat roof tiles repeat; a selected
machinery/helipad tile occupies one central bay. No cap stretches across a roof.

## Browser and Node API

Browser: load `assemble.js`, then `await FacadeKit.loadBrowser('/path/to/kit/')`.
`kit.render(input,75,{resolution:0.25,bloom:false})` returns `{base,emissive,
canvas,plan,width,height,anchor,bytes}`. Anchor is the front ground corner.
`kit.tile(id,state,phase)` returns flat base/emissive/composite canvases.
Input state must be one of the five states; phase must be 0..3.

Node example (after `npm ci --prefix viz/assets/kit --ignore-scripts`):

```js
const fs = require('node:fs');
const { Kit } = require('./viz/assets/kit/assemble.js');
const { createCanvas, loadImage } = require('./viz/assets/kit/node_modules/@napi-rs/canvas');
const dir = './viz/assets/kit/';
const manifest = JSON.parse(fs.readFileSync(dir + 'kit.json'));
(async () => {
  const kit = new Kit(manifest, await loadImage(dir + 'atlas-base.png'),
    await loadImage(dir + 'atlas-emissive.png'), createCanvas);
  const result = kit.render({id:'example',w:8,d:7,h:10,type:'glass'}, 50);
  fs.writeFileSync('/tmp/kit-example.png', result.canvas.toBuffer('image/png'));
})();
```

Optional Node adapter is locked to `@napi-rs/canvas` 0.1.80; browser has no external
runtime dependency. API reference: https://github.com/Brooooooklyn/canvas.
Packer requires Python 3, Pillow and NumPy (present on the authoring machine).

Cache key includes all input dimensions/type/zone, id, state, resolution and
bloom. Building outputs use a **32 MiB LRU** by default, counting three RGBA
surfaces per entry. Oversized entries render but are not retained. `clearCache()`
clears building references; existing returned canvases remain usable. Module
cache is finite (66 ids × five states × four phases); actual usage is measured
separately. Canvas dimensions above 16 megapixels are rejected. GPU/browser
bookkeeping and transient allocations are not included in RGBA byte counts.

## Reproduction and evidence

From repository root:

```sh
python3 viz/assets/kit/pack.py
node viz/tests/kit.test.cjs
node viz/assets/kit/render.cjs
git diff --check
```

The renderer uses installed Google Chrome, port 8912 and CDP port 9212 (slot 12),
a new temporary profile, and closes its own server/process/profile in `finally`.
It refuses an occupied CDP port. `shots/processes.json` records its PIDs/closure.
It writes both checkpoint PNGs and `shots/browser-tests.json`.

Node tests check 66-module coverage, exact seam pixels, fixed window positions,
1320 module/phase/state masks, exact pane counts, 35 independent pixel repeats,
building-level monotonic emission, all 4367 fits, validation and cache behavior.
Chromium checks 15 independent pixel repeats, base invariance, cumulative masks,
and all 4367 actual buildings; SHA-256 pixel hashes establish **4367 distinct
rendered buildings at state 75, resolution 0.25**. This is a measured corpus
count, not a claim of an exhaustive combinatorial capacity. Timing excludes
PNG encoding and SHA hashing; wall time including hashing is recorded separately.

## Known limits and next action

The three families share a close blue palette; differences become subtle at
city overview scale. Small source door-handle/mullion highlights remain in base.
Utility caps occupy one bay and appear small on broad roofs. Roof light states
are intentionally identical. Very short buildings retain documented height
quantization residuals. Node/Chrome rasterizers are tested independently, not
claimed pixel-identical to one another. Full map/device/owner acceptance is not
performed. No browser/server process is left running.

Owner next action: inspect both PNGs and say yes/no to the modular kit. Stop here;
no viz.html or mapcity.js edits, push, PR, merge, or map substitution.
