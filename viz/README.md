# hub-viz: Delamain live

A live night city over the hub home, as a web page and a native macOS screen saver. The map shows what runs, like
agent-top: a worker while its process lives, a stage hub while it runs. Read-only over `AGENT_HUB_HOME` (default
`~/agent-hub`).

- **The city** is procedural and deterministic: a coastal megacity with a bay to the west and desert all round, nine
  districts (CORE, FOUNDRY, DOCKS, BAZAAR, HEIGHTS, SPRAWL, SMELTER, RIVIERA, WASTES), each with its own street grid
  angle and block size, a ring road, curved radial highways and a coast road. Blocks are neon schematics in the
  district's colour with a few image landmarks, each district cycling through its own buildings (megamall and data centre
  in the core, power plants in the foundry and the smelter, a container ship and an oil rig in the bay off the docks, a
  monorail station on the ring, a slum, a temple and a stadium in the sprawl, water towers in the wastes); ground traffic is
  ambient. Block height and brightness have extra stable hash variation (no new PRNG draws); the core is denser in
  height. Static windows do not flicker. Cool ground gradients, a cyan shoreline, coast-road glow and faint horizon
  haze share the same static layer as the city. District labels have dark backing and glow above buildings, and scale
  with zoom (and the page's `ui=`). Landmarks share a 65% district tint with additive ground glow. Landmarks are drawn fainter than the towers and cabs: they are scenery, not something that runs.
- **Legacy renderers group repositories into fixed districts.** The accepted WebGL view instead reads deterministic
  project territories and roof anchors from `/city`; see the archival contract below.
- **A stage hub is a tower** on a lot of its district, one of seven designs by the hash of the stage's name, with its
  name as a neon sign.
  An open stage has one while it has live workers, its hub wrote to the journal within 30 min, or some process names
  the hub's session. **The owner** is the megatower in the core, and it is the plan-limits gauge: its left face is lit
  amber by what Claude's plan has left, its right face cyan by Codex's, each from the crown down, so spending darkens it
  from the foot up; an engine with no sample stays unlit, with a faint neutral facade and cyan ambient rim so its shape remains readable, and hovering the tower gives the numbers. The share is the
  smallest remaining over the engine's windows (5h, 7d), read like `bin/limit_pace.py` from the last `rate_limit_event`
  of recent headless Claude agent logs in the hub home and the `token_count` rate limits of recent Codex rollouts, once
  a minute; a window past its reset counts as full. `/state` carries it as `limits` (`{"claude": {"left": 17, "window":
  "7d"}, …}`).
  A tower grows with its hub session's context: 0.75x when fresh, 1.5x at 350k tokens (the handoff threshold); `/state`
  carries it as `hub.ctx` (the last usage of the session's Claude transcript, else the context-budget hook's last
  recorded count, else 0) and the page's tooltip shows it as `ctx 212k`.
  While its stage has owner questions open (`Q-…` entries with status `open` in `<stage>/questions.md`, the `ask`
  register; `/state` carries the count as `questions`) the tower's beacon and sign flash gold once a second, and the
  page's tooltip says how many.
- **A worker is a flying cab** roaming the city. Its flyer shows the model's tier: a limo for Fable or Astra, a sports flyer
  for Opus, the plain flyer for Sonnet or Sol, a bike for Haiku or Luna, a van for a service tool (`pace`, `watchdog`).
  Its neon trail, the last 1.3 s of flight fading to the tail, is in the model's colour (Fable violet, Opus magenta,
  Sonnet amber, Haiku lime, Astra red, Sol cyan, Luna blue); its glow is amber for Claude, cyan for Codex, grey for a service tool; a busy one (log grew in the last 10 min) flies a little faster with a pulsing glow.
