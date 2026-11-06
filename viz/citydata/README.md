# Fixed accepted plot graph

`graph.json` is the immutable topology compiled by the accepted simulation `city-growth/graph.py` from its 4,253-box WebGL source, not the separate 4,367-box legacy map. It contains 3,889 visible plots, 40,408 weighted edges, components, projection and eight base seeds. The Go server loads it once, derives reserved plots and graph neighbourhoods, and runs the daily rules in Go. No Python, forecast, simulation-session path or result.json is used at runtime. Updating geometry requires rebuilding this input and its reference controls.

Source snapshot: `./work/city-growth/plots.json`; seeds from `city/mock/aq-full.json`. Reference controls in `tests/city/` contain the simulation's work snapshot and its first 29 frames/series from result fingerprint `206e4e19e0910781`. They are tests only.
