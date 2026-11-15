import * as T from './three.module.js';
import {softwareRenderer} from './software.js';
import {outline,inland,reefRings,mapPoint,grid,streets,harbourArm,harbourQuay,landmarkSites,inside,axis,junction,shuttle,roadCoordinates,SCALE} from './map.js';
import {LAMP_POSITIONS,ZONE_WIDTH,DEFAULTS,makeController,testTrafficAt} from './adaptive.js';

const world = document.querySelector('#world');
const scene = new T.Scene();
let renderer;
let software=false;
try {
  const gpuCanvas=document.createElement('canvas');
  const context=gpuCanvas.getContext('webgl2',{antialias:true,powerPreference:'high-performance'});
  if(context)renderer=new T.WebGLRenderer({canvas:gpuCanvas,context,antialias:true});
} catch {
  renderer=undefined;
}
if(!renderer){renderer=softwareRenderer();software=true;}
world.append(renderer.domElement);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
if(!software){
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.16;
}
const camera = new T.PerspectiveCamera(38,1,.2,1700);
const hemi = new T.HemisphereLight('#c8edff','#796a42',2);
scene.add(hemi);
const sun = new T.DirectionalLight('#fff0cf',2.8);
sun.castShadow = true;
Object.assign(sun.shadow.camera,{left:-195,right:195,top:237,bottom:-237,near:1,far:800});
sun.shadow.mapSize.set(2048,2048);
sun.shadow.normalBias = .18;
sun.shadow.bias = -.0001;
scene.add(sun,sun.target);
let seed=29107;
function random(){
  seed=(Math.imul(1664525,seed)+1013904223)>>>0;
  return seed/4294967296;
}
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const x=clamp((v-a)/(b-a),0,1);return x*x*(3-2*x);};
const TAU=Math.PI*2;
const materials = new Map();
function mat(color){
  if(!materials.has(color)) materials.set(color,new T.MeshStandardMaterial({color,roughness:.83}));
  return materials.get(color);
}
const boxGeo = new T.BoxGeometry(1,1,1);
const roundGeo = new T.IcosahedronGeometry(1,1);
const globeGeo = new T.SphereGeometry(1,12,8);
const cylGeo = new T.CylinderGeometry(1,1,1,9);
const rimGeo = new T.TorusGeometry(1,.15,6,16);
function mesh(geo,c,x,y,z,sx,sy,sz,parent=scene,shadow=true){
  const m=new T.Mesh(geo,typeof c==='string'?mat(c):c);
  m.position.set(x,y,z); m.scale.set(sx,sy,sz);
  m.castShadow=shadow; m.receiveShadow=true; parent.add(m);
  if(geo===boxGeo&&sy<.09&&parent===scene&&y<1.1&&!shadow)m.userData.surface=-1;
  return m;
}
const box=(c,x,y,z,w,h,d,p,s)=>mesh(boxGeo,c,x,y,z,w,h,d,p,s);
const stone=(c,x,y,z,w,h,d,p,s)=>mesh(roundGeo,c,x,y,z,w,h,d,p,s);
function post(c,x,z,y,h,r,p=scene){return mesh(cylGeo,c,x,y+h/2,z,r,h,r,p);}
const up=new T.Vector3(0,1,0);
function beam(c,a,b,r,p=scene){
  const v=new T.Vector3().subVectors(b,a);
  const o=mesh(cylGeo,c,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,r,v.length(),r,p);
  o.quaternion.setFromUnitVectors(up,v.normalize());
  return o;
}
const v=(x,y,z)=>new T.Vector3(x,y,z);
function islandDisk(name,y,points,color){
  const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,z)));
  const g=new T.ShapeGeometry(shape);
  g.rotateX(Math.PI/2);
  g.computeVertexNormals();
  const o=new T.Mesh(g,new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:1}));
  o.name=name;o.userData.surface=y<.2?-5:-4;o.userData.ground={color,outline:shape.getPoints()};
  o.position.y=y;o.receiveShadow=true;scene.add(o);
}
islandDisk('Sand shoreline',.16,outline,'#e8ca91');
islandDisk('Island vegetation base',.39,inland,'#8c9c61');

function reefTexture(){
  const map=document.createElement('canvas');map.width=512;map.height=512;
  const c=map.getContext('2d');
  for(let i=0;i<reefRings.length;i++){
    const n=Math.round(255*((i+1)/reefRings.length)**.82);
    c.beginPath();
    reefRings[i].forEach(([x,z],j)=>{
      const xx=(x+230)/460*512,zz=(z+300)/600*512;
      if(j===0)c.moveTo(xx,zz);else c.lineTo(xx,zz);
    });
    c.closePath();c.fillStyle='rgb('+n+','+n+','+n+')';c.fill();
  }
  const tex=new T.CanvasTexture(map);tex.flipY=false;return tex;
}

