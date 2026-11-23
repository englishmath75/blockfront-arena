import assert from 'node:assert/strict';
import {tickNest,tickHunterBeam,owlPing,domeBoundary} from './deployed-fields.js';
import test from 'node:test';
import fs from 'node:fs';
import skins from './skins.json' with { type: 'json' };
import { shotPattern, meleeDamage, alternateAttack } from './attacks.js';
import { skinProfile } from './skin-levels.js';
import { recordedAction } from './recorded-weapon.js';
import finishers from './finisher-frames.json' with { type: 'json' };
import banners from './banner-index.json' with { type: 'json' };
import motions from './motion-index.json' with { type: 'json' };
import finishColors from './finisher-variants.json' with { type: 'json' };
import times from './ability-times.json' with { type: 'json' };
import demos from './ability-demos.json' with { type: 'json' };
import abilitySounds from './ability-sfx.json' with { type: 'json' };
import { motionAction, sampleMotion } from './weapon-motion.js';
import { signatureTrack } from './signature-handling.js';
import { tickGroundField } from './ground-fields.js';
import chromas from './motion-chromas.json' with { type: 'json' };
import joints from './finger-motion.json' with { type: 'json' };
import { castField, tickField } from './agent-fields.js';
import { createZone, tickZone, shieldHit } from './ability-zones.js';
import {strikePath,insideStrip,sensorArea,tabletRange} from './strike-path.js';
import {wirePath} from './nanowire.js';
import {worldSculpture} from './ability-sculptures.js';
import {Box3} from 'three';
import { Group, Ray, Vector3 } from 'three';
import { parseCrosshair } from './crosshair.js';
import { scopeLevels,zoomFov } from './optics.js';
import { anchorPair,crossesWire } from './trapwire.js';
import { meleeTracks } from './melee-motion.js';
import { WEAPONS as armory,spreadFor as accuracy } from './rules.js';
import { PlayerRoom } from './room-client.js';
import { minimumPlayers } from './room-server.js';
import { muzzleSocket } from './skin-outline.js';

test('a ranked code room can start with two players and public matchmaking waits for ten',()=>{
  assert.equal(minimumPlayers({mode:'경쟁전',queue:false}),2);
  assert.equal(minimumPlayers({mode:'경쟁전',queue:true}),10);
  assert.equal(minimumPlayers({mode:'사용자 설정 게임',queue:false}),2);
});

test('suppressed skins attach the flash to the tip of the silencer',()=>{
  const gun=new Group(),barrel=new Group(),tip=new Group();
  barrel.name='MuzzlePoint';tip.name='MuzzlePoint_Silencer';
  gun.add(barrel);
  assert.equal(muzzleSocket(gun),barrel);
  barrel.add(tip);
  assert.equal(muzzleSocket(gun),tip);
});

