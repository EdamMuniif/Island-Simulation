/**
 * RECONSTRUCTED GEOMETRY MODULE — NOT THE ORIGINAL MAP.JS.
 * The exact coastline, reef, streets, and harbour coordinate arrays from the
 * earlier inline message were not accessible as a mounted file. The map below
 * is a functional approximation, using the original known initial points and
 * transform conventions. Replace this file with the original map.js to restore
 * the precise authored geometry.
 */
export const SCALE=.60;
export const mapPoint=(x,z)=>[(x-397)*SCALE,(z-592)*SCALE];

// First six coastline points were retained verbatim from the source excerpt;
// remaining perimeter vertices are approximate reconstruction only.
const coastline=[
  [328,267],[320,283],[286,291],[259,315],[245,343],[228,384],
  [219,422],[211,466],[195,506],[178,548],[170,588],[171,622],
  [185,668],[200,714],[212,763],[241,814],[274,855],[304,884],
  [343,914],[392,931],[439,936],[490,937],[529,931],[572,915],
  [596,887],[606,844],[603,799],[595,762],[585,724],[571,678],
  [560,639],[557,593],[540,548],[521,507],[503,461],[496,421],
  [482,385],[464,355],[441,324],[410,296],[376,275],[349,265]
];
// First three outer reef coordinates are from the source excerpt; others
// are an approximate perimeter, not a surveyed outline.
const reefOutline=[
  [298,212],[249,222],[199,246],[166,290],[146,344],[119,405],
  [113,457],[97,513],[96,566],[106,636],[119,699],[154,771],
  [185,836],[223,900],[274,952],[327,981],[389,999],[454,1000],
  [519,994],[575,980],[615,949],[641,913],[665,866],[665,808],
  [654,743],[637,681],[616,616],[594,547],[573,482],[558,423],
  [543,364],[513,315],[472,274],[425,241],[370,223]
];
function sampleClosed(points,subdivisions){
  const result=[];
  for(let i=0;i<points.length;i++){
    const p0=points[(i-1+points.length)%points.length];
    const p1=points[i];const p2=points[(i+1)%points.length];
    const p3=points[(i+2)%points.length];
    for(let k=0;k<subdivisions;k++){
      const t=k/subdivisions,t2=t*t,t3=t2*t;
      result.push([0,1].map(j=>.5*((2*p1[j])+(-p0[j]+p2[j])*t+
        (2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+
        (-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)));
    }
  }
  return result;
}
const coast=sampleClosed(coastline,3),rawReef=sampleClosed(reefOutline,3);
const reef=coast.map((_,i)=>rawReef[Math.floor(i*rawReef.length/coast.length)]);
export const outline=coast.map(p=>mapPoint(...p));
export const inland=coast.map(([x,z])=>mapPoint(x*.968+399*.032,z*.979+600*.021));
export const reefRings=Array.from({length:22},(_,i)=>{
  const fraction=(21-i)/21;
  return coast.map(([x,z],j)=>mapPoint(x+(reef[j][0]-x)*fraction,z+(reef[j][1]-z)*fraction));
});
export function inside(x,z,polygon=inland){
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)yes=!yes;
  }
  return yes;
}
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
// Street centerlines below approximate the original network corridors.
export const streets=[
  [[-112,0],[-90,0],[-68,0],[-40,0],[0,0],[50,0],[112,0],[204,0]],
  [[0,-123],[0,-60],[0,0],[0,70],[0,150],[0,218]],
  [[-96,-112],[-96,-80],[-96,-40],[-90,0]],
  [[-93,-59],[-64,-59],[-35,-59],[0,-59]],
  [[-35,58],[-11,58],[24,58],[58,58]],
  [[-25,-155],[-25,-125],[-25,-105],[-25,-84],[0,-60]],
  [[52,0],[52,-53],[62,-80],[89,-100]],
  [[95,0],[106,41],[140,55]]
].map(line=>line.map(([u,w])=>grid(u,w)));
streets.push([grid(-25,-155),mapPoint(378,343),mapPoint(347,325),mapPoint(314,318)]);
export const harbourArm=[
  [[366,313],[368,290],[384,253]],
  [[440,340],[447,317],[452,272]],
  [[480,365],[481,335],[481,291]]
].map(line=>line.map(p=>mapPoint(...p)));
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
