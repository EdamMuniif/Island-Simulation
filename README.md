# R. Angolhitheemu — 3D Island & Adaptive LED Street Lighting Simulation

Interactive Three.js visualization of R. Angolhitheemu (Raa Atoll, Maldives) with simulated traffic signals, day/night transitions, four virtual adaptive LED streetlights, configurable detection zones, and illustrative energy estimates.

> **Prototype / verification notice:** This repository is an assembled research demonstration, **not a validated street-lighting design**. In this uploaded version, `map.js` uses an **approximate reconstructed coastline, reef and street network** because the complete original geometry was not available. The visual island layout is **not survey-accurate**. The site has passed JavaScript syntax and limited controller-logic checks, but **complete browser rendering and UI behavior have not been verified**.

## Run locally

Serve the project from its root directory (ES modules do not reliably load from `file://`):

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/.

No third-party tracking scripts are required. The bundled Three.js modules are from revision r187.

## Modules

- `index.html` — controls and dashboard markup
- `style.css` — responsive dark UI
- `island.js` — 3D visualization, scene and application loop
- `map.js` — **approximate reconstructed** geographical and street geometry
- `adaptive.js` — 4-zone adaptive LED controller and demonstration actors
- `traffic.js` — signal phases, traffic movement and night schedule
- `software.js` — Canvas 2D rendering fallback
- `merge.js` — geometry batch utilities
- `three.core.js`, `three.module.js` — Three.js r187 runtime

## Lighting-model assumptions

Four lamps: nominal 40 W maximum, 4 W minimum per lamp, plus 2 W shared control overhead. The estimates are simulated and not metered or verified against road-illumination or electrical standards. The map's numerical scale is illustrative, not calibrated to physical metres.

## Verification still needed

- Launch in desktop/mobile browser and inspect console
- Verify Three.js rendering and 2D fallback
- Exercise camera, traffic signals, lighting test controls and energy dashboard
- Restore and cross-check original coastline/road coordinates from the source author
- Calibrate road-user detection and energy assumptions before reporting engineering findings

The external `CRXLauncher` and `static-lib.com` scripts were **not** included.

## Reference-traced island layout (experimental update)

The shoreline, inset vegetation boundary, offshore reef, village roads, harbour
entrance, quay and breakwaters have been **visually re-traced** from three
November 2026 satellite screenshots supplied for this project. Reference
landmarks now include the hill, jetty, fishing point, cafe, school, Xefex,
Octopus Club, football/futsal grounds, agricultural area and southern point.

- No Google satellite images are embedded, copied or distributed.
- Geometry was digitized **by eye** and is **not surveyed/georeferenced**.
  Pixel-to-map transforms are approximate and may be refined from GIS data.
- The two traffic paths, 13 ambient vehicles, 16 ambient pedestrians, four
  prototype lamp positions, PIR detection logic and energy assumptions remain
  unchanged. Drawn residential roads are visual roads rather than a fully
  traffic-routable graph.
- The prior six-PIR-sensor pole and external controller box design is **not yet
  implemented** in this code update; it remains separate follow-up work.
- Automated syntax, module, coordinate, topology and controller tests pass.
  Full WebGL/Canvas browser appearance and mobile behavior are **unverified**
  because automated Chromium rendering did not complete in the test environment.

Run \`node verify.mjs\`, then serve locally using \`python3 -m http.server 8000\`
and inspect the viewport, harbour, woodland, lighting and junction presets in
a real browser before merging to the public website.

## V3.1 — Geographic data foundation (in review)

An independent **WGS84 → UTM 43N** reference frame, a source-checked Maldives
OneMap boundary importer, a survey-point origin, and geographic validation tests
are provided in this branch. The legacy V2 scene is **not replaced** yet.

See [V3.1 geographic foundation documentation](docs/V3_1_GEODATA.md).

Run `npm test` for regression and GIS tests. To request the official polygon
from OneMap (on a machine with network access), run
`node tools/import-onemap.mjs --dry-run` followed by
`node tools/import-onemap.mjs` once the correct island record is verified.

**Data status:** the official polygon has not yet been imported or visually
approved. No real street or building locations are claimed for the current map.

## V3: Island-wide people and vehicle distribution (review branch)

The existing V2 shoreline, road meshes, harbour, buildings, vegetation and
camera presets are **retained**. V3 changes only the movement/population layer.

| Ambient population | Count |
| --- | ---: |
| Cars | 8 |
| Motorcycles with riders | 3 |
| Bicycles with riders | 2 |
| Walking/running pedestrians | 12 |
| Pedestrian crossing characters | 4 |
| **Total independently animated road users** | **29** |

**Distribution:** Each of the 13 existing street polylines has one vehicle.
The 12 walkers follow distinct street-side routes. Four crossing characters
are placed at four different road locations (two near the original signal
junctions and two residential street crossings). The dedicated five night-test
models remain separate; night test hides ambient traffic and displays one
test actor at a time.

**Technical boundaries:**
- The first two vehicle routes retain their existing junction signal behavior.
  The remaining 11 roads support independent out-and-back motion and U-turns.
- The island roads are an **illustrative network** and not a surveyed, connected
  road graph. Cars currently do not switch between streets.
- Residential crossing timing is illustrative; vehicle-to-pedestrian collision
  avoidance and intersection priority/yielding have not been implemented.
  Do not interpret traffic animation as a certified safety or detection study.
- The four-lamp adaptive LED and energy calculations have not been rewritten.
- Route-position tests verify all mobile routes stay within the model island;
  **live browser rendering and control interactions remain unverified**.

Run `node verify.mjs` to check counts, route bounds and the existing lighting
logic; then run `python3 -m http.server 8000` for visual verification.

## V3: village-scale road narrowing (review branch)

This change **retains all 13 road centerlines**, buildings, vegetation, coastline,
harbour, landmark objects, 13 vehicles, 12 walkers and 4 crossing characters.
The road rendering now uses three narrower visual width profiles:

| Street class | Surface width | Pale base width | Roads |
| --- | ---: | ---: | ---: |
| Main | 5.20 | 5.90 | 2 |
| Secondary | 4.45 | 5.05 | 6 |
| Minor residential | 3.95 | 4.55 | 5 |

Compared with the previous uniform 6.5 surface and 8.0 base, this reduces
road visual dominance, removes oversized junction bulbs, and reduces zebra
crossing span. The default pedestrian crossing approach half-width is changed
from 4.7 to 3.2 local scene units. Existing vehicle offsets are kept,
with a model-envelope clearance assertion for each road class.

**The numbers above are illustrative local scene units, not measured physical
road widths.** They are based on a visual comparison with the supplied
satellite reference, not a surveyed roadway specification. Test the camera,
traffic, walking routes and lamp overlays in a browser before merging.
