# CORE B-F production run

Owner brief, 2026-11-03: continue the accepted current pilot look; exact camera/height correction and family regeneration come later. This supersedes the B-F authorization stop in STYLE.md, not its silhouette/material contract. No runtime integration.

Base: agent/viz-core-set at a34e6342643eb9a1efe0c7d30c2a2d144cbf153c. Branch: agent/viz-core-rest.

Use built-in Codex image generation only, one five-state strip per type B-F. Maximum 10 calls; at most one retry for each of the worst two types. Reuse the pilot cut-and-matte approach. Keep original strips, prompts and technical metadata. Preserve A and viz/viz.html.

Review: 25 new RGBA sprites; six-type by five-state contact sheet on dark ground at measured draw size, with enlarged control. Visual family coherence is owner review, not a numerical assertion.

## Delivery

Five completed built-in Codex generator calls; zero retries. Each source strip is
2172x724 RGBA, stored unmodified at `raw/core-sky-{b..f}-strip-01.png`.
Final files: `core-sky-{b..f}-{0,25,50,75,100}.png`, 432x724 RGBA.
All share the front-plinth anchor `(216,700)`; each type has its own measured uniform
draw scale in `family/core-sky-{b..f}.json`. Never use one scale for every type or stretch
axes independently. The actual overview base width is 26.693333 CSS pixels for each type.

`python3 viz/assets/style/family/prepare.py` adapts `pilot/prepare.py`: aligned source
cuts, one manually inspected antialiased polygon per type and inward RGB repair in the
5px edge band. Thin aerials use a nearest interior fallback. Lighting remains native
generated RGB. Common alpha proves outline registration only, not identical internal geometry.
No geometry or state of A was modified.

Contact sheet: `family/core-sky-family.png` and
`./work/shots/core-sky-family.png`.
The same shots directory contains `core-sky-family-3x.png`,
`core-sky-family-matte-check.png` and per-type dark/light matte checks.

## Plain defect list

- A Cascade, unchanged: existing light fringe, subdued zero state, camera ratio 2.139:1,
  roof lift about 5.38 rather than 9; slight facade drift remains from the pilot.
- B Blade: camera ratio 2.811:1, approximate lift 6.80 rather than 10.5; a cyan podium
  accent remains lit at zero; fine window/roof registration drift and hard cleaned roof edges.
- C Twin Notch: camera ratio 2.422:1, approximate lift 6.03 rather than 8.5; a small cyan
  window remains at zero; deep notch closes halfway down the body; aerial detail is simplified
  by the common matte and interior window details drift.
- D Lantern: camera ratio 2.649:1, approximate lift 6.15 rather than 7; shaft reads more
  rectangular than faceted; crown and cyan vertical accent are bright even at zero;
  rooftop silhouette is simplified and facade details drift.
- E Terrace: camera ratio 2.590:1, approximate lift 5.13 rather than 6.5; small terrace
  vegetation/roof details drift; 100% has a stronger cyan interior edge than other types.
- F Crown: camera ratio 2.322:1, approximate lift 10.13 rather than 11; the short service
  fins merge into the split-crown form, cyan core remains visible at zero, and internal
  setback/window registration drifts. At the shared footprint it is noticeably taller than B.

Roof-lift estimates use the inferred rear base vertex and highest roof detail; they are
approximate, not architectural survey. Strict per-window monotonicity is not proven.
All types increase in mean interior luminance at each state. New exterior halos are removed
by the cutout at 1x/3x and inspected on dark/light mattes. Tiny edge smoothing is visible
at master resolution. No further calls: differences are reviewable within the authorized
current-style run; exact regeneration is the separately deferred task.

## Verification and recipient check

Technical checks are in `family/checks.json`: 25 files, RGBA dimensions, shared alpha per
type, zero exterior RGB, partial coverage, no canvas clipping, monotonic mean luminance,
and unchanged A/runtime hashes relative to the starting commit.

Visual inspection: actual 1x contact sheet, 3x sheet, and all five 100% sprites on dark/light
backgrounds. Distinct silhouettes/material family are visible; differences above retained.
Synthetic recipient self-check by the author (Astra), not owner acceptance: an owner can
compare labelled type rows and state columns at actual draw size, then inspect 3x;
an integrator can identify paths, anchor, scale and known limitations from this document
and per-type metadata. Runtime integration and the actual owner decision are not performed.
