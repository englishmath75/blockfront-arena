const horizontal=(p,d)=>Math.hypot(p.x-d.x,p.z-d.z);

export function toxicPath(p,floor){
  const path=[];
  for(let i=0;i<30;i++){
    const distance=.55+i*1.8,x=p.x-Math.sin(p.yaw)*distance,z=p.z-Math.cos(p.yaw)*distance;
    const level=floor(x,z,(path.at(-1)?.[1]??p.y)+4);
    if(!Number.isFinite(level))break;
    path.push([x,level,z]);
  }
  return path;
}
export function toxinContact(d,p){
  if(d.kind==='toxinWall'){
    return d.path.some(([x,y,z])=>Math.hypot(x-p.x,z-p.z)<1 && p.y+p.height>y && p.y<y+d.h);
  }
  const dx=(p.x-d.x)/(d.w*.5),dy=(p.y+p.height*.65-d.y-d.h*.5)/(d.h*.5),dz=(p.z-d.z)/(d.d*.5);
  return dx*dx+dy*dy+dz*dz<1;
}
export function applyToxin(p,now,dt){
  if(p.evolution || p.down || p.toxinFrame===now)return;
  const initial=p.toxinContact==null || now-p.toxinContact>.15;
  const amount=Math.min(Math.max(0,p.hp-1),(initial?30:0)+dt*10);
  p.toxinFrame=p.toxinContact=now;p.decayLost=(p.decayLost??0)+amount;
  p.hp-=amount;p.decayUntil=now+1.5;
}
export function separatedByDivide(a,b,devices,now){
  if(!a || !b || a===b)return false;
  for(const d of devices){
    if(d.kind!=='divide' || d.start>now || d.end<=now)continue;
    const s=Math.sin(d.angle),c=Math.cos(d.angle);
    if(((a.x-d.x)*s+(a.z-d.z)*c)*((b.x-d.x)*s+(b.z-d.z)*c)<0)return true;
  }
  return false;
}
const intercepted=new Set(['knife','seize','haunt','hawk','recon','mosh','paint','bomblet','net','barrier','satchel','swarm','vinePod','mpulse','vetoTrap','poisonCan','cageDisc']);
export function interceptorTick(d,owner,ctx,arrows,devices){
  const now=ctx.time;
  if(!d.on || owner.down || owner.suppressed>now || now<d.start)return;
  const targets=[...arrows.filter(a=>intercepted.has(a.type) && !a.intercepted),...devices.filter(v=>v!==d && v.hp>0 && v.end>now)];
  const canHit=v=>{
    const other=ctx.players.find(o=>o.id===v.owner);
    return other && ctx.hostile(owner,other) && Math.hypot(v.x-d.x,v.y-d.y,v.z-d.z)<=18 && ctx.visible({...d,y:d.y+.4},{...v,height:.16},18.5);
  };
  const target=targets.find(v=>v.id===d.aimId && canHit(v))??targets.find(canHit);
  if(!target){d.aimId=null;return;}
  if(d.aimId!==target.id){d.aimId=target.id;d.fireAt=now+.2;return;}
  if(now<d.fireAt)return;
  if(arrows.includes(target))target.intercepted=true;else{target.hp=0;target.end=now;}
  d.beam=[target.x,target.y+.10,target.z];d.cueAt=now;d.aimId=null;
}
export function vetoTrapTick(d,p,ctx){
  if(ctx.time<d.start || d.end<=ctx.time)return;
  const inRange=o=>!o.down && !o.evolution && ctx.hostile(p,o) && Math.hypot(o.x-d.x,o.y-d.y,o.z-d.z)<=6.58 && ctx.visible({...d,y:d.y+.22},o,7.2);
  if(!d.triggerAt && ctx.players.some(inRange))d.triggerAt=ctx.time+.5;
  if(!d.triggerAt || ctx.time<d.triggerAt)return;
  const field=ctx.add('vetoZone',d.x,d.z,4.5,13.16,13.16,.14,'#30ced7',p,d.y);
  Object.assign(field,{name:d.name,kind:'vetoField',cueAt:ctx.time});
  for(const o of ctx.players.filter(inRange)){
    o.deafUntil=ctx.time+4.5;o.tether={x:o.x,z:o.z,radius:.38,until:ctx.time+4.5};
    const loss=Math.min(75,Math.max(0,o.hp-1));o.hp-=loss;o.decayLost=(o.decayLost??0)+loss;o.decayUntil=ctx.time+4.5;
  }
  d.end=ctx.time;
}
const immunityTimers=['blindUntil','roseFlash','plasmaUntil','deafUntil','nearsight','suppressed','detainedUntil','jammedUntil','slowUntil','iceUntil','vineUntil','tag','vulnerable','hinderedUntil','netUntil','suspendedUntil','scannedUntil','revealEnd','trailEnd'];
export function evolutionCleanse(p){
  for(const key of immunityTimers)p[key]=0;
  p.tether=null;p.owlDart=null;p.cameraDart=null;p.trappedBy=0;
  if(p.decayLost>0){p.hp=Math.min(100,p.hp+p.decayLost);p.decayLost=0;}
}
export function kineticPull(d,o,ctx){
  if(o.evolution)return;
  const dx=d.x-o.x,dz=d.z-o.z,r=Math.hypot(dx,dz);
  const travel=Math.min(4.2,r),n=Math.ceil(travel/.13);
  for(let i=0;i<n;i++){
    const x=o.x,z=o.z;ctx.move(o,dx/r*travel/n,dz/r*travel/n);
    const contact=ctx.players.find(other=>other!==o && !other.down && Math.abs(o.y-other.y)<1.55 && horizontal(o,other)<.55);
    if(horizontal(o,{x,z})<travel/n*.65 || contact){
      o.tag=ctx.time+1.4;if(contact && !contact.evolution)contact.tag=ctx.time+1.4;break;
    }
  }
}
