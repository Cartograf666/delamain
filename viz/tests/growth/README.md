# District presentation checks

`node viz/tests/growth/model.test.mjs` checks daily ownership differences, reserved plots, off-state identity, window masks, the fractional optional-window layer mapping, and every one of the 3,889 plot coordinates / 3,561 unique rendered-building links.

`python3 viz/tests/growth/build-map.py` regenerates `assets/gl/growth-plots.json` after changing the scene or archival graph. Original buildings absent from the authored scene intentionally have a null link: exact ground footprints remain available, but no nearest building is assigned another plot's ownership. Existing landmark and owner geometry stays protected.

Start the existing Go server from `viz` with a read-only hub home at a slot-specific port. `GROWTH_ORIGIN=http://127.0.0.1:8822 node viz/tests/growth/browser.cjs` runs headed Chromium against the normal `/?map=1&live=1&lang=ru&follow=0` entry. Requires installed Playwright and Chrome at the same paths as the GL harness. `GROWTH_EVIDENCE` selects the output directory; `GROWTH_BASE_REV` defaults to the feature base `1044de7` for default-page pixel parity. The runner intercepts state/events for deterministic read-only actions and a controlled prior-day transfer; it does not write journals. Close the server you started after the checks.

Evidence distinguishes live archive screenshots from `05-controlled-daily-wave.png`, whose previous-day ownership is deliberately intercepted to exercise a 12-plot transfer. Phone evidence is Chromium touch emulation, not device acceptance.

## Project hue and landmark identity

`node viz/tests/growth/identity.test.mjs` checks stable plot/scene IDs, explicit and virtual mains, geographic support around reserved footprints, protected global owner, unowned/remote negative controls, fixed roof colour, and immutable window masks.

`GROWTH_ORIGIN=http://127.0.0.1:8826 GROWTH_EVIDENCE=/tmp/district-identity-proof node viz/tests/growth/identity-browser.cjs` checks the normal live WebGL entry, Music selection, visible frontmost reserved-pad selection, roof lights, single material/window hue, exact frozen-frame Activity restoration and short Activity/Districts frame cadence. It always uses the explicit frozen v3 `legacy-identity-city.json` for the exact identity scenario and reads `state.json` in the evidence directory if provided, otherwise captures live state. The asserted Music fixture is the 2026-11-05 snapshot (426 active plots, #328092, 400 linked houses plus associated pad 3933). Optional static `auto=true` verification serves the repository's standalone HTML via a browser route because the Go files-only handler redirects index.html into a rejected directory URL. Renderer assets still come from the running Go server. All browsers close in `finally`.

## Actual vacancy (v4)

`GROWTH_ORIGIN=http://127.0.0.1:8827 GROWTH_EVIDENCE=/tmp/vacant-land-slot27/browser node viz/tests/growth/vacancy-browser.cjs` checks real recomputed API snapshots for October 24, October 29 and November 5. It verifies Agent Harness area from owned source footprints, exact linked active hue membership, neutral vacancies, contour fill/holes and zoomed actual hover/click on occupied and cleared facades. Its source archive must cover these dates. Browser output records the actual counts, not a frozen expectation.

The separate exact identity test remains pinned to the accepted v3 snapshot: 426 Music parcels / 401 render identities, colour, dynamic effects, masks and Activity restoration. `legacy-identity-city.json` is a minimal copy of the 2026-11-05 `district-identity-proof/city.json` acceptance evidence; source journals/goals/messages were omitted. V4 intentionally changes simulated membership and must not be judged against those old live counts.