- **Every journal line is a beam**: from a spire down to a cab, from a cab up to its addressee (`@role`, `@hub <stage>`,
  `@owner`; an unaddressed line goes to the stage's hub), or between spires; the camera flies to where it happened.

## Server and page

```bash
./build.sh                  # needs go and swiftc; writes build/hub-viz and build/DelamainLive.saver
build/hub-viz               # http://127.0.0.1:8765/
```

`hub-viz` flags: `-addr 127.0.0.1:8765` (listen address), `-allow-origin http://a:8765,http://b:8765` (page origins that
may read this server from another origin; none by default, so no CORS header is sent), `-v` (log every request but
assets, with its user agent; off by default). `-addr 0.0.0.0:…` publishes the journals, unauthenticated, to the whole
network: use it only on a network you trust. A page that reads several machines (`src=`) needs `-allow-origin <the
page's origin>` on each of the others (the page itself is served by the first). Endpoints: `/` the page, `/state`,
`/history?hours=N`, `/city`, `/events` (SSE: `state` every 5 s, `line` per journal line), `/assets/`.

### Celebrations

A merge, a release or an opened PR becomes fireworks over the project's district in the live WebGL city
(`/?map=1&live=1`), with light on the district's own facades. The server reads three journal tokens, with the
status-word rule: the token opens the line, optionally after `@hub `, and ends at a non-word character.

| Line | Kind | Required | Written by |
|---|---|---|---|
| `@hub MERGED … <link>` | `pr-merged` | a `http(s)://` link | `await --ok MERGED` already |
| `RELEASED <version>` | `release` | a version: `v1.2.3`, `2026.11.05`, `0.9.1-rc.2` | the agent or hub that tagged |
| `PR-OPENED <link>` | `pr-opened` | a `http(s)://` link | the agent that opened the PR |

Nothing is guessed: a merge without a link, `RELEASED notes`, `PR-OPENED #12` or the words in mid-line do not count.
`/state` (and its SSE `state`) carries `celebrations: [{id, kind, project, ts}]`: only lines tailed live, deduplicated by
kind, project and link/version, dropped after 2 minutes. The page plays an id once, only if it is younger than
2 minutes; whatever `/state` holds when the page loads is never replayed. At most 4 play at once, the rest queue.

Effects: PR opened, three small rockets in a fan 200 ms apart (project colour, white, light tint) and the main tower's
top floors; merge, three rockets (peony, ring, peony) and one facade wave; release, 8–12 mixed rockets and a finale,
three waves 1.2 s apart, each wider, the lit buildings' windows and a 3 s afterglow on the main tower. Facade light
covers only the central buildings: the main tower plus the project's own plots (from `/city` `plotOwners`;
`projects[].plots` are graph indices, not plot ids) within 70 ground units of it for a merge and 110 for a release,
nearest first, at most 30; never another project's building. The wave front leaves the launch point at 160 units/s;
each building peaks 150 ms after the front reaches it, in the project colour with a white core, and is dark 800 ms
later, so the light passes and is gone. Each burst adds blurred light, all soft radial ramps drawn additively: a bloom
of 60–140 units by shell size (up in 0.1 s, gone over 1.2 s), a tall haze behind it that the buildings silhouette, a
coloured wash on the central rooftops under it and a broad, faint wash on the streets; each rocket head has a halo and
a faint blurred streak along its track. Bursts and rockets reflect on the water below the district, mirrored across
the first shoreline under the launch point and foreshortened to that stretch of water: a streak per star, a coloured
pool and soft ripples, held to the water by depth as the static reflections are. Burst onsets stay at or below 3 per
second; reflections add none. Reduced motion (the media query, or `&reduced=1`) draws no bursts, streaks or waves:
one soft bloom, one glow on the water and a steady soft light on the main tower, for the same time.

