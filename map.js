/**
 * R. Angolhitheemu reference-traced island layout — visual simulation v2.
 * Sources: three user-provided satellite screenshots (whole-island, village
 * streets, northern harbour), November 2026. Coordinates were manually
 * traced and fitted using overlapping landmarks; NOT surveyed/GIS data.
 * No Google satellite image tiles are embedded or redistributed.
 * Original traffic corridors and the simulation coordinate API are retained.
 */
export const SCALE=.60;
export const mapPoint=(x,z)=>[(x-397)*SCALE,(z-592)*SCALE];
// Pixel registrations are fitted visually using Hill, Cafe, Beach and Octopus.
const overviewToMap=([x,y])=>[397+(x-507)/.72,(y+65)/.67];
const villageToMap=([x,y])=>[33.1+.40278*x,325.37+.4582*y];
const overview=p=>mapPoint(...overviewToMap(p));
const village=p=>mapPoint(...villageToMap(p));

// Coastline clockwise from NW headland, including a recessed northern harbour.
const coastlinePixels=[
  [442,109],[422,119],[402,145],[392,172],[381,201],[372,233],
  [363,266],[356,307],[361,345],[374,393],[393,442],[416,480],
  [453,515],[505,541],[560,563],[605,571],[632,561],[650,541],
  [651,513],[643,470],[634,430],[622,385],[607,338],[596,298],
  [583,257],[574,218],[565,179],[556,147],[545,116],[537,112],
  [533,142],[518,163],[494,166],[476,159],[472,138],[479,113],
  [455,107]
];
function closedSpline(points,n){
  const result=[];
  for(let i=0;i<points.length;i++){
    const a=points[(i-1+points.length)%points.length],b=points[i];
    const c=points[(i+1)%points.length],d=points[(i+2)%points.length];
    for(let j=0;j<n;j++){
      const t=j/n,t2=t*t,t3=t2*t;
      result.push([0,1].map(k=>.5*(2*b[k]+(-a[k]+c[k])*t+
        (2*a[k]-5*b[k]+4*c[k]-d[k])*t2+
        (-a[k]+3*b[k]-3*c[k]+d[k])*t3)));
    }
  }
  return result;
}
const coastPixels=closedSpline(coastlinePixels,3),center=[510,341];
export const outline=coastPixels.map(overview);
export const inland=coastPixels.map(([x,y])=>overview([
  x+(center[0]-x)*.036,y+(center[1]-y)*.036
]));
export const reefRings=Array.from({length:22},(_,i)=>{
  const factor=(21-i)/21;
  return coastPixels.map(([x,y])=>{
    const dx=x-center[0],dy=y-center[1],len=Math.hypot(dx,dy)||1;
    return overview([x+35*factor*dx/len,y+35*factor*dy/len]);
  });
});
export function inside(x,z,polygon=inland){
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)yes=!yes;
  }
  return yes;
}

// Preserve old coordinate transform for the main traffic lanes, lamp sensors,
// road-user detection zones and existing camera presets.
export const axis={x:.877,z:.4805};
const length=Math.hypot(axis.x,axis.z);
axis.x/=length;axis.z/=length;
const [cx,cz]=mapPoint(334,477);
export const grid=(u,w)=>[cx+(u*axis.x-w*axis.z)*SCALE,cz+(u*axis.z+w*axis.x)*SCALE];
export const junction=grid(0,0);
export function roadCoordinates(x,z){
  const dx=x-cx,dz=z-cz;
  return {along:dx*axis.x+dz*axis.z,cross:-dx*axis.z+dz*axis.x};
}

