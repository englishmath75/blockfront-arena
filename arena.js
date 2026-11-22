import siteMasks from './site-masks.json' with { type: 'json' };
import maps from './maps.json' with { type: 'json' };
export const MAPS = maps;
export let SIZE, CELL, HALF, MAP_NAME, SITES;
export let areas;
let grid, spawns;
const spawnCache = new Map();
export const center = (n) => (n + 0.5) * CELL - HALF;
export const cell = (n) => Math.floor((n + HALF) / CELL);
export const open = (x, z) => grid[z]?.[x] === '.';
export const isCover = (x, z) => grid[z]?.[x] === 'c';
const neighbors = (x, z) => [
  [x + 1, z],
  [x - 1, z],
  [x, z + 1],
  [x, z - 1],
];
function connectedFloor(rows) {
  const visited = new Set();
  let largest = [];
  for (let z = 0; z < SIZE; z++)
    for (let x = 0; x < SIZE; x++) {
      const start = z * SIZE + x;
      if (rows[z][x] !== '.' || visited.has(start)) continue;
      const queue = [start];
      visited.add(start);
      for (let i = 0; i < queue.length; i++)
        for (const [a, b] of neighbors(queue[i] % SIZE, Math.floor(queue[i] / SIZE))) {
          const n = b * SIZE + a;
          if (rows[b]?.[a] === '.' && !visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      if (queue.length > largest.length) largest = queue;
    }
  const keep = new Set(largest);
  return rows.map((row, z) =>
    Array.from(row, (c, x) => (c === '.' && !keep.has(z * SIZE + x) ? '#' : c)).join(''),
  );
}
function nearest(x, z) {
  let best = [0, 0],
    dist = Infinity;
  for (let b = 0; b < SIZE; b++)
    for (let a = 0; a < SIZE; a++)
      if (open(a, b)) {
        const d = (x - a) ** 2 + (z - b) ** 2;
        if (d < dist) {
          dist = d;
          best = [center(a), center(b)];
        }
      }
  return best;
}
export function setArena(name) {
  spawnCache.clear();
  MAP_NAME = name;
  const map = maps.find((m) => m.name === name);
  SIZE = map?.rows.length ?? 40;
  CELL = map?.cell ?? 1.5;
  HALF = (SIZE * CELL) / 2;
  const rangeRows = () =>
    Array.from({ length: SIZE }, (_, z) =>
      Array.from({ length: SIZE }, (_, x) =>
        x < 4 || x > 35 || z < 3 || z > 36 ? '#' : (x === 5 || x === 34) && z % 8 === 0 ? 'c' : '.',
      ).join(''),
    );
  grid = connectedFloor(map?.rows ?? rangeRows());
  areas = (map?.nodes ?? []).map((n) => {
    const [x, z] = Number.isFinite(n.wx) ? [n.wx, n.wz] : nearest(n.x, n.z);
    return { ...n, x, z };
  });
  SITES = areas
    .filter((n) => ['지점', '스파이크 지점'].includes(n.name) && /^[ABC]$/.test(n.sector))
    .map((n) => {
      const mask = siteMasks[map.slug].find((v) => v.id === n.sector);
      const [cx, cz] = mask.center;
      const extent = CELL * SIZE;
      let x = ((cx + 0.5) / mask.w - 0.5) * extent,
        z = ((cz + 0.5) / mask.h - 0.5) * extent;
      if (!open(cell(x), cell(z))) {
        let best = Infinity;
        for (const [iz, row] of Object.entries(mask.rows))
          for (let i = 0; i < row.length; i += 2)
            for (let ix = row[i]; ix <= row[i + 1]; ix += 2) {
              const dx = ((ix + 0.5) / mask.w - 0.5) * extent,
                dz = ((+iz + 0.5) / mask.h - 0.5) * extent,
                dist = (ix - cx) ** 2 + (+iz - cz) ** 2;
              if (dist < best && open(cell(dx), cell(dz))) {
                x = dx;
                z = dz;
                best = dist;
              }
            }
      }
      return { id: n.sector, x, z, mask, groundY: n.groundY };
    });
  spawns = ['공격팀 진영', '수비팀 진영'].map(
    (s, i) => areas.find((n) => n.sector === s && n.name === '시작 지점') ?? { x: 0, z: i ? -15 : 15 },
  );
}
export function sidePosition(attack, i) {
  const spawn = spawns[attack ? 0 : 1];
  const key = attack + ':' + i;
  if (!spawnCache.has(key))
    spawnCache.set(key, nearest(cell(spawn.x) + (i % 3) - 1, cell(spawn.z) + Math.floor(i / 3)));
  return spawnCache.get(key);
}
export function siteAt(x, z, y) {
  return SITES.find((s) => {
    const ix = Math.floor((x / (CELL * SIZE) + 0.5) * s.mask.w),
      iz = Math.floor((z / (CELL * SIZE) + 0.5) * s.mask.h),
      row = s.mask.rows[iz];
    if (!row || !row.some((left, i) => i % 2 === 0 && ix >= left && ix <= row[i + 1])) return false;
    const delta = y - (s.y ?? s.groundY);
    return y === undefined || (delta >= -1.6 && delta <= (MAP_NAME === '아이스박스' ? 5.5 : 1.6));
  });
}
export function area(x, z) {
  const near = areas.reduce(
    (a, b) => (!a || Math.hypot(x - b.x, z - b.z) < Math.hypot(x - a.x, z - a.z) ? b : a),
    null,
  );
  return near ? near.sector + ' ' + near.name : MAP_NAME;
}
setArena('사격장');
