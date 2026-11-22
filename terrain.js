import {unpack} from './compressed.js';
import { MAP_NAME, MAPS, CELL, HALF, SIZE, open, isCover, center, cell, areas } from './arena.js';

import {readScene} from './scenery.js';
import {TextureLoader} from 'three';
let loaded;
export async function loadTerrain(name) {
  const map = MAPS.find((m) => m.name === name);
  if (!map) return null;
  if (loaded?.name === name) return loaded.data;
  async function read(ext) {
    const response = await fetch('/terrain/' + map.slug + ext);
    if (!response.ok) throw Error(name + ' 전장 파일을 열 수 없습니다.');
    return ext==='.scene.gz'?readScene(response):ext==='.tri.gz'?unpack(response):response.arrayBuffer();
  }
  const [collision, visual,texture,triangles] = await Promise.all([read('.vxb'), read('.scene.gz'),new TextureLoader().loadAsync('/terrain/'+map.slug+'.webp'),read('.tri.gz')]);
  const data = { collision, visual,texture,triangles };
  loaded = { name, data };
  return data;
}
export const keyOf = (n) => n.sector + ' ' + n.name;
const bucket = 4;
const hash = (x, z) => (z + 256) * 512 + x;
export function volume(x, y, z, w, h, d, kind = 'floor') {
  return { x, y, z, w, h, d, kind };
}
// y is the bottom of each block. All three axes use metres.
export function buildTerrain(data) {
  const boxes = [],
    bins = new Map(),
    landings = new Map();
  function add(b) {
    boxes.push(b);
    for (let z = Math.floor((b.z - b.d / 2) / bucket); z <= Math.floor((b.z + b.d / 2) / bucket); z++)
      for (let x = Math.floor((b.x - b.w / 2) / bucket); x <= Math.floor((b.x + b.w / 2) / bucket); x++) {
        const k = hash(x, z);
        if (!bins.has(k)) bins.set(k, []);
        bins.get(k).push(b);
      }
  }
  const nearby = (x, z) => bins.get(hash(Math.floor(x / bucket), Math.floor(z / bucket))) ?? [];
  const covers = (b, x, z, r = 0) => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r;
  function support(x, z, limit = Infinity, r = 0.015) {
    let y = -Infinity;
    const scan = (list) => {
      for (const b of list)
        if (b.y + b.h <= limit + 0.001 && b.y + b.h > y && covers(b, x, z, r)) y = b.y + b.h;
    };
    scan(nearby(x, z));
    if (
      Math.floor((x - r) / bucket) !== Math.floor((x + r) / bucket) ||
      Math.floor((z - r) / bucket) !== Math.floor((z + r) / bucket)
    )
      for (const dx of [-r, r]) for (const dz of [-r, r]) scan(nearby(x + dx, z + dz));
    return y;
  }
  function ceiling(x, z, feet, head, r = 0.22) {
    let y = Infinity;
    for (const b of nearby(x, z))
      if (b.y >= feet - 0.005 && b.y < head && covers(b, x, z, r)) y = Math.min(y, b.y);
    return y;
  }
  function blocked(x, z, y, r = 0.28, h = 1.67) {
    // Probe adjacent bins as the capsule may straddle their boundary.
    for (const dx of [-r, r])
      for (const dz of [-r, r])
        for (const b of nearby(x + dx, z + dz)) {
          if (b.y + b.h > y + 0.01 && b.y < y + h - 0.01 && covers(b, x, z, r)) return true;
        }
    return false;
  }
  function spawn(x, z, hint) {
    let best,
      score = Infinity;
    for (let d = 0; d <= 12; d += 0.5) {
      for (let dx = -d; dx <= d; dx += 0.5)
        for (let dz = -d; dz <= d; dz += 0.5) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
          const xx = x + dx,
            zz = z + dz;
          for (const b of nearby(xx, zz)) {
            const y = b.y + b.h;
            if (!covers(b, xx, zz) || blocked(xx, zz, y, 0.32, 1.67)) continue;
            const cost = Math.abs(y - hint) * 1.3 + Math.hypot(dx, dz);
            if (cost < score) {
              score = cost;
              best = { x: xx, y, z: zz };
            }
          }
        }
      if (score < d + 0.5) break;
    }
    return best ?? { x, y: hint, z };
  }
  function rayBoxes(origin, dir, distance, visit) {
    // Traverse the 2D spatial index in exact ray order. Include vertical rays.
    let x = Math.floor(origin.x / bucket),
      z = Math.floor(origin.z / bucket);
    const sx = Math.sign(dir.x),
      sz = Math.sign(dir.z),
      tx = sx ? bucket / Math.abs(dir.x) : Infinity,
      tz = sz ? bucket / Math.abs(dir.z) : Infinity;
    let nx = sx ? ((x + (sx > 0 ? 1 : 0)) * bucket - origin.x) / dir.x : Infinity,
      nz = sz ? ((z + (sz > 0 ? 1 : 0)) * bucket - origin.z) / dir.z : Infinity;
    for (let i = 0; i < 256; i++) {
      for (const b of bins.get(hash(x, z)) ?? []) distance = Math.min(distance, visit(b));
      if (Math.min(nx, nz) > distance || (!sx && !sz)) break;
      if (nx < nz) {
        x += sx;
        nx += tx;
      } else {
        z += sz;
        nz += tz;
      }
    }
    return distance;
  }
  if (data) {
    const bytes = new DataView(data);
    if (bytes.byteLength < 12 || (bytes.byteLength - 12) % 14 || bytes.getUint32(0) !== 0x56584231)
      throw Error('전장 데이터 형식이 올바르지 않습니다.');
    const half = bytes.getFloat32(4, true),
      base = bytes.getFloat32(8, true),
      runs = new Uint16Array(data, 12);
    const kinds = ['', 'floor', 'wall', 'roof', 'timber', 'steel', 'leaf'];
    for (let i = 0; i < runs.length; i += 7) {
      const [x, y, z, w, h, d, tag] = runs.subarray(i, i + 7);
      add(
        volume(
          (x + w / 2) * 0.5 - half,
          base + y * 0.25,
          (z + d / 2) * 0.5 - half,
          w * 0.5,
          h * 0.25,
          d * 0.5,
          kinds[tag],
        ),
      );
    }
    for (const n of areas) landings.set(keyOf(n), spawn(n.x, n.z, n.groundY ?? n.y));
  } else {
    for (let z = 0; z < SIZE; z++)
      for (let x = 0; x < SIZE; x++) {
        if (open(x, z)) {
          add(volume(center(x), -1, center(z), CELL, 1, CELL));
          continue;
        }
        if (
          [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ].some(([a, b]) => open(x + a, z + b))
        )
          add(volume(center(x), -1, center(z), CELL, isCover(x, z) ? 3.15 : 5.45, CELL, 'wall'));
      }
  }
  return { boxes, landings, nearby, support, ceiling, blocked, spawn, rayBoxes };
}
