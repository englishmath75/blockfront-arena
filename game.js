import { killBanner } from './kill-banner.js';
import { onIce } from './terrain-feedback.js';
import { fieldAudio, prepareFieldAudio } from './field-audio.js';
import { tickGroundField } from './ground-fields.js';
import { castField, tickField, fieldProp } from './agent-fields.js';
import { createZone, tickZone } from './ability-zones.js';
import voices from './ability-voice.json' with { type: 'json' };
import skillAudio from './ability-sfx.json' with { type: 'json' };
import { skinProfile } from './skin-levels.js';
import { alternateAttack, shotPattern, meleeDamage } from './attacks.js';
import { recordedEffect } from './skin-performance.js';
import timing from './ability-times.json' with { type: 'json' };
import { deviceMesh, drawDevice, lanePaths } from './field-effects.js';
import { modelKey, inspectLength, attachProp } from './actor-models.js';
import { heldSkill } from './held-skill.js';
import {
  deviceKind,
  reusable,
  remoteAbilities,
  remoteInteract,
  targetedDevice,
  updatePilot,
  distanceSmokes,
  distanceTarget,
} from './deployed.js';
import {
  arrowNames,
  tabletNames,
  shortThrows,
  hasThrow,
  launch,
  flight,
  projectileColor,
  accessHint,
} from './utility.js';
import {
  prepareBase,
  playBase,
  prepareSkin,
  playSkinEvent,
  stopAnimationAudio,
  weaponAnimation,
  finisher,
  palettes,
} from './skin-performance.js';
import { loadTerrain } from './terrain.js';
import {
  interactable,
  useMechanism,
  tickMechanisms,
  damageMechanism,
  rideStep,
  cable,
} from './mechanisms.js';
import * as T from 'three';
import { createWorld } from './world.js';
import {
  areas,
  HALF,
  SIZE,
  CELL,
  open,
  isCover,
  SITES,
  MAPS,
  MAP_NAME,
  setArena,
  sidePosition,
  siteAt,
  area,
} from './arena.js';
import {
  SPEED,
  WEAPONS,
  AGENTS,
  SLOTS,
  skillIcon,
  ARMOR,
  TIMES,
  velocityStep,
  spreadFor,
  audibleStep,
  decideRound,
} from './rules.js';
import skinCatalog from './skins.json' with { type: 'json' };
import { effects } from './powers.js';
import { PlayerRoom } from './room-client.js';
import { agentCards, armory, collection, lobby, settingsForm, gunDetail, escape } from './interface.js';
const get = (id) => document.getElementById(id),
  canvas = get('world'),
  menu = get('menu'),
  hud = get('hud');
const angle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const range = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const vec = (x, y, z) => new T.Vector3(x, y, z);
const aim = (yaw, pitch) =>
  vec(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
const pi = Math.PI,
  teamName = { blue: '아군 A', amber: '팀 B' };
const phaseNames = {
  buy: '구매 단계',
  fight: '교전',
  objective: '스파이크 설치됨',
  result: '라운드 종료',
  ended: '경기 종료',
};
const other = (team) => (team === 'blue' ? 'amber' : 'blue');
const keys = new Set();
function stored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem('voxel.val.' + key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem('voxel.val.' + key, JSON.stringify(value));
  } catch {}
}
let settings = { sens: 1, volume: 0.7, color: '#80ffcf', dynamic: true, ...stored('settings', {}) };
let equipped = stored('skins', {}),
  skinOptions = stored('skin-options', {}),
  collectionGun = 'vandal',
  rangeWeapon = null,
  rangeAppearance = null,
  selectedGun = 'vandal';
let world,
  match,
  room,
  screen = 'home',
  mode = 'range',
  agentId = '제트',
  selectedMap = '어센트',
  playlist = '사용자 설정 게임',
  joinCode = '';
let mapProgress = 0,
  transition = 0,
  now = 0,
  paused = false,
  unlocked = false,
  lockedBefore = false,
  fireHeld = false,
  firePressed = false,
  secondaryPress = null,
  dragging = false,
  hudAt = -1,
  audio,
  buffer,
  notice = '',
  ads = false;
let sending = false,
  netAt = 0,
  lastRevision = -1,
  revision = 0,
  sequence = 0;
let armedSkill = null,
  chargeStart = null,
  ricochets = 0,
  wallAngle = 0,
  smokeRange = 12,
  rangeAdjust = 0,
  alternateView = false,
  divideMode = false,
  healPulse = false,
  turnWall = false,
  marks = [],
  cursor = { x: 0, z: 0 };
const armedName = () => (armedSkill === null ? '' : AGENTS[match.player.agent].gear[armedSkill]);
function disarm() {
  armedSkill = null;
  chargeStart = null;
  divideMode = false;
  healPulse = false;
  ricochets = 0;
  turnWall = false;
  rangeAdjust = 0;
  alternateView = false;
  marks = [];
  fireHeld = firePressed = false;
}
function arm(i) {
  disarm();
  armedSkill = i;
  command('arm', i);
  playSkillCue(match.player, armedName(), 'equip');
  if (armedName() === '어둠의 장막') alternateView = true;
  const p = match.player;
  wallAngle = p.yaw;
  cursor = { x: p.x, z: p.z };
  ads = false;
}
function cast(params = {}) {
  command('ability', { i: armedSkill, ...params });
  disarm();
}

let queuedActions = [],
  heldRemotes = new Map(),
  roomPending = false;
