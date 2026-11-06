# Image generation log

Budget: at most 12 calls. Built-in Codex image generator only.
No CLI/API fallback or procedural replacement authorized.

## 04 — roof plans (prompt recorded before call)

Create a production game sprite texture atlas of EXACTLY NINE square roof PLAN tiles, 3 columns by 3 rows, 1024x1024. Orthographic TOP-DOWN view straight vertically down: rectangles only, absolutely no perspective or isometry, no visible building walls, no shadows, no sky, no ground, no text except H on helipad. Each tile completely fills its equal square cell, no gutters, borders or labels. Blue night-city palette: steel-blue roof membranes, cobalt metal parapets, navy blue machinery, restrained cool white small equipment lights. No brown, no bronze. Every tile has matching flat blue perimeter for seamless assembly; inset 10 percent from edge for all equipment. Row 1 GLASS TOWER: flat glass roof with fine rectangular structural panels; roof with rectangular cooling machinery and vents; flat inset helipad with a clean H and blue square outline, no raised perspective. Row 2 OFFICE: flat blue membrane roof with orderly panel seams; blue machinery roof with two ventilation housings in top-down plan; flat blue setback terrace plan with a centered smaller blue rectangular roof zone. Row 3 HOUSE and long residential slabs: simple flat blue roof with few seams; blue roof with small rectangular ventilation ducts and access hatch; flat blue roof with a subtle smaller rectangular utility zone. All illustration is top-down flat texture; never show sides of any objects. Clean precise game sprite art, restrained detail readable at 32x32 pixels. No painted light glow outside roof.

Result: _raw/roofs.png, 1254×1254. Nine orthographic plan cells; accepted for this checkpoint, not owner-approved.

## 01 — glass facade probe (prompt recorded before call)

Create a production game texture sheet of FLAT ORTHOGRAPHIC FRONT ELEVATION
facade modules for a blue glass night city. Output 1024×640, exact 4 columns by
5 rows of 256×128 pixel rectangular tiles, no margins, no gaps, no labels.
Each cell is ONE BAY wide and ONE FLOOR tall, NOT a whole building.
Every tile completely fills its cell. Straight horizontal/vertical lines only.
No perspective, no visible side or roof, no sky, no ground, no shadows, no glow
beyond windows. Neutral frontal shading, no left/right light differentiation.
Deep blue and steel blue glass, crisp fine blue mullions. NO brown/bronze.
Each tile has exactly FOUR rectangular window panels at fixed positions:
window x ranges 32–64, 80–112, 128–160, 176–208; y=32–96 within each tile.
All four windows lit, alternating warm amber and cool white; keep their position
and dimensions identical in every tile. Structural design varies only in blue
frames and spandrels. The top/bottom 8 pixels remain a uniform steel-blue
horizontal seam band; left/right 8 pixels a uniform dark-blue seam band.
Order, left-to-right then top-to-bottom:
1 ground left-edge A; 2 ground left-edge B; 3 ground middle A;
4 ground middle B; 5 ground right-edge A; 6 ground right-edge B;
7 mid left-edge A; 8 mid left-edge B; 9 mid middle A; 10 mid middle B;
11 mid middle C; 12 mid right-edge A; 13 mid right-edge B;
14 top left-edge A; 15 top left-edge B; 16 top middle A;
17 top middle B; 18 top right-edge A; 19 top right-edge B;
20 spare repeat of mid middle A.
Ground tiles imply entrance level with glazed doors inside the same window grid.
Top tiles have a thin blue cornice within their cell. Edge tiles have subtle
vertical termination trim at their appropriate side, never protruding.
Production sprite art, restrained detail, readable at 32×16 pixels per tile.
This is a modular texture atlas, not a presentation board or a city illustration.

Result: generated _raw/glass.png. Flat 4×5 grid and 4 windows per bay confirmed visually. Window positions drift slightly; script alignment and seam correction required.

## 02 — office facade (prompt recorded before call)

Create a production game texture sheet of FLAT ORTHOGRAPHIC FRONT ELEVATION
facade modules for a blue night city, office family. Output 1024×640, exact 4 columns by
5 rows of 256×128 pixel rectangular tiles, no margins, no gaps, no labels.
Each cell is ONE BAY wide and ONE FLOOR tall, NOT a whole building.
Every tile completely fills its cell. Straight horizontal/vertical lines only.
No perspective, no visible side or roof, no sky, no ground, no shadows, no glow
beyond windows. Neutral frontal shading, no left/right light differentiation.
Deep blue and steel blue glass, crisp fine blue mullions. NO brown/bronze.
Each tile has exactly FOUR rectangular window panels at fixed positions:
window x ranges 32–64, 80–112, 128–160, 176–208; y=32–96 within each tile.
All four windows lit, alternating warm amber and cool white; keep their position
and dimensions identical in every tile. Structural design varies only in blue
frames and spandrels. The top/bottom 8 pixels remain a uniform steel-blue
horizontal seam band; left/right 8 pixels a uniform dark-blue seam band.
Order, left-to-right then top-to-bottom:
1 ground left-edge A; 2 ground left-edge B; 3 ground middle A;
4 ground middle B; 5 ground right-edge A; 6 ground right-edge B;
7 mid left-edge A; 8 mid left-edge B; 9 mid middle A; 10 mid middle B;
11 mid middle C; 12 mid right-edge A; 13 mid right-edge B;
14 top left-edge A; 15 top left-edge B; 16 top middle A;
17 top middle B; 18 top right-edge A; 19 top right-edge B;
20 spare repeat of mid middle A.
Ground tiles imply entrance level with glazed doors inside the same window grid.
Top tiles have a thin blue cornice within their cell. Edge tiles have subtle
vertical termination trim at their appropriate side, never protruding.
Production sprite art, restrained detail, readable at 32×16 pixels per tile.
This is a modular texture atlas, not a presentation board or a city illustration.
Family-specific material: Mid-rise office facade: pale steel-blue horizontal spandrel bands, deep navy frames, regular wide blue glass bays. Restrained modern office, no brick.

