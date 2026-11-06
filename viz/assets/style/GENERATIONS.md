# Generation ledger

## CORE A pilot — 2026-11-03

Separate budget from the historical sheets below: maximum 3 calls, retries included.
Attempt 1 prompt recorded before invocation; built-in Codex image generator, true alpha.
Attempt 1 completed: `raw/core-sky-a-strip-01.png`, 1774×887 RGBA, native alpha 0..255.
Rejected as final: base camera too shallow (about 3.2:1), coloured edge flecks, small facade drift.
This prompt uses the inspected city-overview / towers-states and owner refs 1–9
as art-direction evidence; no existing image is an edit target. Source output will be retained unmodified.

```text
Use case: stylized-concept. Produce one production sprite sheet, a horizontal strip with exactly FIVE images of THE SAME CORE skyscraper, one in each equal-width cell, left to right load 0%,25%,50%,75%,100%. Desired canvas 3200x1600; five 640px cells. Transparent background with REAL ALPHA, no painted checkerboard. Same building copied identically five times, change ONLY interior illumination. Exact same camera, architecture, silhouette, mullions, setbacks, roof plant and base shape in every cell. Feet on identical baseline; equal scale; generous clear gutters, nothing cropped. No labels or text.

Building A CASCADE: a tall elegant urban skyscraper with a substantial tall four-storey glazed podium and one tall asymmetrical stepped tower rising from it, three crisp setbacks and a narrow flat crown. Compact recessed rooftop mechanical box. A refined soft architectural maquette, physically shaded frosted glass, slate-blue structure, fine subdued mullions. Tall narrow proportions; total visible height about 2.8 times base diamond width. Thin flush architectural plinth, square plan, not a thick terrain pedestal. Orthographic 2:1 isometric: both horizontal ground axes slope EXACTLY +/-0.5, verticals parallel and vertical. Base diamond width 400px depth 200px per 640px cell; centred at x=320 with front vertex y=1480, left=(120,1380), right=(520,1380), hidden rear=(320,1280); tower top near y=360. Repeat all coordinates locally in each cell. All geometry stays within base lateral width. Cool broad key light from upper left, weak soft right fill, gentle bevels and AO. The lighting direction never changes.

Cell 1: 0 load, dark navy frosted body, almost no lit windows; entirely readable ambient architectural form.
Cell 2: 25 load, a few sparse WARM AMBER occupied windows and small cyan interior patches, most floors dark.
Cell 3: 50 load, roughly half floor zones illuminated, adding to exactly the earlier lit zones, soft pale cyan internal scattering.
Cell 4: 75 load, most floors lit, remaining dark floors legible, increasing milky translucent glass glow.
Cell 5: 100 load, all occupied floor zones lit, fully luminous frosted glass, WARM AMBER windows still present, one ICE CYAN accent colour, gentle internal white-cyan volume glow, visible structural detail with no white clipping.

This is five genuinely drawn lighting states, NOT five globally recoloured or opacity-adjusted copies. Never redesign a facade or move a window between states. Do not make the bright copy taller, wider or differently shaped. Brightness stays INSIDE the architectural silhouette: NO exterior blue outline, coloured fringe, bloom halo or fuzzy rim around walls or roof. NO ground, roads, map, cast shadow or ground glow in this architecture sheet: a separate ground layer will carry base spill in the composition. No people, vehicles, signage, flags, symbols or logos. Keep the entire transparent exterior clear including gutters. Preserve premium dense city maquette character, quiet slate architecture and frosted interior light; not a neon cage, cartoon, wireframe or flat vector icon.
```

### Attempt 2 — camera and matte correction

Prompt recorded before invocation. Edit input: `raw/core-sky-a-strip-01.png`.

```text
Correct the supplied five-state skyscraper sheet for production. Keep the exact Cascade stepped skyscraper design and five load states in the same left-to-right order, but fix the CAMERA for ALL FIVE copies simultaneously. The current base diamond is too flat, approximately 3.2:1. Required ground diamond is exactly 2:1: each visible front base edge must slope 1 pixel vertically for every 2 pixels horizontally, a clear steeper 26.565 degree angle. This is orthographic dimetric game art, NOT a low-angle architectural photograph. Show more of every roof to achieve the proper camera. Keep verticals vertical. Same revised camera and same building geometry in all five cells. Base footprint width 256 and full diamond depth 128: left=(cx-128,752), right=(cx+128,752), front=(cx,816), hidden back=(cx,688) on an approximately 1775x887 sheet. Use the same thin flush plinth, bottom-centre anchor and baseline for all five copies. No nonuniform object scaling. All five copies must be IDENTICAL geometry, including podium width and number of facade window columns. Keep generous transparent gutters.

Improve the fifth state to luminous milky frosted GLASS VOLUME as in a softly lit translucent architectural maquette: all floor zones alive, amber occupancy windows and ice cyan internal glow, still readable mullions. The fourth approaches this but retains a few dark zones. First remains dark, second few lit windows, third approximately half occupied, monotonically adding light at unchanged window positions.

CRITICAL: every exterior pixel must be true transparent ALPHA. Remove all cyan/green/magenta edge flecks, stray pixels and silhouette bloom. Light stays INSIDE the building. No coloured fringe or halo, no background, floor, ground plane, ground glow or cast shadow. A separate ground layer will provide spill. Do not create black matte contamination. Preserve the cool upper-left key light, soft slate/glass material, precise stepped podium tower, no text or labels. Output one horizontal strip of five separated states, not individual images.
```

