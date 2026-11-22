import { fitSkinOutline, muzzleAtMinX } from './skin-outline.js';
import { recordedAction, weaponFilm } from './recorded-weapon.js';
import { motionAction, sampleMotion } from './weapon-motion.js';
import { unpack } from './compressed.js';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import timing from './ability-times.json' with { type: 'json' };
import library from './model-index.json' with { type: 'json' };
const korean = [
  '아스트라',
  '브리치',
  '브림스톤',
  '체임버',
  '클로브',
  '사이퍼',
  '데드록',
  '페이드',
  '게코',
  '하버',
  '허시',
  '아이소',
  '제트',
  '케이/오',
  '킬조이',
  '믹스',
  '네온',
  '오멘',
  '피닉스',
  '레이즈',
  '레이나',
  '세이지',
  '스카이',
  '소바',
  '테호',
  '비토',
  '바이퍼',
  '바이스',
  '웨이레이',
  '요루',
];
const english =
  'astra breach brimstone chamber clove cypher deadlock fade gekko harbor hush iso jett kayo killjoy miks neon omen phoenix raze reyna sage skye sova tejo veto viper vyse waylay yoru'.split(
    ' ',
  );
const agents = Object.fromEntries(korean.map((n, i) => [n, english[i]])),
  files = new Map(),
  images = new Map();
const loader = new GLTFLoader(),
  texLoader = new T.TextureLoader();