const isGuest = () => mode === 'match' && room && !room.host;
function dispatch(kind, value) {
  if (!isGuest()) return false;
  queuedActions.push({ kind, value });
  return true;
}
const practice = () => mode === 'range' || mode === 'tour';
const dm = () => !practice() && playlist === '데스매치';
const rush = () => !practice() && playlist === '스파이크 돌격';
const rated = () => !practice() && playlist === '경쟁전';
const swift = () => !practice() && playlist === '신속플레이';
function soundOn() {
  if (!window.AudioContext) return;
  try {
    audio ??= new AudioContext();
    prepareFieldAudio(audio);
    if (!buffer) {
      buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.21), audio.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    void audio.resume().catch(() => {});
  } catch {
    /* Keep keyboard and mouse controls usable when audio is unavailable. */
  }
}
function currentSkin(p) {
  const id = heldWeapon(p)?.id;
  if (p.local && p.preview?.weapon === id && mode === 'range') return p.preview.skin;
  const skin = skinCatalog[id]?.find((s) => s.id === (p.local ? equipped[id] : p.skinId));
  return skinProfile(skin, p.local ? skinOptions[skin?.id] : { level: p.skinLevel, variant: p.skinVariant });
}
function playSkillCue(at, name, phase) {
  const file = skillAudio[name]?.[phase];
  if (!file || !settings.volume || (at !== match.player && match.player.deafUntil > now)) return false;
  const clip = new Audio('/agent-sfx/' + file);
  clip.volume = Math.min(1, (settings.volume * 0.76) / (1 + range(match.player, at) * 0.13));
  void clip.play().catch(() => {});
  return true;
}
function abilityVoice(p, name) {
  if (p !== match.player && match.player.deafUntil > now) return;
  if (playSkillCue(p, name, 'cast')) return;
  const list = voices[name];
  if (!list?.length || !settings.volume) return;
  const clip = new Audio('/agent-voice/' + list[Math.floor(Math.random() * list.length)]);
  clip.volume = Math.max(0, Math.min(1, (settings.volume * 0.48) / (1 + range(match.player, p) * 0.13)));
  void clip.play().catch(() => {});
}
function sound(kind, at) {
  if (at && at !== match?.player && match?.player?.deafUntil > now) return;
  if (
    !at &&
    match?.player?.kit?.[match.player.selected] &&
    ['shot', 'reload', 'equip', 'inspect', 'kill'].includes(kind)
  ) {
    const p = match.player;
    if (
      playSkinEvent(
        currentSkin(p),
        kind,
        kind === 'reload'
          ? p.reloadDuration || weaponFor(p).reload
          : kind === 'equip'
            ? weaponFor(p).equip
            : kind === 'inspect'
              ? inspectLength(heldWeapon(p).id, currentSkin(p))
              : 0.5,
        settings.volume * 0.82,
      )
    )
      return;
  }
  if (at?.kit && match?.player && ['shot', 'reload'].includes(kind)) {
    const dist = range(match.player, at);
    if (
      dist <= 18 &&
      playSkinEvent(
        currentSkin(at),
        kind,
        kind === 'reload' ? at.reloadDuration || weaponFor(at).reload : 0.5,
        (settings.volume * 0.82) / (1 + dist * 0.32),
      )
    )
      return;
  }
  if (!audio || audio.state !== 'running') return;
  const p = match?.player;
  const dist = at && p ? range(p, at) : 0;
  if (dist > 18) return;
  if (['shot', 'reload'].includes(kind) && p) {
    const source = at?.kit ? at : p,
      id = heldWeapon(source)?.id;
    const balance = at
      ? Math.max(-1, Math.min(1, ((at.x - p.x) * Math.cos(p.yaw) - (at.z - p.z) * Math.sin(p.yaw)) / 7))
      : 0;
    if (playBase(audio, id, kind, (settings.volume * 0.82) / (1 + dist * 0.32), balance)) return;
  }
  const gain = audio.createGain();
  const pan = audio.createStereoPanner();
  const time = audio.currentTime;
  const volume = Math.max(
    0.007,
    (kind === 'shot' ? 0.17 : kind === 'step' ? 0.067 : 0.095) / (1 + dist * 0.32),
  );
  pan.pan.value =
    at && p
      ? Math.max(-1, Math.min(1, ((at.x - p.x) * Math.cos(p.yaw) - (at.z - p.z) * Math.sin(p.yaw)) / 7))
      : 0;
  gain.connect(pan).connect(audio.destination);
  gain.gain.setValueAtTime(Math.max(0.0001, volume * settings.volume * 0.82), time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.145);
  const texture = kind === 'shot' || kind === 'step';
  const source = texture ? audio.createBufferSource() : audio.createOscillator();
  if (texture) {
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'shot' ? 1050 : 210;
    source.connect(filter).connect(gain);
    source.onended = () => filter.disconnect();
  } else {
    source.type = 'triangle';
    source.frequency.setValueAtTime(kind === 'hit' ? 690 : kind === 'reload' ? 245 : 445, time);
    source.connect(gain);
  }
  source.addEventListener(
    'ended',
    () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
    },
    { once: true },
  );
  source.start(time);
  source.stop(time + (kind === 'step' ? 0.105 : 0.155));
}
function actor(record, index) {
  const agent = record.agent || '제트';
  return {
    id: record.id,
    name: record.target ? '표적 ' + index : agent,
    agent,
    team: record.team,
    i: index,
    local: record.id === (room?.id ?? 'local'),
    target: !!record.target,
    model: world.avatar(record.team, agent, !!record.target),
    credits: 800,
    x: 0,
    z: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    height: 1.53,
    hp: 100,
    shield: 0,
    mode: 'run',
    kit: {},
    selected: 'secondary',
    reloading: 0,
    nextShot: 0,
    bloom: 0,
    shot: -1,
    foot: 0,
    tag: 0,
    down: false,
    shots: 0,
    hits: 0,
    kills: 0,
    deaths: 0,
    charges: [0, 0, 1, 0],
    ult: 0,
    ads: false,
    channel: false,
    stepCount: 0,
  };
}
const ammoFor = (id) => ({ id, mag: WEAPONS[id].size, reserve: WEAPONS[id].reserve });
const heldWeapon = (p) => p.kit[p.selected];
const weaponFor = (p) => WEAPONS[heldWeapon(p)?.id ?? 'classic'];
const isAttack = (p) => p.team === match.attack;
const hostile = (a, b) => (dm() ? a !== b : a.team !== b.team);
const alive = (p) => !p.down;
const active = () => match.phase === 'fight' || match.phase === 'objective';
const phaseTime = () => Math.max(0, match.end - now);
function setPhase(phase, seconds) {
  match.phase = phase;
  match.end = now + seconds;
  if (screen === 'shop' && phase !== 'buy' && !practice() && !dm()) show('ready');
}
function respawn(p, slot = p.i) {
  Object.assign(p, {
    strike: null,
    lastCast: null,
    jammedUntil: 0,
    detainedUntil: 0,
    plasmaUntil: 0,
    deafUntil: 0,
    trailEnd: 0,
    isoReady: 0,
    isoShield: false,
    flow: null,
    lightRush: null,
    evolution: false,
    empress: false,
    canOverheal: false,
    overheal: 0,
    pickupUntil: 0,
    mustKillBy: 0,
    link: null,
    stars: 5,
    starTimers: {},
    suspendedUntil: 0,
    netRemoval: 0,
    globeCooldowns: {},
    reclaimedThrash: false,
    reclaim: 0,
    healingPool: 100,
    regrowing: false,
    duel: null,
    trappedBy: 0,
    downedKayo: 0,
    overloadedUntil: 0,
    swingAt: 0,
    bladeRetireAt: 0,
    decayLost: 0,
    seizeRecoveryUntil: 0,
    seizeRecoveryRate: 0,
    hinderedUntil: 0, slowUntil: 0, hasteUntil: 0, reloadDuration: 0,
    decayUntil: 0,
    nearsight: 0,
    revealEnd: 0,
    scannedUntil: 0,
    iceUntil: 0,
    stepSurface: '',
    queuedSkill: null,
    armedSlot: null,
    beamUntil: 0,
    slideUntil: 0,
    sprinting: false,
    slideStock: 1,
    tether: null,
    reviveAt: 0,
    netUntil: 0,
  });
  const [x, z] = sidePosition(isAttack(p), slot);
  Object.assign(p, {
    x,
    z,
    ...world.structure.spawn(
      x,
      z,
      areas.find((n) => n.sector === (isAttack(p) ? '공격팀 진영' : '수비팀 진영') && n.name === '시작 지점')
        ?.groundY ?? 0,
    ),
    ride: null,
    pilot: null,
    fuel: 100,
    travel: 0,
    healLeft: 0,
    volley: 0,
    volleyEnd: 0,
    volleyNext: 0,
    suppressed: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    down: false,
    hp: 100,
    tag: 0,
    phaseUntil: 0,
    blindUntil: 0,
    stimUntil: 0,
    recall: null,
    temporary: null,
    reloading: 0,
    bloom: 0,
    shot: -1,
    channel: false,
    pitch: 0,
    mode: 'run',
    height: 1.53,
  });
  p.yaw = Math.atan2(x, z);
}
function startRound() {
  match.round++;
  for (const m of world.mechanisms) {
    m.maxHealth ??= m.health;
    Object.assign(m, {
      progress: ['auto', 'exit'].includes(m.type) ? 1 : 0,
      goal: ['auto', 'exit'].includes(m.type) ? 1 : 0,
      health: m.maxHealth,
      broken: false,
    });
  }
  match.arrows = [];
  match.endFx = null;
  armedSkill = null;
  const overtime = rated() && match.round >= 25;
  const swap = match.round === (rush() ? 4 : swift() ? 5 : 13) || overtime;
  const tier = rush()
    ? [
        ['classic', 'sheriff', 'ghost'],
        ['bucky', 'spectre', 'marshal'],
        ['vandal', 'phantom', 'operator'],
      ][Math.min(2, (match.round - 1) % 3)]
    : [];
  const rushGun = rush() ? tier[Math.floor(Math.random() * tier.length)] : null;
  if (swap) match.attack = other(match.attack);
  for (const p of match.players) {
    if (p.down || match.round === 1 || swap) {
      p.kit = { secondary: ammoFor('classic'), melee: ammoFor('melee') };
      p.shield = 0;
    } else for (const item of Object.values(p.kit)) Object.assign(item, ammoFor(item.id));
    p.roundKills = 0;
    p.lastKill = null;
    delete p.kit.special;
    p.strike = null;
    p.swingAt = 0;
    p.bladeRetireAt = 0;
    p.healLeft = 0;
    p.selected = p.kit.primary ? 'primary' : 'secondary';
    if (swap) p.credits = overtime ? 5000 : 800;
    if (overtime) p.ult = Math.max(0, AGENTS[p.agent].economy[3].points - 3);
    if (rush()) {
      const slot = WEAPONS[rushGun].category === 'Pistols' ? 'secondary' : 'primary';
      p.kit = { secondary: ammoFor('classic'), melee: ammoFor('melee'), [slot]: ammoFor(rushGun) };
      p.selected = slot;
      p.shield = 50;
    }
    if (swift() && match.round !== 1) p.credits = Math.max(2400, p.credits);
    if (dm() || practice()) p.credits = 9000;
    p.charges = practice()
      ? [99, 99, 99, 99]
      : [
          swap ? 0 : (p.charges?.[0] ?? 0),
          swap ? 0 : (p.charges?.[1] ?? 0),
          Math.max(1, swap ? 0 : (p.charges?.[2] ?? 0)),
          0,
        ];
    if (rush()) p.charges = AGENTS[p.agent].economy.map((v, i) => (i === 3 ? 0 : v.max));
    p.dashExpires = 0;
    p.dashTime = 0;
    p.dashKills = 0;
    p.signatureAt = 0;
    p.burstRemaining = 0;
    if (!practice() && p.ult >= AGENTS[p.agent].economy[3].points) p.charges[3] = 1;
    respawn(p);
  }
  match.devices.forEach(disposeDevice);
  match.devices = [];
  match.core = {
    state: 'carried',
    carrier: match.players.find(isAttack),
    actor: null,
    x: 0,
    z: 0,
    progress: 0,
    half: false,
  };
  match.result = '';
  match.feed = [];
  match.observer = 0;
  setPhase(dm() || practice() ? 'fight' : 'buy', dm() ? 540 : practice() ? Infinity : TIMES.buy);
}
function buildMatch(roster) {
  const members = roster ?? [
    { id: 'local', agent: agentId, team: 'blue' },
    ...Array.from({ length: mode === 'range' ? 5 : 0 }, (_, i) => ({
      id: 'plate' + i,
      team: 'amber',
      agent: '제트',
      target: true,
    })),
  ];
  const counts = { blue: 0, amber: 0 };
  const players = members.map((m) => actor(m, counts[m.team]++));
  match = {
    players,
    player: players.find((p) => p.local),
    attack: 'blue',
    round: 0,
    score: { blue: 0, amber: 0 },
    devices: [],
    flash: 0,
    hit: 0,
    hudText: '',
    hudUntil: 0,
    winner: '',
    scan: 0,
  };
  startRound();
  if (practice()) {
    Object.assign(match.player, {
      ...(mode === 'range' ? { x: 0, y: 0, z: 15, yaw: 0 } : {}),
      kit: { primary: ammoFor('vandal'), secondary: ammoFor('classic'), melee: ammoFor('melee') },
      selected: 'primary',
    });
    if (mode === 'range' && rangeWeapon) {
      const slot =
        WEAPONS[rangeWeapon].category === 'Pistols'
          ? 'secondary'
          : rangeWeapon === 'melee'
            ? 'melee'
            : 'primary';
      match.player.kit[slot] = ammoFor(rangeWeapon);
      match.player.selected = slot;
      if (rangeAppearance) match.player.preview = { weapon: rangeWeapon, skin: rangeAppearance };
      rangeAppearance = null;
      rangeWeapon = null;
    }
    match.players
      .slice(1)
      .forEach((p, i) => Object.assign(p, { x: (i - 2) * 3, z: -1 - Math.abs(i - 2) * 2, yaw: pi }));
  }
}
function advanceTarget(hit) {
  const t = match.trial;
  if (!t) return;
  if (hit) t.score++;
  const targets = match.players.filter((p) => p.target);
  if (t.count === 30) {
    match.trial = null;
    targets.forEach((p) => {
      p.down = false;
      p.hp = 100;
    });
    announce('사격 시험 완료 · ' + t.score + ' / 30', 10);
    return;
  }
  t.count++;
  t.next = now + [3, 1.5, 0.9][match.level ?? 0];
  const index = (t.count * 3 + Math.floor(t.count / 5)) % targets.length;
  targets.forEach((p, i) => {
    p.down = i !== index;
    p.hp = 100;
  });
}
function startTrial() {
  match.trial = { count: 0, score: 0 };
  advanceTarget(false);
}
function clearMatch() {
  if (!match) return;
  world.first.dispose();
  match.players.forEach((p) => {
    p.model.animate?.dispose?.();
    p.model.g.removeFromParent();
  });
  match.devices.forEach((d) => disposeDevice(d));
  match = undefined;
}
function announce(text, seconds = 2) {
  match.hudUntil = now + seconds;
  match.hudText = text;
}
function observer() {
  const local = match.player;
  if (!local.down) return local;
  const teammates = match.players.filter((p) => p.team === local.team && alive(p));
  return teammates[match.observer % teammates.length] ?? local;
}
function floorAt(x, z, limit, radius = 0.28) {
  let y = world.structure.support(x, z, limit, radius);
  for (const d of match?.devices ?? [])
    if (
      d.type === 'wall' &&
      d.y + d.h <= limit + 0.002 &&
      Math.abs(x - d.x) < d.w / 2 + 0.12 &&
      Math.abs(z - d.z) < d.d / 2 + 0.12
    )
      y = Math.max(y, d.y + d.h);
  return y;
}
const grounded = (p) => p.ride == null && Math.abs(p.y - floorAt(p.x, p.z, p.y + 0.04)) < 0.055;
function move(p, dx, dz) {
  for (const [axis, delta, vel] of [
    ['x', dx, 'vx'],
    ['z', dz, 'vz'],
  ]) {
    if (!delta) continue;
    const x = p.x + (axis === 'x' ? delta : 0),
      z = p.z + (axis === 'z' ? delta : 0);
    const onFloor = grounded(p),
      next = onFloor ? floorAt(x, z, p.y + 0.33) : -Infinity;
    const feet = Math.max(p.y, next);
    if (!world.intersects(x, z, feet, 0.28, match.devices, p.height + 0.12)) {
      p[axis] += delta;
      p.y = feet;
    } else p[vel] = 0;
  }
}
function environmentDeath(p) {
  if (practice()) {
    respawn(p);
    return;
  }
  p.down = true;
  p.hp = 0;
  p.deaths++;
  p.respawnAt = now + 3;
  if (match.core.carrier === p) {
    dropCore(p);
    Object.assign(match.core, p.lastGround ?? {});
  }
  if (match.core.actor === p) clearChannel();
}
function fieldSound(event,at) {
  const self=match.player, distance=range(self,at);
  if(distance>38 || (at!==self && self.deafUntil>now))return;
  const pan=distance<.1?0:((at.x-self.x)*Math.cos(self.yaw)-(at.z-self.z)*Math.sin(self.yaw))/distance;
  fieldAudio(audio,event,settings.volume*.8/(1+distance*.12),pan);
}
function footSound(p,ice) {
  p.stepSurface=ice?'ice':'';
  if(ice)fieldSound('ice-step',p);else sound('step',p.local?undefined:p);
}
function spatialSteps(p, dt) {
  const speed = Math.hypot(p.vx, p.vz);
  const ice = p.iceUntil > now;
  if (!(ice ? p.mode==='run' && grounded(p) && speed>.8 : audibleStep(p.mode, speed, grounded(p)))) {
    p.foot = 0;
    return;
  }
  p.foot += speed * dt;
  if (p.foot >= (ice?1.25:1.9)) {
    p.stepCount++;
    footSound(p,ice);
    p.foot = 0;
  }
}
const localKeys = keys;
function walk(dt, p = match.player, keys = localKeys) {
  if (p.down) return;
  if (match.core.actor === p) {
    p.vx = p.vz = 0;
    return;
  }
  if (p.suspendedUntil > now) {
    p.y += ((p.holdY ?? p.y) - p.y) * Math.min(1, dt * 8);
    p.vy = p.vx = p.vz = 0;
    return;
  }
  if (p.trappedBy || p.downedKayo) {
    p.vx = p.vy = p.vz = 0;
    return;
  }
  if (p.flow) {
    if (now < p.flow.start) {
      p.vy = 0;
      return;
    }
    const f = p.flow,
      delta = vec(f.x - p.x, f.y - p.y - p.height * 0.6, f.z - p.z),
      distance = delta.length();
    if (distance < 0.5) {
      p.flow = null;
      return;
    }
    delta.multiplyScalar(Math.min(distance, 22.5 * dt) / distance);
    move(p, delta.x, delta.z);
    if (!world.structure.blocked(p.x, p.z, p.y + delta.y, 0.25, p.height)) p.y += delta.y;
    if (now > f.start + 0.75) p.flow = null;
    return;
  }
  if (p.lightRush && now < p.lightRush.end) {
    const [x, y, z] = p.lightDir;
    move(p, x * 23 * dt, z * 23 * dt);
    if (y > 0 && !world.structure.blocked(p.x, p.z, p.y + y * 0.3 + 0.1, 0.25, p.height)) p.y += y * 15 * dt;
    p.vx = p.vy = p.vz = 0;
    return;
  }
  if (p.dashTime > 0) {
    const t = Math.min(dt, p.dashTime);
    const dist = (11 * t) / 0.45 * (p.iceUntil>now?.5:1);
    move(p, p.dashX * dist, p.dashZ * dist);
    p.dashTime -= t;
    p.vx = p.vz = p.vy = 0;
    return;
  }
  if (p.pilot) {
    p.vx = p.vz = 0;
    if (p.pilot.ready > now) return;
    updatePilot(p, keys, dt, world, match.devices);
    return;
  }
  if (rideStep(world.mechanisms, p, keys, dt)) return;
  const x = +keys.has('KeyD') - +keys.has('KeyA');
  const z = +keys.has('KeyW') - +keys.has('KeyS');
  p.mode =
    p.netUntil > now || p.slideUntil > now || keys.has('ControlLeft') || keys.has('ControlRight')
      ? 'crouch'
      : keys.has('ShiftLeft') || keys.has('ShiftRight')
        ? 'walk'
        : 'run';
  const length = Math.hypot(x, z) || 1;
  const dx = (x * Math.cos(p.yaw) - z * Math.sin(p.yaw)) / length;
  const dz = (-x * Math.sin(p.yaw) - z * Math.cos(p.yaw)) / length;
  [p.vx, p.vz] = velocityStep(
    p.vx,
    p.vz,
    dx,
    dz,
    (p.sprinting ? 9.11 : SPEED[p.mode]) *
      (p.ads ? (weaponFor(p).ads?.runSpeedMultiplier ?? 0.75) : weaponFor(p).move) *
      (p.hasteUntil>now?1.1:1) * Math.min(p.detainedUntil > now ? 0.18 : p.tag > now ? 0.57 : 1,
        Math.max(p.iceUntil,p.slowUntil,p.hinderedUntil)>now ? .5 : 1),
    dt,
  );
  if (p.slideUntil > now) {
    const speed=p.iceUntil>now?5.5:11;
    p.vx = p.slideX * speed;
    p.vz = p.slideZ * speed;
  }
  if (p.tether?.until > now && Math.hypot(p.x + p.vx * dt - p.tether.x, p.z + p.vz * dt - p.tether.z) >
      Math.max(p.tether.radius ?? 5, Math.hypot(p.x-p.tether.x,p.z-p.tether.z))) {
    p.vx = p.vz = 0;
  }
  const attackStart = isAttack(p);
  const futureZ = p.z + p.vz * dt;
  const spawn = sidePosition(attackStart, p.i);
  const inSpawn = Math.hypot(p.x - spawn[0], futureZ - spawn[1]) < 9;
  move(p, p.vx * dt, match.phase === 'buy' && !inSpawn ? 0 : p.vz * dt);
  if (match.phase === 'buy' && !inSpawn) p.vz = 0;
  const onFloor = grounded(p);
  if (onFloor) {
    p.lastGround = { x: p.x, y: p.y, z: p.z };
    if (p.vy < 0) p.vy = 0;
  }
  if (onFloor && keys.has('Space') && !p.jumpHeld && p.mode !== 'crouch') {
    const ice=p.iceUntil>now;
    p.vy=ice||p.slowUntil>now?3.96:5.6;
    if(ice){p.stepCount++;footSound(p,true);}
  }
  p.jumpHeld = keys.has('Space');
  if (!onFloor || p.vy > 0) {
    if (p.agent === '제트' && keys.has('Space') && p.vy < 0) p.vy = Math.max(-2.2, p.vy - dt * 2.5);
    else p.vy -= dt * 18.5;
    const dest = p.y + p.vy * dt,
      top = p.height + 0.12;
    if (p.vy > 0) {
      const ceiling = world.structure.ceiling(p.x, p.z, p.y + top, dest + top);
      p.y = Number.isFinite(ceiling) ? ceiling - top : dest;
      if (Number.isFinite(ceiling)) p.vy = 0;
    } else {
      const ground = floorAt(p.x, p.z, p.y + 0.02);
      p.y = Math.max(ground, dest);
      if (p.y === ground) p.vy = 0;
    }
    if (p.y < -18) {
      environmentDeath(p);
      return;
    }
  }
  const canStand = !world.intersects(p.x, p.z, p.y, 0.27, match.devices, 1.65);
  if (!canStand) p.mode = 'crouch';
  p.height += ((p.mode === 'crouch' ? 1.05 : 1.53) - p.height) * Math.min(1, dt * 16);
  spatialSteps(p, dt);
}
function clearChannel() {
  match.core.actor = null;
  match.core.progress = 0;
}
function eliminate(p, attacker, attack) {
  if (p.agent === '케이/오' && p.overloadedUntil > now && !p.downedKayo) {
    p.overloadedUntil = 0;
    const shell = addDevice('agentPulse', p.x, p.z, p.team, 15, 0.63, 0.63, 0.8, '#996ddd', p, p.y);
    Object.assign(shell, { kind: 'stabilize', hp: 850, killer: attacker.id });
    Object.assign(p, { downedKayo: shell.id, detainedUntil: now + 15, hp: 1, shield: 0, tag: now + 15 });
    return;
  }
  if (p.duel) {
    const rival = match.players.find((o) => o.id === p.duel.other);
    if (rival?.duel) rival.duel.returnAt = now + 2;
    Object.assign(p, p.duel.origin);
    p.duel = null;
  }
  if (attack?.weapon === 'blades' && !attack.alt && attacker.kit.special?.id === 'blades')
    attacker.kit.special.mag = 5;
  if (p.recall) {
    Object.assign(p, p.recall, { recall: null, hp: 100, vy: 0 });
    return;
  }
  if (attacker !== p) {
    if (attacker.agent === '클로브') {
      attacker.pickupUntil = now + 5;
      attacker.mustKillBy = 0;
    }
    if (attacker.link && attacker.stimUntil > now) {
      const ally = match.players.find((o) => o.id === attacker.link && !o.down);
      if (ally) attacker.stimUntil = ally.stimUntil = now + 8;
    }
    if (attacker.empress) {
      attacker.healLeft = 100;
      attacker.healRate = 33.34;
      attacker.healTick = 0;
      attacker.canOverheal = true;
    }
    if (attack?.weapon === 'tour')
      addDevice('slow', p.x, p.z, attacker.team, 4, 10, 10, 0.18, '#d8b25c', attacker, p.y);
  }
  if (attacker !== p && attacker.agent === '레이나')
    addDevice('soul', p.x, p.z, attacker.team, 3, 0.45, 0.45, 0.55, '#b142dc', attacker, p.y + 0.65);
  if (attacker.agent === '네온' && attacker.beamUntil > now) {
    attacker.beamUntil = now + 10;
    attacker.beamAmmo = 40;
    attacker.fuel = 100;
  }
  if (attacker.agent === '제트' && hostile(attacker, p) && !attacker.charges[2]) {
    attacker.dashKills = (attacker.dashKills ?? 0) + 1;
    if (attacker.dashKills >= 2) {
      attacker.charges[2] = 1;
      attacker.dashKills = 0;
    }
  }
  const skin = attack?.weapon === heldWeapon(attacker)?.id ? currentSkin(attacker) : undefined;
  attacker.roundKills = (attacker.roundKills ?? 0) + 1;
  attacker.lastKill = {
    style: skin?.killOn ? skin.banner : 'default',
    head: attack?.head === true,
    count: attacker.roundKills,
    variant: skin?.variants?.findIndex((v) => v.id === skin.variant) + 1 || 0,
  };
  if (attacker.local && !killBanner(attacker.lastKill, settings.volume)) sound('kill');
  if (
    attacker !== p &&
    match.players.filter((o) => hostile(attacker, o) && !o.down && o !== p).length === 0 &&
    !dm() &&
    !practice()
  ) {
    const family = skin?.family;
    if (Object.hasOwn(palettes, family)) match.endFx = { family, x: p.x, y: p.y, z: p.z, at: now };
  }
  if (mode === 'range' && !p.local) {
    p.hp = 100;
    attacker.kills++;
    if (match.trial) advanceTarget(true);
    return;
  }
  p.down = true;
  p.pilot = null;
  p.sprinting = false;
  p.beamUntil = 0;
  p.queuedSkill = null;
  p.respawnAt = now + 3;
  p.deaths++;
  p.ult++;
  attacker.ult++;
  if (attacker.ult >= AGENTS[attacker.agent].economy[3].points) attacker.charges[3] = 1;
  if (match.core.carrier === p && match.core.state === 'carried') dropCore(p);
  if (match.core.actor === p) clearChannel();
  attacker.kills++;
  attacker.credits = Math.min(9000, attacker.credits + 200);
  match.feed.push({ text: attacker.name + ' ▸ ' + p.name, end: now + 4.5 });
  if (p.local) announce('탈락 · 좌클릭으로 관전 전환');
}
function hurt(p, amount, attacker, attack) {
  if (amount > 0 && p.pilot?.kind === '잠입 드론') p.pilot = null;
  if (p.downedKayo) {
    const core = match.devices.find((d) => d.id === p.downedKayo);
    if (core) {
      core.hp -= amount;
      if (core.hp <= 0) core.end = now;
    }
    return;
  }
  if (p.phaseUntil > now || (p.evolution && !attack?.weapon) || (p.duel && p.duel.other !== attacker?.id))
    return;
  if (p.isoShield && amount > 0) {
    p.isoShield = false;
    return;
  }
  if (p.overheal > 0) {
    const used = Math.min(amount, p.overheal);
    p.overheal -= used;
    amount -= used;
    if (amount <= 0) return;
  }
  if (attacker && attacker !== p) p.lastAttacker = { id: attacker.id, at: now };
  amount *= p.vulnerable > now ? 2 : 1;
  const absorbed = Math.min(p.shield, Math.round(amount * 0.66));
  p.shield -= absorbed;
  p.hp = Math.max(0, p.hp - (amount - absorbed));
  p.tag = now + 0.28;
  if (p.hp === 0) eliminate(p, attacker, attack);
}
function presentStrike(p) {
  const e = p.strike;
  if (!e) return;
  const near = p.local ? 0 : range(match.player, p),
    volume = (settings.volume * 0.82) / (1 + near * 0.32);
  if (e.weapon === 'melee' || e.weapon === 'blades') {
    if (near < 28) {
      const custom =
        e.weapon === 'melee' && playSkinEvent(currentSkin(p), e.alt ? 'heavy' : 'light', 0.5, volume);
      if (!custom)
        recordedEffect(e.weapon === 'blades' ? 'blade-throw' : e.alt ? 'knife-heavy' : 'knife-light', volume);
    }
  } else if (e.weapon !== 'overdrive') {
    sound('shot', p.local ? undefined : p);
    if (p.local) match.flash = now + 0.06;
  }
  if (
    !Array.isArray(e.ends) ||
    !Array.isArray(e.origin) ||
    e.origin.length !== 3 ||
    !e.origin.every(Number.isFinite)
  )
    return;
  const origin = new T.Vector3().fromArray(e.origin);
  for (const v of e.ends.slice(0, 24)) {
    if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite)) continue;
    const end = new T.Vector3().fromArray(v);
    if (e.weapon === 'overdrive') world.trace(origin, end, now, '#3bd9ff', 0.12);
    else if (e.weapon === 'blades') world.throwBlade(origin, end, now);
    else world.trace(origin, end, now, palettes[currentSkin(p)?.family]);
  }
}
function swingContact(p) {
  const e = p.strike;
  if (!e || p.selected !== 'melee' || p.down) return;
  const origin = vec(p.x, p.y + p.height, p.z),
    forward = aim(p.yaw, p.pitch),
    len = e.alt ? 1.9 : 2.25,
    reach = new T.Ray(origin, forward),
    obstacle = {};
  const distance = world.mapHit(reach, len, match.devices, false, obstacle);
  let target,
    closest = Infinity;
  for (const o of match.players) {
    if (o === p || o.down || !hostile(p, o)) continue;
    const core = vec(o.x, Math.min(o.y + o.height + 0.06, Math.max(o.y + 0.14, origin.y)), o.z),
      delta = core.sub(origin),
      dist = delta.length();
    if (dist > len + 0.26 || dist >= closest || dist < 0.001) continue;
    delta.multiplyScalar(1 / dist);
    if (
      forward.dot(delta) < Math.cos(((e.alt ? 21 : 39) * pi) / 180) ||
      world.mapHit(new T.Ray(origin, delta), dist, match.devices) < dist - 0.23
    )
      continue;
    target = o;
    closest = dist;
  }
  if (target) {
    hurt(target, meleeDamage(e.alt, Math.atan2(target.x - p.x, target.z - p.z) + pi, target.yaw), p, e);
    p.hits++;
    if (p.local) {
      match.hit = now + 0.13;
      sound('hit');
    }
  } else if (distance < len) {
    if (obstacle.mechanism) damageMechanism(obstacle.mechanism, e.alt ? 75 : 50);
    if (obstacle.device?.hp) {
      obstacle.device.hp -= e.alt ? 75 : 50;
      if (obstacle.device.hp <= 0) obstacle.device.end = now;
    }
  }
}
function shoot(p, alt = false, follow = false) {
  const item = heldWeapon(p),
    stats = weaponFor(p);
  if (
    !item ||
    p.down ||
    p.reloading ||
    p.nextShot > now ||
    !active() ||
    p.phaseUntil > now ||
    p.detainedUntil > now ||
    (p.jammedUntil > now && p.selected === 'primary')
  )
    return;
  if (p.beamUntil > now) {
    if (p.beamAmmo <= 0) {
      if (!p.beamRefill) p.beamRefill = now + 0.5;
      if (now < p.beamRefill) return;
      p.beamRefill = 0;
      p.beamAmmo = 40;
    }
    p.beamAmmo--;
    p.nextShot = now + 1 / 20;
    p.shot = now;
    const beam = new T.Ray(vec(p.x, p.y + p.height, p.z), aim(p.yaw, p.pitch));
    let reach = world.mapHit(beam, 80, match.devices),
      victim;
    for (const o of match.players) {
      if (!hostile(p, o) || o.down) continue;
      const hit = world.hitBox(beam, o.x, o.y, o.z, 0.54, o.height + 0.12, 0.45);
      if (hit < reach) {
        reach = hit;
        victim = o;
      }
    }
    p.strike = {
      weapon: 'overdrive',
      at: now,
      origin: beam.origin.toArray(),
      ends: [beam.at(reach, new T.Vector3()).toArray()],
    };
    presentStrike(p);
    if (victim) hurt(victim, 18, p);
    return;
  }
  if (p.sprinting && !(p.slideUntil > now)) return;
  if (item.id === 'melee') {
    if (p.local && p.inspectUntil > now) stopAnimationAudio();
    const combo =
      !alt && p.strike?.weapon === 'melee' && !p.strike.alt && now - p.shot < 1.15
        ? (p.strike.combo % 5) + 1
        : 1;
    p.shot = now;
    p.shots++;
    p.inspectUntil = 0;
    p.strike = { weapon: 'melee', combo, alt, at: now };
    p.swingAt = now + (alt ? 0.24 : 0.12);
    p.nextShot = now + (alt ? 1 : 0.5);
    presentStrike(p);
    return;
  }
  const blade = item.id === 'blades',
    pattern = shotPattern(item.id, alt, item.mag, stats, Math.hypot(p.vx, p.vz), !grounded(p), p.bloom);
  const adsBurst = p.ads && (stats.ads?.burstCount ?? 1) > 1;
  if (item.mag === 0) {
    reload(p);
    return;
  }
  const count = pattern?.count ?? 1;
  const combo = blade ? 6 - item.mag : 1;
  if (adsBurst && !follow) p.burstRemaining = Math.min(stats.ads.burstCount, item.mag) - 1;
  item.mag -= count;
  if (p.local && p.inspectUntil > now) stopAnimationAudio();
  const attack = (p.strike = { weapon: item.id, alt, combo, at: now, ends: [] });
  p.inspectUntil = 0;
  p.shots++;
  p.shot = now;
  p.nextShot =
    now +
    (pattern?.interval ?? (p.ads && stats.ads ? 1 / stats.ads.fireRate : stats.interval)) *
      (p.stimUntil > now ? 0.85 : 1)*(p.hinderedUntil>now?2:1);
  if (adsBurst && p.burstRemaining > 0) p.nextShot = now + 0.065;
  const origin = vec(p.x, p.y + p.height, p.z);
  const shotStats =
    p.ads && stats.ads
      ? { ...stats, spread: (Math.max(0, stats.ads.firstBulletAccuracy) * pi) / 180 }
      : stats;
  const spread =
    pattern?.cone ?? spreadFor(shotStats, Math.hypot(p.vx, p.vz), !grounded(p), p.mode === 'crouch', p.bloom);
  const forward = aim(p.yaw, p.pitch),
    shell = alt && item.id === 'bucky';
  let burstDist = shell ? stats.burst.burstDistance : 0;
  if (shell) {
    const preload = new T.Ray(origin, forward);
    let stop = world.mapHit(preload, burstDist, match.devices);
    for (const o of match.players)
      if (o !== p && !o.down)
        stop = Math.min(stop, world.hitBox(preload, o.x, o.y, o.z, 0.61, o.height + 0.13, 0.45));
    if (stop < burstDist) burstDist = 0;
  }
  const base = origin.clone().addScaledVector(forward, burstDist),
    pellets = shell ? (burstDist ? stats.burst.shotgunPelletCount : 1) : stats.pellets * count;
  attack.origin = origin
    .clone()
    .add(vec(0, -0.11, 0))
    .toArray();
  for (let pellet = 0; pellet < pellets; pellet++) {
    const spin = Math.random() * 2 * pi,
      cone = shell && !burstDist ? 0 : Math.sqrt(Math.random()) * spread;
    const line = new T.Ray(
      base,
      aim(p.yaw + Math.cos(spin) * cone, p.pitch + Math.sin(spin) * cone + (blade ? 0 : p.bloom * 0.43)),
    );
    const impact = {};
    let nearest = world.mapHit(line, stats.range, match.devices, false, impact),
      hit = null,
      zone = 'bodyDamage';
    for (const o of match.players) {
      if (o === p || o.down || o.phaseUntil > now) continue;
      const top = o.height + 0.13;
      for (const [part, base, h, w] of [
        ['headDamage', top - 0.38, 0.38, 0.45],
        ['bodyDamage', top * 0.31, top * 0.69 - 0.38, 0.61],
        ['legDamage', 0, top * 0.31, 0.45],
      ]) {
        const d = world.hitBox(line, o.x, o.y + base, o.z, w, h, 0.43);
        if (d < nearest) {
          nearest = d;
          hit = o;
          zone = part;
        }
      }
    }
    let drone = null;
    for (const o of match.players) {
      const v = o.pilot;
      if (!v?.hp || !hostile(p, o)) continue;
      const dist = world.hitBox(line, v.x, v.y - 0.23, v.z, 0.62, 0.46, 0.62);
      if (dist < nearest) {
        drone = o;
        nearest = dist;
        hit = null;
      }
    }
    if (drone) {
      drone.pilot.hp -= stats.damage;
      if (drone.pilot.hp <= 0) releasePilot(drone);
      delete impact.mechanism;
      delete impact.device;
    }
    if (!hit && impact.mechanism)
      damageMechanism(
        impact.mechanism,
        stats.damageRanges.find((r) => nearest < r.rangeEndMeters)?.bodyDamage ?? stats.damage,
      );
    if (!hit && impact.device?.hp) {
      impact.device.hp -= stats.damage;
      if (impact.device.hp <= 0) {
        const d = impact.device;
        if (d.kind === 'decoy') {
          d.type = 'wallFlash';
          d.travel = false;
          d.angle = Math.atan2(p.x - d.x, p.z - d.z);
          d.start = now + 0.6;
          d.next = d.start;
          d.end = d.start + 0.12;
          d.flashDuration = 2;
          d.radius = 20;
        } else d.end = now;
      }
    }
    if (!pellet || alt || blade) attack.ends.push(line.at(nearest, vec(0, 0, 0)).toArray());
    if (hit && hostile(p, hit)) {
      const band =
        stats.damageRanges.find((r) => nearest + burstDist < r.rangeEndMeters) ?? stats.damageRanges.at(-1);
      attack.head = zone === 'headDamage';
      hurt(hit, Math.floor(band?.[zone] ?? stats.damage), p, attack);
      p.hits++;
      if (p.local) {
        sound('hit');
        match.hit = now + 0.13;
      }
    }
  }
  presentStrike(p);
  if (!blade) p.bloom = Math.min(0.08, p.bloom + stats.recoil);
  else if (!item.mag) p.bladeRetireAt = p.nextShot;
}
function reload(p) {
  const weapon = heldWeapon(p);
  const stats = weaponFor(p);
  if (!weapon || p.reloading || weapon.mag === stats.size || !weapon.reserve) return;
  p.burstRemaining = 0;
  p.inspectUntil = 0;
  if (p.local) stopAnimationAudio();
  p.reloadDuration=stats.reload*(p.hinderedUntil>now?2:1);
  p.reloading=now+p.reloadDuration;
  sound('reload', p.local ? undefined : p);
}
function updateWeapon(p, dt) {
  p.bloom = Math.max(0, p.bloom - dt * (p.hinderedUntil>now?.016:.032));
  if (!p.reloading || now < p.reloading) return;
  const weapon = heldWeapon(p);
  const need = Math.min(weapon.reserve, weaponFor(p).size - weapon.mag);
  weapon.reserve -= need;
  weapon.mag += need;
  p.reloading = 0;
}
function equip(slot, p = match.player) {
  if (
    !p.kit[slot] ||
    p.selected === slot ||
    (slot === 'primary' && p.jammedUntil > now) ||
    p.detainedUntil > now
  )
    return;
  p.lastCast = null;
  p.swingAt = 0;
  p.shot = -10;
  p.strike = null;
  p.selected = slot;
  p.inspectUntil = 0;
  if (p.local) {
    stopAnimationAudio();
    sound('equip');
  }
  p.burstRemaining = 0;
  p.reloading = 0;
  p.nextShot = now + weaponFor(p).equip*(p.hinderedUntil>now?2:1);
  p.bloom = 0;
}