test('crosshair codes retain independently configured primary, ADS and sniper sections',()=>{
  const c=parseCrosshair('0;a;1;P;c;8;u;37FFACFF;0l;6;0g;1;0v;3;A;d;1;S;c;5');
  assert.equal(c.global.a,1);assert.equal(c.P.u,'#37FFACFF');assert.equal(c.P['0v'],3);
  assert.equal(c.A.d,1);assert.equal(c.S.c,5);
  assert.equal(parseCrosshair('0;P;0l;garbage'),null);
});
test('sniper magnification and movement accuracy match the equipped weapon',()=>{
  for(const [gun,levels] of Object.entries(scopeLevels)){
    const stats=armory[gun],aimed={...stats,spread:stats.ads.firstBulletAccuracy*Math.PI/180};
    assert(stats.spread>aimed.spread);assert(accuracy(aimed,4,false,false,0)>accuracy(aimed,0,false,false,0));
    const fov=zoomFov(72,levels[0]);
    assert(Math.abs(Math.tan(Math.PI*36/180)/Math.tan(Math.PI*fov/360)-levels[0])<1e-9);
  }
  assert.equal(armory.headhunter.ads.zoomMultiplier,1.5);
});
test('tripwire requires a second surface, hits at body height, and rearms after a capture',()=>{
  const ray=new Ray(new Vector3(0,1,2),new Vector3(0,0,-1));
  const surface={surfaceDistance:2,normal:[0,0,1]};
  assert.equal(anchorPair({mapHit:()=>10},ray,2,surface,[]),undefined);
  const anchors=anchorPair({mapHit:(_ray,_len,_dev,_v,hit)=>{Object.assign(hit,{surfaceDistance:4,normal:[0,0,-1]});return 4}},ray,2,surface,[]);
  const owner={id:1,team:1},p={id:2,x:0,y:0,z:2,team:2,height:1.6};
  const d={id:8,type:'companion',kind:'trapwire',name:'함정',x:0,y:1,z:anchors.start[2],wireEnd:anchors.end,start:0,end:30};
  assert(crossesWire(d,p));assert(!crossesWire(d,{...p,y:2}));assert(!crossesWire(d,{...p,x:.9}));
  let damage=0;const ctx={time:1,players:[p],hostile:(a,b)=>a.team!==b.team,hurt:(_,amount)=>damage+=amount};
  tickField(d,owner,.1,ctx);assert.equal(p.tether.source,8);
  ctx.time=1.71;tickField(d,owner,.1,ctx);assert.equal(damage,5);assert.equal(d.start,3.71);assert.equal(p.tether,undefined);
});
test('knife families provide distinct equip, combo and heavy strokes',()=>{
  const values=skins.melee.map(s=>meleeTracks(s,.33,.44));
  assert.equal(values.length,177);assert(new Set(values.map(v=>JSON.stringify(v.equip))).size>=9);
  for(const v of values)assert.notDeepEqual(v['attack 1'],v['alt attack']);
});
test('a client becomes host only after the join response identifies its player', () => {
  const client = new PlayerRoom(() => {});
  assert.equal(client.host, false);
  client.room = {host: 'first'};
  assert.equal(client.host, false);
  client.id = 'first';
  assert.equal(client.host, true);
  client.room.host = 'second';
  assert.equal(client.host, false);
});

test('showcase actions unlock at their recorded level and every referenced frame and sound exists', () => {
  const exists = (path) => fs.existsSync(new URL('./public/' + path, import.meta.url));
  for (const [id, actions] of Object.entries(motions)) {
    for (const [name, action] of Object.entries(actions)) {
      assert.equal(motionAction({ id, level: action.level - 1 }, name), undefined);
      assert.equal(motionAction({ id, level: action.level }, name), action);
      assert.deepEqual(sampleMotion(action, 0), action.path[0]);
      assert.deepEqual(sampleMotion(action, 1), action.path.at(-1));
      assert(sampleMotion(action, 0.55).every(Number.isFinite));
      assert(exists('motion/' + id + '-' + name + '.ogg'));
      if (action.tile) assert(exists('motion/' + id + '-' + name + '.webp'));
    }
  }
  for (const skin of Object.values(skins).flat()) {
    for (const variant of skin.variants ?? []) {
      const color = finishColors[variant.id];
      if (!color) continue;
      assert.equal(skinProfile(skin, { variant: variant.id }).family, color);
      assert(exists('effects/finish-' + color + '.webp'));
      assert(exists('effects/finish-' + color + '.ogg'));
    }
  }
});

test('every ability timing record has a source demonstration', () => {
  assert.deepEqual(Object.keys(times).sort(), Object.keys(demos).sort());
  assert.equal(Object.keys(times).length, 120);
  assert(Object.values(demos).every((link) => new URL(link).protocol === 'https:'));
  for (const [name, cues] of Object.entries(abilitySounds)) {
    assert(demos[name]);
    for (const file of Object.values(cues)) {
      const data = fs.readFileSync(new URL('./public/agent-sfx/' + file, import.meta.url));
      assert.equal(data.toString('ascii', 0, 4), 'OggS');
      assert(data.length > 1000);
    }
  }
});

