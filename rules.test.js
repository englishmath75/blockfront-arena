import assert from 'node:assert/strict';
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
import { castField, tickField } from './agent-fields.js';
import { createZone, tickZone, shieldHit } from './ability-zones.js';
import { Ray, Vector3 } from 'three';

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

test('Fault Line waits for windup and Lockdown detains through cover after its countdown', () => {
  const { caster, target, ctx, devices } = fieldScenario();
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
