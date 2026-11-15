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
  // Shared vertex normals keep offset paths continuous at every road bend;
  // sampling independent segment normals would make models jump sideways.
  const normals=seg.map(s=>[-s.dz,s.dx]);
  const vertexNormals=Array.from({length:seg.length+1},(_,i)=>{
    if(i===0)return normals[0];
    if(i===seg.length)return normals.at(-1);
    const x=normals[i-1][0]+normals[i][0],z=normals[i-1][1]+normals[i][1];
    const mag=Math.hypot(x,z);
    return mag>.1?[x/mag,z/mag]:normals[i];
  });
  const turn=Math.PI*offset,length=2*(distance+turn);
  const first=seg[0],end=seg.at(-1);
  function sample(d,side){
    d=clamp(d,0,distance);
    const index=seg.findIndex(v=>d<=v.end);
    const i=index<0?seg.length-1:index,s=seg[i];
    const u=clamp((d-s.start)/(s.end-s.start),0,1);
    const n0=vertexNormals[i],n1=vertexNormals[i+1];
    const ox=offset*side,delta=s.end-s.start;
    const dx=(s.b[0]-s.a[0]+ox*(n1[0]-n0[0]))/delta;
    const dz=(s.b[1]-s.a[1]+ox*(n1[1]-n0[1]))/delta;
    const mag=Math.hypot(dx,dz);
    return {x:s.a[0]+(s.b[0]-s.a[0])*u+ox*(n0[0]+(n1[0]-n0[0])*u),
      z:s.a[1]+(s.b[1]-s.a[1])*u+ox*(n0[1]+(n1[1]-n0[1])*u),
      dx:dx/mag,dz:dz/mag};
  }
  function pose(meters){
    let s=((meters%length)+length)%length;
    if(s<distance)return sample(s,1);
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
      const a=sample(distance-s,-1);
      return {...a,dx:-a.dx,dz:-a.dz};
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