const skyState={
  top:{value:new T.Color('#479ec3')},bottom:{value:new T.Color('#e4eac7')},
  sunP:{value:new T.Vector3()},day:{value:1},warm:{value:0}
};
const sky=new T.Mesh(new T.SphereGeometry(610,32,20),new T.ShaderMaterial({
  side:T.BackSide,depthWrite:false,uniforms:skyState,
  vertexShader:`varying vec3 pos; void main(){pos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 pos; uniform vec3 top,bottom,sunP;uniform float day,warm;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  void main(){vec3 d=normalize(pos);float h=max(d.y,0.);vec3 c=mix(bottom,top,smoothstep(-.09,.76,d.y));
  float s=max(0.,dot(d,sunP)); c+=vec3(1.,.49,.2)*pow(s,10.)*warm*.37;
  c+=vec3(1.,.85,.58)*pow(s,135.)*day*.32+vec3(3.5,2.6,1.6)*smoothstep(.99955,.99983,s)*day;
  vec2 cv=d.xz/(.3+h)*7.2; float puff=noise(cv)*.57+noise(cv*2.17)*.28+noise(cv*4.35)*.15;
  float cloud=smoothstep(.55,.72,puff)*smoothstep(.018,.24,h)*(1.-smoothstep(.51,.88,h));c=mix(c,mix(vec3(.59,.69,.75),vec3(1.,.64,.43),warm*.72),cloud*day*.62);
  vec2 uv=vec2(atan(d.z,d.x),asin(d.y))*vec2(130.,220.);float star=step(.993,hash(floor(uv)))*(1.-smoothstep(0.,.23,length(fract(uv)-.5)));c+=vec3(.69,.82,1.)*star*(1.-day)*smoothstep(.0,.23,h);
  gl_FragColor=vec4(c,1.); #include <colorspace_fragment>
  }`.replace('; #include',';\n#include')
}));
sky.renderOrder=-2;scene.add(sky);
const waterState={
  elapsed:{value:0},day:{value:1},warm:{value:0},sunP:skyState.sunP, reef:{value:reefTexture()}
};
const water=new T.Mesh(new T.PlaneGeometry(2200,2200),new T.ShaderMaterial({
  uniforms:waterState,
  vertexShader:`varying vec3 p;void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`varying vec3 p;uniform float elapsed,day,warm;uniform vec3 sunP;uniform sampler2D reef;
  float wave(vec2 q){return sin(q.x*.86+q.y*.65+elapsed*.9)*.48+sin(q.x*.23-q.y*1.6-elapsed*1.24)*.27+sin(q.x*1.8+q.y*.32+elapsed*1.39)*.15+sin(q.y*.26+q.x*.17-elapsed*.71)*.35;}
  void main(){
  vec2 q=p.xz; float w=wave(q);vec2 e=vec2(.12,0.);vec3 n=normalize(vec3((w-wave(q+e))*.19,1.,(w-wave(q+e.yx))*.19));
  vec2 uv=(q+vec2(230.,300.))/vec2(460.,600.);
  float shoal=texture2D(reef,clamp(uv,0.,1.)).r;
  vec3 deep=mix(vec3(.004,.026,.05),vec3(.008,.242,.306),day);
  vec3 shallow=mix(vec3(.011,.079,.094),vec3(.046,.625,.52),day);
  vec3 c=mix(deep,shallow,shoal);c+=day*vec3(.012,.071,.066)*w*(.4+shoal*.6);
  float foam=exp(-abs(shoal-.978)*95.)*(.42+.32*sin(w*5.+q.x*.18+q.y*.65));
  c+=vec3(.48,.69,.61)*foam*(.25+.75*day);
  vec3 V=normalize(cameraPosition-p);float glint=pow(max(dot(reflect(-sunP,n),V),0.),144.);
  c+=glint*day*mix(vec3(.9,.88,.61),vec3(1.,.47,.19),warm)*1.25;
  float farFade=1.-exp(-length(cameraPosition.xz-q)*.0011); c=mix(c,mix(vec3(.008,.027,.053),vec3(.19,.47,.56),day),farFade*.76);
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
  }`
}));
water.rotation.x=-Math.PI/2;scene.add(water);

function strip(color,a,b,width,y,depth=.05,surface=-2){
  const [x,z]=a,[xx,zz]=b;
  const o=box(color,(x+xx)/2,y,(z+zz)/2,Math.hypot(xx-x,zz-z)+.12,depth,width,scene,false);
  o.rotation.y=-Math.atan2(zz-z,xx-x);o.userData.surface=surface;
  return o;
}
function stripMap(color,a,b,width,y,depth,surface){
  return strip(color,mapPoint(...a),mapPoint(...b),width,y,depth,surface);
}
const [jx,jz]=junction;
const main=shuttle([-111,0],[204,0],1.68);
const sideRoad=shuttle([0,-123],[0,218],1.45);
const roads=[];
for(const line of streets)for(let i=1;i<line.length;i++){
  roads.push([line[i-1],line[i]]);
}
function circle(x,z,r,y,color,level){
  const m=mesh(cylGeo,color,x,y,z,r,.025,r,scene,false);m.userData.surface=level;
  return m;
}
for(const [a,b] of roads){
  strip('#c4ba9f',a,b,8.0,.426,.045,-3);
  strip('#505652',a,b,6.5,.461,.034,-2);
  for(const [x,z] of [a,b])circle(x,z,3.25,.46,'#505652',-2);
}
for(let u=-104;u<200;u+=11){
  if(Math.min(...[-96,-49,0,49,101,145].map(x=>Math.abs(u-x)))<9)continue;
  strip('#d8c48f',grid(u-2,0),grid(u+2,0),.10,.49,.012,-1);
}
for(const [u,w,horizontal] of [[-18,2.8,true],[12,-2.8,true],[-2.4,-13,false],[2.4,13,false]]){
  const a=horizontal?grid(u,w-2.25):grid(u-2.25,w);
  const b=horizontal?grid(u,w+2.25):grid(u+2.25,w);
  strip('#e5ddc8',a,b,.15,.492,.013,-1);
}
for(let i=0;i<8;i++){
  const w=-4.8+i*1.36;
  strip('#ece4d2',grid(-15,w),grid(-11,w),.42,.495,.014,-1);
}
const distanceTo=(x,z,a,b)=>{
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
};
const roadGap=(x,z)=>Math.min(...roads.map(([a,b])=>distanceTo(x,z,a,b)));

for(const arm of harbourArm){
  for(let i=1;i<arm.length;i++){
    const a=arm[i-1],b=arm[i];
    strip('#807b6b',a,b,7.6,.16,1.35,-.66);
    strip('#d1c2a4',a,b,6.6,.865,.10,-.48);
    const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let j=1;j<d;j+=2.3){
      const t=j/d,x=mix(a[0],b[0],t),z=mix(a[1],b[1],t);
      stone(j%2?'#8b8170':'#a4967c',x,.12,z,2.8,.58,2.8);
    }
    circle(a[0],a[1],3.37,.867,'#d1c2a4',-.47);
  }
  const [x,z]=arm.at(-1);
  circle(x,z,3.37,.867,'#d1c2a4',-.47);
}
for(let i=1;i<harbourQuay.length;i++){
  strip('#b4a489',harbourQuay[i-1],harbourQuay[i],9,.408,.07,-2.8);
}
// Harbour revetments and jetty caps in the north basin.
stripMap('#b59770',[335,328],[337,288],4.4,.74,.22,-.41);
stripMap('#b59770',[386,365],[387,323],4.4,.74,.22,-.41);
stripMap('#aa9c82',[173,504],[194,505],5,.29,.37,-2.8);
stripMap('#aa9c82',[169,507],[165,572],4,.29,.37,-2.8);
for(const [x,z] of [[384,253],[416,253],[366,290],[447,317]]){
  const [xx,zz]=mapPoint(x,z);
  post('#555d59',xx,zz,.8,.8,.30);
}

const buildingWindows=[];
function building(x,z,w,d,h,wall,roof,front=1){
  const p=new T.Group();p.position.set(x,.44,z);scene.add(p);
  box('#d7c3a0',0,.11,0,w+.55,.22,d+.55,p);
  box(wall,0,h*.5+.2,0,w,h,d,p);
  const peak=h*.42;
  const roofShape=new T.Shape();roofShape.moveTo(-d/2-.42,0);roofShape.lineTo(d/2+.42,0);roofShape.lineTo(0,peak);roofShape.closePath();
  const roofGeo=new T.ExtrudeGeometry(roofShape,{depth:w+.76,bevelEnabled:false});
  roofGeo.rotateY(-Math.PI/2);roofGeo.translate((w+.76)/2,h+.18,0);
  mesh(roofGeo,roof,0,0,0,1,1,1,p).userData.depthBias=-3;
  for(let j=-Math.floor(w/3);j<=Math.floor(w/3);j+=1){
    const xx=j*1.55,zz=(d/2+.03)*front;
    if(Math.abs(xx)>w/2-.48)continue;
    const glass=new T.MeshStandardMaterial({color:'#41565a',emissive:'#ffc36d',emissiveIntensity:0,roughness:.28});
    if(j===0)box('#516362',xx,.79,zz,.71,1.2,.095,p);
    else{
      box('#e7dec1',xx,h*.58,zz,.85,.64,.11,p);
      buildingWindows.push(glass);
      box(glass,xx,h*.58,zz+.06*front,.67,.47,.092,p,false);
    }
  }
  box(roof,0,h*.72,front*(d/2+.43),w*.90,.13,1.05,p);
  return p;
}
const buildings=[];
const roofColors=['#8d5147','#377574','#667d82','#b27356','#80949a','#938373','#b6b4a2','#756c64'];
const wallColors=['#e9d1a7','#ded7c5','#efdfc0','#c8c3a8','#dbbea9'];
function mapBuilding(px,pz,w,d,h,i){
  const [x,z]=mapPoint(px,pz);
  const p=building(x,z,w,d,h,wallColors[i%wallColors.length],roofColors[i%roofColors.length]);
  p.rotation.y=-Math.atan2(axis.z,axis.x)+(i%7===0?Math.PI/2:0);
  buildings.push({x,z,r:Math.hypot(w,d)*.49});
  return p;
}
const landmarkPositions=landmarkSites;
mapBuilding(313,332,10.5,6.5,3.2,1);
mapBuilding(310,414,6.6,4.9,2.9,3);
mapBuilding(470,392,5.4,4.2,2.5,2);
// Landmarks are approximate visual proxies, not measured building footprints.
mapBuilding(383,502,12.5,7.5,3.4,4); // School vicinity
mapBuilding(432,438,7.0,5.0,2.9,5); // Xefex vicinity
mapBuilding(391,371,9.0,6.0,3.1,6); // Council / harbour vicinity
mapBuilding(437,388,7.0,5.0,2.9,7); // Visitor centre vicinity
for(let i=0,placed=0;i<1600&&placed<62;i++){
  const px=189+random()*351,pz=342+random()*319;
  const [x,z]=mapPoint(px,pz);
  const w=3.5+random()*4,d=3.5+random()*3.5,r=Math.hypot(w,d)*.52;
  const rise=(pz-495)*.66;
  if(px>481&&pz>490||pz>530&&px>476-rise*.68||px>268&&px<347&&pz>570||
    !inside(x,z)||!inside(x+4,z+3)||!inside(x-4,z-3)||roadGap(x,z)<r+4.5||
    buildings.some(b=>Math.hypot(x-b.x,z-b.z)<r+b.r+3.1))continue;
  mapBuilding(px,pz,w,d,2.2+random()*1.1,placed++);
}

function palm(x,z,s){
  const p=new T.Group();p.position.set(x,.4,z);p.rotation.y=random()*TAU;p.scale.setScalar(s);scene.add(p);
  const h=3.9+random()*1.7, lean=.58+random()*.4;
  for(let j=0;j<7;j++){
    const a=j/7,b=(j+1)/7;
    beam(j%3?'#918067':'#a99579',v(lean*a*a,h*a,0),v(lean*b*b,h*b+.01,0),.235-.10*a,p);
  }
  for(let j=0;j<9;j++){
    const a=j/9*TAU+random()*.25, len=2.15+random()*.95;
    const pts=[],indices=[];
    for(let k=0;k<=8;k++){
      const u=k/8, dist=len*u;
      const zz=Math.sin(a)*dist,xx=Math.cos(a)*dist;
      const y=h+.84*Math.sin(u*Math.PI*.99)-u*.69;
      const w=.36*Math.pow(Math.sin(Math.PI*u),.8);
      pts.push(lean+xx-Math.sin(a)*w,y-.17*Math.sin(Math.PI*u),zz+Math.cos(a)*w,lean+xx,y,zz,lean+xx+Math.sin(a)*w,y-.17*Math.sin(Math.PI*u),zz-Math.cos(a)*w);
      if(k<8){const i=k*3;indices.push(i,i+1,i+4,i,i+4,i+3,i+1,i+2,i+5,i+1,i+5,i+4);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setIndex(indices);g.computeVertexNormals();
    const m=palmMats[j%palmMats.length];mesh(g,m,0,0,0,1,1,1,p);
  }
  for(let j=0;j<3;j++)stone('#786a39',lean+Math.cos(j*2.1)*.25,h-.2,Math.sin(j*2.1)*.25,.23,.26,.23,p);
}
const palmMats=['#416e38','#578644','#739549','#397a46','#6b994a'].map(color=>new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.86}));
function tree(x,z,s,compact=false){
  const p=new T.Group();p.position.set(x,.4,z);p.scale.setScalar(s);p.rotation.y=random()*TAU;scene.add(p);
  post('#77634a',0,0,0,3.15,.27,p);
  const greens=['#3f7447','#4b7c40','#568344','#63894d','#3e6c3e'];
  for(let i=0;i<(compact?4:7);i++){
    const a=i*2.4,r=i===0?0:.8+random()*.8;
    const xx=Math.cos(a)*r,zz=Math.sin(a)*r,yy=3.52+random()*1.7;
    beam('#77634a',v(0,1.7,0),v(xx,yy-.38,zz),.12,p);
    const o=stone(greens[i%greens.length],xx,yy,zz,1.23+random()*.5,1.27+random()*.48,1.23+random()*.5,p);
    o.rotation.y=random()*TAU;
  }
}
const forestEdge=[[474,485],[492,483],[499,507],[506,551],[525,610],
  [550,684],[558,755],[570,820],[577,873],[569,902],[532,922],[483,917],
  [443,904],[401,890],[364,869],[349,843],[381,825],[416,808],[408,763],
  [369,752],[348,726],[315,701],[286,690],[271,671],[309,664],[363,663],
  [403,634],[411,601],[446,569],[445,538]];
islandDisk('Southern woodland',.401,forestEdge.map(p=>mapPoint(...p)),'#6b844a');
const plots=[
  {color:'#74965d',pts:[[300,570],[344,597],[307,654],[263,627]]},
  {color:'#768d50',pts:[[247,709],[330,705],[407,761],[424,810],[390,829],[315,812],[264,781]]},
  {color:'#719761',pts:[[342,580],[381,588],[370,618],[332,606]]}
];
plots.forEach(({color,pts})=>islandDisk('Open clearing',.407,pts.map(p=>mapPoint(...p)),color));
// Football and futsal pitches remain clear of the southern woodland.
for(const field of [plots[0].pts,plots[2].pts]){
  for(let i=0;i<4;i++)stripMap('#c2c7a2',field[i],field[(i+1)%4],.13,.435,.013,-3);
  const midA=field[0].map((v,i)=>(v+field[3][i])/2);
  const midB=field[1].map((v,i)=>(v+field[2][i])/2);
  stripMap('#c2c7a2',midA,midB,.10,.437,.012,-3);
}
function vegetation(px,pz,size,isPalm,compact=false){
  const [x,z]=mapPoint(px,pz);
  if(!inside(x,z)||roadGap(x,z)<5.2||buildings.some(b=>Math.hypot(x-b.x,z-b.z)<b.r+1.25))return false;
  (isPalm?palm:tree)(x,z,size,compact);
  return true;
}
let planted=0;
const plantSites=[];
for(let i=0;i<4900&&planted<427;i++){
  const px=184+random()*418,pz=505+random()*427;
  const [x,z]=mapPoint(px,pz);
  if(px<440&&pz<628||pz>700&&pz<823&&px>248&&px<392||px>261&&px<351&&pz>561&&pz<661||
    plantSites.some(([xx,zz])=>Math.hypot(x-xx,z-zz)<3.55))continue;
  if(vegetation(px,pz,.92+random()*.84,i%14===0,true)){
    plantSites.push([x,z]);planted++;
  }
}
for(let i=0,n=0;i<450&&n<29;i++){
  const px=191+random()*327,pz=327+random()*263;
  if(vegetation(px,pz,.81+random()*.68,i%3!==0))n++;
}
for(const [px,pz] of [[264,312],[272,325],[280,310],[488,395],[497,421],[493,434],[204,517],[200,549],[204,578],[233,734],[270,816],[541,903]]){
  vegetation(px,pz,1.27,true);
}
for(let i=0;i<72;i++){
  const [x,z]=outline[(i*7)%outline.length];
  if(z<-152)continue;
  const r=.26+random()*.56;
  stone(i%3?'#b7b097':'#968d77',x,.18,z,r,r*.49,r*.67,scene,false);
}

function boat(x,z,heading,color,type=0){
  const p=new T.Group();p.userData.moving=true;p.position.set(x,.24,z);p.rotation.y=heading;scene.add(p);
  const len=type?10:6,width=type?3:1.9;
  const hull=new T.Shape();hull.moveTo(-width/2,-len*.43);hull.lineTo(width/2,-len*.43);hull.lineTo(width*.54,len*.16);hull.quadraticCurveTo(width*.45,len*.36,0,len*.55);hull.quadraticCurveTo(-width*.45,len*.36,-width*.54,len*.16);hull.closePath();
  const geo=new T.ExtrudeGeometry(hull,{depth:.66,bevelEnabled:false});geo.rotateX(Math.PI/2);geo.translate(0,.53,0);
  mesh(geo,color,0,0,0,1,1,1,p);
  box('#e7e1cd',0,.62,-.3,width*.84,.16,len*.7,p);
  if(type){
    box('#ebebd9',0,1.18,.08,width*.81,1.04,len*.44,p);
    box('#51818c',0,1.35,.08,width*.84,.32,len*.41,p);
    box(color,0,1.76,.08,width*.95,.19,len*.52,p);
    post('#e6dbbf',0,.8,1.76,1.03,.045,p);
    box('#dd6c4b',.25,2.65,.8,.48,.23,.045,p);
  }else{
    box('#d9c39c',0,.75,-.92,width*.86,.11,.4,p);box('#d9c39c',0,.75,.63,width*.79,.11,.4,p);
    box('#5f6360',0,.44,-len*.47,.55,.5,.4,p);
  }
  return p;
}
const boats=[
  [355,269,.1,'#437c87',1],[369,281,-.27,'#c67b4d',0],[432,311,.20,'#cf8155',0],
  [461,270,-.43,'#508482',1],[406,282,-.13,'#d9b267',0],[186,545,.1,'#d4d7c7',0]
].map(([px,pz,heading,color,type],i)=>[boat(...mapPoint(px,pz),heading,color,type),i]);

const lampBulb=new T.MeshStandardMaterial({color:'#d5decd',emissive:'#ffc977',emissiveIntensity:0});
const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
const ctx=canvas.getContext('2d');
const grad=ctx.createRadialGradient(64,64,0,64,64,64);
grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.24,'rgba(255,255,255,.50)');grad.addColorStop(.57,'rgba(255,255,255,.105)');grad.addColorStop(1,'rgba(255,255,255,0)');
ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
const glowTex=new T.CanvasTexture(canvas);
const poolMat=new T.MeshBasicMaterial({map:glowTex,color:'#ffbb6e',transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-5,blending:T.AdditiveBlending,toneMapped:false});
const glowMat=new T.SpriteMaterial({map:glowTex,color:'#ffd798',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
const poolGeo=new T.PlaneGeometry(1,1);
function pool(x,y,z,w,d,mat=poolMat,p=scene){
  const m=mesh(poolGeo,mat,x,y,z,w,d,1,p,false);
  m.rotation.x=-Math.PI/2;m.receiveShadow=false;return m;
}
function halo(x,y,z,size,material=glowMat,p=scene){
  const m=new T.Sprite(material);m.position.set(x,y,z);m.scale.set(size,size,1);p.add(m);
  return m;
}
const prototypeLamps=[];
const controller=makeController();
let prototypeRevision=0;
function streetLamp(x,z,dx,dz,height=5.6,y=.43,prototype=false){
  const c='#535d59';
  post(c,x,z,y,.34,.23);
  post(c,x,z,y,height,.105);
  const ex=x+dx*1.22,ez=z+dz*1.22;
  beam(c,v(x,y+height-.64,z),v(ex,y+height,ez),.082);
  const head=box(c,ex,y+height,ez,.72,.17,.37);head.rotation.y=-Math.atan2(dz,dx);
  const bulbMaterial=prototype?lampBulb.clone():lampBulb;
  const haloMaterial=prototype?glowMat.clone():glowMat;
  const poolMaterial=prototype?poolMat.clone():poolMat;
  const bulb=box(bulbMaterial,ex,y+height-.10,ez,.60,.045,.28,scene,false);bulb.rotation.y=head.rotation.y;
  halo(ex,y+height-.1,ez,prototype?3.8:2.8,haloMaterial);
  const light=pool(ex+dx*1.45,y+.064,ez+dz*1.45,height*(prototype?3.65:2.32),height*1.95,poolMaterial);
  light.rotation.z=-Math.atan2(dz,dx)+(prototype?Math.PI/2:0);
  if(prototype){
    const sensor=box('#468f87',x,y+height*.57,z,.25,.18,.24);
    sensor.userData.depthBias=-.1;
    prototypeLamps.push({bulbMaterial,haloMaterial,poolMaterial,position:v(ex,y+height,ez)});
  }
}
for(const [u,w,du,dw] of [[-104,0,18,0],[-93,-59,29,0],[-35,58,24,0],[-96,-112,25,0],[0,-109,0,22]]){
  const count=du===18?17:du===29?9:du===24?7:du===25?10:15;
  for(let i=0;i<count;i++){
    const [x,z]=grid(u+i*du+(du?0:7),w+i*dw+(du?7:0));
    const prototype=du===18&&LAMP_POSITIONS.includes(u+i*du);
    if(inside(x,z))streetLamp(x,z,du?axis.z:-axis.x,du?-axis.x:-axis.z,4.6,.43,prototype);
  }
}
for(const [px,pz] of [[277,311],[324,308],[361,312],[397,326],[432,341],[467,357],[488,335],[481,291],[452,272]]){
  streetLamp(...mapPoint(px,pz),0,-1,3.65,.88);
}
const trafficMaterials={
  red:new T.MeshStandardMaterial({color:'#3c1719',emissive:'#ff262d',emissiveIntensity:0}),
  amber:new T.MeshStandardMaterial({color:'#593815',emissive:'#ff9e16',emissiveIntensity:0}),
  green:new T.MeshStandardMaterial({color:'#163b28',emissive:'#39ff8d',emissiveIntensity:0})
};
const signalHeads=[];
function signalPole(x,z,heading,key,walk=false){
  const group=new T.Group();group.position.set(x,.46,z);group.rotation.y=heading;scene.add(group);
  const h=walk?2.1:3.7;
  post('#686d62',0,0,0,h,.10,group);
  box('#202e32',0,h-.31,.049,walk?.37:.48,walk?.61:.98,.32,group);
  const bulbs={};
  const order=walk?['red','green']:['red','amber','green'];
  order.forEach((state,i)=>{
    const m=trafficMaterials[state].clone();
    mesh(globeGeo,m,0,h+.005-i*(walk?.29:.323),.236,walk?.106:.142,walk?.106:.142,.056,group,false);
    bulbs[state]=m;
  });
  signalHeads.push({key,bulbs});
}
const angle=Math.atan2(axis.z,axis.x);
const localSignal=(u,w,heading,key,walk=false)=>signalPole(...grid(u,w),heading-angle,key,walk);
localSignal(-17,8,-Math.PI/2,'main');localSignal(12,-8,Math.PI/2,'main');
localSignal(-8,-13,Math.PI,'side');localSignal(8,13,0,'side');
localSignal(-12,-8,0,'walk',true);localSignal(-15,8,Math.PI,'walk',true);

/* Batch opaque scenery by material. The original models remain useful for authoring;
   the merged geometry keeps the interactive view within a small draw-call budget. */
import { mergeGeometries } from './merge.js';
function batchScenery(){
  scene.updateMatrixWorld(true);
  const batches=new Map();
  const selected=[];
  const excluded=new Set([sky,water,...boats.map(([boat])=>boat)]);
  scene.traverse(mesh=>{
    if(!mesh.isMesh||excluded.has(mesh)||excluded.has(mesh.parent)||mesh.material.transparent||Array.isArray(mesh.material))return;
    const key=mesh.material.uuid+'/'+mesh.castShadow+'/'+mesh.receiveShadow;
    const list=batches.get(key)??[];
    list.push(mesh);batches.set(key,list);
  });
  for(const list of batches.values()){
    if(list.length<4)continue;
    const geos=list.map(o=>{
      const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      for(const attr of Object.keys(g.attributes))if(attr!=='position'&&attr!=='normal')g.deleteAttribute(attr);
      return g;
    });
    const joined=mergeGeometries(geos);
    geos.forEach(g=>g.dispose());
    if(!joined)continue;
    const first=list[0];
    const batch=new T.Mesh(joined,first.material);batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;scene.add(batch);
    selected.push(...list);
  }
  for(const o of selected)o.removeFromParent();
}
if(!software)batchScenery();

const headlampMat=new T.MeshStandardMaterial({color:'#e0eee6',emissive:'#ffedc2',emissiveIntensity:0});
const headPoolM=new T.MeshBasicMaterial({map:glowTex,color:'#fff0bc',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
const tailMat=new T.MeshStandardMaterial({color:'#8f3830',emissive:'#ff3424',emissiveIntensity:0});
const tire='#242a2d',windowColor='#426975';
function carModel(color,type){
  const p=new T.Group();p.userData.moving=true;scene.add(p);
  if(type==='car'){
    box(tire,0,.42,0,1.47,.33,3.07,p);
    box(color,0,.65,.02,1.65,.51,3.34,p);
    box(windowColor,0,1.06,-.18,1.37,.48,1.63,p);
    box(color,0,1.31,-.21,1.39,.13,1.17,p);
    box('#384a52',0,.52,1.7,1.29,.18,.11,p);
    for(const x of [-.72,.72]){
      box(headlampMat,x,.68,1.715,.26,.137,.06,p,false);
      box(tailMat,x,.66,-1.679,.23,.125,.068,p,false);
      for(const z of [-1.06,1.02]){
        const wheel=mesh(cylGeo,tire,x*1.13,.32,z,.32,.25,.32,p);wheel.rotation.z=Math.PI/2;
        const rim=mesh(cylGeo,'#a0ada9',x*1.13+Math.sign(x)*.134,.32,z,.166,.045,.166,p,false);rim.rotation.z=Math.PI/2;
      }
    }
    pool(0,.02,3.95,3.55,5.2,headPoolM,p);
  }else{
    const bicycle=type==='cycle',height=bicycle?.42:.36;
    const wheelM=mat(bicycle?'#293539':tire);
    for(const z of [-.73,.73]){
      const wheel=mesh(rimGeo,wheelM,0,height,z,height*.88,height*.88,bicycle?.23:.68,p);wheel.rotation.y=Math.PI/2;
      beam('#8a9d96',v(-.11,height,z),v(.11,height,z),.08,p);
      if(bicycle){
        beam('#8a9d96',v(0,height-.28,z),v(0,height+.28,z),.017,p);
        beam('#8a9d96',v(0,height,z-.28),v(0,height,z+.28),.017,p);
      }
    }
    beam(color,v(0,height,-.72),v(0,.83,-.11),.055,p);
    beam(color,v(0,.83,-.11),v(0,.86,.48),.064,p);
    beam(color,v(0,.99,.51),v(0,height,.73),.045,p);
    beam('#a2aba6',v(-.27,1.03,.48),v(.27,1.03,.48),.033,p);
    if(!bicycle)box(color,0,.68,.02,.37,.3,1.16,p);
    box('#272e30',0,.87,-.26,.30,.12,.38,p);
    const shade=['#df7850','#3c7776','#dfc46f','#516583'][Math.floor(random()*4)];
    const shirt=box(shade,0,1.18,-.065,.38,.54,.27,p);shirt.rotation.x=.36;
    for(const x of [-.14,.14]){
      beam(shade,v(x,1.37,-.08),v(x*1.6,1.04,.48),.058,p);
      beam('#3c4752',v(x,1.0,-.18),v(x, .61,.08),.075,p);
    }
    mesh(globeGeo,bicycle?'#ba875e':color,0,1.55,.02,.16,.18,.16,p);
    box(headlampMat,0,.74,.91,.16,.12,.08,p,false);
    box(tailMat,0,.61,-.94,.13,.09,.06,p,false);
    if(!bicycle)pool(0,.02,2.9,2.1,3.6,headPoolM,p);
  }
  return p;
}
import {stepLane,signalAt,lightsOn} from './traffic.js';
const carColors=['#d7d9cf','#bc583e','#3b8192','#d7a650','#4d6273','#d5c5a6','#697e59','#518a86'];
function makeLane(route,dir,offset,stops,n,shift,side=false){
  const cars=[];
  for(let i=0;i<n;i++){
    const type=i%5===3?'cycle':i%4===1?'motorbike':'car';
    const s=(i/n*route.length+shift)%route.length;
    const cruise=(type==='cycle'?5.6:type==='motorbike'?10:9.6)*(side?.73:1)+random()*.75;
    cars.push({type,s,speed:cruise*.7,cruise,length:type==='car'?3.46:1.96,commit:null,model:carModel(carColors[(i+(dir===1?0:3))%carColors.length],type)});
  }
  return {route,length:route.length,direction:dir,offset,stops,cars,side};
}
const lanes=[
  makeLane(main,1,0,[main.stopAt(111,18,true),main.stopAt(111,12,false)],8,24),
  makeLane(sideRoad,1,0,[sideRoad.stopAt(123,13,true),sideRoad.stopAt(123,13,false)],5,35,true)
];
const paths=[
  [grid(-85,7.2),grid(-17,7.2),.43],
  [grid(-102,-7.2),grid(-17,-7.2),.43],
  [grid(15,7.2),grid(124,7.2),.43],
  [grid(6.8,22),grid(6.8,108),.43],
  [mapPoint(286,310),mapPoint(332,309),.87],
  [mapPoint(368,314),mapPoint(463,352),.88]
].map(([a,b,y])=>[...a,...b,y]);
function human(i){
  const p=new T.Group();p.userData.moving=true;scene.add(p);
  const running=i%4===1;
  const color=['#d7775c','#f2d49a','#499798','#527c9a','#dcc9ad','#cc9676','#748850'][i%7];
  const skin=['#ad724d','#d39d70','#8a573f','#e2ae86'][i%4];
  const pants=['#454e5a','#494d58','#4f5a58'][i%3];
  box(color,0,1.19,0,.38,.53,.245,p);
  post(skin,0,0,1.42,.14,.08,p);
  mesh(globeGeo,skin,0,1.64,.01,.142,.161,.14,p);
  mesh(globeGeo,i%6===0?'#dcceb0':'#343435',0,1.728,-.016,.138,.087,.132,p);
  const legs=[],arms=[];
  for(const sign of [-1,1]){
    const hip=new T.Group();hip.position.set(sign*.106,.94,0);p.add(hip);
    box(pants,0,-.235,0,.143,.48,.15,hip);
    const knee=new T.Group();knee.position.y=-.43;hip.add(knee);
    box(pants,0,-.174,0,.127,.36,.132,knee);
    box('#d8d9c7',0,-.375,.058,.141,.099,.24,knee);
    legs.push({hip,knee});
    const shoulder=new T.Group();shoulder.position.set(sign*.224,1.36,0);p.add(shoulder);
    box(color,0,-.108,0,.127,.237,.13,shoulder);
    box(skin,0,-.291,running?.095:.035,.100,.217,.113,shoulder).rotation.x=running?-.89:-.32;
    arms.push(shoulder);
  }
  p.scale.setScalar(1+random()*.26);
  return {p,legs,arms,running,phase:random()*TAU,progress:random(),direction:i%2?1:-1,speed:running?3.5+random()*.7:1.36+random()*.46};
}
const pedestrians=Array.from({length:12},(_,i)=>({...human(i),path:paths[i%paths.length]}));
const crossers=Array.from({length:4},(_,i)=>{
  const direction=i<2?1:-1;
  return {...human(i+41),direction,offset:(i%2-.5)*.62,at:direction===1?0:1,departed:false,trip:i%2*.8};
});
function gait(o,dt,moving){
  if(moving)o.phase+=dt*(o.running?13.1:8.1);
  const amp=moving?(o.running?.91:.52):0;
  o.legs.forEach(({hip,knee},i)=>{
    const swing=Math.sin(o.phase+i*Math.PI);
    hip.rotation.x=swing*amp;
    knee.rotation.x=Math.max(0,-swing)*(o.running?.90:.47)*Number(moving);
    o.arms[i].rotation.x=-hip.rotation.x*.88;
  });
  return moving?Math.abs(Math.cos(o.phase))*(o.running?.094:.049):0;
}
let walkOpen=0,previousWalk='red';
function animatePedestrians(dt,walk){
  for(const o of pedestrians){
    const [x,z,xx,zz,y]=o.path,len=Math.hypot(xx-x,zz-z);
    o.progress+=dt*o.speed/len*o.direction;
    if(o.progress>1||o.progress<0){o.progress=clamp(o.progress,0,1);o.direction*=-1;}
    o.p.position.set(mix(x,xx,o.progress),y+gait(o,dt,true),mix(z,zz,o.progress));
    o.p.rotation.y=Math.atan2((xx-x)*o.direction,(zz-z)*o.direction);
  }
  if(walk==='green'&&previousWalk!=='green'){
    walkOpen=0;
    for(const o of crossers)o.departed=false;
  }
  if(walk==='green')walkOpen+=dt;
  previousWalk=walk;
  for(const o of crossers){
    if(walk==='green'&&walkOpen>=o.trip&&!o.departed){o.crossing=true;o.departed=true;}
    if(o.crossing){
      o.at=clamp(o.at+dt*o.direction*o.speed/10.5,0,1);
      if(o.at===0||o.at===1){o.crossing=false;o.direction*=-1;}
    }
    const [x,z]=grid(-13+o.offset,mix(-9.2,9.2,o.at));
    o.p.position.set(x,.43+gait(o,dt,o.crossing),z);
    o.p.rotation.y=(o.direction===1?0:Math.PI)-angle;
  }
}
const testWalker=human(104), testRunner=human(105);
const testModels=[testWalker.p,carModel('#b6983b','cycle'),carModel('#338986','motorbike'),carModel('#b85e44','car'),testRunner.p];
for(const model of testModels)model.visible=false;
const ambientActors=[...lanes.flatMap(lane=>lane.cars.map(car=>car.model)),...pedestrians.map(o=>o.p),...crossers.map(o=>o.p)];
const movingRoots=[
  ...ambientActors,...testModels
];
function batchMovers(roots){
  const families=new Map();
  for(const root of roots)root.traverse(o=>{
    if(!o.isMesh||o.material.transparent)return;
    const key=o.geometry.uuid+o.material.uuid;
    const entries=families.get(key)??[];
    entries.push({part:o,root});families.set(key,entries);
  });
  const batches=[];
  for(const parts of families.values()){
    if(parts.length<3)continue;
    const first=parts[0].part;
    const batch=new T.InstancedMesh(first.geometry,first.material,parts.length);
    batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    batch.receiveShadow=true;
    batch.castShadow=first.castShadow;
    batch.frustumCulled=false;
    parts.forEach(({part})=>{part.visible=false;});
    scene.add(batch);batches.push({batch,parts});
  }
  return batches;
}
const dynamicBatches=software?[]:batchMovers(movingRoots);
const hiddenMatrix=new T.Matrix4().makeScale(0,0,0);
function updateMovers(){
  for(const root of movingRoots)root.updateMatrixWorld(true);
  for(const {batch,parts} of dynamicBatches){
    parts.forEach(({part,root},i)=>batch.setMatrixAt(i,root.visible?part.matrixWorld:hiddenMatrix));
    batch.instanceMatrix.needsUpdate=true;
  }
}

const tabs=[...document.querySelectorAll('[data-view]')];
const viewport=document.querySelector('.viewport');
const cameraViews={
  overview:{x:-4,y:0,z:18,az:0,el:1.22,r:737},
  harbour:{x:mapPoint(381,312)[0],y:1.6,z:mapPoint(381,312)[1],az:2.54,el:.61,r:139},
  junction:{x:jx,y:.9,z:jz,az:.38,el:.60,r:60},
  lighting:{x:grid(-56,0)[0],y:.65,z:grid(-56,0)[1],az:.20,el:.66,r:94}
};
const destination={...cameraViews.overview};
const current={...destination};
const landmarkLayer=document.querySelector('#landmarks');
const landmarks=landmarkPositions.map(({name,p,major})=>{
  const node=document.createElement('span');node.textContent=name;landmarkLayer.append(node);
  const [x,z]=mapPoint(...p);
  return {node,position:v(x,3.4,z),major};
});
const projected=v();
let selectedView='overview';
let aspect=1;
function resize(){
  const {clientWidth:w,clientHeight:h}=world;
  if(!w||!h)return;
  aspect=w/h;camera.aspect=aspect;
  camera.fov=aspect<1.15?49:38;
  camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
new ResizeObserver(resize).observe(world);resize();
function selectView(name){
  selectedView=name;Object.assign(destination,cameraViews[name]);
  for(const button of tabs)button.setAttribute('aria-pressed',String(button.dataset.view===name));
}
tabs.forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.view)));
const pointers=new Map();
const c=renderer.domElement;
const moveButton=document.querySelector('#moveMap');
const rotateButton=document.querySelector('#rotateMap');
const help=document.querySelector('#mapHelp');
const junctionStatus=document.querySelector('.statusCard');
const compact=matchMedia('(max-width: 760px)');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
junctionStatus.open=!compact.matches;
compact.addEventListener('change',()=>{junctionStatus.open=!compact.matches;});
c.setAttribute('aria-label','Interactive 3D island map');
c.setAttribute('aria-describedby','mapHelp');
c.tabIndex=0;

let mapMode='move';
let tap=null;
let lastTouch=-Infinity;
let gesture=null;
const minZoom=18,maxZoom=1100;
const navigationCamera=camera.clone();
const raycaster=new T.Raycaster();
const rayPoint=new T.Vector2();
const ground=new T.Plane(new T.Vector3(0,1,0),-.43);
const anchorBefore=v(),anchorAfter=v();
const [west,east,north,south]=outline.reduce(([minX,maxX,minZ,maxZ],[x,z])=>
  [Math.min(minX,x),Math.max(maxX,x),Math.min(minZ,z),Math.max(maxZ,z)],
  [Infinity,-Infinity,Infinity,-Infinity]);

function setMapMode(mode){
  mapMode=mode;
  moveButton.setAttribute('aria-pressed',String(mode==='move'));
  rotateButton.setAttribute('aria-pressed',String(mode==='rotate'));
  c.classList.toggle('rotating',mode==='rotate');
  help.open=false;
}
moveButton.addEventListener('click',()=>setMapMode('move'));
rotateButton.addEventListener('click',()=>setMapMode('rotate'));

function placeCamera(view,target){
  const {x,y,z,az,el,r}=view;
  // Keep the whole island and the four test lamps in view on narrow displays.
  const fit=selectedView==='overview'?clamp(.65/aspect,1,1.57):clamp(1.12/aspect,1,2.18);
  const range=r*fit,h=range*Math.cos(el);
  target.position.set(x+h*Math.sin(az),y+range*Math.sin(el),z+h*Math.cos(az));
  target.lookAt(x,y,z);
  target.updateMatrixWorld();
}
function groundAt(point,target){
  const rect=c.getBoundingClientRect();
  rayPoint.set((point.x-rect.left)/rect.width*2-1,1-(point.y-rect.top)/rect.height*2);
  raycaster.setFromCamera(rayPoint,navigationCamera);
  // Near the horizon, the ground hit is too far away to be a useful anchor.
  if(raycaster.ray.direction.y>-.085)return null;
  return raycaster.ray.intersectPlane(ground,target);
}
function navigate(scale,from,to=from){
  const next=clamp(destination.r*scale,minZoom,maxZoom);
  if(from){
    navigationCamera.projectionMatrix.copy(camera.projectionMatrix);
    navigationCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    placeCamera(destination,navigationCamera);
    const before=groundAt(from,anchorBefore);
    destination.r=next;
    placeCamera(destination,navigationCamera);
    const after=groundAt(to,anchorAfter);
    if(before&&after){
      destination.x+=before.x-after.x;
      destination.z+=before.z-after.z;
    }else if(from.x!==to.x||from.y!==to.y){
      const units=2*destination.r*Math.tan(T.MathUtils.degToRad(camera.fov/2))/c.clientHeight;
      const dx=(from.x-to.x)*units,dz=(from.y-to.y)*units;
      const sn=Math.sin(destination.az),cs=Math.cos(destination.az);
      destination.x+=dx*cs+dz*sn;
      destination.z+=dz*cs-dx*sn;
    }
    destination.x=clamp(destination.x,west-65,east+65);
    destination.z=clamp(destination.z,north-65,south+65);
  }else destination.r=next;
}
function rotate(dx,dy){
  destination.az-=dx*.006;
  destination.el=clamp(destination.el+dy*.005,.22,1.49);
}
const point=e=>({x:e.clientX,y:e.clientY});
function pinch(){
  const [a,b]=pointers.values();
  return {center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},span:Math.hypot(a.x-b.x,a.y-b.y)};
}
c.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==1&&e.button!==2)return;
  c.setPointerCapture(e.pointerId);
  if(e.pointerType==='touch')lastTouch=performance.now();
  const p=point(e);
  pointers.set(e.pointerId,p);
  gesture=pointers.size===1?{start:p,didDrag:false,rotate:e.button===2||e.shiftKey||mapMode==='rotate'}:null;
  if(pointers.size>1)tap=null;
  help.open=false;
});
c.addEventListener('pointermove',e=>{
  const previous=pointers.get(e.pointerId);
  if(!previous)return;
  const next=point(e);
  const before=pointers.size===2?pinch():null;
  pointers.set(e.pointerId,next);
  if(before){
    const after=pinch();
    if(before.span>8&&after.span>8)navigate(before.span/after.span,before.center,after.center);
  }else if(pointers.size===1){
    if(gesture&&Math.hypot(next.x-gesture.start.x,next.y-gesture.start.y)>6)gesture.didDrag=true;
    if(gesture&&!gesture.didDrag)return;
    if(gesture?.rotate??mapMode==='rotate')rotate(next.x-previous.x,next.y-previous.y);
    else navigate(1,previous,next);
  }
});
c.addEventListener('pointerup',e=>{
  if(e.pointerType==='touch')lastTouch=performance.now();
  if(pointers.size===1&&gesture&&!gesture.didDrag&&e.pointerType!=='mouse'&&e.button===0){
    const p=point(e),now=performance.now();
    if(tap&&now-tap.time<380&&Math.hypot(tap.x-p.x,tap.y-p.y)<32){
      navigate(.6,p,{x:c.getBoundingClientRect().left+c.clientWidth/2,y:c.getBoundingClientRect().top+c.clientHeight/2});
      tap=null;
    }else tap={...p,time:now};
  }else tap=null;
  pointers.delete(e.pointerId);
  gesture=null;
});
for(const event of ['pointercancel','lostpointercapture'])c.addEventListener(event,e=>{
  if(pointers.delete(e.pointerId)){gesture=null;tap=null;}
});
c.addEventListener('dblclick',e=>{
  if(e.sourceCapabilities?.firesTouchEvents||performance.now()-lastTouch<500)return;
  const rect=c.getBoundingClientRect();
  navigate(.6,point(e),{x:rect.left+rect.width/2,y:rect.top+rect.height/2});
});
c.addEventListener('contextmenu',e=>e.preventDefault());
c.addEventListener('wheel',e=>{
  e.preventDefault();
  const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?c.clientHeight:1);
  navigate(Math.exp(clamp(pixels,-200,200)*.0018),point(e));
},{passive:false});
c.addEventListener('keydown',e=>{
  const arrow={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(arrow){
    e.preventDefault();
    const [dx,dy]=arrow;
    if(e.shiftKey)rotate(-dx*28,-dy*24);
    else{
      const rect=c.getBoundingClientRect(),center={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      navigate(1,{x:center.x+dx*52,y:center.y+dy*52},center);
    }
  }else if(['+','=','-','_','Home'].includes(e.key)){
    e.preventDefault();
    if(e.key==='Home')selectView('overview');
    else navigate(e.key==='-'||e.key==='_'?1.3:.77);
  }
});
document.querySelector('#zoomIn').addEventListener('click',()=>navigate(.72));
document.querySelector('#zoomOut').addEventListener('click',()=>navigate(1/.72));
document.querySelector('#resetMap').addEventListener('click',()=>{setMapMode('move');selectView('overview');});

const full=document.querySelector('#full');
let expanded=false;
function syncExpanded(){
  const active=expanded||document.fullscreenElement===viewport;
  const label=active?'Close expanded map':'Expand map';
  full.setAttribute('aria-pressed',String(active));
  full.setAttribute('aria-label',label);
  full.title=label;
  full.textContent=active?'×':'⛶';
}
function setExpanded(value){
  expanded=value;
  viewport.classList.toggle('expanded',value);
  document.body.classList.toggle('mapExpanded',value);
  syncExpanded();
}
full.addEventListener('click',async()=>{
  if(expanded){setExpanded(false);return;}
  if(document.fullscreenElement===viewport){await document.exitFullscreen();return;}
  if(viewport.requestFullscreen){
    try{await viewport.requestFullscreen();return;}catch{/* Use the in-page expanded view. */}
  }
  setExpanded(true);
});
document.addEventListener('fullscreenchange',syncExpanded);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(help.open)help.open=false;
    else if(expanded)setExpanded(false);
  }
});
function aim(dt){
  const damping=reducedMotion.matches?1:1-Math.exp(-dt*9);
  for(const key of Object.keys(current))current[key]=mix(current[key],destination[key],damping);
  placeCamera(current,camera);
  sky.position.copy(camera.position);
  drawPrototypeOverlay();
  landmarkLayer.hidden=selectedView!=='overview'||current.r<215;
  if(!landmarkLayer.hidden)for(const {node,position,major} of landmarks){
    projected.copy(position).project(camera);
    node.hidden=projected.z>1||Math.abs(projected.x)>.80||Math.abs(projected.y)>.78||(compact.matches&&!major);
    node.style.left=(projected.x*.5+.5)*100+'%';
    node.style.top=(.5-projected.y*.5)*100+'%';
  }
}

const $=selector=>document.querySelector(selector);
const time=$('#time'), clock=$('#clock'), period=$('#period'), lamps=$('#lamps');
const speed=$('#speed'), play=$('#play'), run=$('#runState');
const presets=[...document.querySelectorAll('[data-time]')];
let minute=990, simulationSeconds=0, playing=true, viewedMinute=-1, lightingMinute=-1, phaseKey='';
const adaptiveSettings={...DEFAULTS};
const lightMode=$('#lightMode'), zonesOn=$('#zonesOn'), nightButton=$('#nightTest');
const markerLayer=$('#lampMarkers'), cardLayer=$('#lampCards');
const zoneOverlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
zoneOverlay.setAttribute('aria-hidden','true');
markerLayer.append(zoneOverlay);
const lampRows=prototypeLamps.map((lamp,i)=>{
  const number='L'+(i+1);
  const node=document.createElement('span');markerLayer.append(node);
  const zone=document.createElementNS(zoneOverlay.namespaceURI,'polygon');zoneOverlay.append(zone);
  const card=document.createElement('div'),label=document.createElement('span');
  const value=document.createElement('strong'),state=document.createElement('small');
  label.textContent=number;card.append(label,value,state);cardLayer.append(card);
  return {...lamp,number,node,zone,card,value,state};
});
const fixedReadouts={
  baseline:$('#baselineEnergy'),adaptive:$('#adaptiveEnergy'),savings:$('#estimatedSavings'),
  label:$('#savingLabel'),elapsed:$('#sampleTime')
};
let latestPanel=-Infinity;
let ambientTime=null, nightTestStart=0, testActor=null;
const testStatus=$('#testStatus'), testStage=$('#testStage');
function positionTestTraffic(dt){
  for(const model of testModels)model.visible=false;
  testActor=null;
  for(const model of ambientActors)model.visible=ambientTime===null;
  if(ambientTime===null)return;
  const pass=testTrafficAt(simulationSeconds-nightTestStart);
  if(!pass)return;
  const model=testModels[pass.index];
  model.visible=true;
  const humanModel=pass.index===0?testWalker:pass.index===4?testRunner:null;
  const [x,z]=grid(pass.position,pass.lane);
  model.position.set(x,.486+(humanModel?gait(humanModel,dt,true):0),z);
  model.rotation.y=Math.atan2(axis.x*pass.direction,axis.z*pass.direction);
  testActor={...roadCoordinates(x,z),direction:pass.direction,label:pass.label};
}
function syncNightButton(){
  nightButton.setAttribute('aria-pressed',String(ambientTime!==null));
  nightButton.textContent=ambientTime===null?'Start night test':'End night test';
  speed.disabled=ambientTime!==null;
  speed.title=ambientTime===null?'':'Time is fixed at 21:00 during the night test';
}
function applySettings(){
  adaptiveSettings.dim=Number($('#dimLevel').value);
  adaptiveSettings.range=Number($('#detectRange').value);
  adaptiveSettings.hold=Number($('#holdTime').value);
  $('#dimValue').value=adaptiveSettings.dim+'%';
  $('#rangeValue').value=adaptiveSettings.range+' m';
  $('#holdValue').value=adaptiveSettings.hold+' s';
  controller.clear();controller.resetEnergy();
  updatePrototype(0);
  refreshPrototype(true);
}
for(const id of ['dimLevel','detectRange','holdTime'])$('#'+id).addEventListener('input',applySettings);
$('#resetEnergy').addEventListener('click',()=>{
  controller.resetEnergy();
  refreshPrototype(true);
});
lightMode.addEventListener('change',()=>refreshPrototype(true));
nightButton.addEventListener('click',()=>{
  if(ambientTime===null){
    ambientTime=minute;minute=1260;nightTestStart=simulationSeconds;
    controller.clear();controller.resetEnergy();
    selectView('lighting');
    viewport.scrollIntoView({block:'start',behavior:'smooth'});
    setPlaying(true);
  }else{
    minute=ambientTime;ambientTime=null;
    controller.clear();
  }
  syncNightButton();
  move(0,signalAt(simulationSeconds));updatePrototype(0);refreshPrototype(true);refreshClock();
});
function updatePrototype(dt){
  const actors=[];
  if(lightsOn(minute)&&ambientTime!==null){
    if(testActor)actors.push(testActor);
  }else if(lightsOn(minute)){
    for(const lane of lanes)for(const car of lane.cars){
      const {x,z}=car.model.position;
      const dir=car.model.rotation.y;
      const along=Math.sin(dir)*axis.x+Math.cos(dir)*axis.z;
      actors.push({...roadCoordinates(x,z),direction:car.speed>.25&&Math.abs(along)>.4?Math.sign(along):0});
    }
    for(const o of pedestrians){
      const {x,z}=o.p.position, [a,b,c,d]=o.path;
      const progress=(c-a)*axis.x+(d-b)*axis.z;
      const parallel=Math.abs(progress)>Math.hypot(c-a,d-b)*.65;
      actors.push({...roadCoordinates(x,z),direction:parallel?Math.sign(progress)*o.direction:0});
    }
    for(const o of crossers)actors.push({...roadCoordinates(o.p.position.x,o.p.position.z),direction:0});
  }
  controller.step({night:lightsOn(minute),now:simulationSeconds,dt,actors,settings:adaptiveSettings});
}
function refreshPrototype(force=false){
  const on=lightsOn(minute), baseline=lightMode.value==='baseline';
  const visible=1-skyState.day.value*.69;
  lampRows.forEach((row,i)=>{
    const adaptive=controller.lamps[i];
    const level=on?(baseline?1:adaptive.level):0;
    row.bulbMaterial.emissiveIntensity=3.2*level;
    row.haloMaterial.opacity=.72*visible*level;
    row.poolMaterial.opacity=1.30*visible*level;
  });
  if(!force&&simulationSeconds-latestPanel<.15)return;
  latestPanel=simulationSeconds;
  prototypeRevision++;
  testStatus.hidden=ambientTime===null||selectedView!=='lighting';
  if(!testStatus.hidden)testStage.textContent=testActor?.label??'Road clear';
  const metrics=controller.metrics();
  fixedReadouts.baseline.textContent=metrics.baselineEnergy.toFixed(2)+' Wh';
  fixedReadouts.adaptive.textContent=metrics.adaptiveEnergy.toFixed(2)+' Wh';
  fixedReadouts.label.textContent=metrics.saving<0?'Estimated increase':'Estimated savings';
  fixedReadouts.savings.textContent=metrics.saving===null?'—':Math.abs(metrics.saving).toFixed(1)+'%';
  fixedReadouts.elapsed.textContent=metrics.elapsed.toFixed(1)+' s';
  lampRows.forEach((row,i)=>{
    const lamp=controller.lamps[i];
    const brightness=Math.round((on?(baseline?1:lamp.level):0)*100)+'%';
    const status=on?(baseline?'Full brightness':lamp.status==='Detected'?lamp.hits+' detected':lamp.status):'Daylight off';
    const active=on&&(baseline||lamp.status!=='Dim');
    row.card.classList.toggle('active',active);row.node.classList.toggle('active',active);
    row.node.textContent=row.number+' · '+brightness;
    row.value.textContent=brightness;row.state.textContent=status;
    row.zone.classList.toggle('detected',on&&lamp.hits>0);
    row.zone.classList.toggle('ahead',on&&lamp.hits===0&&lamp.ahead);
  });
}
const zonePoint=v();
function drawPrototypeOverlay(){
  testStatus.hidden=ambientTime===null||selectedView!=='lighting';
  markerLayer.hidden=selectedView!=='lighting';
  if(markerLayer.hidden)return;
  const width=world.clientWidth,height=world.clientHeight;
  zoneOverlay.setAttribute('viewBox','0 0 '+width+' '+height);
  zoneOverlay.style.display=zonesOn.checked?'':'none';
  lampRows.forEach((row,i)=>{
    projected.copy(row.position).project(camera);
    row.node.hidden=projected.z>1||Math.abs(projected.x)>.92||Math.abs(projected.y)>.88;
    row.node.style.left=(projected.x*.5+.5)*100+'%';
    row.node.style.top=(.5-projected.y*.5)*100+'%';
    if(!zonesOn.checked)return;
    const center=LAMP_POSITIONS[i],reach=adaptiveSettings.range/SCALE,half=ZONE_WIDTH/(2*SCALE);
    const polygon=[[center-reach,-half],[center+reach,-half],[center+reach,half],[center-reach,half]]
      .map(([u,w])=>{
        const [x,z]=grid(u,w);zonePoint.set(x,.51,z).project(camera);
        return zonePoint.z>=1?null:[(zonePoint.x*.5+.5)*width,(.5-zonePoint.y*.5)*height].join(',');
      });
    row.zone.style.display=polygon.includes(null)?'none':'';
    row.zone.setAttribute('points',polygon.filter(Boolean).join(' '));
  });
}
function setPlaying(value){
  playing=value;
  play.textContent=value?'Ⅱ':'▷';
  play.setAttribute('aria-label',value?'Pause simulation':'Resume simulation');
  play.title=value?'Pause simulation':'Resume simulation';
  run.textContent=value?'Simulation running':'Simulation paused';
  document.querySelector('.live').classList.toggle('paused',!value);
}
function setTime(value){
  minute=Number(value);
  ambientTime=null;
  syncNightButton();
  setPlaying(false);
  controller.clear();
  move(0,signalAt(simulationSeconds));
  updatePrototype(0);
  refreshPrototype(true);
  refreshClock();
}
play.addEventListener('click',()=>setPlaying(!playing));
time.addEventListener('input',()=>setTime(time.value));
presets.forEach(o=>o.addEventListener('click',()=>setTime(o.dataset.time)));
function refreshClock(){
  const currentMinute=Math.floor(minute);
  if(currentMinute===viewedMinute)return;
  viewedMinute=currentMinute;
  time.value=currentMinute;
  const h=String(Math.floor(currentMinute/60)).padStart(2,'0'),m=String(currentMinute%60).padStart(2,'0');
  clock.value=h+':'+m;
  time.setAttribute('aria-valuetext',clock.value+' Maldives time');
  period.textContent=currentMinute<300?'Night':currentMinute<420?'Dawn':currentMinute<720?'Morning':currentMinute===720?'Noon':currentMinute<1020?'Afternoon':currentMinute<1170?'Dusk':'Night';
  const on=lightsOn(currentMinute);
  lamps.classList.toggle('on',on);
  lamps.lastElementChild.textContent=on?'Streetlights on':'Streetlights off';
  presets.forEach(o=>o.setAttribute('aria-pressed',String(Number(o.dataset.time)===currentMinute)));
}
function updateSignals(phase){
  const key=phase.main+phase.side+phase.walk;
  if(key===phaseKey)return;
  phaseKey=key;
  const labels={green:'Green',amber:'Amber',red:'Red'};
  for(const [name,id] of [['main','mainSignal'],['side','sideSignal'],['walk','walkSignal']]){
    const o=document.getElementById(id),state=phase[name];
    o.textContent=name==='walk'?{green:'Walk',red:'Wait',amber:'Clear'}[state]:labels[state];
    o.className=state;
  }
  for(const {key,bulbs} of signalHeads){
    let state=phase[key];
    if(key==='walk'&&state==='amber')state='red';
    for(const color of Object.keys(bulbs))bulbs[color].emissiveIntensity=color===state?3.5:0;
  }
}
const nightTop=new T.Color('#081a39'),dayTop=new T.Color('#4a9dc6'),twilightTop=new T.Color('#465784');
const nightBottom=new T.Color('#162c44'),dayBottom=new T.Color('#e3ebd2'),twilightBottom=new T.Color('#e78e69');
const whiteSun=new T.Color('#fff1d4'),warmSun=new T.Color('#ff9351');
const coolSky=new T.Color('#668eeb'),whiteSky=new T.Color('#c6ebff');
function updateLight(){
  if(Math.abs(lightingMinute-minute)<.028)return;
  lightingMinute=minute;
  const a=(minute-360)/1440*TAU, altitude=Math.sin(a);
  const daylight=smooth(-.155,.235,altitude);
  const warm=(1-smooth(.055,.48,Math.abs(altitude)))*smooth(-.23,-.025,altitude);
  const sunPos=skyState.sunP.value.set(-Math.cos(a),altitude*.93,-.31).normalize();
  skyState.day.value=daylight;
  skyState.warm.value=warm;
  skyState.top.value.copy(nightTop).lerp(dayTop,daylight).lerp(twilightTop,warm*.48);
  skyState.bottom.value.copy(nightBottom).lerp(dayBottom,daylight).lerp(twilightBottom,warm*.72);
  const shadowDirection=v(sunPos.x,Math.max(.085,sunPos.y),sunPos.z).normalize();
  sun.position.copy(shadowDirection.multiplyScalar(365));
  sun.intensity=2.85*smooth(-.025,.48,altitude)+warm*.63;
  sun.color.copy(whiteSun).lerp(warmSun,warm*.88);
  hemi.color.copy(coolSky).lerp(whiteSky,daylight);
  hemi.groundColor.set('#6c6951');
  hemi.intensity=.32+1.62*daylight;
  waterState.day.value=daylight;waterState.warm.value=warm;
  const active=lightsOn(minute);
  const visible=1-daylight*.69;
  lampBulb.emissiveIntensity=active?3.2:0;
  glowMat.opacity=active?.57*visible:0;
  poolMat.opacity=active?.93*visible:0;
  headlampMat.emissiveIntensity=active?3:0;
  tailMat.emissiveIntensity=active?1.35:0;
  headPoolM.opacity=active?.59*visible:0;
  for(const window of buildingWindows)window.emissiveIntensity=active?1.2:0;
}
let prev=performance.now();
let acc=0;
const STEP=1/30;
function move(dt,phase){
  for(const lane of lanes){
    stepLane(lane,dt,lane.side?phase.side:phase.main);
    for(const o of lane.cars){
      const pos=lane.route.pose(o.s,lane.offset);
      o.model.position.set(pos.x,.486,pos.z);
      o.model.rotation.y=Math.atan2(pos.dx*lane.direction,pos.dz*lane.direction);
    }
  }
  animatePedestrians(dt,phase.walk);
  positionTestTraffic(dt);
  for(const [b,i] of boats){
    b.position.y=.24+.065*Math.sin(simulationSeconds*1.51+i);
    b.rotation.x=.022*Math.cos(simulationSeconds*.9+i*2);
    b.rotation.z=.027*Math.sin(simulationSeconds*1.27+i);
  }
  waterState.elapsed.value=simulationSeconds;
}
move(0,signalAt(0));aim(1);refreshClock();updateLight();updateSignals(signalAt(0));updatePrototype(0);refreshPrototype(true);
function frame(now){
  const elapsed=clamp((now-prev)/1000,0,.25);
  prev=now;
  if(playing){
    acc+=elapsed;
    while(acc>=STEP){
      if(ambientTime===null)minute=(minute+STEP*3.56*Number(speed.value))%1440;
      simulationSeconds+=STEP;
      move(STEP,signalAt(simulationSeconds));
      updatePrototype(STEP);
      acc-=STEP;
    }
  }
  refreshClock();updateLight();updateSignals(signalAt(simulationSeconds));refreshPrototype();
  aim(elapsed);
  if(software){
    renderer.render(scene,camera,{
      day:skyState.day.value,warm:skyState.warm.value,top:skyState.top.value,bottom:skyState.bottom.value,
      sun:skyState.sunP.value,az:current.az,time:simulationSeconds,prototypeRevision
    },now);
  }else{
    updateMovers();
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
