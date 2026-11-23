import * as T from 'three';
const devices = {
  '독성 연기': 'poisonOrb',
  '독성 장막': 'poisonLine',
  '사이버 감옥': 'cage',
  나노스웜: 'swarm',
  '면도날 덩굴': 'vine',
  스파이캠: 'camera',
  랑데부: 'anchor',
  '아크 장미': 'rose',
  지름길: 'passage',
  요격기: 'interceptor',
  '관문 충돌': 'gatecrash',
  굴절: 'beacon',
};
export const remoteAbilities = ['올빼미 드론', '잠입 드론', '정찰자', '요동봇'];
export const distanceSmokes = ['어둠의 장막', '해만'];
export const remoteInteract = ['cage', 'swarm', 'vine', 'passage', 'decoyMark','gatecrash'];
export const deviceKind = (name) => devices[name];
export const reusable = (name) => devices[name] && (devices[name]==='gatecrash' || !remoteInteract.includes(devices[name]));
export function targetedDevice(player, list, ray) {
  return list
    .filter((d) => d.owner === player.id && (remoteInteract.includes(d.kind) || ['rose','shear'].includes(d.kind) || d.kind==='sonic-sensor' && !d.triggerAt && Math.hypot(d.x-player.x,d.z-player.z)<=27) && d.end > 0)
    .map((d) => {
      const target = new T.Vector3(d.x, d.y + 0.2, d.z);
      return { d, dist: ray.distanceToPoint(target), depth: target.sub(ray.origin).dot(ray.direction) };
    })
    .filter((v) => v.depth >= 0 && v.dist < 0.4 + v.depth * 0.045)
    .sort((a, b) => a.dist - b.dist)[0]?.d;
}
export function updatePilot(p, keys, dt, world, devices) {
  const v = p.pilot;
  if (!v || v.kind === '스파이캠') return;
  const f = v.lungeEnd ? 1 : +keys.has('KeyW') - +keys.has('KeyS'),
    s = v.lungeEnd ? 0 : +keys.has('KeyD') - +keys.has('KeyA');
  const yaw = v.lungeYaw ?? p.yaw;
  const speed = v.lungeEnd ? 12 : (v.speed ?? (v.kind === '올빼미 드론' ? 4.5 : 6)) / (Math.hypot(f, s) || 1),
    dx = (s * Math.cos(yaw) - f * Math.sin(yaw)) * speed * dt,
    dz = (-s * Math.sin(yaw) - f * Math.cos(yaw)) * speed * dt;
  if (!world.intersects(v.x + dx, v.z, v.y - 0.12, 0.17, devices, 0.25)) v.x += dx;
  if (!world.intersects(v.x, v.z + dz, v.y - 0.12, 0.17, devices, 0.25)) v.z += dz;
  const floor = world.structure.support(v.x, v.z, v.y + 0.3);
  const flying = v.kind === '올빼미 드론',
    up = +keys.has('Space') - +keys.has('ControlLeft') - +keys.has('ControlRight');
  if (v.kind === '잠입 드론') {
    v.jump ??= 0;
    if (keys.has('Space') && !v.jumpHeld && Number.isFinite(floor) && v.y <= floor + 0.47) v.jump = 4.8;
    v.jumpHeld = keys.has('Space');
    v.jump -= 12 * dt;
    const bottom = Number.isFinite(floor) ? floor + 0.42 : -Infinity,
      ny = Math.max(bottom, v.y + v.jump * dt);
    if (!world.intersects(v.x, v.z, ny - 0.12, 0.17, devices, 0.25)) v.y = ny;
    else v.jump = 0;
    if (v.y <= bottom + 0.01) v.jump = 0;
    return;
  }
  const y = flying
    ? Math.min(
        p.y + 7,
        Math.max(
          (Number.isFinite(floor) ? floor : p.y) + 0.45,
          v.y + (up + f * Math.sin(p.pitch)) * 0.07 * dt * 60,
        ),
      )
    : Number.isFinite(floor)
      ? floor + 0.5
      : v.y - 3 * dt;
  if (!world.intersects(v.x, v.z, y - 0.12, 0.17, devices, 0.25)) v.y = y;
}
export function distanceTarget(w, p, yaw, pitch, meters) {
  const x = p.x - Math.sin(yaw) * meters,
    z = p.z - Math.cos(yaw) * meters,
    y = w.structure.support(x, z, p.y + 3 + Math.sin(pitch) * meters);
  return Number.isFinite(y) ? { x, y, z } : null;
}
