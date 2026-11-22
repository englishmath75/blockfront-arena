import * as T from 'three';

// Additive motion sits on top of the agent's two-handed rig. Angles are in
// radians, offsets in metres. Every offset returns to zero at the clip ends.
const styles = {
  rogue: { wrist: 0.22, lift: 0.12, spread: 0.12, plates: 0.005, catch: 0.32, seat: 0.7 },
  singularityep9: { wrist: -0.35, lift: 0.3, spread: 0.65, plates: 0.037, catch: 0.24, seat: 0.78 },
  araxys: { wrist: 0.28, lift: 0.22, spread: 0.36, plates: 0.024, catch: 0.34, seat: 0.76 },
  champions2023: { wrist: 0.36, lift: 0.2, spread: 0.28, plates: 0.004, catch: 0.3, seat: 0.67 },
  reaver: { wrist: -0.45, lift: 0.35, spread: 0.8, plates: 0.012, catch: 0.21, seat: 0.81 },
  elderflame: { wrist: 0.42, lift: 0.29, spread: 0.48, plates: 0.021, catch: 0.35, seat: 0.72 },
  neptune: { wrist: 0.31, lift: 0.17, spread: 0.22, plates: 0, catch: 0.28, seat: 0.69 },
};
const ease = (v) => {
  const t = T.MathUtils.clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

export function skinArticulation(rig, weapon, skin, hasNativeMotion) {
  const style = skin?.motionOn && !hasNativeMotion && styles[skin.banner];
  if (!style) return;
  const joints = [],
    plates = [];
  const add = (name, axis, amount) => {
    const bone = rig.getObjectByName('L_' + name);
    if (bone) joints.push({ bone, axis, amount, rest: new T.Quaternion() });
  };
  add('Hand', 'z', style.wrist);
  add('Forearm', 'x', style.lift);
  for (const [i, name] of ['Index', 'Middle', 'Ring', 'Pinky'].entries()) {
    add(name + '1', 'z', (0.38 - i * 0.22) * style.spread);
    add(name + '2', 'x', (0.28 + i * 0.09) * style.spread);
  }
  weapon.traverse((o) => {
    if (o.userData.plate) plates.push(o);
  });
  let changed = false;
  return {
    restore() {
      if (changed) for (const j of joints) j.bone.quaternion.copy(j.rest);
      changed = false;
    },
    update(tag, t, age) {
      const reload = tag === 'reload',
        inspect = tag === 'inspect';
      const envelope = reload
        ? ease(t / style.catch) * (1 - ease((t - style.seat) / (1 - style.seat)))
        : inspect
          ? ease(t / 0.25) * (1 - ease((t - 0.7) / 0.3))
          : 0;
      if (envelope) {
        for (const j of joints) {
          j.rest.copy(j.bone.quaternion);
          j.bone.rotation[j.axis] += j.amount * envelope * (reload ? 1 : -0.7);
        }
        changed = true;
      }
      for (const plate of plates) {
        const wave = 1 + 0.24 * Math.sin(t * Math.PI * 2 + plate.userData.plate);
        const kick = age >= 0 && age < 0.13 ? Math.sin((age / 0.13) * Math.PI) * 0.28 : 0;
        plate.position
          .copy(plate.userData.recoilAxis)
          .multiplyScalar(style.plates * (envelope * wave + kick));
      }
    },
  };
}