test('Owl Drone tags pulse twice with a gap and Hunter’s Fury hits only its forward cylinder',()=>{
  const {caster,target,ctx}=fieldScenario();target.height=1.6;
  target.owlDart={team:caster.team,next:1.6,left:2};
  owlPing(target,1.59);assert.equal(target.revealEnd,undefined);
  owlPing(target,1.6);assert.equal(target.revealEnd,2.25);
  owlPing(target,2.5);assert.equal(target.revealEnd,2.25);
  owlPing(target,2.81);assert.equal(target.owlDart,null);
  const beam={name:'사냥꾼의 분노',start:4,x:0,y:1,z:0,axis:[0,0,-1],length:66,radius:1.8};
  const behind={...target,id:3,z:2},side={...target,id:4,x:2.1};ctx.players.push(behind,side);
  ctx.time=3.99;tickHunterBeam(beam,caster,ctx);assert.equal(target.hp,100);
  ctx.time=4;tickHunterBeam(beam,caster,ctx);tickHunterBeam(beam,caster,ctx);
  assert.deepEqual([target.hp,behind.hp,side.hp],[20,100,100]);
});
test('Razorvine damages movement only, while an active Nanoswarm damages stationary players',()=>{
  const {caster,target,ctx}=fieldScenario();ctx.players=[target];
  const field={kind:'vineField',start:0,x:0,y:0,z:-5,radius:6.25,steps:{}};
  for(let i=0;i<90;i++){ctx.time+=1/60;tickNest(field,caster,1/60,ctx);}
  assert.equal(target.hp,100);assert(target.vineUntil>ctx.time);
  for(let i=0;i<50;i++){ctx.time+=1/60;target.x+=.05;tickNest(field,caster,1/60,ctx);}
  assert(target.hp<=90);const remaining=target.hp;field.kind='swarmField';field.steps={};
  tickNest(field,caster,1/60,ctx);tickNest(field,caster,1/60,ctx);assert.equal(target.hp,remaining-12);
});
test('Cove intercepts the spherical surface, including shots fired from inside',()=>{
  const d={x:0,y:-4,z:0,w:8,h:8},line=(x,z)=>new Ray(new Vector3(x,0,z),new Vector3(0,0,-1));
  assert.equal(domeBoundary(line(0,8),d,20),4);assert.equal(domeBoundary(line(0,0),d,2),2);
  assert.equal(domeBoundary(line(0,0),d,8),4);assert.equal(domeBoundary(line(4.1,8),d,20),20);
  assert(domeBoundary(line(3.9,8),d,20)>7);
});
test('M-pulse distinguishes sustained healing from its three timed bursts',()=>{
  const {caster,target,ctx,devices}=fieldScenario();ctx.visible=()=>true;Object.assign(target,{hp:1,z:0});
  createZone('mpulse','M-파동',{...caster,heal:true},caster,ctx);const d=devices[0];
  for(let i=0;i<=300;i++){ctx.time=i/60;tickZone(d,caster,ctx,1/60);}
  assert.equal(d.pulses,0);assert(target.hp>87 && target.hp<89);
});
function fieldScenario() {
  const caster = { id: 1, team: 'a', x: 0, y: 0, z: 0, yaw: 0 };
  const target = { id: 2, team: 'b', x: 0, y: 0, z: -5, hp: 100 };
  const devices = [];
  const ctx = {
    time: 0,
    players: [caster, target],
    hostile: (p, q) => p.team !== q.team,
    visible: () => false,
    ring() {},
    hurt(p, n) {
      p.hp -= n;
    },
    add(type, x, z, life, w, depth, h, color, owner, y) {
      const d = {
        type,
        x,
        y,
        z,
        w,
        d: depth,
        h,
        color,
        owner: owner.id,
        born: this.time,
        end: this.time + life,
      };
      devices.push(d);
      return d;
    },
  };
  ctx.add = ctx.add.bind(ctx);
  return { caster, target, ctx, devices };
}

