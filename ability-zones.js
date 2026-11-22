import timing from './ability-times.json' with { type: 'json' };
import * as T from 'three';

const zones = {
  fragment: { radius: 4, hue: '#ad84ff', delay: 0.5, count: 4, gap: 1 },
  mpulse: { radius: 5.5, hue: '#b091ff', delay: 1, count: 3, gap: 1 },
  storm: { radius: 6, hue: '#55dded', delay: 0.6 },
  saturate: { radius: 6, hue: '#ffe793', delay: 0.1 },
  collapse: { radius: 6, hue: '#69bee0', delay: 0.15 },
  suspension: { radius: 7, hue: '#5bd2f1', delay: 0.1 },
  knife: { radius: 15, hue: '#ad85ff', delay: 1 },
  guided: { radius: 4.5, hue: '#ff9956', delay: 1.25, count: 3, gap: 0.35 },
  nova: { radius: 4.75, hue: '#cba1ff', delay: 1 },
  well: { radius: 4.75, hue: '#a07dec', delay: 1.25, count: 21, gap: 0.1 },
};
export function createZone(kind, name, source, owner, ctx) {
  const def = zones[kind];
  if (!def) return false;
  const stats = timing[name] ?? {},
    r = stats.radius ?? def.radius,
    delay = stats['windup to first pulse'] ?? def.delay;
  const destructible = kind === 'knife',
    count = def.count ?? 1,
    gap = def.gap ?? 0.1;
  const d = ctx.add(
    'zoneEmitter',
    source.x,
    source.z,
    delay + count * gap + 0.3,
    destructible ? 0.24 : 0.5,
    destructible ? 0.24 : 0.5,
    destructible ? 0.38 : 0.2,
    def.hue,
    owner,
    source.y,
  );
  Object.assign(d, {
    kind,
    name,
    start: ctx.time + delay,
    next: ctx.time + delay,
    radius: r,
    pulses: count,
    gap,
    heal: !!source.heal,
    hp: destructible ? 20 : kind === 'mpulse' ? 50 : 0,
  });
  return true;
}
export function tickZone(d, owner, ctx) {
  const t = ctx.time;
  if (!owner || !d.pulses || t < d.next) return;
  d.pulses--;
  d.next += d.gap;
  if (d.kind !== 'well' || d.pulses % 5 === 0) ctx.ring(d, owner, d.radius);
  for (const o of ctx.players) {
    if (o.down) continue;
    const dx = d.x - o.x,
      dz = d.z - o.z,
      r = Math.hypot(dx, dz),
      enemy = ctx.hostile(owner, o);
    if (r > d.radius || Math.abs(o.y - d.y) > d.radius) continue;
    if (d.kind === 'knife') {
      if (enemy) o.suppressed = t + 8;
      continue;
    }
    if (
      ['fragment', 'guided', 'mpulse'].includes(d.kind) &&
      !ctx.visible({ ...d, y: d.y + 0.22 }, o, d.radius + 1.2)
    )
      continue;
    if (d.kind === 'fragment' || d.kind === 'guided') {
      if (enemy) ctx.hurt(o, d.kind === 'guided' ? 50 : Math.round(60 - (35 * r) / d.radius), owner);
    } else if (d.kind === 'mpulse') {
      if (d.heal) o.hp = Math.min(100, o.hp + 20);
      else o.tag = t + 2.5;
    } else if (d.kind === 'storm') {
      o.tag = t + 2;
      o.nearsight = t + 2;
    } else if (d.kind === 'nova' || d.kind === 'saturate') o.tag = t + (d.kind === 'nova' ? 2.5 : 3);
    else if (d.kind === 'suspension') {
      o.vy = 4.2;
      o.suspendedUntil = t + 4;
      o.holdY = o.y + 1.2;
    } else if (d.kind === 'collapse' || d.kind === 'well') {
      const step = Math.min(r, d.kind === 'well' ? 0.45 : 3.5);
      if (r > 0.1) ctx.move(o, (dx / r) * step, (dz / r) * step);
      if (d.kind === 'well' && !d.pulses) o.vulnerable = t + 2.5;
    }
  }
}
export function shieldHit(ray, d, limit) {
  const norm = new T.Vector3(-Math.sin(d.angle), 0, -Math.cos(d.angle));
  const denom = norm.dot(ray.direction);
  if (Math.abs(denom) < 1e-6) return limit;
  const t = ((d.x - ray.origin.x) * norm.x + (d.z - ray.origin.z) * norm.z) / denom;
  if (t < 0 || t >= limit) return limit;
  const hit = ray.at(t, new T.Vector3());
  const lateral = (hit.x - d.x) * Math.cos(d.angle) - (hit.z - d.z) * Math.sin(d.angle);
  return Math.abs(lateral) <= d.w / 2 && hit.y >= d.y && hit.y <= d.y + d.h ? t : limit;
}
