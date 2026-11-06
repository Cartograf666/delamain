# Live vector aquarium

`/?map=1&live=1&lang=ru&follow=0` opts in. Ordinary page/UI, roster, pins, hover/tooltips,
follow, pan/zoom and focus remain the existing viz implementation. No Go/Swift/state schema changes.
`replay=N&hours=168&start=<ISO>` replays actual journal time; empty history is valid.
`r` starts replay, `l` returns to live. The roster shows current processes, not historical reconstruction.

## Final owner contract

The aquarium and 21:25/21:35 corrections supersede the earlier arc/raster approaches:
vector city, zoom-tier rerasterization; work-only flight; separate fading hubs; building reflections only
on water; about 26 window wakeups per second citywide (roughly 130 simultaneous); generated flyer sprites with fading trails, and ground circles with curved tapering tails. A road-safe open plaza near CORE carries one low hologram. Eighteen authored facade panels carry perspective-mapped ad screens at full brightness on independent cycles; roof billboards are removed.
`aquarium/accepted-source.html` preserves the latest supplied prototype source as a reference, not a
second page/control deck. `aquarium/cp.py` / `pack_aq.py` document original geometry/style provenance.

`vector.js` constructs ground polygons, road paths, building faces, nested deterministic window/sign
paths and emission masks. Viewport tiles are cached at 0.5-resolution tiers and rebuilt as zoom changes.
They are runtime geometry caches, not pre-rendered city pictures. Only existing notable models use sprites.
Water reflections are clipped by the vector water path then erased by the same painter-ordered building
silhouettes. Road/bridge light has no reflection pass. Window pulses cache tiny geometry masks per zoom tier with painter-ordered foreground occlusion.
Land contours are traced at three source-pixel spacing; ordinary facade rhythms reuse the prototype palette
and dimensions with deterministic JS sampling rather than Python's PRNG.

`aquarium.js` ports climb, heading/waypoints, variable cruise speed, tower avoidance, hover and landing.
No unlabelled ambient flight is created. Real workers rest while idle; working workers may fly. A journal
line starts a cargo flight into CORE and back to a home-district roof; only 14% of outbound destinations
are the owner. Nine cargo flights at once is the accepted prototype cap: overflow still adds heat and a
local light impulse, without creating another flight. A worker finishing work completes its landing.
230 ground vehicles follow authored avenue/collector polylines, drawn behind the building layer.

`model.js` keeps event-time heat independent from animation time: default half-life 480 s, saturating
per-line gain, display zero under 0.001; `pace`/`watchdog` excluded. Mapping uses the page's existing
`districtFor`/`REPO_HOME` rule (current state first, historical repos next), never the prototype hash.
Each visible hub has its own event heat; ongoing actual work keeps it warm. The owner is soft at idle,
with brightness rising with total district heat. Rare windows and ground traffic are ambient, not work data.

Timing, system exclusions, cargo cap, rare-window rate and facade colors are in `config.json`;
district accent data and geometry are under `aquarium/`. No raster city assets are loaded by live mode.

## Reproduction and checks

From the worktree root, run `python3 viz/tests/live/serve.py` in an attached terminal; enter a line to stop.
It owns fixture API 8814 (30 harmless workers), real read-only hub API 8815, baseline 8816.
PIDs and cleanup: `/tmp/viz-live-14`. Never direct synthetic tests at 8815.
Browser helpers own ports 8914/9214 and close their Chrome/profile. Run sequentially:

- `node viz/tests/live/model.test.cjs`
- `node viz/tests/live/check.mjs` — fixture, default-page parity images, truthful motion, heat, window occlusion,
  cargo cap, per-hub decay, zero viewport, empty replay and zoom tiers.
- `node viz/tests/live/performance.mjs` — 60 real seconds, 30 workers / 60 events, wide pan and zoom4.
- `node viz/tests/live/record.mjs` — real history only, 90 s accelerated and 30 s at 1×, sampled at 24fps.
  Encoded cadence is not a runtime-fps claim. The accelerated clip covers 75 s of history plus a 15 s animation tail.
- `python3 viz/tests/live/generate-geometry.py` regenerates geometry from the canonical local prototype
  directory named in the script. It uses the accepted model insertion code and traces land contours.

Report, final videos, stills, metrics and checks live under the coordinator's `work/` and `work/shots/`.
Earlier arc recordings are isolated under `shots/live-superseded-arcs/` and are not the final product.
