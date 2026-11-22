import { Quaternion, Vector3 } from 'three';
import grips from './reference-grips.json' with {type:'json'};
import phases from './reference-phases.json' with {type:'json'};
import footage from './finger-motion.json' with { type: 'json' };

// Directions are measured in the filmed hand's palm coordinates. This lets the
// same captured gesture follow the equipped agent's wrist and finger lengths.
export function bindFingers(rig) {
  const hands = [], previous = new Map();
  const eye=rig.getObjectByName('Camera'),eyeAt=new Vector3();
  for (const side of ['L', 'R']) {
    const find = name => rig.getObjectByName(side + '_' + name);
    const palm = ['Hand','Index1','Middle1','Pinky1'].map(find);
    if (palm.some(node => !node)) continue;
    const joints = [];
    for (const finger of ['Thumb','Index','Middle','Ring','Pinky']) {
      for (let segment = 1; segment <= 3; segment++) {
        const bone = find(finger + segment), child = find(finger + (segment + 1));
        joints.push(bone && { bone, axis: (child?.position ?? bone.position).clone().normalize() });
      }
    }
    hands.push({ side, palm, joints });
  }
  const origin = new Vector3(), forward = new Vector3(), across = new Vector3(), normal = new Vector3();
  const desired = new Vector3(), rest = new Vector3(), parent = new Quaternion(), turn = new Quaternion();
  return {
    restore() {
      for (const [bone, q] of previous) bone.quaternion.copy(q);
      previous.clear();
    },
    apply(skin, tag, progress) {
      const frames = skin.motionOn && footage[skin.id]?.[tag], bank=grips[skin.id], timed=phases[skin.id]?.[tag];
      if(!frames && !bank && !timed)return;
      const at=Math.max(0,Math.min(1,progress))*((frames?.length??1)-1),first=Math.floor(at);
      eye?.getWorldPosition(eyeAt);
      let measured=false;
      for (const {side, palm, joints} of hands) {
        palm[0].getWorldPosition(origin);
        let a=frames?.[first]?.[side],b=frames?.[Math.min(first+1,(frames?.length??1)-1)]?.[side],mix=at-first;
        let weight=.85*(!a?mix:!b?1-mix:1);
        if(!a && !b && timed){
          let lo,hi;
          for(const key of timed)if(key[1]===side){if(key[0]<=progress)lo=key;else{hi=key;break}}
          if(lo && hi && hi[0]-lo[0]<.26){a=lo[2];b=hi[2];mix=(progress-lo[0])/(hi[0]-lo[0]||1);weight=.72}
        }
        if(!a && !b && eye && bank?.[side]){
          const half=Math.max(.12,origin.x-eyeAt.x)*Math.tan(Math.PI*24/180);
          const x=.5+(origin.z-eyeAt.z)/(2*half*16/9),y=.5-(origin.y-eyeAt.y)/(2*half);
          let firstD=.14,secondD=.14;
          for(const [xy,pose] of bank[side]){
            const d=Math.hypot(x-xy[0],y-xy[1]);
            if(d<firstD){b=a;secondD=firstD;a=pose;firstD=d}
            else if(d<secondD){b=pose;secondD=d}
          }
          mix=b?firstD/(firstD+secondD||1):0;weight=.58*(1-firstD/.14)*Math.min(1,progress*8,(1-progress)*8);
        }
        if((!a && !b) || weight<=0)continue;
        measured=true;
        palm[2].getWorldPosition(forward).sub(origin).normalize();
        palm[3].getWorldPosition(across).sub(palm[1].getWorldPosition(rest));
        across.addScaledVector(forward,-across.dot(forward)).normalize();
        normal.crossVectors(across,forward).normalize();
        joints.forEach((joint,i) => {
          if (!joint) return;
          const {bone,axis} = joint, l = (a ?? b)[i], r = (b ?? a)[i];
          desired.set(0,0,0);
          [across,forward,normal].forEach((dir,j) => desired.addScaledVector(dir,l[j]+(r[j]-l[j])*mix));
          bone.parent.getWorldQuaternion(parent);
          desired.normalize().applyQuaternion(parent.invert());
          rest.copy(axis).applyQuaternion(bone.quaternion);
          turn.setFromUnitVectors(rest,desired).multiply(bone.quaternion);
          previous.set(bone,bone.quaternion.clone());
          // Limit large corrections when the weapon obscures a fingertip.
          bone.quaternion.rotateTowards(turn, Math.min(.95,bone.quaternion.angleTo(turn)) * weight);
        });
      }
      return measured;
    },
  };
}
