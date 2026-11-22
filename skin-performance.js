import { recordedAction } from './recorded-weapon.js';
import { motionAction } from './weapon-motion.js';
import filmed from './finisher-frames.json' with { type: 'json' };
import * as T from 'three';
let library, loading, localFiles;
const voices = new Set(),
  clips = new Map();
let reloadSource,
  audioEpoch = 0;
const path = '/weapon-audio/';
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
export function prepareSkin(s) {
  if (!s) return;
  loading ??= fetch('/weapon-audio/events.json')
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
  for (const a of ['fire', 'reload', 'equip']) {
    const f = recordedAction(s, a, true);
    if (f) prime('/performances/' + f.key + '.ogg');
  }
  if (s.performance) for (const action of ['shot', 'reload']) prime(path + s.id + '-' + action + '.ogg');
  void loading.then(() => {
    for (const ev of ['shot', 'reload']) {
      const cue = library?.bySkin[s.id]?.[ev]?.[0];
      if (cue) prime(url(cue[1]));
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
export function playSkinEvent(s, action, duration, volume) {
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
  const recordings = library?.variants?.[s.id]?.[action];
  const sequence = recordings?.length
    ? [[0, recordings[Math.floor(Math.random() * recordings.length)]]]
    : (library?.bySkin[s.id]?.[action] ?? []);
  if (!film && s.motionOn === false && ['inspect', 'equip', 'reload', 'light', 'heavy'].includes(action))
    return false;
  const events = film
    ? [[0, '/performances/' + film.key + '.ogg']]
    : captured
      ? [[0, '/motion/' + s.id + '-' + action + '.ogg']]
      : recorded
        ? [[0, path + s.id + '-' + action + '.ogg']]
        : sequence.map(([pct, id]) => [pct, url(id)]);
  if (!events.length) return false;
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
    const start = () => {
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
export function weaponAnimation(world) {
  const prop = new T.Group();
  world.tool.add(prop);
  const crystal = block(prop, '#8debff', 0, 0, 0, 0.055, 0.18, 0.055);
  const ring = block(prop, '#ffd270', 0, 0, 0, 0.075, 0.035, 0.075);
  const aura = block(prop, '#f6fbff', 0, 0, 0, 0.025, 0.2, 0.028);
  prop.visible = false;
  const sprite = new T.Sprite(
    new T.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
  );
  sprite.renderOrder = 10;
  world.tool.add(sprite);
  sprite.position.set(0, 0.018, -0.515);
  sprite.scale.set(0.48, 0.48, 1);
  sprite.visible = false;
  let family, texture, skinId;
  return {
    draw(s, reload, inspect, clock, shotAge) {
      if (skinId !== s?.profileKey) {
        skinId = s?.profileKey;
        texture?.dispose();
        texture = null;
        sprite.material.map = null;
        if (s?.performance) {
          const id = s.profileKey;
          new T.TextureLoader().load(path + s.id + '-flash.png', (t) => {
            if (id !== skinId) {
              t.dispose();
              return;
            }
            t.magFilter = T.NearestFilter;
            t.minFilter = T.NearestFilter;
            t.colorSpace = T.SRGBColorSpace;
            t.repeat.set(1 / 3, 1);
            texture = sprite.material.map = t;
            sprite.material.needsUpdate = true;
          });
        }
      }
      sprite.visible = !!texture && shotAge >= 0 && shotAge < 0.072;
      if (sprite.visible) texture.offset.x = Math.min(2, Math.floor(shotAge / 0.024)) / 3;
      family = s?.family ?? s?.performance;
      world.flash.material.color.set(palettes[family] ?? '#ffdb8b');
      world.flash.userData.filmed = sprite.visible;
      world.tool.rotation.set(0, 0, 0);
      prop.visible = false;
      if (inspect > 0) {
        const arc = Math.sin(inspect * Math.PI);
        world.tool.rotation.y = -0.95 * arc;
        world.tool.rotation.z = 0.42 * arc;
        world.tool.position.x -= 0.1 * arc;
      }
      if (reload <= 0 || reload >= 1 || !family) return;
      const arc = Math.sin(reload * Math.PI),
        insert = Math.max(0, Math.min(1, (reload - 0.26) / 0.42));
      world.tool.position.y += 0.09 * arc;
      const prime = family === 'prime',
        dragon = family === 'dragon';
      world.tool.rotation.z = (prime ? -0.68 : dragon ? 0.32 : -0.38) * arc;
      world.tool.rotation.x = (dragon ? 0.48 : -0.35) * arc;
      prop.visible = reload > 0.12 && reload < 0.78;
      prop.position.set(-0.16 * (1 - insert), 0.26 * (1 - insert) + (prime ? 0.06 : -0.1), -0.035);
      prop.rotation.set(0, clock * (family === 'reaver' ? 6 : 2), prime ? 0.38 : 0);
      crystal.material.color.set(palettes[family]);
      aura.material.color.set(dragon ? '#fbd672' : '#edfbff');
      crystal.scale.set(prime ? 0.055 : 0.085, 0.16, prime ? 0.055 : 0.07);
      ring.visible = prime;
      aura.visible = family !== 'reaver';
    },
  };
}
export function finisher(scene, family, point, now) {
  if (!palettes[family]) return null;
  const sequence = filmed[family];
  if (sequence) {
    const texture = new T.TextureLoader().load('/effects/finish-' + family + '.webp');
    texture.colorSpace = T.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = T.LinearFilter;
    texture.repeat.set(1 / 8, 1 / sequence.rows);
    const material = new T.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
      sprite = new T.Sprite(material);
    const height = family === 'reaver' ? 6 : 4.7;
    sprite.position.set(point.x, point.y + height * 0.46, point.z);
    sprite.scale.set(height * sequence.aspect, height, 1);
    scene.add(sprite);
    return {
      update(t) {
        const frame = Math.floor(Math.max(0, t - now) * sequence.fps);
        if (frame >= sequence.frames) {
          sprite.removeFromParent();
          texture.dispose();
          material.dispose();
          return false;
        }
        texture.offset.set((frame % 8) / 8, 1 - (1 + Math.floor(frame / 8)) / sequence.rows);
        return true;
      },
    };
  }
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
      if (age > 3.2) {
        group.removeFromParent();
        group.traverse((o) => o.material?.dispose());
        return false;
      }
      group.scale.setScalar(Math.min(1, age * 6 + 0.05) * Math.min(1, (3.2 - age) * 4));
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
    const source = context.createBufferSource(),
      gain = context.createGain(),
      pan = context.createStereoPanner();
    source.buffer = buffer;
    gain.gain.value = volume * 0.78;
    pan.pan.value = balance;
    source.connect(gain).connect(pan).connect(context.destination);
    if (action === 'reload') reloadSource = source;
    source.onended = () => {
      if (reloadSource === source) reloadSource = null;
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
    };
    source.start();
  });
  return true;
}

export function recordedEffect(id, volume) {
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
  void a.play().catch(() => {});
}
