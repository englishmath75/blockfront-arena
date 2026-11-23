import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { handlingTracks, sampleHandling } from './handling-motion.js';
import {usesStandardAction} from './skin-articulation.js';
import { sceneryVisibility } from './scenery-visibility.js';
import { deviceMesh, drawDevice } from './field-effects.js';
import { skinProfile } from './skin-levels.js';
import skinList from './skins.json' with { type:'json' };
import { worldResolution } from './world-resolution.js';
import { referenceCues, playSkinEvent, stopAnimationAudio } from './skin-performance.js';
import { installChaosCore } from './chaos-core.js';
import skillSounds from './ability-sfx.json' with {type:'json'};
import agentVoices from './ability-voice.json' with {type:'json'};
import shotSources from './shot-matches.json' with { type:'json' };
import finishLight from './finish-light.json' with { type:'json' };
import finishes from './finisher-frames.json' with { type:'json' };
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

test('opaque map walls cull only fully hidden regions and moving the camera restores visibility',()=>{
  const make=x=>{
    const mesh=new T.Mesh(new T.BoxGeometry(.4,.4,.4));
    mesh.geometry.translate(x,0,-7);return mesh;
  };
  const root=new T.Group(),behind=make(0),beside=make(3.5);root.add(behind,beside);
  const camera=new T.PerspectiveCamera(72,1,.025,230);
  camera.updateMatrixWorld();
  const update=sceneryVisibility(root,[[-.6,-1,-2,.6,-1,-2,.6,1,-2,-.6,1,-2]]);
  update(camera);assert.equal(behind.visible,false);assert.equal(beside.visible,true);
  camera.position.x=2;camera.lookAt(0,0,-7);camera.updateMatrixWorld();
  update(camera);assert.equal(behind.visible,true);
});

test('growing skill walls preserve the GPU buffers and handle a newly placed single point',()=>{
  const mesh=deviceMesh('lane',0x33bbff,1,3,1), d={mesh,type:'lane',h:3,born:0,end:6,path:[[1,0,1]]};
  drawDevice(d,.01);assert.equal(mesh.visible,false);
  d.path.push([2,0,1]);drawDevice(d,.1);
  const geometry=mesh.geometry;assert.equal(mesh.visible,true);
  d.path.push([3,.2,1]);drawDevice(d,.2);
  assert.equal(mesh.geometry,geometry);assert.equal(geometry.drawRange.count,12);
  assert(Number.isFinite(geometry.boundingSphere.radius));mesh.material.dispose();geometry.dispose();
});

test('model-only gun chromas retain native gestures and their documented sound exceptions',()=>{
  const byName=(gun,name)=>skinProfile(skinList[gun].find(s=>s.name===name));
  const altitude=byName('vandal','알티튜드 밴달'),snow=byName('phantom','스노우폴 팬텀');
  assert(altitude && snow);assert(usesStandardAction('vandal',altitude,'inspect'));
  assert(usesStandardAction('phantom',snow,'reload'));assert(!usesStandardAction('phantom',snow,'inspect'));
  assert(!usesStandardAction('vandal',byName('vandal','쿠로나미 밴달'),'reload'));
  assert(!usesStandardAction('melee',skinProfile(skinList.melee[0]),'inspect'));
});

test('Cyber Cage obscures its round wall at eye height and leaves its interior visible',()=>{
  const d={kind:'cyberCage',type:'smoke',x:0,y:0,z:0,radius:3.72,w:7.44,d:7.44,h:4,born:2,end:9};
  const ray=(x,y,z)=>new T.Ray(new T.Vector3(x,y,z),new T.Vector3(1,0,0));
  assert.equal(visionDistance(ray(0,1.6,0),d,3,2.5),2.5);
  assert(Math.abs(visionDistance(ray(-8,.1,0),d,3,15)-4.28)<1e-6);
  assert.equal(visionDistance(ray(-8,4.1,0),d,3,15),15);
  assert.equal(visionDistance(ray(-8,2,0),d,9,15),15);
});

