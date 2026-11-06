# Accepted fixed city (browser prototype)

Open `/?map=1&lang=ru&follow=0`. Boxes are the default; `sprites=1` opts into the generated CORE comparison. `sprites=0` explicitly keeps boxes.
`map=1` wins if `layers=1` is also supplied. Without `map=1`, the legacy and layered modes keep their own assets and geometry.

## Sources and reproduction

The owner/hub's accepted `city/` package (2026-11-04) is copied here byte-for-byte for city.json,
roads.json, land.png, plan.png and render-final.png. Never regenerate layout in the browser.
`pipeline/render.py` is the accepted visual recipe with only its filesystem root made relative.
Road/build scripts and their three original reference inputs are included. `pipeline/patch_*.py`
are historical applied edits, **do not rerun** (some preserve historical absolute paths).

To compile the committed fixed data with Python 3, Pillow and numpy:

```sh
python3 viz/assets/map/pipeline/pack.py
node viz/tests/map.test.mjs
node viz/tests/layers.test.mjs
```

This writes pack.json (graph, regions, original painter order, key IDs), ground.png (exact
reference water/land/roads/shadows/trees), street-glow.png and roof-glow.png. It does not modify
city.json or roads.json. The full reference frame can be reproduced with:

```sh
python3 viz/assets/map/pipeline/render.py /tmp/map-reference.png
```

Upstream `roads.py` / `build.py` document how the accepted layout originated; rerunning the
pre-patch pipeline is **not** a substitute for the committed final JSON. Historical patches
and review exports explain the one-time layout edits. The shipped pack compiler and renderer
always consume the exact final accepted layout.

## Coordinates and routing

Roads use source pixels (2000x1125). Buildings/trees use the rotated grid frame from city.json.
The browser uses 12 grid pixels per existing world unit, translated by `(54,64)`. At reference
scale `P=(ox+X-Y, oy+(X+Y)/2-h*6.5)`, with `h=rawHeight**1.25`, exactly as render.py.
The overview contains the 2400x1200 reference crop; larger aspect ratios add dark margins.

The pack splits all real intersections and snaps touching endpoints onto the contacted road.
Original centreline fragments stay intact; explicit tiny connector edges lie inside the
painted road corridors. Every edge records its original road piece and class. All 308 pieces,
56 street IDs, 2793 nodes and 2916 edges form one connected component; no isolated roads.
Class-weighted shortest paths (avenue .65, collector .8, street 1.35) prefer through streets.
Cabs read as restrained bright moving road points at overview; the model sprite becomes visible when zoomed. Cabs and ambient cars follow edges with a right lane offset, eased junction entry and
small quadratic fillets wholly within road corridors. The source-pixel maximum cab distance
is measured by the test, not inferred from the picture.

On disappearance a cab reverses its existing route cursor, returns to its hub's road-access
node and descends there. Reappearance continues the existing cursor and bounded altitude;
there is no flight/teleport across a block to the tower footprint. The lane side eases across
when direction reverses. Landed cabs are removed by the unchanged page lifecycle.

## Districts, keys, load and caches

Nine seeds are in pack.json, CORE exactly at city.core. Nearest-seed graph distance partitions
streets and bridges; buildings use their nearest graph node's district. Building-only land
islands use the nearest road region, without inventing a bridge. Labels avoid key/cab bounds and visible HUD panels. Key labels use leaders to a visible part of their own tower; the main hero has an explicit owner label. Repo mapping and telemetry are inherited.
Key assignment consumes the six fixed key lots in proximity order as hubs arrive; after six,
additional hubs take distinct tall existing lots. Repo district in a tooltip remains semantic;
a fixed landmark can physically lie in another map district.

Owner (explicit gold label): box **488**, the largest hero. Hubs: hero spires **463, 477**, amber landmarks
**1910, 2332, 3032**, and ordinary tall building **1853** (`[-51.61,-110.57,-35.98,-81.15,12,b]`).
No key height or footprint is changed. Owner faces show Claude/Codex remaining plan shares;
actual values remain in the existing tooltip and roster. Some key walls overlap in the accepted
projection; hit testing uses visible wall/roof silhouettes in front-to-back order.

LayerCity supplies worker counts and hysteresis unchanged: non-hub workers /10, nearest 25%,
±.025 hysteresis. Every box window has a stable building/face/floor/column hash threshold.
Five load bins are nested sets; floors brighten progressively. Missing district data uses
explicit neutral50, not a fabricated measured value. Fixed hub keys remain fully illuminated.
The static geometry, terrain and each district's windows have separate overscanned 1.25x zoom
tier caches. Only a changed district bin invalidates its window cache; the dependent combined scene is then recomposited. Owner limits have their
own cache. A camera tier/viewport/recenter change legitimately rebuilds visible passes to preserve overscan.

The single `MapCity.drawBuilding(box, pass, district)` function owns architecture and window/occlusion rendering. A later facade kit can replace that boundary without touching telemetry or routing.

## Existing generated sprites

manifest.json controls eligibility, family list, anchors, measured base widths and five state
files. The optional `sprites=1` mode imports 30 **unmodified** A-F sprites from agent/viz-core-rest. See
`../style/family-run.md` and `../style/family/core-sky-*.json` for known defects/provenance.
Only kind=b, raw h>=6 and footprint ratio<1.4 qualify; all key objects are protected. There
are 121 eligible buildings. Stable ID hashes choose a family, avoiding the four nearest already
assigned neighbours within 6 world units when possible. The largest square inside the original
footprint determines a single scale for both axes; sprites are never stretched. Their measured
height replaces box height for bounds and actual alpha silhouettes handle foreground occlusion.
State comes from that building's district. Appearance/registration drift between generated
states remains in the original art and is not corrected in code.

## Browser evidence runner

Build `go build -C viz -o /tmp/map-viz .`, start it against a **fixture-only home**, and start
an owned headless Chrome with its own profile. Supply your own collision-free ports:

```sh
node viz/tests/capture-map.mjs 9881 8871 8771 /absolute/output/shots
```

Arguments: Chrome CDP, unchanged viz-render baseline fixture server, current fixture server,
output directory. Uses the existing coordinator make_fixture.py format (six stages/30 live
harmless workers). `VIZ_MAP_FIXTURE` defaults to `/tmp/viz-map-11/fixture-home`; the runner
appends one synthetic journal line only under that fixture. It never starts/stops processes.
Both servers must read the same fixture and isolated Codex rollout home. Caller owns exact
PID cleanup. No live home, schema, Go server or Swift saver is modified.