test('ZERO/POINT checks the spherical suppression radius across map floors',()=>{
  const {caster,target,ctx,devices}=fieldScenario();
  Object.assign(target,{x:12,y:9.1,z:0,height:1.6});
  const inside={...target,id:3,y:7};ctx.players.push(inside);
  createZone('knife','제로/포인트',{x:0,y:0,z:0},caster,ctx);
  ctx.time=devices[0].next;tickZone(devices[0],caster,ctx);
  assert.equal(target.suppressed,undefined);assert.equal(inside.suppressed,ctx.time+8);
});

test('Seize captures once after windup and respects cover and late entry', () => {
  const {caster,target,ctx}=fieldScenario();
  Object.assign(target,{decayLost:0,deafUntil:0});
  const late={...target,id:3,x:9}, covered={...target,id:4};
  ctx.players.push(late,covered);
  ctx.visible=(_,p)=>p!==covered;
  const field={type:'seize',born:0,start:.7,end:5.2,x:0,y:0,z:0,radius:6.58};
  ctx.time=.6;
  tickGroundField(field,caster,ctx);
  assert.equal(target.hp,25);
  assert.equal(target.tether,undefined);
  ctx.time=.7;
  tickGroundField(field,caster,ctx);
  assert.equal(target.tether.until,5.2);
  assert.equal(target.deafUntil,5.2);
  late.x=0;
  ctx.time=1;
  tickGroundField(field,caster,ctx);
  assert.equal(late.hp,100);
  assert.equal(covered.hp,100);
});

test('Mosh damage accumulates on the impact clock with three different inner and outer hits', () => {
  const {caster,target,ctx}=fieldScenario();
  caster.x=15;
  target.z=0;
  const rim={...target,x:6}, outside={...target,x:6.3};
  ctx.visible=()=>true;
  ctx.players.push(rim,outside);
  const field={type:'mosh',born:0,start:3,x:0,y:0,z:0,radius:6.2};
  ctx.time=2.99;
  tickGroundField(field,caster,ctx);
  assert.equal(target.hp,70);
  const before=rim.hp;
  for (const t of [3,3.1,3.2,3.21]) {ctx.time=t;tickGroundField(field,caster,ctx);}
  assert.equal(target.hp,70-150);
  assert.equal(rim.hp,before-75);
  assert.equal(outside.hp,100);
});

test('captured chromas and finger observations belong to playable motions', () => {
  const variants=new Set(chromas);
  for (const skin of Object.values(skins).flat()) {
    for (const v of skin.variants ?? []) if (variants.delete(v.id)) {
      assert(Object.values(motions[skin.id] ?? {}).some(a=>a.tile) ||
        ['reload','inspect'].some(action=>{const s=skinProfile(skin,{variant:v.id});
          return recordedAction(s,action) || signatureTrack(s,'vandal',action);
        }));
      assert(fs.existsSync(new URL('./public/motion/chromas/'+v.id+'.png',import.meta.url)));
    }
  }
  assert.equal(variants.size,0);
  for (const [id,actions] of Object.entries(joints)) for (const [name,frames] of Object.entries(actions)) {
    assert(motions[id][name]);
    for (const frame of frames) for (const hand of Object.values(frame)) {
      assert.equal(hand.length,15);
      assert(hand.every(axis=>Math.abs(Math.hypot(...axis)-100)<1));
    }
  }
});

test('Fault Line starts eight metres away and its charged footprint extends 56 metres',()=>{
  const {caster,target,ctx,devices}=fieldScenario();
  castField('균열',caster,caster,{charge:1},ctx);
  const d=devices[0];assert.equal(d.originZ,-8);assert.equal(d.reach,56);assert.equal(d.w,8);
  ctx.time=d.start+.01;
  for(const [x,z,hit] of [[0,-6,false],[4.15,-12,false],[3.9,-63,true]]){
    Object.assign(target,{x,z,tag:0});tickField(d,caster,.016,ctx);assert.equal(target.tag>0,hit);
  }
});