test('all equipped skins have closed 3D action curves and melee has no reload',()=>{
  const inspectKeys=new Set(), reloadKeys=new Set();
  for(const [gun,list] of Object.entries(skinList)) for(const item of list){
    const motion=handlingTracks(gun,skinProfile(item));
    for(const tag of ['inspect','reload']){
      const curve=motion[tag];
      if(gun==='melee' && tag==='reload'){assert.equal(curve,undefined);continue}
      const seen=tag==='reload'?reloadKeys:inspectKeys;
      const signature=JSON.stringify(curve);
      assert(!seen.has(signature),item.name+' '+tag);seen.add(signature);
      assert(curve.every((key,i)=>key.every(Number.isFinite) && (!i || key[0]>curve[i-1][0])));
      const out=[0,0,0,0];sampleHandling(curve,.32,out);
      assert(out.some(v=>Math.abs(v)>.02));
      for(const t of [0,1]){sampleHandling(curve,t,out);assert(out.every(v=>Math.abs(v)<1e-8))}
    }
  }
});

test('reference light tracks align with the finisher frame clock and isolated shots resolve locally',()=>{
  for(const [id,s] of Object.entries(finishes)){
    assert.equal(Buffer.from(finishLight[id],'base64').length,s.frames*7,id);
  }
  for(const [id,[level,at,duration,score]] of Object.entries(shotSources)){
    assert(level>=1 && at>=0 && duration>=.23 && score>=.78);
    const data=fs.readFileSync(new URL('./public/weapon-audio/'+id+'-discharge.ogg',import.meta.url));
    assert.equal(data.toString('ascii',0,4),'OggS');
  }
});

test('a lower map resolution keeps the weapon framebuffer at display size',()=>{
  let ratio=1.5,width=800,height=600,bound=null,blits=0;
  const renderer={getPixelRatio:()=>ratio,getSize:v=>v.set(width,height),getRenderTarget:()=>bound,
    setRenderTarget:t=>{bound=t;},render(){assert.equal(bound,null);blits++;}};
  const output=worldResolution(renderer);
  output.draw(.75,t=>{assert.equal(bound,t);assert.deepEqual([t.width,t.height],[600,450]);});
  width=400;height=300;
  output.draw(.75,t=>assert.deepEqual([t.width,t.height],[300,225]));
  assert.throws(()=>output.draw(.75,()=>{throw Error('map');}));assert.equal(bound,null);
  ratio=.75;output.draw(.75,t=>assert.equal(t,null));assert.equal(blits,2);output.dispose();
});

test('showcase shots use the same local stereo reports and respect upgrades', () => {
  const samples=[];
  const previous=globalThis.Audio;
  globalThis.Audio=class {
    cloneNode(){const a=new globalThis.Audio();a.src=this.src;return a;}
    play(){samples.push(this.src);this.onended?.();return Promise.resolve();}
    pause(){}
  };
  try {
    for(const [family,count] of [['rogue',3],['preludetochaos',3],['singularityep9',3],['champions2023',1]]){
      const item=skinList.vandal.find(s=>s.banner===family);
      const tier=skinProfile(item,{level:2}),urls=referenceCues(tier,'shot');
      assert.equal(urls.length,count);assert.deepEqual(referenceCues(skinProfile(item,{level:1}),'shot'),[]);
      const at=samples.length;
      for(let i=0;i<count+1;i++)assert(playSkinEvent(tier,'shot',.4,.8,null,'vandal'));
      assert.deepEqual(samples.slice(at),[...urls,urls[0]]);
      for(const url of urls)assert.equal(asset(url.slice(1)).toString('ascii',0,4),'OggS');
    }
  } finally {stopAnimationAudio();if(previous)globalThis.Audio=previous;else delete globalThis.Audio;}
});

