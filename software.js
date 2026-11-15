import * as T from './three.module.js';
import {reefRings} from './map.js';
const reefGeometry=reefRings.map(ring=>ring.map(([x,z])=>new T.Vector3(x,.02,z)));

const vec=()=>new T.Vector3();
const colorCSS=(r,g,b)=>'rgb('+r+' '+g+' '+b+')';
const linearToSrgb=v=>Math.round(255*Math.pow(Math.max(0,Math.min(1,v)),.4545));
function color(c){return colorCSS(linearToSrgb(c.r),linearToSrgb(c.g),linearToSrgb(c.b));}
function tinted(c,amount,emissive,st){
  const light=.22+st.day*.66;
  const e=emissive?.color,energy=emissive?.intensity??0;
  return colorCSS(
    linearToSrgb(c.r*(light+amount*(.20+st.warm*.29))+(e?.r??0)*energy*.65),
    linearToSrgb(c.g*(light+amount*.19)+(e?.g??0)*energy*.65),
    linearToSrgb(c.b*(light+.013+amount*(.24-st.warm*.11))+(e?.b??0)*energy*.65)
  );
}
const lowPoly=new Map();
function facesFor(geometry){
  const cached=lowPoly.get(geometry);
  if(cached)return cached;
  const a=geometry.attributes.position,index=geometry.index,tri=[];
  let source=geometry;
  if(geometry.type==='IcosahedronGeometry')source=new T.IcosahedronGeometry(1,0);
  if(geometry.type==='SphereGeometry')source=new T.SphereGeometry(1,7,4);
  if(geometry.type==='TorusGeometry')source=new T.TorusGeometry(1,.16,4,10);
  const p=source.attributes.position,ix=source.index,cols=source.attributes.color;
  const count=ix?ix.count:p.count;
  for(let i=0;i<count;i+=3){
    const ids=[i,i+1,i+2].map(j=>ix?ix.getX(j):j);
    const pts=ids.map(j=>vec().fromBufferAttribute(p,j));
    const n=vec().subVectors(pts[1],pts[0]).cross(vec().subVectors(pts[2],pts[0])).normalize();
    const c=cols?new T.Color(cols.getX(ids[0]),cols.getY(ids[0]),cols.getZ(ids[0])):null;
    tri.push({pts,n,c});
  }
  if(source!==geometry)source.dispose();
  const out={tri,count:a.count,indexed:!!index};
  lowPoly.set(geometry,out);return out;
}

