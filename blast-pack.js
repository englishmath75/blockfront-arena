import timing from './ability-times.json' with {type:'json'};

const stats=timing['폭발 팩'];
export function stickPack(pack,normal,now){
  Object.assign(pack,{stuck:true,stuckAt:now,armedAt:now+stats['time needed to arm'],
    end:now+stats['max duration'],surfaceNormal:normal.toArray(),vx:0,vy:0,vz:0});
}
export function blastImpact(pack,p,now){
  const dx=p.x-pack.x,dz=p.z-pack.z,dy=p.y+p.height*.5-pack.y;
  const distance=Math.hypot(dx,dy,dz), radius=5;
  if(distance>=radius)return 0;
  const weight=1-distance/radius, horizontal=Math.hypot(dx,dz);
  const forward=horizontal>0 ? Math.min(12,16*weight)*Math.min(1,horizontal/.8)/horizontal : 0;
  const vx=dx*forward+(p.blastMotion?.vx??0)*.45,vz=dz*forward+(p.blastMotion?.vz??0)*.45;
  p.blastMotion={vx,vz,until:now+.85};
  p.vy= Math.max(0,p.vy)*.38+(dy>=0?1:-1)*(3.4+6.7*weight)*Math.min(1,.35+Math.abs(dy));
  return pack.armedAt!==undefined && now>=pack.armedAt && p.id!==pack.owner ? Math.round(15+35*weight):0;
}
