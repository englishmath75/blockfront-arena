import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { arenaFinisher } from './arena-finisher.js';
import { triangleTerrain } from './triangle-terrain.js';
import { lanePaths, visionDistance } from './field-effects.js';
import * as T from 'three';
import { MAPS, areas, setArena, sidePosition, siteAt, SITES, CELL, SIZE } from './arena.js';
import { buildTerrain } from './terrain.js';
import {
  makeMechanisms,
  tickMechanisms,
  useMechanism,
  geometry,
  damageMechanism,
  switchPos,
  rideStep,
} from './mechanisms.js';
import { launch, flight } from './utility.js';

test('muzzle direction is measured in weapon space after socket rotation',()=>{
  const grip=new T.Group(),gun=new T.Group(),tip=new T.Bone(),trigger=new T.Bone();
  tip.name='Muzzle';trigger.name='Trigger';
  grip.rotation.y=1.97;gun.rotation.y=-.81;grip.add(gun);gun.add(tip,trigger);
  tip.position.x=-.8;trigger.position.x=-.09;
  assert.equal(muzzleAtMinX(gun),true);
  tip.position.x=.8;assert.equal(muzzleAtMinX(gun),false);
});
test('multipart finishers follow the match clock and release all scene objects',()=>{
  for(const theme of ['singularityep9','champions2023','rogue','araxys','neptune']){
    const scene=new T.Scene(),effect=arenaFinisher(scene,theme,{x:5,y:2,z:-4},10,4,'#a987ff');
    assert.equal(effect.update(12.8),true);assert.equal(scene.children.length,1);
    assert.deepEqual(scene.children[0].position.toArray(),[5,2,-4]);
    assert.equal(effect.update(Infinity),false);assert.equal(scene.children.length,0);
  }
});
import { muzzleAtMinX } from './skin-outline.js';
import { iceRadius, onIce } from './terrain-feedback.js';
import { recordedAction } from './recorded-weapon.js';
import handActions from './hand-actions.json' with { type: 'json' };
const asset = (path) => fs.readFileSync(new URL('./public/' + path, import.meta.url));

test('the Vandal skin follows the actual muzzle and trigger after rotating the view model', () => {
  const file = gunzipSync(asset('models/vandal.glb.gz'));
  const data = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)));
  const root = new T.Group();
  const nodes = data.nodes.map(node => {
    const object = new T.Object3D();
    object.name = node.name;
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    if (node.matrix) new T.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
    return object;
  });
  data.nodes.forEach((node, i) => node.children?.forEach(child => nodes[i].add(nodes[child])));
  for (const id of data.scenes[data.scene ?? 0].nodes) root.add(nodes[id]);
  root.rotation.y = Math.PI;
  root.updateMatrixWorld(true);
  assert(root.getObjectByName('Trigger'));
  assert.equal(muzzleAtMinX(root), true);
});

test('ice reaches nearby players as it expands and does not slow the floor above', () => {
  const zone = {x:4,y:2,z:3,w:10,born:8,end:15};
  const player = {x:7,y:2,z:3};
  assert.equal(iceRadius(zone,8),0);
  assert.equal(onIce(zone,player,8.2),false);
  assert.equal(onIce(zone,player,8.5),true);
  assert.equal(onIce(zone,{...player,y:5},10),false);
  assert.equal(onIce(zone,player,15),false);
});

