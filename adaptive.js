import {SCALE} from './map.js';
export const LAMP_POSITIONS=[-86,-68,-50,-32];
export const LAMP_COUNT=4, ZONE_WIDTH=12.4;
export const POWER={max:40,min:4,controls:2};
export const DEFAULTS={dim:30,range:7,hold:4};
const FADE_UP=.35,FADE_DOWN=1.2,ROAD_HALF_WIDTH=ZONE_WIDTH/2;
export function makeController(){
  const lamps=LAMP_POSITIONS.map(()=>({level:0,until:0,hits:0,status:'Off',ahead:false}));
  let elapsed=0,baselineEnergy=0,adaptiveEnergy=0,wasNight=false;
  function resetEnergy(){elapsed=0;baselineEnergy=0;adaptiveEnergy=0;}
  function clear(){for(const lamp of lamps)Object.assign(lamp,{level:0,until:0,hits:0,status:'Off',ahead:false});wasNight=false;}
  function step({night,now,dt,actors,settings,record=true}){
    if(!night){if(wasNight)clear();return;}
    const direct=lamps.map(()=>0),ahead=lamps.map(()=>false);
    for(const actor of actors){
      if(Math.abs(actor.cross)>ROAD_HALF_WIDTH)continue;
      for(let i=0;i<lamps.length;i++){
        if(Math.abs(actor.along-LAMP_POSITIONS[i]*SCALE)>settings.range)continue;
        direct[i]++;
        const next=i+actor.direction;
        if(actor.direction!==0&&next>=0&&next<lamps.length)ahead[next]=true;
      }
    }
    let adaptiveWatts=POWER.controls;
    lamps.forEach((lamp,i)=>{
      lamp.hits=direct[i];lamp.ahead=ahead[i];
      const triggered=lamp.hits>0||lamp.ahead;
      if(triggered)lamp.until=now+settings.hold;
      const holding=!triggered&&now<lamp.until;
      const target=triggered||holding?1:settings.dim/100;
      const fade=target>lamp.level?FADE_UP:FADE_DOWN;
      if(!wasNight||dt===0)lamp.level=target;
      else lamp.level+=Math.sign(target-lamp.level)*Math.min(Math.abs(target-lamp.level),dt/fade);
      lamp.status=lamp.hits?'Detected':lamp.ahead?'Ahead':holding?'Hold':lamp.level>target+.012?'Dimming':'Dim';
      adaptiveWatts+=POWER.min+(POWER.max-POWER.min)*lamp.level;
    });
    wasNight=true;
    if(record&&dt>0){elapsed+=dt;adaptiveEnergy+=adaptiveWatts*dt/3600;baselineEnergy+=POWER.max*lamps.length*dt/3600;}
  }
  return {lamps,step,clear,resetEnergy,metrics:()=>({elapsed,baselineEnergy,adaptiveEnergy,saving:baselineEnergy?100*(1-adaptiveEnergy/baselineEnergy):null})};
}
export const TEST_PASSES=[
  {start:6,duration:26,label:'Pedestrian walking',direction:1,lane:7},
  {start:39,duration:9,label:'Bicycle passing',direction:-1,lane:-2.8},
  {start:55,duration:6,label:'Motorcycle passing',direction:1,lane:2.8},
  {start:68,duration:6,label:'Car passing',direction:-1,lane:-2.8},
  {start:81,duration:15,label:'Runner passing',direction:1,lane:7}
];
export function testTrafficAt(seconds){
  const time=seconds%105;
  const index=TEST_PASSES.findIndex(pass=>time>=pass.start&&time<pass.start+pass.duration);
  if(index<0)return null;
  const {start,duration,direction,lane,label}=TEST_PASSES[index];
  const progress=(time-start)/duration;
  return {index,lane,label,direction,position:direction>0?-112+92*progress:-20-92*progress};
}