function visible(p, target) {
  const from = vec(p.x, p.y + p.height, p.z);
  const delta = vec(target.x, target.y + target.height * 0.75, target.z).sub(from);
  const distance = delta.length();
  if (distance > 24 || distance < 0.05) return false;
  return world.mapHit(new T.Ray(from, delta.normalize()), distance, match.devices, true) >= distance - 0.03;
}

function disposeDevice(device) {
  device.mesh.removeFromParent();
  device.mesh.material.dispose();
  if (device.mesh.userData.owned) device.mesh.geometry.dispose();
}
function dropCore(p) {
  Object.assign(match.core, { state: 'dropped', carrier: null, x: p.x, y: p.y, z: p.z });
  clearChannel();
}
function channel(dt) {
  const core = match.core;
  const p = match.player;
  if (match.phase === 'fight' && core.state === 'dropped') {
    const pickup = match.players.find(
      (o) => alive(o) && isAttack(o) && Math.hypot(range(o, core), o.y - (core.y ?? 0)) < 1.05 && o.channel,
    );
    if (pickup) {
      Object.assign(core, { state: 'carried', carrier: pickup });
    }
  }
  const canAct = (o) => alive(o) && !(o.detainedUntil > now) && grounded(o) && o.channel;
  const planting = match.phase === 'fight';
  const eligible = (o) =>
    canAct(o) &&
    (planting
      ? (core.carrier === o || (rush() && isAttack(o))) && siteAt(o.x, o.z, o.y)
      : !isAttack(o) && Math.hypot(range(o, core), o.y - (core.y ?? 0)) < 1.7);
  if (core.actor && !eligible(core.actor)) {
    clearChannel();
    if (!planting && core.half) core.progress = TIMES.defuse / 2;
  }
  core.actor ??= match.players.find(eligible) ?? null;
  if (!core.actor) return;
  core.progress += dt;
  if (!planting && core.progress >= TIMES.defuse / 2) core.half = true;
  if (core.progress < (planting ? TIMES.plant : TIMES.defuse)) return;
  if (planting) {
    const { x, y, z } = core.actor;
    Object.assign(core, { x, y, z, site: siteAt(x, z).id, state: 'planted', carrier: null });
    core.half = false;
    setPhase('objective', TIMES.objective);
    sound('objective');
    announce(core.site + ' 거점 스파이크 활성', 3);
  } else {
    core.state = 'defused';
    finish(other(match.attack), '스파이크 해제 완료');
  }
  clearChannel();
}
function addDevice(type, x, z, team, duration, w, d, h, color, owner, baseY) {
  const support = floorAt(x, z, (owner?.y ?? 0) + 2);
  const y = baseY ?? (Number.isFinite(support) ? support : (owner?.y ?? 0));
  const mesh = deviceMesh(type, color, w, h, d);
  mesh.position.set(x, y + h / 2, z);
  world.scene.add(mesh);
  const device = {
    id: ++sequence,
    type,
    y,
    x,
    z,
    team,
    w,
    d,
    h,
    color,
    owner: owner?.id,
    born: now,
    end: now + duration,
    mesh,
  };
  match.devices.push(device);
  if (
    type === 'lane' &&
    !match.devices.some(
      (v) =>
        v !== device &&
        v.type === 'lane' &&
        Math.hypot(v.x - x, v.z - z) < 5 &&
        Math.abs(v.born - now) < 0.08,
    )
  )
    recordedEffect('neon', settings.volume / (1 + range(match.player, device) * 0.12));
  if (type === 'dronePulse')
    recordedEffect('tejo-pulse', settings.volume / (1 + range(match.player, device) * 0.12));
  return device;
}
function fieldContext() {
  const { core, players } = match;
  return {
    time: now,
    players,
    core,
    hostile,
    visible: hasSight,
    hurt,
    move,
    canPlant: siteAt,
    attacking: isAttack,
    add(type, x, z, seconds, w, d, h, color, p, y) {
      return addDevice(type, x, z, p.team, seconds, w, d, h, color, p, y);
    },
    trace(d, target, color) {
      if (skillAudio[d.name]?.impact) d.cueAt = now;
      world.trace(
        vec(d.x, d.y + 0.4, d.z),
        vec(target.x, target.y + target.height * 0.7, target.z),
        now,
        color,
        0.12,
      );
    },
    ring(d, owner, radius) {
      const pulse = addDevice(
        'sonar',
        d.x,
        d.z,
        owner.team,
        0.45,
        radius * 2,
        radius * 2,
        radius * 2,
        d.color,
        owner,
        d.y - radius,
      );
      if (skillAudio[d.name]?.impact) Object.assign(pulse, { name: d.name, cueAt: now });
    },
    travel(d, dx, dz) {
      const x = d.x + dx,
        z = d.z + dz;
      const y = d.airborne ? d.y : floorAt(x, z, d.y + 1.2);
      if (!Number.isFinite(y) || world.structure.blocked(x, z, y + 0.09, 0.18, 0.3)) return false;
      Object.assign(d, { x, z, y });
      return true;
    },
    objective(d, owner) {
      const at = d.objective;
      if (at.operation === 'plant' && core.carrier === owner && siteAt(d.x, d.z, d.y)) {
        Object.assign(core, {
          x: d.x,
          y: d.y,
          z: d.z,
          site: siteAt(d.x, d.z, d.y).id,
          state: 'planted',
          carrier: null,
          actor: null,
          progress: 0,
          half: false,
        });
        setPhase('objective', TIMES.objective);
        sound('objective');
      } else if (at.operation === 'defuse' && core.state === 'planted') {
        core.state = 'defused';
        finish(other(match.attack), '지원봇이 스파이크를 해제했습니다');
      }
    },
  };
}
function owned(p, name) {
  return match.devices.find((d) => d.owner === p.id && d.kind === deviceKind(name) && d.end > now);
}
function deviceAction(p, d) {
  if (!d || d.owner !== p.id || d.end <= now) return;
  if (d.kind === 'anchor' || d.kind === 'passage' || d.kind === 'gatecrash' || d.kind === 'beacon') {
    if (d.kind === 'anchor' && range(p, d) > 18) return;
    const at = world.structure.spawn(d.x, d.z, d.y);
    Object.assign(p, at, { vy: 0, vx: 0, vz: 0 });
    if (d.kind !== 'anchor') d.end = now;
    else d.lock = now + 25;
    return;
  }
  if (d.kind === 'decoyMark') {
    d.kind = 'decoy';
    d.type = 'decoy';
    d.hp = 150;
    d.travel = true;
    d.end = now + 10;
    return;
  }
  if (d.kind === 'camera') {
    p.pilot = p.pilot ? null : { kind: '스파이캠', x: d.x, y: d.y + 0.2, z: d.z, end: d.end, device: d.id };
    return;
  }
  if (d.kind === 'rose') {
    d.type = 'wallFlash';
    d.start = now + 0.5;
    d.next = d.start;
    d.end = d.start + 0.12;
    d.flashDuration = 2;
    d.radius = 20;
    return;
  }
  if (['poisonLine', 'poisonOrb'].includes(d.kind)) {
    if (!d.on && p.fuel < 20) return;
    d.on = !d.on;
    for (const v of match.devices) if (v.parent === d.id) v.end = now;
    if (d.on) {
      const count = d.kind === 'poisonOrb' ? 1 : 13;
      for (let i = 0; i < count; i++) {
        const x = d.x - Math.sin(d.angle) * i * 2,
          z = d.z - Math.cos(d.angle) * i * 2,
          y = world.structure.support(x, z, d.y + 5);
        if (!Number.isFinite(y)) continue;
        const v = addDevice(
          'smoke',
          x,
          z,
          p.team,
          120,
          count === 1 ? 8 : 2.2,
          count === 1 ? 8 : 2.2,
          5,
          '#519c5a',
          p,
          y,
        );
        v.parent = d.id;
      }
    }
    return;
  }
  if (d.kind === 'interceptor') {
    d.on = !d.on;
    return;
  }
  const fire = ['vine', 'swarm'].includes(d.kind);
  addDevice(
    fire ? 'fire' : 'smoke',
    d.x,
    d.z,
    p.team,
    fire ? 4.5 : 7,
    fire ? 8 : 7,
    fire ? 8 : 7,
    fire ? 0.18 : 5,
    fire ? '#a482ce' : '#9ac9d6',
    p,
    d.y,
  );
  d.end = now;
}
function aimedDevice(p) {
  return targetedDevice(
    p,
    match.devices.filter((d) => d.end > now),
    new T.Ray(vec(p.x, p.y + p.height, p.z), aim(p.yaw, p.pitch)),
  );
}
function dropGlobule(p, at, slot) {
  const floor = floorAt(at.x, at.z, at.y + 0.6);
  if (!Number.isFinite(floor)) return;
  const g = addDevice('globule', at.x, at.z, p.team, 20, 0.45, 0.45, 0.45, '#8ccce2', p, floor);
  g.slot = slot;
}
function releasePilot(p) {
  if (p.pilot?.kind === '요동봇' && !p.reclaimedThrash) dropGlobule(p, p.pilot, 3);
  p.pilot = null;
}
function pilotFire(p) {
  const v = p.pilot;
  if (!v || v.next > now || v.ready > now) return;
  if (v.kind === '요동봇' || v.kind === '정찰자') {
    if (v.lungeEnd) return;
    v.lungeYaw = p.yaw;
    v.lungeEnd = now + 0.34;
    v.end = v.lungeEnd + 0.15;
    return;
  }
  if (v.kind === '잠입 드론') {
    const wave = addDevice('dronePulse', v.x, v.z, p.team, 1.1, 32, 32, 32, '#ecb662', p, v.y + 0.85 - 16);
    wave.delay = 0.4;
    wave.tagged = [];
    p.pilot = null;
    return;
  }
  const line = new T.Ray(vec(v.x, v.y, v.z), aim(p.yaw, p.pitch)),
    distance = world.mapHit(line, 42, match.devices);
  for (const o of match.players) {
    if (o === p || o.down || !hostile(p, o)) continue;
    const point = vec(o.x, o.y + o.height * 0.65, o.z),
      target = point.clone().sub(line.origin).dot(line.direction);
    if (['스파이캠', '올빼미 드론'].includes(v.kind)) {
      if (target < 0 || target > distance || line.distanceToPoint(point) > 0.65) continue;
      o.revealTeam = p.team;
      o.revealEnd = now + 4;
    } else if (hasSight(v, o, v.kind === '잠입 드론' ? 12 : 5)) {
      if (v.kind === '잠입 드론') {
        o.revealTeam = p.team;
        o.revealEnd = now + 3;
        o.suppressed = now + 6;
      } else {
        o.tag = now + 4;
        if (v.kind === '정찰자') hurt(o, 30, p);
      }
    }
  }
  v.next = now + 4;
  if (!['스파이캠', '올빼미 드론'].includes(v.kind)) p.pilot = null;
}
function ability(i, p = match.player, params = {}) {
  if (p.detainedUntil > now) return;
  if (p.agent === '클로브' && i === 3 && active()) {
    if (p.phaseUntil > now && p.mustKillBy) {
      p.phaseUntil = now;
      return;
    }
    if (!p.down || (!practice() && !p.charges[3])) return;
    Object.assign(p, {
      down: false,
      hp: 100,
      shield: 0,
      phaseUntil: now + 2,
      nextShot: now + 1.5,
      mustKillBy: now + 12,
    });
    p.charges[3] = 0;
    p.ult = 0;
    abilityVoice(p, '아직 안 죽었어');
    return;
  }
  if (p.agent === '아스트라' && i === 3 && params.star) {
    const m = params.star;
    if (
      !p.down &&
      active() &&
      !(p.suppressed > now) &&
      Number.isFinite(m.x) &&
      Number.isFinite(m.z) &&
      Math.abs(m.x) <= HALF &&
      Math.abs(m.z) <= HALF &&
      (practice() || p.stars > 0)
    ) {
      const y = floorAt(m.x, m.z, p.y + 20);
      if (Number.isFinite(y)) {
        const d = addDevice('star', m.x, m.z, p.team, 300, 0.7, 0.7, 0.25, '#bf89ff', p, y + 0.06);
        d.start = now + 0.5;
        if (!practice()) p.stars--;
      }
    }
    return;
  }
  if (p.armedSlot === i && now < p.skillReady) {
    p.queuedSkill = { i, params };
    return;
  }
  p.armedSlot = null;
  const slotName = AGENTS[p.agent].gear[i],
    deployed = owned(p, slotName);
  if (!p.down && active() && !(p.suppressed > now)) {
    const inFlight = match.arrows.find((a) => a.owner === p.id && a.name === slotName);
    if (inFlight && ['귀체', '포박'].includes(slotName)) {
      if (!inFlight.dropping) {
        Object.assign(inFlight, { vx: 0, vz: 0, vy: -12, gravity: 22, dropping: true, end: now + 2 });
      }
      return;
    }
    if (inFlight && ['섬광등', '진형 붕괴', '일체 정지'].includes(slotName)) {
      if (slotName === '일체 정지') inFlight.end = now;
      else if (inFlight.alt) {
        const v = aim(p.yaw, p.pitch).multiplyScalar(22);
        Object.assign(inFlight, { vx: v.x, vy: v.y, vz: v.z, alt: false });
      }
      return;
    }
    if (['무시', '차원 표류'].includes(slotName) && p.phaseUntil > now) {
      p.phaseUntil = now;
      return;
    }
    if (slotName === '광속' && p.lightRush?.extra && now < p.lightRush.start + 1.45) {
      if (now < p.lightRush.end) return;
      p.lightRush = { start: now, end: now + 0.45, extra: false };
      p.lightDir = [-Math.sin(p.yaw), 0, -Math.cos(p.yaw)];
      return;
    }
    if (slotName === '심판') {
      const wall = match.devices.find(
        (d) => d.kind === 'reckoning' && d.owner === p.id && d.travel && d.end > now,
      );
      if (wall) {
        wall.travel = false;
        wall.end = now + 7;
        return;
      }
    }
    if (slotName === '해만') {
      const orb = match.devices.find((d) => d.kind === 'cove' && d.owner === p.id && d.end > now && !d.hp);
      if (orb) {
        orb.hp = 500;
        orb.shield = true;
        return;
      }
    }
  }
  if (slotName === '인도하는 빛' && !p.down && active() && !(p.suppressed > now)) {
    const bird = match.arrows.find((a) => a.owner === p.id && a.type === 'hawk');
    if (bird) {
      bird.activatedAt ??= now;
      bird.end = Math.min(bird.end, now + 0.3);
      return;
    }
  }
  if (
    slotName === '칼날 폭풍' &&
    p.kit.special?.id === 'blades' &&
    p.kit.special.mag > 0 &&
    !p.down &&
    active() &&
    !(p.suppressed > now)
  ) {
    equip('special', p);
    return;
  }
  if (p.pilot) {
    if (p.pilot.kind === slotName) releasePilot(p);
    return;
  }
  if (deployed && reusable(slotName) && active() && !p.down) {
    if (!(deployed.lock > now)) deviceAction(p, deployed);
    return;
  }
  const chained = p.agent === '소바' && i === 3 && p.volley > 0 && p.volleyEnd > now;
  if (p.suppressed > now || world.mechanisms.some((m) => m.id === p.ride && m.type === 'cross')) return;
  if (
    !active() ||
    (p.down && !(p.agent === '클로브' && i === 2)) ||
    dm() ||
    (!p.charges[i] &&
      !chained &&
      !(p.agent === '아스트라' && i < 3) &&
      !(slotName === '순풍' && p.dashExpires > now) &&
      !(
        p.agent === '레이즈' &&
        i === 1 &&
        match.arrows.some((a) => a.owner === p.id && a.type === 'satchel')
      )) ||
    match.core.actor === p
  )
    return;
  const name = AGENTS[p.agent].gear[i],
    power = effects[name],
    stat = timing[name] ?? {};
  const dir = aim(p.yaw, p.pitch),
    line = new T.Ray(vec(p.x, p.y + p.height, p.z), dir);
  const castReach = stat['max deploy distance'] ?? 18;
  const distance = world.mapHit(line, castReach, match.devices),
    point = line.at(Math.max(0.1, distance - 0.55), vec(0, 0, 0));
  const enemies = match.players.filter((o) => hostile(p, o) && !o.down);
  const friends = match.players.filter((o) => !hostile(p, o));
  const nearest = (arr) =>
    arr.sort((a, b) => range(a, { x: point.x, z: point.z }) - range(b, { x: point.x, z: point.z }))[0];
  let cost = 1;
  const ground = { x: point.x, y: floorAt(point.x, point.z, point.y + 1.5), z: point.z };
  const handled = castField(name, p, ground, params, fieldContext());
  if (handled === false) return;
  if (p.agent === '아스트라' && i < 3) {
    const at = params.mark ?? ground;
    const star = match.devices
      .filter((d) => d.type === 'star' && d.owner === p.id && d.end > now && d.start <= now)
      .map((d) => ({ d, err: params.mark ? range(d, at) : line.distanceToPoint(vec(d.x, d.y + 0.12, d.z)) }))
      .filter((v) => v.err < 3)
      .sort((a, b) => a.err - b.err)[0]?.d;
    if (!star) return;
    if (!practice() && (p.starTimers?.[i] ?? 0) > now) return;
    star.end = now;
    (p.starTimers ??= {})[i] = now + (i === 2 ? 35 : 45);
    cost = 0;
    if (i === 2) {
      const r = stat.radius,
        d = addDevice(
          'darkCover',
          star.x,
          star.z,
          p.team,
          stat.duration + stat['windup time'],
          r * 2,
          r * 2,
          r * 2,
          '#9466bd',
          p,
          star.y - r * 0.65,
        );
      d.start = now + stat['windup time'];
    } else createZone(i === 0 ? 'well' : 'nova', name, star, p, fieldContext());
  } else if (name === '우주 장벽') {
    const [a, b] = params.marks ?? [];
    if (!a || !b || ![a.x, a.z, b.x, b.z].every(Number.isFinite) || range(a, b) < 1) return;
    const d = addDevice('plane', a.x, a.z, p.team, 21, HALF * 4, 0.22, 55, '#8f62c0', p, -8);
    d.angle = Math.atan2(a.z - b.z, b.x - a.x);
    d.bulletWall = true;
    d.kind = 'divide';
    d.start = now + 2;
  } else if (name === '대비책' || name === '심판') {
    const harbor = name === '심판';
    const d = addDevice(
      'plane',
      p.x - Math.sin(p.yaw),
      p.z - Math.cos(p.yaw),
      p.team,
      harbor ? 12 : 5.4,
      harbor ? 22 : 5,
      0.23,
      harbor ? 6 : 3.5,
      harbor ? '#38b9bc' : '#a79af0',
      p,
      p.y,
    );
    Object.assign(d, {
      angle: p.yaw,
      travel: true,
      travelSpeed: harbor ? 8 : params.alt ? 2.5 : 5,
      bulletWall: !harbor,
      kind: harbor ? 'reckoning' : 'contingency',
      start: now + 0.4,
    });
  } else if (name === '만조') {
    const x = p.x - Math.sin(p.yaw),
      z = p.z - Math.cos(p.yaw);
    const d = addDevice('tide', x, z, p.team, 15, 0.2, 1, 4.5, '#4bcac2', p, p.y);
    d.path = [
      [x, p.y, z],
      [x - Math.sin(p.yaw) * 0.1, p.y, z - Math.cos(p.yaw) * 0.1],
    ];
    d.angle = p.yaw;
    d.grow = now;
  } else if (name === '구슬 보호막') {
    p.isoReady = now + (stat.windup ?? 1);
    p.isoShield = false;
  } else if (name === '진화') {
    p.evolution = true;
    p.stimUntil = now + 3600;
  } else if (name === '차원 표류') {
    p.phaseUntil = now + (stat.duration ?? 10);
  } else if (name === '여제') {
    p.empress = true;
    p.stimUntil = now + 300;
  } else if (name === '활력 회복') {
    if (!(p.pickupUntil > now)) return;
    p.pickupUntil = 0;
    p.overheal = 50;
    p.overhealEnd = now + 10;
    p.stimUntil = now + 10;
  } else if (name === '화음') {
    const ally = params.alt
      ? p
      : friends
          .filter(
            (o) =>
              o !== p &&
              !o.down &&
              visible(p, o) &&
              line.distanceToPoint(vec(o.x, o.y + o.height * 0.7, o.z)) < 1,
          )
          .sort((a, b) => range(p, a) - range(p, b))[0];
    if (!ally) return;
    p.stimUntil = ally.stimUntil = now + (stat['buff duration'] ?? 8);
    p.link = ally.id;
    ally.link = p.id;
  } else if (name === '청부 계약' || name === '소멸') {
    const reach = name === '소멸' ? 40 : 48;
    const victim = enemies
      .map((o) => ({
        o,
        along: vec(o.x - line.origin.x, o.y + o.height * 0.65 - line.origin.y, o.z - line.origin.z).dot(dir),
        error: line.distanceToPoint(vec(o.x, o.y + o.height * 0.65, o.z)),
      }))
      .filter((v) => v.along > 0 && v.along < reach && v.error < (name === '소멸' ? 2.2 : 3.4))
      .sort((a, b) => a.along - b.along)[0]?.o;
    if (!victim) {
      world.trace(line.origin, line.at(reach, new T.Vector3()), now, '#ad94ff', 0.38);
    } else if (name === '소멸') {
      const d = addDevice('cocoon', victim.x, victim.z, p.team, 7.25, 0.9, 0.9, 1.65, '#94d3f1', p, victim.y);
      Object.assign(d, { hp: 600, targetId: victim.id, goal: { x: p.x, z: p.z, y: p.y }, start: now + 0.5 });
      victim.detainedUntil = d.end;
      victim.trappedBy = d.id;
    } else if (!p.duel && !victim.duel) {
      const level = 66 + p.i * 18;
      const duration = 1.5 + 13;
      const wall = (x, z, w, d, h, y, span) =>
        addDevice('wall', x, z, p.team, span, w, d, h, '#7458a4', p, y);
      const floor = wall(0, 0, 20, 31, 0.5, level - 0.5, duration + 2.1);
      for (const [x, z, w, d] of [
        [-10, 0, 0.4, 31],
        [10, 0, 0.4, 31],
        [0, -15.5, 20, 0.4],
        [0, 15.5, 20, 0.4],
      ])
        wall(x, z, w, d, 5, level, duration + 2.1);
      for (const [x, z] of [
        [-3, -4],
        [3, -4],
        [0, 4],
      ])
        wall(x, z, 4, 0.4, 2.3, level, 1.5);
      for (const [o, opponent, z, yaw] of [
        [p, victim, 9, 0],
        [victim, p, -9, pi],
      ]) {
        o.duel = {
          id: floor.id,
          other: opponent.id,
          origin: { x: o.x, y: o.y, z: o.z, yaw: o.yaw, pitch: o.pitch },
          enter: now + 0.5,
          start: now + 1.5,
          end: now + duration,
          arena: { x: 0, y: level, z, yaw, pitch: 0 },
        };
        o.nextShot = now + 1.5;
      }
    }
  } else if (name === '독사의 구덩이') {
    const m = line.at(Math.min(7.25, distance), new T.Vector3()),
      y = floorAt(m.x, m.z, p.y + 1.3);
    if (!Number.isFinite(y)) return;
    const cloud = addDevice('pit', m.x, m.z, p.team, 3600, 24, 24, 8, '#568c35', p, y);
    cloud.hp = 0;
  } else if (name === '재생') {
    if (p.healingPool <= 0) return;
    p.regrowing = true;
    cost = 0;
  } else if (name === '격류') {
    const m = line.at(Math.min(distance, 12), new T.Vector3());
    p.flow = { x: m.x, y: m.y, z: m.z, start: now + (stat['windup time'] ?? 0.75) };
  } else if (name === '광속') {
    p.lightRush = { start: now, end: now + 0.45, extra: !params.alt };
    p.lightDir = dir.toArray();
    p.nextShot = now + 0.45;
  } else if (name === '기만') {
    const d = addDevice(
      params.alt ? 'deployed' : 'decoy',
      p.x,
      p.z,
      p.team,
      params.alt ? 160 : (stat['maximum image duration'] ?? 10),
      0.55,
      0.5,
      1.65,
      '#678af0',
      p,
      p.y,
    );
    Object.assign(d, {
      kind: params.alt ? 'decoyMark' : 'decoy',
      hp: params.alt ? 0 : 150,
      travel: !params.alt,
      angle: p.yaw,
    });
  } else if (handled === true) {
    // The spawned field continues on the authoritative match clock.
  } else if (name === '고속 기어') {
    p.fuel ??= 100;
    if (!p.sprinting && p.fuel < 10) return;
    p.sprinting = !p.sprinting;
    p.slideStock ??= 1;
    cost = 0;
  } else if (name === '오버드라이브') {
    p.beamUntil = now + 10;
    p.fuel = 100;
    p.sprinting = true;
    p.beamAmmo = 40;
    p.slideStock = 1;
  } else if (name === '어둠의 발자국') {
    const pt = line.at(Math.min(15, Math.max(0, distance - 0.45)), new T.Vector3()),
      ground = floorAt(pt.x, pt.z, pt.y + 0.6);
    if (!Number.isFinite(ground) || world.structure.blocked(pt.x, pt.z, ground, 0.28, 1.66)) return;
    p.destination = { x: pt.x, y: ground, z: pt.z };
    p.teleportAt = now + 0.7;
    p.nextShot = Math.max(p.nextShot, now + 1.2);
  } else if (name === '눈총') {
    const m = line.at(Math.min(10, Math.max(0.6, distance - 0.35)), new T.Vector3()),
      d = addDevice('eye', m.x, m.z, p.team, 2.1, 0.55, 0.55, 0.55, '#cb54e9', p, m.y - 0.275);
    d.hp = 100;
    d.start = now + 0.4;
  } else if (name === '포식' || name === '무시') {
    const orb = match.devices.find(
      (d) => d.type === 'soul' && d.owner === p.id && d.end > now && hasSight(d, p, 30),
    );
    if (!orb && !p.empress) return;
    if (orb) orb.end = now;
    if (name === '포식') {
      p.healLeft = 100;
      p.healRate = 33.34;
      p.canOverheal = true;
      p.healTick = 0;
    } else p.phaseUntil = now + 1.5;
  } else if (name === '여진' || name === '섬광 폭발') {
    if (distance >= castReach) return;
    const m = line.at(distance + (name === '여진' ? 2.6 : 0.65), new T.Vector3());
    const d = addDevice(
      name === '여진' ? 'aftershock' : 'wallFlash',
      m.x,
      m.z,
      p.team,
      name === '여진' ? 3.4 : 0.6,
      6,
      6,
      5,
      name === '여진' ? '#fa905a' : '#ffcf81',
      p,
      m.y - 2.5,
    );
    d.start = now + (name === '여진' ? 2.2 : 0.5);
    d.pulses = name === '여진' ? 2 : 1;
  } else if (name === '부활') {
    const ally = friends
      .filter(
        (o) =>
          o.down &&
          range(p, o) < (stat['max cast distance'] ?? 12) &&
          line.direction.dot(vec(o.x, o.y + 0.5, o.z).sub(line.origin)) > 0 &&
          line.distanceToPoint(vec(o.x, o.y + 0.5, o.z)) < 1.6,
      )
      .sort((a, b) => range(p, a) - range(p, b))[0];
    if (!ally) return;
    ally.reviveAt = now + (stat['windup time'] ?? 2);
    ally.revivePos = { x: ally.x, y: ally.y, z: ally.z };
  } else if (name === '불길') {
    const fx = p.x - Math.sin(p.yaw) * 0.55,
      fz = p.z - Math.cos(p.yaw) * 0.55;
    const d = addDevice('blaze', fx, fz, p.team, 8, 0.15, 1, 3.2, '#ff6328', p, p.y);
    d.path = [
      [fx, p.y, fz],
      [fx - Math.sin(p.yaw) * 0.05, p.y, fz - Math.cos(p.yaw) * 0.05],
    ];
    d.angle = p.yaw;
    d.grow = now;
  } else if (name === '추월 차선') {
    const paths = lanePaths(world, p, match.devices);
    if (!paths.length) return;
    for (const path of paths) {
      const [x, y, z] = path[0];
      const d = addDevice('lane', x, z, p.team, 6, 0.12, 1, 3.5, '#31adff', p, y);
      d.path = path;
    }
  } else if (remoteAbilities.includes(name)) {
    p.pilot = { kind: name, x: p.x, y: p.y + p.height, z: p.z, end: now + (name === '올빼미 드론' ? 7 : 6) };
    if (name === '요동봇' || name === '정찰자') {
      p.pilot.ready = now + (stat['deployment duration'] ?? stat['deploy time'] ?? 0.25);
      p.pilot.hp = name === '요동봇' ? 180 : 80;
      p.pilot.speed = stat.speed ?? 6;
      p.pilot.end = p.pilot.ready + (stat['search duration'] ?? 6);
    }
    if (name === '잠입 드론') {
      const reach = Math.min(6, distance - 0.2),
        point = line.at(Math.max(0, reach), new T.Vector3()),
        floor = floorAt(point.x, point.z, point.y + 0.3);
      const v = p.pilot;
      if (Number.isFinite(floor)) {
        v.x = point.x;
        v.z = point.z;
        v.y = floor + 0.42;
      }
      v.ready = now + 0.3;
      v.hp = 60;
      v.end = now + 6.3;
    }
    p.vx = p.vz = 0;
  } else if (deviceKind(name)) {
    const kind = deviceKind(name),
      self = kind === 'beacon',
      pos = self ? p : point;
    const y = kind === 'camera' || kind === 'rose' ? pos.y : floorAt(pos.x, pos.z, pos.y + 0.4);
    if (!Number.isFinite(y)) return;
    const d = addDevice(
      'deployed',
      pos.x,
      pos.z,
      p.team,
      120,
      0.42,
      0.42,
      0.4,
      kind.startsWith('poison') ? '#91d753' : '#77b8ce',
      p,
      y,
    );
    Object.assign(d, { kind, hp: 45, on: false, angle: p.yaw });
    if (kind === 'gatecrash' && !params.alt) d.travel = true;
    if (kind === 'rose' && params.alt && distance < 18) {
      const behind = line.at(distance + 0.6, vec(0, 0, 0));
      Object.assign(d, { x: behind.x, z: behind.z, y: behind.y });
      d.mesh.position.set(d.x, d.y + d.h * 0.5, d.z);
    }
    if (kind === 'rose') d.lock = now + 0.8;
  } else if (distanceSmokes.includes(name)) {
    const m = distanceTarget(world, p, p.yaw, p.pitch, Math.max(2, Math.min(80, params.range ?? 12)));
    if (!m) return;
    const omen = name === '어둠의 장막',
      radius = stat.radius ?? (omen ? 4.1 : 4.6),
      delay = omen ? Math.hypot(m.x - p.x, m.z - p.z) / 64 + 1 : 0;
    const d = addDevice(
      omen ? 'darkCover' : 'smoke',
      m.x,
      m.z,
      p.team,
      (omen ? (stat.duration ?? 15) : (stat.duration ?? 19.25)) + delay,
      radius * 2,
      radius * 2,
      radius * 2,
      omen ? '#51427e' : '#529fb5',
      p,
      m.y - radius * 0.65,
    );
    d.start = now + delay;
    d.from = { x: p.x, y: p.y + p.height, z: p.z };
    if (!omen) d.kind = 'cove';
  } else if (tabletNames.includes(name)) {
    const smoke = ['공중 연막', '계략', '웨이브폼'].includes(name),
      guided = name === '유도 일제 사격';
    const cap = smoke
      ? Math.min(3, p.charges[i])
      : guided
        ? Math.min(2, p.charges[i])
        : name === '아마겟돈'
          ? 2
          : 1;
    const sites = Array.isArray(params.marks)
      ? params.marks
          .slice(0, cap)
          .filter(
            (m) =>
              m &&
              Number.isFinite(m.x) &&
              Number.isFinite(m.z) &&
              (name === '그림자 습격' || Math.hypot(m.x - p.x, m.z - p.z) <= 55),
          )
      : [];
    if (!sites.length) return;
    const targets = sites
      .map((m) => ({ ...m, y: world.structure.support(m.x, m.z, p.y + 6) }))
      .filter((m) => Number.isFinite(m.y));
    if (!targets.length) return;
    if (name === '그림자 습격') {
      p.teleportAt = now + 3;
      p.destination = world.structure.spawn(targets[0].x, targets[0].z, targets[0].y);
    } else if (name === '아마겟돈' && targets.length === 2) {
      for (let i = 0; i < 8; i++) {
        const t = i / 7,
          m = targets[0],
          b = targets[1];
        const d = addDevice(
          'orbital',
          m.x + (b.x - m.x) * t,
          m.z + (b.z - m.z) * t,
          p.team,
          2.1 + t,
          6,
          6,
          6,
          '#ec994e',
          p,
          m.y,
        );
        d.start = now + 0.7 + t;
      }
    } else
      for (const m of targets)
        if (smoke) {
          const cloud = addDevice(
            'smoke',
            m.x,
            m.z,
            p.team,
            (stat.duration ?? (name === '계략' ? 13 : 15)) +
              (stat['windup time'] ?? stat['deploy time'] ?? 1),
            8.3,
            8.3,
            7.4,
            name === '계략' ? '#b78dc5' : name === '웨이브폼' ? '#9b8bcb' : '#a19081',
            p,
            m.y,
          );
          cloud.start = now + (stat['windup time'] ?? stat['deploy time'] ?? 1);
        } else if (guided) createZone('guided', name, m, p, fieldContext());
        else {
          const d = addDevice('orbital', m.x, m.z, p.team, 4.6, 9, 9, 12, '#ffaf52', p, m.y);
          d.start = now + 1.45;
        }
    cost = smoke || guided ? targets.length : 1;
  } else if (hasThrow(name)) {
    const previous = match.arrows.find((a) => a.owner === p.id && a.type === 'satchel');
    if (name === '폭발 팩' && previous) {
      previous.end = now;
      return;
    }
    if (name === '연막 폭발') p.guiding = true;
    match.arrows.push(
      launch(
        name,
        p,
        {
          charge: Math.min(1, Math.max(0, Number(params.charge) || 0)),
          alt: params.alt === true,
          heal: params.heal === true,
          bounces: Math.min(2, Math.max(0, Math.trunc(Number(params.bounces) || 0))),
        },
        now,
        ++sequence,
      ),
    );
  } else if (name === '사냥꾼의 분노') {
    if (p.volleyNext > now) return;
    if (!chained) {
      p.volley = 3;
      p.volleyEnd = now + 6.5;
    }
    p.volley--;
    p.volleyNext = now + 0.9;
    cost = chained ? 0 : 1;
    const from = line.origin,
      to = line.at(64, new T.Vector3());
    world.trace(from, to, now, '#87eaff', 0.55);
    for (const o of enemies) {
      const b = new T.Vector3(o.x, o.y + o.height * 0.6, o.z),
        d = b.clone().sub(from).dot(dir);
      if (d >= 0 && d <= 64 && line.distanceToPoint(b) < 1.8) {
        hurt(o, 80, p);
        o.revealTeam = p.team;
        o.revealEnd = now + 1.5;
      }
    }
  } else if (name === '회복 구슬') {
    const ally = params.alt
      ? p
      : friends
          .filter((o) => o !== p && alive(o) && o.hp < 100 && range(o, p) < 30 && visible(p, o))
          .map((o) => ({ o, error: line.distanceToPoint(vec(o.x, o.y + o.height * 0.75, o.z)) }))
          .filter((v) => v.error < 0.9)
          .sort((a, b) => a.error - b.error)[0]?.o;
    if (!ally || ally.hp >= 100) return;
    ally.healLeft = 100;
    ally.healRate = ally.healLeft / stat.duration;
    ally.healTick = 0;
  } else if (name === '장벽 구슬') {
    const t = Math.min(15, distance),
      pt = line.at(t, new T.Vector3()),
      angle = Number.isFinite(params.angle) ? params.angle : p.yaw;
    const ground = floorAt(pt.x, pt.z, p.y + 1.7);
    if (!Number.isFinite(ground)) return;
    for (let k = 0; k < 4; k++) {
      const n = (k - 1.5) * 1.65,
        x = pt.x + n * Math.cos(angle),
        z = pt.z - n * Math.sin(angle);
      const d = addDevice('wall', x, z, p.team, 40, 1.7, 1.7, 2.7, '#79d9d1', p, ground);
      d.hp = 400;
      d.fortify = now + stat['time taken to fortify'];
      for (const o of match.players)
        if (
          !o.down &&
          Math.abs(o.x - x) < 0.93 &&
          Math.abs(o.z - z) < 0.93 &&
          Math.abs(o.y - ground) < 0.5 &&
          !world.structure.blocked(o.x, o.z, ground + 2.7, 0.28, o.height + 0.12)
        )
          o.y = ground + 2.7;
    }
  } else
    switch (power) {
      case 'jump':
        p.y += 0.015;
        p.vy = 10;
        break;
      case 'dash':
      case 'blink':
        if (name === '순풍') {
          if (!p.dashExpires || now > p.dashExpires) {
            if (!practice()) p.charges[i] = Math.max(0, p.charges[i] - 1);
            p.dashArmed = now + 1;
            p.dashExpires = now + 8.5;
            if (p.local) announce('순풍 준비 · E를 다시 눌러 돌진');
            return;
          }
          if (now < p.dashArmed) return;
          p.dashExpires = 0;
          cost = 0;
        }
        {
          const moving = Math.hypot(p.vx, p.vz),
            vx = moving > 0.5 ? p.vx / moving : -Math.sin(p.yaw),
            vz = moving > 0.5 ? p.vz / moving : -Math.cos(p.yaw);
          if (name === '순풍') {
            p.dashX = vx;
            p.dashZ = vz;
            p.dashTime = 0.45;
            p.nextShot = now + 0.65;
          } else for (let n = 0; n < (power === 'dash' ? 28 : 48); n++) move(p, vx * 0.25, vz * 0.25);
        }
        break;
      case 'smoke':
      case 'wall':
      case 'slow':
      case 'fire':
      case 'trap': {
        const wall = power === 'wall',
          flat = ['slow', 'fire', 'trap'].includes(power);
        const w = wall && Math.abs(dir.x) > 0.7 ? 0.65 : wall ? 6 : 5,
          d = wall && w > 1 ? 0.65 : wall ? 6 : 5;
        if (
          wall &&
          match.players.some(
            (o) =>
              !o.down && Math.abs(point.x - o.x) < w / 2 + 0.35 && Math.abs(point.z - o.z) < d / 2 + 0.35,
          )
        )
          return;
        addDevice(
          power,
          point.x,
          point.z,
          p.team,
          stat.duration ?? stat['zone duration'] ?? (power === 'smoke' ? 8 : 12),
          w,
          d,
          flat ? 0.14 : wall ? 2.8 : 4.5,
          { wall: '#7ed6c6', smoke: '#8193ae', fire: '#ff783e', slow: '#55d1ee', trap: '#c6ad53' }[power],
          p,
        );
        break;
      }
      case 'damage':
      case 'stun':
      case 'flash': {
        for (const o of enemies) {
          if (range(o, point) > (power === 'flash' ? 12 : 6)) continue;
          if (power === 'damage') hurt(o, i === 3 ? 160 : 65, p);
          if (power === 'stun') o.tag = now + (stat['concuss duration'] ?? 3);
          if (power === 'flash' && visible(o, p))
            o.blindUntil = now + (stat['flash duration'] ?? stat['blind duration'] ?? 1.65);
        }
        addDevice('pulse', point.x, point.z, p.team, 0.24, 3, 3, 2, '#ffc890', p);
        break;
      }
      case 'heal': {
        const ally =
          nearest(friends.filter((o) => !o.down && o !== p && o.hp < 100 && range(p, o) < 16)) ?? p;
        if (ally.hp === 100) return;
        ally.hp = Math.min(100, ally.hp + (ally === p ? 50 : 100));
        break;
      }
      case 'revive': {
        const ally = nearest(friends.filter((o) => o.down && range(p, o) < 10));
        if (!ally) return;
        ally.down = false;
        ally.hp = 100;
        break;
      }
      case 'recall':
        p.recall = { x: p.x, z: p.z, y: p.y, yaw: p.yaw, pitch: p.pitch, shield: p.shield };
        p.recallEnd = now + 10;
        break;
      case 'scan':
        p.scan = now + 4;
        break;
      case 'shield':
        p.shield = 50;
        break;
      case 'phase':
        p.phaseUntil = now + 4;
        break;
      case 'stim':
        p.stimUntil = now + 10;
        break;
      case 'knives':
      case 'sidearm':
      case 'sniper': {
        const id = power === 'knives' ? 'blades' : power === 'sidearm' ? 'headhunter' : 'tour';
        p.kit.special = ammoFor(id);
        if (id === 'blades') {
          p.nextShot = now + 1.02;
          p.bladeRetireAt = 0;
          p.strike = null;
        }
        p.selected = 'special';
        p.reloading = 0;
        break;
      }
      default:
        return;
    }
  const recovery = stat['unequip time'] ?? 0;
  p.lastCast = { name, alt: !!params.alt, at: now, end: now + Math.max(0.28, recovery) };
  p.nextShot = Math.max(p.nextShot ?? 0, now + recovery);
  if (!practice()) p.charges[i] = Math.max(0, p.charges[i] - cost);
  if (
    i === 2 &&
    !practice() &&
    !p.signatureAt &&
    ['세이지', '소바', '브리치', '오멘', '페이드', '케이/오', '스카이'].includes(p.agent)
  ) {
    p.signatureInterval = stat.cooldown ?? (p.agent === '세이지' ? 45 : p.agent === '오멘' ? 40 : 50);
    p.signatureAt = now + p.signatureInterval;
  }
  if (i === 3) p.ult = 0;
  abilityVoice(p, name);
  if (p.local) {
    if (name === '잠입 드론') recordedEffect('tejo', settings.volume);
    else if (name !== '추월 차선' && !skillAudio[name]?.cast) sound('ability');
    announce(name);
  }
}
function flashPlayer(player, source, duration) {
  const dir=vec(source.x-player.x,source.y-player.y-player.height,source.z-player.z).normalize();
  const facing=aim(player.yaw,player.pitch).dot(dir);
  const strength=T.MathUtils.smoothstep(facing,-.65,.5);
  player.blindUntil=Math.max(player.blindUntil??0,now+.28+(duration-.28)*strength);
}
function hasSight(point, o, limit) {
  const from = vec(point.x, point.y + 0.12, point.z),
    delta = vec(o.x, o.y + o.height * 0.8, o.z).sub(from),
    dist = delta.length();
  return (
    dist <= limit &&
    world.mapHit(new T.Ray(from, delta.normalize()), dist, match.devices, true) >= dist - 0.08
  );
}
function tickProjectiles(dt) {
  const children = [];
  match.arrows = match.arrows.filter((a) => {
    const p = match.players.find((v) => v.id === a.owner);
    if (!p || a.intercepted) return false;
    const finished = flight(a, dt, now, world, match.devices, p);
    if (a.impactPoint) {
      const v = a.impactPoint,
        d = addDevice('concuss', v.x, v.z, p.team, 1.4, 10, 10, 8, '#4bbaff', p, v.y - 4);
      d.start = now + 1;
      delete a.impactPoint;
    }
    if (a.type === 'paranoia' || a.type === 'undercut') {
      const targets = (a.touched ??= []);
      for (const o of match.players)
        if (
          o !== p &&
          !o.down &&
          !targets.includes(o.id) &&
          Math.hypot(a.x - o.x, a.z - o.z, a.y - o.y - o.height * 0.7) < 1.65
        ) {
          targets.push(o.id);
          if (a.type === 'paranoia') o.nearsight = now + 2;
          else o.vulnerable = now + 4;
        }
      return !finished;
    }
    if (!finished) return true;
    const floor = floorAt(a.x, a.z, a.y + 0.3),
      base = Number.isFinite(floor) ? floor : a.y;
    if (
      createZone(
        a.type,
        a.name,
        { x: a.x, z: a.z, y: a.type === 'knife' ? a.y : base, heal: a.heal },
        p,
        fieldContext(),
      )
    )
      return false;
    if (a.type === 'barrier') {
      const center = addDevice('meshNode', a.x, a.z, p.team, 40, 0.65, 0.65, 0.7, '#60c8ee', p, base);
      center.hp = 680;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const node = addDevice(
          'meshNode',
          a.x + dx * 5.5,
          a.z + dz * 5.5,
          p.team,
          40,
          0.5,
          0.5,
          0.55,
          '#9ae4ff',
          p,
          base,
        );
        node.hp = 320;
        node.parent = center.id;
        const panel = addDevice(
          'meshPanel',
          a.x + dx * 2.75,
          a.z + dz * 2.75,
          p.team,
          40,
          dx ? 5.5 : 0.2,
          dz ? 5.5 : 0.2,
          2.4,
          '#92e4ff',
          p,
          base,
        );
        panel.nodes = [center.id, node.id];
      }
      return false;
    }
    const place = (type, duration, w, h, color, y = base) =>
      addDevice(type, a.x, a.z, p.team, duration, w, w, h, color, p, y);
    if (['relay', 'delivery', 'net', 'seize', 'haunt', 'mosh', 'meddle'].includes(a.type)) {
      const t = a.type,
        k = t === 'relay' || t === 'delivery' ? 'concuss' : t,
        rad = { relay: 5, delivery: 4, net: 6.5, seize: 6.58, haunt: 30, mosh: 6.2, meddle: 5 }[t],
        delay =
          t === 'relay'
            ? 1
            : t === 'delivery'
              ? 0.9
              : t === 'mosh'
                ? 3
                : t === 'haunt'
                  ? timing['귀체'].windup
                  : t === 'seize' ? timing['포박'].windup : 0.15;
      const d = place(
        k,
        delay + (t === 'seize' ? 4.5 : t === 'haunt' ? 1.5 : 0.28),
        t === 'haunt' ? 0.6 : rad * 2,
        t === 'haunt' ? 0.6 : 0.24,
        { net: '#71cfe7', seize: '#7566a4', haunt: '#814d88', mosh: '#91da55', meddle: '#bb80d4' }[t] ??
          '#a0daff',
        base + 0.03,
      );
      Object.assign(d, { start: now + delay, radius: rad, done: false });
      if (skillAudio[a.name]?.impact) Object.assign(d, { name: a.name, cueAt: d.start });
      if (t === 'haunt') d.hp = 1;
    } else if (a.type === 'recon') {
      const d = place('recon', 3.4, 0.24, 0.24, '#64d9ff', a.y);
      d.hp = 20;
      d.next = now + 0.667;
      d.pulses = 2;
      d.normal = a.surfaceNormal;
    } else if (a.type === 'knife') {
      for (const o of match.players) if (hostile(p, o) && range(a, o) < 15) o.suppressed = now + 8;
      place('pulse', 0.3, 3, 2, '#ad91ff', a.y);
    } else if (a.type === 'cloud') place('cloud', 2.5, 6.7, 6.7, '#c6d8ee', a.y - 3.35);
    else if (a.type === 'slow') place('ice', timing[a.name].duration, 10, .08, '#7debd2');
    else if (a.type === 'fire' || a.type === 'swarm') {
      const acid = a.name === '뱀 이빨';
      const d = place(
        'fire',
        timing[a.name]?.duration ?? (a.name === '뜨거운 손' ? 4 : 7),
        acid ? 9 : 8,
        0.22,
        acid ? '#82e347' : '#f78b4d',
      );
      d.acid = acid;
      d.phoenix = a.name === '뜨거운 손';
    } else if (a.type === 'stim') place('stimField', 12, 8, 2.5, '#eeb452');
    else if (['flash', 'curve', 'hawk', 'flare'].includes(a.type)) {
      for (const o of match.players)
        if (!o.down && hasSight(a, o, 24)) {
          const duration =
            a.type === 'hawk'
              ? 1 + 1.25 * Math.min(1, ((a.activatedAt ?? now) - a.created) / 0.75)
              : (timing[a.name]?.['max blind duration'] ?? timing[a.name]?.['max flash duration'] ?? 1.5);
          flashPlayer(o,a,duration);
        }
      place('pulse', 0.16, 1.5, 1.4, '#fff5ce', a.y);
    } else {
      const r = a.type === 'rocket' ? 6 : a.type === 'bomblet' ? 3 : 5,
        damage = a.type === 'rocket' ? 150 : a.type === 'shock' ? 75 : a.type === 'paint' ? 55 : 38;
      for (const o of match.players) {
        const dist = Math.hypot(o.x - a.x, o.y + o.height * 0.5 - a.y, o.z - a.z);
        if (o.down || dist > r || !hasSight(a, o, r + 1)) continue;
        if (a.type === 'satchel') {
          o.vy = Math.max(4, 9 * (1 - dist / r));
          if (o === p) continue;
        }
        hurt(o, Math.max(1, Math.round(damage * (1 - dist / r))), p);
      }
      if (a.type === 'paint')
        for (let n = 0; n < 4; n++) {
          const angle = (n * Math.PI) / 2;
          children.push({
            ...a,
            id: ++sequence,
            type: 'bomblet',
            y: a.y + 0.24,
            vx: Math.cos(angle) * 5,
            vz: Math.sin(angle) * 5,
            vy: 4,
            stuck: false,
            end: now + 0.8,
            gravity: 15,
          });
        }
      place('pulse', 0.22, r * 1.3, 1.4, projectileColor[a.type] ?? '#ffc568', a.y - 0.55);
    }
    return false;
  });
  match.arrows.push(...children);
}
function drawProjectiles() {
  const visible = (world.projectiles ??= new Map());
  const ids = new Set();
  for (const a of match.arrows) {
    ids.add(a.id);
    let m = visible.get(a.id);
    if (!m) {
      m = world.mesh(
        world.material(projectileColor[a.type] ?? '#ffc571'),
        a.x,
        a.y,
        a.z,
        0.16,
        0.16,
        ['recon', 'shock'].includes(a.type) ? 0.8 : 0.22,
      );
      world.scene.add(m);
      const slug = {
        hawk: 'guiding-light',
        recon: 'recon-bolt',
        shock: 'shock-dart',
        paint: 'paintshell',
        knife: 'zeropoint',
        flash: 'flashdrive',
        satchel: 'blast-pack',
      }[a.type];
      if (slug) {
        const holder = new T.Group();
        m.add(holder);
        holder.scale.set(1 / m.scale.x, 1 / m.scale.y, 1 / m.scale.z);
          const arrow = a.type === 'recon' || a.type === 'shock';
          const orientation = new T.Group();
          holder.add(orientation);
          if (arrow) orientation.rotation.y = Math.PI / 2;
          attachProp(orientation, slug, arrow ? 0.72 : 0.32);
        m.material.visible = false;
      } else if (a.type === 'cloud') {
        m.geometry = new T.SphereGeometry(0.6, 16, 12);
      }
      visible.set(a.id, m);
    }
    m.position.set(a.x, a.y, a.z);
    if (!a.stuck) m.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
  }
  for (const p of match.players) {
    if (!p.pilot || p.down) continue;
    const id = 'pilot-' + p.id;
    ids.add(id);
    let m = visible.get(id);
    if (!m) {
      m = world.mesh(world.material('#a6c2b3'), 0, 0, 0, 0.6, 0.27, 0.42);
      world.scene.add(m);
      const slug = {
        '잠입 드론': 'stealth-drone',
        '올빼미 드론': 'owl-drone',
        정찰자: 'trailblazer',
        요동봇: 'thrash',
      }[p.pilot.kind];
      if (slug) {
        const holder = new T.Group();
        m.add(holder);
        holder.scale.set(1 / m.scale.x, 1 / m.scale.y, 1 / m.scale.z);
        attachProp(holder, slug, 0.6);
        m.material.visible = false;
      }
      visible.set(id, m);
    }
    m.position.set(p.pilot.x, p.pilot.y, p.pilot.z);
    m.rotation.y = p.yaw;
    const enemy = hostile(match.player, p);
    m.visible =
      !p.local &&
      (!enemy ||
        p.pilot.kind !== '잠입 드론' ||
        Math.hypot(match.player.x - p.pilot.x, match.player.z - p.pilot.z) < 18);
  }
  for (const [id, m] of visible)
    if (!ids.has(id)) {
      m.removeFromParent();
      m.material.dispose();
      visible.delete(id);
    }
}
function finish(team, text) {
  match.score[team]++;
  match.result = teamName[team] + ' 승리 · ' + text;
  for (const p of match.players) p.credits = Math.min(9000, p.credits + (p.team === team ? 3000 : 1900));
  setPhase('result', TIMES.result);
  fireHeld = firePressed = false;
}
function endGame(winner) {
  match.winner = winner;
  setPhase('ended', 0);
  releaseControls();
  show('results');
}
function applyAction(p, a) {
  if (!p || !a) return;
  if (
    p.down &&
    !(p.agent === '클로브' && ['arm', 'ability'].includes(a.kind) && [2, 3].includes(a.value?.i ?? a.value))
  )
    return;
  switch (a.kind) {
    case 'interact':
      {
        const d = aimedDevice(p);
        if (d) deviceAction(p, d);
        else useMechanism(world.mechanisms, p);
      }
      break;
    case 'inspect':
      if (!p.reloading && p.armedSlot == null && !p.pilot) {
        p.inspectUntil = now + inspectLength(heldWeapon(p).id, currentSkin(p));
        if (p.local) {
          stopAnimationAudio();
          sound('inspect');
        }
      }
      break;
    case 'reload':
      reload(p);
      break;
    case 'equip':
      p.queuedSkill = null;
      p.armedSlot = null;
      if (['primary', 'secondary', 'melee', 'special'].includes(a.value)) equip(a.value, p);
      break;
    case 'arm':
      if (Number.isInteger(a.value) && a.value >= 0 && a.value < 4) {
        p.queuedSkill = null;
        p.armedSlot = a.value;
        p.skillReady = now + (timing[AGENTS[p.agent].gear[a.value]]?.['equip time'] ?? 0);
      }
      break;
    case 'ability':
      if (
        a.value &&
        typeof a.value === 'object' &&
        Number.isInteger(a.value.i) &&
        a.value.i >= 0 &&
        a.value.i < 4
      )
        ability(a.value.i, p, a.value);
      else if (Number.isInteger(a.value) && a.value >= 0 && a.value < 4) ability(a.value, p);
      break;
    case 'drop':
      if (active() && match.core.carrier === p) dropCore(p);
      break;
    case 'buy':
      purchase(p, a.value);
      break;
    case 'slide':
      if (
        p.agent === '네온' &&
        p.sprinting &&
        (practice() || p.slideStock > 0) &&
        grounded(p) &&
        !(p.slideUntil > now)
      ) {
        const dir = Math.hypot(p.vx, p.vz);
        p.slideX = dir > 0.2 ? p.vx / dir : -Math.sin(p.yaw);
        p.slideZ = dir > 0.2 ? p.vz / dir : -Math.cos(p.yaw);
        p.slideUntil = now + 0.6;
        p.slideStock = Math.max(0, (p.slideStock ?? 1) - 1);
      }
      break;
    case 'pilot-fire':
      pilotFire(p);
      break;
    case 'return':
      releasePilot(p);
      p.destination = null;
      break;
    case 'fire':
      if (!p.pilot && active() && match.core.actor !== p) shoot(p, !!a.value);
      break;
  }
}
function command(kind, value) {
  if (kind === 'equip') disarm();
  if (!dispatch(kind, value)) applyAction(match.player, { kind, value });
}
function step(dt) {
  if (!match || (practice() && paused)) return;
  now += dt;
  world.setClock(now);
  world.clearEffects(now);
  if (match.phase === 'ended') return;
  if (match.trial && now >= match.trial.next) advanceTarget(false);
  if (isGuest()) {
    match.player.ads = ads;
    return;
  }
  if (match.phase === 'buy' && !phaseTime()) setPhase('fight', TIMES.fight);
  if (match.phase === 'result' && !phaseTime()) {
    const winner = ['blue', 'amber'].find(
      (t) =>
        match.score[t] >= (rush() ? 4 : swift() ? 5 : 13) &&
        (!rated() || match.score[t] - match.score[other(t)] >= 2),
    );
    if (winner) {
      endGame(teamName[winner]);
      return;
    }
    startRound();
  }
  tickMechanisms(world.mechanisms, match.players, dt, now, environmentDeath);
  for (const p of match.players) {
    if (!p.down && p.decayLost > 0 && now >= p.decayUntil) {
      const restored = Math.min(p.decayLost, (p.seizeRecoveryUntil>now ? p.seizeRecoveryRate : 50) * dt);
      p.decayLost -= restored;
      p.hp = Math.min(100, p.hp + restored);
    }
    if (p.duel) {
      const duel = p.duel;
      if (!duel.entered && now >= duel.enter) {
        Object.assign(p, duel.arena, { vy: 0, vx: 0, vz: 0 });
        duel.entered = true;
      }
      if (duel.returnAt && now >= duel.returnAt) {
        Object.assign(p, duel.origin, { vy: 0 });
        p.duel = null;
      } else if (!duel.returnAt && now >= duel.end) {
        const rival = match.players.find((o) => o.id === duel.other);
        Object.assign(p, duel.origin, { vy: 0 });
        p.duel = null;
        if (rival?.duel) {
          Object.assign(rival, rival.duel.origin, { vy: 0 });
          rival.duel = null;
          environmentDeath(rival);
        }
        environmentDeath(p);
      }
    }
    if (p.mustKillBy > 0 && now >= p.mustKillBy) {
      p.mustKillBy = 0;
      p.hp = 0;
      p.down = true;
    }
    if (p.isoReady && now >= p.isoReady) {
      p.isoReady = 0;
      p.isoShield = true;
    }
    if (p.overhealEnd && now > p.overhealEnd && !p.empress) {
      p.overheal = 0;
      p.overhealEnd = 0;
    }
    if (p.evolution && !p.down) p.hp = Math.min(100, p.hp + dt * 5);
    if (p.target) continue;
    if (!p.down && p.queuedSkill && now >= p.skillReady) {
      const q = p.queuedSkill;
      p.queuedSkill = null;
      ability(q.i, p, q.params);
    }
    if (p.reviveAt && now >= p.reviveAt) {
      p.down = false;
      p.hp = 100;
      p.reviveAt = 0;
      Object.assign(p, p.revivePos);
    }
    if (p.down) {
      p.queuedSkill = null;
      if (dm() && now >= p.respawnAt) respawn(p, (p.i + Math.floor(now)) % 5);
      continue;
    }
    const drone = p.pilot;
    if (drone?.lungeEnd && now >= drone.lungeEnd) {
      const thrash = drone.kind === '요동봇';
      const radius = thrash ? timing['요동봇']['lunge radius'] : timing['정찰자']['explosion radius'];
      const burst = addDevice(
        'sonar',
        drone.x,
        drone.z,
        p.team,
        0.4,
        radius * 2,
        radius * 2,
        radius * 2,
        thrash ? '#eab0f1' : '#94d49e',
        p,
        drone.y - radius,
      );
      if (thrash) Object.assign(burst, { name: drone.kind, cueAt: now });
      for (const target of match.players) {
        if (target.down || (thrash && !hostile(p, target)) || !hasSight(drone, target, radius)) continue;
        if (thrash) target.detainedUntil = now + timing['요동봇']['detain duration'];
        else {
          const direct = range(drone, target) < 1.3;
          target.tag = now + (direct ? 4 : 2.5);
          if (direct && hostile(p, target)) hurt(target, 30, p);
        }
      }
      releasePilot(p);
    }
    if (
      p.pilot &&
      (p.pilot.end < now ||
        (p.pilot.device && !match.devices.some((d) => d.id === p.pilot.device && d.end > now)))
    )
      releasePilot(p);
    if (p.destination && p.teleportAt <= now) {
      Object.assign(p, p.destination, { vy: 0 });
      p.destination = null;
    }
    if (p.agent === '네온') {
      p.fuel = Math.max(0, Math.min(100, (p.fuel ?? 100) + (p.sprinting ? -10 : 5) * dt));
      if (p.fuel <= 0) p.sprinting = false;
    }
    if (p.agent === '바이퍼') {
      const emit = match.devices.filter((d) => d.owner === p.id && d.on && d.kind?.startsWith('poison'));
      p.fuel = Math.max(0, Math.min(100, (p.fuel ?? 100) + (emit.length ? -7 : 4) * dt));
      if (!p.fuel) for (const d of emit) deviceAction(p, d);
    }
    if (p.healLeft > 0) {
      p.healTick += dt * p.healRate;
      const n = Math.min(p.healLeft, Math.floor(p.healTick));
      p.healTick -= n;
      p.healLeft -= n;
      if (p.canOverheal && p.hp + n > 100) {
        p.overheal = Math.min(50, (p.overheal ?? 0) + p.hp + n - 100);
        p.overhealEnd = now + 10;
      }
      p.hp = Math.min(100, p.hp + n);
      if (!p.healLeft) p.canOverheal = false;
    }
    if (p.agent === '게코' && practice() && p.globeCooldowns)
      for (const slot of Object.keys(p.globeCooldowns)) p.charges[slot] = 1;
    if (p.signatureAt && now >= p.signatureAt) {
      const max = AGENTS[p.agent].economy[2].max || 1;
      p.charges[2] = Math.min(max, p.charges[2] + 1);
      p.signatureAt = p.charges[2] < max ? now + p.signatureInterval : 0;
    }
    const input = heldRemotes.get(p.id);
    const pressed = p.local ? keys : new Set(input?.keys ?? []);
    if (p.netUntil > now) {
      p.netRemoval = pressed.has('KeyF') ? (p.netRemoval ?? 0) + dt : 0;
      if (p.netRemoval >= (timing['중력그물']['net removal channel time'] ?? 1.5)) {
        p.netUntil = 0;
        p.netRemoval = 0;
      }
    }
    if (p.agent === '게코') {
      for (const [slot, end] of Object.entries(p.globeCooldowns ?? {}))
        if (now >= end) {
          p.charges[slot] = 1;
          delete p.globeCooldowns[slot];
        }
      const g = match.devices.find(
        (d) => d.type === 'globule' && d.owner === p.id && d.end > now && range(p, d) < 2,
      );
      if (g && pressed.has('KeyF')) {
        p.reclaim = (p.reclaim ?? 0) + dt;
        if (p.reclaim >= 1.5) {
          g.end = now;
          p.globeCooldowns[g.slot] = now + 15;
          if (g.slot === 3) p.reclaimedThrash = true;
          p.reclaim = 0;
        }
      } else p.reclaim = 0;
    }
    if (p.agent === '스카이' && p.regrowing && pressed.has('SkillMouse') && p.healingPool > 0) {
      const allies = match.players.filter(
        (o) =>
          o !== p &&
          !o.down &&
          o.team === p.team &&
          o.hp < 100 &&
          hasSight({ x: p.x, y: p.y + p.height, z: p.z }, o, 18),
      );
      if (allies.length) {
        const amount = Math.min(p.healingPool, 20 * dt);
        for (const o of allies) o.hp = Math.min(100, o.hp + amount);
        p.healingPool -= amount;
      }
    } else p.regrowing = false;
    if (p.agent === '제트') p.guiding = pressed.has('KeyC');
    if (['스카이', '피닉스', '페이드', '하버'].includes(p.agent)) p.guiding = pressed.has('SkillMouse');
    p.ads = p.local ? ads : !!input?.ads;
    p.channel = (pressed.has('KeyF') && !interactable(world.mechanisms, p)) || pressed.has('Digit4');
    if (!p.local && input) {
      p.yaw = input.yaw;
      p.pitch = input.pitch;
    }
    if (!p.local || screen === 'game') walk(dt, p, pressed);
    if (p.swingAt && now >= p.swingAt) {
      p.swingAt = 0;
      swingContact(p);
    }
    if (p.bladeRetireAt && now >= p.bladeRetireAt) {
      p.bladeRetireAt = 0;
      if (p.kit.special?.id === 'blades' && !p.kit.special.mag) {
        if (p.selected === 'special') equip(p.kit.primary ? 'primary' : 'secondary', p);
        delete p.kit.special;
      }
    }
    if (p.burstRemaining > 0 && now >= p.nextShot && active()) {
      p.burstRemaining--;
      shoot(p, false, true);
    } else if (
      active() &&
      match.core.actor !== p &&
      ((p.local ? firePressed : false) || ((p.local ? fireHeld : input?.fire) && weaponFor(p).auto))
    ) {
      if (!p.pilot) shoot(p);
    }
    updateWeapon(p, dt);
    if (p.pilot && p.down) p.pilot = null;
    if (p.recall && now >= p.recallEnd) Object.assign(p, p.recall, { recall: null, hp: 100, vy: 0 });
  }
  firePressed = false;
  tickProjectiles(dt);
  if (active() && !practice()) {
    if (dm()) {
      if (!phaseTime() || match.players.some((o) => o.kills >= 40)) {
        const best = [...match.players].sort((a, b) => b.kills - a.kills)[0];
        endGame(best.name);
      }
    } else {
      const v = decideRound({
        armed: match.phase === 'objective',
        detonate: phaseTime(),
        clock: phaseTime(),
        attackAlive: match.players.filter((o) => isAttack(o) && alive(o)).length,
        defendAlive: match.players.filter((o) => !isAttack(o) && alive(o)).length,
      });
      if (v) finish(v[0] === 'attack' ? match.attack : other(match.attack), v[1]);
      else channel(dt);
    }
  }
  const waves = [];
  const currentDevices = match.devices.slice();
  const field = fieldContext();
  const remaining = currentDevices.filter((d) => {
    if (now >= d.end) {
      if (d.kind === 'stabilize') {
        const o = match.players.find((p) => p.id === d.owner);
        if (o?.downedKayo === d.id) {
          o.downedKayo = 0;
          o.detainedUntil = 0;
          eliminate(o, match.players.find((p) => p.id === d.killer) ?? o);
        }
      }
      if (d.type === 'cocoon') {
        const o = match.players.find((v) => v.id === d.targetId);
        if (o) {
          o.trappedBy = 0;
          o.detainedUntil = 0;
          if (d.hp > 0 && !o.down)
            hurt(
              o,
              9999,
              match.players.find((v) => v.id === d.owner),
            );
        }
      }
      if (['wingman', 'dizzy'].includes(d.kind) || d.type === 'mosh') {
        const owner = match.players.find((o) => o.id === d.owner),
          slot = d.kind === 'dizzy' ? 2 : d.kind === 'wingman' ? 1 : 0;
        if (owner) dropGlobule(owner, d, slot);
      }
      disposeDevice(d);
      return false;
    }
    const caster = match.players.find((p) => p.id === d.owner);
    tickGroundField(d,caster,{time:now, players:match.players, visible:hasSight, hostile, hurt});
    if (d.kind === 'stabilize' && caster) {
      const ally = match.players.find(
        (o) => o !== caster && o.team === caster.team && !o.down && o.channel && range(o, d) < 2,
      );
      if (ally) {
        d.aid = (d.aid ?? 0) + dt;
        if (d.aid >= 3) {
          caster.downedKayo = 0;
          caster.detainedUntil = 0;
          caster.hp = 100;
          caster.tag = 0;
          d.end = now;
        }
      } else d.aid = 0;
      return true;
    }
    if (d.type === 'cocoon') {
      const o = match.players.find((v) => v.id === d.targetId);
      if (o && !o.down && now >= d.start) {
        const r = Math.max(0.15, range(d, d.goal));
        const f = Math.min(1, (dt * 5) / r);
        d.x += (d.goal.x - d.x) * f;
        d.z += (d.goal.z - d.z) * f;
        d.y += (d.goal.y - d.y) * f;
        Object.assign(o, { x: d.x, y: d.y, z: d.z, vy: 0 });
        d.mesh.position.set(d.x, d.y + d.h / 2, d.z);
      }
      return true;
    }
    if (d.type === 'pit' && caster) {
      if (caster.down) d.end = now;
      if (range(caster, d) < 12) d.outAt = 0;
      else d.outAt ||= now;
      if (d.outAt && now - d.outAt >= 8) d.end = now;
      for (const o of match.players)
        if (!o.down && hostile(caster, o) && range(o, d) < 12 && Math.abs(o.y - d.y) < 8) {
          const loss = Math.min(Math.max(0, o.hp - 1), dt * 30);
          o.hp -= loss;
          o.decayLost = (o.decayLost ?? 0) + loss;
          o.decayUntil = now + 1.5;
        }
      return true;
    }
    if (d.kind === 'interceptor' && d.on && caster && now >= (d.next ?? 0)) {
      for (const a of match.arrows) {
        const owner = match.players.find((o) => o.id === a.owner);
        if (
          owner &&
          hostile(caster, owner) &&
          range(a, d) < 10 &&
          ['recon', 'knife', 'haunt', 'hawk', 'seize', 'net', 'paint'].includes(a.type) &&
          hasSight(d, { ...a, height: 0.1 }, 10)
        ) {
          a.intercepted = true;
          d.next = now + 0.4;
          break;
        }
      }
    }
    if (d.type === 'zoneEmitter') {
      tickZone(d, caster, field);
      return true;
    }
    if (
      d.type === 'meshPanel' &&
      !d.nodes.every((id) => match.devices.some((n) => n.id === id && n.hp > 0 && n.end > now))
    ) {
      disposeDevice(d);
      return false;
    }
    if (tickField(d, caster, dt, field)) return true;
    if (d.type === 'blaze' || d.type === 'tide') {
      const owner = match.players.find((p) => p.id === d.owner);
      if (!owner) return true;
      while (d.path.length < (d.type === 'tide' ? 60 : 27) && now >= d.grow) {
        d.grow += 0.045;
        if (owner.guiding) d.angle = owner.yaw;
        const [lx, ly, lz] = d.path.at(-1),
          x = lx - Math.sin(d.angle) * 0.8,
          z = lz - Math.cos(d.angle) * 0.8;
        const ground = floorAt(x, z, ly + 1.4);
        d.path.push([x, Number.isFinite(ground) ? ground : ly, z]);
      }
      if (now >= (d.next ?? 0)) {
        d.next = now + 0.25;
        for (const o of match.players)
          if (
            !o.down &&
            d.path.some(
              ([x, y, z]) => Math.hypot(o.x - x, o.z - z) < 0.85 && o.y < y + d.h && o.y + o.height > y,
            )
          ) {
            if (d.type === 'tide') {
              o.tag = now + 0.6;
              continue;
            }
            if (o === owner && !d.healed) {
              d.healed = true;
              o.healLeft = 50;
              o.healRate = 12.5;
              o.healTick = 0;
            } else if (hostile(owner, o)) hurt(o, 8, owner);
          }
      }
      return true;
    }
    if (d.travel) {
      const speed = d.travelSpeed ?? (d.type === 'decoy' ? 5.4 : 3);
      const x = d.x - Math.sin(d.angle) * dt * speed,
        z = d.z - Math.cos(d.angle) * dt * speed;
      if (world.structure.blocked(x, z, d.y + 0.1, 0.1, 0.22)) d.travel = false;
      else {
        d.x = x;
        d.z = z;
        d.mesh.position.set(x, d.y + d.h / 2, z);
      }
    }
    if (d.fortify && now >= d.fortify) {
      d.hp += 200;
      d.fortify = 0;
    }
    if (
      ['eye', 'haunt', 'aftershock', 'wallFlash', 'concuss', 'net', 'meddle'].includes(
        d.type,
      ) &&
      now >= (d.start ?? 0) &&
      now >= (d.next ?? 0)
    ) {
      const owner = match.players.find((o) => o.id === d.owner),
        center = { x: d.x, y: d.y + d.h * 0.5, z: d.z };
      for (const o of match.players) {
        if (
          o.down ||
          !owner ||
          (!hostile(owner, o) && !['aftershock', 'wallFlash', 'concuss', 'net'].includes(d.type))
        )
          continue;
        const r = d.radius ?? (d.type === 'eye' || d.type === 'wallFlash' ? 24 : d.w / 2);
        if (!hasSight(center, o, r)) continue;
        if (d.type === 'eye' || d.type === 'wallFlash') {
          const direction = vec(d.x - o.x, d.y - o.y - o.height, d.z - o.z).normalize();
          if (d.type === 'wallFlash') flashPlayer(o,d,d.flashDuration ?? timing['섬광 폭발']['max blind duration']);
          else if (aim(o.yaw, o.pitch).dot(direction) > 0.25) o.nearsight = now + 0.25;
        } else if (d.type === 'haunt') {
          o.revealTeam = d.team;
          o.revealEnd = now + 0.8;
          o.trailEnd = now + timing['귀체']['trail duration'];
        } else if (d.type === 'aftershock') hurt(o, 80, owner);
        else if (d.type === 'meddle') {
          if (!(o.decayUntil > now)) {
            const loss = Math.min(90, Math.max(0, o.hp - 1));
            o.hp -= loss;
            o.decayLost = (o.decayLost ?? 0) + loss;
          }
          o.decayUntil = now + 3;
        } else if (d.type === 'net') o.netUntil = now + 6;
        else o.tag = now + 2.5;
      }
      d.next = now + (['eye', 'haunt'].includes(d.type) ? 0.15 : d.type === 'aftershock' ? 0.65 : 9);
    }
    if (d.type === 'dronePulse' && now >= d.born + 0.4) {
      const r = Math.min(16, ((now - d.born - 0.4) * 16) / 0.7),
        center = { x: d.x, y: d.y + 16, z: d.z };
      for (const o of match.players)
        if (!o.down && o.team !== d.team && !d.tagged.includes(o.id) && hasSight(center, o, r)) {
          d.tagged.push(o.id);
          o.revealTeam = d.team;
          o.revealEnd = now + 1.25;
          o.suppressed = now + 8;
        }
    }
    if (d.type === 'recon' && d.pulses > 0 && now >= (d.next ?? 0)) {
      d.next = now + 1.6;
      d.pulses--;
      const owner = match.players.find((o) => o.id === d.owner);
      waves.push([d, owner]);
    }
    if(d.type==='reconWave') {
      const radius=Math.min(30,(now-d.born)*48);
      for (const o of match.players) {
        const distance=Math.hypot(d.x-o.x,d.y+.12-o.y-o.height*.8,d.z-o.z);
        if (o.team !== d.team && !o.down && !d.tagged.includes(o.id) && distance >= (d.lastRadius ?? 0) - .10 && hasSight(d, o, radius)) {
          d.tagged.push(o.id);
          o.revealTeam = d.team;
          o.revealEnd = now + 0.75;
          o.scannedUntil=o.revealEnd;
        }
      }
      d.lastRadius=radius;
      return true;
    }
    if(d.type==='ice'){
      for(const o of match.players) if(onIce(d,o,now))o.iceUntil=now+.09;
      return true;
    }
    if (['orbital', 'stimField'].includes(d.type) && now >= (d.start ?? 0) && now >= (d.next ?? 0)) {
      d.next = now + 0.2;
      const owner = match.players.find((o) => o.id === d.owner);
      for (const o of match.players)
        if (owner && !o.down && range(o, d) < d.w / 2 && Math.abs(o.y - d.y) < d.h) {
          if (d.type === 'orbital') hurt(o, 20, owner);
          else if (o.team === d.team) o.stimUntil = now + 1.5;
        }
    }
    if (d.type === 'pulse' || d.type === 'wall' || d.type === 'smoke') return true;
    const owner = match.players.find((o) => o.id === d.owner);
    const burn = d.type === 'fire' && now >= (d.next ?? 0);
    if (burn) {
      d.next = now + 0.25;
      if (
        d.phoenix &&
        owner &&
        !owner.down &&
        range(owner, d) < d.w / 2 &&
        Math.abs(owner.y - d.y) < 1 &&
        !d.healed
      ) {
        d.healed = true;
        owner.healLeft = 50;
        owner.healRate = 12.5;
        owner.healTick = 0;
      }
    }
    for (const o of match.players) {
      if (
        !owner ||
        !hostile(owner, o) ||
        o.down ||
        o.y > d.y + d.h + 0.38 ||
        o.y + o.height < d.y ||
        Math.abs(o.x - d.x) > d.w / 2 ||
        Math.abs(o.z - d.z) > d.d / 2
      )
        continue;
      if (d.type === 'slow' || d.type === 'trap') o.tag = now + 0.7;
      if (burn && Math.hypot(o.x - d.x, o.z - d.z) <= d.w / 2) {
        if (d.acid) o.vulnerable = now + 2;
        hurt(o, d.phoenix ? 15 : d.acid ? 3 : 10, owner);
      }
    }
    return true;
  });
  match.devices = remaining.concat(match.devices.slice(currentDevices.length));
  for (const [d, owner] of waves) {
    const front=addDevice('reconWave',d.x,d.z,d.team,.66,.01,.01,.01,'#4ddfff',owner,d.y);
    front.tagged=[];
  }
}
function drawWorld(realTime) {
  world.updateMechanisms();
  world.updateTerrainFeedback(match?.devices??[],now);
  if (!match?.endFx && world.lastFx != null) {
    world.stopFinishSound?.();
    world.finishFx?.update(Infinity);
    world.lastFx = world.finishFx = null;
  }
  if (match?.endFx && world.lastFx !== match.endFx.at) {
    const start = world.lastFx = match.endFx.at;
    world.stopFinishSound?.();
    world.stopFinishSound = recordedEffect(
      'finish-' + match.endFx.family,
      settings.volume / (1 + range(match.player, match.endFx) * 0.09),
      () => now-start,
    );
    world.finishFx?.update(Infinity);
    world.finishFx = finisher(world.scene, match.endFx.family, match.endFx, match.endFx.at);
  }
  if (world.finishFx && !world.finishFx.update(now)) world.finishFx = null;
  const { camera, tool, trim, flash, core } = world;
  if (!match) {
    const a = realTime * 0.00014;
    camera.position.set(42 * Math.cos(a), 48, 42 * Math.sin(a));
    camera.lookAt(0, 0, 0);
    camera.fov = 57;
    tool.visible = core.visible = false;
  } else {
    for (const d of match.devices) {
      drawDevice(d, now);
      if (d.type === 'recon' && d.normal) {
        const mesh = d.mesh;
        if (!mesh.userData.mounted) {
          mesh.userData.mounted = true;
          const normal = new T.Vector3().fromArray(d.normal).normalize();
          mesh.scale.setScalar(1);
          mesh.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), normal);
          const mount = new T.Group();
          mount.position.x = .23;
          mesh.add(mount);
          attachProp(mount, 'recon-bolt', .54);
          mesh.material.visible = false;
        }
        mesh.position.set(d.x, d.y, d.z);
      }
      if(d.type==='ice' || d.type==='reconWave'){
        d.mesh.visible=false;
        if(!d.mesh.userData.heard){
          d.mesh.userData.heard=true;
          if(now-d.born<.55)fieldSound(d.type==='ice'?'ice-break':'recon-ping',d);
        }
      }
      const cueAt = d.cueAt ?? (d.type === 'groundWave' ? d.start : undefined);
      if (cueAt !== undefined && now >= cueAt && d.mesh.userData.lastSound !== cueAt) {
        d.mesh.userData.lastSound = cueAt;
        if (now - cueAt < 0.55) playSkillCue(d, d.name, 'impact');
      }
      if (['companion', 'agentPulse', 'groundWave', 'decoy', 'plane'].includes(d.type)) {
        const mesh = d.mesh;
        mesh.position.set(d.x, d.y + d.h / 2, d.z);
        mesh.rotation.y = d.angle ?? 0;
        if (d.type === 'groundWave') mesh.visible = now >= d.start;
        if (d.type==='groundWave' && d.name==='초점 교차') {
          const width=Math.max(.02,Math.min(d.w,2*(now-d.start)*d.speed));
          mesh.scale.set(width,.09,d.reach);
          mesh.material.opacity=.42+.22*Math.sin((now-d.start)*22);
        } else if (d.type==='groundWave' && d.name==='요동치는 베이스') {
          const advance=Math.min(d.reach,Math.max(0,(now-d.start)*d.speed));
          mesh.scale.set(Math.max(.1,2*advance*Math.tan(Math.PI/6)),.42,1.0);
        }
        if (d.type === 'decoy' && !mesh.userData.requested) {
          mesh.userData.requested = true;
          attachProp(mesh, 'yoru', 1.35);
        }
        if (fieldProp(d.kind) && !mesh.userData.requested) {
          mesh.userData.requested = true;
          attachProp(mesh, fieldProp(d.kind), 1.5);
        }
      }
    }
    drawProjectiles();
    const watch = observer();
    const self = match.player;
    const shadow = watch.nearsight > now,
      astral = watch === self && armedName() === '어둠의 장막' && alternateView,
      pilotView = watch.pilot?.kind === '잠입 드론';
    const pit = match.devices.find(
      (d) => d.type === 'pit' && range(watch, d) < 12 && Math.abs(watch.y - d.y) < 8,
    );
    world.scene.fog.near = pit ? 1 : shadow ? 2 : 62;
    world.scene.fog.far = pit ? 8.1 : shadow ? 7 : 190;
    world.scene.fog.color.set(pit ? '#54843d' : shadow ? '#281b47' : '#9ac6d3');
    canvas.style.filter = astral
      ? 'sepia(.65) hue-rotate(200deg) saturate(1.8) brightness(.76)'
      : pilotView
        ? 'saturate(.6) contrast(1.16)'
        : shadow
          ? 'brightness(.64)'
          : '';
    const speed = Math.hypot(watch.vx, watch.vz);
    camera.position.set(
      watch.x,
      watch.y + watch.height + (unlocked || screen === 'game' ? (0.013 * Math.sin(now * 12) * speed) / 6 : 0),
      watch.z,
    );
    if (watch.pilot) camera.position.set(watch.pilot.x, watch.pilot.y, watch.pilot.z);
    camera.rotation.set(watch.pitch, watch.yaw, 0, 'YXZ');
    camera.fov = 72;
    tool.visible = !watch.pilot && !watch.down && armedSkill === null;
    world.showSkill ??= heldSkill(camera);
    world.showSkill(
      watch === self && !watch.down && !watch.pilot ? armedName() : '',
      chargeStart === null ? 0 : Math.min(1, (performance.now() - chargeStart) / 1000),
      now,
    );
    if (armedName() === '장벽 구슬') {
      const r = new T.Ray(vec(watch.x, watch.y + watch.height, watch.z), aim(watch.yaw, watch.pitch)),
        t = Math.min(8, world.mapHit(r, 18, match.devices));
      const q = r.at(t, vec(0, 0, 0)),
        floor = floorAt(q.x, q.z, watch.y + 1.7);
      if (!world.wallPreview) {
        world.wallPreview = world.mesh(world.material('#64e7cd'), 0, 0, 0, 6.65, 2.7, 1.7);
        Object.assign(world.wallPreview.material, { wireframe: true, transparent: true, opacity: 0.55 });
        world.scene.add(world.wallPreview);
      }
      world.wallPreview.visible = Number.isFinite(floor);
      world.wallPreview.position.set(q.x, floor + 1.35, q.z);
      world.wallPreview.rotation.y = wallAngle;
    } else if (world.wallPreview) world.wallPreview.visible = false;
    tool.position.set(
      0.29,
      -0.234 - (watch.reloading ? 0.13 : 0),
      -0.57 + Math.max(0, 0.1 - (now - watch.shot)) * 0.4,
    );
    tool.scale.setScalar(weaponFor(watch).scale);
    const gun = heldWeapon(watch).id;
    if (audio && world.baseGun !== gun) {
      world.baseGun = gun;
      prepareBase(audio, gun, 'shot');
      prepareBase(audio, gun, 'reload');
    }
    const skin = currentSkin(watch);
    if (world.skinId !== skin?.profileKey) {
      world.skinId = skin?.profileKey;
      prepareSkin(skin);
    }
    world.animation ??= weaponAnimation(world);
    world.animation.draw(
      skin,
      watch.reloading ? Math.max(0, 1 - (watch.reloading - now) / (watch.reloadDuration || weaponFor(watch).reload)) : 0,
      watch.inspectUntil > now ? 1 - (watch.inspectUntil - now) / inspectLength(gun, skin) : 0,
      now,
      now - watch.shot,
    );
    if (skin?.topFragOn)
      watch.championAura = watch.kills > 0 && match.players.every((o) => o.kills <= watch.kills);
    else watch.championAura = false;
    const liveSkill =
      (watch === self ? armedName() : '') ||
      (watch.lastCast?.end > now &&
      !['칼날 폭풍', '역작', '헤드헌터', '순풍', '고속 기어', '오버드라이브'].includes(watch.lastCast.name)
        ? watch.lastCast.name
        : '');
    const firstReady = world.first.update(
      watch,
      gun,
      skin,
      now,
      !watch.pilot && !watch.down && !(liveSkill === '어둠의 장막' && alternateView),
      watch.reloadDuration || weaponFor(watch).reload,
      liveSkill,
    );
    if (firstReady || (liveSkill === '어둠의 장막' && alternateView)) world.showSkill('', 0, now);
    if (firstReady) tool.visible = false;
    if (watch === self && distanceSmokes.includes(armedName())) {
      const target = distanceTarget(world, watch, watch.yaw, watch.pitch, smokeRange);
      if (target) {
        if (!world.smokeMarker) {
          world.smokeMarker = new T.Mesh(
            new T.SphereGeometry(4.1, 28, 18),
            new T.MeshBasicMaterial({ color: '#829dee' }),
          );
          Object.assign(world.smokeMarker.material, { transparent: true, opacity: 0.28, wireframe: true });
          world.scene.add(world.smokeMarker);
        }
        world.smokeMarker.position.set(target.x, target.y + 2, target.z);
        world.smokeMarker.visible = true;
        if (alternateView) {
          camera.position.set(
            target.x + Math.sin(watch.yaw) * 9,
            target.y + 4.8,
            target.z + Math.cos(watch.yaw) * 9,
          );
          camera.lookAt(target.x, target.y + 1, target.z);
        }
      }
    } else if (world.smokeMarker) world.smokeMarker.visible = false;
    if (watch.ads && weaponFor(watch).ads) {
      camera.fov = 72 / weaponFor(watch).ads.zoomMultiplier;
      tool.position.x = 0.08;
    }
    flash.visible =
      !['melee', 'blades'].includes(gun) && !flash.userData.filmed && watch === self && now < match.flash;
    for (const o of match.players) {
      const { g, legs } = o.model;
      if (o !== watch || watch.pilot)
        o.model.animate?.(
          now,
          Math.min(1, Math.hypot(o.vx, o.vz) / 6),
          o.revealTeam === self.team && o.revealEnd > now,
          modelKey(heldWeapon(o)?.id, currentSkin(o)),
          currentSkin(o),
          o.strike,
        );
      g.visible =
        (o !== watch || !!watch.pilot) &&
        alive(o) &&
        !(o.agent === '요루' && o.phaseUntil > now && hostile(watch, o) && range(watch, o) > 15);
      g.position.set(o.x, o.y, o.z);
      g.rotation.y = o.yaw;
      g.scale.y = o.mode === 'crouch' ? 0.74 : 1;
      const stride = Math.min(1, Math.hypot(o.vx, o.vz) / 6);
      legs[0].position.z = Math.sin(now * 12) * 0.19 * stride;
      legs[1].position.z = -legs[0].position.z;
    }
    core.visible = ['dropped', 'planted', 'defused'].includes(match.core.state);
    core.position.set(match.core.x, match.core.y ?? 0, match.core.z);
    core.rotation.y = now * 0.7;
  }
  camera.updateProjectionMatrix();
  world.renderer.render(world.scene, camera);
  if (match) world.first.render(world.renderer, camera.aspect);
}