Attempt 2 completed: `raw/core-sky-a-strip-02.png`. Rejected: extensive exterior haze/alpha
contamination despite the prompt; the camera remains too shallow. Preserve as evidence.

### Attempt 3 — final budgeted attempt, fresh sheet

Shorter generation prompt; no edit target, to avoid carrying contaminated exterior pixels forward.
After this invocation the three-call pilot budget is exhausted, regardless of quality.

```text
A production game sprite sheet: exactly five identical copies of one tall stepped frosted-glass skyscraper, in five equal cells across a horizontal row. Same master architecture, same window grid and pixel-aligned silhouette in each cell. Five illumination states: dark OFF, a few lit amber windows at 25%, half lit at 50%, mostly lit at 75%, fully internally luminous frosted white-cyan glass with amber windows at 100%. Only lights change; the geometry does not.

The building has a tall rectangular podium with a thin flush plinth, one slender tall tower stepping back through three unequal terraces to a flat crown, one small recessed roof utility box. It is an elegant dense-city skyscraper maquette, realistic softly bevelled glass and slate architecture. Cool upper-left light, faint right fill. No neon outlines. No haze. No bloom. No shadow. No reflected lights outside the building. ALL LIGHT is strictly inside the opaque silhouette: the frosted material is depicted by the interior RGB shading, not by making the exterior fuzzy.

EXACT DIMETRIC GAME CAMERA, ground axes slopes plus and minus 0.5. A SQUARE footprint projects to a diamond TWICE as wide as it is deep. Both visible front base edges descend to the front vertex at 26.565 degrees from horizontal. Make roof planes clearly visible. NOT the flatter low-angle camera of architectural photos. Every building same size, about 2.6 base-widths tall, feet on exactly the same horizontal baseline. Perfectly parallel verticals. All five silhouettes MUST register identically when superimposed.

Transparent RGBA background. Clean crisp antialiased boundary directly from architecture to fully empty alpha. No transparent fog, colour fringe, ground spill, floor, labels, typography, logos, people, vehicles or scenery. Individual building fully contained in each equal cell with large clean gutters. Warm amber windows plus ONLY one ice cyan accent. Quiet dark blue-slate glass at zero, progressively milky illuminated glass at full. Draw distinct illuminated windows/floor clusters, NOT an overall tint filter. Wide horizontal single row of FIVE states 0,25,50,75,100, no text.
```

Attempt 3 completed: `raw/core-sky-a-strip-03.png`, 2172×724 RGBA. **Selected checkpoint candidate.**
Pilot total: **3 / 3 calls**, no more generations authorized. All three originals retained.
`pilot/prepare.py` cuts/aligns five native images, uses one antialiased architectural matte,
and repairs contaminated edge RGB from nearby opaque interior pixels. It does not synthesize
lighting states or recolour whole buildings. Outputs are 432×724 RGBA, anchor (216,700).
Technical metadata: [pilot/core-sky-a.json](pilot/core-sky-a.json).

Known failures against the strict contract: measured footprint ratio 2.139:1 rather than 2:1;
internal facade/roof details drift slightly despite the common cutout silhouette; delivered roof
lift is about 5.38 world units on a single inset lot, below the ~9 target. Full state retains
more opaque structure and less milky glass volume than the accepted landmark references.
This is a bounded review candidate, not a production-complete asset or owner-approved quality.
Contact sheet: `./work/shots/core-sky-a-states.png`.
Matte control: `./work/shots/core-sky-a-matte-check.png`.

## Historical reference run (before this pilot)

Built-in Codex image generator only. Three calls completed, one attempt per sheet. No API fallback. Original outputs copied unmodified into `raw/`.

## 1. key-towers — attempt 1