Demo: `/?map=1&live=1&demo=celebration` shows the "Test events" panel that plays local events on click and never
writes the journal; `&kind=pr|merge|release` repeats one firework by itself, `&panel=0` cycles the three kinds,
`&panel=1` adds the panel to a live page (`/?map=1&live=1&lang=ru&follow=0&panel=1`). `&tour=1` (`assets/gl/tour.js`, needs `follow=0`) plays every event in turn, in a loop, under a timeline bar instead of the panel, following the cab on a delivery: dragging it, its arrows, `←`/`→` or its list picks a scene, since flights and fires are simulation, not a recording, and a scene restarts rather than seeks. A demo page reloads when the
server restarts. One project selector serves two groups. Fireworks: `PR opened`, `PR merged`, `Release`. Taxis
(`demo-panel.js` over `runtime.js` `demo`): virtual cabs, two per project made on first use, flagged `demo`, never in
`/state`, the journal or the hub home, listed in the roster and the HUD's count, where a click follows one as it does a real cab; they use the real launch, caps and queue. `Delivery in project` goes to the
territory's slot farthest from its main tower, `Delivery to owner` to the owner tower, `Delivery to neighbour` to the
nearest other territory's main tower, `Event → main tower` calls `dispatchEvent(project, 'merge')`; `Patrol` toggles
their patrol; `Five at once` sends five (three fly under the per-project cap, the owner trip queues first); `Reset`
removes every virtual cab and queued virtual trip, as a reload does. The panel shows cargo flights against the city cap,
the queue, overflow (the page's total) and the virtual cab count; it folds at phone width.

District (`demo-panel.js` over `district-demo.js`), for the selected project, nothing written anywhere. `Capture: small /
medium / large` queues 1, 3 or 16 captures from the nearest neighbour into the real capture response (`response.play`,
one group, so severity follows the plot count; three run at once, the rest queue) on the project's road-reachable plots
facing that neighbour, switches the page to «Районы» and frames the smoke. `District grows` replays the growth recolouring
(`districtGrowth.replay`) over four such plots, built ones first (an empty lot shows its owner only as a faint ground tint). `Project closed` swaps the source's in-memory `/city` for one where the
project is closed and its land vacant (as `city_sim.go` does), so its tint, hubs and raised buildings go; the next
`/city` load or the toggle restores it. `Owner question` adds one open question to the project's open hubs (gold beacon
and sign). `Work 0–3` calls `gpu.districtWork.setDemo(project, level)` and is disabled with a note while that hook is
absent. `Reset all` clears all of these; real fires, waves and data are kept.

### Fire, taxi landings and hub height

Fires (`capture-response.js`): each captured plot gets at least three hot spots on its lower floors, drawn as additive
light from windows onto the street and nearby facades, never on roofs. The glow flickers from incommensurate sines plus
low-passed noise (about 20 %, nothing large faster than 3 Hz); embers rise from window level under a budget; the plume
base is warm. Walls and streets in front occlude it, and fire light is looked up once per fire (at most four lookups a
frame). Reduced motion: steady glow, no embers. Tests: `fire-smoke.test.mjs`, `fire-*-headless.cjs`.

Taxi landings (`runtime.js`, `lighting.js`): descent cone over the last second, touchdown flash, soft bloom, light column,
two rings, sparks, and a stronger arrival light on the receiving walls (per-building ceiling, total wall light capped at
2.5) with a pulse up its windows. Patrol landings are about half as strong; simultaneous effects are capped. Tests:
`lighting.test.cjs`.

Hub height (`hubs.js`, `growth.js`, `main.js`): an open hub's house scales 1.5x to 2.4x with context (ten steps, capped at
0.9 of the owner's tower); everything standing on its roof follows. A new height is accepted at most every 10 s and
eased over 3 s (instant with reduced motion). Stepped landmarks and ground pads do not scale.

### Work in a district

