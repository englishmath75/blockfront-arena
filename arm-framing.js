import {Vector3,Quaternion} from 'three';
import {reachArm} from './sova-bow.js';

// Keep the open upper-arm cuffs behind the view while preserving the animated
// world-space grip at both hands, including during a magazine exchange.
export function armFraming(rig){
  const chains=['L','R'].map((side,i)=>{
    const shoulder=rig.getObjectByName(side+'_Shoulder'),elbow=rig.getObjectByName(side+'_Elbow'),hand=rig.getObjectByName(side+'_Hand');
    if(!shoulder||!elbow||!hand)return;
    return {shoulder,elbow,hand,side:i?1:-1,reach:reachArm(rig,side),pos:new Vector3(),
      rotations:[new Quaternion(),new Quaternion(),new Quaternion()]};
  }).filter(Boolean);
  const anchor=new Vector3(),target=new Vector3(),old=new Vector3(),wrist=new Quaternion(),parent=new Quaternion();
  let changed=false;
  return {
    restore(){if(!changed)return;for(const c of chains){
      c.shoulder.position.copy(c.pos);[c.shoulder,c.elbow,c.hand].forEach((b,i)=>b.quaternion.copy(c.rotations[i]));
    }changed=false},
    update(camera){
      for(const c of chains){
        c.pos.copy(c.shoulder.position);[c.shoulder,c.elbow,c.hand].forEach((b,i)=>c.rotations[i].copy(b.quaternion));
        c.hand.getWorldPosition(target);c.hand.getWorldQuaternion(wrist);c.shoulder.getWorldPosition(old);
        anchor.set(camera.position.x+.015,camera.position.y-.24,camera.position.z+c.side*.245);
        // Preserve full reach if the authored pose extends beyond the shoulder.
        c.elbow.getWorldPosition(old);
        const reach=old.distanceTo(target)+old.distanceTo(c.shoulder.getWorldPosition(c.shoulder.userData.frameOrigin??=new Vector3()));
        const d=anchor.distanceTo(target);if(d>reach*.97)anchor.lerp(target,1-reach*.97/d);
        c.shoulder.position.copy(c.shoulder.parent.worldToLocal(anchor));c.reach(target);
        c.hand.parent.getWorldQuaternion(parent);c.hand.quaternion.copy(parent.invert().multiply(wrist));
      }changed=true;
    }
  };
}
