import * as T from 'three';

export function anchorPair(world,ray,distance,surface,devices){
  if(!surface.normal || !Number.isFinite(surface.surfaceDistance) || Math.abs(surface.surfaceDistance-distance)>.12)return;
  const normal=new T.Vector3().fromArray(surface.normal).normalize();
  if(normal.dot(ray.direction)>0)normal.negate();
  const start=ray.at(distance,new T.Vector3()).addScaledVector(normal,.045);
  const opposite={},line=new T.Ray(start,normal);
  const span=world.mapHit(line,10,devices,false,opposite);
  if(!opposite.normal || span<.32 || span>=9.99 || Math.abs(opposite.surfaceDistance-span)>.12)return;
  return {start:start.toArray(),end:line.at(span-.035,new T.Vector3()).toArray()};
}
export function crossesWire(d,p) {
  const [x,y,z]=d.wireEnd, dx=x-d.x,dy=y-d.y,dz=z-d.z;
  const horizontal=dx*dx+dz*dz,height=p.height??1.6;
  const u=horizontal<.001?T.MathUtils.clamp((p.y+height*.5-d.y)/(dy||1),0,1):
    T.MathUtils.clamp(((p.x-d.x)*dx+(p.z-d.z)*dz)/horizontal,0,1);
  const h=d.y+dy*u;
  return h>p.y+.03 && h<p.y+height+.18 && Math.hypot(d.x+dx*u-p.x,d.z+dz*u-p.z)<.38;
}
const ring=new T.TorusGeometry(.086,.009,6,24),puck=new T.CylinderGeometry(.075,.078,.039,12);
const axis=new T.Vector3(0,1,0),front=new T.Vector3(0,0,1);
export function wireVisual(d,now,player){
  const mesh=d.mesh;
  if(!mesh.userData.wire){
    mesh.material.visible=false;mesh.scale.setScalar(1);
    const delta=new T.Vector3().fromArray(d.wireEnd).sub(new T.Vector3(d.x,d.y,d.z));
    const mat=new T.MeshBasicMaterial({color:0x76defe,transparent:true,depthWrite:false});
    const g=new T.BufferGeometry().setFromPoints([new T.Vector3(),delta]);
    const lineMat=new T.LineBasicMaterial({color:0x83ceff,transparent:true,depthWrite:false});
    mesh.add(new T.Line(g,lineMat));
    const buzzGeo=new T.BufferGeometry(),band=new T.BufferAttribute(new Float32Array(25*3),3);
    buzzGeo.setAttribute('position',band);
    const buzz=new T.Line(buzzGeo,lineMat);buzz.frustumCulled=false;mesh.add(buzz);
    const side=new T.Vector3().crossVectors(delta,Math.abs(delta.y)<.85*delta.length()?axis:front).normalize();
    const body=new T.MeshStandardMaterial({color:0x354858,metalness:.68,roughness:.38});
    const normal=delta.clone().normalize();
    for(const pos of [new T.Vector3(),delta]){
      const base=new T.Mesh(puck,body),coil=new T.Mesh(ring,mat);
      base.position.copy(pos);coil.position.copy(pos);
      base.quaternion.setFromUnitVectors(axis,normal);coil.quaternion.setFromUnitVectors(front,normal);
      mesh.add(base,coil);
    }
    mesh.userData.wire={mat,lineMat,buzz,band,side,delta};
    mesh.userData.disposeField=()=>{g.dispose();buzzGeo.dispose();mat.dispose();lineMat.dispose();body.dispose()};
  }
  mesh.position.set(d.x,d.y,d.z);mesh.rotation.set(0,0,0);
  const {mat,lineMat,buzz,band,side,delta}=mesh.userData.wire,active=d.triggerAt>now,bright=active?.55+.45*Math.sin(now*50)**2:.72;
  buzz.visible=active;
  if(active){
    for(let i=0;i<band.count;i++){
      const u=i/(band.count-1),wave=Math.sin(u*Math.PI)*(.04*Math.sin(i*5.4-now*72)+.017*Math.sin(i*2.9+now*54));
      band.setXYZ(i,u*delta.x+wave*side.x,u*delta.y+wave*side.y,u*delta.z+wave*side.z);
    }
    band.needsUpdate=true;
  }
  mat.opacity=bright;lineMat.opacity=active?bright:.49;
  mat.color.setHex(active?0xff804d:0x76defe);lineMat.color.copy(mat.color);
  const [x,y,z]=d.wireEnd;
  mesh.visible=d.team===player.team || active || Math.min(Math.hypot(d.x-player.x,d.y-player.y,d.z-player.z),Math.hypot(x-player.x,y-player.y,z-player.z))<3;
}