const radar = get('map').getContext('2d');
const mapBase = document.createElement('canvas');
mapBase.width = mapBase.height = 180;
const mapInk = mapBase.getContext('2d');
const mapPx = (x) => ((x + HALF) / (HALF * 2)) * 180;
mapInk.fillStyle = '#18241d';
mapInk.fillRect(0, 0, 180, 180);
function drawBase() {
  mapInk.fillStyle = '#16232b';
  mapInk.fillRect(0, 0, 180, 180);
  for (let z = 0; z < SIZE; z++) {
    for (let x = 0; x < SIZE; x++) {
      if (!open(x, z) && !isCover(x, z)) continue;
      mapInk.fillStyle = isCover(x, z) ? '#7f6449' : '#4e6552';
      const stride = (CELL / (HALF * 2)) * 180;
      mapInk.fillRect(x * stride, z * stride, stride + 0.2, stride + 0.2);
    }
  }
  function siteLabels() {
    for (const site of SITES) {
      mapInk.font = 'bold 12px monospace';
      mapInk.textAlign = 'center';
      mapInk.lineWidth = 2.8;
      mapInk.strokeStyle = '#18252c';
      mapInk.strokeText(site.id, mapPx(site.x), mapPx(site.z) + 4);
      mapInk.fillStyle = '#f0f4d6';
      mapInk.fillText(site.id, mapPx(site.x), mapPx(site.z) + 4);
    }
  }
  siteLabels();
  const ref = MAPS.find((m) => m.name === MAP_NAME);
  if (ref) {
    const icon = new Image();
    icon.onload = () => {
      if (MAP_NAME !== ref.name) return;
      mapInk.clearRect(0, 0, 180, 180);
      mapInk.drawImage(icon, 0, 0, 180, 180);
      siteLabels();
    };
    icon.src = ref.icon;
  }
}
drawBase();
function minimap(watch) {
  radar.clearRect(0, 0, 180, 180);
  radar.drawImage(mapBase, 0, 0);
  const local = match.player;
  const radius = audibleStep(watch.mode, Math.hypot(watch.vx, watch.vz), grounded(watch)) ? 18 : 0;
  if (radius) {
    radar.beginPath();
    radar.arc(mapPx(watch.x), mapPx(watch.z), (radius / (HALF * 2)) * 180, 0, pi * 2);
    radar.strokeStyle = '#d9ffd26b';
    radar.stroke();
  }
  for (const ally of match.players) {
    if (!alive(ally) || ally === watch) continue;
    const enemy = hostile(local, ally);
    const direction = Math.atan2(watch.x - ally.x, watch.z - ally.z);
    const spotted = Math.abs(angle(direction, watch.yaw)) < 1 && visible(watch, ally);
    if (
      enemy &&
      !spotted &&
      !(ally.revealEnd > now && ally.revealTeam === local.team) &&
      !(local.scan > now && range(watch, ally) < 18)
    )
      continue;
    radar.fillStyle = enemy ? '#f6a069' : '#82eadd';
    radar.fillRect(mapPx(ally.x) - 2, mapPx(ally.z) - 2, 4, 4);
    if (Math.abs(ally.y - watch.y) > 1.65) {
      radar.font = '10px sans-serif';
      radar.fillText(ally.y > watch.y ? '▴' : '▾', mapPx(ally.x) + 3, mapPx(ally.z));
    }
  }
  for (const m of world.mechanisms) {
    radar.fillStyle = m.broken
      ? '#697571'
      : m.type === 'portal'
        ? '#83a8ff'
        : cable(m)
          ? '#eccb6e'
          : '#e0b391';
    radar.fillRect(mapPx(m.x) - 1.3, mapPx(m.z) - 1.3, 2.6, 2.6);
  }
  const core = match.core;
  if (core.state === 'planted' || (core.state === 'dropped' && isAttack(local))) {
    radar.fillStyle = '#ffdc65';
    radar.fillRect(mapPx(core.x) - 3, mapPx(core.z) - 3, 6, 6);
  }
  radar.save();
  radar.translate(mapPx(watch.x), mapPx(watch.z));
  radar.rotate(-watch.yaw);
  radar.fillStyle = '#f6ffd9';
  radar.beginPath();
  radar.moveTo(0, -6);
  radar.lineTo(4, 4);
  radar.lineTo(0, 2);
  radar.lineTo(-4, 4);
  radar.fill();
  radar.restore();
  get('location').textContent = area(watch.x, watch.z);
}
const board = document.createElement('div');
board.id = 'scoreboard';
board.hidden = true;
hud.append(board);
const hudMarkup = new Map();
function updateHudPanel(id, html) {
  if (hudMarkup.get(id) !== html) {
    hudMarkup.set(id, html);
    get(id).innerHTML = html;
  }
}
function drawHud() {
  if (!match || hud.hidden) return;
  const p = match.player;
  const watch = observer();
  if (p.down && armedSkill !== null && !(p.agent === '클로브' && armedSkill === 2)) disarm();
  minimap(watch);
  const tablet = get('tablet-map');
  tablet.hidden = !tabletNames.includes(armedName());
  if (!tablet.hidden) {
    const ctx = tablet.getContext('2d'),
      size = tablet.width;
    ctx.drawImage(mapBase, 0, 0, size, size);
    const x = (k) => ((k / HALF + 1) * size) / 2;
    function circle(m, r, color, fill = false) {
      ctx.beginPath();
      ctx.arc(x(m.x), x(m.z), (r * size) / (2 * HALF), 0, pi * 2);
      ctx.strokeStyle = ctx.fillStyle = color;
      fill ? ctx.fill() : ctx.stroke();
    }
    if (armedName() === '우주 장벽') {
      for (const d of match.devices)
        if (d.type === 'star' && d.owner === p.id) circle(d, 1.5, '#cd95ff', true);
      if (divideMode && marks[0]) {
        ctx.beginPath();
        ctx.moveTo(x(marks[0].x), x(marks[0].z));
        ctx.lineTo(x(cursor.x), x(cursor.z));
        ctx.strokeStyle = '#d1a3ff';
        ctx.stroke();
      }
    } else circle(p, 55, '#cfb076');
    circle(p, 1.2, '#87ffe1', true);
    for (const m of marks) circle(m, 4.15, '#ffb05ba6', true);
    circle(cursor, 4.15, '#ffddae');
  }
  const seconds = Math.ceil(phaseTime());
  const time = Number.isFinite(seconds)
    ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
    : '연습';
  const teamIcons = (t) =>
    practice()
      ? ''
      : match.players
          .filter((o) => o.team === t)
          .map(
            (o) =>
              '<img alt="' +
              o.agent +
              '" title="' +
              o.agent +
              '" class="' +
              (hostile(p, o) ? 'enemy ' : '') +
              (o.down ? 'out' : '') +
              '" src="' +
              AGENTS[o.agent].icon +
              '">',
          )
          .join('');
  updateHudPanel(
    'round',
    '<div class="squads">' +
      teamIcons('blue') +
      '<b class="team-points allies">' +
      match.score.blue +
      '</b><b class="timer">' +
      time +
      '</b><b class="team-points rivals">' +
      match.score.amber +
      '</b>' +
      teamIcons('amber') +
      '</div><span>' +
      (mode === 'range'
        ? '사격 연습'
        : '라운드 ' +
          match.round +
          ' · ' +
          (isAttack(p) ? '공격' : '수비') +
          ' · ' +
          phaseNames[match.phase]) +
      '</span>',
  );
  match.feed = match.feed.filter((e) => e.end > now).slice(-4);
  get('feed').innerHTML = match.feed.map((o) => '<div>' + escape(o.text) + '</div>').join('');
  const meter = Math.hypot(p.vx, p.vz);
  const posture =
    p.mode === 'crouch' ? '앉기 · 무음' : p.mode === 'walk' ? '걷기 · 무음' : meter < 0.2 ? '정지' : '달리기';
  document.body.classList.toggle('blind', p.blindUntil > now);
  if (p.blindUntil > now) document.body.style.setProperty('--flash-opacity', Math.min(1,(p.blindUntil-now)/.38));
  document.body.classList.toggle('plasma-blind', p.plasmaUntil > now);
  get('health').innerHTML =
    '<strong><i aria-hidden="true">✚</i> ' +
    Math.ceil(watch.hp) +
    '</strong><small>실드 ' +
    (watch.isoShield ? '1회 피해 차단' : Math.ceil(watch.shield + (watch.overheal ?? 0))) +
    ' · ' +
    (watch.detainedUntil > now
      ? '구속'
      : watch.jammedUntil > now
        ? '주 무기 봉쇄'
        : watch.vulnerable > now
          ? '취약'
          : watch.suppressed > now
            ? '제압'
            : posture) +
    '</small>';
  const gun = heldWeapon(watch);
  get('ammo').innerHTML =
    '<strong>' +
    (gun.id === 'melee'
      ? '근접'
      : gun.id === 'blades'
        ? '◆ ' + gun.mag
        : gun.mag + '<em> / ' + gun.reserve + '</em>') +
    '</strong><small>' +
    WEAPONS[gun.id].name +
    (watch.reloading ? ' · 재장전 중' : ' · ' + p.credits.toLocaleString('ko-KR') + ' ₡') +
    '</small>';
  updateHudPanel(
    'skills',
    SLOTS.map(
      (slot, i) =>
        '<div><img alt="" src="' +
        skillIcon(p.agent, i) +
        '"><kbd>' +
        slot +
        '</kbd> ' +
        (practice() ? '∞' : i === 3 ? p.ult + '/' + AGENTS[p.agent].economy[3].points : p.charges[i]) +
        '<small>' +
        AGENTS[p.agent].gear[i] +
        '</small></div>',
    ).join(''),
  );
  const cross = get('crosshair');
  cross.hidden = p.down || screen !== 'game';
  cross.classList.toggle('hit', now < match.hit);
  cross.style.setProperty(
    '--gap',
    Math.round(
      3 +
        Number(settings.dynamic) *
          spreadFor(weaponFor(p), meter, !grounded(p), p.mode === 'crouch', p.bloom) *
          212,
    ) + 'px',
  );
  const core = match.core;
  const prompt = p.down
    ? '관전 · 좌클릭으로 전환'
    : match.phase === 'buy'
      ? rush()
        ? '이번 라운드 무기 · ' + weaponFor(p).name
        : '[B] 장비 상점'
      : phaseNames[match.phase] === '라운드 종료'
        ? match.result
        : core.actor === p
          ? core.state === 'planted'
            ? '스파이크 해제 중'
            : '스파이크 설치 중'
          : mode === 'tour'
            ? '맵 자유 연습 · B 무기 상점'
            : practice()
              ? match.trial
                ? '사격 시험 ' + match.trial.count + '/30 · 명중 ' + match.trial.score
                : '표적 ' +
                  p.kills +
                  '개 제거 · B 무기 · F2 난이도 ' +
                  ['쉬움', '보통', '어려움'][match.level ?? 0] +
                  ' · F3 사격 시험' +
                  (currentSkin(p)?.family ? ' · F4 마무리' : '')
              : dm()
                ? '데스매치 · ' + p.kills + ' / 40'
                : core.carrier === p || (rush() && isAttack(p) && core.state === 'carried')
                  ? siteAt(p.x, p.z, p.y)
                    ? '[F 유지] 스파이크 설치'
                    : '스파이크 운반 중 · [G] 내려놓기'
                  : core.state === 'dropped' && isAttack(p) && range(p, core) < 1.05
                    ? '[F] 스파이크 줍기'
                    : core.state === 'planted'
                      ? !isAttack(p) && range(p, core) < 1.7
                        ? '[F 유지] 스파이크 해제'
                        : core.site + ' 거점 스파이크 활성'
                      : '';
  const mechanism = interactable(world.mechanisms, p);
  const aimed = aimedDevice(p);
  const mechanismHint = p.pilot
    ? '좌클릭 장치 사용 · 스킬 키로 복귀'
    : aimed
      ? '[F] 설치한 스킬 작동'
      : mechanism
        ? mechanism.name +
          ' · ' +
          (cable(mechanism)
            ? p.ride != null
              ? mechanism.type === 'cross'
                ? '자동 횡단 중 · Shift 감속'
                : 'W/S 이동 · Space 내리기'
              : mechanism.type === 'cross'
                ? '[F] 집라인 탑승'
                : '[F] 로프 타기'
            : '[F] 문 작동')
        : '';
  const line =
    armedSkill !== null
      ? distanceSmokes.includes(armedName())
        ? armedName() + ' · ' + smokeRange.toFixed(1) + ' m · 좌/우클릭 거리 조절 · 스킬 키 확정 · R 시점'
        : armedName() +
          ' · ' +
          accessHint(
            armedName(),
            chargeStart === null ? 0 : Math.min(1, (performance.now() - chargeStart) / 1000),
            ricochets,
            marks.length,
          )
      : now < match.hudUntil && !['buy', 'result'].includes(match.phase)
        ? match.hudText
        : mechanismHint || prompt;
  get('message').innerHTML =
    (p.scannedUntil>now?'<strong class="field-alert scanned">위치 발각</strong>':'') +
    (p.deafUntil>now?'<strong class="field-alert scanned">청각 차단</strong>':'') +
    (p.hinderedUntil>now?'<strong class="field-alert chilled">방해</strong>':
      Math.max(p.iceUntil,p.slowUntil)>now?'<strong class="field-alert chilled">둔화</strong>':'') +
    (line ? '<span>' + escape(line) + '</span>' : '') +
    (core.actor === p
      ? '<progress aria-label="스파이크 작업 진행률" max="' +
        (core.state === 'planted' ? TIMES.defuse : TIMES.plant) +
        '" value="' +
        core.progress +
        '"></progress>'
      : '');
  board.hidden = !keys.has('Tab') || screen !== 'game';
  if (!board.hidden) {
    board.innerHTML =
      '<h3>전광판</h3><table><thead><tr><th>팀</th><th>이름</th><th>처치</th><th>사망</th><th>크레딧</th></tr></thead><tbody>' +
      match.players
        .map(
          (o) =>
            '<tr><td>' +
            teamName[o.team] +
            '</td><td>' +
            escape(o.name) +
            '</td><td>' +
            o.kills +
            '</td><td>' +
            o.deaths +
            '</td><td>' +
            (o.team === p.team ? o.credits : '–') +
            '</td></tr>',
        )
        .join('') +
      '</tbody></table>';
  }
}
const action = (name, label, primary = false) =>
  '<button data-action="' + name + '"' + (primary ? ' class="primary"' : '') + '>' + label + '</button>';