export function softwareRenderer(){
  const c=document.createElement('canvas');
  const ctx=c.getContext('2d',{alpha:false});
  const view=new T.Matrix4(),combined=new T.Matrix4();
  const scratch=new T.Vector4();
  const worldPoint=vec(),normal=vec(),toward=vec(),nMatrix=new T.Matrix3();
  const dims=vec();
  let width=1,height=1,last=-Infinity,zoom=1;
  let staticObjects,movingObjects,glows,ground,lastView='';
  function project(point,matrix){
    scratch.set(point.x,point.y,point.z,1).applyMatrix4(matrix);
    if(scratch.w<=.22)return null;
    return [width*(.5+.5*scratch.x/scratch.w),height*(.5-.5*scratch.y/scratch.w),scratch.w];
  }
  function path(pts){
    ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.closePath();
  }
  function groundPath(points){
    const clipped=[];
    const clipW=p=>view.elements[3]*p.x+view.elements[7]*p.y+view.elements[11]*p.z+view.elements[15];
    let prev=points.at(-1),before=clipW(prev);
    for(const p of points){
      const after=clipW(p);
      if((after>1)!==(before>1))clipped.push(prev.clone().lerp(p,(1-before)/(after-before)));
      if(after>1)clipped.push(p);
      prev=p;before=after;
    }
    return clipped.map(p=>project(p,view));
  }
  function backdrop(camera,st){
    const horizon=project(new T.Vector3(camera.position.x-Math.sin(st.az)*930,0,camera.position.z-Math.cos(st.az)*930),view);
    const y=clamp(horizon?.[1]??height*.12,0,height);
    const g=ctx.createLinearGradient(0,0,0,Math.max(y,1));
    g.addColorStop(0,color(st.top));g.addColorStop(1,color(st.bottom));
    ctx.fillStyle=g;ctx.fillRect(0,0,width,y+1);
    if(y>18){
      const solar=project(worldPoint.copy(st.sun).multiplyScalar(450).add(camera.position),view);
      if(solar&&st.day>.07&&solar[1]<y+10){
        const [sx,sy]=solar,glow=ctx.createRadialGradient(sx,sy,1,sx,sy,55);
        glow.addColorStop(0,'rgba(255,228,173,.75)');glow.addColorStop(1,'rgba(255,164,95,0)');
        ctx.fillStyle=glow;ctx.fillRect(sx-55,sy-55,110,110);
        ctx.fillStyle='#fff0c8';ctx.beginPath();ctx.arc(sx,sy,4,0,Math.PI*2);ctx.fill();
      }
      if(st.day<.40){
        ctx.fillStyle='rgba(221,234,255,'+(.67-st.day)+')';
        for(let i=0;i<70;i++){
          const x=((i*73.41-st.az*215)%width+width)%width;
          const yy=(i*39.7)%(y*.8);
          ctx.fillRect(x,yy,i%8===0?1.6:.8,i%8===0?1.6:.8);
        }
      }
    }
    const sea=ctx.createLinearGradient(0,y,0,Math.max(y+1,height));
    sea.addColorStop(0,tinted(new T.Color('#4b93a0'),.1,null,st));
    sea.addColorStop(1,tinted(new T.Color('#16738c'),.2,null,st));
    ctx.fillStyle=sea;ctx.fillRect(0,y,width,height-y);
    for(let i=0;i<reefGeometry.length;i++){
      const outline=groundPath(reefGeometry[i]);
      if(outline.length<3)continue;
      path(outline);
      const tint=new T.Color('#237c84').lerp(new T.Color('#66d4b5'),i/(reefGeometry.length-1));
      ctx.fillStyle=tinted(tint,.19,null,st);ctx.fill();
      if(i>=reefGeometry.length-2){ctx.strokeStyle='rgba(160,247,214,'+(.03+st.day*.10)+')';ctx.lineWidth=1;ctx.stroke();}
    }
    ctx.lineWidth=.8;
    for(let i=0;i<260;i++){
      const x=(i*37.93)%width, yy=y+((i*12.67+st.time*(.75+i%4)*.6)%(height-y||1));
      ctx.strokeStyle='rgba(184,240,226,'+((.025+st.day*.115)*(.32+(i%7)/10))+')';
      ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+2+(i%10)*Math.max(.14,yy/height)*2.3,yy-.2);ctx.stroke();
    }
  }
  function visible(o){
    for(let part=o;part;part=part.parent)if(!part.visible)return false;
    return true;
  }
  function glow(o,st){
    if(o.material.opacity<.006||!visible(o))return;
    worldPoint.setFromMatrixPosition(o.matrixWorld);
    const p=project(worldPoint,view);
    if(!p||p[0]<-50||p[0]>width+50||p[1]<-50||p[1]>height+50)return;
    const isPool=o.isMesh;
    let rx,ry;
    if(isPool){
      dims.setFromMatrixScale(o.matrixWorld);
      rx=dims.x*zoom/p[2]*.48;ry=dims.y*zoom/p[2]*.27;
    }else{
      rx=o.scale.x*zoom/p[2]*.55;ry=rx;
    }
    if(rx<1||ry<1)return;
    ctx.save();ctx.translate(p[0],p[1]);ctx.scale(rx,ry);
    const d=ctx.createRadialGradient(0,0,0,0,0,1);
    d.addColorStop(0,'rgba(255,198,117,'+o.material.opacity*(isPool?.63:.92)+')');
    d.addColorStop(.31,'rgba(255,187,83,'+o.material.opacity*.25+')');
    d.addColorStop(1,'rgba(255,180,75,0)');
    ctx.fillStyle=d;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  return {
    domElement:c,
    setPixelRatio(){},
    setSize(w,h){width=w;height=h;c.width=w;c.height=h;last=-Infinity;},
    render(scene,camera,st,now){
      if(now-last<32)return;
      const key=[st.time,st.day,st.warm,st.prototypeRevision,camera.position.x.toFixed(2),camera.position.y.toFixed(2),camera.position.z.toFixed(2),camera.quaternion.x.toFixed(4),camera.quaternion.y.toFixed(4),width,height].join();
      if(key===lastView)return;
      lastView=key;last=now;
      camera.updateMatrixWorld();view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      zoom=height/(2*Math.tan(camera.fov*Math.PI/360));
      scene.updateMatrixWorld(true);
      if(!staticObjects){
        staticObjects=[];movingObjects=[];glows=[];ground=[];
        scene.traverse(o=>{
          if(o.isSprite||(o.isMesh&&o.material.transparent)){glows.push(o);return;}
          if(!o.isMesh||o.material.isShaderMaterial)return;
          if(o.userData.ground){
            const {color,outline}=o.userData.ground;
            ground.push({level:o.position.y,color:new T.Color(color),points:outline.map(p=>new T.Vector3(p.x,o.position.y,p.y))});
            return;
          }
          let moving=false;
          for(let p=o;p;p=p.parent)if(p.userData.moving){moving=true;break;}
          const record={o,geometry:facesFor(o.geometry)};
          (moving?movingObjects:staticObjects).push(record);
        });
      }
      ground.sort((a,b)=>a.level-b.level);
      backdrop(camera,st);
      for(const g of ground){
        const points=groundPath(g.points);
        if(points.length<3)continue;
        path(points);ctx.fillStyle=tinted(g.color,.57,null,st);ctx.fill();
      }
      const polygons=[];
      for(const {o,geometry} of [...staticObjects,...movingObjects]){
        if(!visible(o))continue;
        const m=o.material;
        const center=project(worldPoint.setFromMatrixPosition(o.matrixWorld),view);
        if(center){
          dims.setFromMatrixScale(o.matrixWorld);
          const radius=Math.max(dims.x,dims.y,dims.z);
          const size=radius*zoom/center[2];
          if(size<.52|| (geometry.count<150 && (center[0]<-size*4||center[0]>width+size*4||center[1]<-size*4||center[1]>height+size*4) && o.geometry.type!=='ExtrudeGeometry'&&o.geometry.type!=='BufferGeometry'))continue;
        }
        combined.multiplyMatrices(view,o.matrixWorld);
        nMatrix.getNormalMatrix(o.matrixWorld);
        const light=m.emissiveIntensity>0?{color:m.emissive,intensity:m.emissiveIntensity}:null;
        for(const f of geometry.tri){
          normal.copy(f.n).applyMatrix3(nMatrix).normalize();
          worldPoint.copy(f.pts[0]).applyMatrix4(o.matrixWorld);
          toward.subVectors(camera.position,worldPoint);
          const front=normal.dot(toward)>0;
          if(!front&&m.side!==T.DoubleSide)continue;
          if(!front)normal.negate();
          const ab=f.pts.map(point=>project(point,combined));
          if(ab.includes(null))continue;
          if(ab.every(p=>p[0]<0)||ab.every(p=>p[0]>width)||ab.every(p=>p[1]<0)||ab.every(p=>p[1]>height))continue;
          const area=(ab[1][0]-ab[0][0])*(ab[2][1]-ab[0][1])-(ab[1][1]-ab[0][1])*(ab[2][0]-ab[0][0]);
          if(Math.abs(area)<.18)continue;
          const kind=o.userData.surface??(o.userData.deck?-.5:0);
          const depth=(ab[0][2]+ab[1][2]+ab[2][2])/3+(o.userData.depthBias??0);
          polygons.push({ab,depth,kind,fill:tinted(f.c??m.color,Math.max(0,normal.dot(st.sun)),light,st)});
        }
      }
      polygons.sort((a,b)=>a.kind-b.kind||b.depth-a.depth);
      let drewPools=false;
      for(const polygon of polygons){
        if(!drewPools&&polygon.kind>=0){
          for(const o of glows)if(o.isMesh)glow(o,st);
          drewPools=true;
        }
        path(polygon.ab);ctx.fillStyle=polygon.fill;ctx.fill();
        ctx.strokeStyle=polygon.fill;ctx.lineWidth=.55;ctx.stroke();
      }
      for(const o of glows)if(o.isSprite)glow(o,st);
    }
  };
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
