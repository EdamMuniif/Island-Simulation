export const PHASES=[
  [18,'green','red','red'],
  [3,'amber','red','red'],
  [5,'red','red','red'],
  [13,'red','green','red'],
  [3,'red','amber','red'],
  [4,'red','red','red'],
  [10,'red','red','green'],
  [3,'red','red','amber'],
  [3,'red','red','red']
];
const cycle=PHASES.reduce((total,[duration])=>total+duration,0);
export function signalAt(seconds){
  let remaining=((seconds%cycle)+cycle)%cycle;
  for(const [duration,main,side,walk] of PHASES){
    if(remaining<duration)return {main,side,walk};
    remaining-=duration;
  }
}
export function lightsOn(minutes){
  return minutes>=17*60+45 || minutes<5*60+45;
}
export function forwardDistance(from,to,length,direction){
  return ((to-from)*direction%length+length)%length;
}
export function stepLane(lane,dt,signal){
  const {cars,length,direction,stops}=lane;
  const advances=cars.map(car=>{
    let available=Infinity, desired=car.cruise;
    for(const other of cars){
      if(other===car)continue;
      const distance=forwardDistance(car.s,other.s,length,direction);
      const clearance=distance-(car.length+other.length)/2-1.55;
      available=Math.min(available,Math.max(0,clearance));
      desired=Math.min(desired,Math.max(0,(clearance-1.05)/.85+other.speed*.83));
    }
    for(const stop of stops){
      const distance=forwardDistance(car.s,stop,length,direction);
      const gap=distance-car.length/2;
      if(gap<-.02||gap>40||signal==='green')continue;
      if(signal==='amber'&&gap<car.speed*car.speed/7+.24){car.commit=stop;continue;}
      if(car.commit===stop)continue;
      available=Math.min(available,Math.max(0,gap-.14));
      desired=Math.min(desired,Math.sqrt(2*3.15*Math.max(0,gap-.19)));
    }
    const rate=desired<car.speed?4.6:2.5;
    car.speed+=Math.max(-rate*dt,Math.min(rate*dt,desired-car.speed));
    const advance=Math.min(available,car.speed*dt);
    if(advance+1e-6<car.speed*dt)car.speed=dt>0?advance/dt:0;
    return advance;
  });
  cars.forEach((car,i)=>{
    car.s=((car.s+advances[i]*direction)%length+length)%length;
    if(car.commit!==null&&forwardDistance(car.s,car.commit,length,direction)>length-6)car.commit=null;
  });
}
