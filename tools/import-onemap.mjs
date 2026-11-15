#!/usr/bin/env node
/**
 * Fetch the official island boundary from the public Maldives OneMap API.
 * No screenshot-derived coordinates are used or silently substituted.
 *
 * Run: node tools/import-onemap.mjs --dry-run
 * Then: node tools/import-onemap.mjs
 * If source feature names are ambiguous, inspect the printed candidates and
 * select the verified identifier: --object-id <number>.
 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {esriRingsToGeoJSON,validateIslandBoundary} from '../geo/validate.js';
import {CRS,ORIGIN} from '../geo/coordinates.js';

const SERVICE='https://services7.arcgis.com/yvCbn3q8PPtPLZIM/arcgis/rest/services/island_20240509/FeatureServer/0';
const LICENSE='https://readme.onemap.mv/pdf/Data%20Usage%20License.pdf';
const OUT='data/island.geojson';
const META='data/island-source.json';
const MANIFEST='data/source-manifest.json';
const args=process.argv.slice(2);
const dryRun=args.includes('--dry-run');
const idPos=args.indexOf('--object-id');
const userId=idPos>=0?Number(args[idPos+1]):null;
if(idPos>=0&&(!Number.isInteger(userId)||userId<0))
  throw Error('--object-id must be followed by a nonnegative integer');

async function getJson(endpoint,params={}) {
  const url=new URL(endpoint);
  for(const [key,value] of Object.entries({...params,f:'json'}))
    url.searchParams.set(key,String(value));
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Official ArcGIS service returned HTTP '+response.status);
  const body=await response.json();
  if(body?.error)throw Error('Official ArcGIS error: '+JSON.stringify(body.error));
  return body;
}
function normalize(value) {
  return String(value??'').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]/g,'');
}
function identityFields(attrs){
  return Object.entries(attrs||{}).filter(([key,value])=>
    typeof value==='string' && (
      /name|island|atoll|location|geo|އަނގޮ/i.test(key) ||
      normalize(value).includes('angolhith')
    ));
}
function matchesIsland(attrs){
  return identityFields(attrs).some(([,value])=>normalize(value).includes('angolhith'));
}
function featureSummary(feature,idField) {
  const a=feature.attributes||{};
  return {id:a[idField]??a.OBJECTID??a.FID??null,
    names:identityFields(a).slice(0,10)};
}
async function main(){
  const info=await getJson(SERVICE);
  if(info.geometryType!=='esriGeometryPolygon')
    throw Error('Official service layer is no longer a polygon layer');
  const idField=info.objectIdField||'OBJECTID';
  // Search a geographic envelope around the documented island reference.
  // Coordinates are geographic lon/lat degrees, not estimated scene pixels.
  const envelope={xmin:72.996,ymin:5.782,xmax:73.018,ymax:5.804,
    spatialReference:{wkid:4326}};
  const params={where:'1=1',outFields:'*',returnGeometry:'true',outSR:4326,
    geometryType:'esriGeometryEnvelope',inSR:4326,
    spatialRel:'esriSpatialRelIntersects',
    geometry:JSON.stringify(envelope)};
  if(userId!==null){
    delete params.geometry;
    delete params.geometryType;
    delete params.inSR;
    delete params.spatialRel;
    params.objectIds=userId;
  }
  const query=await getJson(SERVICE+'/query',params);
  const candidates=query.features??[];
  console.log('Official OneMap candidates:',JSON.stringify(
    candidates.map(f=>featureSummary(f,idField)),null,2));
  const matched=userId!==null
    ?candidates.filter(f=>Number(f.attributes?.[idField])===userId)
    :candidates.filter(f=>matchesIsland(f.attributes));
  if(matched.length!==1){
    throw Error('Expected exactly one R. Angolhitheemu polygon; found '+
      matched.length+'. Confirm the source identifier before importing.');
  }
  const original=matched[0];
  if(!Array.isArray(original.geometry?.rings))
    throw Error('Selected official record has no polygon rings');
  const geometry=esriRingsToGeoJSON(original.geometry.rings);
  const feature={type:'Feature',
    properties:{...original.attributes,source:'OneMap Maldives island_20240509',
      sourceObjectId:original.attributes?.[idField],crs:'EPSG:4326'},
    geometry};
  const qa=validateIslandBoundary(feature);
  const dataset={type:'FeatureCollection',features:[feature]};
  const metadata={
    dataset:'R. Angolhitheemu island boundary',
    sourceOrganization:'OneMap / Geomatics Department, Maldives',
    sourceUrl:SERVICE,
    licenseUrl:LICENSE,
    attribution:'Contains information licensed under Data Usage License — Maldives Land and Survey Authority',
    sourceRecordId:original.attributes?.[idField],
    sourceGeometryType:info.geometryType,
    sourceAttributes:original.attributes,
    acquiredAt:new Date().toISOString(),
    storedCrs:'EPSG:4326',renderTargetCrs:CRS.target,
    localReference:ORIGIN,
    derivation:'ArcGIS Esri polygon converted to GeoJSON without tracing satellite images',
    qa,
    accuracy:'official-dataset; temporal accuracy and local shoreline changes require separate validation',
    knownMissing:['verified road centre lines','building footprints','reef bathymetry','ground elevations']
  };
  console.log('Boundary QA:',JSON.stringify(qa,null,2));
  if(dryRun){
    console.log('DRY RUN: no files changed.');
    return;
  }
  await mkdir('data',{recursive:true});
  await writeFile(OUT,JSON.stringify(dataset,null,2)+'\n');
  await writeFile(META,JSON.stringify(metadata,null,2)+'\n');
  const manifest=JSON.parse(await readFile(MANIFEST,'utf8'));
  manifest.layers.islandBoundary={
    ...manifest.layers.islandBoundary,
    status:'imported-pending-visual-review',
    file:OUT,
    objectId:original.attributes?.[idField],
    areaM2:qa.areaM2,
    vertexCount:qa.vertexCount
  };
  await writeFile(MANIFEST,JSON.stringify(manifest,null,2)+'\n');
  console.log('Saved',OUT,',',META,'and updated',MANIFEST);
}
main().catch(error=>{
  console.error('V3.1 import failed safely:',error.message);
  process.exitCode=1;
});