Result: generated successfully; raw sheet retained beside its prompt. Flat grid and four panes per cell inspected.

## 03 — house facade (prompt recorded before call)

Create a production game texture sheet of FLAT ORTHOGRAPHIC FRONT ELEVATION
facade modules for a blue night city, house family. Output 1024×640, exact 4 columns by
5 rows of 256×128 pixel rectangular tiles, no margins, no gaps, no labels.
Each cell is ONE BAY wide and ONE FLOOR tall, NOT a whole building.
Every tile completely fills its cell. Straight horizontal/vertical lines only.
No perspective, no visible side or roof, no sky, no ground, no shadows, no glow
beyond windows. Neutral frontal shading, no left/right light differentiation.
Deep blue and steel blue glass, crisp fine blue mullions. NO brown/bronze.
Each tile has exactly FOUR rectangular window panels at fixed positions:
window x ranges 32–64, 80–112, 128–160, 176–208; y=32–96 within each tile.
All four windows lit, alternating warm amber and cool white; keep their position
and dimensions identical in every tile. Structural design varies only in blue
frames and spandrels. The top/bottom 8 pixels remain a uniform steel-blue
horizontal seam band; left/right 8 pixels a uniform dark-blue seam band.
Order, left-to-right then top-to-bottom:
1 ground left-edge A; 2 ground left-edge B; 3 ground middle A;
4 ground middle B; 5 ground right-edge A; 6 ground right-edge B;
7 mid left-edge A; 8 mid left-edge B; 9 mid middle A; 10 mid middle B;
11 mid middle C; 12 mid right-edge A; 13 mid right-edge B;
14 top left-edge A; 15 top left-edge B; 16 top middle A;
17 top middle B; 18 top right-edge A; 19 top right-edge B;
20 spare repeat of mid middle A.
Ground tiles imply entrance level with glazed doors inside the same window grid.
Top tiles have a thin blue cornice within their cell. Edge tiles have subtle
vertical termination trim at their appropriate side, never protruding.
Production sprite art, restrained detail, readable at 32×16 pixels per tile.
This is a modular texture atlas, not a presentation board or a city illustration.
Family-specific material: Low-rise and long residential slab facade: blue painted concrete, blue steel window trim, narrow blue horizontal sill bands, simple repeated residential bays. No brick, no brown, no roof eaves perspective.

Result: generated successfully; raw sheet retained beside its prompt. Flat grid and four panes per cell inspected.

## Final provenance

4 built-in image-generator calls used, 8 unused. No CLI fallback or procedural
facade/roof substitute. Files: _raw/glass.png, _raw/office.png, _raw/house.png, _raw/roofs.png.
All final artwork is cut/resampled from these source sheets by pack.py.
Source defects corrected: unequal cell/window alignment, isolated bright cornice
lines, inconsistent boundary pixels, stray door highlights outside pane masks.
Door handles and interior mullions remain source-painted details. Roof utility
highlights and the H are non-emissive paint, unchanged across states.

## Pilot 2 — additional generation 1 (2026-11-04)

Purpose: the inspected live-map overview and 3x sheet showed that original glass
and office modules retain the same fine pane rhythm. Replace only the flat facade
source for the four fixed styles; original 4 generations and roof modules remain.

Prompt (recorded before the call):
Create one technical game-art texture atlas, exactly 4 columns by 3 rows of equal
rectangular cells, no margins, no gutters, no text. Each cell is a flat frontal
orthographic facade elevation of ONE structural bay and ONE storey, absolutely
no perspective, no isometric projection, no side walls, no cast shadows. The
four columns are four completely different blue-city architectural materials.
Column 1: midnight blue curtain-wall glass, exactly TWO tall wide rectangular
panes, very thin blue mullion, vertical reflective streaks, almost no horizontal
spandrel. Column 2: rich cyan-blue modern glass slab, one broad horizontal ribbon
of glass with one thin central division, broad smooth blue spandrel, strong
horizontal direction. Column 3: pale periwinkle concrete office, exactly TWO
large square deep-blue windows, thick wide concrete horizontal bands and chunky
piers. Column 4: navy residential masonry, exactly TWO large recessed rectangular
windows with pale blue lintels and sills, calmer wall with broad solid piers.
Row 1 is ground floor: two large entrance/glass panels at those same positions.
Row 2 is the normal repeatable middle storey with the two windows.
Row 3 is the top storey: same windows, a restrained continuous cornice at top.
All openings at identical positions in each column's three rows, windows fill
about 60 percent of the bay width and 65 percent of storey height. All dark blue
glass, unlit at night, not black. Soft neutral frontal ambient illumination,
no baked left/right shading, no brown, bronze, gold, yellow, people or plants.
Crisp polished stylized game textures, simple large masses, absolutely no extra
small windows or micro-detail. Output a landscape 1536x1024 PNG, grid exactly
4x3. This is a flat texture atlas, not a sheet of buildings.

Output accepted as flat elevations after visual inspection: `_raw/pilot2-styles.png`,
1536x1024. Source SHA recorded in final evidence. Three rows retain two broad panes
per bay; source does not add different door hardware at ground, a retained limit.
`pack-styles.py` crops to 32x28, separates cool window emission, and records the
source rects and pane interiors. No perspective rectification or facade repaint.
Additional pilot calls: **1/8**; combined kit calls: **5**. Notable models: **0**.
