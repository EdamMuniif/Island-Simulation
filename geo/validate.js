/**
 * Pure geometry conversion and QA for official ArcGIS island polygons.
 * GIS data is never silently approximated or repaired.
 */
import {wgs84ToUtm43} from './coordinates.js';

export function signedArea(ring) {
  let sum=0;
  for(let i=0;i<ring.length-1;i++){
    const [x,y]=ring[i], [xx,yy]=ring[i+1];
    sum+=x*yy-xx*y;
  }
  return sum/2;
}
export function closedRing(ring) {
  if(!Array.isArray(ring)||ring.length<4)throw Error('Polygon ring needs >= 4 points');
  const result=ring.map(point=>{
    if(!Array.isArray(point)||point.length<2||
       !Number.isFinite(point[0])||!Number.isFinite(point[1]))
      throw Error('Nonfinite geographic coordinate');
    return [point[0],point[1]];
  });
  const a=result[0], b=result.at(-1);
  if(a[0]!==b[0]||a[1]!==b[1])throw Error('Unclosed polygon ring');
  if(new Set(result.slice(0,-1).map(p=>p.join(','))).size<3)
    throw Error('Degenerate polygon ring');
  return result;
}
export function pointInRing([x,y], ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>y)!==(b[1]>y) &&
       x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function segmentsIntersect(a,b,c,d) {
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const ab=cross(a,b,c),ac=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);
  return ((ab>0&&ac<0)||(ab<0&&ac>0)) &&
         ((ca>0&&cb<0)||(ca<0&&cb>0));
}
export function assertSimpleRing(ring) {
  // Adjacent edges touch by definition. Reject crossing nonadjacent edges.
  const n=ring.length-1;
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){
    if(i===0&&j===n-1)continue;
    if(segmentsIntersect(ring[i],ring[i+1],ring[j],ring[j+1]))
      throw Error('Self-intersecting island boundary');
  }
}
function projectedArea(ring) {
  const points=ring.map(([lon,lat])=>{
    const p=wgs84ToUtm43(lon,lat);
    return [p.easting,p.northing];
  });
  return Math.abs(signedArea(points));
}

/**
 * ArcGIS polygons use clockwise outer rings and counterclockwise holes
 * in x/easting, y/northing coordinates (negative/positive shoelace sign).
 * We detect topology and avoid treating holes as extra islands.
 */
export function esriRingsToGeoJSON(rings) {
  if(!Array.isArray(rings)||!rings.length)throw Error('No ArcGIS rings returned');
  const parsed=rings.map(closedRing);
  parsed.forEach(assertSimpleRing);
  const outers=parsed.filter(r=>signedArea(r)<0);
  const holes=parsed.filter(r=>signedArea(r)>0);
  if(!outers.length)throw Error('ArcGIS outer-ring orientation unexpected');
  const polygons=outers.map(r=>[r]);
  for(const hole of holes){
    let index=-1,smallest=Infinity;
    for(let i=0;i<outers.length;i++){
      const outer=outers[i];
      if(pointInRing(hole[0],outer)){
        const size=Math.abs(signedArea(outer));
        if(size<smallest){smallest=size;index=i;}
      }
    }
    if(index<0)throw Error('ArcGIS inner ring has no containing outer ring');
    polygons[index].push(hole);
  }
  return {type:polygons.length===1?'Polygon':'MultiPolygon',
    coordinates:polygons.length===1?polygons[0]:polygons};
}

export function validateIslandBoundary(feature) {
  if(feature?.type!=='Feature')throw Error('Expected GeoJSON Feature');
  const g=feature.geometry;
  if(!g||!['Polygon','MultiPolygon'].includes(g.type))
    throw Error('Expected polygon/multipolygon boundary');
  const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  if(!Array.isArray(polygons)||!polygons.length)throw Error('Empty boundary');
  let area=0,vertices=0;
  let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity;
  for(const polygon of polygons){
    if(!Array.isArray(polygon)||!polygon.length)throw Error('Empty polygon');
    for(let k=0;k<polygon.length;k++){
      const ring=closedRing(polygon[k]);
      assertSimpleRing(ring);
      for(const [lon,lat] of ring){
        if(lon<72.98||lon>73.04||lat<5.76||lat>5.82)
          throw Error('Boundary extends outside R. Angolhitheemu reference vicinity');
        minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);
        minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);
      }
      if(k>0&&!pointInRing(ring[0],polygon[0]))
        throw Error('Polygon hole is outside its shell');
      area+=(k===0?1:-1)*projectedArea(ring);
      vertices+=ring.length-1;
    }
  }
  if(!(area>1000&&area<10000000))
    throw Error('Unexpected island polygon area; manual investigation required');
  return {areaM2:Math.round(area),vertexCount:vertices,
    bboxWgs84:[minLon,minLat,maxLon,maxLat],polygonCount:polygons.length};
}