test('Armageddon pivots a 32 by 12 metre path, independent of the second click distance',()=>{
  const origin={x:2,z:6},near=strikePath(origin,{x:2.2,z:6}),far=strikePath(origin,{x:45,z:6});
  assert.deepEqual(near,far);assert.equal(near.length,16);assert.equal(near[0].delay,3.08);
  assert.equal(near[15].x,33);assert.equal(near[15].delay-near[0].delay,3.75);
  const d={...near[3],w:12,d:2,h:5,y:0};
  assert(insideStrip(d,{x:d.x,z:d.z+5.99,y:0}));assert(!insideStrip(d,{x:d.x,z:d.z+6.1,y:0}));
  assert.deepEqual(strikePath(origin,origin),[]);assert.equal(tabletRange('아마겟돈'),52.5);assert.equal(tabletRange('유도 일제 사격'),45);
});

test('a quiet opponent cannot trigger a Sonic Sensor, a second loud opponent can',()=>{
  const {caster,target,ctx,devices}=fieldScenario();
  const second={...target,id:3,x:1,mode:'run',vx:4,vz:0},mount={x:0,y:1,z:0,normal:[0,0,-1]};
  ctx.players.push(second);assert(castField('음향 센서',caster,mount,{mount},ctx));
  const d=devices[0];ctx.time=d.start+.1;second.vx=0;tickField(d,caster,.01,ctx);assert.equal(d.triggerAt,undefined);
  second.vx=4;tickField(d,caster,.01,ctx);assert.equal(d.triggerAt,ctx.time+.5);
  second.vx=0;ctx.time=d.triggerAt+.01;tickField(d,caster,.01,ctx);assert(target.tag>ctx.time);assert(second.tag>ctx.time);
  assert(!sensorArea(d,{...target,z:1}));assert(!sensorArea(d,{...target,x:4.2}));
});

test('Guided Salvo flies to its mark, then pulses three times at 0.8 second intervals',()=>{
  const {caster,target,ctx,devices}=fieldScenario();ctx.visible=()=>true;
  createZone('guided','유도 일제 사격',{x:22,y:0,z:0},caster,ctx);
  const d=devices[0];assert.equal(d.land,1);assert.equal(d.start,2.25);assert.equal(d.radius,4.5);
  Object.assign(target,{x:22,z:0,hp:300});ctx.time=d.start-.01;tickZone(d,caster,ctx);assert.equal(target.hp,300);
  for(let i=0;i<3;i++){ctx.time=d.start+.8*i+.001;tickZone(d,caster,ctx);}
  assert.equal(target.hp,105);assert.equal(d.pulses,0);
});

test('the Deadlock pulse reflects from the first wall and cannot seize through that wall',()=>{
  const ray=new Ray(new Vector3(0,1,0),new Vector3(0,0,-1));
  const wall={mapHit(ray,max,devices,vision,hit){if(ray.direction.z<0){hit.normal=[0,0,1];return 5;}return max;}};
  const hidden={x:0,y:0,z:-8,height:1.5},around={x:0,y:0,z:4,height:1.5};
  const result=wirePath(wall,ray,[],[hidden,around],()=>false);
  assert.equal(result.victim,around);assert.equal(result.path.length,3);assert(result.length<15);
});

test('Fade creatures keep their specified world size under different model proportions',()=>{
  for(const [name,span] of [['추적귀',1.1],['귀체',.72],['meshNode',.46],['yellow',.41]]){
    const root=worldSculpture(name,span),s=new Box3().setFromObject(root).getSize(new Vector3());
    assert(Math.abs(Math.max(s.x,s.y,s.z)-span)<.001);assert(root.children.length>=2);
  }
});

