import * as T from 'three';

const point=new T.Vector3(),ray=new T.Raycaster(),ndc=new T.Vector2();
export class AstralView{
  constructor(scene){
    this.group=new T.Group();
    const gold=new T.MeshBasicMaterial({color:0xffd789,depthTest:false});
    this.ring=new T.Mesh(new T.TorusGeometry(.72,.032,8,48).rotateX(Math.PI/2),gold);
    this.star=new T.Mesh(new T.OctahedronGeometry(.22),gold);
    this.group.add(this.ring,this.star);
    this.group.renderOrder=this.star.renderOrder=this.ring.renderOrder=9;
    this.group.visible=false;scene.add(this.group);
    this.cx=this.cz=0;this.height=31;this.last=0;
  }
  enter(p){this.cx=p.x;this.cz=p.z;this.height=31;this.last=0;ndc.set(0,0);}
  pointer(event,canvas,unlocked){
    const rect=canvas.getBoundingClientRect();
    if(unlocked)ndc.set((event.clientX-rect.left)*2/rect.width-1,1-(event.clientY-rect.top)*2/rect.height);
    else{ndc.x+=event.movementX*2/rect.width;ndc.y-=event.movementY*2/rect.height;}
    ndc.clampScalar(-.99,.99);
  }
  update(camera,p,keys,cursor,world,limit,time,divide){
    const dt=this.last?Math.min(.05,(time-this.last)/1000):0;this.last=time;
    const clamp=v=>T.MathUtils.clamp(v,-limit,limit);
    this.cx=clamp(this.cx+dt*20*(+keys.has('KeyD')-+keys.has('KeyA')));
    this.cz=clamp(this.cz+dt*20*(+keys.has('KeyS')-+keys.has('KeyW')));
    this.height=T.MathUtils.clamp(this.height+dt*13*(+keys.has('Space')-+(keys.has('ControlLeft')||keys.has('ControlRight'))),14,48);
    camera.position.set(this.cx,p.y+this.height,this.cz+this.height*.10);camera.lookAt(this.cx,p.y,this.cz);
    camera.fov=62;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    ray.setFromCamera(ndc,camera);
    const t=world.mapHit(ray.ray,130,[],false);ray.ray.at(t,point);
    cursor.x=clamp(point.x);cursor.z=clamp(point.z);
    this.group.visible=true;this.group.position.copy(point);this.group.position.y+=.095;
    this.star.rotation.y=time*.002;this.star.position.y=.39+Math.sin(time*.004)*.07;
    this.ring.scale.setScalar(divide?1.45:1);this.ring.material.color.setHex(divide?0xd5a7ff:0xffd789);
  }
}
