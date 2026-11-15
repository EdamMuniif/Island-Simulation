/**
 * V3.1 geographic reference frame for future GIS rendering.
 *
 * Input: longitude/latitude in WGS84 (EPSG:4326), in that order.
 * Output: UTM zone 43N easting/northing (EPSG:32643), in metres.
 *
 * World frame: +x east, -z north, y up. 1 world unit = 1 metre.
 * Origin: surveyed PSM 0118, R. Angolhitheem, 2015.
 *
 * This is intentionally INDEPENDENT of the V2 visual-only map.js transform.
 * Do not mix it into traffic/adaptive.js until V3.4's coordinated migration.
 */

export const CRS = Object.freeze({
  source: 'EPSG:4326',
  target: 'EPSG:32643',
  units: 'metres',
  sceneEast: '+x',
  sceneNorth: '-z',
});

export const ORIGIN = Object.freeze({
  id: 'PSM-0118',
  easting: 279083.7523,
  northing: 641008.0004,
  elevation: 1.826,
  elevationDatum: 'orthometric (survey document)',
  description: 'Reference survey monument on west side of R. Angolhitheem',
  source: 'https://www.mlsa.gov.mv/psm/R%20Angolhitheem%20PSM.pdf',
  surveyed: '2015-05-29',
});

const DEG = Math.PI / 180;
const A = 6378137.0; // WGS84 semimajor axis, metres
const F = 1 / 298.257223563; // WGS84 flattening
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;
const LON0 = 75 * DEG; // UTM zone 43 central meridian

export function wgs84ToUtm43(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) ||
      lon < 72 || lon >= 78 || lat < 0 || lat > 84) {
    throw new RangeError('Coordinates must be WGS84 lon/lat in UTM 43N zone.');
  }

  const phi = lat * DEG;
  const lambda = lon * DEG;
  const sin = Math.sin(phi), cos = Math.cos(phi), tan = Math.tan(phi);
  const e4 = E2 * E2, e6 = e4 * E2;
  const N = A / Math.sqrt(1 - E2 * sin * sin);
  const T = tan * tan;
  const C = EP2 * cos * cos;
  const p = cos * (lambda - LON0);
  const M = A * (
    (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi -
    (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi) +
    (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi) -
    35 * e6 / 3072 * Math.sin(6 * phi)
  );
  const easting = 500000 + K0 * N * (
    p + (1 - T + C) * p ** 3 / 6 +
    (5 - 18 * T + T ** 2 + 72 * C - 58 * EP2) * p ** 5 / 120
  );
  const northing = K0 * (
    M + N * tan * (
      p ** 2 / 2 +
      (5 - T + 9 * C + 4 * C ** 2) * p ** 4 / 24 +
      (61 - 58 * T + T ** 2 + 600 * C - 330 * EP2) * p ** 6 / 720
    )
  );
  return Object.freeze({easting, northing});
}

export function utmToWorld(easting, northing) {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    throw new TypeError('UTM coordinates must be finite metres.');
  }
  return [easting - ORIGIN.easting, ORIGIN.northing - northing];
}

export function wgs84ToWorld(lon, lat) {
  const {easting, northing} = wgs84ToUtm43(lon, lat);
  return utmToWorld(easting, northing);
}

export function worldToUtm(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new TypeError('World x/z must be finite metres.');
  }
  return {easting: x + ORIGIN.easting, northing: ORIGIN.northing - z};
}
