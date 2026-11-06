# GPU live city

The real Go page uses this renderer at `/?map=1&live=1&lang=ru&follow=0`. The native header, roster, legend, follow, pins, labels and tooltips are retained. The default page without `map=1` is unchanged.

For an isolated review, from the worktree root run:

```sh
python3 viz/tests/gl/serve.py
```

Open `http://127.0.0.1:8818/?map=1&live=1&lang=ru&follow=0`. This builds the actual Go server and creates a fixture home with 30 harmless workers under `/tmp/viz-gl2-18`. Enter `event` for journal traffic, `restart` to rebuild, or `stop` to close all owned processes. It does not open the live hub home. See `viz/tests/gl/README.md` for verification commands.

## Rendering and data

- `main.js`: fixed 2:1 isometric orthographic GPU geometry, instanced windows, mipmapped ad art, rounded road geometry and a bounded 960×540 glow pass. No city raster base, tile cache or zoom-time mesh rebuild. The source projection is baked into vertices; this is intentionally not an orbitable 3D model.
- `painter.js`: triangulated foreground paths, continuous tapered ribbons with rounded joins/caps, analytic gradients and sprites. Soft effects render in the bounded glow pass; sharp lines and images render at the full canvas resolution.
- `selection.js`: geometry-derived visible silhouette mask, depth-clipped outline, rendering restricted to the selected object's screen bounds. Owner/stage buildings and worker sprites have contour highlights rather than circle markers.
- `live.js`: reuses the existing heat, replay, history, alerts and native page objects. `runtime.js` ports version 33 flight/slots and the subsequent owner corrections.
- `export.py`: source `cp.py` placement, palette, source PRNG, GRP parts, roof machinery, windows, signs and projection. Original source hashes are in `scene.json.sources`; geometry ownership and surface metadata support selection and facade lighting. `select-pads.cjs` executes only the source's pure ROOFP/LPD selection block.

Ordinary buildings share one indigo-violet palette, warm window grid and outline colour. Depth fog, edge fading and local lights still affect their rendered colour. Main buildings and accepted landmarks keep their authored appearance. All equipment boxes have both visible walls and the top. All 58 selected pad roofs are cleared of equipment, antenna masts and red beacons; pads are only 4 corner points, or 6 on D pads, blinking when occupied. Slot occupancy prevents two vehicles claiming the same space; D holds two small or one large.

No flight is started without working state or a journal work event. Aircraft art is selected by engine and model tier. There are no ground shadows or short bouncing flame strokes. Engine trails start at the source THRUST points, with one soft glow under the body. Final approach/alignment/descent advances at 2.5× the previous rate, ending vertically; a close target does not circle indefinitely around the owner tower. Touchdown adds an expanding, fading radial pad glow.

Arrival activity now lights the actual building wall quads from below, fading upward, with a soft pool at its base. GPU depth occludes it behind nearer structures; no light column is painted above the scene. Attention holograms are limited to QUESTION, BLOCKED and failed EXIT. Plain STOP is not an alert. They restore from history and clear on the existing reply/resumption protocol; the demo button is local and writes no journal lines.

An open hub's own building carries a thin spire (30–40 units) with a beacon in the project colour pulsing every ~3 s, a fading additive light column about 2.5 building heights above the roof, a ground ring at its foot and lit wall/roof edges (`hubs.js`). Painter depth hides all of it behind nearer buildings. Open owner questions flash the beacon and the name sign gold once a second; gold is used for nothing else. The name is a neon sign on the spire with a dark backing, sized with zoom. Reduced motion holds a steady glow. A closed hub is a plain building. The building is not extruded: taxi slots, parked taxis and flight clearance are built once from the static roofs.

The hub building itself grows with its session context (`hubHeightFactor`): 1.5x when fresh, linear to 2.4x at 350k tokens, in 0.1 steps, never above 0.9x of the owner tower; a closed hub is a plain 1.0x house. Only plain boxes scale (one roof, walls of one height); 8 stepped landmarks and 4 ground landing pads keep their height. All building vertices pass through `growth.point`, so the mesh (a small separate `hubMesh`), windows, selection and hub lights follow; `runtime.js` moves the roof's slots, its tower pad and parked taxis. A change animates over 3 s (reduced motion: at once) and a hub accepts a new height at most every 10 s; flight obstacles are patched in place for that building (`raiseClearance`, at the start of a rise, at the end of a fall) and arrival walls are rebuilt once per change.

Plaza and attention figures have slow bob/sway and breathing brightness. The plaza figure is one line-art planet. Roof snakes draw only roof contours, with delayed starts and local window cascades, never straight links across gaps. Tower windows use the same effective per-window change rate as ordinary city windows. Ad screens switch one static picture at a time, without overlap.

Roads keep the source layout with generous quadratic corner fillets and one warm yellow family. Actual ground traffic smoothly controls road width/brightness; unused roads are thinner and dimmer. A traffic dot and its whole trail are red when moving up the screen and yellow-white when moving down, independent of horizontal direction.

## Limits and evidence

The source raster spire remains a simplified geometric landmark. Four source raster pad landmarks are geometric silhouettes. The coastline starts from a three-source-pixel trace with corner smoothing. GPU atmosphere/reflections approximate the source's offline compositing. These are visual differences to review, not exact raster parity claims.

The owner accepted the first pilot on his screen. His screen check replaces the former physical-window-size gate; recorded outer-window dimensions remain disclosed. The GL2 report distinguishes browser/geometry/performance checks from acceptance of this later version.

The standalone pilot remains at `/assets/gl/index.html` (or `viz/assets/gl/index.html` from a repository static server). It has wheel/drag/home controls and a Space window impulse. It does not connect to journal or roster state. Runtime assets are local; only ad/aircraft pictures are textures, and Earcut 3.0.2 is vendored with its license.
