import {Vector3,Quaternion,Matrix4} from 'three';

// Sample the visible skin surface in weapon space. Fingers close only when the
// animated pad is close enough to touch the body, grip or detachable magazine.
export function gripContact(rig,weapon){
  weapon.updateWorldMatrix(true,true);
  const inverse=weapon.matrixWorld.clone().invert(),local=new Matrix4(),v=new Vector3();
  const clouds=[];
  weapon.traverseVisible(mesh=>{
    if(!mesh.isMesh || ![mesh.material].flat().some(m=>m.visible) || mesh.userData.plate)return;
    const attr=mesh.geometry.attributes.position;if(!attr)return;
    const points=[];
    for(let i=0;i<attr.count;i+=Math.max(1,Math.ceil(attr.count/100))){
      points.push(v.fromBufferAttribute(attr,i).clone());
    }
    if(points.length)clouds.push({mesh,points});
  });
  const all=clouds.reduce((n,c)=>n+c.points.length,0);
  const stride=Math.max(1,Math.ceil(all/380));
  const surface=new Float32Array(Math.ceil(all/stride)*3),q=new Quaternion(),turn=new Quaternion();
  const from=new Vector3(),to=new Vector3(),current=new Vector3(),target=new Vector3(),toward=new Vector3();
  const digits=['Thumb','Index','Middle','Ring','Pinky'].flatMap(name=>['L','R'].flatMap(side=>{
    const knuckle=rig.getObjectByName(side+'_'+name+'2'), tip=rig.getObjectByName(side+'_'+name+'3');
    return knuckle && tip?[{knuckle,tip}]:[];
  }));
  const saved=digits.map(()=>new Quaternion());
  let changed=false;
  return {
    restore(){if(changed)digits.forEach(({knuckle},i)=>knuckle.quaternion.copy(saved[i]));changed=false},
    apply(progress){
      const blend=Math.min(1,Math.max(0,progress)*9,Math.max(0,1-progress)*9);
      if(!blend || !digits.length)return;
      weapon.updateWorldMatrix(true,true);
      inverse.copy(weapon.matrixWorld).invert();
      let count=0,seen=0;
      for(const {mesh,points} of clouds){
        local.multiplyMatrices(inverse,mesh.matrixWorld);
        for(const point of points)if(seen++%stride===0)v.copy(point).applyMatrix4(local).toArray(surface,3*count++);
      }
      changed=true;
      digits.forEach(({knuckle,tip},i)=>{
        saved[i].copy(knuckle.quaternion);
        tip.getWorldPosition(to);knuckle.getWorldPosition(from);
        v.copy(to).applyMatrix4(inverse);
        let best=.032**2,index=-1;
        for(let k=0;k<count*3;k+=3){
          const x=surface[k]-v.x,y=surface[k+1]-v.y,z=surface[k+2]-v.z;
          const d=x*x+y*y+z*z;if(d<best){best=d;index=k}
        }
        if(index<0 || best<.002**2)return;
        target.fromArray(surface,index).applyMatrix4(weapon.matrixWorld);
        current.subVectors(to,from).normalize();toward.subVectors(target,from).normalize();
        if(current.dot(toward)<.45)return;
        knuckle.parent.getWorldQuaternion(q).invert();
        turn.setFromUnitVectors(current.applyQuaternion(q),toward.applyQuaternion(q)).multiply(saved[i]);
        knuckle.quaternion.rotateTowards(turn,.22*blend*(1-Math.sqrt(best)/.032));
      });
    }
  };
}