function texture(id) {
  if (!images.has(id)) {
    const t = texLoader.load(id);
    t.flipY = false;
    t.colorSpace = T.SRGBColorSpace;
    images.set(id, t);
    if (images.size > 80) images.delete(images.keys().next().value);
  }
  return images.get(id);
}
function asset(id) {
  if (files.has(id)) return files.get(id);
  const result = (async () => {
    const r = await fetch('/models/' + id + '.glb.gz');
    if (!r.ok) throw Error(id);
    const data = await unpack(r);
    const g = await loader.parseAsync(data, '/models/');
    const spec = library.models[id];
    if (spec) {
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        for (let m of [o.material].flat()) {
          const src = spec.materials[m.name];
          if (src) {
            m.map = texture('/models/' + src + '.webp');
            m.color.set(0xffffff);
            m.needsUpdate = true;
          }
        }
        o.frustumCulled = false;
      });
      for (const c of spec.constraints ?? []) {
        const src = g.scene.getObjectByName(c.SourceObject),
          dst = g.scene.getObjectByName(c.TargetObject)?.getObjectByName(c.Bone);
        if (!src || !dst) continue;
        dst.add(src);
        src.position.set(c.Offset.X, c.Offset.Y, c.Offset.Z);
        src.rotation.set(...[c.Rotation.X, c.Rotation.Y, c.Rotation.Z].map(T.MathUtils.degToRad));
        if (c.Scale) src.scale.set(c.Scale.X, c.Scale.Y, c.Scale.Z);
      }
    }
    return g;
  })().catch((e) => {
    files.delete(id);
    throw e;
  });
  files.set(id, result);
  if (files.size > 24) files.delete(files.keys().next().value);
  return result;
}
export function attachProp(parent, slug, size) {
  if (!library.models[slug]) return;
  void asset(slug)
    .then((g) => {
      if (!parent.parent) return;
      const model = cloneRig(g.scene),
        b = new T.Box3().setFromObject(model, true),
        s = b.getSize(new T.Vector3()),
        k = size / Math.max(s.x, s.y, s.z, 0.001);
      model.scale.multiplyScalar(k);
      model.position.sub(b.getCenter(new T.Vector3()).multiplyScalar(k));
      const pivot = new T.Group();
      pivot.add(model);
      parent.add(pivot);
      parent.userData.prop = pivot;
      if (parent.isMesh) parent.material.visible = false;
    })
    .catch(() => {});
}
export function character(parent, name) {
  const ref = agents[name];
  let mixer,
    body,
    left,
    right,
    animation,
    grip,
    held,
    selected,
    disposeHeld,
    outlined = false;
  const parts = [];
  if (ref)
    void asset(ref)
      .then((g) => {
        if (!parent.parent) return;
        body = cloneRig(g.scene);
        body.traverse((o) => {
          if (!o.isMesh) return;
          const originals = [o.material].flat(),
            glow = originals.map((m) => {
              const copy = m.clone();
              copy.depthTest = false;
              copy.depthWrite = false;
              if (copy.emissive) copy.emissive.set(0xe85d35);
              return copy;
            });
          parts.push({ mesh: o, original: o.material, glow: Array.isArray(o.material) ? glow : glow[0] });
        });
        mixer = new T.AnimationMixer(body);
        const clip =
          g.animations.find((a) => /idle_loop|idlepose/i.test(a.name)) ??
          g.animations.find((a) => a.name !== 'Idle');
        if (clip) {
          animation = mixer.clipAction(clip);
          animation.play();
          mixer.update(0.001);
        }
        const b = new T.Box3().setFromObject(body, true),
          size = b.getSize(new T.Vector3()),
          k = 1.76 / Math.max(0.5, size.y),
          ctr = b.getCenter(new T.Vector3());
        body.scale.multiplyScalar(k);
        body.position.set(ctr.x * k, -b.min.y * k, ctr.z * k);
        body.rotation.y = Math.PI;
        parent.clear();
        parent.add(body);
        grip = body.getObjectByName('R_WeaponPoint') ?? body.getObjectByName('R_Hand');
        left = body.getObjectByName('L_Thigh');
        right = body.getObjectByName('R_Thigh');
      })
      .catch(() => {});
  const animate = (time, stride, revealed = false, weaponKey, skin, attack) => {
    const stamp = (weaponKey ?? '') + '/' + (skin?.profileKey ?? '');
    if (mixer) {
      if (grip && weaponKey && selected !== stamp) {
        selected = stamp;
        disposeHeld?.();
        disposeHeld = null;
        held?.removeFromParent();
        held = null;
        if (library.models[weaponKey])
          void asset(weaponKey)
            .then(async (g) => {
              if (selected !== stamp || !parent.parent) return;
              const candidate = cloneRig(g.scene);
              const release = skin ? await applyAppearance(candidate, skin) : null;
              if (selected !== stamp || !parent.parent) {
                release?.();
                return;
              }
              held = candidate;
              disposeHeld = release;
              held.rotation.y = Math.PI / 2;
              grip.add(held);
            })
            .catch(() => {});
      }
      if (revealed !== outlined) {
        outlined = revealed;
        for (const { mesh, original, glow } of parts) {
          mesh.material = revealed ? glow : original;
          mesh.renderOrder = revealed ? 12 : 0;
        }
      }
      mixer.setTime(time);
      if (held && attack?.weapon === 'melee') {
        const t = Math.max(0, Math.min(1, (time - attack.at) / (attack.alt ? 0.62 : 0.44)));
        held.rotation.z = (attack.alt ? 0.32 : 1.25) * Math.sin(t * Math.PI) * (attack.combo % 2 ? 1 : -1);
        held.rotation.x = attack.alt ? -0.65 * Math.sin(t * Math.PI) : 0;
      }
      if (left && right && stride) {
        left.rotation.x += Math.sin(time * 11) * stride * 0.3;
        right.rotation.x -= Math.sin(time * 11) * stride * 0.3;
      }
    }
  };
  animate.dispose = () => {
    selected = null;
    disposeHeld?.();
    disposeHeld = null;
    held?.removeFromParent();
    mixer?.stopAllAction();
    for (const row of parts) for (const glow of [row.glow].flat()) glow.dispose();
  };
  return animate;
}
const abilityWeapons = { blades: 'blade-storm', headhunter: 'headhunter', tour: 'tour-de-force' };
export const modelKey = (gun, skin) => library.skins[skin?.id] ?? abilityWeapons[gun] ?? gun;
export const inspectLength = (gun, skin) =>
  recordedAction(skin, 'inspect')?.seconds ??
  motionAction(skin, 'inspect')?.seconds ??
  library.models[skin?.motionOn === false ? gun : modelKey(gun, skin)]?.actions?.inspect?.seconds ??
  2.6;
