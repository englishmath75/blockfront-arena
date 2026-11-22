import { Quaternion, Vector3 } from 'three';
import footage from './finger-motion.json' with { type: 'json' };

// Directions are measured in the filmed hand's palm coordinates. This lets the
// same captured gesture follow the equipped agent's wrist and finger lengths.
export function bindFingers(rig) {
  const hands = [], previous = new Map();
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
      const frames = footage[skin.id]?.[tag];
      if (!frames) return;
      const at = Math.max(0, Math.min(1, progress)) * (frames.length - 1);
      const first = Math.floor(at), mix = at - first;
      for (const {side, palm, joints} of hands) {
        const a = frames[first][side], b = frames[Math.min(first + 1,frames.length - 1)][side];
        if (!a && !b) continue;
        const weight = .85 * (!a ? mix : !b ? 1 - mix : 1);
        palm[0].getWorldPosition(origin);
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
    },
  };
}
