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
