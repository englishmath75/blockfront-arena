import { killBanner } from './kill-banner.js';
import { onIce } from './terrain-feedback.js';
import { fieldAudio, prepareFieldAudio } from './field-audio.js';
import { tickGroundField } from './ground-fields.js';
import { parseCrosshair,reticle } from './crosshair.js';
import { scopeLevels,zoomFov,drawScope } from './optics.js';
import { anchorPair, wireVisual } from './trapwire.js';
import { castField, tickField, fieldProp } from './agent-fields.js';
import {presentAbility,playerFieldVisual} from './ability-surfaces.js';
import {drawTrails} from './terror-trails.js';
import {wirePath,drawWire} from './nanowire.js';
import {drawTejoMap,isTejoMap} from './tejo-map.js';
import {AstralView} from './astral-view.js';
import {worldSculpture} from './ability-sculptures.js';
import {strikePath,insideStrip,tabletRange,sensorArea} from './strike-path.js';
import { createZone, tickZone } from './ability-zones.js';
import voices from './ability-voice.json' with { type: 'json' };
import skillAudio from './ability-sfx.json' with { type: 'json' };
import { skinProfile } from './skin-levels.js';
import { alternateAttack, shotPattern, meleeDamage } from './attacks.js';
import { recordedEffect, playHandling } from './skin-performance.js';
import timing from './ability-times.json' with { type: 'json' };
import { deviceMesh, drawDevice, lanePaths, warmFieldMaterials } from './field-effects.js';
import { modelKey, inspectLength, attachProp, previewWeapon, warmLoadout, warmWorldProps } from './actor-models.js';
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
import { createWorld, softwareGraphics } from './world.js';
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
let reticleProfile=parseCrosshair(settings.crosshairCode), zoomStep=0;
function toggleZoom(){
  const id=heldWeapon(match.player).id;
  if(!weaponFor(match.player).ads || match.player.reloading)return;
  zoomStep=ads?zoomStep+1:1;
  if(zoomStep>(scopeLevels[id]?.length??1))zoomStep=0;
  ads=zoomStep!==0;
  match.player.ads=ads;match.player.zoomStep=zoomStep;
}
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
let lastRevision = -1,
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
  if(armedSkill===3 && match?.player?.agent==='아스트라'){match.player.astro=false;command('astral-end');}
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
  if(armedName()==='우주 장벽'){p.astro=true;(world.astralView??=new AstralView(world.scene)).enter(p);}
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
import {collectionMotion} from './collection-motion.js';
let closeCollectionMotion;
import {customOptions,customControls,fly} from './custom-game.js';
import {dimensionalEffect} from './dimensional-effects.js';
import {blastImpact} from './blast-pack.js';
import {toxicPath,toxinContact,applyToxin,separatedByDivide,interceptorTick,vetoTrapTick,evolutionCleanse} from './agent-utilities.js';
import {tickNest,tickHunterBeam,owlPing} from './deployed-fields.js';
import {stepHeight} from './walk-surface.js';
import {peerMotion} from './peer-motion.js';
const peers=peerMotion();
const isGuest = () => mode === 'match' && room && !room.host;
function dispatch(kind, value) {
  if (!isGuest()) return false;
  room.actionId=(room.actionId??0)+1;
  queuedActions.push({ kind, value, id:room.actionId });
  return true;
}
const practice = () => mode === 'range' || mode === 'tour';
const isCustom = () => mode==='match' && room?.room?.mode==='사용자 설정 게임' && room.room.started;
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
  const dropped=heldWeapon(p)?.groundSkin;
  if(dropped)return skinProfile(skinCatalog[id]?.find(s=>s.id===dropped.id),dropped);
  const skin = skinCatalog[id]?.find((s) => s.id === (p.local ? equipped[id] : p.skinId));
  return skinProfile(skin, p.local ? skinOptions[skin?.id] : { level: p.skinLevel, variant: p.skinVariant });
}
function playSkillCue(at, name, phase) {
  const file = skillAudio[name]?.[phase];
  if(at && separatedByDivide(match.player,at,match.devices,now))return true;
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
  if(!settings.volume)return;
  if (at && match?.player && (match.player.deafUntil>now && at!==match.player || separatedByDivide(match.player,at,match.devices,now)))return;
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
        audio,heldWeapon(p).id,
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
        audio,heldWeapon(at).id,
        Math.max(-1,Math.min(1,((at.x-match.player.x)*Math.cos(match.player.yaw)-(at.z-match.player.z)*Math.sin(match.player.yaw))/7)),
      )
    )
      return;
  }
  if (!audio || audio.state !== 'running') return;
  const p = match?.player;
  const dist = at && p ? range(p, at) : 0;
  if (dist > 18) return;
  if(kind==='hit'){fieldAudio(audio,'hit-impact',settings.volume*.22/(1+dist*.32));return;}
  if(kind==='equip'||kind==='inspect'){playHandling(audio,kind,settings.volume);return;}
  if (['shot', 'reload'].includes(kind) && p) {
    const source = at?.kit ? at : p,
      id = heldWeapon(source)?.id;
    const balance = at
      ? Math.max(-1, Math.min(1, ((at.x - p.x) * Math.cos(p.yaw) - (at.z - p.z) * Math.sin(p.yaw)) / 7))
      : 0;
    if(kind==='shot' && (id==='tour'||id==='headhunter') && playSkillCue(source,id==='tour'?'역작':'헤드헌터','impact'))return;
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
    source.frequency.setValueAtTime(kind === 'reload' ? 245 : 445, time);
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
    ghost:false,ghostOrigin:null,blastMotion:null,gateJump:false,destination:null,
    strike: null,
    lastCast: null,
    jammedUntil: 0,
    detainedUntil: 0,
    plasmaUntil: 0,
    deafUntil: 0,flashStyle:'',
    trailEnd: 0,
    isoReady: 0,
    isoShield: false,
    flow: null,
    lightRush: null,
    evolution: false,evolveAt:0,toxinContact:null,toxinFrame:null,astro:false,starReturns:[],viperLock:0,phoenixReturn:0,activeSignatureKills:0,
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
    trappedBy: 0, cameraDart:null, dartRemoval:0, owlDart:null, owlHitUntil:0, vineUntil:0, vineHitAt:-1, deviceReturns:{}, roseFlash:0,harmonyUntil:0,
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
    armedSlot: null, rocketUntil:0,
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
    const stars=swap || match.round===1?1:Math.min(5,(p.stars??0)+1);
    respawn(p);if(p.agent==='아스트라' && !practice() && !rush())p.stars=stars;
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
  peers.reset();
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
    cheats:{enabled:false},
    awaitingLoad: Boolean(roster),
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
  const steps=Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.16);
  if(steps>1){for(let i=0;i<steps;i++)move(p,dx/steps,dz/steps);return}
  for (const [axis, delta, vel] of [
    ['x', dx, 'vx'],
    ['z', dz, 'vz'],
  ]) {
    if (!delta) continue;
    const x = p.x + (axis === 'x' ? delta : 0),
      z = p.z + (axis === 'z' ? delta : 0);
    const feet=stepHeight(world,x,z,p.y,grounded(p),p.height,floorAt,x-p.x,z-p.z);
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
  if(distance>38 || (at!==self && self.deafUntil>now) || separatedByDivide(self,at,match.devices,now))return;
  const pan=distance<.1?0:((at.x-self.x)*Math.cos(self.yaw)-(at.z-self.z)*Math.sin(self.yaw))/distance;
  fieldAudio(audio,event,settings.volume*.8/(1+distance*.12),pan);
}
function footSound(p,ice) {
  p.stepSurface=ice?'ice':'';
  if(ice)fieldSound('ice-step',p);else sound('step',p.local?undefined:p);
}
const fieldCues={ice:'ice-break',reconWave:'recon-ping',satchelBurst:'pack-burst',riftBurst:'rift-jump'};
function presentFieldCue(d) {
  const event=fieldCues[d.type];
  if (!event || d.mesh.userData.heard || audio?.state!=='running') return;
  d.mesh.userData.heard=true;
  if (now-d.born<.55) fieldSound(event,d);
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
function walk(dt, p = match.player, keys = localKeys, prediction=false) {
  if(p.ghost && isCustom() && match.cheats.enabled){fly(p,keys,dt);return}
  if (p.down) return;
  if (match.core.actor?.id === p.id) {
    p.vx = p.vz = 0;
    return;
  }
  if (p.suspendedUntil > now) {
    p.y += ((p.holdY ?? p.y) - p.y) * Math.min(1, dt * 8);
    p.vy = p.vx = p.vz = 0;
    return;
  }
  if(p.astro && grounded(p)){p.vx=p.vz=0;return;}
  if (p.trappedBy || p.downedKayo) {
    p.vx = p.vy = p.vz = 0;
    return;
  }
  if (p.flow && (now>=p.flow.start || !grounded(p))) {
    if (now < p.flow.start) {
      p.vy = 0;
      return;
    }
    const f = p.flow,
      delta = vec(f.x - p.x, f.y - p.y - p.height * 0.6, f.z - p.z),
      distance = delta.length();
    if (distance < 0.5) {
      p.flow=null;p.nextShot=Math.max(p.nextShot,now+.3);
      return;
    }
    delta.multiplyScalar(Math.min(distance, 22.5 * dt) / distance);
    move(p, delta.x, delta.z);
    if (!world.structure.blocked(p.x, p.z, p.y + delta.y, 0.25, p.height)) p.y += delta.y;
    if (now>f.start+.75 || distance<22.5*dt+.5){p.flow=null;p.nextShot=Math.max(p.nextShot,now+.3);}
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
  if(!x && !z && !p.vx && !p.vz && !p.vy && !keys.has('Space') && !p.blastMotion && !(p.slideUntil>now) &&
      p.mode==='run' && Math.abs(p.height-1.53)<.001 && grounded(p)){
    p.jumpHeld=false;p.foot=0;return;
  }
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
      (p.hasteUntil>now?1.1:1) * (p.netUntil>now?.7:1) * (p.vineUntil>now?.85:1) * Math.min(p.detainedUntil > now ? 0.18 : p.tag > now ? 0.57 : 1,
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
  let blastX=0,blastZ=0;
  if(p.blastMotion){
    if(now>=p.blastMotion.until || (p.vy<=0 && grounded(p)))p.blastMotion=null;
    else{const strength=Math.min(1,(p.blastMotion.until-now)*3);blastX=p.blastMotion.vx*strength;blastZ=p.blastMotion.vz*strength}
  }
  const futureZ = p.z + (p.vz+blastZ) * dt;
  const spawn = sidePosition(attackStart, p.i);
  const inSpawn = Math.hypot(p.x - spawn[0], futureZ - spawn[1]) < 9;
  move(p, (p.vx+blastX)*dt, match.phase === 'buy' && !inSpawn ? 0 : (p.vz+blastZ)*dt);
  if (match.phase === 'buy' && !inSpawn) p.vz = 0;
  const onFloor = grounded(p);
  if (onFloor) {
    p.lastGround = { x: p.x, y: p.y, z: p.z };
    if (p.vy < 0) p.vy = 0;
  }
  if (onFloor && keys.has('Space') && !p.jumpHeld && p.mode !== 'crouch') {
    const ice=p.iceUntil>now;
    p.vy=p.netUntil>now?2.2:ice||p.slowUntil>now?3.96:5.6;
    if(ice && !prediction){p.stepCount++;footSound(p,true);}
  }
  p.jumpHeld = keys.has('Space');
  if (!onFloor || p.vy > 0) {
    if (p.agent === '제트' && keys.has('Space') && p.vy < 0) p.vy = Math.max(-2.2, p.vy - dt * 2.5);
    else p.vy -= dt * (p.netUntil>now?30:18.5);
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
      if(!prediction)environmentDeath(p);
      return;
    }
  }
  const canStand = !world.intersects(p.x, p.z, p.y, 0.27, match.devices, 1.65);
  if (!canStand) p.mode = 'crouch';
  p.height += ((p.mode === 'crouch' ? 1.05 : 1.53) - p.height) * Math.min(1, dt * 16);
  if(!prediction)spatialSteps(p, dt);
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
    returnPhoenix(p);
    return;
  }
  if (attacker !== p) {
    if (attacker.agent === '클로브') {
      attacker.pickupUntil = now + 5;
      attacker.mustKillBy = 0;
    }
    if (attacker.link && attacker.stimUntil > now) {
      const ally = match.players.find((o) => o.id === attacker.link && !o.down);
      if(ally && ally!==attacker && ally.link===attacker.id)attacker.harmonyUntil=ally.harmonyUntil=attacker.hasteUntil=ally.hasteUntil=attacker.stimUntil=ally.stimUntil=now+timing['화음']['buff duration'];
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
  if(['피닉스','허시'].includes(attacker.agent) && hostile(attacker,p) && attacker.charges[2]<AGENTS[attacker.agent].economy[2].max){
    attacker.activeSignatureKills=(attacker.activeSignatureKills??0)+1;
    if(attacker.activeSignatureKills>=2){attacker.charges[2]++;attacker.activeSignatureKills=0;}
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
    if (Object.hasOwn(palettes, family)) match.endFx = { family, theme:skin.banner, x: p.x, y: p.y, z: p.z, at: now };
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
  if(p.ghost || attacker?.ghost)return;
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
    p.ghost || p.down ||
    p.reloading || p.netRemoval>0 || p.dartRemoval>0 ||
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
      (p.harmonyUntil>now?1/1.1:p.stimUntil>now?.85:1)*(p.hinderedUntil>now?2:1);
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
      if (o === p || o.ghost || o.down || o.phaseUntil > now) continue;
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
  if(item.id==='outlaw'){p.bloom=2.25*pi/180;p.spreadRecovery=now+.15}
  else if (!blade) p.bloom = Math.min(0.08, p.bloom + stats.recoil);
  else if (!item.mag) p.bladeRetireAt = p.nextShot;
}
function reload(p) {
  const weapon = heldWeapon(p);
  const stats = weaponFor(p);
  if (!weapon || p.reloading || weapon.mag === stats.size || !weapon.reserve) return;
  if(p.local){ads=false;zoomStep=0}p.ads=false;p.zoomStep=0;
  p.burstRemaining = 0;
  p.inspectUntil = 0;
  if (p.local) stopAnimationAudio();
  p.reloadDuration=stats.reload*(p.hinderedUntil>now?2:1)/(p.harmonyUntil>now?1.1:1);
  p.reloading=now+p.reloadDuration;
  sound('reload', p.local ? undefined : p);
}
function updateWeapon(p, dt) {
  if(p.spreadRecovery && now>=p.spreadRecovery){p.bloom=0;p.spreadRecovery=0}
  else if(!p.spreadRecovery)p.bloom = Math.max(0, p.bloom - dt * (p.hinderedUntil>now?.016:.032)*(p.harmonyUntil>now?1.1:1));
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
  if(p.local){ads=false;zoomStep=0}p.ads=false;p.zoomStep=0;
  p.inspectUntil = 0;
  if (p.local) {
    stopAnimationAudio();
    sound('equip');
  }
  p.burstRemaining = 0;
  p.reloading = 0;
  p.drawDuration=weaponFor(p).equip*(p.hinderedUntil>now?2:1)/(p.harmonyUntil>now?1.1:1);
  p.nextShot = now + p.drawDuration;
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
  device.mesh.userData.disposeField?.();
  device.mesh.removeFromParent();
  device.mesh.material.dispose();
  if (device.mesh.userData.owned) device.mesh.geometry.dispose();
}
function remoteReach(p,target){
  if(p.agent!=='허시' || p.down || p.suppressed>now)return false;
  const eye=vec(p.x,p.y+p.height,p.z),delta=vec(target.x,target.y??0,target.z).sub(eye),len=delta.length();
  if(len>8 || !len)return false;
  const ray=new T.Ray(eye,delta.normalize());
  return ray.direction.dot(aim(p.yaw,p.pitch))>.93 && world.mapHit(ray,len,match.devices,false)>=len-.15;
}
function looseGun(p){
  const ray=new T.Ray(vec(p.x,p.y+p.height,p.z),aim(p.yaw,p.pitch));
  return match.devices.filter(d=>d.kind==='droppedGun' && d.end>now && (range(d,p)<2 && Math.abs(p.y-d.y)<1.6 || remoteReach(p,{...d,y:d.y+.18})))
    .map(d=>({d,error:ray.distanceToPoint(vec(d.x,d.y+.18,d.z))})).filter(v=>v.error<.8).sort((a,b)=>a.error-b.error)[0]?.d;
}
function dropWeapon(p,slot){
  const item=p.kit[slot];if(!item || !['primary','secondary'].includes(slot))return;
  const ray=new T.Ray(vec(p.x,p.y+p.height*.8,p.z),aim(p.yaw,0));
  const to=ray.at(Math.max(.05,world.mapHit(ray,1.1,match.devices)-.15),new T.Vector3());
  const floor=floorAt(to.x,to.z,p.y+1);if(!Number.isFinite(floor))return;
  const d=addDevice('deployed',to.x,to.z,p.team,300,.42,.18,.2,'#526775',p,floor);
  const chosen=slot===p.selected?currentSkin(p):null;
  Object.assign(d,{kind:'droppedGun',slot,item:{...item,groundSkin:item.groundSkin??(chosen?{id:chosen.id,level:chosen.level,variant:chosen.variant}:{id:null})},angle:p.yaw});
  delete p.kit[slot];if(p.selected===slot)equip(p.kit.secondary?'secondary':'melee',p);
}
function returnPhoenix(p){
  const anchor=p.recall;if(!anchor)return;
  Object.assign(p,anchor,{recall:null,hp:100,vx:0,vy:0,vz:0,down:false,nextShot:now+.55});
  for(const d of match.devices)if(d.kind==='phoenixMark' && d.owner===p.id)d.end=now;
  Object.assign(addDevice('pulse',p.x,p.z,p.team,.75,1.45,1.45,2,'#ff8b30',p,p.y),{kind:'phoenixEcho',name:'역습',cueAt:now});
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
      (o) => alive(o) && isAttack(o) && (Math.hypot(range(o,core),o.y-(core.y??0))<1.05 || remoteReach(o,{...core,y:(core.y??0)+.18})) && o.channel,
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
  const support = baseY ?? floorAt(x, z, (owner?.y ?? 0) + 2);
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
  if (!isGuest()) presentFieldCue(device);
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
    liftHeight(o,meters){const cap=world.structure.ceiling(o.x,o.z,o.y+o.height,o.y+o.height+meters);return Number.isFinite(cap)?Math.max(o.y,cap-o.height-.08):o.y+meters;},
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
      if (skillAudio[d.name]?.impact) Object.assign(pulse, { name: d.name, ...(['mpulse','storm'].includes(d.kind)?{}:{cueAt:now}) });
      if(d.kind==='wingman')Object.assign(pulse,{angle:d.angle,kind:'wingmanBlast'});
    },
    airHeight(d,target){
      const floor=floorAt(d.x,d.z,d.y+.3),y=Math.max(Number.isFinite(floor)?floor+.25:-Infinity,target);
      return world.intersects(d.x,d.z,y-.12,.18,match.devices,.24)?d.y:y;
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
const preplace=new Set(['독성 장막','독성 연기','지름길','목조르기','요격기','나노스웜','알람봇','포탑','면도날 덩굴','가지치기','아크 장미']);
const placingAllowed=name=>active() || match.phase==='buy' && preplace.has(name);
let heldRecall=null,pitDismissAt=0;
function recoverDevice(p,d){
  const slot=AGENTS[p.agent].gear.indexOf(d.name);
  if(slot<0 || d.end<=now || p.down)return;
  const fast=match.phase==='buy';
  if(d.kind==='rose' && range(p,d)>timing[d.name]['max recall distance'])return;
  if(!fast && !['turret','alarmbot','rose'].includes(d.kind))return;
  d.end=now;
  (p.deviceReturns??={})[slot]=now+(fast?0:20);
}
function owned(p, name) {
  return match.devices.find((d) => d.owner === p.id && d.kind === deviceKind(name) && d.end > now);
}
function deviceAction(p, d, interact=false) {
  if (!d || d.owner !== p.id || d.end <= now) return;
  if(d.kind==='star' && interact){
    const r=timing['성운'].radius;
    Object.assign(addDevice('darkCover',d.x,d.z,p.team,1.05,r*2,r*2,r*2,'#8b43ab',p,d.y-r*.65),{name:'성운',kind:'nebula',cueAt:now});
    d.end=now;if(!practice()){if(match.phase==='buy')p.stars=Math.min(5,p.stars+1);else p.starReturns.push(now+25);}return;
  }
  if(interact && match.phase==='buy' && ['poisonOrb','passage','vetoTrap','interceptor'].includes(d.kind) && range(p,d)<=4){recoverDevice(p,d);return;}
  if(d.kind==='interceptor' && interact){if(!d.on && range(p,d)<=32.5){d.end=now;p.deviceReturns[2]=now+20;}return;}
  if(interact && (d.kind==='rose' || d.kind==='shear' && match.phase==='buy' && range(p,d)<=4)){recoverDevice(p,d);return;}
  if(d.kind==='sonic-sensor'){
    if(interact && !d.triggerAt && range(p,d)<=27){d.end=now;p.charges[1]=Math.min(AGENTS[p.agent].economy[1].max,p.charges[1]+1);}
    return;
  }
  if(d.kind==='gatecrash'){
    if(d.lock>now)return;
    const fake=interact;
    const burst=addDevice('riftBurst',d.x,d.z,p.team,1.2,.8,.8,1.4,'#3e74ff',p,d.y);
    burst.kind='riftBurst';
    if(fake){const mark=addDevice('riftMark',d.x,d.z,p.team,30,.65,.65,.04,'#344dff',p,d.y);mark.kind='riftMark'}
    else{
      p.destination=world.structure.spawn(d.x,d.z,d.y);p.teleportAt=now+.5;
      p.gateJump=true;p.nextShot=Math.max(p.nextShot,now+1.2);
    }
    d.end=now;return;
  }
  if (d.kind === 'anchor' || d.kind === 'passage' || d.kind === 'beacon') {
    if(d.kind==='passage'){
      if(match.phase==='buy' || d.start>now || range(p,d)>30 || p.suppressed>now)return;
      const pos=world.structure.spawn(d.x,d.z,d.y);
      p.gateJump=true;p.destination=pos;p.teleportAt=now+.65;p.nextShot=Math.max(p.nextShot,now+1);
      for(const at of [p,d])Object.assign(addDevice('pulse',at.x,at.z,p.team,.9,1.3,1.3,2.3,'#3bd7df',p,at.y),{kind:'vetoFold',name:d.name,cueAt:now});
      d.end=now;return;
    }
    if (d.kind === 'anchor' && range(p, d) > timing['랑데부']['anchor radius']) return;
    if(d.kind==='anchor'){
      for(const point of [p,d])Object.assign(addDevice('pulse',point.x,point.z,p.team,.62,2,2,2.4,'#efbb65',p,point.y),{kind:'rendezvousFold',name:'랑데부',cueAt:now});
      p.nextShot=Math.max(p.nextShot,now+timing['랑데부']['recall time']);
    }
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
    p.pilot=p.pilot?null:{kind:'스파이캠',x:d.x,y:d.y+.10,z:d.z,end:d.end,device:d.id,next:d.dartReady??0};
    return;
  }
  if (d.kind === 'rose') {
    if(d.type==='wallFlash' || d.lock>now || p.suppressed>now)return;
    d.type = 'wallFlash';
    d.start = now + 0.5;
    d.next = d.start;
    d.end = d.start + 0.12;
    d.flashDuration = 2;
    d.radius = 20;d.cueAt=d.start;
    return;
  }
  if (['poisonLine', 'poisonOrb'].includes(d.kind)) {
    if(!d.on && (p.fuel<30 || d.start>now || d.lock>now || !active() || p.down || p.suppressed>now))return;
    d.on=!d.on;
    if(!d.on){
      d.lock=now+5;p.viperLock=now+1;
      for(const v of match.devices)if(v.parent===d.id)v.end=Math.min(v.end,now+.8);
      return;
    }
    const wall=d.kind==='poisonLine',r=timing['독성 연기'].radius;
    const v=addDevice(wall?'toxinWall':'smoke',d.x,d.z,p.team,120,wall?.18:2*r,wall?1:2*r,wall?4.5:2*r,'#56bc21',p,wall?d.y:d.y-r*.7);
    Object.assign(v,{name:d.name,kind:wall?'toxinWall':'toxinCloud',parent:d.id,start:now+.18,cueAt:now});
    if(wall)v.path=d.path;
    return;
  }
  if(d.kind==='interceptor'){
    if(d.on || d.lock>now || !active() || p.suppressed>now)return;
    d.on=true;d.start=now+.5;d.end=d.start+9;d.cueAt=d.start;
    if(!practice())p.deviceReturns[2]=d.end+(timing[d.name]?.cooldown??40);return;
  }
  if(d.kind==='cage'){
    const r=timing['사이버 감옥']['cylinder radius'];
    const cage=addDevice('smoke',d.x,d.z,p.team,7,2*r,2*r,5,'#d6f6fd',p,d.y);
    Object.assign(cage,{kind:'cyberCage',name:'사이버 감옥',radius:r,inside:{},cueAt:now});d.end=now;return;
  }
  if(d.kind==='vine' || d.kind==='swarm'){
    if(p.down || p.suppressed>now || d.lock>now)return;
    const vine=d.kind==='vine',stat=timing[d.name];
    if(match.phase==='buy' && range(p,d)<=4){
      d.end=now;p.charges[0]=Math.min(AGENTS[p.agent].economy[0].max,p.charges[0]+1);return;
    }
    const radius=stat.radius,delay=stat.windup??.32;
    const zone=addDevice('nestField',d.x,d.z,p.team,delay+(stat.duration??6),2*radius,2*radius,.1,vine?'#a877ce':'#ed4fce',p,d.y);
    Object.assign(zone,{name:d.name,kind:vine?'vineField':'swarmField',radius,start:now+delay,cueAt:now+delay,steps:{}});
    d.end=now;
  }
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
    const wave = addDevice('dronePulse', v.x, v.z, p.team, 1.43, 32, 32, 32, '#ecb662', p, v.y - 16);
    wave.delay = 0.4;
    wave.tagged = [];
    p.pilot = null;
    return;
  }
  const line = new T.Ray(vec(v.x,v.y,v.z),aim(p.yaw,p.pitch));
  let nearest=world.mapHit(line,42,match.devices),victim;
  for(const o of match.players){
    if(o===p || o.down || !hostile(p,o))continue;
    const depth=world.hitBox(line,o.x,o.y,o.z,.56,o.height+.1,.51);
    if(depth<nearest){nearest=depth;victim=o;}
  }
  if(victim){
    if(v.kind==='스파이캠'){
      victim.revealTeam=p.team;victim.cameraDart={team:p.team,next:now+2};victim.dartRemoval=0;victim.revealEnd=now+.7;
    }else{
      victim.owlDart={team:p.team,next:now+1.6,left:2};p.owlHitUntil=now+2;
      Object.assign(addDevice('pulse',victim.x,victim.z,p.team,.18,.2,.2,.2,'#6edfff',p,victim.y+.8),{name:v.kind,cueAt:now});
    }
  }
  v.next = now + (v.kind==='스파이캠'?timing['스파이캠']['dart cooldown']:v.kind==='올빼미 드론'?timing[v.kind]['dart cooldown']:4);
  if(v.kind==='스파이캠'){const d=match.devices.find(d=>d.id===v.device);if(d)d.dartReady=v.next;}
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
      (active() || match.phase==='buy') &&
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
        Object.assign(d,{kind:'star',name:'성운',start:now+.5});
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
      else if (!inFlight.stuck && !inFlight.redirected) {
        const dir=aim(p.yaw,p.pitch),ray=new T.Ray(vec(p.x,p.y+p.height,p.z),dir);
        const target=ray.at(world.mapHit(ray,45,match.devices),new T.Vector3());
        const v=target.sub(vec(inFlight.x,inFlight.y,inFlight.z)).normalize().multiplyScalar(22);
        Object.assign(inFlight,{vx:v.x,vy:v.y,vz:v.z,alt:false,redirected:true,end:now+3});
      }
      return;
    }
    if (['무시', '차원 표류'].includes(slotName) && p.phaseUntil > now) {
      p.phaseUntil = now;
      if(slotName==='차원 표류')p.nextShot=Math.max(p.nextShot,now+(timing[slotName]['unequip/return time']??.8));
      return;
    }
    if (slotName === '광속' && p.lightRush?.extra && now < p.lightRush.start + 1.45) {
      if (now < p.lightRush.end) return;
      p.lightRush = { start: now, end: now + 0.45, extra: false };
      p.lightDir = [-Math.sin(p.yaw), 0, -Math.cos(p.yaw)];
      return;
    }
    if(slotName==='만조' && params.stop){const tide=match.devices.find(d=>d.type==='tide' && d.owner===p.id && !d.stopped && d.path.length<77);if(tide)tide.stopped=true;return;}
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
        if(!orb.shieldAt)orb.shieldAt=Math.max(now,orb.start)+timing[slotName]['shield windup'];
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
    !placingAllowed(slotName) ||
    (p.down && !(p.agent === '클로브' && i === 2)) ||
    dm() ||
    (!p.charges[i] &&
      !chained &&
      !(slotName==='대미 장식' && p.rocketUntil>now) &&
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
  const castReach=stat['max targeting distance']??stat['max deploy distance']??stat['max cast radius']??stat['deployment distance']??(name==='랑데부'?stat['max cast distance']:undefined)??18;
  const mountInfo={};
  const distance = world.mapHit(line, castReach, match.devices,false,mountInfo),
    point = line.at(Math.max(0.1, distance - 0.55), vec(0, 0, 0));
  const enemies = match.players.filter((o) => hostile(p, o) && !o.down);
  const friends = match.players.filter((o) => !hostile(p, o));
  const nearest = (arr) =>
    arr.sort((a, b) => range(a, { x: point.x, z: point.z }) - range(b, { x: point.x, z: point.z }))[0];
  let cost = 1;
  const ground = { x: point.x, y: floorAt(point.x, point.z, point.y + 1.5), z: point.z };
  if(name==='함정')params={...params,wire:anchorPair(world,line,distance,mountInfo,match.devices)};
  if(name==='아크 장미'){
    if(!mountInfo.normal || Math.abs(mountInfo.normal[1])>.6 || distance>=castReach || Math.abs(mountInfo.surfaceDistance-distance)>.12)return;
    const normal=vec(...mountInfo.normal),surface=line.at(distance,vec(0,0,0));
    if(params.alt){
      const probe=surface.clone().addScaledVector(normal,-2.05),hit={};
      const back=world.mapHit(new T.Ray(probe,normal),2,match.devices,false,hit);
      if(back>=2 || !hit.normal || normal.dot(vec(...hit.normal))>-.25)return;
      surface.copy(probe).addScaledVector(normal,back);normal.fromArray(hit.normal);
    }
    point.copy(surface).addScaledVector(normal,.095);mountInfo.normal=normal.toArray();
  }
  if(name==='음향 센서'){
    if(!mountInfo.normal || Math.abs(mountInfo.normal[1])>.32 || distance>=castReach || Math.abs(mountInfo.surfaceDistance-distance)>.12)return;
    const hit=line.at(Math.max(0,distance-.05),new T.Vector3()),base=floorAt(hit.x,hit.z,hit.y+.4);
    if(!Number.isFinite(base) || hit.y-base>4.5)return;
    params={...params,mount:{x:hit.x,y:hit.y,z:hit.z,normal:mountInfo.normal}};
    ground.y=base;
  }
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
    const timers=(p.starTimers??={});
    if(i===2){
      const queue=(timers.nebula??[]).filter(end=>end>now);
      if(!practice() && queue.length>=2)return;
      if(!practice())queue.push(Math.max(now,queue.at(-1)??0)+35);timers.nebula=queue;
    }else{if(!practice() && (timers[i]??0)>now)return;timers[i]=now+60;}
    star.end=now;
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
      Object.assign(d,{name,kind:'nebula',start:now+stat['windup time'],cueAt:now+stat['windup time']});
    } else createZone(i === 0 ? 'well' : 'nova', name, star, p, fieldContext());
  } else if (name === '우주 장벽') {
    const [a, b] = params.marks ?? [];
    if (!a || !b || ![a.x, a.z, b.x, b.z].every(Number.isFinite) || range(a, b) < 1) return;
    const d = addDevice('plane', a.x, a.z, p.team, 21, HALF * 4, 0.22, 55, '#8f62c0', p, -8);
    d.angle = Math.atan2(a.z - b.z, b.x - a.x);
    d.bulletWall = true;
    d.kind = 'divide';d.name=name;d.cueAt=now+2;
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
      name,kind: harbor ? 'reckoning' : 'contingency',
      start: now + 0.4,
    });
  } else if (name === '만조') {
    const x = p.x - Math.sin(p.yaw),
      z = p.z - Math.cos(p.yaw);
    const d = addDevice('tide', x, z, p.team, stat.duration, 0.2, 1, 8, '#4bcac2', p, p.y);
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
    p.evolveAt=now+stat['windup time'];
    Object.assign(addDevice('pulse',p.x,p.z,p.team,1.2,1.1,1.1,2.1,'#39cddd',p,p.y),{kind:'evolving',name,cueAt:p.evolveAt});
  } else if (name === '차원 표류') {
    p.phaseUntil = now + (stat.duration ?? 10);
    p.driftEntered=now;
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
    p.harmonyUntil=ally.harmonyUntil=p.hasteUntil=ally.hasteUntil=p.stimUntil=ally.stimUntil=now+stat['buff duration'];
    p.link=ally===p?null:ally.id;if(ally!==p)ally.link=p.id;
    for(const target of new Set([p,ally]))Object.assign(addDevice('pulse',target.x,target.z,p.team,.65,1,1,1.8,'#ffc158',p,target.y),{name,kind:'harmony',cueAt:now});
  } else if(name==='소멸'){
    const {path,length,victim}=wirePath(world,line,match.devices,enemies,hasSight);
    const transit=length/stat['pulse speed'],arrival=now+transit;
    const thread=addDevice('nanowire',p.x,p.z,p.team,transit+.42,.08,.08,.08,'#6bdfff',p,p.y);
    Object.assign(thread,{name,path,cueAt:arrival});
    if(victim){
      const start=arrival+stat['windup time'],span=stat['cocoon duration'];
      const d=addDevice('cocoon',victim.x,victim.z,p.team,start-now+span+.12,.8,.8,1.68,'#77ddfa',p,victim.y);
      const route=path.slice(0,-1).reverse().map(([x,y,z])=>({x,y:y-p.height*.65,z}));
      route[route.length-1]={x:p.x,y:p.y,z:p.z};
      const distance=route.reduce((s,point,i)=>s+range(point,i?route[i-1]:victim),0);
      Object.assign(d,{hp:600,targetId:victim.id,route,goal:route[0],start,capture:arrival,pullSpeed:Math.max(3.7,distance/span),caught:false});
    }
  } else if (name === '청부 계약') {
    const reach = 48;
    const victim = enemies
      .map((o) => ({
        o,
        along: vec(o.x - line.origin.x, o.y + o.height * 0.65 - line.origin.y, o.z - line.origin.z).dot(dir),
        error: line.distanceToPoint(vec(o.x, o.y + o.height * 0.65, o.z)),
      }))
      .filter((v) => v.along > 0 && v.along < reach && v.error < 3.4)
      .sort((a, b) => a.along - b.along)[0]?.o;
    if (!victim) {
      world.trace(line.origin, line.at(reach, new T.Vector3()), now, '#ad94ff', 0.38);
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
    Object.assign(cloud,{hp:0,name,kind:'toxinPit',start:now+.7,cueAt:now+.7});
  } else if (name === '재생') {
    if (p.healingPool <= 0) return;
    p.regrowing = true;
    cost = 0;
  } else if (name === '격류') {
    const m=line.at(Math.max(.1,Math.min(distance-.32,12)),new T.Vector3());
    Object.assign(addDevice('pulse',m.x,m.z,p.team,1.25,.44,.44,.44,'#ed5bfc',p,m.y),{kind:'flowAnchor',name,start:now+.75,cueAt:now+.75});
    p.vx=p.vz=p.vy=0;p.nextShot=Math.max(p.nextShot,now+.75);
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
    const m=new T.Vector3();
    let exit=distance+.09;
    // Find the far face even when two map walls have different thicknesses.
    for(let i=0;i<48;i++,exit+=.125){
      line.at(exit,m);
      if(!world.structure.blocked(m.x,m.z,m.y-.02,.025,.04))break;
    }
    if(exit>=distance+6)exit=distance+.12;
    line.at(exit+(name==='여진'?2.6:.10),m);
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
    d.name=name;d.start=now+stat['windup time'];d.cueAt=d.start;
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
    if(name==='올빼미 드론')Object.assign(p.pilot,{hp:100,ready:now+.15,next:now+.15});
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
  } else if (deviceKind(name) && !['독성 연기','사이버 감옥','나노스웜','면도날 덩굴'].includes(name)) {
    const kind = deviceKind(name),
      self = kind === 'beacon',
      pos = kind==='gatecrash' ? line.at(Math.min(1.3,Math.max(.1,distance-.24)),vec(0,0,0)) : self ? p : kind==='camera' ? line.at(Math.max(0,distance-.06),vec(0,0,0)) : point;
    if(kind==='camera' && (!mountInfo.normal || mountInfo.normal[1]>.60 || distance>=castReach || Math.abs(mountInfo.surfaceDistance-distance)>.12))return;
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
    Object.assign(d, { name,kind,hp:45,on:false,angle:p.yaw });
    if(kind==='poisonLine'){
      const path=toxicPath(p,floorAt);if(path.length<2){d.end=now;return;}
      Object.assign(d,{x:path[0][0],y:path[0][1],z:path[0][2],path,hp:0,end:now+300});
    }
    if(kind==='passage' || kind==='interceptor')Object.assign(d,{start:now+(stat['deployment time']??.5),hp:kind==='passage'?50:100,end:now+300});
    if(kind==='camera')d.normal=mountInfo.normal;
    if(kind==='gatecrash')Object.assign(d,{travel:!params.alt,travelSpeed:8,hp:20,end:now+stat['tether duration']});
    if(kind==='rose'){d.normal=mountInfo.normal;d.lock=now+stat['deploy time'];d.hp=20;}
  } else if (distanceSmokes.includes(name)) {
    const m = distanceTarget(world, p, p.yaw, p.pitch, Math.max(2, Math.min(80, params.range ?? 12)));
    if (!m) return;
    const omen = name === '어둠의 장막',
      radius = stat.radius ?? (omen ? 4.1 : 4.6),
      delay = Math.hypot(m.x-p.x,m.z-p.z)/(stat['orb velocity']??64)+(stat['deploy time']??1);
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
    if(!omen)Object.assign(d,{kind:'cove',name,cueAt:d.start});
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
            (m,index) =>
              m &&
              Number.isFinite(m.x) &&
              Number.isFinite(m.z) &&
              (name==='아마겟돈' && index===1 || Math.hypot(m.x-p.x,m.z-p.z)<=tabletRange(name)),
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
    } else if (name === '아마겟돈') {
      if(sites.length!==2 || !Number.isFinite(world.structure.support(sites[0].x,sites[0].z,p.y+6)))return;
      const path=strikePath(targets[0],sites[1]);if(!path.length)return;
      for(const segment of path){
        const floor=floorAt(segment.x,segment.z,targets[0].y+4);
        if(!Number.isFinite(floor))continue;
        const d=addDevice('armageddon',segment.x,segment.z,p.team,segment.delay+.99,12,2,5,'#ffb851',p,floor);
        Object.assign(d,{name,angle:segment.angle,start:now+segment.delay,next:now+segment.delay,pulses:4});
        if(path.indexOf(segment)%4===0)d.cueAt=d.start;
      }
    } else
      for (const m of targets)
        if (smoke) {
          const cloud = addDevice(
            'smoke',
            m.x,
            m.z,
            p.team,
            (stat.duration ?? (name === '계략' ? 13 : name==='웨이브폼'?16.75:15)) +
              (stat['windup time'] ?? stat['deploy time'] ?? 1),
            name==='웨이브폼'?9.44:8.3,
            name==='웨이브폼'?9.44:8.3,
            name==='웨이브폼'?9.44:7.4,
            name === '계략' ? '#b78dc5' : name === '웨이브폼' ? '#9b8bcb' : '#a19081',
            p,
            m.y-(name==='웨이브폼'?3.4:0),
          );
          if(name==='웨이브폼')Object.assign(cloud,{kind:'waveform',name});
          cloud.start = now + (stat['windup time'] ?? stat['deploy time'] ?? 1);
        } else if (guided) createZone('guided', name, m, p, fieldContext());
        else {
          const d = addDevice('orbital', m.x, m.z, p.team, 4.6, 9, 9, 12, '#ffaf52', p, m.y);
          d.start = now + 1.45;
        }
    cost = smoke || guided ? targets.length : 1;
  } else if (hasThrow(name)) {
    const previous = match.arrows.find((a) => a.owner === p.id && a.type === 'satchel' && a.end>now);
    if (name === '폭발 팩' && previous) {
      previous.end = now;
      p.lastCast={name,alt:true,at:now,end:now+.22};
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
    const beam=addDevice('hunterBeam',line.origin.x,line.origin.z,p.team,1.35,.16,.16,.16,'#54afff',p,line.origin.y);
    Object.assign(beam,{name,start:now+.9,axis:dir.toArray(),length:66,radius:1.8});
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
        p.recallEnd=now+10;
        Object.assign(addDevice('pulse',p.x,p.z,p.team,10,1.38,1.38,.08,'#ff9f33',p,p.y),{kind:'phoenixMark',name});
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
        p.drawDuration=id==='blades'?timing['칼날 폭풍']['initial windup time']:id==='tour'?timing['역작']['initial summon time']:WEAPONS[id].equip;
        p.nextShot=now+p.drawDuration;p.zoomStep=0;p.ads=false;
        if(p.local){ads=false;zoomStep=0}
        if (id === 'blades') {
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
  if (!practice() && !(name==='대미 장식' && p.rocketUntil>now))p.charges[i]=Math.max(0,p.charges[i]-cost);
  if(name==='대미 장식')p.rocketUntil=0;
  if (
    i === 2 &&
    !practice() &&
    !p.signatureAt &&
    ['세이지', '소바', '브리치', '오멘', '페이드', '케이/오', '스카이','하버','믹스'].includes(p.agent)
  ) {
    p.signatureInterval = stat.cooldown ?? (p.agent === '세이지' ? 45 : p.agent === '하버'?30:['오멘','믹스'].includes(p.agent) ? 40 : 50);
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
  if(player.evolution)return;
  const dir=vec(source.x-player.x,source.y-player.y-player.height,source.z-player.z).normalize();
  const facing=aim(player.yaw,player.pitch).dot(dir);
  const strength=T.MathUtils.smoothstep(facing,-.65,.5);
  const until=now+.28+(duration-.28)*strength;
  if(!(player.blindUntil>until))player.flashStyle=source.type==='flare'?'hush':source.type==='curve'?'phoenix':'';
  player.blindUntil=Math.max(player.blindUntil??0,until);
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
        { x: a.x, z: a.z, y: ['knife','collapse','suspension'].includes(a.type) ? a.y : base, heal: a.heal },
        p,
        fieldContext(),
      )
    )
      return false;
    if(a.type==='poisonCan' || a.type==='vetoTrap'){
      const gas=a.type==='poisonCan',d=addDevice('deployed',a.x,a.z,p.team,300,.34,.34,.26,gas?'#70bd31':'#3adcdf',p,base);
      Object.assign(d,{kind:gas?'poisonOrb':'vetoTrap',name:a.name,start:now+(gas?.25:1.5),on:false,hp:gas?0:70});return false;
    }
    if(a.type==='swarm' || a.type==='vinePod'){
      const vine=a.type==='vinePod';
      const pod=addDevice('deployed',a.x,a.z,p.team,240,.25,.23,.22,vine?'#b29dbd':'#c657bc',p,base);
      Object.assign(pod,{kind:vine?'vine':'swarm',name:a.name,hp:20,lock:now+.75});
      return false;
    }
    if(a.type==='shock'){
      const shock=addDevice('shockBurst',a.x,a.z,p.team,.85,10,10,10,'#72caff',p,a.y);
      Object.assign(shock,{name:a.name,radius:5,start:now+timing[a.name]['windup time']});return false;
    }
    if(a.type==='cageDisc'){
      const disc=addDevice('deployed',a.x,a.z,p.team,240,.17,.17,.055,'#a8e5ff',p,base);
      Object.assign(disc,{kind:'cage',name:a.name});return false;
    }
    if (a.type === 'barrier') {
      const center = addDevice('meshNode', a.x, a.z, p.team, 30, 0.65, 0.65, 0.7, '#60c8ee', p, base);
      Object.assign(center,{name:'장벽망',cueAt:now+1});
      center.hp=680;center.fortify=now+timing['장벽망']['time taken to fortify'];
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const sideRay=new T.Ray(vec(a.x,base+.32,a.z),vec(dx,0,dz));
        const span=Math.min(10,world.mapHit(sideRay,10,match.devices)-.23);
        if(span<.5)continue;
        const x=a.x+dx*span,z=a.z+dz*span,y=floorAt(x,z,base+1.1);
        if(!Number.isFinite(y) || Math.abs(base-y)>1.2)continue;
        const node = addDevice(
          'meshNode',
          x,z,p.team,30,
          0.5,
          0.5,
          0.55,
          '#9ae4ff',
          p,y,
        );
        node.hp=320;node.fortify=center.fortify;
        node.parent = center.id;
        const panel = addDevice(
          'meshPanel',
          a.x+dx*span*.5,a.z+dz*span*.5,p.team,30,
          dx?span:.12,dz?span:.12,
          2.4,
          '#92e4ff',
          p,
          base,
        );
        panel.nodes=[center.id,node.id];panel.start=now+timing['장벽망']['deploy time'];
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
                  : t === 'seize' ? timing['포박'].windup : t==='net'?timing['중력그물'].windup:.15;
      const d = place(
        k,
        delay + (t === 'seize' ? 4.5 : t === 'haunt' ? 1.5 : 0.28),
        t === 'haunt' ? 0.6 : rad * 2,
        t === 'haunt' ? 0.6 : 0.24,
        { net: '#71cfe7', seize: '#7566a4', haunt: '#814d88', mosh: '#91da55', meddle: '#bb80d4' }[t] ??
          '#a0daff',
        (t==='delivery'?a.y:base)+.03,
      );
      Object.assign(d, { start: now + delay, radius: rad, done: false });
      if (skillAudio[a.name]?.impact) Object.assign(d, { name: a.name, cueAt: d.start });
      d.name=a.name;
      if (t === 'haunt') d.hp=1;
    } else if (a.type === 'recon') {
      const d = place('recon', 3.4, 0.24, 0.24, '#64d9ff', a.y);
      d.name=a.name;d.hp = 20;
      d.next = now + 0.667;
      d.pulses = 2;
      d.normal = a.surfaceNormal;
    } else if (a.type === 'knife') {
      for (const o of match.players) if (hostile(p,o) && Math.hypot(a.x-o.x,a.y-o.y-o.height*.5,a.z-o.z)<15) o.suppressed=now+8;
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
      Object.assign(d,{name:a.name,cueAt:now});
    } else if (a.type === 'stim') place('stimField', 12, 8, 2.5, '#eeb452');
    else if (['flash', 'curve', 'hawk', 'flare'].includes(a.type)) {
      let confirmed=false;
      for (const o of match.players)
        if (!o.down && hasSight(a, o, 24)) {
          const duration =
            a.type === 'hawk'
              ? 1 + 1.25 * Math.min(1, ((a.activatedAt ?? now) - a.created) / 0.75)
              : (timing[a.name]?.['max blind duration'] ?? timing[a.name]?.['max flash duration'] ?? 1.5);
          flashPlayer(o,a,duration);
          if(hostile(p,o))confirmed=true;
        }
      const light=place('pulse',0.26,1.5,1.4,'#fff5ce',a.y);
      if(['curve','flare'].includes(a.type))Object.assign(light,{kind:'flashBloom',name:a.name,cueAt:now});
      if(a.type==='hawk' && confirmed)Object.assign(light,{name:a.name,cueAt:now,audience:p.team});
    } else {
      const r = a.type === 'rocket' ? 6 : a.type === 'bomblet' ? 3 : 5,
        damage = a.type === 'rocket' ? 150 : a.type === 'shock' ? 75 : a.type === 'paint' ? 55 : 38;
      for (const o of match.players) {
        const dist = Math.hypot(o.x - a.x, o.y + o.height * 0.5 - a.y, o.z - a.z);
        if (o.down || dist > r || !hasSight(a, o, r + 1)) continue;
        if (a.type === 'satchel') {
          const amount=blastImpact(a,o,now);
          if(amount && hostile(p,o))hurt(o,amount,p);
          continue;
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
      if(a.type==='satchel'){
        const flash=place('satchelBurst',.42,2*r,.15,'#ff9b30',a.y);
        flash.normal=a.surfaceNormal??[0,1,0];
      }else if(['paint','bomblet','rocket'].includes(a.type)){
        const burst=place('pulse',a.type==='bomblet'?.37:.55,2*r,2*r,'#ff6840',a.y);
        Object.assign(burst,{kind:'paintBurst',name:a.name,radius:r,cueAt:now});
      }else place('pulse',0.22,r*1.3,1.4,projectileColor[a.type]??'#ffc568',a.y-.55);
    }
    return false;
  });
  match.arrows.push(...children);
}
const worldUp=new T.Vector3(0,1,0),worldForward=new T.Vector3(0,0,1),surfaceDirection=new T.Vector3();
function updatePlacementGhost(skill,p){
  const kind={'포탑':'turret','알람봇':'alarmbot','가지치기':'shear','지름길':'passage','요격기':'interceptor'}[skill];
  const veto=kind==='passage' || kind==='interceptor';
  if(!kind && !world.placementGhosts)return;
  const cache=world.placementGhosts??=new Map();
  for(const [key,ghost] of cache)ghost.visible=key===kind;
  if(!kind)return;
  let ghost=cache.get(kind);
  if(!ghost){
    ghost=new T.Group();world.scene.add(ghost);cache.set(kind,ghost);
    const mat=world.projectionMaterial??=new T.MeshBasicMaterial({color:0xaf7aff,transparent:true,opacity:.53,depthWrite:false});
    if(veto){
      const span=kind==='interceptor'?.76:.65;
      const shell=worldSculpture(skill,span),tint=world.vetoProjection??=new T.MeshBasicMaterial({color:0x5af2da,transparent:true,opacity:.53,depthWrite:false});
      shell.traverse(part=>{if(part.isMesh)part.material=tint;});shell.position.y=span*.42;ghost.add(shell);
      const footprint=new T.Mesh(new T.RingGeometry(.46,.48,48),tint);
      footprint.rotation.x=-Math.PI/2;ghost.add(footprint);
    }else if(kind==='shear'){
      const strip=new T.Mesh(new T.BoxGeometry(7.2,.026,.09),mat);ghost.add(strip);
    }else{
      attachProp(ghost,kind,kind==='turret'?.92:.36)?.then(()=>ghost.traverse(part=>{if(part.isMesh)part.material=mat;}));
      const ring=new T.Mesh(new T.RingGeometry(kind==='turret'?.57:.25,kind==='turret'?.61:.28,48),mat);
      ring.rotation.x=-Math.PI/2;ring.position.y=kind==='turret'?-.446:-.166;ghost.add(ring);
    }
  }
  const ray=new T.Ray(vec(p.x,p.y+p.height,p.z),aim(p.yaw,p.pitch)),reach=timing[skill]['max deploy distance']??timing[skill]['deployment distance']??18;
  const point=ray.at(Math.max(.1,world.mapHit(ray,reach,match.devices)-.55),surfaceDirection);
  const y=floorAt(point.x,point.z,point.y+(veto?.4:1.5));ghost.visible=Number.isFinite(y);
  if(ghost.visible){ghost.position.set(point.x,y+(kind==='turret'?.46:kind==='alarmbot'?.18:.025),point.z);ghost.rotation.y=kind==='turret'?wallAngle:p.yaw;}
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
        paint: 'paintshell',swarm:'nanoswarm',vinePod:'razorvine',cageDisc:'cyber-cage',
        knife: 'zeropoint',
        flash: 'flashdrive',
        satchel: 'blast-pack',mosh:'mosh-pit',net:'gravnet',barrier:'barrier-mesh',
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
      } else if ((['delivery','haunt','seize','mpulse','storm','flare','collapse','suspension','curve','poisonCan','vetoTrap'].includes(a.type) || a.name==='뜨거운 손' || a.name==='뱀 이빨')) {
        m.scale.setScalar(1);m.material.visible=false;m.add(worldSculpture(a.name,a.type==='delivery'?.21:.32));
      } else if (a.type === 'cloud') {
        m.geometry = new T.SphereGeometry(0.6, 16, 12);
      }
      visible.set(a.id, m);
    }
    m.position.set(a.x, a.y, a.z);
    if(a.type==='satchel' && a.surfaceNormal){
      if(!m.userData.stuck){
        m.userData.stuck=true;
        if (now-a.stuckAt<.45) fieldSound('pack-stick',a);
        m.quaternion.setFromUnitVectors(worldUp,surfaceDirection.fromArray(a.surfaceNormal));
      }
    }else if (!a.stuck) m.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
  }
  for (const p of match.players) {
    if (!p.pilot || p.down || p.pilot.kind==='스파이캠') continue;
    const id = 'pilot-' + p.id + '-' + p.pilot.kind;
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
        attachProp(holder,slug,slug==='stealth-drone'?.49:slug==='thrash'?.96:slug==='trailblazer'?1.16:.6,true);
        m.userData.mount=holder;
        m.material.visible = false;
      }
      visible.set(id, m);
    }
    const modelY=p.pilot.y-(p.pilot.kind==='잠입 드론'?.25:0);
    const moved=(m.position.x-p.pilot.x)**2+(m.position.z-p.pilot.z)**2>.000001;
    const clip=p.pilot.lungeEnd?'_Attack':p.pilot.jump>.3?'_Jump':p.pilot.jump<-.8?'_Fall':moved?'_Run_N':'_Idle';
    m.userData.mount?.userData.animateProp?.(clip,p.pilot.lungeEnd?now-p.pilot.lungeEnd+.34:now);
    m.position.set(p.pilot.x, modelY, p.pilot.z);
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
function setGhost(p,on){
  if(on){p.ghostOrigin={x:p.x,y:p.y,z:p.z};p.ghost=true;return}
  const floor=floorAt(p.x,p.z,p.y+.34);
  if(Number.isFinite(floor) && !world.intersects(p.x,p.z,floor,.28,match.devices,1.65))p.y=floor;
  else if(p.ghostOrigin)Object.assign(p,p.ghostOrigin);
  p.vx=p.vy=p.vz=0;p.ghost=false;p.ghostOrigin=null;
}
function customAction(p,option){
  if(!isCustom() || !room.host)return;
  const cheats=match.cheats;
  if(option==='ghost'){if(cheats.enabled && !p.down)setGhost(p,!p.ghost);return}
  if(!p.local)return;
  if(option==='enabled'){
    if(cheats.enabled)for(const player of match.players)if(player.ghost)setGhost(player,false);
    match.cheats={enabled:!cheats.enabled};return;
  }
  if(!cheats.enabled)return;
  if(customOptions.includes(option)){cheats[option]=!cheats[option];return}
  if(option==='skip' && match.phase==='buy'){setPhase('fight',TIMES.fight);return}
  if(option==='restart'){
    match.round=0;match.score={blue:0,amber:0};match.winner='';match.attack='blue';
    for(const o of match.players)Object.assign(o,{kills:0,deaths:0,shots:0,hits:0,credits:800,charges:[0,0,1,0],ult:0});
  }
  if(['round','restart','skip'].includes(option)){match.roundEpoch=(match.roundEpoch??0)+1;startRound()}
}
function applyAction(p, a) {
  if (!p || !a) return;
  if(a.kind==='custom'){customAction(p,a.value);return}
  if (
    p.down &&
    !(p.agent === '클로브' && ['arm', 'ability'].includes(a.kind) && [2, 3].includes(a.value?.i ?? a.value))
  )
    return;
  switch (a.kind) {
    case 'recall-tech':{
      if(p.agent!=='킬조이' || ![1,2].includes(a.value))break;
      const placed=match.devices.find(d=>d.end>now && d.name===AGENTS[p.agent].gear[a.value] && d.owner===p.id);
      if(placed)recoverDevice(p,placed);
      break;
    }
    case 'close-pit':
      if(p.agent==='바이퍼')for(const d of match.devices)if(d.owner===p.id && d.kind==='toxinPit')d.end=now;
      break;
    case 'astral-end':
      p.astro=false;break;
    case 'astral-recall': {
      if(!p.astro || p.down || !Number.isFinite(a.value?.x) || !Number.isFinite(a.value?.z))break;
      const star=match.devices.filter(d=>d.kind==='star' && d.owner===p.id && d.end>now && range(d,a.value)<3).sort((u,v)=>range(u,a.value)-range(v,a.value))[0];
      if(star)deviceAction(p,star,true);
      break;
    }
    case 'interact':
      {
        if(p.netUntil>now)break;
        const d = aimedDevice(p);
        const gun=!d && looseGun(p);
        if(p.down || p.detainedUntil>now)break;
        if (d) deviceAction(p, d, true);
        else if(gun){dropWeapon(p,gun.slot);p.kit[gun.slot]=gun.item;equip(gun.slot,p);gun.end=now;}
        else useMechanism(world.mechanisms,p,remoteReach);
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
      p.astro=false;p.queuedSkill = null;
      p.armedSlot = null;
      if (['primary', 'secondary', 'melee', 'special'].includes(a.value)) equip(a.value, p);
      break;
    case 'arm':
      if (Number.isInteger(a.value) && a.value >= 0 && a.value < 4) {
        const gear=AGENTS[p.agent].gear[a.value],stat=timing[gear]??{};
        if(gear==='우주 장벽' && !p.down && !(p.suppressed>now))p.astro=true;
        if(gear==='대미 장식' && !(p.rocketUntil>now)){
          if(p.down || !active() || p.suppressed>now || dm() || !(p.charges[a.value]>0))break;
          p.rocketUntil=now+stat['equip time']+stat['max duration'];
          if(!practice()){p.charges[a.value]--;p.ult=0;}
        }
        p.queuedSkill=null;p.armedSlot=a.value;p.skillReady=now+(stat['equip time']??0);
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
      if(!p.down && (active() || match.phase==='buy')){if(match.core.carrier===p)dropCore(p);else dropWeapon(p,p.selected);}
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
  if (match.awaitingLoad) {
    if (isGuest() || !match.players.every(p => p.sceneReady)) return;
    match.awaitingLoad = false;
  }
  now += dt*(isGuest()?peers.rate(now,performance.now()):1);
  if(isCustom() && match.cheats.enabled && !isGuest()){
    if(match.cheats.clock && ['buy','fight','objective'].includes(match.phase))match.end+=dt;
    for(const player of match.players){
      if(match.cheats.credits)player.credits=9000;
      if(match.cheats.skills){player.charges=AGENTS[player.agent].economy.map((v,i)=>i===3?1:Math.max(1,v.max));player.ult=AGENTS[player.agent].economy[3].points;}
      if(match.cheats.ammo)for(const item of Object.values(player.kit))if(item && !['melee','blades'].includes(item.id))Object.assign(item,ammoFor(item.id));
    }
  }
  world.setClock(now);
  world.clearEffects(now);
  if (match.phase === 'ended') return;
  if (match.trial && now >= match.trial.next) advanceTarget(false);
  if (isGuest()) {
    match.player.ads = ads;
    if(!match.player.pilot)peers.advance(match.player,keys,dt,performance.now(),walk);
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
    for(const slot in p.deviceReturns)if(now>=p.deviceReturns[slot]){
      p.charges[slot]=Math.min(AGENTS[p.agent].economy[slot].max,p.charges[slot]+1);delete p.deviceReturns[slot];
    }
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
    if(p.evolveAt && now>=p.evolveAt){p.evolveAt=0;if(!p.down){p.evolution=true;p.stimUntil=now+3600;evolutionCleanse(p);}}
    if(p.evolution && !p.down)p.hp=Math.min(100,p.hp+dt*5);
    while(p.starReturns?.length && p.starReturns[0]<=now){p.starReturns.shift();p.stars=Math.min(5,p.stars+1);}
    if (p.target) continue;
    if(p.rocketUntil && p.rocketUntil<=now){
      p.rocketUntil=0;
      if(p.agent==='레이즈' && p.armedSlot===3){p.armedSlot=null;p.queuedSkill=null;if(p.local)disarm();}
    }
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
      Object.assign(burst,{name:drone.kind,cueAt:now});
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
    if(p.gateJump && (p.down||p.suppressed>now)){p.destination=null;p.gateJump=false}
    if (p.destination && p.teleportAt <= now) {
      p.gateJump=false;
      Object.assign(p, p.destination, { vy: 0 });
      p.destination = null;
    }
    if (p.agent === '네온') {
      p.fuel = Math.max(0, Math.min(100, (p.fuel ?? 100) + (p.sprinting ? -10 : 5) * dt));
      if (p.fuel <= 0) p.sprinting = false;
    }
    if (p.agent === '바이퍼') {
      const emit = match.devices.filter((d) => d.owner === p.id && d.on && d.kind?.startsWith('poison'));
      p.fuel=Math.max(0,Math.min(100,p.fuel+(emit.length?-100/12*(emit.length>1?1.5:1):now>=p.viperLock?3.33:0)*dt));
      if(!p.fuel || p.down || p.suppressed>now)for(const d of emit)deviceAction(p,d);
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
    owlPing(p,now);
    if(p.cameraDart){
      if(now>=p.cameraDart.next){p.revealTeam=p.cameraDart.team;p.revealEnd=now+.7;p.cameraDart.next=now+2;}
      p.dartRemoval=pressed.has('KeyF') && !(p.netUntil>now)?p.dartRemoval+dt:0;
      if(p.dartRemoval>=1.5){p.cameraDart=null;p.dartRemoval=0;}
    }
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
        (d) => d.type === 'globule' && d.owner === p.id && d.end > now && range(p, d) < 2 && Math.abs(d.y-p.y)<1.8,
      );
      if (g && pressed.has('KeyF')) {
        p.reclaim=(p.reclaimId===g.id?p.reclaim:0)+dt;p.reclaimId=g.id;g.reclaim=p.reclaim;
        if (p.reclaim >= 1.5) {
          g.end = now;
          p.globeCooldowns[g.slot] = now + 15;
          if (g.slot === 3) p.reclaimedThrash = true;
          p.reclaim = 0;
        }
      } else {if(g)g.reclaim=0;p.reclaim=0;p.reclaimId=null;}
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
        const glow=now>=(p.healCueAt??0);
        for (const o of allies){
          o.hp=Math.min(100,o.hp+amount);
          if(glow)Object.assign(addDevice('pulse',o.x,o.z,p.team,.62,.88,.88,.85,'#73e999',p,o.y),{kind:'regrowth',target:o.id});
        }
        if(glow)p.healCueAt=now+.52;
        p.healingPool -= amount;
      }
    } else p.regrowing = false;
    if (p.agent === '제트') p.guiding = pressed.has('KeyC');
    if (['스카이', '피닉스', '페이드', '하버'].includes(p.agent)) p.guiding = pressed.has('SkillMouse');
    p.ads = p.local ? ads : !!input?.ads;
    p.channel = !p.netRemoval && !p.dartRemoval && ((pressed.has('KeyF') && !interactable(world.mechanisms, p)) || pressed.has('Digit4'));
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
    if(p.recall && now>=p.recallEnd)returnPhoenix(p);
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
      if((d.kind==='turret' || d.kind==='rose') && (d.hp<=0 || d.type==='wallFlash')){
        const owner=match.players.find(o=>o.id===d.owner);
        if(owner && !practice())(owner.deviceReturns??={})[2]=now+(d.hp<=0?45:20);
      }
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
        if (o && o.trappedBy===d.id) {
          o.trappedBy = 0;
          o.detainedUntil = 0;
          if (d.hp > 0 && !o.down && d.arrived)
            hurt(
              o,
              9999,
              match.players.find((v) => v.id === d.owner),
            );
        }
      }
      if (['wingman', 'dizzy'].includes(d.kind) || d.type==='mosh') {
        const owner = match.players.find((o) => o.id === d.owner),
          slot=d.type==='mosh'?0:d.kind==='dizzy'?2:1;
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
      if(!d.caught && o && !o.down && now>=d.capture){
        d.caught=true;o.trappedBy=d.id;o.detainedUntil=d.end;Object.assign(d,{x:o.x,y:o.y,z:o.z});
      }
      if (d.caught && o && !o.down && now >= d.start) {
        const r = Math.max(0.001,Math.hypot(d.goal.x-d.x,d.goal.y-d.y,d.goal.z-d.z));
        const f = Math.min(1,dt*d.pullSpeed/r);
        d.x += (d.goal.x - d.x) * f;
        d.z += (d.goal.z - d.z) * f;
        d.y += (d.goal.y - d.y) * f;
        Object.assign(o, { x: d.x, y: d.y, z: d.z, vy: 0 });
        if(f===1){d.route.shift();d.goal=d.route[0];if(!d.goal){d.arrived=true;d.end=now;}}
        d.mesh.position.set(d.x, d.y + d.h / 2, d.z);
      }
      return true;
    }
    if (d.type === 'pit' && caster) {
      if(now<d.start)return true;
      if (caster.down) d.end = now;
      if (range(caster, d) < 12) d.outAt = 0;
      else d.outAt ||= now;
      if (d.outAt && now - d.outAt >= 8) d.end = now;
      for (const o of match.players)
        if (!o.down && !o.evolution && hostile(caster, o) && range(o, d) < 12 && Math.abs(o.y - d.y) < 8) {
          const loss = Math.min(Math.max(0, o.hp - 1), dt * 30);
          o.hp -= loss;
          o.decayLost = (o.decayLost ?? 0) + loss;
          o.decayUntil = now + 1.5;
        }
      return true;
    }
    if(d.kind==='interceptor' && caster){interceptorTick(d,caster,field,match.arrows,match.devices);return true;}
    if(d.kind==='vetoTrap' && caster){vetoTrapTick(d,caster,field);return true;}
    if(d.kind==='toxinCloud' || d.kind==='toxinWall'){
      if(now>=d.start)for(const o of match.players)if(o.team!==d.team && toxinContact(d,o))applyToxin(o,now,dt);
      return true;
    }
    if(d.type==='shockBurst'){
      if(!d.fired && now>=d.start){
        d.fired=true;d.cueAt=now;
        for(const o of match.players){
          const dist=Math.hypot(o.x-d.x,o.y+o.height*.5-d.y,o.z-d.z);
          if(!o.down && dist<d.radius && hasSight(d,o,d.radius+1))hurt(o,Math.round(75-65*Math.min(1,Math.max(0,dist-1)/(d.radius-1))),caster);
        }
      }
      return true;
    }
    if(d.type==='hunterBeam'){tickHunterBeam(d,caster,field);return true;}
    if(d.type==='nestField'){tickNest(d,caster,dt,field);return true;}
    if(d.kind==='cove' && !d.shield && d.shieldAt && now>=d.shieldAt){d.hp=680;d.shield=true;d.cueAt=now;}
    if (d.type === 'zoneEmitter') {
      tickZone(d, caster, field,dt);
      return true;
    }
    if (
      d.type === 'meshPanel' &&
      !d.nodes.every((id) => match.devices.some((n) => n.id === id && n.hp > 0 && n.end > now))
    ) {
      disposeDevice(d);
      return false;
    }
    if(d.type==='meshNode'){
      if(d.parent && !match.devices.some(other=>other.id===d.parent && other.hp>0 && other.end>now)){d.end=now;return true;}
      if(d.fortify && now>=d.fortify){d.hp+=d.parent?160:520;d.fortify=0;}
    }
    if (tickField(d, caster, dt, field)) return true;
    if (d.type === 'blaze' || d.type === 'tide') {
      const owner = match.players.find((p) => p.id === d.owner);
      if (!owner) return true;
      while (!d.stopped && d.path.length < (d.type === 'tide' ? 77 : 27) && now >= d.grow) {
        d.grow += d.type==='tide'?.8/25:.045;
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
              o.slowUntil=now+timing['만조']['slow duration'];
              continue;
            }
            if (o === owner && !d.healed) {
              d.healed = true;
              o.healLeft = 50;
              o.healRate = 12.5;
              o.healTick = 0;
            }else if(o!==owner)hurt(o,hostile(owner,o)?8:8/3,owner);
          }
      }
      return true;
    }
    if (d.travel) {
      const speed = d.travelSpeed ?? (d.type === 'decoy' ? 5.4 : 3);
      const x = d.x - Math.sin(d.angle) * dt * speed,
        z = d.z - Math.cos(d.angle) * dt * speed;
      const floor=d.kind==='gatecrash'?floorAt(x,z,d.y+.32):d.y;
      if (!Number.isFinite(floor) || (d.kind!=='reckoning' && world.structure.blocked(x,z,floor+.1,.1,.22))) d.travel = false;
      else {
        d.x = x;
        d.z = z;
        d.y=floor;
        d.mesh.position.set(x, d.y + d.h / 2, z);
      }
    }
    if(d.kind==='reckoning' && now>=d.start){
      const sin=Math.sin(d.angle),cos=Math.cos(d.angle);
      for(const o of match.players){const x=o.x-d.x,z=o.z-d.z;
        if(o.down || o.team===d.team || Math.abs(x*cos-z*sin)>d.w*.5 || Math.abs(x*sin+z*cos)>.85 || o.y+o.height<d.y || o.y>d.y+d.h)continue;
        o.nearsight=now+3;o.slowUntil=now+2;
      }
      return true;
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
          if (d.type === 'wallFlash'){flashPlayer(o,center,d.flashDuration ?? timing['섬광 폭발']['max blind duration']);if(d.kind==='rose')o.roseFlash=o.blindUntil;}
          else if (aim(o.yaw, o.pitch).dot(direction) > 0.25) o.nearsight = now + 0.25;
        } else if (d.type === 'haunt') {
          o.revealTeam = d.team;
          o.revealEnd=now+.8;
          if(!(o.trailEnd>now))o.trailOrigin=[d.x,d.y,d.z];
          o.trailEnd=now+timing['귀체']['trail duration'];o.trailTeam=d.team;
        } else if (d.type === 'aftershock') hurt(o,hostile(owner,o)?80:26,owner);
        else if (d.type === 'meddle') {
          if (!(o.decayUntil > now)) {
            const loss = Math.min(90, Math.max(0, o.hp - 1));
            o.hp -= loss;
            o.decayLost = (o.decayLost ?? 0) + loss;
          }
          o.decayUntil = now + 3;
        } else if (d.type === 'net') {o.netUntil=Number.MAX_SAFE_INTEGER;o.netRemoval=0;}
        else {
          o.tag=now+2.5;
          if(d.name==='특별 배송')hurt(o,Math.round(35-15*Math.min(1,range(o,d)/d.radius))*(hostile(owner,o)?1:1/3),owner);
        }
      }
      if(d.type==='aftershock'){d.pulses--;d.next=d.pulses?now+.6:d.end;}
      else d.next=now+(['eye','haunt'].includes(d.type)?.15:9);
    }
    if (d.type === 'dronePulse' && now >= d.born + 0.4) {
      const r = Math.min(16,(now-d.born-.4)*timing['잠입 드론']['pulse velocity']),
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
    if(d.type==='armageddon'){
      while(d.pulses>0 && now>=d.next){
        d.pulses--;d.next+=.25;
        for(const p of match.players)if(!p.down && caster && insideStrip(d,p))hurt(p,hostile(caster,p)?60:20,caster);
      }
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
    if(d.kind==='cyberCage')for(const o of match.players){
      if(o.down || o.team===d.team)continue;
      const inside=range(o,d)<d.radius && o.y+o.height>d.y && o.y<d.y+d.h;
      if(inside && !d.inside[o.id])d.cueAt=now;
      d.inside[o.id]=inside;
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
        (!hostile(owner,o) && !d.acid && !(d.phoenix && o!==owner)) ||
        o.down || o.evolution ||
        o.y > d.y + d.h + 0.38 ||
        o.y + o.height < d.y ||
        Math.abs(o.x - d.x) > d.w / 2 ||
        Math.abs(o.z - d.z) > d.d / 2
      )
        continue;
      if(d.type==='slow' && (!d.radius || range(o,d)<=d.radius))o.slowUntil=now+.18;
      else if(d.type==='trap')o.tag=now+.7;
      if (burn && Math.hypot(o.x - d.x, o.z - d.z) <= d.w / 2) {
        if (d.acid) o.vulnerable = now + 2;
        hurt(o,(d.phoenix?15:d.acid?3:10)*(o===owner || hostile(owner,o)?1:1/3),owner);
      }
    }
    return true;
  });
  for(const p of match.players)if(p.evolution && !p.down)evolutionCleanse(p);
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
  const { camera, core } = world;
  if (!match) {
    const a = realTime * 0.00014;
    camera.position.set(42 * Math.cos(a), 48, 42 * Math.sin(a));
    camera.lookAt(0, 0, 0);
    camera.fov = 57;
    core.visible = false;
  } else {
    for (const d of match.devices) {
      if(dimensionalEffect(d,now,match.player))continue;
      if(d.type==='nanowire')drawWire(d,now);
      const specialVisual=presentAbility(d,now);
      if(!specialVisual)drawDevice(d, now);
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
        presentFieldCue(d);
      }
      const cueAt = d.cueAt ?? (d.type === 'groundWave' ? d.start : undefined);
      if (cueAt !== undefined && now >= cueAt && d.mesh.userData.lastSound !== cueAt) {
        d.mesh.userData.lastSound = cueAt;
        if (now - cueAt < 0.55 && (!d.audience || d.audience===match.player.team)) playSkillCue(d, d.name, 'impact');
      }
      if(specialVisual){if(d.kind==='vetoTrap' && d.team!==match.player.team && !d.triggerAt && now>d.start && range(match.player,d)>2.5)d.mesh.visible=false;continue;}
      if(d.kind==='droppedGun'){
        const mesh=d.mesh;
        if(!mesh.userData.requested){mesh.userData.requested=true;mesh.scale.setScalar(1);attachProp(mesh,modelKey(d.item.id,d.item.groundSkin),d.slot==='primary'?.89:.34);}
        mesh.position.set(d.x,d.y+.11,d.z);mesh.rotation.set(0,d.angle,1.44);continue;
      }
      if(d.kind==='trapwire' && d.wireEnd){wireVisual(d,now,match.player);continue}
      if(d.kind==='theft' || d.kind==='knife'){
        const mesh=d.mesh;
        if(!mesh.userData.requested){mesh.userData.requested=true;mesh.scale.setScalar(1);mesh.material.visible=false;
          attachProp(mesh,d.kind==='theft'?'neural-theft':'zeropoint',d.kind==='theft'?.31:.34);}
        mesh.position.set(d.x,d.y+(d.kind==='theft'?.19:.03),d.z);continue;
      }
      if(d.kind==='shear'){
        const mesh=d.mesh;mesh.visible=d.team===match.player.team || range(match.player,d)<3.5;
        mesh.scale.set(7.1,.04,.08);mesh.position.set(d.x,d.y+.028,d.z);mesh.rotation.y=d.angle;continue;
      }
      if(['swarm','vine','rose','alarmbot'].includes(d.kind)){
        const mesh=d.mesh,rangeToViewer=range(match.player,d);
        mesh.visible=d.team===match.player.team || !!d.chasing || rangeToViewer<(timing[d.name]?.['detection radius']??7);
        if(d.type==='deployed' && !mesh.userData.requested){
          mesh.userData.requested=true;mesh.material.visible=false;mesh.scale.setScalar(1);
          attachProp(mesh,{swarm:'nanoswarm',vine:'razorvine',rose:'arc-rose'}[d.kind],d.kind==='rose'?.31:.23);
          if(d.normal)mesh.quaternion.setFromUnitVectors(worldUp,surfaceDirection.fromArray(d.normal));
        }
      }
      if(d.kind==='camera'){
        const mesh=d.mesh;
        if(!mesh.userData.requested){
          mesh.userData.requested=true;mesh.scale.setScalar(1);
          attachProp(mesh,'spycam',.31);
          if(d.normal)mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3().fromArray(d.normal).normalize());
        }
        mesh.position.set(d.x,d.y,d.z);
      }
      if (['companion', 'agentPulse', 'groundWave', 'decoy', 'plane'].includes(d.type)) {
        const mesh = d.mesh;
        mesh.position.set(d.x, d.y + d.h / 2, d.z);
        mesh.rotation.y = d.trackAngle ?? d.angle ?? 0;
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
          if(d.kind==='wingman'){
            mesh.scale.setScalar(1);attachProp(mesh,'wingman',.78,true);
          }else{
            const heightOrSpan={'boom-bot':.58,dizzy:.62,turret:.92,alarmbot:.36,trademark:.37,'sonic-sensor':.32,lockdown:1.12};
            mesh.scale.setScalar(1);const size=heightOrSpan[d.kind]??.48;
            mesh.userData.propHeight=size;mesh.material.visible=false;attachProp(mesh,fieldProp(d.kind),size,true);
          }
        }
        if(mesh.userData.propHeight){
          mesh.position.y=d.y+mesh.userData.propHeight*.43;
          const clip=d.kind==='boom-bot' ? d.impactAt?'Explode_Jump':d.chasing?'Alert_Idle':now<d.start?'Equip':'_Idle' : d.kind==='dizzy' ? now<d.start?'_Intro':now-(d.firedAt??-10)<.32?'_Fire':'_Active' : d.chasing?'_Run':'_Idle';
          mesh.userData.animateProp?.(clip,now-(clip==='_Fire'?d.firedAt:d.born));
          if(d.kind==='sonic-sensor' && d.normal){
            mesh.position.y=d.y;mesh.quaternion.setFromUnitVectors(worldForward,surfaceDirection.fromArray(d.normal).normalize());
            mesh.visible=d.team===match.player.team || !!d.triggerAt || sensorArea(d,match.player);
          }
        }
        if(d.kind==='wingman'){
          mesh.position.y=d.y+.39;
          const clip=d.channelEnd ? (d.objective?.operation==='defuse'?'Bomb_DeActivate_Loop':'Bomb_Activate') :
            d.impactAt?'Attack_Aggro_Intro':now<d.start?'Intro':d.objective?'Run_Bomb':d.chasing?'Run_Aggro':'_Run';
          mesh.userData.animateProp?.(clip,now-(d.impactAt?d.impactAt-.6:d.born));
        }
      }
    }
    drawProjectiles();
    const watch = observer();
    drawTrails(world,match.players,watch,now);
    const self = match.player;
    const shadow=watch.nearsight>now,scoutView=watch.pilot?.kind==='정찰자',
      astral = watch === self && armedName() === '어둠의 장막' && alternateView,
      pilotView = watch.pilot?.kind === '잠입 드론';
    const pit = match.devices.find(
      (d) => d.type === 'pit' && now>=d.start && range(watch,d)<12 && Math.abs(watch.y-d.y)<8,
    );
    world.scene.fog.near = pit ? 1 : shadow ? 2 : 62;
    world.scene.fog.far=pit?8.1:shadow?7:scoutView?timing['정찰자']['vision radius']:190;
    world.scene.fog.color.set(pit?'#54843d':shadow?'#281b47':scoutView?'#447533':'#9ac6d3');
    canvas.style.filter = astral
      ? 'sepia(.65) hue-rotate(200deg) saturate(1.8) brightness(.76)'
      : scoutView ? 'sepia(.52) hue-rotate(49deg) saturate(1.5)' : pilotView
        ? 'saturate(.6) contrast(1.16)'
        : shadow
          ? 'brightness(.64)'
          : '';
    hud.classList.toggle('evolved',!!watch.evolution);
    hud.classList.toggle('suspended',watch.suspendedUntil>now);
    hud.classList.toggle('chokehold',watch.deafUntil>now && !!watch.tether);
    hud.classList.toggle('dimensional-drift',watch.agent==='요루' && watch.phaseUntil>now);
    const speed = Math.hypot(watch.vx, watch.vz);
    const movingView=isGuest()?(watch===self?peers.view():peers.other(watch,realTime)):null;
    camera.position.set(
      movingView?.x??watch.x,
      (movingView?.y??watch.y) + (movingView?.height??watch.height) + (unlocked || screen === 'game' ? (0.013 * Math.sin(now * 12) * speed) / 6 : 0),
      movingView?.z??watch.z,
    );
    const piloting=watch.pilot && !(watch.pilot.ready>now);
    if (piloting) camera.position.set(watch.pilot.x, watch.pilot.y, watch.pilot.z);
    camera.rotation.set(watch.pitch, watch.yaw, 0, 'YXZ');
    camera.fov = 72;
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
    const gun = heldWeapon(watch).id;
    if (audio && world.baseGun !== gun) {
      world.baseGun = gun;
      prepareBase(audio, gun, 'shot');
      prepareBase(audio, gun, 'reload');
    }
    const skin = currentSkin(watch);
    if (world.skinId !== skin?.profileKey || world.skinAudio !== audio) {
      world.skinId = skin?.profileKey;
      world.skinAudio = audio;
      prepareSkin(skin,audio);
    }
    if (skin?.topFragOn)
      watch.championAura = watch.kills > 0 && match.players.every((o) => o.kills <= watch.kills);
    else watch.championAura = false;
    const liveSkill =
      (watch === self ? armedName() : '') || (watch.regrowing?'재생':'') || (watch.agent==='요루' && watch.phaseUntil>now?'차원 표류':'') ||
      (watch.lastCast?.end > now &&
      !['칼날 폭풍', '역작', '헤드헌터', '순풍', '고속 기어', '오버드라이브'].includes(watch.lastCast.name)
        ? watch.lastCast.name
        : '');
    if(watch===self)watch.pulseMode=healPulse;
    world.first.update(
      watch,
      gun,
      skin,
      now,
      !piloting && !watch.down && !(liveSkill === '어둠의 장막' && alternateView),
      watch.reloadDuration || weaponFor(watch).reload,
      liveSkill,
      watch===self && chargeStart!==null ? Math.min(1,(performance.now()-chargeStart)/1000) : 0,
    );
    updatePlacementGhost(watch===self && !watch.down && !piloting?armedName():'',watch);
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
    const optical=watch.ads && !watch.pilot && !liveSkill && !watch.down && !watch.reloading && weaponFor(watch).ads;
    const scoped=optical && scopeLevels[gun];
    if(scoped)world.first.visible=false;
    drawScope(get('scope'),optical?gun:null,watch.zoomStep??1,
      !reticleProfile && grounded(watch) && Math.hypot(watch.vx,watch.vz)<.45 && watch.bloom<.006,skin);
    if (optical) {
      camera.fov = zoomFov(72,scoped?.[Math.max(0,(watch.zoomStep||1)-1)]??optical.zoomMultiplier);
    }
    const inForm=watch===self && !self.down && armedName()==='우주 장벽';
    if(world.astralView)world.astralView.group.visible=inForm;
    hud.classList.toggle('astral-form',inForm);
    if(inForm){
      world.astralView.update(camera,self,localKeys,cursor,world,HALF,realTime,divideMode,marks[0]);
      world.scene.fog.near=44;world.scene.fog.far=125;world.scene.fog.color.set('#3c255c');
      canvas.style.filter='sepia(.96) saturate(2.8) hue-rotate(232deg) contrast(1.16) brightness(.82)';
    }
    world.playersInView.prepare();
    for (const o of match.players) {
      const { g, legs } = o.model;
      const loc=isGuest()?peers.other(o,realTime):o;
      const pitHighlight=pit?.owner===watch.id && hostile(watch,o) && range(watch,o)<8.1 && hasSight({...watch,y:watch.y+watch.height},o,8.4);
      const revealed=pitHighlight || (o.revealTeam===self.team && o.revealEnd>now);
      g.visible=(o!==watch || !!watch.pilot || inForm) && (!inForm || !hostile(watch,o) || revealed) && alive(o) && !o.ghost && world.playersInView.visible(o,loc,now,revealed)
        && !(o.agent==='요루' && o.phaseUntil>now && hostile(watch,o) && range(watch,o)>15);
      if(!g.visible)continue;
      g.position.set(loc.x,loc.y,loc.z);
      g.rotation.y=loc.yaw;
      playerFieldVisual(g,o,now);
      o.model.animate?.(
        now,
        Math.min(1, Math.hypot(o.vx, o.vz) / 6),
        revealed,
        modelKey(heldWeapon(o)?.id, currentSkin(o)),
        currentSkin(o),
        o.strike,
        o.pitch,
        o.armedSlot!=null ? AGENTS[o.agent].gear[o.armedSlot] : o.lastCast?.end>now && now-o.lastCast.at<.14 ? o.lastCast.name : null,
      );

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
  world.renderWorld();
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
  radar.save();
  const projected=watch===local && armedName()==='독성 장막';
  const wall=match.devices.find(d=>d.kind==='poisonLine' && d.owner===watch.id && d.end>now);
  if(projected || wall){
    const path=projected?toxicPath(watch,floorAt):wall.path;
    if(path?.length){radar.beginPath();for(let i=0;i<path.length;i++){const [x,,z]=path[i];radar[i?'lineTo':'moveTo'](mapPx(x),mapPx(z));}
      radar.lineWidth=1.7;radar.strokeStyle=projected?'#ccff83':wall.on?'#9bed42':'#76a15d';radar.setLineDash(projected?[2,2]:[]);radar.stroke();}
  }
  for(const d of match.devices)if(d.team===watch.team && d.end>now && ['star','passage','interceptor','poisonOrb'].includes(d.kind)){
    radar.fillStyle=d.kind==='star'?'#ffc47f':d.kind==='poisonOrb'?'#91d84c':'#68e1d7';
    radar.fillRect(mapPx(d.x)-1.5,mapPx(d.z)-1.5,3,3);
  }
  radar.restore();
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
  hud.classList.toggle('owl-camera',watch.pilot?.kind==='올빼미 드론');
  hud.classList.toggle('tejo-camera',watch.pilot?.kind==='잠입 드론' && now>=watch.pilot.ready);
  hud.classList.toggle('thrash-camera',watch.pilot?.kind==='요동봇' && now>=watch.pilot.ready);
  if (p.down && armedSkill !== null && !(p.agent === '클로브' && armedSkill === 2)) disarm();
  minimap(watch);
  const tablet = get('tablet-map');
  tablet.hidden=!tabletNames.includes(armedName()) || armedName()==='우주 장벽';
  tablet.classList.toggle('waveform-map',armedName()==='웨이브폼');
  const tejoMap=isTejoMap(armedName());tablet.classList.toggle('tejo-projection',tejoMap);
  if((tejoMap || armedName()==='웨이브폼') && !tablet.hidden)drawTejoMap(tablet,mapBase,HALF,p,armedName(),marks,cursor);
  else if (!tablet.hidden) {
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
          (match.awaitingLoad ? '플레이어 전장 로딩 중' : phaseNames[match.phase])) +
      '</span>',
  );
  match.feed = match.feed.filter((e) => e.end > now).slice(-4);
  updateHudPanel('feed', match.feed.map((o) => '<div>' + escape(o.text) + '</div>').join(''));
  const meter = Math.hypot(p.vx, p.vz);
  const posture =
    p.mode === 'crouch' ? '앉기 · 무음' : p.mode === 'walk' ? '걷기 · 무음' : meter < 0.2 ? '정지' : '달리기';
  document.body.classList.toggle('hush-flashed',p.flashStyle==='hush' && p.blindUntil>now);
  document.body.classList.toggle('phoenix-flashed',p.flashStyle==='phoenix' && p.blindUntil>now);
  document.body.classList.toggle('rose-flashed',p.roseFlash>now);
  document.body.classList.toggle('blind', p.blindUntil > now);
  if (p.blindUntil > now) document.body.style.setProperty('--flash-opacity', Math.min(1,(p.blindUntil-now)/.38));
  document.body.classList.toggle('plasma-blind', p.plasmaUntil > now);
  updateHudPanel('health', '<strong><i aria-hidden="true">✚</i> ' +
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
    '</small>');
  const gun = heldWeapon(watch);
  updateHudPanel('ammo', '<strong>' +
    (gun.id === 'melee'
      ? '근접'
      : gun.id === 'blades'
        ? '◆ ' + gun.mag
        : gun.mag + '<em> / ' + gun.reserve + '</em>') +
    '</strong><small>' +
    WEAPONS[gun.id].name +
    (watch.reloading ? ' · 재장전 중' : ' · ' + p.credits.toLocaleString('ko-KR') + ' ₡') +
    '</small>');
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
  const scoped=watch.ads && scopeLevels[gun.id] && !watch.reloading;
  const steady=grounded(watch) && Math.hypot(watch.vx,watch.vz)<.45 && watch.bloom<.006;
  cross.hidden=p.down || screen!=='game' || (scoped && (!steady || !reticleProfile || gun.id==='tour'));
  reticle(cross,reticleProfile,{color:settings.color,ads:watch.ads,sniper:!!scoped,
    move:settings.dynamic?Math.max(0,spreadFor(weaponFor(p),meter,!grounded(p),false,0)-weaponFor(p).spread)*140:0,
    fire:settings.dynamic?p.bloom*140:0});
  const core = match.core;
  const prompt = p.down
    ? '관전 · 좌클릭으로 전환'
    : p.netUntil>now ? '[F 유지] 중력그물 제거 · '+Math.min(100,Math.floor((p.netRemoval??0)/1.5*100))+'%'
    : p.cameraDart ? '[F 유지] 추적용 다트 제거 · '+Math.min(100,Math.floor(p.dartRemoval/1.5*100))+'%'
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
  const mechanism=interactable(world.mechanisms,p,remoteReach);
  const aimed=aimedDevice(p),pickupGun=aimed?null:looseGun(p);
  const mechanismHint = p.pilot
    ? '좌클릭 장치 사용 · 스킬 키로 복귀'
    : pickupGun?'[F] '+WEAPONS[pickupGun.item.id].name+' 줍기'
    : aimed
      ? (['sonic-sensor','rose','star','interceptor'].includes(aimed.kind) || match.phase==='buy' && ['swarm','vine','shear','vetoTrap','passage','poisonOrb'].includes(aimed.kind))?'[F] '+aimed.name+' 회수':'[F] 설치한 스킬 작동'
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
      ? armedName()==='우주 장벽' ? '별 '+p.stars+'/5 · '+accessHint('우주 장벽') : armedName()==='대미 장식' && p.rocketUntil>now ? '대미 장식 · '+Math.min(10,Math.ceil(p.rocketUntil-now))+'초 · 좌클릭 발사'
      : distanceSmokes.includes(armedName())
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
  updateHudPanel('message', (watch.pilot?.kind==='올빼미 드론'?'<strong class="owl-telemetry">'+(watch.owlHitUntil>now?'표적 명중':watch.pilot.next>now?'다트 충전 중':'다트 준비')+' · '+Math.max(0,Math.ceil(watch.pilot.end-now))+'초</strong>':'')+
    (p.jammedUntil>now?'<strong class="field-alert scanned">주 무기 사용 불가</strong>':'')+
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
      : ''));
  board.hidden = !keys.has('Tab') || screen !== 'game';
  if (!board.hidden) {
    updateHudPanel('scoreboard',
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
      '</tbody></table>');
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
  if(screen==='collection'){closeCollectionMotion?.();closeCollectionMotion=null;stopAnimationAudio();if(target!=='collection')previewWeapon(null)}
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
      heading('플레이', '방 코드로 참가') +
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
          (r.players.length < (r.minimumPlayers ?? 2) || r.connected < r.players.length ? 'disabled' : '') +
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
  if (target === 'collection') content = collection(collectionGun, equipped, skinOptions,agentId);
  if (target === 'settings') content = settingsForm(settings)+(isCustom() && match?customControls(room.host,match.cheats,match.player.ghost):'');
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
  if(target==='collection'){
    const id=equipped[collectionGun];
    previewWeapon(get('weapon-turntable'),collectionGun,skinProfile(skinCatalog[collectionGun]?.find(v=>v.id===id),skinOptions[id]));
  }
  if(target==='settings')reticle(get('reticle-preview'),reticleProfile,{color:settings.color});
}
function purchase(p, id) {
  if (p.down || rush() || (!practice() && !dm() && match.phase !== 'buy')) return;
  const free = practice() || dm(),
    skill = /^skill-([0-2])$/.exec(id);
  const armor = Object.hasOwn(ARMOR, id) ? ARMOR[id] : null,
    gun = Object.hasOwn(skinCatalog, id) ? WEAPONS[id] : null;
  if (!armor && !gun && !skill) return;
  if(skill && p.agent==='아스트라'){if(p.stars<5 && (free || p.credits>=150)){p.stars++;if(!free)p.credits-=150;}return;}
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
    if(Number.isFinite(i.stamp)){
      if(i.stamp<=(p.motionStamp??-1))return;
      p.motionStamp=i.stamp;p.motionSeen=now;
    }
    heldRemotes.set(p.id, {
      keys: i.keys.slice(0, 24),
      yaw: i.yaw,
      pitch: Math.max(-1.53, Math.min(1.53, i.pitch)),
      ads: !!i.ads,
      fire: !!i.fire,
    });
    if (i.sceneReady !== false) p.sceneReady = true;
    p.ads=!!i.ads && !!weaponFor(p).ads && !p.reloading;
    p.zoomStep=p.ads?Math.min(scopeLevels[heldWeapon(p).id]?.length??1,Math.max(1,Number(i.zoomStep)||1)):0;
    p.skinId = typeof i.skinId === 'string' && i.skinId.length === 36 ? i.skinId : null;
    p.skinLevel = Number.isInteger(i.skinLevel) ? i.skinLevel : undefined;
    p.skinVariant = typeof i.skinVariant === 'string' ? i.skinVariant : null;
    p.family = currentSkin(p)?.family ?? null;
    p.yaw = i.yaw;
    p.pitch = i.pitch;
    for (const a of (Array.isArray(i.actions) ? i.actions : []).slice(0,24)) {
      if(!a || (Number.isSafeInteger(a.id) && a.id<=(p.lastInputAction??0)))continue;
      applyAction(p,a);
      if(Number.isSafeInteger(a.id))p.lastInputAction=a.id;
    }
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
    data = await loadTerrain(map,softwareGraphics(canvas));
  } catch (error) {
    if (token === transition) {
      home();
      notice = error.message;
      show('home');
    }
    return;
  }
  if (token !== transition) return;
  world?.stopFinishSound?.();
  world?.finishFx?.update(Infinity);
  clearMatch();
  world?.dispose();
  setArena(map);
  world = createWorld(canvas, data);
  drawBase();
  buildMatch(roster);
  get('load-meter').innerHTML = meter(80, '전장 준비');
  const p = match.player;
  world.first.update(p, heldWeapon(p).id, currentSkin(p), now, true, weaponFor(p).reload);
  const loadedWorld=world;
  await Promise.all([
    Promise.all(match.players.map(p=>p.model?.animate?.ready)).then(()=>{
      if(token===transition)return loadedWorld.renderer.compileAsync(loadedWorld.scene,loadedWorld.camera);
    }),
    warmFieldMaterials(loadedWorld),
    warmLoadout(Object.values(p.kit).filter(Boolean).map(({id})=>[
      id,skinProfile(skinCatalog[id]?.find(s=>s.id===equipped[id]),skinOptions[equipped[id]])
    ])),
    loadedWorld.first.loading.then(()=>{
      if(token===transition)return loadedWorld.renderer.compileAsync(loadedWorld.first.scene,loadedWorld.first.cam);
    })
  ]);
  if(token===transition && mode==='match'){
    const active=()=>token===transition;
    await warmWorldProps(loadedWorld,match.players.flatMap(player=>AGENTS[player.agent].gear),active);
    if(active())await loadedWorld.first.warmSkills(loadedWorld.renderer,p,heldWeapon(p).id,currentSkin(p),AGENTS[p.agent].gear,now,weaponFor(p).reload,active);
  }
  if(token===transition)await loadedWorld.warmSpawn(p,()=>token===transition);
  if(token===transition)drawWorld(performance.now());
  await nextFrame();
  if (token !== transition) return;
  paused = practice();
  p.sceneReady = true;
  unlocked = false;
  show('ready');
}
const stateKeys =
  'x z y vx vz yaw pitch height team hp shield mode kit selected reloading nextShot bloom shot stepCount down shots hits kills deaths credits charges ult scan fuel pilot ride travel revealTeam revealEnd volley volleyEnd suppressed blindUntil stimUntil phaseUntil nearsight sprinting slideUntil beamUntil beamAmmo dashExpires skinId skinLevel skinVariant strike roundKills lastKill inspectUntil'.split(
    ' ',
  );