const meter = (value, label) =>
  '<div class="progress" role="progressbar" aria-label="' +
  label +
  '" aria-valuenow="' +
  value +
  '" aria-valuemin="0" aria-valuemax="100"><span style="--progress:' +
  value +
  '%"></span></div>';
const heading = (eyebrow, title) => '<span class="eyebrow">' + eyebrow + '</span><h2>' + title + '</h2>';
let selectDestination = 'range',
  settingsReturn = 'home';
function show(target) {
  screen = target;
  hud.hidden = target !== 'game';
  menu.dataset.screen = target;
  menu.innerHTML = '';
  if (target === 'game') return;
  document.body.classList.remove('blind', 'plasma-blind');
  let content = '';
  if (target === 'home') content = lobby(selectedMap, playlist);
  if (target === 'agents' || target === 'select')
    content =
      heading(target === 'agents' ? '요원' : mode === 'range' ? '사격장' : selectedMap, '요원 선택') +
      agentCards(agentId) +
      '<div class="row">' +
      (target === 'select' ? action('load', '선택 확정', true) : '') +
      action('home', '돌아가기') +
      '</div>';
  if (target === 'join')
    content =
      heading('사용자 설정 게임', '방 코드로 참가') +
      '<label class="field">방 코드<input id="room-code" maxlength="6" autocomplete="off"></label><div class="row">' +
      action('join-confirm', '요원 선택', true) +
      action('home', '돌아가기') +
      '</div>';
  if (target === 'queue') {
    const r = room?.room;
    content =
      heading(r?.mode ?? playlist, '플레이어 대기실') +
      (r
        ? '<p>방 코드 <strong>' +
          r.code +
          '</strong> · ' +
          r.map +
          ' · ' +
          r.players.length +
          ' / 10명</p><div class="room-teams">' +
          ['blue', 'amber']
            .map(
              (t) =>
                '<section><h3>' +
                teamName[t] +
                '</h3>' +
                r.players
                  .filter((p) => p.team === t)
                  .map(
                    (p) =>
                      '<p><img src="' +
                      AGENTS[p.agent].icon +
                      '" alt=""> ' +
                      p.agent +
                      (p.id === room.id ? ' · 나' : '') +
                      '</p>',
                  )
                  .join('') +
                '</section>',
            )
            .join('') +
          '</div>'
        : '<p>방에 연결하는 중…</p>') +
      '<div class="row">' +
      (r && room.host
        ? '<button class="primary" data-action="start-room" ' +
          (r.players.length < (r.mode === '경쟁전' ? 10 : 2) ? 'disabled' : '') +
          '>경기 시작</button>'
        : '') +
      action('home', '나가기') +
      '</div>';
  }
  if (target === 'loading')
    content =
      heading(playlist, mode === 'range' ? '사격장' : selectedMap) +
      '<div class="load-art" style="background-image:linear-gradient(90deg,#071420aa,transparent),url(/art/scene-' +
      (MAPS.find((m) => m.name === selectedMap)?.slug ?? 'ascent') +
      '.webp)">' +
      (mode === 'range'
        ? '<strong>THE RANGE</strong>'
        : '<img alt="맵 평면도" src="' +
          MAPS.find((m) => m.name === selectedMap).icon +
          '"><strong>' +
          selectedMap +
          '</strong>') +
      '</div><p id="load-status">전장과 장비를 불러오는 중</p><div id="load-meter">' +
      meter(mapProgress, '전장 준비') +
      '</div>';
  if (target === 'ready' || target === 'pause')
    content =
      heading(practice() ? '연습' : playlist, target === 'ready' ? MAP_NAME : '게임 메뉴') +
      '<p>WASD 이동 · Shift 무음 걷기 · Ctrl 앉기 · 좌클릭 기본 공격 · 우클릭 보조 공격 또는 조준<br>B 구매 · R 재장전 · 1/2/3 무기 · C/Q/E/X 스킬 · 4 또는 F 스파이크 · Tab 전광판</p><div class="row">' +
      action('resume', '플레이', true) +
      action('unlocked', '잠금 없이 플레이') +
      (mode === 'range' ? action('range', '요원 변경') : '') +
      action('settings', '설정') +
      action('home', '로비로') +
      '</div><small>잠금 없이 플레이할 때는 방향키 또는 우클릭 드래그로 조준합니다.</small>';
  if (target === 'shop') content = armory(match.player, selectedGun, practice() || dm());
  if (target === 'collection') content = collection(collectionGun, equipped, skinOptions);
  if (target === 'settings') content = settingsForm(settings);
  if (target === 'results')
    content =
      heading('경기 종료', escape(match.winner) + ' 승리') +
      '<p>' +
      match.score.blue +
      ' — ' +
      match.score.amber +
      ' · 처치 ' +
      match.player.kills +
      ' · 사망 ' +
      match.player.deaths +
      '</p>' +
      action('home', '로비로');
  menu.innerHTML =
    '<section class="panel ' +
    (target === 'home' ? 'home' : '') +
    '">' +
    content +
    (notice ? '<p role="status">' + escape(notice) + '</p>' : '') +
    '</section>';
}
function purchase(p, id) {
  if (p.down || rush() || (!practice() && !dm() && match.phase !== 'buy')) return;
  const free = practice() || dm(),
    skill = /^skill-([0-2])$/.exec(id);
  const armor = Object.hasOwn(ARMOR, id) ? ARMOR[id] : null,
    gun = Object.hasOwn(skinCatalog, id) ? WEAPONS[id] : null;
  if (!armor && !gun && !skill) return;
  const ability = skill ? AGENTS[p.agent].economy[Number(skill[1])] : null;
  const cost = free ? 0 : (armor?.cost ?? gun?.cost ?? ability?.cost);
  if (p.credits < cost) return;
  if (armor) {
    if (p.shield >= armor.amount) return;
    p.shield = armor.amount;
  } else if (skill) {
    const i = Number(skill[1]);
    if (p.charges[i] >= ability.max || ability.cost === 0) return;
    p.charges[i]++;
  } else {
    const slot = gun.category === 'Pistols' ? 'secondary' : gun.category === 'Melee' ? 'melee' : 'primary';
    if (p.kit[slot]?.id === id && !free) return;
    p.kit[slot] = ammoFor(id);
    p.selected = slot;
    p.temporary = null;
    p.reloading = 0;
    p.bloom = 0;
  }
  p.credits -= cost;
}
function buy(id) {
  if (Object.hasOwn(skinCatalog, id)) selectedGun = id;
  command('buy', id);
  show('shop');
}
function releaseControls() {
  keys.clear();
  ads = false;
  disarm();
  secondaryPress = null;
  fireHeld = firePressed = dragging = false;
  lockedBefore = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}