Work without any delivery is shown inside the project's own territory (`district-work.js`): the plots `/city`
`plotOwners` gives the project plus its main plot. The level counts the project's cabs in `/state` with `working` true
(0 none: nothing; 1; 2; 3 and more) and the district glows from inside, more with each level, in the project colour
softened towards white. It lights up from its main tower outwards: the level sets how far and how much. Near the tower the
scene's windows give way to a full grid over its facades (the scene has fewer dark windows than buildings): 14/32/58 % of it
lit, nearest the tower first and dimmer towards the edge, mostly warm and some neon, each with its own soft additive halo at
its wall's depth, so a nearer building covers it. Scattered along its roads are lights of their own colours (magenta, cyan,
amber, the project's), lit the same way. Windows and road lights trade places now and then, each on its own period of 5-17 s,
faster with the level. A soft pool of light around the tower grows with the level. With them go 6/12/20 roof twinkles, light
motes rising from roofs (0.8/1.8/3.2 a second) and short fast streaks along its own streets (0.6/1.4/2.6 a second). The whole
glow breathes (5 s, ±15 %) and eases in and out over about 1.2 s. Steady, never a burst;
no ring, no red/orange of its own, no gold. Reduced motion: the same strength at once and steady, without blinking,
drift, breathing, motes or streaks. A closed, unseated or empty project shows nothing; nothing falls back to a legacy zone. Test
stand: `live.gpu.districtWork.setDemo(projectId, level)` (0 clears; never the journal or the hub home) and
`districtWork.stats()`. Tables: `GLOW`, `FACADE`, `BLINK`, `TINTS`, `NEON`, `CENTRE`, `MOTE`, `STREAK` in `district-work.js`.

### Territory growth

When the page loads a day whose `plotOwners` differ from the day before (`dailyChanges`), each changed plot cross-fades
from its previous owner's tint to today's: buildings, windows, arrival light and ground fill (`growth.js` `fadePlan`,
`FADE`). Each plot fades over 10 s; the starts spread over the first 15 s from the new owner's remaining land outwards,
loosely (a plot may swap with its neighbour in the order), so the border creeps; about 25 s in all, no wave and no flash.
The changed buildings are drawn from the small hub mesh while they fade. Reduced motion: today's owners at once. The
tint exists only in «Районы»; `District grows` switches the page there.

### Archival city state

`GET /city` reads the complete `*/coordinator/work/journal-*.md` archive, including closed stages. It never writes
hub data or a cache. `/history` remains capped to a week. With the same metadata, journals, requested date and
embedded rules/graph, the response is deterministic. Without `date=`, the latest journal filename date is used
(so a wall-clock tick cannot mutate the same input). `?date=YYYY-MM-DD` computes the end of that historical day;
invalid/future dates return 400. Dates before the model start, 2026-10-08, return empty territories. No forecast,
repeated historical rhythm or stress simulation runs in production.

Version 2 supersedes the original fixed HOME/standalone-stage policy. `projectID` in `city.go` ports the accepted
`REPO_NAME`, `NO_REPO`, `BACKLOG` grouping: sibling products can combine repositories and a shared backlog stage
can contribute to several projects by worker tag. The shared `default` log has no project. Unknown future repos
keep their complete cleaned path; unknown no-repo stages keep their stage name. `cityRules` holds the grouping,
clock, six-hour cap and all tunable fight rules. Rule numbers are provisional.

The response contains `rulesVersion`, `date`, `stagesWithoutRepo`, `cappedRuns`, `unclosedRuns`, `reference`,
`baseDistricts`, `plotOwners`, and sorted `projects`:

| Field | Meaning |
|---|---|
| `id`, `stages`, `district` | Stable product identity, sorted contributing stages, territory identity (the project ID, not one of nine zones). |
| `tower`, `mainPlot`, `zone` | Existing WebGL pad index inside owned territory, or -1 with a main-plot roof anchor when no authored pad is there. `zone` is only the unchanged renderer's legacy heat/flight zone. Closed/unseated projects have null mainPlot. |
| `finishedTasks`, `hours` | Status texts beginning with DONE as a word (optional @hub, including DONE:); explicit launch/resume-to-terminal run hours, capped at six per run and rounded per day to two decimals as in the accepted parser. |
| `firstActivity`, `lastActivity`, `lastLines`, `goals` | Project activity through the requested date, last five non-service lines and unique stage goals. |
| `colour`, `plots`, `area`, `share` | Stable hash colour, owned graph indices, world-square-unit area and share of contestable land. Plot ownership is data only here. |
| `daysOfSilence`, `light`, `pressing` | Accepted daily fade model and neighbouring projects eligible to press the territory (recent-work ratio, spare land/room, mature connected edge). These are model inputs for the later filter, not a live UI mode. |
| `tagPrefixes`, `closed` | Backlog worker routing and provisional all-stages-closed state. |

