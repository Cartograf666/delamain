# Layered city — production style contract

Checkpoint draft, 2026-11-03. The owner's current brief accepts the layered-city direction of
`agent/viz-style-refs` at `5624e76` (`city-overview.png`, `city-edge-lanes.png`, `towers-states.png`,
`raw/`). This contract supersedes the former two-layer/opaque-only ordinary rule **for CORE**,
the three-state study and the old eight-call reference quota. Only one five-state CORE pilot is
being made now, maximum three generator calls including retries; the remaining family needs
owner quality approval. Reference archive: `./work/refs/ref-{1..9}.webp`.

## 1. Layers and motion

| Order | Layer | Authored states / composition |
|---|---|---|
| 1 | Ground: tiles, faint map grid, edges | Interior / coast / district-edge / empty variants; static, shared seamless ground. |
| 2 | Roads: lanes, markings, trajectories | Straight / bend / junction / end pieces; unlit / dim amber lane lights; fixed path graph. |
| 3 | Ordinary buildings | One quiet night image per type outside CORE; CORE uses five images below. Sort architectural feet by depth. |
| 4 | Key buildings | Five load images 0/25/50/75/100; same identity and geometry. CORE scenery remains subordinate to live keys by scale and placement. |
| 5 | Moving things | Cab heading sprites + idle / moving light states; trails follow the same fixed paths. No free random wandering. |
| 6 | Light and haze | Off / low / medium / high / full base-spill masks; faint bounded ambient haze. Ground spill composites below architecture; aerial haze above. |

Layer numbers describe asset ownership, not permission to paint ground light over a building.
Architecture contains no roads, grid, terrain, baked cast shadow or exterior coloured halo.
The visual load states are not a new telemetry definition: a later integrator must select the real
load signal. Default quantization proposal: clamp 0..100, nearest 25 (ties upward); missing data
must remain distinguishable from measured zero in the host UI. Runtime wiring is outside this checkpoint.

## 2. Geometry and sprite delivery

**Measured from current `viz/viz.html`, not inferred from artwork.** Run `node viz/assets/style/pilot/measure.mjs`;
results: [pilot/geometry.json](pilot/geometry.json). At 1600×1000 CSS px, overview zoom 1,
K=7.54901960784 px/world unit: 616 lots, 113 CORE lots; each CORE square has side 2.6 world units.
Projection is `(x-y, (x+y)/2)`, ground-edge slopes ±0.5, verticals vertical, orthographic.
The full lot diamond is 5.2×2.6 world units = 39.2549×19.6275 CSS px = **78.5098×39.2549 px at 2×**.
Current `drawLot` inset is `k=.16` on each side: building/plinth side 1.768, diamond
**3.536×1.768 world units = 26.6933×13.3467 CSS px = 53.3867×26.6933 px at 2×**.
Use that inset footprint for this pilot; do not silently enlarge it to a multi-lot block.

Earlier `agent/viz-pilot-core:viz/pilot/FOOTPRINT.md` uses merged 2×2 lots, side 4.576,
diamond 9.152×4.576 world units (69.0886×34.5443 overview px). That is a separate allocation
scheme, **not implemented by this contract**. Other districts rotate/curve their quads: a universal
unrotated 2:1 sprite cannot exactly fill every current quad; later placement needs a contained
footprint or authored camera variants, never per-axis stretching.

PNG RGBA, sRGB, straight/unassociated alpha with genuinely empty transparent exterior. Preserve
partial edge coverage and frosted material; clean contaminated matte RGB, never retain a black
background as translucent pixels. All five files share dimensions, scale, canvas origin and a
bottom-centre **front plinth vertex** anchor; metadata records its pixel coordinates (including
transparent bottom padding). Place at `P(lot.x+s/2, lot.y+s/2)`, s=1.768. Scale uniformly by measured
base width; export enough pixels for at least 2× intended draw size, retaining the higher-resolution master.

A thin flush architectural plinth closes the facade at the diamond edge. No thick terrain pedestal,
soft floating base or protruding wings. Adjacent CORE centres remain 2.6 apart: street gap 0.832
world units; footprints never overlap. Ground tiles meet under this gap without cracks. Tall bodies
may occlude behind them. Align feet by world depth, not image bounding-box bottoms. Common cool
upper-left key, soft weaker right fill, subtle AO, soft small bevels. Shadows project lower-right
in a separate ground pass. No perspective convergence, outlines, wireframe cages or rainbow rims.

## 3. Five real lighting images

