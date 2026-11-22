import * as T from 'three';
import mirrored from './mirrored-chromas.json' with { type: 'json' };
import { buildVandalTrim } from './skin-trim.js';

export function muzzleAtMinX(root) {
  const muzzle = root.getObjectByName('Muzzle') ?? root.getObjectByName('MuzzlePoint');
  if (!muzzle) return true;
  const grip = root.getObjectByName('Trigger') ?? root;
  const localX = (bone) => root.worldToLocal(bone.getWorldPosition(new T.Vector3())).x;
  return localX(muzzle) < localX(grip);
}

const sections = new Map();
async function readSections(url) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  const w = (canvas.width = 128),
    h = (canvas.height = Math.max(4, Math.round((w * image.height) / image.width)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;
  let left = w,
    right = 0,
    top = h,
    bottom = 0;
  const columns = Array.from({ length: w }, (_, x) => {
    const strips = [];
    for (let y = 0; y < h; y++) {
      if (pixels[(x + y * w) * 4 + 3] < 110) continue;
      const start = y;
      while (y + 1 < h && pixels[(x + (y + 1) * w) * 4 + 3] >= 110) y++;
      strips.push([start, y + 1]);
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
      top = Math.min(top, start);
      bottom = Math.max(bottom, y + 1);
    }
    return strips;
  });
  return { image, columns, w, h, left, right, top, bottom };
}
function sectionData(url) {
  if (!sections.has(url)) {
    const task = readSections(url).catch((error) => {
      sections.delete(url);
      throw error;
    });
    sections.set(url, task);
    if (sections.size > 18) sections.delete(sections.keys().next().value);
  }
  return sections.get(url);
}

// Walk one column into the next. At a fork (e.g. a trigger guard) terminate
// the solid with a cap. The opening and the individual components stay hollow.
function joined(strip, neighbors) {
  if (!neighbors) return;
  const hits = neighbors.filter((s) => Math.min(s[1], strip[1]) > Math.max(s[0], strip[0]));
  if (
    hits.length === 1 &&
    Math.abs(hits[0][0] - strip[0]) + Math.abs(hits[0][1] - strip[1]) <
      Math.max(3, (strip[1] - strip[0]) * 0.72)
  )
    return hits[0];
}
const sides = 12;
const circle = Array.from({ length: sides }, (_, i) => {
  const t = (i * Math.PI * 2) / sides;
  const rounded = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.72);
  return [rounded(Math.cos(t)), rounded(Math.sin(t))];
});

