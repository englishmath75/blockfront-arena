import { triangleTerrain } from './triangle-terrain.js';
import { terrainFeedback } from './terrain-feedback.js';
import { visionDistance } from './field-effects.js';
import { drawScenery } from './scenery.js';
import { buildTerrain } from './terrain.js';
import { makeMechanisms, geometry, switchPos, cable, inside } from './mechanisms.js';
import * as T from 'three';
import { shieldHit } from './ability-zones.js';
import { character, firstPerson, attachProp } from './actor-models.js';
import { AGENTS } from './rules.js';
import { MAP_NAME, CELL, SIZE, HALF, open, center, cell, isCover, areas, SITES } from './arena.js';

const block = new T.BoxGeometry(1, 1, 1);
const ray = new T.Raycaster();
const box = new T.Box3();
const rayHit = new T.Vector3();
const material = (color) => new T.MeshLambertMaterial({ color });
const solid = (color) => new T.MeshBasicMaterial({ color });
function mesh(mat, x, y, z, w, h, d) {
  const object = new T.Mesh(block, mat);
  object.position.set(x, y, z);
  object.scale.set(w, h, d);
  return object;
}
function pixelTexture(colors) {
  return new T.MeshStandardMaterial({ color: colors[1], roughness: 0.85 });
}
export function createWorld(canvas, data) {
  const scene = new T.Scene();
  const range = MAP_NAME === '사격장';
  scene.background = new T.Color('#9ac6d3');
  scene.fog = new T.Fog('#9ac6d3', 62, 190);
  const camera = new T.PerspectiveCamera(72, 1, 0.025, 230);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const sky = new T.Mesh(
    new T.SphereGeometry(215, 32, 18),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        upper: {
          value: new T.Color(MAP_NAME === '펄' ? '#285678' : MAP_NAME === '선셋' ? '#9780ae' : '#76abc9'),
        },
        lower: { value: new T.Color(MAP_NAME === '선셋' ? '#f1b19c' : '#d8e5e4') },
      },
      vertexShader:
        'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec3 p;uniform vec3 upper,lower;void main(){vec3 d=normalize(p);float u=max(0.,d.y);float cloud=sin(d.x*17.+sin(d.z*19.)*.8)+sin(d.z*13.+d.y*32.);vec3 c=mix(lower,upper,pow(u,.65));c=mix(c,vec3(.95,.93,.89),smoothstep(1.0,1.85,cloud)*smoothstep(.04,.35,u)*.5);gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}',
    }),
  );
  sky.renderOrder = -5;
  scene.add(sky);

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  scene.add(new T.HemisphereLight('#fff5ec', '#afbed2', 2.25));
  const sun = new T.DirectionalLight('#fff1da', 1.55);
  sun.position.set(-24, 38, 15);
  scene.add(sun);
  const terrain = {
    stone: pixelTexture(['#687463', '#8b9880', '#8f9b83', '#819077', '#9ca88d'], true),
    grass: pixelTexture(['#3e5b2e', '#5c793b', '#658744', '#58743a', '#6a8846'], false),
    soil: pixelTexture(['#515237', '#666b47', '#757550', '#606343'], false),
    timber: pixelTexture(['#745637', '#94744b', '#a18151', '#816744'], true),
    cobble: pixelTexture(['#64725d', '#75826e', '#7c8972', '#6b7865', '#829176'], true),
  };
  const tones = {
    어센트: ['#b8987d', '#dbbd98', '#837c72'],
    사격장: ['#a47760', '#d1a77a', '#8b867b'],
    헤이븐: ['#997e6a', '#ba7354', '#a5aa89'],
    바인드: ['#bf9975', '#d8b385', '#b5a18a'],
    스플릿: ['#829194', '#9badae', '#939797'],
    아이스박스: ['#8fadbc', '#d6eaed', '#87a7b8'],
    로터스: ['#9a9c80', '#788b70', '#a5a288'],
    프랙처: ['#9d9885', '#98a084', '#878e85'],
    브리즈: ['#b4a388', '#86a88f', '#cab99d'],
    선셋: ['#b58e83', '#cc9c88', '#98939a'],
    어비스: ['#818eaa', '#9dacc5', '#828ca4'],
    펄: ['#90a7a9', '#b29e90', '#8b9da5'],
    코로드: ['#9e8e77', '#ab815d', '#959080'],
    서밋: ['#9ea9ae', '#b5c4c6', '#929c9f'],
  }[MAP_NAME] ?? ['#aaa190', '#b1b7a4', '#9a998e'];
  function tint(base, masonry) {
    const color = new T.Color(base);
    return pixelTexture(
      [0.72, 0.95, 1, 0.9, 1.07].map((k) => '#' + color.clone().multiplyScalar(k).getHexString()),
      masonry,
    );
  }
  terrain.stone = tint(tones[0], true);
  terrain.grass = tint(tones[1], false);
  terrain.soil = tint(tones[2], false);
  const batches = new Map();
  const coarse = buildTerrain(data?.collision),
    structure = data?.triangles ? triangleTerrain(data.triangles, coarse) : coarse;
  const mechanisms = makeMechanisms(structure);
  const put = (mat, x, y, z, w = CELL, h = CELL, d = CELL) => {
    const list = batches.get(mat) ?? [];
    list.push([x, y, z, w, h, d]);
    batches.set(mat, list);
  };

  const roof = tint('#a66b50', true),
    metal = tint('#667881', true);
  if (data?.visual) drawScenery(scene, data.visual, data.texture);
  else
    for (const b of structure.boxes) {
      const mat =
        b.kind === 'wall'
          ? terrain.stone
          : b.kind === 'roof'
            ? roof
            : b.kind === 'steel'
              ? metal
              : b.kind === 'timber'
                ? terrain.timber
                : b.kind === 'leaf'
                  ? terrain.grass
                  : terrain.soil;
      put(mat, b.x, b.y + b.h / 2, b.z, b.w, b.h, b.d);
    }
  const moving = [];
  for (const m of mechanisms) {
    if (cable(m)) {
      const start = new T.Vector3(m.x, m.y + 1.2, m.z),
        end = new T.Vector3(m.to.x, m.to.y + 1.2, m.to.z),
        dir = end.clone().sub(start);
      const rope = new T.Mesh(new T.CylinderGeometry(0.052, 0.052, dir.length(), 10), material('#efbb48'));
      rope.position.copy(start).lerp(end, 0.5);
      rope.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
      scene.add(rope);
      for (const v of [start, end]) put(metal, v.x, v.y, v.z, 0.36, 0.36, 0.36);
    } else if (m.type === 'portal') {
      const mat = new T.MeshBasicMaterial({
        color: '#729afa',
        transparent: true,
        opacity: 0.55,
        side: T.DoubleSide,
        depthWrite: false,
      });
      const field = new T.Mesh(new T.CircleGeometry(1, 8), mat);
      field.scale.set(m.w * 0.44, m.h * 0.48, 1);
      field.rotation.y = m.theta;
      field.position.set(m.x, m.y + m.h / 2, m.z);
      scene.add(field);
    } else {
      const body = new T.Group(),
        surf = m.type === 'rotor' ? tint('#769b87', true) : metal;
      if (m.type === 'gate' && scene.userData.gate) {
        body.add(scene.userData.gate(m.w, m.h));
      } else {
        body.add(mesh(surf, 0, m.h / 2, 0, m.w, m.h, m.d));
        const bands = solid(m.type === 'rotor' ? '#c3ecac' : '#d6ad68');
        for (const y of [0.35, m.h - 0.35]) body.add(mesh(bands, 0, y, 0, m.w, 0.09, m.d + 0.04));
      }
      scene.add(body);
      const pos = switchPos(m);
      let button;
      if (['drop', 'gate', 'rotor'].includes(m.type)) {
        button = mesh(solid('#68e2d4'), pos.x, pos.y, pos.z, 0.45, 0.5, 0.45);
        scene.add(button);
        put(metal, pos.x, pos.y / 2 + m.y / 2, pos.z, 0.28, pos.y - m.y, 0.28);
      }
      moving.push({ m, body, button });
    }
  }
  function updateMechanisms() {
    for (const { m, body, button } of moving) {
      const b = geometry(m);
      body.visible = !!b;
      if (b) {
        body.position.set(b.x, b.y, b.z);
        body.rotation.y = b.theta;
      }
      if (button) {
        button.visible = !m.broken;
        button.material.color.set(m.health < 90 ? '#ee655a' : m.goal ? '#efbb59' : '#68e2d4');
      }
    }
  }
  updateMechanisms();

  for (const site of SITES) site.y = structure.spawn(site.x, site.z, site.groundY ?? 0).y;
  if (range) {
    const steel = material('#516770'),
      brick = material('#aa7255'),
      paint = solid('#d5b980');
    for (const x of [-19, 19])
      for (let z = -23; z <= 23; z += 6) {
        put(brick, x, 3.2, z, 1.2, 6.4, 1.2);
        put(steel, x, 6.15, z, 1.55, 0.4, 1.55);
        put(steel, x * 0.5, 6.65, z, 19.1, 0.35, 0.45);
      }
    for (let x = -13; x <= 13; x += 3.25) put(paint, x, 0.012, 12, 0.07, 0.02, 4.8);
    for (const z of [12, 3, -7, -17]) put(paint, 0, 0.016, z, 27, 0.02, 0.08);
    for (let x = -12; x <= 12; x += 3) put(terrain.timber, x, 1.5, -22, 2.95, 3, 0.75);
  }
  const dummy = new T.Object3D();
  for (const [mat, list] of batches) {
    const group = new T.InstancedMesh(block, mat, list.length);
    list.forEach(([x, y, z, w, h, d], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      group.setMatrixAt(i, dummy.matrix);
    });
    group.computeBoundingSphere();
    scene.add(group);
  }
  const updateTerrainFeedback = terrainFeedback(scene);
  const dark = material('#263432');
  const strap = material('#344c3d');
  const trim = material('#99b78a');
  const tool = new T.Group();
  tool.add(mesh(dark, 0, 0, -0.075, 0.17, 0.15, 0.42));
  tool.add(mesh(trim, 0, 0.074, -0.08, 0.153, 0.05, 0.36));
  tool.add(mesh(dark, 0, 0.014, -0.35, 0.075, 0.075, 0.17));
  tool.add(mesh(dark, 0, -0.115, -0.09, 0.11, 0.15, 0.1));
  tool.add(mesh(strap, 0, -0.11, 0.075, 0.1, 0.18, 0.11));
  tool.add(mesh(strap, 0, 0.09, -0.21, 0.045, 0.045, 0.045));
  const flash = mesh(solid('#ffda86'), 0, 0.01, -0.46, 0.12, 0.12, 0.18);
  flash.visible = false;
  tool.add(flash);
  camera.add(tool);
  const core = new T.Group();
  core.add(mesh(dark, 0, 0.13, 0, 0.54, 0.26, 0.54));
  core.add(mesh(solid('#ffdf79'), 0, 0.32, 0, 0.33, 0.28, 0.33));
  scene.add(core);
  const first = firstPerson();
  attachProp(core, 'spike', 0.62);
  function avatar(team, agent, target = false) {
    const g = new T.Group(),
      coat = material(target ? '#c98255' : (AGENTS[agent]?.color ?? '#6a8494'));
    const torso = new T.Mesh(new T.CapsuleGeometry(0.22, 0.43, 5, 12), coat),
      head = new T.Mesh(new T.SphereGeometry(0.175, 16, 12), material(target ? '#9aa7af' : '#c9987e'));
    torso.position.y = 0.93;
    head.position.y = 1.58;
    g.add(torso, head);
    const legs = [-0.125, 0.125].map((x) => {
      const o = new T.Mesh(new T.CapsuleGeometry(0.086, 0.46, 3, 10), dark);
      o.position.set(x, 0.34, 0);
      g.add(o);
      return o;
    });
    scene.add(g);
    return { g, legs, animate: target ? null : character(g, agent) };
  }
  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);
  resize();
  const tracerMaterial = new T.LineBasicMaterial({ color: '#ffd996', transparent: true, opacity: 0.75 });
  const effects = new Set();
  const tracerColors = new Map();
  function trace(from, to, now, color, life = 0.065) {
    if (color && !tracerColors.has(color))
      tracerColors.set(color, new T.LineBasicMaterial({ color, transparent: true, opacity: 0.92 }));
    const line = new T.Line(
      new T.BufferGeometry().setFromPoints([from, to]),
      tracerColors.get(color) ?? tracerMaterial,
    );
    scene.add(line);
    effects.add({ object: line, end: now + life });
  }
  const bladeMaterial = new T.MeshBasicMaterial({ color: 0xaaffff });
  function throwBlade(from, to, now) {
    const path = to.clone().sub(from),
      length = path.length();
    if (length < 0.02) return;
    const shape = new T.Shape();
    shape.moveTo(0, 0.25);
    shape.lineTo(0.053, -0.035);
    shape.lineTo(0.014, -0.09);
    shape.lineTo(0.011, -0.18);
    shape.lineTo(-0.011, -0.18);
    shape.lineTo(-0.014, -0.09);
    shape.lineTo(-0.053, -0.035);
    shape.closePath();
    const object = new T.Mesh(
      new T.ExtrudeGeometry(shape, { depth: 0.013, bevelEnabled: false }),
      bladeMaterial,
    );
    object.position.copy(from);
    object.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), path.normalize());
    scene.add(object);
    effects.add({
      object,
      from: from.clone(),
      to,
      end: now + Math.max(0.07, Math.min(0.32, length / 120)),
      start: now,
    });
  }
  function clearEffects(now) {
    for (const fx of effects) {
      if (now < fx.end) {
        if (fx.from)
          fx.object.position.lerpVectors(fx.from, fx.to, Math.max(0, (now - fx.start) / (fx.end - fx.start)));
        continue;
      }
      fx.object.removeFromParent();
      fx.object.geometry.dispose();
      effects.delete(fx);
    }
  }
  function intersects(x, z, y, radius, devices, top = 1.55) {
    if (x < -HALF + radius || x > HALF - radius || z < -HALF + radius || z > HALF - radius) return true;
    if (structure.blocked(x, z, y, radius, top)) return true;
    for (const m of mechanisms) {
      const b = geometry(m);
      if (b && y < b.y + b.h && y + top > b.y && inside(b, x, z, radius)) return true;
    }
    return devices.some(
      (d) =>
        (d.type === 'wall' || d.type === 'meshPanel') &&
        y < (d.y ?? 0) + d.h &&
        Math.abs(x - d.x) < d.w / 2 + radius &&
        Math.abs(z - d.z) < d.d / 2 + radius &&
        y + top > (d.y ?? 0),
    );
  }
  function hitBox(line, x, y, z, w, h, d) {
    box.min.set(x - w / 2, y, z - d / 2);
    box.max.set(x + w / 2, y + h, z + d / 2);
    return line.intersectBox(box, rayHit) ? rayHit.distanceTo(line.origin) : Infinity;
  }
  let clock = 0;
  function mapHit(line, distance, devices, vision = false, result) {
    distance = structure.intersect
      ? structure.intersect(line, distance, result)
      : structure.rayBoxes(line.origin, line.direction, distance, (b) => {
          const t = hitBox(line, b.x, b.y, b.z, b.w, b.h, b.d);
          if (result && t < (result.surfaceDistance ?? distance)) {
            result.surfaceDistance = t;
            const pt = line.at(t, new T.Vector3());
            const faces = [
              [Math.abs(Math.abs(pt.x - b.x) - b.w / 2), Math.sign(pt.x - b.x), 0, 0],
              [Math.abs(Math.abs(pt.y - b.y - b.h / 2) - b.h / 2), 0, Math.sign(pt.y - b.y - b.h / 2), 0],
              [Math.abs(Math.abs(pt.z - b.z) - b.d / 2), 0, 0, Math.sign(pt.z - b.z)],
            ];
            result.normal = faces.sort((a, b) => a[0] - b[0])[0].slice(1);
          }
          return t;
        });
    for (const m of mechanisms) {
      const b = geometry(m);
      if (b) {
        const rot = new T.Matrix4().makeRotationY(-b.theta);
        const local = new T.Ray(
          line.origin
            .clone()
            .sub(new T.Vector3(b.x, b.y, b.z))
            .applyMatrix4(rot),
          line.direction.clone().transformDirection(rot),
        );
        const t = hitBox(local, 0, 0, 0, b.w, b.h, b.d);
        if (t < distance) {
          distance = t;
          if (result) result.mechanism = m.type === 'drop' ? null : m;
        }
      }
      if (m.type === 'drop' && !m.broken) {
        const p = switchPos(m),
          t = hitBox(line, p.x, p.y - 0.25, p.z, 0.45, 0.5, 0.45);
        if (t < distance) {
          distance = t;
          if (result) result.mechanism = m;
        }
      }
    }
    for (const d of devices) {
      if (vision) distance = visionDistance(line, d, clock, distance);
      if (d.type === 'plane' && clock >= (d.start ?? 0) && (vision || d.bulletWall))
        distance = shieldHit(line, d, distance);
      if (d.type === 'wall' || (!vision && result && d.hp > 0)) {
        const t = hitBox(line, d.x, d.y ?? 0, d.z, d.w, d.h, d.d);
        if (t < distance) {
          distance = t;
          if (result) {
            result.mechanism = null;
            result.device = d;
          }
        }
      }
    }
    return distance;
  }
  function cameraRay() {
    camera.updateMatrixWorld();
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    return ray.ray;
  }
  function dispose() {
    first.dispose();
    window.removeEventListener('resize', resize);
    const materials = new Set(),
      geos = new Set();
    scene.traverse((o) => {
      if (o.material) for (const m of [o.material].flat()) materials.add(m);
      if (o.geometry && o.geometry !== block) geos.add(o.geometry);
      if (o.isInstancedMesh || o.isBatchedMesh) o.dispose();
    });
    for (const m of materials) {
      m.map?.dispose();
      m.dispose();
    }
    for (const g of geos) g.dispose();
    for (const mat of tracerColors.values()) mat.dispose();
    tracerMaterial.dispose();
    bladeMaterial.dispose();
    renderer.dispose();
  }
  return {
    structure,
    mechanisms,
    updateMechanisms,
    first,
    dispose,
    scene,
    camera,
    renderer,
    tool,
    trim,
    flash,
    core,
    avatar,
    trace,
    throwBlade,
    clearEffects,
    intersects,
    hitBox,
    mapHit,
    cameraRay,
    updateTerrainFeedback,
    setClock(value) {
      clock = value;
    },
    mesh,
    material,
  };
}