| State | Drawn emission (not global-opacity variants) |
|---|---|
| 0 | Dark slate frosted glass; almost all windows dark, ambient form remains readable. No base emission. |
| 25 | A few warm amber window/floor clusters; restrained cyan interior accent; mostly dark body. |
| 50 | Approximately half the occupied floor zones lit, broader internal glow; dark zones still legible. |
| 75 | Most floor zones lit, milky glass begins to glow; remaining dark zones visibly fewer. |
| 100 | Fully active luminous frosted glass, amber windows plus cyan accent, readable mullions and setbacks; no white clipping. |

All five preserve camera, silhouette, roof equipment, window grid, material geometry, plinth,
anchor and ambient lighting. Previously lit zones stay lit as load rises. Only window emission,
internal scattering and corresponding **separate ground spill** change. No contour bloom, coloured
fringe, scaling, pose or facade redesign. Review at actual draw size and 3×, on dark and light
matte controls; numeric registration alone cannot establish that geometry stayed identical.

## 4. District imprint — form first, accent second

Accents retain `viz/viz.html` TINT identities; amber occupancy windows are shared. Outside CORE,
matte navy/slate massing dominates; accents stay sparse in windows or selected roof details.
These are named production proposals, not claims that the current runtime already uses them.

| District / accent | Form; roof and material cues | Ordinary types (4–6 each) |
|---|---|---|
| CORE `#9fe8ff` | Only skyscrapers, varied heights, podiums and glass; recessed plant and precise crowns | Cascade, Blade, Twin Notch, Lantern, Terrace, Crown (six below) |
| FOUNDRY `#ffb547` | Broad workshop masses; sawtooth roofs, ducts, dark metal/concrete | Sawtooth Workshop; Assembly Hall; Boiler Annex; Crane Shed; Toolworks Block |
| DOCKS `#3fd6c4` | Long low cargo bars; ribbed roofs, gantries, marine steel | Transit Warehouse; Customs House; Cold Store; Container Depot; Pump House |
| BAZAAR `#ff4fd8` | Small clustered stepped volumes; canopies, open courts, plaster/metal | Arcade Court; Canopy Market; Corner Shop Stack; Trade Hall; Tea-house Block |
| HEIGHTS `#62f0d8` | Slender residential terraces; recessed gardens, clean stone/glass, quiet roof plant | Garden Slab; Terrace Residence; Split Villa Tower; Courtyard Residence; Sky Pavilion |
| SPRAWL `#ff7ab8` | Dense uneven midrise bars; patched roofs, tanks, brick/concrete | Walk-up Slab; Stairwell Block; Roof-tank Apartments; Corner Tenement; Workshop House |
| SMELTER `#ff8a3d` | Heavy furnace forms; stacks, cooling drums, weathered metal | Furnace Hall; Chimney Works; Cooling House; Slag Shed; Refinery Block |
| RIVIERA `#b38bff` | Horizontal stepped hospitality; pergolas, terraces, pale stone subdued at night | Promenade Hotel; Terrace Club; Marina Lodge; Courtyard Inn; Pavilion Row |
| WASTES `#c8a070` | Sparse squat utilities; antennae, corrugated roofs, dusty concrete | Relay Hut; Service Bunker; Salvage Shed; Water Station; Survey Outpost |

## 5. CORE family — six silhouettes, one material language

Heights are target roof lift above the base back vertex in world units on the single-lot footprint;
all remain skyscrapers. Measure delivered art; do not stretch it to force a class.

| ID / name | Height class | Silhouette / roof |
|---|---|---|
| A — Cascade | Tall, ~9 | Tall glazed podium, three asymmetrical setbacks to a narrow flat crown; recessed roof plant. **Pilot.** |
| B — Blade | Very tall, ~10.5 | Slim rectangular glass blade on a low broad podium; one recessed crown slot. |
| C — Twin Notch | Tall, ~8.5 | Unequal paired shafts on one podium, deep central notch; no bridge beyond footprint. |
| D — Lantern | Medium-tall, ~7 | Compact faceted shaft, slightly wider translucent crown, thin flat roof. |
| E — Terrace | Medium-tall, ~6.5 | Broad vertical slab with offset terraces climbing one side; screened plant. |
| F — Crown | Very tall, ~11 | Narrow tapered setbacks ending in a split flat crown; two short service fins. |

Pilot generation prompt and call count: [GENERATIONS.md](GENERATIONS.md). Checkpoint requires one
reviewable five-state A, technical limitations and comparison with references; it does not authorize
B–F, runtime changes, push, PR or merge. Owner quality acceptance remains pending.

Delivered A: [pilot/core-sky-a.json](pilot/core-sky-a.json), 432×724 RGBA, anchor (216,700).
The three-call budget is exhausted. Exact 2:1 camera, internal geometric identity and target
height did not pass; the contact sheet is a review candidate, not a production acceptance claim.
