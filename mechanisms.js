import { MAP_NAME, areas, open, cell, CELL } from './arena.js';
import { keyOf } from './terrain.js';

const sites = {
  어센트: [
    ['gate', 'A 나무'],
    ['gate', '중앙 시장'],
  ],
  바인드: [
    ['portal', 'A 순간이동기', 'B 출구'],
    ['portal', 'B 순간이동기', 'A 출구'],
    ['exit', 'A 출구', 'A 로비'],
    ['exit', 'B 출구', 'B 짧은 길'],
  ],
  스플릿: [
    ['rope', '중앙 환기구', [-11.29, -7.39]],
    ['rope', '중앙 환기구', [-8.55, -7.38]],
    ['rope', '중앙 환기구', [-18.23, -10.59]],
    ['rope', '중앙 환기구', [-15.56, -10.58]],
    ['rope', 'A 하수도', [12.37, -35.43]],
    ['rope', 'A 하수도', [15.34, -35.43]],
    ['rope', 'B 탑'],
  ],
  아이스박스: [
    ['rope', 'A 서까래'],
    ['rope', 'A 서까래', [30.26, 46.39]],
    ['rope', 'A 망대', [3.26, 33.91]],
    ['rope', 'B 스파이크 지점'],
    ['wire', 'A 망대', 'A 스파이크 지점'],
  ],
  브리즈: [
    ['rope', 'A 다리'],
    ['auto', '중앙 복도'],
  ],
  프랙처: [
    ['cross', '공격팀 진영 시작 지점', '공격팀 진영 다리'],
    ['cross', '공격팀 진영 다리', '공격팀 진영 시작 지점'],
    ['rope', 'A 밧줄'],
    ['rope', 'B 탑'],
    ['auto', 'A 문'],
  ],
  로터스: [
    ['rotor', 'A 문'],
    ['rotor', 'C 문'],
    ['panel', 'A 연결부', 400],
    ['rope', 'A 상단부'],
  ],
  선셋: [['gate', 'B 시장']],
  헤이븐: [
    ['panel', '중앙 문', 400],
    ['panel', '중앙 문', 400],
  ],
  어비스: [
    ['rope', '중앙 통로'],
    ['rope', 'A 환기구'],
    ['panel', 'A 환기구', 120],
    ['panel', '중앙 도서관', 120],
  ],
  서밋: [
    ['drop', 'A 정원'],
    ['drop', '중앙 하단부'],
    ['drop', 'B 지점'],
    ['rope', 'B 탑'],
  ],
};
// Mounts, cable spans and switch housings measured in the source art (metres).
const mounts = {
  스플릿: { '중앙 환기구': [-10.1, -7.4], 'B 탑': [-10.2, 27.8] },
  로터스: { 'A 상단부': [43.1, -29.4] },
  서밋: { 'B 탑': [-39, -36.1] },
  프랙처: { 'A 밧줄': [14.8, 17.5], 'B 탑': [-44.4, -16.7] },
  브리즈: { 'A 다리': [21, 20.1] },
  아이스박스: { 'A 서까래': [30.3, 33.3], 'B 스파이크 지점': [13.5, -42.2] },
};
const switches = {
  'A 정원': { x: 32.6, y: 5.2, z: -23.1 },
  '중앙 하단부': { x: 3.7, y: 5, z: -8.9 },
  'B 지점': { x: -43.3, y: 5.3, z: -33.1 },
};
// Opening centres are measured from each named frame, turntable or vent header in the scene.
const anchors = {
  어센트: { 'A 나무': [-15.16, -38.22, 4, 3.5, 4, 0], '중앙 시장': [-30.66, 14.58, 3, 4.05, 3.5, 0] },
  선셋: { 'B 시장': [-13.94, -6, 2.01, 3.82, 3.8, 90] },
  로터스: { 'A 문': [45.78, 2.56, 3.03, 6.05, 4.2, 0], 'C 문': [-22.78, 9.98, 1.54, 5.95, 4.2, 90] },
  바인드: {
    'A 순간이동기': [17.65, -15.25, 2, 4.9, 3.72, 90],
    'B 순간이동기': [-60.38, -11.19, 3, 4.9, 3.72, 90],
    'A 출구': [63.45, 2.85, 1.03, 4.25, 3.65, 90],
    'B 출구': [-11.55, -9.74, 5.03, 4.25, 3.65, 90],
  },
  서밋: {
    'A 정원': [40.65, -24.05, 3.05, 6.38, 6.1, 0],
    '중앙 하단부': [-2.35, -19.51, 4.95, 6.38, 6.1, 0],
    'B 지점': [-48.35, -33.99, 4.95, 6.38, 6.1, 0],
  },
  어비스: { 'A 환기구': [-7, -25.29, 12, 2.15, 3, 0], '중앙 도서관': [0, -8.82, 12, 2.15, 3, 0] },
};
export function makeMechanisms(terrain) {
  const result = [];
  const lookup = (s) => areas.find((a) => keyOf(a) === s);
  for (const [type, name, dest] of sites[MAP_NAME] ?? []) {
    const a = lookup(name);
    if (!a) continue;
    const base = terrain.spawn(a.x, a.z, a.groundY ?? a.y);
    const dist = (dx, dz) => {
      let n = 0;
      while (n < 7 && open(cell(a.x) + dx * (n + 1), cell(a.z) + dz * (n + 1))) n++;
      return n;
    };
    const xspan = dist(1, 0) + dist(-1, 0),
      zspan = dist(0, 1) + dist(0, -1);
    const theta = xspan < zspan ? 0 : Math.PI / 2;
    const obj = {
      ...base,
      id: result.length,
      type,
      name,
      theta,
      w: Math.min(6, Math.max(2.4, (Math.min(xspan, zspan) + 1) * CELL)),
      h: 3.1,
      d: 0.4,
      health: type === 'drop' ? 125 : type === 'panel' ? dest : 500,
      progress: 0,
      goal: 0,
      broken: false,
      turns: 0,
    };
    if (type === 'drop') obj.switch = switches[name];
    if (type === 'exit') {
      const towards = lookup(dest);
      if (!towards) continue;
      const v = Math.atan2(towards.z - base.z, towards.x - base.x);
      obj.x += Math.cos(v) * 2.65;
      obj.z += Math.sin(v) * 2.65;
      obj.theta = Math.PI / 2 - v;
      obj.inside = { x: base.x, y: base.y, z: base.z };
      obj.progress = obj.goal = 1;
    }
    if (type === 'portal' || type === 'wire' || type === 'cross') {
      const end = lookup(dest);
      if (!end) continue;
      obj.to = terrain.landings.get(dest) ?? terrain.spawn(end.x, end.z, end.y);
      if (type === 'wire') {
        Object.assign(obj, { x: 4.9, y: 6.6, z: 43.2 });
        obj.to = { x: 28.5, y: 6.6, z: 43.2 };
      }
      if (type === 'cross') {
        const forward = result.length === 0,
          from = forward ? { x: -2.1, z: 35.2 } : { x: 2.9, z: -41.8 },
          to = forward ? { x: -2, z: -40.6 } : { x: 2.9, z: 35.2 };
        Object.assign(obj, terrain.spawn(from.x, from.z, 2.3));
        obj.to = terrain.spawn(to.x, to.z, 2.3);
      }
    }
    if (type === 'rope') {
      const deck = terrain.landings.get(name);
      if (!deck) continue;
      // Run the cable along the open edge, where Space can dismount onto the deck.
      const mount = (Array.isArray(dest) ? dest : null) ?? mounts[MAP_NAME]?.[name] ?? [a.x, a.z];
      let best,
        score = Infinity;
      // Find a clear vertical shaft beside two walkable lips, in the reference geometry.
      for (let dz = -8; dz <= 8; dz += 0.5)
        for (let dx = -8; dx <= 8; dx += 0.5) {
          const x = mount[0] + dx,
            z = mount[1] + dz;
          for (const b of terrain.nearby(x, z)) {
            const y = b.y + b.h;
            if (
              Math.abs(x - b.x) >= b.w / 2 ||
              Math.abs(z - b.z) >= b.d / 2 ||
              terrain.blocked(x, z, y, 0.27, 1.67)
            )
              continue;
            const cap = terrain.ceiling(x, z, y + 1.6, y + 12, 0.28);
            for (const [nx, nz] of [
              [0.85, 0],
              [-0.85, 0],
              [0, 0.85],
              [0, -0.85],
            ]) {
              const ex = x + nx,
                ez = z + nz,
                top = terrain.support(ex, ez, Math.min(y + 9, cap - 1.7));
              if (!Number.isFinite(top) || top < y + 1.8 || terrain.blocked(ex, ez, top, 0.27, 1.67))
                continue;
              const cost = Math.hypot(dx, dz) + Math.abs(top - deck.y) * 0.65;
              if (
                cost < score &&
                !result.some((r) => r.type === 'rope' && Math.hypot(r.x - x, r.z - z) < 0.7)
              ) {
                score = cost;
                best = { x, y, z, to: { x, y: top + 0.05, z }, exit: { x: ex, y: top, z: ez } };
              }
            }
          }
        }
      if (!best) continue;
      Object.assign(obj, best);
    }
    const anchor = anchors[MAP_NAME]?.[name];
    if (anchor && !cable(obj)) {
      const [x, z, y, w, h, angle] = anchor;
      Object.assign(obj, { x, y, z, w, h, theta: (angle * Math.PI) / 180 });
      if (type === 'drop') {
        const floor = terrain.support(x, z, y + 2);
        if (Number.isFinite(floor)) obj.y = floor;
      }
    }
    if (MAP_NAME === '헤이븐' && type === 'panel') {
      const second = result.length > 0;
      Object.assign(obj, {
        x: second ? 5.9 : 7.11,
        z: second ? 18.99 : 16.09,
        y: 1,
        w: 2.68,
        h: 3.92,
        d: 0.09,
        theta: ((second ? 61 : 119) * Math.PI) / 180,
      });
    }
    result.push(obj);
  }
  return result;
}
export const cable = (m) => ['rope', 'wire', 'cross'].includes(m.type);
export function geometry(m) {
  if (cable(m) || m.type === 'portal' || (m.broken && m.type !== 'drop')) return null;
  const raised = ['gate', 'auto', 'exit', 'drop'].includes(m.type) ? (1 - m.progress) * (m.h + 0.15) : 0;
  return { ...m, y: m.y + raised, theta: m.theta + (m.type === 'rotor' ? m.progress * Math.PI : 0) };
}
export function switchPos(m) {
  if (m.switch) return m.switch;
  const length = m.w / 2 + 0.15;
  return {
    x: m.x + Math.cos(m.theta) * length + Math.sin(m.theta) * 0.55,
    y: m.y + 1.15,
    z: m.z - Math.sin(m.theta) * length + Math.cos(m.theta) * 0.55,
  };
}
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y ?? 0) - (b.y ?? 0), a.z - b.z);
export function interactable(ms, p) {
  if (p.ride != null) return ms.find((m) => m.id === p.ride);
  return ms.find((m) => {
    if (m.broken) return false;
    if (cable(m)) return distance(p, m) < 2.15 || (m.type !== 'cross' && distance(p, m.to) < 2.15);
    if (m.type === 'gate' || m.type === 'rotor') return distance({ ...p, y: p.y + 1.1 }, switchPos(m)) < 2.65;
    return false;
  });
}
export function useMechanism(ms, p) {
  const m = interactable(ms, p);
  if (!m) return false;
  if (cable(m)) {
    if (p.ride != null) {
      if (m.type !== 'cross') p.ride = null;
      return true;
    }
    p.ride = m.id;
    p.travel = m.type !== 'cross' && distance(p, m.to) < distance(p, m) ? 1 : 0;
    p.dir = p.travel ? -1 : 1;
    p.vx = p.vy = p.vz = 0;
  } else if (m.type === 'gate') {
    m.goal = 1;
  } else if (m.type === 'rotor' && Math.abs(m.progress - m.goal) < 0.001) {
    m.goal = m.goal + 1;
  }
  return true;
}
export function rideStep(ms, p, keys, dt) {
  if (p.ride == null) return false;
  const m = ms.find((v) => v.id === p.ride);
  if (!m) {
    p.ride = null;
    return false;
  }
  if (m.type !== 'cross' && keys.has('Space')) {
    p.ride = null;
    p.vy = 3.2;
    return false;
  }
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : m.type === 'cross' ? 11 : 5;
  const dir =
    m.type === 'cross' ? 1 : (+keys.has('KeyW') - +keys.has('KeyS')) * (m.type === 'rope' ? 1 : p.dir);
  const advance = (dt * speed * dir) / Math.max(1, distance(m, m.to));
  p.travel = Math.min(1, Math.max(0, p.travel + advance));
  for (const k of ['x', 'y', 'z']) p[k] = m[k] + (m.to[k] - m[k]) * p.travel;
  if ((advance > 0 && p.travel === 1) || (advance < 0 && p.travel === 0)) {
    p.ride = null;
    if (m.exit && p.travel === 1) Object.assign(p, m.exit);
  }
  return true;
}
export function tickMechanisms(ms, players, dt, now, onCrush) {
  for (const m of ms) {
    if (m.type === 'portal') {
      for (const p of players)
        if (
          !p.down &&
          !p.target &&
          !(p.portalUntil > now) &&
          Math.abs(p.y - m.y) < m.h &&
          Math.abs(p.x - m.x) < 0.95 &&
          Math.abs(p.z - m.z) < m.w * 0.45
        ) {
          Object.assign(p, { x: m.to.x, y: m.to.y, z: m.to.z, vx: 0, vy: 0, vz: 0, portalUntil: now + 0.7 });
        }
      continue;
    }
    if (m.type === 'exit') m.goal = players.some((p) => !p.down && distance(m.inside, p) < 2.8) ? 0 : 1;
    if (m.type === 'auto') m.goal = players.some((p) => !p.down && distance(m, p) < 3) ? 0 : 1;
    const step = dt / (m.type === 'rotor' ? 10 : m.type === 'drop' ? 1.4 : 0.9),
      delta = m.goal - m.progress;
    const last = m.progress;
    m.progress += Math.sign(delta) * Math.min(Math.abs(delta), step);
    if (last !== m.progress && m.type === 'drop' && m.progress === 1)
      for (const p of players)
        if (!p.down && inside(geometry(m), p.x, p.z, 0.28) && Math.abs(p.y - m.y) < 2.8) onCrush(p);
  }
}
export function damageMechanism(m, n) {
  if (m.broken || !['gate', 'panel', 'drop'].includes(m.type)) return;
  m.health = Math.max(0, m.health - n);
  if (!m.health) {
    m.broken = true;
    if (m.type === 'drop') m.goal = 1;
  }
}
export function inside(b, x, z, r) {
  const dx = x - b.x,
    dz = z - b.z,
    c = Math.cos(b.theta),
    s = Math.sin(b.theta);
  return Math.abs(dx * c - dz * s) < b.w / 2 + r && Math.abs(dx * s + dz * c) < b.d / 2 + r;
}