`plotOwners` gives every fixed plot's source `id`, graph `index`, owner ID (empty for free/reserved), `dark`, `level`
and `reserved`. `baseDistricts` gives eight seeds and their current holder after the 35%-within-110-unit test.
CORE and the owner are reserved. Delamain lives alone on WASTES; other projects cannot cross the graph's water
border. The immutable accepted topology is in [citydata](citydata/README.md); the server uses Go only, with no
runtime dependency on the simulation session. Landmarks (`n:` pads) are additionally reserved, including moving
Delamain's original main off a landmark to the nearest free island plot. This accepted protection is absent from
the simulation: exact reference controls compare all 29 original daily frames first, and the opt-in audit lists
every resulting ownership difference separately.

Hours are observed start-to-terminal wall time, including waits, **not measured active effort**. Only exact pace /
watchdog tags are skipped, matching the accepted parser. First unmatched starts are retained across repeated
launch messages; unfinished runs add no hours. STOP closes an interval but adds no task. A non-service journal
presence keeps lights on; raw line counts add no weight. Journals omit timezone, so version 2 uses fixed UTC+03:00
and minute precision. Closed projects vacate all land, including their main; the provisional trigger is all member
stages truthily closed, effective at the latest dated close (undated closes use the archive date). This trigger is
isolated in `projectClosed` and remains unconfirmed by the owner. No reward landmarks are guessed from MERGED;
signal reliability and a proposed explicit signal are in the delivery report.

The accepted WebGL page (`?map=1&live=1`) fetches `/city` before applying state, uses its roof anchor and refreshes
for unknown live stages. Shared backlog hubs use the largest contributing territory; event worker tags route to
their actual project. No visible territory colours, ownership transitions, filter, growth, sliders or panel are
introduced in this task. The accepted bodies, lights, camera and default/non-live renderer remain unchanged.
Worker presence stays in `/state`; it is not invented from archival journals. Invalid metadata/unreadable or
overlong input fails with HTTP 500 instead of partial totals. Non-GET/HEAD methods return 405.

Focused checks from the repository root:

```sh
(cd viz && go test -race ./... && go vet ./...)
node viz/tests/city.test.cjs /tmp/viz-state-19/final-territories
# Explicit read-only live/reference audit; otherwise Go tests use fixtures only:
(cd viz && CITY_AUDIT_OUT=/tmp/viz-state-19/reference-audit.json go test -run TestCityLiveReferenceAudit -v)
```

The browser check uses installed Playwright/Chrome paths from [GPU checks](tests/gl/README.md). It builds the real
server, creates a fixture, checks actual WebGL places across reload/restart/reversed state order and 103-project
capacity, historical date response and default canvas parity with accepted `5c3bd1f`; then measures the live
archive read-only. It closes all its own processes. Port = `8800 + AGENT_HUB_SLOT` (default slot 19).

Page parameters: `src=http://a:8765,http://b:8765` (several machines, each running `hub-viz`), `quiet=N` (replay the
last `hours` after N seconds without a live line; off by default: live only), `hours=24`, `speed=120`, `follow=0|1`
(whether the camera flies to each line; overrides the last toggle), `ui=1.6` (text over the map that much larger, for a projector), `lang=en|ru` (else the browser's languages; English is the fallback; journal text is shown as
written). Keys: `r` replay, `l` back to live, `f` follow on or off, `c` or `Esc` camera back to the overview (release a
pinned object, end a manual view). Hover a tower or a cab for its title.

`map=1` opts into the fixed accepted city, for example `/?map=1&lang=ru&follow=0`.
It uses the copied road/building data and live district loads; boxes are the default. `sprites=1` enables the optional existing CORE sprites for comparison. See [map sources and reproduction](assets/map/README.md). The default renderer
and `layers=1` remain separate; the map has no Swift saver implementation.

