const position = ({x,y,z}) => ({x,y,z});
const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));

export function startRefraction(p, beacon, now) {
  if (p.refracting || now < beacon.start || now >= beacon.end) return false;
  const distance=Math.hypot(p.x-beacon.x,p.y-beacon.y,p.z-beacon.z);
  const start=now+.05, end=start+clamp(distance/40,.35,2);
  p.refracting={from:position(p),to:position(beacon),start,end};
  p.phaseUntil=end;
  p.nextShot=Math.max(p.nextShot,end+.8);
  p.lightRush=null;p.dashTime=0;
  beacon.end=now;
  return true;
}
export function moveRefraction(p,now) {
  const trip=p.refracting;
  if(!trip)return false;
  const t=clamp((now-trip.start)/(trip.end-trip.start),0,1);
  const u=t*t*(3-2*t);
  for(const k of ['x','y','z'])p[k]=trip.from[k]+(trip.to[k]-trip.from[k])*u;
  p.vx=p.vy=p.vz=0;
  if(t>=1){p.refracting=null;p.refractArrival=trip.end+.2;}
  return true;
}
export function startShade(p,shade,now) {
  p.shadowCast={origin:position(p),goal:position(shade),device:shade.id,start:now+1.5,end:now+4,arrived:false};
  p.nextShot=Math.max(p.nextShot,now+4);
}
export function tickShade(p,shade,now,cancel=false) {
  const cast=p.shadowCast;
  if(!cast)return;
  if(p.down || p.suppressed>now || !shade || shade.hp<=0 || (cancel && now>=cast.start)){
    if(cast.arrived)Object.assign(p,cast.origin);
    if(shade)shade.end=now;
    p.phaseUntil=0;p.nextShot=now+.35;p.shadowCast=null;return;
  }
  if(now>=cast.start && !cast.arrived){
    Object.assign(p,cast.goal,{vx:0,vy:0,vz:0,phaseUntil:cast.end});cast.arrived=true;
  }
  if(now>=cast.end){p.phaseUntil=0;p.shadowCast=null;shade.end=now;}
}
export function beginDevour(p,orb,automatic=false) {
  p.healLeft=50;p.healRate=50/(automatic?2.5:3);p.healTick=0;p.canOverheal=true;
  p.soulTether=automatic?null:position(orb);
}
export function dashDirection(yaw,keys,vx,vz) {
  const x=Number(!!keys?.has('KeyD'))-Number(!!keys?.has('KeyA'));
  const z=Number(!!keys?.has('KeyW'))-Number(!!keys?.has('KeyS'));
  const n=Math.hypot(x,z),speed=Math.hypot(vx,vz);
  if(n)return [(x*Math.cos(yaw)-z*Math.sin(yaw))/n,(-x*Math.sin(yaw)-z*Math.cos(yaw))/n];
  if(!keys && speed>.5)return [vx/speed,vz/speed];
  return [-Math.sin(yaw),-Math.cos(yaw)];
}
