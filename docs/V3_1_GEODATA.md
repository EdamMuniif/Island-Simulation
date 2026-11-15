# V3.1 — Verified Geographic Foundation (not yet a visual rebuild)

## Status as of 2026-11-15

Implemented:
- Independent WGS84 (EPSG:4326) to UTM zone 43N (EPSG:32643) conversion.
- One-world-unit-per-metre local scene frame anchored to survey point PSM 0118.
- Official island-boundary importer with identity and topology validation.
- Projection, geometry and provenance tests; dataset source manifest.

Not completed:
- The official island polygon has NOT been acquired or committed in this branch:
  the ArcGIS server is not accessible from the current development runtime.
- Real roads, building footprints, elevation data, and reef bathymetry are absent.
- The V2 display and traffic/sensor geometry are intentionally unchanged.
- Live browser rendering and coastline visual agreement remain unverified.

## Source register

Official source: Maldives OneMap, Geomatics Department
https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/island_20240509/FeatureServer/0
Documentation: https://readme.onemap.mv/
Data usage terms: https://readme.onemap.mv/pdf/Data%20Usage%20License.pdf

Survey origin: PSM 0118, R. Angolhitheem, 29 May 2015
https://www.mlsa.gov.mv/psm/R%20Angolhitheem%20PSM.pdf
UTM Zone 43N: E 279083.7523 m, N 641008.0004 m
WGS84: 5°47′44.47″ N, 73°00′17.81″ E
Reported orthometric height: 1.826 m (NOT a terrain elevation model).

If importing OneMap data, credit the Geomatics Department and comply with
the linked official data usage license. Do not imply government endorsement.
No Google satellite tiles or screenshot-traced geographic features are used
in the new V3.1 official data layer.

## Import on a computer with access to the OneMap service

Requirements: Node.js 20+, no extra npm packages.

    npm test
    node tools/import-onemap.mjs --dry-run
    node tools/import-onemap.mjs
    npm test

The importer queries a narrow WGS84 geographic envelope, prints candidate
records, and selects an island only when its name positively matches
Angolhitheemu. On ambiguity, it exits without changing any files. After
verifying the correct source record, the explicit override is:

    node tools/import-onemap.mjs --object-id VERIFIED_ID --dry-run
    node tools/import-onemap.mjs --object-id VERIFIED_ID

Success creates:
- data/island.geojson : one island boundary FeatureCollection in EPSG:4326
- data/island-source.json : original record, provenance, attribution and QA
- data/source-manifest.json : marked imported-pending-visual-review

Commit these outputs only after checking the actual island record and
geographic shape against an independently permitted reference.

## Coordinate-system contract

- geo/coordinates.js exports wgs84ToUtm43(lon,lat) yielding metres in 43N.
- utmToWorld(easting,northing) yields [x,z] local scene coordinates.
- +x = east; -z = north; y = up. 1 world unit equals 1 physical metre.
- [0,0] is the horizontal position of surveyed PSM 0118, not island centroid.
- The survey point height does not set a uniform vertical height for the island.

The current map.js uses SCALE=.60 and screenshot-derived illustrative
coordinates. Never mix these V2 scene units with V3 geospatial metres.
In V3.2 the validated boundary can replace the display geometry; V3.4
should separately move traffic routes and four-lamp detection geometry
onto the unified metres-based frame with regression tests.

## V3.1 acceptance gates

- [x] Coordinate projection and survey-reference test
- [x] Source-checked importer and malformed/ambiguous-geometry rejection
- [x] Explicit dataset manifest and attribution instructions
- [ ] Actual island feature acquired, reviewed and committed
- [ ] Independent locality and shape confirmation completed
- [ ] Roads/buildings data sources assessed
- [ ] Permission to begin V3.2 visual replacement

CI or GitHub Pages success does not certify real-world geographic accuracy.
