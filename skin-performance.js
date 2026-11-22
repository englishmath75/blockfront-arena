import {sculptedFinisher,prepareVolumes} from './sculpted-finisher.js';
import { recordedAction } from './recorded-weapon.js';
import { motionAction } from './weapon-motion.js';
import { arenaFinisher } from './arena-finisher.js';
import { finishLighting, prepareFinishLighting } from './finish-lighting.js';
import shots from './shot-matches.json' with { type: 'json' };
import filmed from './finisher-frames.json' with { type: 'json' };
import * as T from 'three';
let library, loading, localFiles;
const voices = new Set(),
  clips = new Map();
let reloadSource,
  audioEpoch = 0;
const path = '/weapon-audio/';
const performanceAudio=take=>'/performances/'+take.key+'.ogg'+(take.key.endsWith('-fire')?'?v=13':'');
function discharge(s) {
  if (s.soundOn && shots[s.id] && s.level>=shots[s.id][0]) return path+s.id+'-discharge.ogg';
}
export const palettes = {
  rogue: '#ee443f',
  champions23: '#f6c145',
  singularity: '#af6aff',
  ...Object.fromEntries(
    Object.entries(filmed)
      .filter(([, v]) => v.color)
      .map(([key, v]) => [key, v.color]),
  ),
  prime: '#88dbff',
  reaver: '#a187f5',
  dragon: '#ff7b2b',
  chaos: '#c88dff',
  ion: '#57deff',
};
export function prepareSkin(s,context) {
  if (!s) return;
  if (s.finishOn && filmed[s.family]) {
    void prepareFinishLighting();void prepareVolumes();
    if (filmed[s.family].audio !== false) prime('/effects/finish-'+s.family+'.ogg');
  }
  if(s.banner==='rogue' && s.soundOn)prime(path+'rogue-draw.ogg');
  const reference=discharge(s);
  if(reference && context) void decodeCue(context,reference);
  loading ??= fetch('/weapon-audio/events.json?v=1.2')
    .then((r) => {
      if (r.ok) return r.json();
    })
    .then((v) => {
      library = v;
      localFiles = new Set(v?.local);
    })
    .catch(() => {
      loading = null;
    });
  for (const a of ['fire', 'reload', 'equip','inspect']) {
    const f = recordedAction(s, a, true);
    if (f) prime(performanceAudio(f));
    else if (motionAction(s,a)) prime('/motion/'+s.id+'-'+a+'.ogg');
  }
  if (s.performance) for (const action of ['shot', 'reload']) prime(path + s.id + '-' + action + '.ogg');
  void loading.then(() => {
    for (const ev of ['shot', 'reload']) {
      const cue = library?.bySkin[s.id]?.[ev]?.[0];
      if (cue && localFiles?.has(cue[1])) prime(url(cue[1]));
    }
    if(context && s.soundOn){
      const action=recordedAction(s,'shot',true);
      const urls=action?[performanceAudio(action)]:reference?[reference]:s.performance?[path+s.id+'-shot.ogg']:
        (library?.variants?.[s.id]?.shot??[]).filter(id=>localFiles?.has(id)).map(url);
      for(const src of urls)decodeCue(context,src);
    }
  });
}
function url(id) {
  if (localFiles?.has(id)) return path + id + '.ogg';
  return 'https://valo.town/assets/v3/weapons/' + library.files[id];
}
function prime(src) {
  if (clips.has(src)) return clips.get(src);
  const a = new Audio();
  a.preload = 'auto';
  a.src = src;
  clips.set(src, a);
  if (clips.size > 48) clips.delete(clips.keys().next().value);
  return a;
}
export function stopAnimationAudio() {
  audioEpoch++;
  if (reloadSource) {
    try {
      reloadSource.stop();
    } catch {}
    reloadSource = null;
  }
  for (const voice of voices)
    if (voice.action !== 'shot' && voice.action !== 'kill') {
      clearTimeout(voice.timer);
      voice.a.pause();
      voices.delete(voice);
    }
}
export function playSkinEvent(s, action, duration, volume, context, gun, balance=0) {
  if (!s) return false;
  const film = recordedAction(s, action, true);
  const captured = !film && motionAction(s, action);
  if (
    !film &&
    (s.soundOn === false ||
      (action === 'inspect' && s.inspectOn === false) ||
      (action === 'kill' && s.killOn === false))
  )
    return false;
  const recorded = s.performance && ['shot', 'reload'].includes(action);
  const shot=action==='shot' && discharge(s);
  const recordings = library?.variants?.[s.id]?.[action];
  const sequence = recordings?.length
    ? [[0, recordings[Math.floor(Math.random() * recordings.length)]]]
    : (library?.bySkin[s.id]?.[action] ?? []);
  const rogueDraw=action==='equip' && s.banner==='rogue' && s.soundOn;
  if (!film && !rogueDraw && s.motionOn === false && ['inspect', 'equip', 'reload', 'light', 'heavy'].includes(action))
    return false;
  const events = rogueDraw ? [[0,path+'rogue-draw.ogg']] : film
    ? [[0,performanceAudio(film)]]
    : shot ? [[0,shot]] : captured
      ? [[0, '/motion/' + s.id + '-' + action + '.ogg']]
      : recorded
        ? [[0, path + s.id + '-' + action + '.ogg']]
        : sequence.filter(([,id])=>localFiles?.has(id)).map(([pct, id]) => [pct, url(id)]);
  if (!events.length) return false;
  if(action==='shot' && context?.state==='running'){
    const then=context.currentTime;
    void decodeCue(context,events[0][1]).then(buffer=>{
      if(context.currentTime-then>.18)return;
      if(buffer) startSample(context,buffer,volume,balance);
      else playBase(context,gun,'shot',volume,balance);
    });
    return true;
  }
  for (const [pct, src] of events) {
    const template = prime(src),
      a = template.cloneNode();
    if ((film || captured) && action === 'reload' && duration > 0)
      a.playbackRate = (film || captured).seconds / duration;
    a.volume = Math.max(0, Math.min(1, volume * 0.78));
    const voice = { a, action };
    voices.add(voice);
    const done = () => voices.delete(voice);
    a.onended = a.onerror = done;
    const startAt=performance.now()+pct*.01*duration*1000;
    const start = () => {
      if (!voices.has(voice)) return;
      if ((film || captured) && (action==='reload' || action==='inspect')) {
        if (a.readyState<2) { a.addEventListener('canplay',start,{once:true}); a.load(); return; }
        const offset=Math.max(0,(performance.now()-startAt)*.001*a.playbackRate);
        if (offset>=a.duration) { done(); return; }
        a.currentTime=offset;
      }
      void a.play().catch(done);
    };
    if (pct > 0) voice.timer = setTimeout(start, pct * 0.01 * duration * 1000);
    else start();
  }
  return true;
}
const crystalGeometry = new T.IcosahedronGeometry(0.59, 1);
function block(group, color, x, y, z, w, h, d) {
  const o = new T.Mesh(crystalGeometry, new T.MeshBasicMaterial({ color }));
  o.position.set(x, y, z);
  o.scale.set(w, h, d);
  group.add(o);
  return o;
}
export function finisher(scene, family, point, now) {
  if (!palettes[family]) return null;
  const sequence = filmed[family];
  const light=sequence && finishLighting(scene,point,family,sequence);
  const native=arenaFinisher(scene,point.theme??family,point,now,sequence?.duration??4,palettes[family],light);
  if(native)return native;
  if(sequence)return sculptedFinisher(scene,family,point.theme,point,now,sequence,palettes[family],light);
  const group = new T.Group(),
    tone = palettes[family];
  group.position.set(point.x, point.y, point.z);
  scene.add(group);
  if (family === 'prime' || family === 'dragon') {
    block(group, tone, 0, 2.5, 0, 1.05, 0.72, 0.88);
    block(group, tone, 0, 2.2, -0.57, 0.58, 0.35, 0.58);
    for (const side of [-1, 1]) {
      block(group, tone, side * 0.4, 3.06, 0.13, 0.23, 0.54, 0.31);
      block(group, '#fff7c9', side * 0.27, 2.55, -0.46, 0.13, 0.1, 0.09);
      block(group, '#fffbe7', side * 0.24, 2, -0.66, 0.09, 0.26, 0.12);
    }
  }
  const rig = new T.Group();
  group.add(rig);
  if (family === 'reaver' || family === 'chaos') {
    block(rig, '#271c30', 0, 0.03, 0, 1.9, 0.06, 1.9);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3,
        x = Math.cos(angle),
        z = Math.sin(angle);
      if (family === 'reaver') {
        const arm = block(rig, '#574664', x * 0.65, 0.6, z * 0.65, 0.18, 1.1, 0.2);
        arm.rotation.z = -x * 0.35;
        arm.rotation.x = z * 0.35;
        block(rig, tone, x * 0.48, 1.2, z * 0.48, 0.24, 0.22, 0.2);
        for (let k = 0; k < 3; k++)
          block(rig, tone, x * 0.46 + (k - 1) * 0.07, 1.38, z * 0.46, 0.044, 0.18, 0.06);
      } else
        for (let k = 0; k < 7; k++) {
          const r = 0.92 - k * 0.075;
          const chain = block(rig, k % 2 ? tone : '#5d566b', x * r, 0.15 + k * 0.18, z * r, 0.13, 0.19, 0.06);
          chain.rotation.y = ((k % 2) * Math.PI) / 2 + angle;
        }
    }
  } else if (family === 'ion') {
    for (let i = 0; i < 32; i++) {
      const az = i * 2.4,
        y = 1 - (2 * (i + 0.5)) / 32,
        r = Math.sqrt(1 - y * y);
      block(rig, tone, Math.cos(az) * r, y, Math.sin(az) * r, 0.3, 0.3, 0.3);
    }
    rig.position.y = 1.15;
  }
  const pieces = [];
  for (let i = 0; i < 24; i++) pieces.push(block(group, tone, 0, 0.6, 0, 0.12, 0.12, 0.12));
  return {
    update(t) {
      const age = t - now;
      if (age > (sequence?.duration ?? 3.2)) {
        light?.dispose();
        group.removeFromParent();
        group.traverse((o) => o.material?.dispose());
        return false;
      }
      light?.update(age);
      group.scale.setScalar(Math.min(1, age * 6 + 0.05) * Math.min(1, ((sequence?.duration ?? 3.2) - age) * 4));
      if (family === 'prime') group.position.y = point.y + Math.max(0, 1 - age * 1.35) * 2;
      if (family === 'dragon') group.position.y = point.y + 1.1;
      if (family === 'reaver' || family === 'chaos')
        rig.scale.y = age < 1.3 ? Math.min(1, age * 2) : Math.max(0.06, 1 - (age - 1.3) * 0.7);
      if (family === 'ion') {
        const radius = age < 0.6 ? age * 1.8 : Math.max(0.04, 1.1 - (age - 0.6) * 0.85);
        rig.scale.setScalar(radius);
        rig.rotation.y = age * 3;
      }
      pieces.forEach((p, i) => {
        const a = i * 2.4;
        if (family === 'dragon') {
          const u = (age * 1.6 + i / 24) % 1,
            r = u * 0.55;
          p.position.set(Math.cos(a) * r, 2.2 - 3.2 * u, Math.sin(a) * r - 0.45);
          p.scale.setScalar(0.14 + u * 0.15);
        } else {
          const r = Math.max(0, age - (family === 'ion' ? 1.75 : 0.75)) * 2;
          p.visible = r > 0;
          p.position.set(Math.cos(a) * r, 0.7 + Math.sin(i) * r + age * 0.4, Math.sin(a) * r);
        }
      });
      return true;
    },
  };
}

