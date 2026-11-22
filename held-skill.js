import * as T from 'three';
import { arrowNames, tabletNames } from './utility.js';
const cube = new T.BoxGeometry(1, 1, 1);
const orbNames = ['회복 구슬', '둔화 구슬', '장벽 구슬', '어둠의 장막', '해만', '뜨거운 손', '커브볼'];
export function heldSkill(camera) {
  const group = new T.Group();
  camera.add(group);
  group.position.set(0.25, -0.24, -0.55);
  const glove = new T.MeshLambertMaterial({ color: '#405758' }),
    silver = new T.MeshLambertMaterial({ color: '#a1b9bc' }),
    dark = new T.MeshLambertMaterial({ color: '#273d48' }),
    light = new T.MeshBasicMaterial({ color: '#7ce8ff' }),
    tint = new T.MeshLambertMaterial({ color: '#5ab3ad' });
  const part = (parent, mat, x, y, z, w, h, d) => {
    const b = new T.Mesh(cube, mat);
    b.position.set(x, y, z);
    b.scale.set(w, h, d);
    parent.add(b);
    return b;
  };
  const hand = part(group, glove, 0, -0.08, 0.1, 0.12, 0.13, 0.17);
  part(group, dark, 0, -0.15, 0.18, 0.13, 0.13, 0.17);
  const bow = new T.Group();
  group.add(bow);
  for (const sign of [-1, 1]) {
    part(bow, silver, -0.04, sign * 0.11, -0.12, 0.038, 0.15, 0.046);
    part(bow, dark, -0.04, sign * 0.22, -0.07, 0.044, 0.12, 0.055).rotation.x = sign * 0.5;
    part(bow, light, -0.04, sign * 0.27, -0.04, 0.028, 0.065, 0.032);
  }
  const strings = [-1, 1].map(() => part(bow, silver, -0.04, 0, 0, 0.005, 0.25, 0.005));
  const shaft = part(bow, light, -0.045, 0, -0.21, 0.014, 0.014, 0.47);
  const orb = new T.Group();
  group.add(orb);
  part(orb, tint, 0, 0.035, -0.05, 0.115, 0.15, 0.115);
  part(orb, tint, 0, 0.035, -0.05, 0.15, 0.11, 0.13);
  part(orb, light, -0.025, 0.07, -0.12, 0.055, 0.026, 0.012);
  const device = new T.Group();
  group.add(device);
  part(device, dark, 0, 0.01, -0.055, 0.13, 0.15, 0.13);
  part(device, tint, 0, 0.095, -0.055, 0.105, 0.05, 0.09);
  part(device, light, 0, 0.035, -0.128, 0.08, 0.025, 0.01);
  const tablet = new T.Group();
  group.add(tablet);
  part(tablet, dark, -0.08, 0.07, -0.03, 0.34, 0.23, 0.045);
  part(tablet, tint, -0.08, 0.07, 0, 0.3, 0.185, 0.012);
  return function draw(name, charge, now) {
    group.visible = !!name;
    if (!name) return;
    bow.visible = arrowNames.includes(name) || name === '사냥꾼의 분노';
    orb.visible = orbNames.includes(name);
    tablet.visible = tabletNames.includes(name);
    device.visible = !bow.visible && !orb.visible && !tablet.visible;
    group.rotation.z = bow.visible ? -0.25 : 0;
    hand.position.y = orb.visible ? -0.055 : -0.08;
    const color =
      name === '충격 화살'
        ? '#35b7ff'
        : name === '어둠의 장막'
          ? '#8e70cf'
          : name === '커브볼' || name === '뜨거운 손'
            ? '#ff9d56'
            : name === '장벽 구슬' || name === '회복 구슬'
              ? '#61e6bf'
              : '#84cde0';
    light.color.set(color);
    tint.color.set(color).multiplyScalar(0.75);
    orb.position.y = Math.sin(now * 3) * 0.008;
    orb.rotation.y = now * 0.8;
    if (bow.visible) {
      const pull = 0.05 + charge * 0.18;
      shaft.position.z = -0.21 + pull;
      for (let i = 0; i < 2; i++) {
        const sign = i ? 1 : -1;
        strings[i].position.set(-0.04, sign * 0.135, pull / 2 - 0.04);
        strings[i].scale.y = Math.hypot(0.27, pull);
        strings[i].rotation.x = -sign * Math.atan2(pull, 0.27);
      }
    }
  };
}
