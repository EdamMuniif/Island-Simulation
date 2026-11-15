/**
 * V3 population distribution across the existing illustrated street polylines.
 * This is a visual simulation; these streets are not a certified road graph.
 * One vehicle is assigned to every street; walkers use 12 different streets.
 */
export const ROAD_VEHICLE_TYPES=[
  'car','motorbike','car','cycle','car','car','motorbike',
  'car','cycle','car','motorbike','car','car'
];
export const PEDESTRIAN_ROADS=Array.from({length:12},(_,i)=>i);
export const CROSSING_SPECS=[
  {road:0,segment:2,part:.50,controlled:true},
  {road:1,segment:2,part:.50,controlled:true},
  {road:5,segment:1,part:.45,controlled:false},
  {road:8,segment:1,part:.55,controlled:false}
];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

/** Bidirectional closed route following a street polyline; rounded end turns. */
export function streetLoop(points,offset=1.05){
  if(!Array.isArray(points)||points.length<2||offset<=0)throw Error('Invalid street route');
  const seg=[],last=points.length-1;
  let distance=0;
  for(let i=0;i<last;i++){
    const a=points[i],b=points[i+1];
    const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
    if(d<1e-6)continue;
    seg.push({a,b,start:distance,end:distance+d,dx:dx/d,dz:dz/d});
    distance+=d;
  }
  if(!seg.length)throw Error('Degenerate street route');
  const turn=Math.PI*offset,length=2*(distance+turn);
  const first=seg[0],end=seg.at(-1);
  function sample(d){
    d=clamp(d,0,distance);
    const s=seg.find(v=>d<=v.end)||end;
    const u=clamp((d-s.start)/(s.end-s.start),0,1);
    return {x:s.a[0]+(s.b[0]-s.a[0])*u,z:s.a[1]+(s.b[1]-s.a[1])*u,dx:s.dx,dz:s.dz};
  }
  function pose(meters){
    let s=((meters%length)+length)%length;
    if(s<distance){
      const a=sample(s);
      return {x:a.x-a.dz*offset,z:a.z+a.dx*offset,dx:a.dx,dz:a.dz};
    }
    s-=distance;
    if(s<turn){
      const t=s/offset,center=end.b;
      return {x:center[0]-end.dz*offset*Math.cos(t)+end.dx*offset*Math.sin(t),
        z:center[1]+end.dx*offset*Math.cos(t)+end.dz*offset*Math.sin(t),
        dx:end.dx*Math.cos(t)+end.dz*Math.sin(t),
        dz:end.dz*Math.cos(t)-end.dx*Math.sin(t)};
    }
    s-=turn;
    if(s<distance){
      const a=sample(distance-s);
      return {x:a.x+a.dz*offset,z:a.z-a.dx*offset,dx:-a.dx,dz:-a.dz};
    }
    s-=distance;
    const t=s/offset,center=first.a;
    return {x:center[0]+first.dz*offset*Math.cos(t)-first.dx*offset*Math.sin(t),
      z:center[1]-first.dx*offset*Math.cos(t)-first.dz*offset*Math.sin(t),
      dx:-first.dx*Math.cos(t)+first.dz*Math.sin(t),
      dz:-first.dz*Math.cos(t)-first.dx*Math.sin(t)};
  }
  return {length,pose};
}

/** Crossing across a road at a chosen section of its actual centerline. */
export function roadCrossing(points,segment,part=.5,halfWidth=4.7){
  if(segment<0||segment>=points.length-1)throw Error('Invalid crossing segment');
  const a=points[segment],b=points[segment+1];
  const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
  if(d<=0)throw Error('Invalid crossing direction');
  const t=clamp(part,.15,.85),x=a[0]+dx*t,z=a[1]+dz*t,nx=-dz/d,nz=dx/d;
  return {from:[x+nx*halfWidth,z+nz*halfWidth],to:[x-nx*halfWidth,z-nz*halfWidth],length:2*halfWidth};
}
