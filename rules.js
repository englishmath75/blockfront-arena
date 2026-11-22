import catalog from './catalog.json' with { type: 'json' };
export const GAME_MODES = ['사용자 설정 게임', '경쟁전', '신속플레이', '스파이크 돌격', '데스매치'];
export const RUN_SPEED = 6.75,
  STOP_THRESHOLD = RUN_SPEED * 0.275;
export const SPEED = { run: RUN_SPEED, walk: 3.6, crouch: 2.1 };
export const TARGET_WINS = 13,
  SWAP_ROUND = 12;
export const TIMES = { buy: 30, fight: 100, objective: 45, result: 5, plant: 4, defuse: 7 };
export const WEAPONS = catalog.guns;
for (const [key, base, name, size, damage] of [
  ['blades', 'sheriff', '칼날 폭풍', 5, 50],
  ['headhunter', 'sheriff', '헤드헌터', 8, 55],
  ['tour', 'operator', '역작', 5, 150],
]) {
  WEAPONS[key] = {
    ...WEAPONS[base],
    name,
    size,
    reserve: 0,
    spread: 0,
    damage,
    damageRanges: [
      { rangeEndMeters: 150, headDamage: damage * 3, bodyDamage: damage, legDamage: damage * 0.85 },
    ],
    category: 'Ability',
  };
}
WEAPONS.melee.auto = true;
Object.assign(WEAPONS.blades, { auto: true, interval: 1 / 6, equip: 0.5, recoil: 0, ads: null, move: 1 });
export const AGENTS = catalog.agents;
export const SLOTS = ['C', 'Q', 'E', 'X'];
export const SHIELD = { name: '중형 보호막', cost: 1000, amount: 50 };
export const ARMOR = { light: { name: '경형 보호막', cost: 400, amount: 25 }, heavy: SHIELD };
const clamp = (n, lower, upper) => Math.max(lower, Math.min(upper, n));
export function velocityStep(vx, vz, dx, dz, speed, dt) {
  const moving = Boolean(dx || dz);
  const opposite = moving && vx * dx + vz * dz < -0.15;
  const change = (opposite ? 56 : moving ? 34 : 45) * dt;
  const tx = dx * speed;
  const tz = dz * speed;
  const difference = Math.hypot(tx - vx, tz - vz);
  const fraction = difference ? Math.min(1, change / difference) : 0;
  return [vx + (tx - vx) * fraction, vz + (tz - vz) * fraction];
}
export function spreadFor(weapon, speed, airborne, crouched, bloom) {
  const motion = clamp((speed - STOP_THRESHOLD) / (RUN_SPEED - STOP_THRESHOLD), 0, 1);
  return weapon.spread * (crouched ? 0.85 : 1) + motion * 0.085 + (airborne ? 0.11 : 0) + bloom;
}
export function audibleStep(mode, speed, grounded) {
  return mode === 'run' && grounded && speed >= 3.2;
}
export function decideRound({ armed, detonate, clock, attackAlive, defendAlive }) {
  if (armed && detonate <= 0) return ['attack', '스파이크 폭발'];
  if (defendAlive === 0 && (attackAlive > 0 || armed)) return ['attack', '수비팀 전멸'];
  if (!armed && attackAlive === 0) return ['defend', '공격팀 전멸'];
  if (!armed && clock <= 0) return ['defend', '시간 종료'];
  return null;
}

export const skillIcon = (agent, i) =>
  AGENTS[agent].icon
    .replace('agents-', 'skill-')
    .replace('.png', '-' + ['Grenade', 'Ability1', 'Ability2', 'Ultimate'][i] + '.png');
