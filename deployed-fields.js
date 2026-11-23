import timing from './ability-times.json' with {type:'json'};

// Keep the length travelled per victim rather than charging damage each frame.
export function tickNest(d,owner,dt,ctx){
  if(!owner || ctx.time<d.start)return;
  for(const p of ctx.players){
    if(p.down || Math.abs(p.y-d.y)>1.65 || Math.hypot(p.x-d.x,p.z-d.z)>d.radius){delete d.steps[p.id];continue;}
    if(d.kind==='swarmField'){
      if(ctx.time>=(d.steps[p.id]??0)){ctx.hurt(p,p.team===owner.team?4:12,owner);d.steps[p.id]=ctx.time+.25;}
      continue;
    }
    p.vineUntil=ctx.time+.10;
    const prev=d.steps[p.id];
    if(!prev){d.steps[p.id]=[p.x,p.z,0];continue;}
    const travelled=Math.hypot(p.x-prev[0],p.z-prev[1]);
    prev[0]=p.x;prev[1]=p.z;prev[2]+=Math.min(travelled,15*dt);
    if(prev[2]>=1.25){prev[2]%=1.25;
      if(!(p.vineHitAt>ctx.time-.07)){ctx.hurt(p,10,owner);p.vineHitAt=ctx.time;d.cueAt=ctx.time;}
    }
  }
}
export function tickHunterBeam(d,owner,ctx){
  if(!owner || d.fired || ctx.time<d.start)return;
  d.fired=true;d.cueAt=ctx.time;
  const [ax,ay,az]=d.axis;
  for(const o of ctx.players){
    if(o.down || !ctx.hostile(owner,o))continue;
    const x=o.x-d.x,y=o.y+o.height*.6-d.y,z=o.z-d.z,along=x*ax+y*ay+z*az;
    if(along<0 || along>d.length || Math.hypot(x-along*ax,y-along*ay,z-along*az)>d.radius)continue;
    ctx.hurt(o,timing[d.name].damage,owner);o.revealTeam=owner.team;o.revealEnd=ctx.time+1.5;
  }
}
export function owlPing(p,now){
  if(!p.owlDart || now<p.owlDart.next)return;
  p.revealTeam=p.owlDart.team;p.revealEnd=now+.65;p.scannedUntil=p.revealEnd;
  if(--p.owlDart.left)p.owlDart.next+=1.2;else p.owlDart=null;
}
export function domeBoundary(ray,d,limit){
  const r=d.w*.5,x=ray.origin.x-d.x,y=ray.origin.y-d.y-d.h*.5,z=ray.origin.z-d.z,v=ray.direction;
  const b=x*v.x+y*v.y+z*v.z,k=b*b-(x*x+y*y+z*z-r*r);
  if(k<0)return limit;
  const root=Math.sqrt(k),t=-b-root>=0?-b-root:-b+root;
  return t>=0?Math.min(t,limit):limit;
}
