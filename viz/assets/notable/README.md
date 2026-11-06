# Pilot notable architecture

Visible only at `?map=1&kit=1` (explicit `sprites=1` retains the previous sprite path).
The seven owner/hub towers remain unchanged and own the strongest light. These
three buildings distinguish themselves by architecture, never by a brighter beacon.

## Sources and build

`_build/models.js` is the reproducible geometry source. All creation is code:
barrel-vault railway terminal with ribs, longitudinal purlins, glazed end walls,
side wings and entrance pylons; civic dome with a colonnaded plinth, windowed drum,
ribbed hemisphere and lantern; continuously tapering/twisting tower with curved
ribs, floor bands, an outer glazing skin and split crown. None uses generated
images. City palette/projection reference: `../map/pipeline/render.py`.

The build uses **three.js 0.180.0**, exactly locked, in a private headless Chrome.
All build code/dependencies are in `_build/`, excluded by Go embed's underscore
rule. The runtime page requests only the manifest, 18 PNGs and `placement.js`;
no WebGL, three.js dependency or model geometry is shipped to the page.

```sh
npm ci --prefix viz/assets/notable/_build --ignore-scripts
node viz/assets/notable/_build/build.mjs
```

The attached runner owns HTTP 8913, CDP 9213 and a private Chrome profile, closing
all three in `finally`. It refuses occupied ports. Requires Google Chrome on macOS
and Node with built-in fetch/WebSocket. The sprite build uses SwiftShader; Canvas2D
map evidence uses `--disable-gpu` to avoid SwiftShader's slow software blur path.

[OrthographicCamera](https://threejs.org/docs/#api/en/cameras/OrthographicCamera)
and [WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer) provide
the build API. No model from an external library or service is reused.

## Projection, lighting and state

Coordinates are x/z ground axes and projected height pixels. Orthographic camera
looks from `(200,200*sqrt(2/3),200)`, pitch **30 degrees**; root Y is scaled by
`1/sqrt(1.5)`, uniform output density is 4 pixels per authored grid unit. This gives
exactly `(x-z, (x+z)/2-height)`, not standard 35.264-degree isometry and not a warped
sprite. Four projected controls in every manifest record verify both ground axes,
anchor and vertical lift numerically. Raster framing includes the back roof extent.
Light comes from upper left/positive Z, matching the brighter left wall in the kit.

Each model has one transparent base and 0/25/50/75/100 transparent emission layers.
Window thresholds are stable and nested. Opaque geometry still writes depth during
the emission pass; black geometry is removed from the resulting alpha, preventing
hidden windows leaking through the model. Map district bins control the overlays.
The colors are deliberately dimmer than key windows; the map's inherited window
bloom applies consistently. RGB/alpha nesting and independent Chrome rerenders
are tested; imagegen generation count here is zero.

## Placement and ordering

`../map/landmarks.json` is authoritative: exact model, grid position, district,
source-lot provenance and 3-unit plaza. `placement.js` checks the complete reserved
rectangle against every road capsule (including half-width) and all seven key
footprints. Intersecting ordinary boxes are removed deterministically. The model
footprint is never resized to fit a lot. Plazas are drawn before buildings.

The combined scene is topologically sorted using the same behind relation as
`render.py`, with original box-coordinate tie-breaking. Each district's emission
pass erases previously drawn windows using the exact raster alpha of foreground
styles/notables, rather than a bounding box. Notables do not acquire tooltips.
Camera-fit and labels are shared with the boxes path. Existing road/terrain pixels
and the seven key buildings remain their authored data.

## Verification and known limits

`node viz/tests/pilot2.test.cjs` verifies all source fits/heights, exact camera,
independent pixel repetition, nested lights, bounded model footprints, road/key
negative controls and every painter relation. `shots/repeatability.json` records
two independent Chrome sprite builds. Final live frames/performance/limitations
are in the coordinator's `viz-pilot2-REPORT.md` and `shots/pilot2-*`.

This is a three-building pilot, not a populated 1–2% notable tier. Small landmarks
remain subordinate at overview scale; neighboring streets/buildings still provide
real occlusion. Source terrain retains baked shadows from the original boxes;
plazas cover the reserved lots, but not every shadow tail outside a reservation.
The UI/visual owner has not accepted the pilot. No production hub data is used.

## Full fixture reproduction

```sh
npm ci --prefix viz/assets/kit --ignore-scripts
# In an attached terminal; prints READY, then waits for "stop".
python3 viz/tests/pilot2/serve.py
# In a second terminal, while the fixture is running:
node viz/tests/pilot2/capture.mjs
node viz/tests/pilot2/evidence.cjs
# Then type stop in the first terminal and verify /tmp/viz-pilot2-13/cleanup.json.
```

The fixture runner derives ports from slot 13 (8813/8814, captures 8913/9213),
uses only `/tmp/viz-pilot2-13/fixture-home` and synthetic Codex limits, and compiles
copies without node_modules. Comparison baseline is pinned to viz-render commit
`d4dc085183a06464b781111b4bcd7063b8d17ef6`. It never serves the live shared hub home.
Each final reserved plaza is also checked against every sampled pixel of the
original land mask; a rejected shore-overhang is a negative control. Projection
bounds keep each notable off every key silhouette and the owner's approach.
