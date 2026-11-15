import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from './three.module.js';
import { mergeGeometries } from './merge.js';
import { LAMP_POSITIONS, DEFAULTS, makeController, testTrafficAt } from './adaptive.js';
import { PHASES, signalAt, lightsOn, forwardDistance } from './traffic.js';
import { SCALE, grid, roadCoordinates, inside, outline, inland, reefRings, shuttle, streets, harbourArm, harbourQuay, landmarkSites } from './map.js';
import { ROAD_VEHICLE_TYPES, PEDESTRIAN_ROADS, CROSSING_SPECS, streetLoop, roadCrossing } from './movementRoutes.js';

assert.equal(THREE.REVISION, '187');
assert.equal(typeof THREE.WebGLRenderer, 'function');
assert.equal(typeof mergeGeometries, 'function');
assert.equal(PHASES.reduce((sum, p) => sum + p[0], 0), 62);
for (let t = 0; t < 62; t++) {
  const s = signalAt(t);
  assert.ok([s.main, s.side, s.walk].filter(v => v === 'green').length <= 1);
}
assert.equal(lightsOn(17 * 60 + 44), false);
assert.equal(lightsOn(17 * 60 + 45), true);
assert.equal(lightsOn(5 * 60 + 44), true);
assert.equal(lightsOn(5 * 60 + 45), false);
assert.equal(forwardDistance(8, 1, 10, 1), 3);
assert.equal(forwardDistance(1, 8, 10, -1), 3);
assert.ok(outline.length > 100);
assert.equal(reefRings.length, 22);
// Screenshot-derived geometry invariants (visual, not geodetic).
assert.equal(streets.length, 13);
assert.equal(harbourArm.length, 3);
assert.ok(harbourQuay.length >= 6);
assert.equal(landmarkSites.length, 12);
assert.ok(landmarkSites.some(site => site.name === 'Angolhitheem School'));
for (const road of streets) for (const point of road) {
  assert.ok(inside(...point), 'Traced road endpoint must remain on island');
}
for (const ring of reefRings) assert.equal(ring.length, outline.length);
const polygonArea = points => Math.abs(points.reduce((a,[x,z],i)=>{
  const [xx,zz]=points[(i+1)%points.length];
  return a+x*zz-xx*z;
},0))/2;
assert.ok(polygonArea(reefRings[0])>polygonArea(outline));
assert.ok(polygonArea(outline)>polygonArea(inland));
const shape = new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,z)));
const geometry = new THREE.ShapeGeometry(shape);
assert.equal(geometry.index.count/3,outline.length-2);
geometry.dispose();
assert.equal(LAMP_POSITIONS.length, 4);
for (const u of LAMP_POSITIONS) {
  const [x,z] = grid(u,7);
  const actor = roadCoordinates(x,z);
  assert.ok(Math.abs(actor.along-u*SCALE) < 1e-8);
  assert.ok(Math.abs(actor.cross-7*SCALE) < 1e-8);
  assert.ok(inside(x,z), 'Reconstructed polygon excludes a test lamp');
}
const c = makeController();
c.step({night: true, now: 1, dt: 1, actors: [{along: LAMP_POSITIONS[0]*SCALE, cross: 0, direction: 1}], settings: DEFAULTS});
assert.equal(c.lamps[0].status,'Detected');
assert.equal(c.lamps[1].status,'Ahead');
assert.ok(c.metrics().baselineEnergy > c.metrics().adaptiveEnergy);
assert.equal(testTrafficAt(0),null);
assert.equal(testTrafficAt(7).label,'Pedestrian walking');
assert.ok(shuttle([-111,0],[204,0],1.68).length > 0);
const html = readFileSync('index.html','utf8');
for (const asset of ['style.css','island.js']) assert.ok(html.includes('./'+asset));
const island = readFileSync('island.js','utf8');
for (const asset of ['three.module.js','software.js','map.js','adaptive.js','merge.js','traffic.js']) {
  assert.ok(island.includes("'./"+asset+"'"),'Missing module reference: '+asset);
}

// V3 population distribution: exactly 29 ambient entities, spread across
// all 13 existing visual roads, plus 5 dedicated night-test models.
const countType=type=>ROAD_VEHICLE_TYPES.filter(t=>t===type).length;
assert.equal(streets.length,13);
assert.equal(ROAD_VEHICLE_TYPES.length,streets.length);
assert.equal(countType('car'),8);
assert.equal(countType('motorbike'),3);
assert.equal(countType('cycle'),2);
assert.equal(PEDESTRIAN_ROADS.length,12);
assert.equal(new Set(PEDESTRIAN_ROADS).size,12);
assert.equal(CROSSING_SPECS.length,4);
assert.equal(ROAD_VEHICLE_TYPES.length+PEDESTRIAN_ROADS.length+CROSSING_SPECS.length,29);
for(let index=0;index<streets.length;index++){
  const route=streetLoop(streets[index],1.05);
  assert.ok(route.length>15,'route must have meaningful length');
  const first=route.pose(0),last=route.pose(route.length);
  assert.ok(Math.hypot(first.x-last.x,first.z-last.z)<1e-7);
  for(let k=0;k<50;k++){
    const pos=route.pose(route.length*k/50);
    assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.z));
    assert.ok(inside(pos.x,pos.z),'vehicle route escapes island: '+index);
  }
}
for(const index of PEDESTRIAN_ROADS){
  const offset=index===4?1:index===5?2:3.7;
  const route=streetLoop(streets[index],offset);
  for(let k=0;k<60;k++){
    const pos=route.pose(route.length*k/60);
    assert.ok(inside(pos.x,pos.z),'walking route escapes island: '+index);
  }
}
for(const spec of CROSSING_SPECS){
  const crossing=roadCrossing(streets[spec.road],spec.segment,spec.part);
  assert.ok(inside(...crossing.from)&&inside(...crossing.to));
}
const islandSource=readFileSync('island.js','utf8');
assert.ok(islandSource.includes('ROAD_VEHICLE_TYPES[i]'));
assert.ok(islandSource.includes('walkingRoutes.map('));
assert.ok(islandSource.includes('CROSSING_SPECS.map('));
assert.ok(islandSource.includes('movementRoutes.js'));
console.log('PASS — Three.js r187, geometry, traffic, lighting schedule, transforms, controller, and asset references.');
console.log('PASS — V3 counts, 13 vehicle routes, 12 walker routes, four crossings, and all-land route samples.');
console.log('NOTE — map geometry is visually traced, not surveyed; browser rendering remains unverified.');
