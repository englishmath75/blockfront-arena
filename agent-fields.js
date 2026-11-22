import timing from './ability-times.json' with { type: 'json' };

// Width and reach are in map metres. Windup and effect durations use the
// corresponding ability record; pulse intervals are independent of frame rate.
const waves = {
  균열: { color: '#ffc173', effect: 'concuss', width: 7, speed: 160 },
  '지진 강타': { color: '#f59445', effect: 'quake', width: 18, reach: 32, speed: 18 },
  황혼: { color: '#8d719d', effect: 'terror', width: 20, reach: 40, speed: 24 },
  '초점 교차': { color: '#ffe5a2', effect: 'hinder', width: 14, reach: 45, speed: 24 },
  '요동치는 베이스': { color: '#dd87fb', effect: 'bass', width: 18, reach: 36, speed: 22 },
};
const helpers = {
  '폭발 봇': ['boom-bot', 40, 5, 5.5, '#fa9c64'],
  지원봇: ['wingman', 60, 5, 6.3, '#ffc65f'],
  기절봇: ['dizzy', 20, 2, 5, '#92caff'],
  추적귀: ['prowler', 60, 2.5, 5.4, '#825882'],
  추적자: ['seeker', 120, 12, 5.2, '#8dbd60'],
  포탑: ['turret', 100, 240, 0, '#e8bd50'],
  알람봇: ['alarmbot', 50, 240, 0, '#d6a6d5'],
  트레이드마크: ['trademark', 20, 240, 0, '#dbb460'],
  '음향 센서': ['sonic-sensor', 20, 240, 0, '#84cbea'],
  목조르기: ['chokehold', 70, 240, 0, '#8fd2b1'],
  가지치기: ['shear', 0, 240, 0, '#d5b2de'],
  함정: ['trapwire', 20, 240, 0, '#77d4f1'],
  봉쇄: ['lockdown', 200, 13.1, 0, '#f6dc70'],
};
const props = new Set([
  'boom-bot',
  'wingman',
  'dizzy',
  'turret',
  'alarmbot',
  'trademark',
  'sonic-sensor',
  'lockdown',
  'trapwire',
]);
export const fieldProp = (kind) => (props.has(kind) ? kind : null);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function decay(p, hp, end) {
  const loss = Math.min(Math.max(0, hp - (p.decayLost ?? 0)), Math.max(0, p.hp - 1));
  p.hp -= loss;
  p.decayLost = (p.decayLost ?? 0) + loss;
  p.decayUntil = Math.max(end, p.decayUntil ?? 0);
}
export function castField(name, p, ground, params, ctx) {
  const { time, add, players, visible, canPlant, core } = ctx;
  const stat = timing[name] ?? {},
    wave = waves[name],
    helper = helpers[name];
  if (wave) {
    const reach = wave.reach ?? 8 + 40 * Math.min(1, Math.max(0, Number(params.charge) || 0));
    const windup = stat['windup time'] ?? stat['channel time'] ?? stat['cast time'] ?? 0.6;
    const d = add(
      'groundWave',
      p.x,
      p.z,
      windup + reach / wave.speed + 0.2,
      wave.width,
      0.18,
      1,
      wave.color,
      p,
      p.y + 0.03,
    );
    Object.assign(d, {
      name,
      angle: p.yaw,
      reach,
      speed: wave.speed,
      start: time + windup,
      touched: [],
      originX: p.x,
      originZ: p.z,
    });
    return true;
  }
  if (helper) {
    const [kind, hp, lifetime, speed, color] = helper;
    const deploy = stat['deploy time'] ?? stat['deployment duration'] ?? 0.15;
    const at = speed ? p : ground;
    if (!Number.isFinite(at?.y)) return false;
    let objective;
    if (kind === 'wingman' && params.alt) {
      if (core.state === 'planted' && !ctx.attacking(p))
        objective = { x: core.x, y: core.y, z: core.z, operation: 'defuse' };
      else if (core.carrier === p && canPlant(ground.x, ground.z, ground.y))
        objective = { ...ground, operation: 'plant' };
      if (!objective) return false;
    }
    let targets = [null];
    if (kind === 'seeker')
      targets = players
        .filter((o) => !o.down && ctx.hostile(p, o))
        .sort((a, b) => dist(a, p) - dist(b, p))
        .slice(0, 3);
    if (!targets.length) return false;
    for (const target of targets) {
      const airborne = kind === 'dizzy';
      const d = add(
        'companion',
        at.x,
        at.z,
        deploy + lifetime + (objective ? 12 : 0),
        0.62,
        0.62,
        0.62,
        color,
        p,
        at.y + (airborne ? p.height : 0),
      );
      Object.assign(d, {
        kind,
        name,
        hp,
        start: time + deploy,
        angle: p.yaw,
        speed,
        targetId: target?.id,
        objective,
        airborne,
        originY: d.y,
      });
    }
    return true;
  }
  if (name === '신경 절도') {
    const body = players
      .filter((o) => o.down && ctx.hostile(p, o) && dist(o, p) < 20)
      .sort((a, b) => dist(a, ground) - dist(b, ground))[0];
    if (!body || !visible({ x: p.x, y: p.y + p.height, z: p.z }, body, 21)) return false;
    const d = add('agentPulse', body.x, body.z, 4.15, 0.42, 0.42, 0.45, '#81daec', p, body.y + 0.23);
    Object.assign(d, { kind: 'theft', next: time + (stat['1st reveal windup time'] ?? 2), pulses: 2 });
    return true;
  }
  if (name === '강철 정원' || name === '무력화/명령') {
    const kayo = name === '무력화/명령',
      windup = stat.windup ?? stat['windup time'] ?? 1;
    const d = add(
      'agentPulse',
      p.x,
      p.z,
      kayo ? windup + 12.2 : windup + 0.2,
      0.65,
      0.65,
      0.65,
      kayo ? '#a385ff' : '#c492e5',
      p,
      p.y + 0.3,
    );
    Object.assign(d, {
      kind: kayo ? 'overload' : 'steel',
      next: time + windup,
      radius: stat.radius,
      pulses: kayo ? 4 : 1,
    });
    if (kayo) p.overloadedUntil = p.stimUntil = time + windup + stat['overloaded duration'];
    return true;
  }
  return null;
}
export function tickField(d, owner, dt, ctx) {
  const { time, players, visible, hostile, hurt, move, ring, add, objective } = ctx;
  if (!['groundWave', 'companion', 'agentPulse'].includes(d.type)) return false;
  if (!owner || d.end <= time) return true;
  const stat = timing[d.name] ?? {};
  if (d.type === 'groundWave') {
    const advance = Math.max(0, (time - d.start) * d.speed),
      sin = Math.sin(d.angle),
      cos = Math.cos(d.angle);
    d.x = d.originX - sin * Math.min(d.reach, advance);
    d.z = d.originZ - cos * Math.min(d.reach, advance);
    if (time < d.start) return true;
    for (const o of players) {
      if (o.down || o === owner || d.touched.includes(o.id)) continue;
      const dx = o.x - d.originX,
        dz = o.z - d.originZ,
        along = -dx * sin - dz * cos;
      if (along < 0 || along > d.reach || along > advance + 1 || Math.abs(dx * cos - dz * sin) > d.w / 2)
        continue;
      const effect = waves[d.name].effect;
      if (effect === 'terror' && !hostile(owner, o)) continue;
      d.touched.push(o.id);
      if (effect === 'terror') {
        decay(o, 75, time + (stat['debuff duration'] ?? 8));
        o.deafUntil = time + 8;
        o.trailEnd = time + 8;
      } else if (effect === 'bass') {
        move(o, -sin * 3, -cos * 3);
        o.deafUntil = time + 4;
        o.tag = time + 4;
      } else {
        o.tag = time + (stat['concuss duration'] ?? stat['hinder duration'] ?? 4);
        if (effect === 'quake') o.vy = 6;
      }
    }
    return true;
  }
  if (d.type === 'agentPulse') {
    if (d.kind === 'overload') {
      d.x = owner.x;
      d.z = owner.z;
    }
    if (!d.pulses || time < d.next) return true;
    d.pulses--;
    d.next += d.kind === 'overload' ? 4 : 2;
    ring(d, owner, d.radius ?? 24);
    for (const o of players) {
      if (o.down || !hostile(owner, o) || (d.radius && dist(o, d) > d.radius)) continue;
      if (d.kind === 'theft') {
        o.revealTeam = owner.team;
        o.revealEnd = time + 0.8;
      }
      if (d.kind === 'overload') o.suppressed = time + 4;
      if (d.kind === 'steel') {
        o.jammedUntil = time + 8;
        if (o.selected === 'primary') o.selected = o.kit.secondary ? 'secondary' : 'melee';
      }
    }
    return true;
  }
  if (time < d.start || (owner.down && d.kind === 'turret')) return true;
  const close = players.filter((o) => !o.down && hostile(owner, o)).sort((a, b) => dist(a, d) - dist(b, d));
  const target =
    close.find((o) => o.id === d.targetId) ??
    close.find((o) => {
      if (
        !visible(
          { x: d.x, y: d.y + 0.5, z: d.z },
          o,
          d.kind === 'lockdown' ? 33 : d.kind === 'turret' ? 40 : 16,
        )
      )
        return false;
      const forward = (o.x - d.x) * -Math.sin(d.angle) + (o.z - d.z) * -Math.cos(d.angle);
      return ['turret', 'wingman', 'prowler', 'boom-bot'].includes(d.kind) ? forward > 0 : true;
    });
  const hit = target && dist(target, d);
  if (d.kind === 'lockdown') {
    if (time >= d.born + 13) {
      ring(d, owner, 32.5);
      for (const o of close) if (dist(o, d) <= 32.5) o.detainedUntil = time + 8;
      d.end = time;
    }
    return true;
  }
  if (d.objective) {
    const to = d.objective;
    if (
      (to.operation === 'plant' && ctx.core.carrier !== owner) ||
      (to.operation === 'defuse' && ctx.core.state !== 'planted')
    ) {
      d.end = time;
      return true;
    }
    if (dist(d, to) < 1) {
      d.channelEnd ??= time + (to.operation === 'plant' ? 4 : 7);
      if (time >= d.channelEnd) {
        objective(d, owner);
        d.end = time;
      }
      return true;
    }
    d.angle = Math.atan2(d.x - to.x, d.z - to.z);
  } else if (d.kind === 'dizzy') {
    d.y = d.originY + Math.sin(Math.min(1, (time - d.start) / 1.2) * Math.PI) * 0.8;
    if (time >= d.start + 0.35 && !d.fired) {
      d.fired = true;
      for (const o of close)
        if (visible(d, o, 20)) {
          o.plasmaUntil = time + 1.5;
          ctx.trace(d, o, '#60aaff');
        }
    }
  } else if (
    d.kind === 'seeker' ||
    d.kind === 'prowler' ||
    d.kind === 'boom-bot' ||
    d.kind === 'wingman' ||
    d.kind === 'alarmbot'
  ) {
    if (d.kind === 'alarmbot' && dist(d, owner) > 40) return true;
    if (target) {
      d.angle = Math.atan2(d.x - target.x, d.z - target.z);
      if (d.kind === 'alarmbot') d.speed = 6;
    } else if (d.kind === 'prowler' && owner.guiding) d.angle = owner.yaw;
    const reach = d.kind === 'wingman' ? 6 : d.kind === 'prowler' ? 1.6 : 1.5;
    if (target && hit < reach) {
      d.impactAt ??= time + (stat['blast windup'] ?? stat['windup time'] ?? 0.35);
      if (time >= d.impactAt) {
        ring(d, owner, reach);
        if (d.kind === 'seeker' || d.kind === 'prowler')
          target.nearsight = time + (stat['nearsight duration'] ?? 3);
        if (d.kind === 'boom-bot') hurt(target, Math.round(30 + 50 * (1 - Math.min(1, hit / 2))), owner);
        if (d.kind === 'wingman') {
          for (const enemy of close) {
            const distance = dist(d, enemy);
            const forward = -(enemy.x - d.x) * Math.sin(d.angle) - (enemy.z - d.z) * Math.cos(d.angle);
            if (
              distance <= reach &&
              forward >= distance * Math.cos((32.5 * Math.PI) / 180) &&
              visible(d, enemy, reach + 1)
            )
              enemy.tag = time + stat['concuss duration'];
          }
        }
        if (d.kind === 'alarmbot') target.vulnerable = time + 4;
        d.end = time;
      }
      return true;
    }
  } else if (target) {
    if (d.kind === 'turret' && dist(d, owner) <= 40 && hit < 40 && time >= (d.next ?? 0)) {
      d.salvo = (d.salvo ?? 0) + 1;
      d.next = time + (d.salvo % 3 === 0 ? 0.75 : 0.18);
      ctx.trace(d, target, '#ffcb62');
      hurt(target, hit < 20 ? 8 : hit < 35 ? 6 : 4, owner);
    }
    const loud = target.shot > time - 0.35 || (target.mode === 'run' && Math.hypot(target.vx, target.vz) > 2);
    const trigger =
      d.kind === 'sonic-sensor' ? hit < 7 && loud : d.kind === 'trademark' ? hit < 10 : hit < 2.2;
    if (d.kind !== 'turret' && trigger) {
      d.triggerAt ??= time + (stat['windup time'] ?? 0.45);
      if (time >= d.triggerAt) {
        ring(d, owner, 5);
        if (d.kind === 'trademark')
          add('slow', d.x, d.z, stat['slow duration'] ?? 4, 12, 12, 0.2, '#d6a65c', owner, d.y);
        else if (d.kind === 'shear') add('wall', d.x, d.z, 7, 5, 0.45, 3.5, '#aa91c0', owner, d.y);
        else if (d.kind === 'sonic-sensor') {
          for (const o of close) if (dist(o, d) < 7) o.tag = time + (stat['concuss duration'] ?? 2.5);
        } else {
          target.tether = { x: d.x, z: d.z, until: time + 3 };
          target.revealTeam = owner.team;
          target.revealEnd = time + 3;
          if (d.kind === 'chokehold') decay(target, 50, time + 3);
        }
        d.end = time;
      }
    }
  }
  if (d.speed) {
    const dx = -Math.sin(d.angle) * dt * d.speed,
      dz = -Math.cos(d.angle) * dt * d.speed;
    if (!ctx.travel(d, dx, dz) && !target) d.angle += Math.PI * 0.6;
  }
  return true;
}
