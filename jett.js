import * as T from 'three';

const palette = {
  hair: '#dbedf0',
  shade: '#aac4d1',
  skin: '#edc3aa',
  shadow: '#cf9989',
  eye: '#294250',
  iris: '#76909a',
  jacket: '#416b8d',
  bright: '#5494aa',
  seam: '#85cbd1',
  dark: '#263447',
  belt: '#19283a',
  metal: '#aebdc0',
  white: '#e5f6f0',
  blade: '#91ece6',
};
const cube = new T.BoxGeometry(1, 1, 1);
const materials = Object.fromEntries(
  Object.entries(palette).map(([k, color]) => [k, new T.MeshLambertMaterial({ color })]),
);
// Dimensions use a 32-pixel-high character, facing local -Z.
export function jettModel(posed = false) {
  const root = new T.Group();
  const part = (parent, color, x, y, z, w, h, d) => {
    const m = new T.Mesh(cube, materials[color]);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    parent.add(m);
    return m;
  };
  const joint = (parent, x, y, z) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const body = joint(root, 0, 14, 0);
  part(body, 'dark', 0, 5, 0, 8, 10, 5);
  part(body, 'bright', -2.5, 6.5, -0.1, 3, 8, 5.5);
  part(body, 'jacket', 2.1, 6.2, 0, 3.6, 8.2, 5.5);
  part(body, 'seam', -1.45, 5.6, -2.95, 0.55, 6, 0.35);
  part(body, 'white', 2, 7.2, -2.85, 1.7, 0.55, 0.3);
  part(body, 'dark', 0, 10.5, 0, 7, 2, 5.8);
  part(body, 'belt', 0, 1, 0, 8.6, 2, 5.6);
  part(body, 'metal', 0, 1, -2.96, 2, 1.1, 0.35);
  for (const x of [-3.3, 2.6]) part(body, 'jacket', x, 0.6, 1.4, 1.9, 2.6, 3.3);
  const head = joint(body, 0, 11.7, 0);
  part(head, 'skin', 0, 3, 0, 7, 6.8, 6.3);
  part(head, 'hair', 0, 6.1, 0.1, 7.7, 2.5, 7);
  part(head, 'shade', 0, 3.4, 2.9, 7.5, 4, 1.55);
  part(head, 'hair', -2.15, 5.3, -3.1, 3.6, 2.3, 1.3);
  part(head, 'hair', -3.25, 4.2, -3, 1.55, 2, 1.35);
  part(head, 'shade', 3.45, 4.7, -2, 1.2, 2.8, 2.25);
  part(head, 'hair', -0.7, 7.7, 1.4, 4.3, 2.2, 4.6);
  part(head, 'shade', -0.7, 7.7, 3.6, 3.2, 2, 2.4);
  part(head, 'hair', -0.3, 9.1, 3.2, 3, 1.4, 3.1);
  for (const x of [-1.85, 1.9]) {
    part(head, 'white', x, 3.2, -3.22, 1.5, 0.72, 0.18);
    part(head, 'eye', x + 0.15, 3.28, -3.33, 0.7, 0.77, 0.18);
    part(head, 'shade', x, 4.1, -3.24, 1.6, 0.33, 0.25);
  }
  part(head, 'shadow', 0.15, 1.45, -3.21, 1.1, 0.25, 0.2);
  for (const sign of [-1, 1]) {
    const leg = joint(root, sign * 2.12, 14, 0);
    part(leg, 'dark', 0, -4.3, 0, 3.9, 8.5, 4.3);
    part(leg, 'jacket', 0, -7.2, -1.9, 3.4, 3.1, 1.1);
    part(leg, 'belt', 0, -10.3, 0, 3.4, 6.4, 4);
    part(leg, 'dark', 0, -12.7, -0.5, 3.9, 2.7, 5.5);
    part(leg, 'metal', 0, -12.0, -2.45, 2.3, 0.45, 0.5);
    const arm = joint(body, sign * 5, 9.3, 0.1);
    part(arm, 'skin', 0, -2.7, 0, 2.6, 5, 3);
    part(arm, 'jacket', 0, -0.45, 0, 3.25, 2, 3.6);
    const elbow = joint(arm, 0, -5.2, 0);
    part(elbow, 'dark', 0, -2.3, -0.1, 2.45, 4.8, 2.85);
    part(elbow, 'seam', 0, -1, -0.1, 2.6, 0.55, 2.95);
    part(elbow, 'skin', 0, -4.9, -0.15, 2.3, 1.1, 2.6);
    if (posed) {
      arm.rotation.z = sign * 0.23;
      arm.rotation.x = sign === 1 ? -0.68 : -0.22;
      elbow.rotation.x = sign === 1 ? -1.18 : -0.18;
      leg.rotation.x = sign * 0.16;
      leg.rotation.z = sign * 0.085;
    }
    if (posed && sign === 1) {
      part(elbow, 'metal', 0, -4.8, -2.3, 0.85, 0.85, 3.8);
      part(elbow, 'blade', 0, -4.8, -4.9, 1.08, 0.52, 3.6);
      part(elbow, 'white', 0, -4.8, -7, 0.48, 0.3, 1.1);
    }
  }
  if (posed) {
    body.rotation.y = -0.16;
    head.rotation.y = 0.31;
  }
  root.scale.setScalar(0.051);
  return root;
}