test('Fault Line waits for windup and Lockdown detains through cover after its countdown', () => {
  const { caster, target, ctx, devices } = fieldScenario();
  target.z=-12;
  assert(castField('균열', caster, caster, { charge: 1 }, ctx));
  const wave = devices[0];
  ctx.time = 1;
  tickField(wave, caster, 0.01, ctx);
  assert.equal(target.tag, undefined);
  ctx.time = 1.2;
  tickField(wave, caster, 0.01, ctx);
  assert.equal(target.tag, 3.7);
  assert(castField('봉쇄', caster, caster, {}, ctx));
  const lockdown = devices[1];
  ctx.time = lockdown.born + 12.95;
  tickField(lockdown, caster, 0.01, ctx);
  assert.equal(target.detainedUntil, undefined);
  ctx.time = lockdown.born + 13.01;
  tickField(lockdown, caster, 0.01, ctx);
  assert.equal(target.detainedUntil, ctx.time + 8);
});

test('suppression pulse waits for the knife and a wall blocks rays only within its face', () => {
  const { caster, target, ctx, devices } = fieldScenario();
  assert(createZone('knife', '제로/포인트', caster, caster, ctx));
  const emitter = devices[0];
  ctx.time = emitter.next - 0.01;
  tickZone(emitter, caster, ctx);
  assert.equal(target.suppressed, undefined);
  ctx.time = emitter.next + 0.01;
  tickZone(emitter, caster, ctx);
  assert.equal(target.suppressed, ctx.time + 8);
  const wall = { x: 0, y: 0, z: -5, angle: 0, w: 4, h: 2 };
  const ray = (x) => new Ray(new Vector3(x, 1, 0), new Vector3(0, 0, -1));
  assert.equal(shieldHit(ray(0), wall, 30), 5);
  assert.equal(shieldHit(ray(2.01), wall, 30), 30);
  assert.equal(shieldHit(ray(0), wall, 4), 4);
});

test('every equipped appearance, chroma and unlocked finisher resolves to a local asset', () => {
  const exists = (path) => fs.existsSync(new URL('./public' + path, import.meta.url));
  for (const s of Object.values(skins).flat()) {
    for (let i = 1; i <= (s.levels?.length ?? 1); i++)
      assert(exists(skinProfile(s, { level: i }).image), s.name);
    for (const v of s.variants ?? [])
      assert(exists(skinProfile(s, { level: s.levels?.length ?? 1, variant: v.id }).image), s.name);
    if (s.levels?.includes('Finisher')) {
      const family = skinProfile(s).family;
      assert(finishers[family], s.name);
      assert(exists('/effects/finish-' + family + '.webp'), s.name);
      if (finishers[family].audio !== false) assert(exists('/effects/finish-' + family + '.ogg'), s.name);
      assert(banners[s.banner], s.name);
    }
  }
});