test('Prelude reload ejects, replaces and seats the cell before the receiver closes', () => {
  const item=skinList.vandal.find(s=>s.banner==='preludetochaos');
  const root=new T.Group(),mount=new T.Group();root.add(mount);root.updateMatrixWorld(true);
  const bounds=new T.Box3(new T.Vector3(-.5,-.15,-.04),new T.Vector3(.5,.15,.04));
  for(const level of [2,3]){
    const skin=skinProfile(item,{level});
    const clean=installChaosCore(root,mount,skin,bounds,true,.3);
    const core=root.userData.chaosCore;
    assert.equal(core.enabled,level===3);assert.equal(referenceCues(skin,'reload').length,level===3?1:0);
    if(core.enabled){
      core.update('reload',.105,1);assert(core.orb.position.y>.05);
      core.update('reload',.28,1);assert.equal(core.orb.visible,false);
      core.update('reload',.397,1);assert(core.orb.visible && core.orb.position.y>.15);
      core.update('reload',.50,1);assert(core.orb.visible && core.orb.position.y<.025);
      core.update('inspect',.55,1);assert(core.orb.position.y>.08);
      core.update('idle',0,2);assert(core.orb.position.y<.025);
    }
    clean();assert.equal(mount.children.length,0);
  }
});

test('Sage slow orb casts with dedicated foley and has no voice fallback',()=>{
  assert.deepEqual(skillSounds['둔화 구슬'],{equip:'ice-equip.ogg',cast:'ice-cast.ogg'});
  assert.equal(agentVoices['둔화 구슬'],undefined);
  for(const name of ['ice-equip','ice-cast','ice-break','ice-step-1','ice-step-2','ice-step-3']){
    assert.equal(asset('agent-sfx/'+name+'.ogg').toString('ascii',0,4),'OggS');
  }
});

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
import {stepHeight} from './walk-surface.js';
import {peerMotion} from './peer-motion.js';
import {stickPack,blastImpact} from './blast-pack.js';
import {customControls} from './custom-game.js';

test('a step requires forward support and overhead clearance',()=>{
  const world={structure:{ceiling:()=>Infinity}};
  const floor=(x,z,y,r)=>r>.2 || x>.15?.28:0;
  assert.equal(stepHeight(world,0,0,0,true,1.53,floor,0,.1),0);
  assert.equal(stepHeight(world,0,0,0,true,1.53,floor,.1,0),.28);
  world.structure.ceiling=()=>1.7;
  assert.equal(stepHeight(world,0,0,0,true,1.53,floor,.1,0),0);
});
test('reconciliation preserves movement between packets and snaps on respawn',()=>{
  const motion=peerMotion(),p={x:0,y:0,z:0,height:1.53,yaw:0,pitch:0};
  const walk=(dt,o,keys)=>{if(keys.has('KeyW'))o.z-=5*dt};
  motion.reconcile(p,1,1000,true,walk);
  motion.advance(p,new Set(['KeyW']),.02,1020,walk);
  assert.equal(motion.view().z,-.1);
  motion.reconcile({...p,motionStamp:990,motionSeen:1},1,1030,false,walk);
  assert.equal(motion.view().z,-.1);
  motion.reconcile({...p,x:20},2,1200,true,walk);
  assert.equal(motion.view().x,20);assert.equal(motion.view().z,0);
  motion.record({...p,id:1},1000,true);motion.record({...p,id:1,x:1},1100,false);
  assert(motion.other({id:1},1175).x>0 && motion.other({id:1},1175).x<1);
});
test('Blast Pack sticks, arms after landing and can propel its owner twice',()=>{
  const pack={x:0,y:0,z:0,owner:'raze'},p={id:'raze',x:1,y:0,z:0,height:1.53,vy:0};
  stickPack(pack,new T.Vector3(0,1,0),10);
  assert.equal(pack.end,15);assert.equal(pack.armedAt,11.5);
  assert.equal(blastImpact(pack,p,10.1),0);assert(p.blastMotion.vx>0 && p.vy>0);
  const initial=p.blastMotion.vx;blastImpact(pack,p,10.4);assert(p.blastMotion.vx>initial);
  assert.equal(blastImpact(pack,{...p,id:'enemy'},11.4),0);
  assert(blastImpact(pack,{...p,id:'enemy'},11.5)>0);
  assert.equal(blastImpact(pack,p,12),0);
});
test('custom controls expose global match actions only to the host',()=>{
  assert.equal(customControls(false,{enabled:false},false),'');
  const guest=customControls(false,{enabled:true},false);
  assert(guest.includes('data-custom="ghost"'));assert(!guest.includes('data-custom="restart"'));
  assert(customControls(true,{enabled:true},false).includes('data-custom="restart"'));
});