stateKeys.push(
  'driftEntered','blastMotion','motionStamp','motionSeen','jumpHeld','ghost','lastInputAction','ads','zoomStep','drawDuration',
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
  'flashStyle','flow','holdY','evolution','evolveAt','astro','recall','recallEnd','starTimers','starReturns','trappedBy','downedKayo','cameraDart','dartRemoval','overloadedUntil','regrowing','healingPool','rocketUntil',
  'trailEnd','trailOrigin','trailTeam','netRemoval','harmonyUntil','roseFlash','owlDart','owlHitUntil','vineUntil',
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
    roundEpoch:match.roundEpoch??0,cheats:isCustom()?match.cheats:undefined,
    awaitingLoad: match.awaitingLoad,
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
    s.devices.length > 1024 ||
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
  const firstSnapshot=lastRevision<0,stamp=performance.now();
  lastRevision = s.revision;
  match.awaitingLoad = s.awaitingLoad === true;
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
    newRound = match.round !== s.round || (match.roundEpoch??0)!==(s.roundEpoch??0);
  match.roundEpoch=s.roundEpoch??0;
  if(isCustom() && s.cheats){match.cheats=s.cheats;}
  now = peers.clock(s.now,stamp,firstSnapshot||newRound,now);
  for (const k of ['round', 'score', 'attack', 'phase', 'end', 'result', 'winner', 'feed']) match[k] = s[k];
  for (const entry of s.players) {
    const p = match.players.find((o) => o.id === entry.id);
    if (!p) continue;
    const movedAbruptly=firstSnapshot||newRound||p.down!==entry.down||!!p.ghost!==!!entry.ghost||Math.hypot(p.x-entry.x,p.y-entry.y,p.z-entry.z)>3;
    const yaw = p.yaw,
      pitch = p.pitch,
      shot = p.shot,
      steps = p.stepCount,
      hits = p.hits,
      inspectPrev = p.inspectUntil,
      reloadPrev = p.reloading,
      rocketPrev=p.rocketUntil,
      killsPrev = p.kills;
    for (const k of stateKeys) if (entry[k] !== undefined) p[k] = entry[k];
    if(p.local && p.agent==='레이즈' && armedSkill===3 && rocketPrev>0 && !p.rocketUntil)disarm();
    if(p.local && queuedActions.length && Number.isSafeInteger(entry.lastInputAction)){
      let consumed=0;
      while(consumed<queuedActions.length && queuedActions[consumed].id<=entry.lastInputAction)consumed++;
      if(consumed)queuedActions.splice(0,consumed);
    }
    if (p.local && !newRound) {
      p.yaw = yaw;
      p.pitch = pitch;
    }
    if(p.local)peers.reconcile(p,s.now,stamp,movedAbruptly,walk);else peers.record(p,stamp,movedAbruptly);
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
  const existing = new Map(match.devices.map(d=>[d.id,d]));
  const present = new Set(s.devices.map((d) => d.id));
  match.devices = match.devices.filter((d) => {
    if (present.has(d.id)) return true;
    disposeDevice(d);
    return false;
  });
  for (const d of s.devices) {
    let copy = existing.get(d.id);
    if (!copy) copy = addDevice(d.type, d.x, d.z, d.team, d.end - now, d.w, d.d, d.h, d.color, null, d.y);
    Object.assign(copy, d);
    presentFieldCue(copy);
    copy.mesh.position.set(copy.x, copy.y + copy.h / 2, copy.z);
  }
  if(screen==='settings' && isCustom()){
    const old=menu.querySelector('.custom-game-controls'),next=customControls(false,match.cheats,match.player.ghost);
    if(!old && next)menu.querySelector('.panel').insertAdjacentHTML('beforeend',next);
    else if(old && !next)old.remove();
    else if(old && old.querySelector('[data-custom="ghost"]')?.getAttribute('aria-pressed')!==String(!!match.player.ghost))old.outerHTML=next;
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
  if (!room?.room?.started || !match || (room.posting??0)>=3 || time - (room.netAt??0) < 50) return;
  room.netAt = time;
  room.posting=(room.posting??0)+1;
  const client = room;
  const payload = client.host
    ? { state: snapshot() }
    : {
        input: {
          stamp:time,
          sceneReady: match.player.sceneReady === true,
          zoomStep,
          keys: [...keys],
          yaw: match.player.yaw,
          pitch: match.player.pitch,
          ads,
          skinId: currentSkin(match.player)?.id,
          skinLevel: currentSkin(match.player)?.level,
          skinVariant: currentSkin(match.player)?.variant,
          fire: fireHeld,
          actions: queuedActions.slice(0,24),
        },
      };
  void client
    .request(client.host ? 'state' : 'input', payload)
    .then(()=>{client.failedSince=null})
    .catch(error => {
      if(room!==client)return;
      client.failedSince??=performance.now();
      if([400,401,403,404,413].includes(error.status) || performance.now()-client.failedSince>12000)
        roomEvent('closed','서버 연결이 종료되었습니다.');
    })
    .finally(() => {
      client.posting--;
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
  if(d.preview && screen==='collection'){
    closeCollectionMotion?.();closeCollectionMotion=null;stopAnimationAudio();
    if(d.preview==='model'){show('collection');return}
    previewWeapon(null);
    const id=equipped[collectionGun],skin=skinProfile(skinCatalog[collectionGun]?.find(x=>x.id===id),skinOptions[id]);
    const area=get('weapon-turntable');soundOn();prepareSkin(skin,audio);
    closeCollectionMotion=collectionMotion(area,collectionGun,skin,agentId,d.preview,duration=>{
      if(!audio || !settings.volume)return;
      if(!playSkinEvent(skin,d.preview,duration,settings.volume*.82,audio,collectionGun,0,Infinity)){
        if(d.preview==='reload'||d.preview==='shot')playBase(audio,collectionGun,d.preview,settings.volume*.82,0);
        else if(d.preview==='light'||d.preview==='heavy')recordedEffect('knife-'+d.preview,settings.volume*.82);
        else playHandling(audio,d.preview,settings.volume*.82);
      }
    });
    for(const btn of menu.querySelectorAll('[data-preview]'))btn.setAttribute('aria-pressed',String(btn===b));
    return;
  }
  if(d.custom){command('custom',d.custom);show('settings');return}
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
    case 'create-room':
      mode = 'match';
      selectDestination = d.action === 'create-room' || playlist === '사용자 설정 게임' ? 'create' : 'queue';
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
    case 'import-reticle':
    case 'reset-reticle': {
      const code=d.action==='import-reticle'?get('crosshair-code').value.trim():'';
      const parsed=parseCrosshair(code);
      if(d.action==='import-reticle' && !parsed){get('reticle-result').textContent='코드 형식을 확인해 주세요.';break}
      settings.crosshairCode=code;reticleProfile=parsed;save('settings',settings);
      get('crosshair-code').value=code;reticle(get('reticle-preview'),parsed,{color:settings.color});
      get('reticle-result').textContent=code?'조준점 코드를 적용했습니다.':'기본 조준점을 적용했습니다.';
      break;
    }
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
  if(e.target.id==='preview-agent' && Object.hasOwn(AGENTS,e.target.value)){agentId=e.target.value;show('collection');return}
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
      if (target) match.endFx = { family, theme:currentSkin(match.player)?.banner, x: target.x, y: target.y, z: target.z, at: now };
    }
  }
  if (mode === 'range' && code === 'F2') {
    event.preventDefault();
    match.level = ((match.level ?? 0) + 1) % 3;
  }
  if (code==='KeyF'){if(armedName()==='우주 장벽')command('astral-recall',{...cursor});else command('interact');}
  if (code === 'KeyR') {
    if (distanceSmokes.includes(armedName())) alternateView = !alternateView;
    else command('reload');
  }
  if (code === 'Digit1') command('equip', 'primary');
  if (code === 'Digit2') command('equip', 'secondary');
  if (code === 'Digit3') command('equip', 'melee');
  if(code==='KeyE' && armedName()==='포탑'){wallAngle+=Math.PI;return;}
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
    if(name==='독사의 구덩이' && match.devices.some(d=>d.kind==='toxinPit' && d.owner===p.id && d.end>now)){if(!event.repeat)pitDismissAt=performance.now()+400;return;}
    if(p.agent==='킬조이' && [1,2].includes(i) && match.devices.some(d=>d.end>now && d.owner===p.id && d.name===name)){
      heldRecall={code,i,start:performance.now()};return;
    }
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
      !placingAllowed(name) ||
      dm() ||
      (!p.charges[i] &&
        !(name==='대미 장식' && p.rocketUntil>now) &&
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
        '폭발 팩',
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
  if(event.code==='KeyX')pitDismissAt=0;
  if(heldRecall?.code===event.code){
    if(screen==='game' && performance.now()-heldRecall.start>=380)command('recall-tech',heldRecall.i);
    heldRecall=null;
  }
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
  if(event.button===2 && armedSkill===null && match.player.agent==='하버' && match.devices.some(d=>d.type==='tide' && d.owner===match.player.id && !d.stopped && d.path.length<77)){command('ability',{i:1,stop:true});return;}
  if(event.button===0 && armedSkill===null && match.player.agent==='허시' && match.arrows.some(a=>a.owner===match.player.id && a.type==='suspension')){command('ability',3);return;}
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
    if(name==='포탑' && alt){turnWall=true;return;}
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
        if (!(name==='아마겟돈' && marks.length) && Math.hypot(cursor.x-match.player.x,cursor.z-match.player.z)>tabletRange(name))
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
    else toggleZoom();
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
      else toggleZoom();
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
  if(armedName()==='우주 장벽'){world.astralView?.pointer(event,canvas,unlocked);return;}
  if (tabletNames.includes(armedName())) {
    const rect = get('tablet-map').getBoundingClientRect();
    const centred=isTejoMap(armedName()) || armedName()==='웨이브폼',extent=centred?tabletRange(armedName()):HALF;
    if (unlocked) {
      cursor.x=(centred?match.player.x:0)+((event.clientX-rect.left)/rect.width-.5)*2*extent;
      cursor.z=(centred?match.player.z:0)+((event.clientY-rect.top)/rect.height-.5)*2*extent;
    } else {
      cursor.x += (event.movementX * 2 * extent) / Math.max(1, rect.width);
      cursor.z += (event.movementY * 2 * extent) / Math.max(1, rect.height);
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
      rangeWeapon=weapon;
      if (skin) {
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
    if(pitDismissAt && time>=pitDismissAt){pitDismissAt=0;if(screen==='game')command('close-pit');}
    if (document.hidden && room?.host) {
      requestAnimationFrame(frame);
      return;
    }
    const elapsed=time-previous;
    const dt = Math.max(0, Math.min(0.1, elapsed / 1000));
    previous = time;
    const stepWindow=room?.host && room.room.started && screen!=='loading' ? .5 : .15;
    carry = Math.min(carry + Math.max(0,elapsed/1000),stepWindow);
    if (screen === 'game' && unlocked) {
      look(
        (+keys.has('ArrowRight') - +keys.has('ArrowLeft')) * dt * 1.6,
        (+keys.has('ArrowDown') - +keys.has('ArrowUp')) * dt * 1.1,
      );
    }
    if (world) {
      if (screen === 'game' && rangeAdjust)
        smokeRange = Math.max(2, Math.min(80, smokeRange + rangeAdjust * dt * 23));
      while (carry >= 1 / 60) {
        step(1 / 60);
        carry -= 1 / 60;
      }
      networkFrame(time);
      if(match && screen!=='loading'){
        if(screen==='game')world.frameBudget(time,elapsed);
        if(world.gpuReady()){drawWorld(time);world.submitted()}
      }
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