export async function fitSkinOutline(root, url, skin) {
  const art = await sectionData(url);
  if (art.left >= art.right) throw Error('비어 있는 스킨 외형');
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    bounds = new T.Box3(),
    point = new T.Vector3();
  const parts = [],
    samples = [],
    groups = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    parts.push(mesh);
    for (let p = mesh; p && p !== root; p = p.parent) if (/bullet|extra|red.?dot|shell/i.test(p.name)) return;
    const pos = mesh.geometry.attributes.position,
      joints = mesh.geometry.attributes.skinIndex,
      weights = mesh.geometry.attributes.skinWeight;
    const local = new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 1800))) {
      point.fromBufferAttribute(pos, i).applyMatrix4(local);
      bounds.expandByPoint(point);
      let bone = mesh.parent;
      if (joints && weights && mesh.skeleton) {
        let j = 0;
        for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, j)) j = k;
        bone = mesh.skeleton.bones[joints.getComponent(i, j)] ?? bone;
      }
      samples.push({ bone, x: point.x, y: point.y, z: point.z });
    }
  });
  if (bounds.isEmpty()) throw Error('스킨 기준 모델을 읽을 수 없습니다.');
  const size = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3());
  const forward = muzzleAtMinX(root) !== mirrored.includes(skin?.variant);
  const unit = size.x / (art.right - art.left);
  const worldX = (x) =>
    forward ? bounds.min.x + (x - art.left) * unit : bounds.max.x - (x - art.left) * unit;
  const worldY = (y) => center.y + ((art.top + art.bottom) * 0.5 - y) * unit;
  // Voronoi assignment in rig space is computed once per small grid cell.
  const nearest = new Map();
  function attachment(x, y) {
    const key = Math.floor(x / 4) + Math.floor(y / 3) * 64;
    if (nearest.has(key)) return nearest.get(key);
    const px = worldX(Math.floor(x / 4) * 4 + 2),
      py = worldY(Math.floor(y / 3) * 3 + 1.5);
    let best = Infinity,
      found = samples[0];
    for (const s of samples) {
      const d = (s.x - px) ** 2 + (s.y - py) ** 2;
      if (d < best) {
        best = d;
        found = s;
      }
    }
    nearest.set(key, found.bone);
    return found.bone;
  }
  const animatedPlates =
    skin?.motionOn &&
    ['singularityep9', 'araxys', 'rogue', 'champions2023', 'reaver', 'elderflame'].includes(skin.banner);
  function groupFor(bone, section) {
    const key = bone.uuid + '/' + section;
    if (!groups.has(key))
      groups.set(key, {
        bone,
        section,
        positions: [],
        uv: [],
        index: [],
        transform: bone.matrixWorld.clone().invert().multiply(root.matrixWorld),
      });
    return groups.get(key);
  }
  function stripGroup(x, strip) {
    const mid = (strip[0] + strip[1]) * 0.5,
      normalized = (x + 0.5 - art.left) / (art.right - art.left);
    const section =
      animatedPlates && mid < art.top + (art.bottom - art.top) * 0.48 && normalized < 0.84
        ? Math.floor(normalized * 4) + 1
        : 0;
    return groupFor(attachment(x, mid), section);
  }
  for (let x = art.left; x < art.right; x++)
    for (const strip of art.columns[x]) {
      const group = stripGroup(x, strip),
        start = group.positions.length / 3,
        cap = [];
      for (let edge = 0; edge <= 1; edge++) {
        const nextX = x + (edge ? 1 : -1),
          adjacent = joined(strip, art.columns[nextX]);
        cap.push(!adjacent || stripGroup(nextX, adjacent) !== group);
        const neighbor = adjacent ?? strip;
        const upper = (neighbor[0] + strip[0]) * 0.5,
          lower = (neighbor[1] + strip[1]) * 0.5;
        const cy = (upper + lower) * 0.5,
          ry = (lower - upper) * 0.5;
        const rz = Math.max(unit * 0.4, Math.min(size.z * 0.5, unit * ry * 0.84, size.x * 0.047));
        for (const [vertical, lateral] of circle) {
          const py = cy - vertical * ry;
          point.set(worldX(x + edge), worldY(py), center.z + lateral * rz).applyMatrix4(group.transform);
          group.positions.push(point.x, point.y, point.z);
          group.uv.push((x + edge) / art.w, Math.max(strip[0] + 0.28, Math.min(strip[1] - 0.28, py)) / art.h);
        }
      }
      const tri = (a, b, c) => {
        if (forward) group.index.push(start + a, start + b, start + c);
        else group.index.push(start + a, start + c, start + b);
      };
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        tri(i, j, sides + i);
        tri(j, sides + j, sides + i);
        if (i > 0 && i < sides - 1) {
          if (cap[0]) tri(0, j, i);
          if (cap[1]) tri(sides, sides + i, sides + j);
        }
      }
    }
  const map = new T.Texture(art.image);
  map.flipY = false;
  map.colorSpace = T.SRGBColorSpace;
  map.needsUpdate = true;
  const material = new T.MeshStandardMaterial({ map, roughness: 0.48, metalness: 0.17, side: T.DoubleSide });
  const invisible = new T.MeshBasicMaterial({ visible: false }),
    meshes = [];
  const loadedMag=root.getObjectByName('Magazine_Main')??root.getObjectByName('Magazine');
  const reserveSocket=root.getObjectByName('Magazine_Extra');
  const spare=new T.Group();
  spare.visible=false;
  for (const part of parts) part.material = invisible;
  for (const g of groups.values()) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(g.positions, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(g.uv, 2));
    geo.setIndex(g.index);
    geo.computeVertexNormals();
    const mesh = new T.Mesh(geo, material);
    mesh.userData.plate = g.section;
    if (g.section) {
      const toLocal = new T.Matrix3().setFromMatrix4(g.transform);
      mesh.userData.recoilAxis = new T.Vector3((forward ? 1 : -1) * (g.section - 2.3), 1.3, 0).applyMatrix3(
        toLocal,
      );
    }
    g.bone.add(mesh);
    meshes.push(mesh);
    if(loadedMag && reserveSocket){
      for(let p=g.bone;p;p=p.parent)if(p===loadedMag){
        const copy=new T.Mesh(geo,material);
        copy.applyMatrix4(loadedMag.matrixWorld.clone().invert().multiply(g.bone.matrixWorld));
        spare.add(copy);break;
      }
    }
  }
  if(spare.children.length){reserveSocket.add(spare);root.userData.spareMagazine=spare;}
  const mount = attachment(art.left + (art.right - art.left) * 0.52, art.top + (art.bottom - art.top) * 0.15);
  const releaseTrim =
    skin &&
    buildVandalTrim(root, mount, skin, bounds, forward, (art.bottom - art.top) / (art.right - art.left));
  return () => {
    spare.removeFromParent();
    releaseTrim?.();
    for (const mesh of meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    map.dispose();
    material.dispose();
    invisible.dispose();
  };
}