test('Classic fires three simultaneous rounds and knives use independent primary and alternate attacks', () => {
  const burst = (ammo, speed, air) => shotPattern('classic', true, ammo, WEAPONS.classic, speed, air, 0);
  assert.equal(burst(12, 0, false).count, 3);
  assert.equal(burst(2, 0, false).count, 2);
  assert(burst(12, 0, false).cone < burst(12, 3, false).cone);
  assert(burst(12, 6, false).cone < burst(12, 0, true).cone);
  for (const id of ['classic', 'blades', 'melee', 'bucky']) assert(alternateAttack(id));
  assert(!alternateAttack('vandal'));
  assert.equal(shotPattern('blades', false, 5, WEAPONS.blades, 6, true, 0.08).cone, 0);
  assert.equal(shotPattern('blades', true, 4, WEAPONS.blades, 0, false, 0).count, 4);
  assert.equal(meleeDamage(true, 0, 0), 150);
  assert.equal(meleeDamage(false, 0, Math.PI), 50);
});
test('equipped levels control replay, sound, finishers and chromas in game', () => {
  for (const name of ['로그 밴달', '싱귤래러티 밴달', '2023 챔피언스 밴달']) {
    const skin = skins.vandal.find((s) => s.name === name);
    assert(skin);
    const base = skinProfile(skin, { level: 1 }),
      upgraded = skinProfile(skin);
    assert.equal(base.finishOn, false);
    assert(upgraded.finishOn);
    assert(recordedAction(base, 'inspect').key.includes('-base-'));
    assert(recordedAction(upgraded, 'inspect').key.includes('-full-'));
    for (const profile of [
      base,
      upgraded,
      ...(skin.variants ?? []).map((v) => skinProfile(skin, { level: upgraded.level, variant: v.id })),
    ])
      for (const tag of ['fire', 'reload', 'equip', 'inspect', 'idle', 'ads']) {
        const a = recordedAction(profile, tag);
        for (let i = 0; i < Math.ceil(a.n / a.capacity); i++)
          assert(
            fs.existsSync(new URL('./public/performances/' + a.key + '-' + i + '.webp', import.meta.url)),
          );
        if (!['idle', 'ads'].includes(tag))
          assert(fs.existsSync(new URL('./public/performances/' + a.key + '.ogg', import.meta.url)));
      }
    if (skin.variants?.length) {
      const variant = skin.variants[0].id;
      assert.equal(skinProfile(skin, { level: 1, variant }).variant, undefined);
      assert.equal(skinProfile(skin, { level: 4, variant }).variant, variant);
      assert(recordedAction(skinProfile(skin, { level: 2 }), 'shot', true).key.includes('-full-'));
      assert(recordedAction(skinProfile(skin, { level: 2 }), 'reload').key.includes('-base-'));
    }
  }
});
import {
  SPEED,
  STOP_THRESHOLD,
  WEAPONS,
  audibleStep,
  decideRound,
  spreadFor,
  velocityStep,
} from './rules.js';
import { open, cell, setArena, MAPS, sidePosition, SITES } from './arena.js';
test('walking and crouching are silent and slower than running', () => {
  assert(SPEED.crouch < SPEED.walk && SPEED.walk < SPEED.run);
  assert.equal(audibleStep('walk', SPEED.walk, true), false);
  assert.equal(audibleStep('crouch', SPEED.crouch, true), false);
  assert.equal(audibleStep('run', SPEED.run, true), true);
  assert.equal(audibleStep('run', SPEED.run, false), false);
});
test('braking restores first-shot accuracy and opposite input brakes faster', () => {
  let velocity = [SPEED.run, 0];
  for (let tick = 0; tick < 9; tick++) velocity = velocityStep(...velocity, 0, 0, 0, 1 / 60);
  assert(velocity[0] < STOP_THRESHOLD);
  assert(
    velocityStep(SPEED.run, 0, -1, 0, SPEED.run, 1 / 60)[0] < velocityStep(SPEED.run, 0, 0, 0, 0, 1 / 60)[0],
  );
  const stats = WEAPONS.vandal;
  assert.equal(spreadFor(stats, velocity[0], false, false, 0), stats.spread);
  assert(spreadFor(stats, SPEED.run, false, false, 0) > spreadFor(stats, SPEED.walk, false, false, 0));
  assert(spreadFor(stats, SPEED.walk, false, false, 0) > stats.spread);
  assert(spreadFor(stats, 0, true, false, 0) > stats.spread);
});
test('a planted core keeps the round alive after the attackers are eliminated', () => {
  assert.equal(decideRound({ armed: true, detonate: 5, attackAlive: 0, defendAlive: 2 }), null);
  assert.equal(decideRound({ armed: true, detonate: 0, attackAlive: 0, defendAlive: 2 })[0], 'attack');
  assert.equal(decideRound({ armed: false, clock: 0, attackAlive: 2, defendAlive: 2 })[0], 'defend');
});
test('every competitive map has passable spawns and sites on its connected floor', () => {
  for (const map of MAPS) {
    setArena(map.name);
    assert(SITES.length >= 2, map.name);
    for (const s of SITES) assert(open(cell(s.x), cell(s.z)), map.name);
    for (const side of [true, false])
      for (let i = 0; i < 5; i++) {
        const [x, z] = sidePosition(side, i);
        assert(open(cell(x), cell(z)), map.name);
      }
  }
});
