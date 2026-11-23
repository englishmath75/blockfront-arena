import * as T from 'three';

export function wirePath(world,line,devices,enemies,visible){
  const path=[line.origin.clone()],ray=line.clone();
  let length=0,remaining=40,victim;
  for(let i=0;i<2 && remaining>.04;i++){
    const hit={},distance=world.mapHit(ray,remaining,devices,false,hit),end=ray.at(distance,new T.Vector3());
    let nearest=distance;
    for(const p of enemies){
      const center=new T.Vector3(p.x,p.y+p.height*.65,p.z),along=center.clone().sub(ray.origin).dot(ray.direction);
      if(along<=0 || along>=nearest || ray.distanceToPoint(center)>.7)continue;
      nearest=along;victim=p;
    }
    if(victim){path.push(ray.at(nearest,new T.Vector3()));length+=nearest;break;}
    path.push(end);length+=distance;remaining-=distance;
    if(i===0 && remaining>.04 && hit.normal){
      ray.direction.reflect(new T.Vector3(...hit.normal)).normalize();ray.origin.copy(end).addScaledVector(ray.direction,.05);
    }else{
      const candidates=enemies.map(p=>({p,d:Math.hypot(p.x-end.x,p.z-end.z,p.y+p.height*.65-end.y)}))
        .filter(v=>v.d<=6.5 && visible(end,v.p,7.2)).sort((a,b)=>a.d-b.d);
      victim=candidates[0]?.p;break;
    }
  }
  return {path:path.map(v=>v.toArray()),length,victim};
}
export function drawWire(d,t){
  const m=d.mesh;
  if(!m.userData.wire){
    const points=d.path.map(p=>new T.Vector3(...p));if(points.length<2)return;
    const line=new T.CurvePath();
    for(let i=1;i<points.length;i++)line.add(new T.LineCurve3(points[i-1],points[i]));
    if(line.getLength()<.001)return;
    m.geometry=new T.TubeGeometry(line,Math.min(48,Math.max(4,Math.ceil(line.getLength()))),.038,6,false);
    m.userData.owned=true;m.userData.wire=true;
  }
  m.position.set(0,0,0);m.scale.setScalar(1);m.material.opacity=.42+.44*Math.cos((t-d.born)*12)**2;
}

