import * as T from 'three';

const bowSkills = new Set(['정찰용 화살', '충격 화살', '사냥꾼의 분노']);
export const usesBow = (name) => bowSkills.has(name);

// Aim the character's own arm chain towards two viewmodel sockets. All
// coordinates are in the first-person scene; gameplay/projectiles are separate.
export function reachArm(rig, side, followElbow=false) {
  const [upper, lower, hand] = ['Shoulder', 'Elbow', 'Hand'].map((n) => rig.getObjectByName(side + '_' + n));
  if (!upper || !lower || !hand) return () => {};
  const origin = new T.Vector3(),
    mid = new T.Vector3(),
    end = new T.Vector3(),
    axis = new T.Vector3(),
    pole = new T.Vector3(),
    goal = new T.Vector3();
  const a = new T.Vector3(),
    b = new T.Vector3(),
    parentQ = new T.Quaternion(),
    jointQ = new T.Quaternion(),
    turn = new T.Quaternion();
  function aim(bone, child, at) {
    bone.getWorldPosition(a);
    child.getWorldPosition(b).sub(a).normalize();
    a.subVectors(at, a).normalize();
    turn.setFromUnitVectors(b, a);
    bone.getWorldQuaternion(jointQ);
    bone.parent.getWorldQuaternion(parentQ);
    bone.quaternion.copy(parentQ.invert().multiply(turn).multiply(jointQ));
  }
  return (target) => {
    upper.getWorldPosition(origin);
    lower.getWorldPosition(mid);
    hand.getWorldPosition(end);
    const l1 = origin.distanceTo(mid),
      l2 = mid.distanceTo(end);
    axis.subVectors(target, origin);
    const d = T.MathUtils.clamp(axis.length(), Math.abs(l1 - l2) + 0.0001, l1 + l2 - 0.0001);
    axis.normalize();
    if(followElbow)pole.subVectors(mid,origin);
    else pole.set(-0.24, -0.85, side === 'L' ? -0.7 : 0.7);
    pole.addScaledVector(axis, -pole.dot(axis)).normalize();
    const along = (l1 * l1 + d * d - l2 * l2) / (2 * d);
    goal
      .copy(origin)
      .addScaledVector(axis, along)
      .addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    aim(upper, lower, goal);
    aim(lower, hand, target);
  };
}

export function bowPresentation(rig, bow, name, eye) {
  const pull = bow.getObjectByName('String'),
    arrow = bow.getObjectByName('Arrow');
  const top = bow.getObjectByName('StringUpper'),
    bottom = bow.getObjectByName('StringLower');
  if (!pull || !arrow || !top || !bottom || !eye) return;
  const original = [pull.position.clone(), arrow.position.clone()];
  const lineGeometry = new T.BufferGeometry(),
    positions = new T.BufferAttribute(new Float32Array(9), 3);
  lineGeometry.setAttribute('position', positions);
  const material = new T.LineBasicMaterial({ color: name === '충격 화살' ? 0x9eafff : 0x81edff });
  const line = new T.Line(lineGeometry, material);
  line.frustumCulled = false;
  rig.add(bow, line);
  const left = reachArm(rig, 'L'),
    right = reachArm(rig, 'R');
  const grip = new T.Vector3(),
    point = new T.Vector3(),
    delta = new T.Vector3(),
    matrix = new T.Matrix4(),
    basis = new T.Matrix3();
  const k = name === '사냥꾼의 분노' ? 0.78 : 0.64;
  bow.scale.setScalar(k);
  bow.rotation.set(-0.23, Math.PI, 0, 'XYZ');
  return {
    update(charge, tag, t) {
      eye.getWorldPosition(point);
      rig.worldToLocal(point);
      const release = tag === 'fire' ? Math.exp(-Math.max(0, t) * 15) : 0;
      bow.position.copy(point).add(grip.set(0.46 - 0.028 * release, -0.19 + 0.014 * release, -0.105));
      bow.updateWorldMatrix(true, false);
      for (const [i, bone] of [pull, arrow].entries()) {
        matrix.copy(bone.parent.matrixWorld).invert().multiply(bow.matrixWorld);
        delta.set(0.31 * Math.max(charge, release), 0, 0).applyMatrix3(basis.setFromMatrix4(matrix));
        bone.position.copy(original[i]).add(delta);
      }
      bow.localToWorld(grip.set(-0.07, 0.005, 0));
      left(grip);
      pull.getWorldPosition(point);
      right(point);
      [top, pull, bottom].forEach((bone, i) => {
        bone.getWorldPosition(point);
        rig.worldToLocal(point);
        positions.setXYZ(i, point.x, point.y, point.z);
      });
      positions.needsUpdate = true;
    },
    dispose() {
      lineGeometry.dispose();
      material.dispose();
    },
  };
}