test('each recorded hand gesture resolves its exact sheets and sound for the equipped appearance', () => {
  for (const [appearance, profile] of Object.entries(handActions)) {
    for (const [name, action] of Object.entries(profile.actions)) {
      const skin = { id: appearance, level: profile.level };
      assert.equal(recordedAction(skin, name), action);
      assert.equal(recordedAction({...skin,id:'other',variant:appearance}, name, true), action);
      assert.equal(recordedAction({...skin,id:'other',variant:'unmatched'},name),undefined);
      for (let i=0; i<Math.ceil(action.n/action.capacity); i++) {
        assert.equal(asset('performances/'+action.key+'-'+i+'.webp').toString('ascii',8,12),'WEBP');
      }
      assert.equal(asset('performances/'+action.key+'.ogg').toString('ascii',0,4),'OggS');
    }
  }
});
function layout(name) {
  const map = MAPS.find((m) => m.name === name);
  setArena(name);
  const b = asset('terrain/' + map.slug + '.vxb');
  const exact = gunzipSync(asset('terrain/' + map.slug + '.tri.gz'));
  return triangleTerrain(
    exact.buffer.slice(exact.byteOffset, exact.byteOffset + exact.byteLength),
    buildTerrain(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)),
  );
}
test('all 13 textured scenes load, plant outlines match raster edges and both squads spawn on triangle surfaces', () => {
  for (const map of MAPS) {
    const level = layout(map.name);
    const bytes = gunzipSync(asset('terrain/' + map.slug + '.scene.gz'));
    const scene = JSON.parse(bytes.subarray(4, 4 + bytes.readUInt32LE()).toString());
    assert(scene.meshes.length > 30 && scene.instances.length > 100, map.name);
    assert.equal(
      asset('terrain/' + map.slug + '.webp')
        .subarray(8, 12)
        .toString(),
      'WEBP',
    );
    for (const site of SITES) {
      assert.equal(siteAt(site.x, site.z)?.id, site.id);
      const [iz, row] = Object.entries(site.mask.rows).find(([, r]) => r[1] > r[0] + 4),
        px = (ix) => ((ix + 0.5) / site.mask.w - 0.5) * CELL * SIZE,
        z = ((+iz + 0.5) / site.mask.h - 0.5) * CELL * SIZE;
      assert.equal(siteAt(px(row[0]), z)?.id, site.id);
      assert.notEqual(siteAt(px(row[0] - 1), z)?.id, site.id);
    }
    for (const side of [false, true])
      for (let slot = 0; slot < 5; slot++) {
        const [x, z] = sidePosition(side, slot),
          hint = areas.find(
            (n) => n.name === '시작 지점' && n.sector === (side ? '공격팀 진영' : '수비팀 진영'),
          );
        const p = level.spawn(x, z, hint.groundY);
        assert(Math.abs(level.support(p.x, p.z, p.y + 0.03) - p.y) < 0.02, map.name);
        assert.equal(level.blocked(p.x, p.z, p.y, 0.28, 1.65), false, map.name);
      }
  }
});
test('Ascent rafters and Icebox tube have distinct support surfaces at the same horizontal point', () => {
  for (const [name, node] of [
    ['어센트', 'A 서까래'],
    ['아이스박스', 'B 튜브'],
  ]) {
    const level = layout(name),
      p = level.landings.get(node),
      lower = level.support(p.x, p.z, p.y - 1.8);
    assert(Number.isFinite(lower) && p.y - lower > 2);
    assert(level.ceiling(p.x, p.z, lower + 0.4, p.y + 0.05) <= p.y);
    assert(level.intersect(new T.Ray(new T.Vector3(p.x, p.y + 0.5, p.z), new T.Vector3(0, -1, 0)), 1) < 0.6);
  }
});
test('map switches, triggered barriers, one-way portals and cross-map rides use distinct rules', () => {
  const a = makeMechanisms(layout('어센트'))[0],
    s = switchPos(a);
  assert(useMechanism([a], { x: s.x, y: s.y - 1.1, z: s.z }));
  tickMechanisms([a], [], 1, 1, () => {});
  assert.equal(geometry(a).y, a.y);
  damageMechanism(a, 499);
  assert(geometry(a));
  damageMechanism(a, 1);
  assert.equal(geometry(a), null);
  const summit = makeMechanisms(layout('서밋')).filter((v) => v.type === 'drop');
  assert.equal(summit.length, 3);
  damageMechanism(summit[0], 125);
  let crushed = false;
  tickMechanisms(summit, [{ ...summit[0] }], 2, 2, () => (crushed = true));
  assert(crushed);
  const bind = makeMechanisms(layout('바인드')),
    portal = bind.find((v) => v.type === 'portal'),
    p = { x: portal.x, y: portal.y, z: portal.z };
  tickMechanisms(bind, [p], 0.01, 1, () => {});
  assert.equal(p.x, portal.to.x);
  tickMechanisms(bind, [p], 0.01, 2, () => {});
  assert.equal(p.x, portal.to.x);
  const f = makeMechanisms(layout('프랙처')),
    wire = f.find((m) => m.type === 'cross'),
    r = { x: wire.x, y: wire.y, z: wire.z };
  assert(useMechanism(f, r));
  assert(rideStep(f, r, new Set(['Space']), 0.1));
  assert.equal(r.ride, wire.id);
  for (let i = 0; i < 1000 && r.ride != null; i++) rideStep(f, r, new Set(), 1 / 60);
  assert.equal(r.x, wire.to.x);
});
test('bow draw affects velocity and ricochet consumes exactly one selected bounce', () => {
  const p = { x: 0, y: 0, z: 0, height: 1.55, yaw: 0, pitch: 0, id: 'sova' },
    make = (charge) => launch('충격 화살', p, { charge, bounces: 2 }, 0, 1);
  const a = make(1);
  assert(Math.abs(a.vz) > Math.abs(make(0).vz));
  const wall = {
    mapHit(ray, distance, devices, vision, hit) {
      hit.normal = [0, 0, 1];
      return distance * 0.5;
    },
  };
  assert.equal(flight(a, 0.02, 0.02, wall, [], p), false);
  assert.equal(a.bounces, 1);
  assert(a.vz > 0);
});
test('local sound clips and filmed muzzle flashes resolve for each referenced skin', () => {
  const baseShots = fs
    .readdirSync(new URL('./public/weapon-audio/', import.meta.url))
    .filter((name) => name.startsWith('base-') && name.endsWith('-shot.ogg'));
  const skins = JSON.parse(fs.readFileSync(new URL('./skins.json', import.meta.url)));
  assert.deepEqual(baseShots.sort(),Object.keys(skins).filter(gun=>gun!=='melee').map(gun=>'base-'+gun+'-shot.ogg').sort());
  for (const name of baseShots)
    for (const action of ['shot', 'reload'])
      assert.equal(
        asset('weapon-audio/' + name.replace('-shot.ogg', '-' + action + '.ogg'))
          .subarray(0, 4)
          .toString(),
        'OggS',
      );
  const lib = JSON.parse(asset('weapon-audio/events.json'));
  for (const key of lib.local)
    assert.equal(
      asset('weapon-audio/' + key + '.ogg')
        .subarray(0, 4)
        .toString(),
      'OggS',
    );
  for (const s of Object.values(skins)
    .flat()
    .filter((s) => s.performance)) {
    assert.equal(
      asset('weapon-audio/' + s.id + '-shot.ogg')
        .subarray(0, 4)
        .toString(),
      'OggS',
    );
    assert.equal(
      asset('weapon-audio/' + s.id + '-reload.ogg')
        .subarray(0, 4)
        .toString(),
      'OggS',
    );
    assert.equal(asset('weapon-audio/' + s.id + '-flash.png').readUInt32BE(16), 144);
  }
});