`layers=1` opts into the layered sprite prototype, for example `/?layers=1&lang=ru&follow=0`.
Without that exact value the original renderer runs and no layered assets are requested. The new renderer reads
`assets/style/manifest.json`: district sprite mixes, each state's file, pixel dimensions, front-plinth anchor,
architectural base width and uniform world width. Ordinary `widthFactor` takes precedence over `worldWidth` and
fits an unrotated footprint inside the existing rotated parcel. Replace sprites and metadata there; no filename
edits in the renderer are needed. Run `node viz/tests/layers.test.mjs` from the repository root for focused checks.

CORE load is the latest `/state` non-hub worker count per district, summed across sources: 10 workers is full,
clamped to 0–1 and rounded to the nearest quarter (ties upward). A 0.025 hysteresis margin beyond a midpoint keeps
states stable. A measured zero uses the dark image; a district absent from the data uses a deterministic lot hash.
Blue/green hub and owner stand-ins currently have only the authored 100% image; limits still appear in tooltips.
The mode uses cached ground/grid/roads, depth-sorted architecture and key buildings, inherited cab visuals on
fixed repeating road-graph paths, and bounded aerial haze. Key selection, roster, pan, zoom and follow remain live.
It is a browser review prototype with provisional assets, not Swift saver parity or final art acceptance.

- **Follow.** The `◉ follow` control under the mode, top right, switches the camera's flights to each journal line on
  and off (as `f` does). Its state comes from `follow=`, else the last toggle in this browser (`localStorage`), else on.
- **Pan and zoom.** Drag the map with the mouse or one finger to pan; the wheel, a trackpad pinch or a two-finger pinch
  zooms around the cursor or the pinch's centre, from 0.7x to 6x of the overview; the view's centre stays over the map.
  A hand pan or zoom makes the view manual: the camera no longer flies to lines nor drifts back to the overview, and an
  `⌖ overview` control appears beside `follow`; it, `c` or `Esc` returns to the overview and the follow setting. A hand
  gesture also switches `follow` off for this view (the saved setting stays); switching it on ends the manual view. A press
  that has not moved a few pixels is still a click or a tap. The page itself does not scroll or zoom over the map.

