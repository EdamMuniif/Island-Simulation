import test from 'node:test';
import assert from 'node:assert/strict';
import {CRS, ORIGIN, wgs84ToUtm43,utmToWorld,wgs84ToWorld,worldToUtm} from '../geo/coordinates.js';
import {signedArea,closedRing,pointInRing,assertSimpleRing,esriRingsToGeoJSON,validateIslandBoundary} from '../geo/validate.js';

test('GIS reference frame is EPSG:32643 and one scene unit equals one metre',()=>{
  assert.equal(CRS.target,'EPSG:32643');
  assert.equal(CRS.units,'metres');
  assert.deepEqual(utmToWorld(ORIGIN.easting,ORIGIN.northing),[0,0]);
  assert.deepEqual(worldToUtm(0,0),{
    easting:ORIGIN.easting,northing:ORIGIN.northing});
  assert.deepEqual(wgs84ToWorld(73.0049472222,5.7956861111).map(Math.round),
    [0,0]);
});

test('UTM 43N projection independently matches official Angolhitheem PSM 0118',()=>{
  // Published geodetic coordinates are rounded to .01 arcseconds, so
  // a 1 m threshold is appropriate; not a centimetre-level assertion.
  const lat=5+47/60+44.47/3600,lon=73+17.81/3600;
  const point=wgs84ToUtm43(lon,lat);
  assert.ok(Math.abs(point.easting-279083.7523)<1);
  assert.ok(Math.abs(point.northing-641008.0004)<1);
  assert.throws(()=>wgs84ToUtm43(0,0),RangeError);
  assert.throws(()=>wgs84ToUtm43(73,NaN),RangeError);
});

const outer=[
  [73.004,5.795],[73.008,5.795],
  [73.008,5.791],[73.004,5.791],[73.004,5.795]
];
const hole=[
  [73.005,5.792],[73.006,5.792],
  [73.006,5.793],[73.005,5.793],[73.005,5.792]
];

test('ArcGIS clockwise outer shell and anticlockwise interior convert with hole',()=>{
  assert.ok(signedArea(outer)<0);
  assert.ok(signedArea(hole)>0);
  const geometry=esriRingsToGeoJSON([outer,hole]);
  assert.equal(geometry.type,'Polygon');
  assert.equal(geometry.coordinates.length,2);
  const qa=validateIslandBoundary({type:'Feature',properties:{},geometry});
  assert.ok(qa.areaM2>1000);
  assert.equal(qa.polygonCount,1);
  assert.equal(qa.vertexCount,8);
  assert.ok(pointInRing([73.0066,5.794],outer));
  assert.ok(!pointInRing([73.010,5.794],outer));
});

test('Multiple ArcGIS outer rings produce GeoJSON MultiPolygon',()=>{
  const second=outer.map(([lon,lat])=>[lon+.006,lat]);
  const geometry=esriRingsToGeoJSON([outer,second]);
  assert.equal(geometry.type,'MultiPolygon');
  assert.equal(geometry.coordinates.length,2);
});

test('Invalid and unclosed data is rejected, not silently repaired',()=>{
  assert.throws(()=>closedRing([[0,0],[1,0],[1,1]]),/ring/);
  assert.throws(()=>esriRingsToGeoJSON([hole]),/orientation/);
  const bowtie=[[73.004,5.795],[73.008,5.791],[73.004,5.791],
    [73.008,5.795],[73.004,5.795]];
  assert.throws(()=>assertSimpleRing(bowtie),/Self-intersecting/);
  assert.throws(()=>validateIslandBoundary({
    type:'Feature',geometry:{type:'Polygon',coordinates:[
      [[74,6],[74.01,6],[74.01,6.01],[74,6]]
    ]}
  }),/reference vicinity/);
});