const baseGuns = new Set([
  'odin',
  'ares',
  'vandal',
  'warden',
  'bulldog',
  'phantom',
  'judge',
  'bucky',
  'frenzy',
  'classic',
  'bandit',
  'ghost',
  'sheriff',
  'shorty',
  'operator',
  'guardian',
  'outlaw',
  'marshal',
  'spectre',
  'stinger',
]);
const baseBuffers = new Map();
const shotBuffers = new Map();
function decodeCue(context,src){
  if(!shotBuffers.has(src)){
    const task=fetch(src).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer()})
      .then(bytes=>context.decodeAudioData(bytes)).catch(()=>{shotBuffers.delete(src);return null});
    shotBuffers.set(src,task);
    if(shotBuffers.size>32)shotBuffers.delete(shotBuffers.keys().next().value);
  }
  return shotBuffers.get(src);
}
function startSample(context,buffer,volume,balance){
  const source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();
  source.buffer=buffer;gain.gain.value=volume*.78;pan.pan.value=balance;
  source.connect(gain).connect(pan).connect(context.destination);
  source.onended=()=>{if(reloadSource===source)reloadSource=null;source.disconnect();gain.disconnect();pan.disconnect()};
  source.start();return source;
}
export function playHandling(context,action,volume){
  const epoch=audioEpoch;
  void decodeCue(context,path+'handling-'+action+'.ogg').then(buffer=>{
    if(buffer && epoch===audioEpoch && context.state==='running')startSample(context,buffer,volume*.23,0);
  });
}
export function prepareBase(context, gun, action) {
  if (!context || !baseGuns.has(gun) || !['shot', 'reload'].includes(action)) return null;
  const key = gun + '-' + action;
  if (!baseBuffers.has(key))
    baseBuffers.set(
      key,
      fetch('/weapon-audio/base-' + key + '.ogg')
        .then((r) => {
          if (!r.ok) throw Error();
          return r.arrayBuffer();
        })
        .then((data) => context.decodeAudioData(data))
        .catch(() => null),
    );
  return baseBuffers.get(key);
}
export function playBase(context, gun, action, volume, balance) {
  const promise = prepareBase(context, gun, action);
  if (!promise) return false;
  const epoch = audioEpoch;
  void promise.then((buffer) => {
    if (action === 'reload' && epoch !== audioEpoch) return;
    if (!buffer || context.state !== 'running') return;
    const source=startSample(context,buffer,volume,balance);
    if (action === 'reload') reloadSource = source;
  });
  return true;
}