async function applyAppearance(root, skin) {
  if (!library.skins[skin.id]) {
    try {
      return await fitSkinOutline(root, skin.image);
    } catch {
      return skinWrap(root, skin.image);
    }
  }
  if (skin.variant) return skinWrap(root, skin.image);
}
function skinWrap(root, image) {
  const owned = [];
  const map = texture(image);
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), box = new T.Box3(), p = new T.Vector3();
  const forward = muzzleAtMinX(root);
  root.traverse(o => {
    if (!o.isMesh || /bullet|reddot|shell|extra/i.test(o.name)) return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++)
      box.expandByPoint(p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld).applyMatrix4(inv));
  });
  const size = box.getSize(new T.Vector3());
  root.traverse((o) => {
    if (!o.isMesh || /bullet|reddot|shell|extra/i.test(o.name)) return;
    const g = o.geometry.clone(),
      pos = g.getAttribute('position'),
      uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      const x = (p.x-box.min.x)/Math.max(.001,size.x);
      uv[2 * i] = T.MathUtils.clamp(forward ? x : 1-x, 0.01, 0.99);
      uv[2 * i + 1] = T.MathUtils.clamp(1 - (p.y - box.min.y) / Math.max(0.01, size.y), 0.04, 0.96);
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    o.geometry = g;
    const mat = o.material.clone();
    mat.map = map;
    mat.color.set(0xffffff);
    mat.transparent = false;
    mat.alphaTest = 0;
    mat.needsUpdate = true;
    o.material = mat;
    owned.push([g, mat]);
  });
  return () => {
    for (const [g, m] of owned) {
      g.dispose();
      m.dispose();
    }
  };
}
const utilityItems = {
  '잠입 드론': 'stealth-drone',
  '올빼미 드론': 'owl-drone',
  '정찰용 화살': 'recon-bolt',
  '충격 화살': 'shock-dart',
  '사냥꾼의 분노': 'hunters-fury',
  '칼날 폭풍': 'blade-storm',
  '폭발 봇': 'boom-bot',
  페인트탄: 'paintshell',
  '폭발 팩': 'blast-pack',
  '대미 장식': 'showstopper',
  소이탄: 'incendiary',
  '자극제 신호기': 'stim-beacon',
  헤드헌터: 'headhunter',
  역작: 'tour-de-force',
  랑데부: 'rendezvous',
  트레이드마크: 'trademark',
  중력그물: 'gravnet',
  '음향 센서': 'sonic-sensor',
  스파이캠: 'spycam',
  함정: 'trapwire',
  '사이버 감옥': 'cyber-cage',
  나노스웜: 'nanoswarm',
  봉쇄: 'lockdown',
  알람봇: 'alarmbot',
  포탑: 'turret',
  지원봇: 'baby-wingman',
  기절봇: 'baby-dizzy',
  요동봇: 'baby-thrash',
  장벽망: 'barrier-mesh',
  소멸: 'annihilation',
  '아크 장미': 'arc-rose',
  '면도날 덩굴': 'razorvine',
  '신경 절도': 'neural-theft',
  '차원 표류': 'dimensional-drift',

  '폭파봇 지옥': 'mosh-pit',
  '제로/포인트': 'zeropoint',
  '플래시/드라이브': 'flashdrive',
  '뱀 이빨': 'snake-bite',
  '독성 연기': 'poison-cloud',
  '인도하는 빛': 'guiding-light-trinket',
  정찰자: 'trailblazer-trinket',
};
function magicOrb(color) {
  const g = new T.Group(),
    mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.86 });
  g.add(new T.Mesh(new T.IcosahedronGeometry(0.065, 3), mat));
  for (let i = 0; i < 2; i++) {
    const ring = new T.Mesh(
      new T.TorusGeometry(0.079 + i * 0.013, 0.0025, 6, 36),
      new T.MeshBasicMaterial({ color: 0xe5fcff }),
    );
    ring.rotation.set(0.4 + i, 1 + i, 0.2);
    g.add(ring);
  }
  return g;
}
export function firstPerson() {
  const film = weaponFilm();
  const scene = new T.Scene(),
    cam = new T.PerspectiveCamera(48, 1, 0.007, 12);
  scene.add(new T.HemisphereLight(0xfff5ed, 0x879ab6, 2.5));
  const sun = new T.DirectionalLight(0xffedda, 2);
  sun.position.set(1, 3, 2);
  scene.add(sun);
  let id = '',
    state,
    clock = 0,
    ready = false;
  function unload() {
    if (state) {
      scene.remove(state.rig);
      state.armMixer.stopAllAction();
      state.gunMixer.stopAllAction();
      state.disposeSkin?.();
    }
    state = null;
    ready = false;
  }
  async function equip(agent, gun, skin, stamp, skill) {
    unload();
    const arm = agents[agent] + '-fp',
      item = utilityItems[skill] ?? abilityWeapons[gun],
      native = library.models[arm]?.gestures?.[item],
      model = skill ? (item && library.models[item] ? item : 'paintshell') : modelKey(gun, skin),
      spec = library.models[model];
    if (!spec) return;
    const fallback = library.models[gun]?.actions ?? library.models.vandal.actions,
      poseKey = ['recon-bolt', 'shock-dart', 'hunters-fury'].includes(item) ? 'recon-bolt' : 'paintshell',
      donor = poseKey === 'recon-bolt' ? 'sova-fp' : 'raze-fp',
      gesture = native?.idle ? native : library.models[donor]?.gestures?.[poseKey];
    const actions =
      (skill || ['blades', 'tour', 'headhunter'].includes(gun)) && gesture?.idle
        ? gesture
        : skin?.motionOn === false
          ? fallback
          : spec.actions?.idle
            ? spec.actions
            : fallback;
    if (!actions?.idle) return;
    const sources = [
      ...new Set(
        Object.values(actions)
          .flatMap((v) => [v.armFile, v.gunFile])
          .filter(Boolean),
      ),
    ];
    const reference = actions === gesture && !native?.idle ? donor : arm;
    const [a, g, gestureRig, ...externals] = await Promise.all([
      asset(arm),
      asset(['shock-dart', 'recon-bolt'].includes(item) && skill ? 'hunters-fury' : model),
      asset(reference),
      ...sources.map(asset),
    ]);
    if (id !== stamp) return;
    const rig = cloneRig(a.scene),
      weapon =
        skill && !item
          ? magicOrb(skill === '어둠의 장막' ? '#9f76ee' : skill === '추월 차선' ? '#6cf5ff' : '#70dcca')
          : cloneRig(g.scene);
    const disposeSkin = !skill && skin ? await applyAppearance(weapon, skin) : null;
    if (id !== stamp) {
      disposeSkin?.();
      return;
    }
    const socket = rig.getObjectByName(spec.fp?.Bone ?? 'R_WeaponMaster');
    if (!socket) return;
    socket.add(weapon);
    const rot = spec.fp?.Rotation ?? { X: 0, Y: 90, Z: 0 };
    weapon.rotation.set(...[rot.X, rot.Y, rot.Z].map(T.MathUtils.degToRad));
    const gunMixer = new T.AnimationMixer(weapon),
      armMixer = new T.AnimationMixer(rig);
    const banks = Object.fromEntries(sources.map((u, i) => [u, externals[i].animations]));
    const poses = {};
    for (const [name, v] of Object.entries(actions)) {
      const h = (banks[v.armFile] ?? gestureRig.animations).find((c) => c.name === v.arms),
        w = (banks[v.gunFile] ?? g.animations).find((c) => c.name === v.weapon);
      if (h)
        poses[name] = {
          hands: armMixer.clipAction(h),
          gun: w ? gunMixer.clipAction(w) : null,
          duration: h.duration,
        };
    }
    if (!poses.idle) return;
    scene.add(rig);
    const eye = rig.getObjectByName('Camera'),
      muzzle = weapon.getObjectByName('MuzzlePoint') ?? weapon.getObjectByName('Muzzle');
    const spark = new T.Sprite(
      new T.SpriteMaterial({
        color: 0xffd27a,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    if (skin?.performance) {
      spark.material.map = texture('/weapon-audio/' + skin.id + '-flash.png');
      spark.material.map = spark.material.map.clone();
      spark.material.map.repeat.x = 1 / 3;
      spark.material.color.set(0xffffff);
    } else spark.material.map = glow();
    spark.scale.set(0.14, 0.14, 1);
    spark.visible = false;
    muzzle?.add(spark);
    const knives =
      gun === 'blades'
        ? Array.from({ length: 5 }, (_, i) => weapon.getObjectByName('Knife' + (i + 1)))
        : null;
    state = { rig, eye, spark, knives, disposeSkin, armMixer, gunMixer, poses, name: '', equip: clock };
    ready = true;
  }
  function pose(tag, ratio) {
    const next = state.poses[tag] ?? state.poses.idle;
    if (state.pose !== next) {
      state.armMixer.stopAllAction();
      state.gunMixer.stopAllAction();
      for (const a of [next.hands, next.gun])
        if (a) {
          a.reset().play();
          a.paused = true;
        }
      state.pose = next;
    }
    for (const a of [next.hands, next.gun])
      if (a) a.time = Math.min(a.getClip().duration * 0.999, Math.max(0, ratio) * a.getClip().duration);
    state.armMixer.update(0);
    state.gunMixer.update(0);
  }
  return {
    update(p, gun, skin, now, enabled, reloadSeconds, skill = '') {
      clock = now;
      const stamp = [p.agent, gun, skin?.profileKey, skill].join('/');
      if (id !== stamp) {
        id = stamp;
        this.loading = equip(p.agent, gun, skin, stamp, skill).catch((e) =>
          console.warn('1인칭 모델', e.message),
        );
      }
      if (film.draw(skin, p, now, enabled && !skill, reloadSeconds)) {
        this.visible = false;
        return true;
      }
      this.visible = !!(ready && enabled);
      if (!this.visible) return false;
      const age = now - p.shot,
        inspection = inspectLength(gun, skin),
        idle = Math.max(0.1, state.poses.idle.duration),
        equipSeconds = Math.max(
          0.1,
          (skill ? timing[skill]?.['equip time'] : null) ?? state.poses.equip?.duration ?? 0.65,
        ),
        fireSeconds = Math.max(0.06, state.poses.fire?.duration ?? 0.26);
      const strike = p.strike,
        bladeAttack = !skill && ['melee', 'blades'].includes(gun) && strike?.weapon === gun;
      const attackName = strike?.alt ? 'alt attack' : 'attack ' + (strike?.combo ?? 1),
        attackPose = state.poses[attackName] ? attackName : state.poses['attack 1'] ? 'attack 1' : 'fire';
      let tag = 'idle',
        ratio = (now % idle) / idle;
      if (skill) {
        const cast = p.lastCast;
        const gesture =
          cast?.name === skill &&
          cast.end > now &&
          [cast.alt && 'short throw', 'cast', 'throw', 'fire'].find((name) => state.poses[name]);
        if (gesture) {
          tag = gesture;
          ratio = (now - cast.at) / Math.max(0.05, cast.end - cast.at);
        } else if (now - state.equip < equipSeconds && state.poses.equip) {
          tag = 'equip';
          ratio = (now - state.equip) / equipSeconds;
        }
      } else if (p.reloading > now) {
        tag = 'reload';
        ratio = 1 - (p.reloading - now) / reloadSeconds;
      } else if (p.inspectUntil > now) {
        tag = 'inspect';
        ratio = 1 - (p.inspectUntil - now) / inspection;
      } else if (bladeAttack && age >= 0 && age < (state.poses[attackPose]?.duration ?? 0.6)) {
        tag = attackPose;
        ratio = age / (state.poses[attackPose]?.duration ?? 0.6);
      } else if (!['blades', 'melee'].includes(gun) && age >= 0 && age < fireSeconds) {
        tag = 'fire';
        ratio = age / fireSeconds;
      } else if (now - state.equip < equipSeconds) {
        tag = 'equip';
        ratio = (now - state.equip) / equipSeconds;
      }
      pose(tag, T.MathUtils.clamp(ratio, 0, 1));
      if (state.knives) {
        const mag = p.kit.special?.mag ?? 0;
        state.knives.forEach((knife, i) => {
          if (knife) knife.visible = i >= 5 - mag;
        });
      }
      state.rig.updateMatrixWorld(true);
      if (state.eye) state.eye.getWorldPosition(cam.position);
      else cam.position.set(0, 1.5, 0);
      cam.lookAt(cam.position.x + 1, cam.position.y, cam.position.z);
      const sample = !skill && sampleMotion(motionAction(skin, tag), ratio);
      if (sample) {
        // The capture measures the foreground relative to the playfield. Move the first-person
        // camera only; movement, crosshair, and hit envelopes remain in world coordinates.
        cam.translateX(-sample[0] * 0.38);
        cam.translateY(sample[1] * 0.22);
        cam.rotateZ(sample[2] * 0.55);
      }
      cam.fov = p.ads ? 37 : 48;
      state.spark.visible = !skill && !['melee', 'blades'].includes(gun) && age >= 0 && age < 0.072;
      if (skin?.performance && state.spark.material.map)
        state.spark.material.map.offset.x = Math.min(2, Math.floor(age / 0.024)) / 3;
      return true;
    },
    render(renderer, aspect) {
      if (!this.visible) return;
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, cam);
      renderer.autoClear = true;
    },
    dispose() {
      id = '';
      film.hide();
      unload();
    },
    scene,
    cam,
  };
}
let lightMap;
function glow() {
  if (lightMap) return lightMap;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d'),
    g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'white');
  g.addColorStop(0.2, '#fff2bb');
  g.addColorStop(0.5, '#ffa94d99');
  g.addColorStop(1, '#ff990000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return (lightMap = new T.CanvasTexture(c));
}