test('Fast Lane leaves an open corridor and Dark Cover blocks sight only at its shell', () => {
  const w = { mapHit: () => 46.5, structure: { support: () => 0 } },
    p = { x: 0, y: 0, z: 0, height: 1.55, yaw: 0, pitch: 0 };
  const paths = lanePaths(w, p, []),
    ray = (x, z, dx, dz) => new T.Ray(new T.Vector3(x, 1, z), new T.Vector3(dx, 0, dz));
  assert.equal(paths.length, 2);
  for (const path of paths) {
    const lane = { type: 'lane', born: 0, end: 6, h: 3.5, path };
    assert.equal(visionDistance(ray(0, 0, 0, -1), lane, 1, 40), 40);
    assert.equal(visionDistance(ray(0, -8, Math.sign(path[0][0]), 0), lane, 1, 10), 1.75);
  }
  const smoke = { type: 'darkCover', born: 0, end: 15, x: 0, y: -3.1, z: 0, w: 8.2, d: 8.2, h: 8.2 };
  assert(Math.abs(visionDistance(ray(0, 0, 1, 0), smoke, 1, 18) - 4.1) < 0.001);
  assert.equal(visionDistance(ray(0, 0, 1, 0), smoke, 1, 2), 2);
});
test('first-person rigs, character bodies, native firearm animations and their texture banks resolve on disk', () => {
  const lib = JSON.parse(fs.readFileSync(new URL('./model-index.json', import.meta.url))),
    keys = Object.keys(lib.models),
    arms = keys.filter((k) => k.endsWith('-fp'));
  assert.equal(arms.length, 30);
  assert(Object.keys(lib.skins).length >= 80);
  const files = new Set();
  for (const k of arms) assert(lib.models[k.slice(0, -3)]);
  for (const [k, v] of Object.entries(lib.models)) {
    files.add(k + '.glb.gz');
    for (const tx of Object.values(v.materials ?? {})) if (tx) files.add(tx + '.webp');
    for (const a of Object.values(v.actions ?? {})) {
      for (const ref of [a.armFile, a.gunFile]) if (ref) files.add(ref + '.glb.gz');
    }
  }
  for (const path of files) assert(fs.existsSync(new URL('./public/models/' + path, import.meta.url)), path);
});

test('Ascent Market shutter opens a passable gap at the source door frame', () => {
  const level = layout('어센트'),
    gate = makeMechanisms(level).find((m) => m.name === '중앙 시장');
  assert.equal(level.blocked(gate.x, gate.z, gate.y, 0.27, 1.65), false);
  assert(geometry(gate).y > gate.y + 1.65);
  const sw = switchPos(gate);
  assert(useMechanism([gate], { x: sw.x, y: sw.y - 1.1, z: sw.z }));
  tickMechanisms([gate], [], 2, 2, () => {});
  assert.equal(geometry(gate).y, gate.y);
  damageMechanism(gate, 500);
  assert.equal(geometry(gate), null);
});