function beginControls(useUnlocked) {
  paused = false;
  unlocked = useUnlocked;
  notice = '';
  soundOn();
  show('game');
  canvas.focus();
  if (unlocked) return;
  try {
    const result = canvas.requestPointerLock();
    if (result?.catch) void result.catch(lockError);
  } catch {
    lockError();
  }
}
function lockError() {
  if (screen !== 'game' || unlocked || document.pointerLockElement === canvas) return;
  notice = '마우스 잠금이 허용되지 않았습니다. 잠금 없이 플레이할 수 있습니다.';
  paused = true;
  releaseControls();
  show('pause');
}
function home() {
  stopAnimationAudio();
  transition++;
  const previousRoom = room;
  room = null;
  if (previousRoom) void previousRoom.leave();
  lastRevision = -1;
  queuedActions = [];
  heldRemotes.clear();
  joinCode = '';
  ads = false;
  releaseControls();
  clearMatch();
  paused = false;
  notice = '';
  show('home');
}
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
function roomEvent(type, data) {
  if (type === 'closed') {
    home();
    notice = String(data);
    show('home');
    return;
  }
  if (type === 'room' && screen === 'queue') {
    show('queue');
    return;
  }
  if (type === 'start') {
    armedSkill = null;
    selectedMap = data.map;
    playlist = data.mode;
    void load(data.players);
    return;
  }
  if (type === 'state' && isGuest() && match) {
    receiveState(data);
    return;
  }
  if (type === 'input' && room?.host && match) {
    const p = match.players.find((o) => o.id === data.from),
      i = data.input;
    if (!p || p.local || !Array.isArray(i?.keys) || !Number.isFinite(i.yaw) || !Number.isFinite(i.pitch))
      return;
    heldRemotes.set(p.id, {
      keys: i.keys.slice(0, 24),
      yaw: i.yaw,
      pitch: Math.max(-1.53, Math.min(1.53, i.pitch)),
      ads: !!i.ads,
      fire: !!i.fire,
    });
    p.skinId = typeof i.skinId === 'string' && i.skinId.length === 36 ? i.skinId : null;
    p.skinLevel = Number.isInteger(i.skinLevel) ? i.skinLevel : undefined;
    p.skinVariant = typeof i.skinVariant === 'string' ? i.skinVariant : null;
    p.family = currentSkin(p)?.family ?? null;
    p.yaw = i.yaw;
    p.pitch = i.pitch;
    for (const a of (Array.isArray(i.actions) ? i.actions : []).slice(0, 24)) applyAction(p, a);
  }
}
async function enterRoom() {
  if (roomPending) return;
  const gen = transition;
  const client = new PlayerRoom((t, d) => {
    if (room === client) roomEvent(t, d);
  });
  room = client;
  roomPending = true;
  show('queue');
  try {
    await client.join({
      agent: agentId,
      map: selectedMap,
      mode: playlist,
      queue: selectDestination === 'queue',
      code: joinCode,
    });
    if (gen !== transition) {
      void client.leave();
      return;
    }
    show('queue');
  } catch (e) {
    if (gen === transition) {
      room = null;
      notice = e.message;
      show('home');
    }
  } finally {
    roomPending = false;
  }
}
async function load(roster) {
  const token = ++transition;
  mapProgress = 18;
  const map = mode === 'range' ? '사격장' : selectedMap;
  show('loading');
  await nextFrame();
  await nextFrame();
  if (token !== transition) return;
  let data;
  try {
    data = await loadTerrain(map);
  } catch (error) {
    if (token === transition) {
      home();
      notice = error.message;
      show('home');
    }
    return;
  }
  if (token !== transition) return;
  world.stopFinishSound?.();
  world.dispose();
  setArena(map);
  world = createWorld(canvas, data);
  drawBase();
  buildMatch(roster);
  get('load-meter').innerHTML = meter(80, '전장 준비');
  const p = match.player;
  world.first.update(p, heldWeapon(p).id, currentSkin(p), now, true, weaponFor(p).reload);
  world.renderer.compile(world.scene, world.camera);
  await world.first.loading;
  await nextFrame();
  if (token !== transition) return;
  paused = practice();
  unlocked = false;
  show('ready');
}
const stateKeys =
  'x z y vx vz yaw pitch height team hp shield mode kit selected reloading nextShot bloom shot stepCount down shots hits kills deaths credits charges ult scan fuel pilot ride travel revealTeam revealEnd volley volleyEnd suppressed blindUntil stimUntil phaseUntil nearsight sprinting slideUntil beamUntil beamAmmo dashExpires skinId skinLevel skinVariant strike roundKills lastKill inspectUntil'.split(
    ' ',
  );