Use case: stylized-concept / style-transfer. Create ONE transparent sprite sheet with exactly THREE separate isometric luminous glass towers, arranged left to right in three equal-width columns, one row. Large landscape canvas. First three input images specify architecture identities only: blue slender faceted stepped hub tower; green slender faceted stepped hub tower; wider stepped flat-crown owner tower with amber LEFT and cyan RIGHT identity. Fourth input is the NEW MATERIAL and LIGHT reference: soft milky frosted glass, luminous pale white upper body blending into saturated blue/green base, physically lit translucent volume, soft AO and gently rounded edges. Retain the distinctive massing and top silhouettes of each original, but remove all dark armor, busy orange windows, purple rims, industrial grime and neon cage styling. Owner tower becomes frosted glass, warm amber core on left and pale cyan right, with its broad tiered silhouette. Thin restrained luminous vertical rods above roofs. Not wireframe; solid translucent frosted bodies visibly luminous. Orthographic 2:1 isometric camera, ground axes exactly +/-0.5 slope, vertical lines vertical; same viewing direction for all. Broad cool light from upper left, weak soft right fill. No ground, tile, backdrop, floor, cast shadow or terrain platform; isolated architecture on true transparent RGBA. Sparse local bloom only. No text, logos, symbols, people. Full objects including antennae fit within central 80% of EACH column, with at least 10% empty transparent padding on all sides and wide completely empty gutters. All three at the same world scale, their feet on the same baseline. High-end soft architectural maquette rendering, restrained and elegant. Output at the largest practical resolution.

## 2. key-landmarks — attempt 1

Create ONE wide landscape transparent RGBA sprite sheet with EXACTLY THREE clearly separated city district landmarks in a single horizontal row, equal-width columns and wide empty gutters. First three images are identity references: LEFT port-block with prominent gantry crane above cargo stacks, MIDDLE market-block with small clustered stepped shops and canopy stalls, RIGHT compact data-center with large roof fans/ducts. Last image is desired MATERIAL reference, not another object. Redraw the first three in the same soft frosted translucent glass aesthetic as the glass towers: bright milky glass bodies, subtle material opacity, rounded edges, soft ambient occlusion, luminous volume. Port is pale cyan with saturated blue-cyan base. Market is pale warm-white glass with amber-gold glow concentrated in the stalls/canopies; single warm identity, no rainbow signage. Data-center is ice-white with soft cyan base and readable softly frosted roof fans. Simplify tiny machinery and facade noise, preserve each recognizable architectural silhouette. No dark armor, black outlines, neon wireframe, hot pink or purple. Use 2:1 orthographic isometric projection: footprint edges slope exactly +/-0.5; parallel verticals. Broad cool key light from upper left and weak right fill. The large port platform in the original must be omitted: only a thin functional pier beam or building footing, NO thick terrain pedestal, NO ground plate or separate floor under ANY object. No vehicles, people, text, logos, symbols, billboards, steam cloud or background. Keep each object AND ALL its subtle local glow within central 70% of its column with at least 15% completely clear transparent margin. Isolated on real alpha, no cast shadows or painted ground. Do not enlarge objects to fill the sheet. Largest practical output resolution.

## 3. ordinary-family — attempt 1

Use case: stylized-concept. A carefully organized 4 columns by 3 rows sprite atlas of exactly TWELVE DIFFERENT ordinary city buildings, each one isolated on REAL TRANSPARENT ALPHA, evenly spaced within its own cell, no touching or overlapping. Wide landscape image, largest practical resolution. These are quiet background buildings of an architectural isometric city, NOT hero landmarks. Soft physically rendered matte charcoal blue / desaturated navy slate surfaces (#172637 to #35465A), subtle cool roof highlights, extremely sparse tiny dim warm window dots only. NO luminous surfaces, NO neon outlines, NO glowing strips, NO glass transparency, NO white rims, NO bright roof machinery. Low contrast refined architectural maquettes with soft ambient occlusion, small softly rounded edges, physically lit upper-left cool broad key light and weak right fill. All SAME orthographic 2:1 isometric camera, screen ground-axis slopes precisely +0.5 and -0.5, verticals straight. Same world scale and realistic family proportions. Twelve items in order: row 1 low long flat-roof slab; compact five-storey mid block; narrow ten-storey tall slab; low L-shaped office. Row 2 U-shaped courtyard block with visible empty middle; stepped setback midrise; square midrise with two small HVAC boxes; low wide warehouse with a restrained sawtooth roof. Row 3 three short cylindrical storage tanks with pipes as one piece; two-storey utility building with small rooftop ducts; long midrise residential slab with tiny inset balconies; irregular corner block with asymmetrical rooftop machinery. Each sprite is a SINGLE modest ordinary building or single tank assembly, not a city block of towers. Rooftop machinery small and quiet. NO base plates, floor, ground tiles, cast shadows on a floor, landscaping, roads, cars, people, text, logos, labels, backdrop. Keep all geometry entirely within the CENTRAL 65 percent of its own cell, surrounded by at least 17 percent clear transparent padding on every side. Transparent empty gutters between all twelve sprites. No halos. The reference images guide matte materials and architectural massing only; do NOT copy their red lighting, surrounding city or background.