export function recordedEffect(id, volume, elapsed) {
  const bundledFinisher = id.startsWith('finish-') && filmed[id.slice(7)]?.audio === true;
  if (
    !bundledFinisher &&
    ![
      'finish-prime',
      'finish-ion',
      'finish-dragon',
      'finish-reaver',
      'finish-rogue',
      'finish-champions23',
      'finish-singularity',
      'blade-throw',
      'knife-heavy',
      'knife-light',
      'neon',
      'tejo',
      'tejo-pulse',
    ].includes(id)
  )
    return;
  const file = id === 'blade-throw' ? id + '-' + (1 + Math.floor(Math.random() * 3)) : id;
  const a = prime('/effects/' + file + '.ogg').cloneNode();
  a.volume = Math.max(0, Math.min(1, volume * 0.6));
  if (!elapsed) {
    void a.play().catch(() => {});
    return;
  }
  let cancelled=false;
  const start = () => {
    const at=Math.max(0,elapsed());
    if (cancelled || !Number.isFinite(a.duration) || at>=a.duration) return;
    a.currentTime=at;
    void a.play().catch(() => {});
  };
  if (a.readyState>=2) start();
  else { a.addEventListener('canplay',start,{once:true}); a.load(); }
  return () => { cancelled=true; a.removeEventListener('canplay',start); a.pause(); };
}