- **The roster** on the left, under the HUD, lists the owner, each hub tower (its stage, `ctx 212k` when known, a gold
  `?N` while it has open owner questions, dimmed when closed) and under it its cabs (a dot in the model's colour, the
  role, the short model name; a busy cab's dot pulses). It is rebuilt about once a second; hovering a row highlights its
  object on the map. With several machines (`src=`), a hub whose stage name appears on two of them shows its machine.
- **Pinning.** Clicking a roster row, a tower or a cab pins the camera to it: the camera follows it, zoomed in, and a
  journal line no longer pulls it away; the pinned row and a cyan ring on the map mark it. A pin outranks a manual view;
  the wheel or a pinch changes its zoom and keeps it, a drag releases it into a manual view. Clicking it again, clicking
  empty map, `Esc` or `c` releases it; it is released by itself when the object leaves the map (a cab landed, a hub gone).
- **On a phone** (at most 700 px wide, or at most 500 px tall) the roster folds into a button under the HUD
  (`☰ 3 hubs · 5 cabs`, the HUD's own count, plus the pinned object) that opens it as a sheet; the legend hides, the ticker spans the screen
  and keeps three lines. A tap pins like a click and shows the tooltip for 2.5 s. In portrait the map fits the city,
  not the desert roads, and lets the sides run past the screen's edges. The canvas renders at most at 2x.

## Rendering and parity checks

PNG sprites with any alpha below 255 keep their original alpha (the renderers handle premultiplication). Fully
opaque legacy images use a soft luminance matte with black removed from antialiased edges; solid cab/tower hull
interiors remain opaque. Both formats can coexist under the same filenames. No external assets or services are needed.
The page caches the ground and buildings at the viewport, pixel ratio, zoom tier and occupied lots, with overscan for sharp panning. Zoom tiers are 1.25x apart; the page
only downsamples the sharper tier between them, never upscales a softer bitmap. A change
to those inputs (or panning beyond the overscan) invalidates it; moving cabs, towers, labels and journal beams stay live. The saver retains its static bitmap.

Run from the repository root (Node and Swift only):

```sh
node viz/saver/tests/check-parity.mjs /tmp/hub-viz-parity
swiftc -O viz/saver/CityModel.swift viz/saver/CityRender.swift viz/saver/tests/sprite-check.swift -o /tmp/hub-viz-sprite-check
mkdir -p /tmp/hub-viz-parity/shots
/tmp/hub-viz-sprite-check /tmp/hub-viz-parity
```

The check executes the generator extracted from this page and `CityModel.swift`, dumps the first 200 schematic
blocks plus every landmark (index, kind, x/y, size, height, brightness, scale, flip, sprite), and fails on any difference
at 1e-9 world-unit precision. `page.tsv`, `swift.tsv` and an empty-on-success `parity.diff` remain in the output directory.
The fixture screenshots and native host verification remain separate from model parity and compilation.

## Screen saver

`DelamainLive.saver` draws the same city natively (Swift, Core Graphics and Core Animation; no WebKit, whose views
the screen saver host neither composites nor ticks faster than about 1 Hz). `saver/CityModel.swift` ports the page's
city generator value for value, so both draw the same city; `saver/Feed.swift` reads `/state` and `/events`, so the
server must be running. The static city is a bitmap at the screen's backing resolution for the camera's resting view;
everything that moves is a layer. The roster is drawn as on the page, without pinning or hover: the saver is not
interactive. While it runs, the saver keeps the display awake.

Settings, all in the `dev.delamain.saver` defaults suite (`defaults write dev.delamain.saver <key> …`):

| Key | Type, default | Meaning |
|---|---|---|
| `server` | string, `http://127.0.0.1:8765` | the hub-viz server |
| `follow` | bool, `true` | the camera flies to each line |
| `replayAfter` | int seconds, unset | replay the last 24 h after this much silence; unset: live only |
| `lang` | `en` or `ru`, unset | interface language; unset: the system's preferred languages, English fallback |
| `diagnostics` | bool, `false` | report fps and layout with each `/state` poll, and write one frame to `$TMPDIR/delamain-frame.png` 20 s after start |

`legacyScreenSaver` is sandboxed, so the saver reads the suite and, failing that, `~/Library/Preferences/dev.delamain.saver.plist`
directly. If a setting still does not arrive, write it into the host's container instead:
`defaults write ~/Library/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Preferences/dev.delamain.saver <key> <value>`.
The host's App Transport Security applies to `server` (a bundle cannot relax it): a non-local `http://` server may be blocked.

Install:

1. `cp -R build/DelamainLive.saver ~/Library/Screen\ Savers/` and pick it in System Settings → Screen Saver.
   A new build is picked up only by a new `legacyScreenSaver` process: quit System Settings and kill the running
   `legacyScreenSaver.appex` processes by pid.
2. Keep the server up with launchd: copy `saver/dev.delamain.hub-viz.plist` to `~/Library/LaunchAgents/`, replace
   `HUB_VIZ_BIN` with the absolute path of `build/hub-viz`, then
   `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.delamain.hub-viz.plist`.
   Its log is `/tmp/hub-viz.log`; to see the saver's diagnostics there, add `-v` to `ProgramArguments`.

The saver must be built as a loadable bundle (`MH_BUNDLE`, as `build.sh` does): System Settings silently skips a dylib.
The lock screen itself shows the wallpaper; the saver appears over it only after the idle time set in System Settings.
The screen saver host makes two full-screen views per process, and both animate.

## Assets

The images in `assets/` are original artwork generated for this page (the Antigravity CLI's image generator and the
owner's own generations; no game assets); their black background is keyed to transparency at load. Towers are 768×1024,
buildings 512×512, flyers 384×384. A landmark's sprite and its scale live in `LANDMARKS` and `LANDMARK_SCALE` in both
`viz.html` and the saver; a new name goes into `SPRITES` / `SPRITE_NAMES` too, and the choice must use no random draws, or
the page and the saver stop drawing the same city.