stateKeys.push(
  'scannedUntil','iceUntil','stepSurface','tether','tag','hinderedUntil','slowUntil','hasteUntil','reloadDuration',
  'lastCast',
  'jammedUntil',
  'detainedUntil',
  'plasmaUntil',
  'deafUntil',
  'suspendedUntil',
  'isoShield',
  'overheal',
  'stars',
  'mustKillBy',
  'vulnerable',
  'netUntil',
  'trailEnd',
);
function snapshot() {
  const skin = currentSkin(match.player);
  Object.assign(match.player, {
    skinId: skin?.id ?? null,
    skinLevel: skin?.level ?? null,
    skinVariant: skin?.variant ?? null,
  });
  const { carrier, actor, ...core } = match.core;
  return {
    revision: ++revision,
    now,
    round: match.round,
    score: match.score,
    attack: match.attack,
    phase: match.phase,
    end: match.end,
    result: match.result,
    winner: match.winner,
    feed: match.feed,
    endFx: match.endFx,
    core: { ...core, carrier: carrier?.id, actor: actor?.id },
    players: match.players.map((p) => Object.fromEntries(['id', ...stateKeys].map((k) => [k, p[k]]))),
    arrows: match.arrows,
    mechanisms: world.mechanisms.map(({ progress, goal, health, broken }) => ({
      progress,
      goal,
      health,
      broken,
    })),
    devices: match.devices.map(({ mesh, ...d }) => d),
  };
}
function receiveState(s) {
  if (!s || s.revision <= lastRevision) return;
  if (
    !Number.isFinite(s.now) ||
    !Number.isFinite(s.end) ||
    !Number.isInteger(s.round) ||
    !Object.hasOwn(phaseNames, s.phase) ||
    !['blue', 'amber'].includes(s.attack) ||
    !['blue', 'amber'].every((t) => Number.isInteger(s.score?.[t])) ||
    !Array.isArray(s.players) ||
    s.players.length > 10 ||
    !Array.isArray(s.devices) ||
    s.devices.length > 128 ||
    !Array.isArray(s.feed) ||
    !s.core
  )
    return;
  if (
    s.players.some(
      (o) =>
        !o ||
        !Object.hasOwn(WEAPONS, o.kit?.[o.selected]?.id ?? '') ||
        !Array.isArray(o.charges) ||
        !o.charges.every(Number.isFinite) ||
        [
          'x',
          'z',
          'y',
          'hp',
          'shield',
          'yaw',
          'pitch',
          'credits',
          'ult',
          'deaths',
          'kills',
          'shots',
          'hits',
        ].some((k) => !Number.isFinite(o[k])) ||
        Object.values(o.kit).some(
          (w) => !Object.hasOwn(WEAPONS, w.id) || !Number.isFinite(w.mag) || !Number.isFinite(w.reserve),
        ),
    )
  )
    return;
  if (
    s.devices.some((d) => !d || !['x', 'z', 'w', 'd', 'h', 'end', 'id'].every((k) => Number.isFinite(d[k])))
  )
    return;
  if (Array.isArray(s.mechanisms) && s.mechanisms.length === world.mechanisms.length)
    s.mechanisms.forEach((v, i) => {
      if (v && [v.progress, v.goal, v.health].every(Number.isFinite))
        Object.assign(world.mechanisms[i], {
          goal: v.goal,
          progress: v.progress,
          health: v.health,
          broken: !!v.broken,
        });
    });
  lastRevision = s.revision;
  match.arrows = Array.isArray(s.arrows)
    ? s.arrows.slice(0, 96).filter((a) => a && [a.x, a.y, a.z].every(Number.isFinite))
    : [];
  match.endFx =
    s.endFx &&
    Object.hasOwn(palettes, s.endFx.family) &&
    ['at', 'x', 'y', 'z'].every((k) => Number.isFinite(s.endFx[k]))
      ? s.endFx
      : null;
  const prev = match.phase,
    newRound = match.round !== s.round;
  now = s.now;
  for (const k of ['round', 'score', 'attack', 'phase', 'end', 'result', 'winner', 'feed']) match[k] = s[k];
  for (const entry of s.players) {
    const p = match.players.find((o) => o.id === entry.id);
    if (!p) continue;
    const yaw = p.yaw,
      pitch = p.pitch,
      shot = p.shot,
      steps = p.stepCount,
      hits = p.hits,
      inspectPrev = p.inspectUntil,
      reloadPrev = p.reloading,
      killsPrev = p.kills;
    for (const k of stateKeys) if (entry[k] !== undefined) p[k] = entry[k];
    if (p.local && !newRound) {
      p.yaw = yaw;
      p.pitch = pitch;
    }
    if (entry.shot > 0 && entry.shot !== shot) {
      if (p.strike?.at === entry.shot) presentStrike(p);
      else if (p.beamUntil > now && p.local) match.flash = 0;
    }
    if (p.lastCast && p.lastCast.at !== p.heardCast && now - p.lastCast.at < 0.55) {
      p.heardCast = p.lastCast.at;
      abilityVoice(p, p.lastCast.name);
    }
    if (p.local && p.inspectUntil > now && p.inspectUntil !== inspectPrev) {
      stopAnimationAudio();
      sound('inspect');
    }
    if (p.reloading > now && p.reloading !== reloadPrev) sound('reload', p.local ? undefined : p);
    if (p.local && p.kills > killsPrev && !killBanner(p.lastKill, settings.volume)) sound('kill');
    if (entry.stepCount > steps) footSound(p,p.stepSurface==='ice');
    if (p.local && entry.hits > hits) {
      match.hit = now + 0.12;
      sound('hit');
    }
  }
  match.core = {
    ...s.core,
    carrier: match.players.find((p) => p.id === s.core.carrier),
    actor: match.players.find((p) => p.id === s.core.actor),
  };
  const present = new Set(s.devices.map((d) => d.id));
  match.devices = match.devices.filter((d) => {
    if (present.has(d.id)) return true;
    disposeDevice(d);
    return false;
  });
  for (const d of s.devices) {
    let copy = match.devices.find((v) => v.id === d.id);
    if (!copy) copy = addDevice(d.type, d.x, d.z, d.team, d.end - now, d.w, d.d, d.h, d.color, null, d.y);
    Object.assign(copy, d);
    copy.mesh.position.set(copy.x, copy.y + copy.h / 2, copy.z);
  }
  if (prev !== match.phase && match.phase === 'ended') {
    releaseControls();
    show('results');
  } else if (screen === 'shop' && newRound) show('shop');
  else if (screen === 'shop' && prev === 'buy' && match.phase !== 'buy') show('ready');
  else if (screen === 'shop' && lastBalance !== match.player.credits) {
    lastBalance = match.player.credits;
    show('shop');
  }
}
let lastBalance = -1;
function networkFrame(time) {
  if (!room?.room?.started || !match || sending || time - netAt < 50) return;
  netAt = time;
  sending = true;
  const client = room;
  const payload = client.host
    ? { state: snapshot() }
    : {
        input: {
          keys: [...keys],
          yaw: match.player.yaw,
          pitch: match.player.pitch,
          ads,
          skinId: currentSkin(match.player)?.id,
          skinLevel: currentSkin(match.player)?.level,
          skinVariant: currentSkin(match.player)?.variant,
          fire: fireHeld,
          actions: queuedActions.splice(0, 24),
        },
      };
  void client
    .request(client.host ? 'state' : 'input', payload)
    .catch(() => {
      if (room === client) roomEvent('closed', '서버 연결이 종료되었습니다.');
    })
    .finally(() => {
      sending = false;
    });
}
function closeShop() {
  if (unlocked) beginControls(true);
  else beginControls(false);
}
function enterShop() {
  releaseControls();
  show('shop');
}
menu.addEventListener('click', async (event) => {
  const b = event.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.mode) {
    playlist = d.mode;
    show('home');
    return;
  }
  if (d.agent && Object.hasOwn(AGENTS, d.agent)) {
    agentId = d.agent;
    show(screen);
    return;
  }
  if (d.skin !== undefined) {
    equipped[collectionGun] = d.skin;
    prepareSkin(
      skinProfile(
        skinCatalog[collectionGun]?.find((v) => v.id === d.skin),
        skinOptions[d.skin],
      ),
    );
    save('skins', equipped);
    show('collection');
    return;
  }
  if (d.buy) {
    buy(d.buy);
    return;
  }
  switch (d.action) {
    case 'home':
      home();
      break;
    case 'tour':
      mode = 'tour';
      selectDestination = 'tour';
      notice = '';
      show('select');
      break;
    case 'try-skin':
      mode = 'range';
      selectDestination = 'range';
      rangeWeapon = collectionGun;
      soundOn();
      void load();
      break;
    case 'range':
      mode = 'range';
      selectDestination = 'range';
      notice = '';
      show('select');
      break;
    case 'find':
      mode = 'match';
      selectDestination = playlist === '사용자 설정 게임' ? 'create' : 'queue';
      notice = '';
      joinCode = '';
      show('select');
      break;
    case 'agents':
      show('agents');
      break;
    case 'join':
      notice = '';
      show('join');
      break;
    case 'join-confirm':
      joinCode = get('room-code').value.trim().toUpperCase();
      if (!/^[A-F0-9]{6}$/.test(joinCode)) {
        notice = '여섯 자리 방 코드를 입력하세요.';
        show('join');
        break;
      }
      mode = 'match';
      selectDestination = 'join';
      notice = '';
      show('select');
      break;
    case 'load':
      soundOn();
      if (['range', 'tour'].includes(selectDestination)) void load();
      else void enterRoom();
      break;
    case 'start-room':
      try {
        await room.request('start');
      } catch (e) {
        notice = e.message;
        show('queue');
      }
      break;
    case 'collection':
      show('collection');
      break;
    case 'settings':
      settingsReturn = match ? 'pause' : 'home';
      show('settings');
      break;
    case 'settings-back':
      show(settingsReturn);
      break;
    case 'back-game':
      closeShop();
      break;
    case 'resume':
      beginControls(false);
      break;
    case 'unlocked':
      beginControls(true);
      break;
  }
});
function inspect(event) {
  const id = event.target.closest('button')?.dataset.inspect;
  if (id && id !== selectedGun) {
    selectedGun = id;
    get('gun-details').innerHTML = gunDetail(id);
  }
}
menu.addEventListener('pointerover', inspect);
menu.addEventListener('focusin', inspect);
menu.addEventListener('change', (e) => {
  if (['skin-level', 'skin-variant'].includes(e.target.id)) {
    const selected = equipped[collectionGun],
      item = skinCatalog[collectionGun]?.find((s) => s.id === selected);
    if (!item) return;
    const shown = menu.querySelector('.skin-preview')?.open;
    const old = skinProfile(item, skinOptions[selected]);
    skinOptions[selected] = {
      level: e.target.id === 'skin-level' ? Number(e.target.value) : old.level,
      variant: e.target.id === 'skin-variant' ? e.target.value : skinOptions[selected]?.variant,
    };
    save('skin-options', skinOptions);
    prepareSkin(skinProfile(item, skinOptions[selected]));
    show('collection');
    const preview = menu.querySelector('.skin-preview');
    if (preview && shown) preview.open = true;
    menu.querySelector('#' + e.target.id)?.focus();
  }
  if (e.target.id === 'map-choice') selectedMap = e.target.value;
  if (e.target.id === 'collection-weapon') {
    collectionGun = e.target.value;
    show('collection');
  }
});
menu.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.id.startsWith('s-')) return;
  const key = el.id.slice(2);
  settings[key] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
  if (el.nextElementSibling?.tagName === 'OUTPUT') el.nextElementSibling.value = el.value;
  get('crosshair').style.color = settings.color;
  save('settings', settings);
});
window.addEventListener('keydown', (event) => {
  const code = event.code;
  if (screen === 'shop' && !event.repeat && ['KeyB', 'Escape'].includes(code)) {
    event.preventDefault();
    closeShop();
    return;
  }
  if (screen !== 'game') return;
  if (
    [
      'Tab',
      'Space',
      'ControlLeft',
      'ControlRight',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
    ].includes(code)
  )
    event.preventDefault();
  keys.add(code);
  if (event.repeat) return;
  if (code === 'Escape' && unlocked) {
    releaseControls();
    paused = practice();
    show('pause');
    return;
  }
  if (match.player.down && !(match.player.agent === '클로브' && ['KeyE', 'KeyX'].includes(code))) return;
  if (match.player.down && match.player.agent === '클로브' && code === 'KeyX') {
    command('ability', 3);
    return;
  }
  if (code === 'KeyB' && !rush() && (practice() || dm() || match.phase === 'buy')) enterShop();
  if (mode === 'range' && code === 'F3') {
    event.preventDefault();
    startTrial();
  }
  if (mode === 'range' && code === 'F4') {
    event.preventDefault();
    const family = currentSkin(match.player)?.family;
    if (family && Object.hasOwn(palettes, family)) {
      const target = match.players.find((o) => o.target && o.i === 2) ?? match.players[3];
      if (target) match.endFx = { family, x: target.x, y: target.y, z: target.z, at: now };
    }
  }
  if (mode === 'range' && code === 'F2') {
    event.preventDefault();
    match.level = ((match.level ?? 0) + 1) % 3;
  }
  if (code === 'KeyF') command('interact');
  if (code === 'KeyR') {
    if (distanceSmokes.includes(armedName())) alternateView = !alternateView;
    else command('reload');
  }
  if (code === 'Digit1') command('equip', 'primary');
  if (code === 'Digit2') command('equip', 'secondary');
  if (code === 'Digit3') command('equip', 'melee');
  if (code === 'KeyY' && armedSkill === null && !match.player.reloading) {
    command('inspect');
  }
  if (code === 'KeyG') command('drop');
  if (code === 'KeyC' && armedName() === '장벽 구슬') {
    wallAngle += pi / 2;
    return;
  }
  if (code.startsWith('Key') && SLOTS.includes(code.slice(3))) {
    const i = SLOTS.indexOf(code.slice(3)),
      p = match.player,
      name = AGENTS[p.agent].gear[i];
    if (
      (['귀체', '포박', '섬광등', '진형 붕괴', '일체 정지'].includes(name) &&
        match.arrows.some((a) => a.name === name && a.owner === p.id)) ||
      (['무시', '차원 표류'].includes(name) && p.phaseUntil > now)
    ) {
      disarm();
      command('ability', i);
      return;
    }
    if (
      (name === '심판' &&
        match.devices.some((d) => d.kind === 'reckoning' && d.owner === p.id && d.travel && d.end > now)) ||
      (name === '광속' && p.lightRush?.extra && now < p.lightRush.start + 1.45) ||
      (name === '해만' &&
        match.devices.some((d) => d.kind === 'cove' && d.owner === p.id && d.end > now && !d.hp))
    ) {
      disarm();
      command('ability', i);
      return;
    }
    if (name === '인도하는 빛' && match.arrows.some((a) => a.owner === p.id && a.type === 'hawk')) {
      command('ability', i);
      return;
    }
    if (p.agent === '아스트라') {
      if (i === 3) {
        if (armedName() === '우주 장벽') disarm();
        else arm(i);
        return;
      }
      command('ability', { i, ...(armedName() === '우주 장벽' ? { mark: { ...cursor } } : {}) });
      return;
    }
    if (name === '칼날 폭풍' && p.kit.special?.id === 'blades' && p.kit.special.mag > 0) {
      command('ability', i);
      return;
    }
    if (p.pilot) {
      command('return');
      disarm();
      return;
    }
    if (name === '그림자 습격' && p.destination) {
      command('return');
      return;
    }
    if (owned(p, name) && reusable(name)) {
      disarm();
      command('ability', i);
      return;
    }
    if (distanceSmokes.includes(name) && armedSkill === i) {
      cast({ range: smokeRange });
      return;
    }
    if (
      !active() ||
      dm() ||
      (!p.charges[i] &&
        !(name === '순풍' && p.dashExpires > now) &&
        !(p.agent === '소바' && i === 3 && p.volleyEnd > now && p.volley > 0) &&
        !(name === '폭발 팩' && match.arrows.some((a) => a.owner === p.id && a.type === 'satchel')))
    )
      return;
    const instant =
      (AGENTS[p.agent].info[i].startsWith('즉시') && !AGENTS[p.agent].info[i].includes('준비합니다. 발사')) ||
      [
        '순풍',
        '상승 기류',
        '칼날 폭풍',
        '헤드헌터',
        '역작',
        '연막 폭발',
        '고속 기어',
        '오버드라이브',
        '포식',
        '무시',
      ].includes(name);
    if (instant) {
      disarm();
      command('ability', i);
    } else if (armedSkill === i) disarm();
    else arm(i);
  }
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
  if (event.code === 'KeyC' && match?.player.agent === '제트') match.player.guiding = false;
});
window.addEventListener('blur', () => {
  if (screen !== 'game') return;
  releaseControls();
  paused = true;
  show('pause');
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('mousedown', (event) => {
  if (screen !== 'game') return;
  if (event.button === 2 && match.player.sprinting && armedSkill === null) {
    command('slide');
    return;
  }
  if (match.player.pilot) {
    if (event.button === 0) command('pilot-fire');
    else if (event.button === 2) command('return');
    return;
  }
  if (armedSkill !== null && (event.button === 0 || event.button === 2)) {
    const name = armedName(),
      alt = event.button === 2;
    if (distanceSmokes.includes(name)) {
      rangeAdjust = alt ? -1 : 1;
      return;
    }
    if (name === 'M-파동' && alt) {
      healPulse = !healPulse;
      announce(healPulse ? '치유 모드' : '뇌진탕 모드');
      return;
    }
    if (name === '균열' && !alt) {
      chargeStart = performance.now();
      return;
    }
    if (arrowNames.includes(name)) {
      if (alt) ricochets = (ricochets + 1) % 3;
      else chargeStart = performance.now();
      return;
    }
    if (tabletNames.includes(name)) {
      if (name === '우주 장벽') {
        if (alt) {
          divideMode = !divideMode;
          marks = [];
        } else if (!divideMode) command('ability', { i: 3, star: { ...cursor } });
        else if (!marks.length) marks.push({ ...cursor });
        else cast({ marks: [marks[0], { ...cursor }] });
        return;
      }
      if (!alt) {
        if (name !== '그림자 습격' && Math.hypot(cursor.x - match.player.x, cursor.z - match.player.z) > 55)
          return;
        if (['궤도 일격', '그림자 습격'].includes(name)) {
          cast({ marks: [{ ...cursor }] });
          return;
        }
        if (name === '아마겟돈' && marks.length) {
          cast({ marks: [marks[0], { ...cursor }] });
          return;
        }
        const old = marks.findIndex((m) => range(m, cursor) < 2);
        if (old >= 0) marks.splice(old, 1);
        else if (marks.length < Math.min(3, match.player.charges[armedSkill])) marks.push({ ...cursor });
      } else if (name === '아마겟돈') marks = [];
      else if (marks.length) cast({ marks: [...marks] });
      return;
    }
    if (name === '장벽 구슬' && alt) {
      turnWall = true;
      return;
    }
    if (alt && !shortThrows.includes(name) && name !== '회복 구슬') {
      disarm();
      return;
    }
    if (!alt && ['불길', '인도하는 빛', '추적귀', '만조', '재생'].includes(name)) keys.add('SkillMouse');
    const slot = armedSkill;
    cast({ alt, angle: wallAngle, heal: healPulse });
    if (name === '사냥꾼의 분노' && (match.player.volley > 0 || isGuest())) arm(slot);
    return;
  }
  if (event.button === 2) {
    if (unlocked) {
      dragging = true;
      secondaryPress = { x: event.clientX, y: event.clientY, moved: false };
    } else if (alternateAttack(heldWeapon(match.player).id)) command('fire', true);
    else if (weaponFor(match.player).ads) ads = !ads;
  }
  if (event.button !== 0) return;
  if (match.player.down) {
    match.observer++;
    return;
  }
  if (active()) {
    fireHeld = true;
    if (isGuest()) dispatch('fire', false);
    else firePressed = true;
  }
});
window.addEventListener('mouseup', (event) => {
  rangeAdjust = 0;
  if (
    event.button === 0 &&
    chargeStart !== null &&
    (armedName() === '균열' || arrowNames.includes(armedName()))
  )
    cast({ charge: Math.min(1, (performance.now() - chargeStart) / 1000), bounces: ricochets });
  if (event.button === 2) turnWall = false;
  if (event.button === 0) {
    fireHeld = false;
    keys.delete('SkillMouse');
  }
  if (event.button === 2) {
    if (
      secondaryPress &&
      !secondaryPress.moved &&
      screen === 'game' &&
      !armedName() &&
      !match.player.pilot &&
      event.target === canvas
    ) {
      if (alternateAttack(heldWeapon(match.player).id)) command('fire', true);
      else if (weaponFor(match.player).ads) ads = !ads;
    }
    secondaryPress = null;
    dragging = false;
  }
});
function look(dx, dy) {
  const p = match.player;
  if (p.down) return;
  p.yaw -= dx;
  p.pitch = Math.max(-1.53, Math.min(1.53, p.pitch - dy));
}
window.addEventListener('mousemove', (event) => {
  if (screen !== 'game') return;
  if (tabletNames.includes(armedName())) {
    const rect = get('tablet-map').getBoundingClientRect();
    if (unlocked) {
      cursor.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2 * HALF;
      cursor.z = ((event.clientY - rect.top) / rect.height - 0.5) * 2 * HALF;
    } else {
      cursor.x += (event.movementX * 2 * HALF) / Math.max(1, rect.width);
      cursor.z += (event.movementY * 2 * HALF) / Math.max(1, rect.height);
    }
    cursor.x = Math.max(-HALF, Math.min(HALF, cursor.x));
    cursor.z = Math.max(-HALF, Math.min(HALF, cursor.z));
    return;
  }
  if (turnWall) {
    wallAngle += event.movementX * 0.012;
    return;
  }
  if (secondaryPress && !secondaryPress.moved) {
    secondaryPress.moved = Math.hypot(event.clientX - secondaryPress.x, event.clientY - secondaryPress.y) > 4;
    if (!secondaryPress.moved) return;
  }
  if (document.pointerLockElement !== canvas && !dragging) return;
  look(event.movementX * 0.0021 * settings.sens, event.movementY * 0.0021 * settings.sens);
});
document.addEventListener('pointerlockerror', lockError);
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    lockedBefore = true;
    return;
  }
  if (screen !== 'game' || unlocked || !lockedBefore) return;
  releaseControls();
  paused = true;
  show('pause');
});
try {
  world = createWorld(canvas);
  get('crosshair').style.color = settings.color;
  show('home');
  const query = new URLSearchParams(location.search);
  const requestedMap = query.get('map');
  if (MAPS.some((m) => m.name === requestedMap)) {
    mode = 'tour';
    selectedMap = requestedMap;
    selectDestination = 'tour';
    void load();
  } else if (query.get('mode') === 'range') {
    const requested = query.get('agent');
    if (Object.hasOwn(AGENTS, requested)) agentId = requested;
    const weapon = query.get('weapon');
    if (Object.hasOwn(skinCatalog, weapon) && Object.hasOwn(WEAPONS, weapon)) {
      const skin = skinCatalog[weapon].find((s) => s.id === query.get('skin'));
      if (skin) {
        rangeWeapon = weapon;
        rangeAppearance = skinProfile(skin, { variant: query.get('variant') });
      }
    }
    mode = 'range';
    selectDestination = 'range';
    void load();
  }
  let previous = performance.now();
  let carry = 0;
  function frame(time) {
    if (document.hidden && room?.host) {
      requestAnimationFrame(frame);
      return;
    }
    const dt = Math.max(0, Math.min(0.1, (time - previous) / 1000));
    previous = time;
    carry = Math.min(carry + dt, 0.15);
    if (screen === 'game' && unlocked) {
      look(
        (+keys.has('ArrowRight') - +keys.has('ArrowLeft')) * dt * 1.6,
        (+keys.has('ArrowDown') - +keys.has('ArrowUp')) * dt * 1.1,
      );
    }
    if (world) {
      if (screen === 'game' && rangeAdjust)
        smokeRange = Math.max(2, Math.min(80, smokeRange + rangeAdjust * dt * 23));
      networkFrame(time);
      while (carry >= 1 / 60) {
        step(1 / 60);
        carry -= 1 / 60;
      }
      drawWorld(time);
      if (time - hudAt > 45 && screen === 'game') {
        hudAt = time;
        drawHud();
      }
    }
    requestAnimationFrame(frame);
  }
  let hiddenAt = performance.now();
  document.addEventListener('visibilitychange', () => {
    hiddenAt = previous = performance.now();
    carry = 0;
  });
  window.setInterval(() => {
    if (!document.hidden || !room?.host || !match || !room.room.started) return;
    const stamp = performance.now(),
      dt = Math.min(2, (stamp - hiddenAt) / 1000);
    hiddenAt = previous = stamp;
    carry += dt;
    while (carry >= 1 / 60) {
      step(1 / 60);
      carry -= 1 / 60;
    }
    networkFrame(stamp);
  }, 80);
  requestAnimationFrame(frame);
} catch (error) {
  menu.innerHTML =
    '<section class="panel"><h2>3D 전장을 시작할 수 없습니다</h2><p>브라우저에서 WebGL 2와 하드웨어 가속을 활성화한 뒤 페이지를 다시 열어 주세요.</p></section>';
  console.error(error);
}
