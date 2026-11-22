import * as T from 'three';

const ring = new T.TorusGeometry(1, 0.022, 8, 64),
  shard = new T.OctahedronGeometry(1),
  globe = new T.SphereGeometry(1, 28, 18),
  beam = new T.CylinderGeometry(0.64, 1, 1, 24, 1, true),
  cup = new T.LatheGeometry(
    [
      [0.32, 0],
      [0.37, 0.07],
      [0.2, 0.15],
      [0.13, 0.37],
      [0.23, 0.44],
      [0.47, 0.74],
      [0.51, 0.87],
      [0.44, 0.87],
      [0.38, 0.75],
      [0.19, 0.52],
    ].map(([x, y]) => new T.Vector2(x, y)),
    32,
  );
const themes = {
  rogue: 'rogue',
  singularity: 'void',
  singularityep9: 'void',
  champions2023: 'cup',
  champions23: 'cup',
  araxys: 'beam',
  neptune: 'water',
};
export const hasArenaFinisher = theme => Object.hasOwn(themes,theme);
export function arenaFinisher(scene, theme, point, born, seconds, color, light) {
  const kind = themes[theme];
  if (!kind) return;
  const group = new T.Group(),
    halo = new T.Group(),
    pieces = new T.Group();
  group.position.set(point.x, point.y, point.z);
  group.add(halo, pieces);
  scene.add(group);
  const glow = new T.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.87,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const metal = new T.MeshStandardMaterial({
    color: kind === 'cup' ? 0xffce69 : kind === 'rogue' ? 0x701429 : 0x4b4861,
    metalness: 0.55,
    roughness: 0.28,
    emissive: color,
    emissiveIntensity: 0.22,
    side: T.DoubleSide,
  });
  const dark = new T.MeshBasicMaterial({ color: 0x090716 });
  const mesh = (parent, g, m, x, y, z, sx, sy, sz) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    parent.add(o);
    return o;
  };
  const ground = mesh(group, ring, glow, 0, 0.05, 0, 1.4, 1.4, 1.4);
  ground.rotation.x = Math.PI / 2;
  if (kind === 'cup') {
    mesh(halo, cup, metal, 0, 0, 0, 1.6, 1.6, 1.6);
    for (const side of [-1, 1]) mesh(halo, ring, metal, side * 0.67, 0.91, 0, 0.28, 0.41, 0.22);
  } else if (kind === 'void') {
    mesh(halo, globe, dark, 0, 0, 0, 0.7, 0.7, 0.7);
    for (let i = 0; i < 3; i++) {
      const o = mesh(halo, ring, glow, 0, 0, 0, 1 + i * 0.18, 1 + i * 0.18, 1);
      o.rotation.set(1.04 + i * 0.24, 0.35 + i * 0.4, 0.2 + i * 0.08);
    }
  } else if (kind === 'rogue') {
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7;
      mesh(
        halo,
        shard,
        i % 3 ? metal : glow,
        Math.cos(a) * 0.46,
        (i % 2) * 0.19,
        Math.sin(a) * 0.46,
        0.3,
        0.69,
        0.3,
      ).rotation.z = Math.cos(a) * 0.65;
    }
  } else if (kind === 'beam') {
    for (const s of [-1, 0, 1]) mesh(halo, beam, glow, s * 0.31, 2.5, 0, s ? 0.08 : 0.22, 5, s ? 0.08 : 0.22);
    for (let i = 0; i < 3; i++)
      mesh(halo, ring, metal, 0, 0.12 + i * 0.36, 0, 0.78 - i * 0.1, 0.78 - i * 0.1, 0.78).rotation.x =
        Math.PI / 2;
  } else {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const o = mesh(
        halo,
        globe,
        glow,
        Math.cos(a) * 0.32,
        0.2,
        Math.sin(a) * 0.32,
        0.09,
        0.8 + 0.3 * Math.cos(a),
        0.09,
      );
      o.rotation.z = 0.18 * Math.cos(a);
      o.rotation.x = 0.18 * Math.sin(a);
    }
  }
  const dust = new T.InstancedMesh(shard, glow, 36),
    pose = new T.Object3D();
  dust.frustumCulled = false;
  pieces.add(dust);
  return {
    update(t) {
      const age = Math.max(0, t - born);
      if (age >= seconds) {
        light?.dispose();
        group.removeFromParent();
        dust.dispose();
        glow.dispose();
        metal.dispose();
        dark.dispose();
        return false;
      }
      const progress = age / seconds,
        fade = Math.min(1, age * 3, (seconds - age) * 3);
      const frame=light?.update(age);
      group.scale.setScalar(Math.max(0.001, fade));
      ground.scale.setScalar(frame ? .38+1.9*frame.width : .55+Math.min(1,age*2));
      halo.position.y =
        kind === 'beam'
          ? 0
          : kind === 'water'
            ? 0.56
            : 1.15 + 0.55 * Math.min(1, age * 0.8) + 0.1 * Math.sin(age * 1.6);
      halo.rotation.y = age * (kind === 'rogue' ? 1.2 : 0.45);
      if(frame){
        halo.position.y+=(frame.height-.5)*(kind==='beam'?.18:1.1);
        halo.scale.setScalar(.72+.28*frame.energy);
        glow.color.copy(frame.color);
        metal.emissive.copy(frame.color);
        metal.emissiveIntensity=.12+.48*frame.energy;
      }
      for (let i = 0; i < dust.count; i++) {
        const f = (age * (kind === 'water' ? 0.72 : 0.38) + i * 0.618) % 1,
          angle = i * 2.4 + age * (kind === 'void' ? 1.65 : 0.4);
        const r = kind === 'void' ? (1 - f) * 1.9 : 0.18 + f * (kind === 'water' ? 0.8 : 1.45);
        const h =
          kind === 'water'
            ? 0.16 + 4 * f * (1 - f) * 2.2
            : kind === 'void'
              ? 1.65 + 0.54 * Math.sin(i + f * 4)
              : f * 3.5;
        pose.position.set(Math.cos(angle) * r, h, Math.sin(angle) * r);
        pose.rotation.set(i + age, angle, age * 0.5);
        const k = 0.028 + 0.035 * Math.sin(f * Math.PI);
        pose.scale.set(k, k * (kind === 'water' ? 2.8 : 1.45), k);
        pose.updateMatrix();
        dust.setMatrixAt(i, pose.matrix);
      }
      dust.instanceMatrix.needsUpdate = true;
      glow.opacity = fade * (frame ? .25+.75*frame.energy : .82+.12*Math.cos(progress*20));
      return true;
    },
  };
}
