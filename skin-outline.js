import * as T from 'three';

// Collection images show the muzzle on the left. Rig axes vary between exporters.
export function muzzleAtMinX(root) {
  const muzzle = root.getObjectByName('MuzzlePoint') ?? root.getObjectByName('Muzzle');
  const grip = root.getObjectByName('Trigger') ?? root;
  if (!muzzle) return false;
  const localX = bone => root.worldToLocal(bone.getWorldPosition(new T.Vector3())).x;
  return localX(muzzle) < localX(grip);
}

// Use the inventory art for undocumented meshes. Group the surface by the
// original receiver, magazine and moving bones so the reload can still detach it.
export async function fitSkinOutline(root, url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    point = new T.Vector3();
  const parts = [],
    anchors = new Map(),
    bounds = new T.Box3();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    parts.push(mesh);
    if (/bullet|extra|reddot|shell/i.test(mesh.name)) return;
    const pos = mesh.geometry.attributes.position,
      joints = mesh.geometry.attributes.skinIndex;
    const weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < pos.count; i += 2) {
      point.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      bounds.expandByPoint(point);
      let anchor = mesh.parent;
      if (joints && weights && mesh.skeleton) {
        let dominant = 0;
        for (let j = 1; j < 4; j++)
          if (weights.getComponent(i, j) > weights.getComponent(i, dominant)) dominant = j;
        anchor = mesh.skeleton.bones[joints.getComponent(i, dominant)] ?? anchor;
      }
      if (!anchors.has(anchor)) anchors.set(anchor, []);
      anchors.get(anchor).push([point.x, point.y]);
    }
  });
  if (bounds.isEmpty()) return;
  const w = 160,
    h = Math.max(4, Math.min(160, Math.round((w * image.height) / image.width)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const pix = ctx.getImageData(0, 0, w, h).data,
    solid = (x, y) => x >= 0 && x < w && y >= 0 && y < h && pix[4 * (x + y * w) + 3] > 105;
  let x0 = w,
    y0 = h,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (solid(x, y)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x0 > x1) return;
  const size = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3());
  const forward = muzzleAtMinX(root);
  const fromArt = distance => forward ? bounds.min.x + distance : bounds.max.x - distance;
  const unit = size.x / (x1 + 1 - x0),
    yCenter = (y0 + y1 + 1) / 2,
    depth = Math.max(0.001, Math.min(size.z, size.x * 0.1)) * 0.47;
  const groups = [...anchors].map(([bone, samples]) => ({
    bone,
    samples,
    vertices: [],
    uv: [],
    transform: bone.matrixWorld.clone().invert().multiply(root.matrixWorld),
  }));
  const gx = 32,
    gy = 12,
    nearest = [];
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const ax = fromArt((size.x * (i + 0.5)) / gx),
        ay = center.y + (yCenter - y0 - ((y1 + 1 - y0) * (j + 0.5)) / gy) * unit;
      let best = Infinity,
        group = groups[0];
      for (const g of groups)
        for (const [x, y] of g.samples) {
          const d = (x - ax) ** 2 + (y - ay) ** 2;
          if (d < best) {
            best = d;
            group = g;
          }
        }
      nearest.push(group);
    }
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!solid(x, y)) continue;
      const part =
        nearest[
          Math.min(gx - 1, Math.floor(((x + 0.5 - x0) * gx) / (x1 + 1 - x0))) +
            gx * Math.min(gy - 1, Math.floor(((y + 0.5 - y0) * gy) / (y1 + 1 - y0)))
        ];
      function vertex(dx, dy, side) {
        point
          .set(
            fromArt((x + dx - x0) * unit),
            center.y + (yCenter - y - dy) * unit,
            center.z + side * depth,
          )
          .applyMatrix4(part.transform);
        part.vertices.push(point.x, point.y, point.z);
        part.uv.push(
          (x + Math.max(0.02, Math.min(0.98, dx))) / w,
          (y + Math.max(0.02, Math.min(0.98, dy))) / h,
        );
      }
      function quad(a, b, c, d) {
        for (const v of (forward ? [a,c,b,a,d,c] : [a,b,c,a,c,d])) vertex(...v);
      }
      const a = [0, 0, 1],
        b = [1, 0, 1],
        c = [1, 1, 1],
        d = [0, 1, 1],
        e = [0, 0, -1],
        f = [1, 0, -1],
        g = [1, 1, -1],
        k = [0, 1, -1];
      quad(a, b, c, d);
      quad(e, k, g, f);
      if (!solid(x - 1, y)) quad(a, d, k, e);
      if (!solid(x + 1, y)) quad(b, f, g, c);
      if (!solid(x, y - 1)) quad(a, e, f, b);
      if (!solid(x, y + 1)) quad(d, c, g, k);
    }
  const map = new T.Texture(image);
  map.flipY = false;
  map.colorSpace = T.SRGBColorSpace;
  map.needsUpdate = true;
  const material = new T.MeshStandardMaterial({
    map,
    side: T.DoubleSide,
    roughness: 0.45,
    metalness: 0.12,
    alphaTest: 0.15,
  });
  // Hide only the original draw calls; bones can remain children of these meshes.
  for (const p of parts) p.material = new T.MeshBasicMaterial({ visible: false });
  for (const g of groups)
    if (g.vertices.length) {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(g.vertices, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(g.uv, 2));
      geo.computeVertexNormals();
      g.bone.add(new T.Mesh(geo, material));
    }
  return () => {
    for (const g of groups)
      for (const child of g.bone.children) if (child.material === material) child.geometry.dispose();
    map.dispose();
    material.dispose();
    for (const p of parts) p.material.dispose();
  };
}
