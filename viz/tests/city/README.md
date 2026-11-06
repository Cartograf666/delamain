# Frozen fight rules acceptance fixture

Source: `./work/city-growth/`,
owner brief `brief-city-growth-live.md` (2026-11-05). Source simulation files are read-only.

- `work.json` is the frozen reference input: 23 projects, 1,368 tasks, consisting
  of 995 DONE and 373 STOP texts containing the case-sensitive substring REPORT.
- `reference.json` contains names/mains, all 210 fight frames, and the first 29
  real-day series rows, extracted from the source `result.json`.
- Python `sha256(json.dumps(frames).encode())[:16]` is `1c646beb11913ac2`
  for all 210 frames. The 29 real-day frames alone hash to `910b430c5bc10060`.
  `TestCityFrozenFingerprint` verifies the former; `TestCityReference` explicitly runs the legacy policy and compares
  every integer of all 29 real frames and every project main to the reference.

## Intentional landmark delta

The source simulation does not protect landmark pads. Production does. The same
frozen work, with protection enabled, hashes to `9e56740eebde7497` for the 29 real
frames. Protection adds these 12 source plot IDs to reservations:
`35, 859, 962, 988, 1675, 1880, 2216, 2432, 3418, 3479, 3849, 4130`.

This changes the available area, placement/paths and subsequent daily growth.
In particular Delamain moves off its original landmark main to a free island
plot. There are 923 final plot-owner differences from the unprotected reference;
this is a propagated simulation delta, not 923 direct landmark exclusions.
The contiguous-starter fix introduces zero extra differences in the unprotected
29-day run. Both 29-day hashes are pinned in `TestCityReference`.

The opt-in `TestCityLiveReferenceAudit` writes every final owner difference by
source plot ID to `CITY_AUDIT_OUT`, separating reference-to-protected changes
from protected-to-current changes and listing changed daily journal inputs.
For the immutable real archive snapshot captured during this task, the latter
has 0 owner differences and one changed daily input (Delamain/2026-11-05).
Its totals are 1,370 tasks: 997 DONE + 373 STOP/REPORT; it is newer than the frozen
1,368 input. These observations are dated evidence, not fixed live expectations.

## Checks

From `viz/`: `go test ./...`, `go test -race ./...`, `go vet ./...`.
`TestCityStress` reconstructs daily ownership from frames for real, 20x monster,
alone, late-newcomer and silence inputs. Forecast work is constructed only by
these tests. `TestCitySaturatedEdgeBite` guarantees the no-25-free-plots bite path
runs; `TestCityConstrainedStarter` covers a dangling edge, donor disconnection,
protected gaps and island borders. A failed seed plan changes no ownership;
production searches another site, or leaves the project unseated and retries on
the following day when no valid triple exists.

For independent parser parity, copy only stage.json and journals into a private
snapshot, run the unchanged `parse_journal.py` logic with HOME pointing to that
snapshot and output in an evidence directory, then run:

```sh
CITY_AUDIT_ROOT=/path/to/snapshot \
CITY_PARSER_REFERENCE=/path/to/generated/work.json \
CITY_AUDIT_OUT=/path/to/reference-audit.json go test ./... -v
```

The reference parser's exact service tags, start/resume pairing, terminal rules,
line grammar, hub-start exclusion and daily rounding remain separate from the
live event parser. Unknown future repository fallback remains the established
server policy. No source simulation, frontend, closure trigger or reward rules
are changed by this task.

## Actual vacancy policy (v4)

The default simulation and `/city` use actual vacancy. After DarkAfter idle days,
original excess-area / average-plot-area eligibility is released from Owner and
territory maps immediately, including more than six houses on one day. The main,
minimum three occupied houses, reservations and connected donor footprint stay
protected. No new vacancy delay or tenure requirement is imposed. Houses that
cannot be removed while preserving those safeguards remain occupied. Existing
work, growth, level and transfer rules otherwise remain intact.

The former occupant has the existing Cool-length wait before reclaiming its own
freshly vacated parcel; this is transfer-history metadata, not retained ownership.
Other projects can use the free parcel immediately. Empty parcels have no owner,
no growth level and no dark owned state. Frames, API membership, count and owned
footprint area all reflect the same canonical simulation state.

`TestCityActualVacancyHistory` independently reconstructs 90 days, checks the new
rule, series area, neutral state, no daily ownership ping-pong and unchanged past
frames when later days are computed. `TestCityVacancyExcessEmptiesImmediately`
requires a controlled 20-house release that day. The opt-in
`TestCityActualVacancyArchive` checks every actual dated API response against its
owned footprints; set `CITY_AUDIT_ROOT` to an immutable archive copy and optionally
`CITY_VACANCY_OUT` to save the final response. Legacy fingerprints remain pinned
and intentional v4 drift is checked separately; the external simulation and
original frozen fixtures remain unchanged.
