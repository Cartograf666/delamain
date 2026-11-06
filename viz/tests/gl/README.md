# GPU live-city checks

Start `python3 viz/tests/gl/serve.py` from the worktree root in an attached terminal. It builds the actual Go server, creates 30 harmless fixture workers under `/tmp/viz-gl2-18`, and serves `http://127.0.0.1:8818/?map=1&live=1&lang=ru&follow=0`. It never opens the live hub home. Enter `restart` to rebuild, `event` to append fixture journal traffic, `stop` to close its server and owned workers. Do not build while installing the optional kit test dependencies: Go embeds the assets directory.

Run browser scripts one at a time:

- `node viz/tests/gl/check.cjs`: real page/UI integration, idle/work truth, slot exclusivity, journal overflow, alert demo, tooltip/pin, follow, actual history restoration/reply, empty replay, GPU-only city resources.
- `node viz/tests/gl/default-parity.cjs`: fixed inputs/time, before/after and live-without-map screenshots. The baseline HTML is exactly `1327f88`. Canvas acceleration is disabled only for deterministic pixel comparison, not for GPU/performance evidence.
- `node viz/tests/gl/capture.cjs`: comparison and three landing-phase captures. Also requires the accepted prototype coordinator work directory served on 9038. Landing is a controlled fixture final approach driven by real requestAnimationFrame; timestamps and positions are saved for alignment/descent verification.
- `node viz/tests/gl/perf.cjs`: headed foreground hardware GPU, 1920×1080 / 2560×1440 DPR2, 20-second wheel and drag runs with actual fixture journal writes every two seconds. Raw rAF intervals and focus/visibility are saved. Owner's screen acceptance replaces the previous physical-window gate; outer-window dimensions remain disclosed.
- `node viz/tests/gl/geometry.test.cjs`: both walls/top for every equipment box and clear pad roofs.
- `node viz/tests/gl/hubs.test.mjs`: hub beacon pulse/gold flash/reduced motion and spire/column/ring geometry on every pad building; spires never lift a hub past the owner tower.
- `CAPTURE_ORIGIN=… WORK_PROOF=<dir> [BEFORE_DIR=<dir of older gl/*.js>] [ONLY=growth] node viz/tests/gl/district-work-headless.cjs`: headless shots of Dota2Helper's district work at levels 0–3 (whole map, district, close) in «Активность» and «Районы», reduced motion at level 3, and «Район растёт» for Dota2Helper and Delamain at 0, 5, 15 and 25 s with «Сброс всего»; `BEFORE_DIR` serves older modules for a before/after pair.
- `CAPTURE_ORIGIN=… HUB_PROOF=<dir> [REDUCED=1] node viz/tests/gl/hub-highlight-headless.cjs`: headless overview and close shots of three fixture hubs (fresh, 175k with an open question, 350k) in both modes.
- `CAPTURE_ORIGIN=… HUB_PROOF=<dir> [REDUCED=1] [ASSETS_FROM=<viz dir>] node viz/tests/gl/hub-height-headless.cjs`: headless shots of four fixture hubs (fresh, 175k, 350k, closed) in both modes, a taxi landing on a raised hub roof and a live rise carrying a parked taxi; `ASSETS_FROM` serves `assets/gl/*.js` from a working tree over an older server build.
- `CAPTURE_ORIGIN=… CELEB_PROOF=<dir> [TAG=after] [MODULE=<celebrations.js>] node viz/tests/gl/celebrations-headless.cjs`: headless PR, merge and release over Dota2Helper (frozen territory snapshot) at the overview and a closer zoom, frozen at fixed event ages, plus reduced motion; reports the lit buildings' owners and frame times. `MODULE` serves another version of the module (before/after).

Browser dependencies: Playwright at the installed Codex runtime path and `/Applications/Google Chrome.app`. All runners close their own browser. Evidence is written to the stage's `coordinator/work/shots/gl2-*` paths.

Existing pure viz suites remain applicable: map, layers, kit, pilot2, live model and alerts. The alerts test now rejects plain STOP as instructed; failed EXIT still produces an attention marker. `live/check.mjs`, `live/compare.mjs` and `live/wheel.mjs` now forward to the GL harnesses. Their former cache-tier/raster assertions were replaced because no Canvas city cache exists; interaction, truth, depth occlusion, zero-size recovery, replay, alert and performance coverage remains. Historical video runners were not part of this delivery.

## Road/arrival correction (slot 20)

`python3 viz/tests/gl/serve-light.py` runs the same fixture-only server at port 8820, with owned processes and state under `/tmp/viz-gl-light-20`; send `stop` to its attached terminal for cleanup.

- `node viz/tests/gl/lighting.test.cjs`: three-minute EMA, isolated-car invariant, distance cutoff and an intervening-wall control.
- `node viz/tests/gl/light-capture.cjs`: before/after road and arrival frames against git `5c3bd1f`, plus a hidden-wall pixel test with forced-front positive control.
- `node viz/tests/gl/light-steady.cjs`: sequential three-minute headed hardware-GPU runs for the baseline and current source. Samples every road each frame, records maximum frame changes per road, one-second gain traces, actual arrivals/departures, rAF intervals and focus/visibility. Allow over six minutes.

These write only `gl-light-*` evidence under the existing stage shots directory and close their browsers. Run browser/performance scripts sequentially. Baseline source comes from git; no second production server or source checkout is modified.