// First two routes are preserved working traffic corridors. Remaining roads
// follow the residential street grid in the close-up reference screenshot.
export const streets=[
  [[-112,0],[-78,0],[-36,0],[0,0],[48,0],[96,0],[152,0],[204,0]].map(([u,w])=>grid(u,w)),
  [[0,-123],[0,-84],[0,-43],[0,0],[0,56],[0,111],[0,168],[0,218]].map(([u,w])=>grid(u,w)),
  [[604,111],[765,195],[934,264],[1120,330]].map(village),
  [[546,158],[750,272],[971,407],[1170,532]].map(village),
  [[429,380],[620,450],[915,506]].map(village),
  [[744,119],[832,95],[979,108],[1063,155],[1120,241],[1130,290]].map(village),
  [[609,107],[569,206],[526,313],[536,517]].map(village),
  [[696,184],[653,284],[601,399],[560,520],[497,614]].map(village),
  [[838,148],[765,289],[680,455],[568,752]].map(village),
  [[930,176],[900,276],[856,408],[789,576]].map(village),
  [[560,510],[629,548],[749,612]].map(village),
  [[760,190],[685,342],[621,470]].map(village),
  [[1025,285],[990,359],[953,451]].map(village)
];

// V3 road narrowing: visual widths in local scene units, NOT surveyed metres.
// Keep streets[] arrays unchanged: existing vehicles and pedestrians use them.
// Profile order follows streets[] indices (13 roads).
export const ROAD_CLASSES=Object.freeze([
  'main','main','secondary','secondary','secondary','secondary',
  'minor','secondary','secondary','minor','minor','minor','minor'
]);
export const ROAD_PROFILES=Object.freeze({
  main:Object.freeze({base:5.90,surface:5.20}),
  secondary:Object.freeze({base:5.05,surface:4.45}),
  minor:Object.freeze({base:4.55,surface:3.95})
});

// Separate north harbour entrance breakwaters, central jetty and quay.
export const harbourArm=[
  [[433,145],[440,113],[455,103],[479,109]].map(overview),
  [[545,168],[544,132],[548,112],[563,118]].map(overview),
  [[499,178],[498,157],[499,140]].map(overview)
];
export const harbourQuay=[
  [401,171],[430,164],[456,163],[476,172],[499,180],[530,180],[553,193]
].map(overview);

// Landmark icon coordinates are visual references, not official POI coordinates.
export const landmarkSites=[
  {name:'Angolhitheem Hill',p:overviewToMap([421,144]),major:true},
  {name:'Fishing Point',p:overviewToMap([570,135]),major:true},
  {name:'Angolhitheemu Jetty',p:overviewToMap([498,137]),major:true},
  {name:'Thihthi Cafe',p:overviewToMap([447,218]),major:true},
  {name:'Octopus Club',p:overviewToMap([369,267]),major:false},
  {name:'Xefex',p:overviewToMap([533,231]),major:false},
  {name:'Angolhitheem School',p:overviewToMap([494,262]),major:true},
  {name:'Beach',p:overviewToMap([578,214]),major:false},
  {name:'Football Ground',p:overviewToMap([445,337]),major:false},
  {name:'Futsal Ground',p:overviewToMap([482,338]),major:false},
  {name:'Agricultural Area',p:overviewToMap([482,450]),major:true},
  {name:'Oemathi Kanmathi',p:overviewToMap([628,539]),major:true}
];

export function shuttle(a,b,radius){
  const [ax,az]=grid(...a),[bx,bz]=grid(...b);
  const straight=Math.hypot(bx-ax,bz-az);
  const dx=(bx-ax)/straight,dz=(bz-az)/straight;
  const arc=Math.PI*radius,length=2*(straight+arc);
  function pose(position){
    let s=((position%length)+length)%length;
    let u,w,du,dw;
    if(s<straight){u=s;w=radius;du=1;dw=0;}
    else if((s-=straight)<arc){const t=s/radius;u=straight+Math.sin(t)*radius;w=Math.cos(t)*radius;du=Math.cos(t);dw=-Math.sin(t);}
    else if((s-=arc)<straight){u=straight-s;w=-radius;du=-1;dw=0;}
    else{const t=(s-straight)/radius;u=-Math.sin(t)*radius;w=-Math.cos(t)*radius;du=-Math.cos(t);dw=Math.sin(t);}
    return {x:ax+dx*u-dz*w,z:az+dz*u+dx*w,dx:dx*du-dz*dw,dz:dz*du+dx*dw};
  }
  const stopAt=(along,offset,forward)=>forward?(along-offset)*SCALE:straight+arc+straight-(along+offset)*SCALE;
  return {length,pose,stopAt};
}
