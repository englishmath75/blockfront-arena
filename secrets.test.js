import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {mapSecrets,tricks,secretCatalog,findRelicPosition,trackPreparation,prepared,discover,claimRelic,traitLanding,traitReturn,recordDuel} from './secrets.js';
import {secretJournal} from './secret-journal.js';
import {MAPS,areas,setArena} from './arena.js';
import {buildTerrain} from './terrain.js';
import {triangleTerrain} from './triangle-terrain.js';
import {deviceMesh} from './field-effects.js';
import {drawRelic} from './secret-effects.js';

const actor=()=>({hp:100,shield:0,ult:4,charges:[1,1,1,0],glideSeconds:0,foundSecrets:[],roundSecrets:[]});
const buffer=data=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const asset=p=>fs.readFileSync(new URL('./public/terrain/'+p,import.meta.url));

test('all 14 different relics stand on reachable, clear floor near the real callout and have a visible model',()=>{
  assert.equal(Object.keys(mapSecrets).length,MAPS.length+1);
  assert.equal(new Set(Object.values(mapSecrets).map(item=>item.shape)).size,14);
  for(const item of Object.values(mapSecrets)){
    setArena(item.map);
    const map=MAPS.find(m=>m.name===item.map);
    const level=map?triangleTerrain(buffer(gunzipSync(asset(map.slug+'.tri.gz'))),buildTerrain(buffer(asset(map.slug+'.vxb')))):buildTerrain(null);
    const pos=findRelicPosition(item,areas,level);
    assert.ok(pos,item.map+' · '+item.area);
    const floor=level.support(pos.x,pos.z,pos.y+.03,.27);
    assert.ok(Math.abs(pos.y-floor)<.04,item.map+' floor');
    assert.equal(level.blocked(pos.x,pos.z,pos.y,.32,1.72),false,item.map+' headroom');
    const anchor=areas.find(n=>n.sector+' '+n.name===item.area)??{x:6,z:11};
    assert.ok(Math.hypot(pos.x-anchor.x,pos.z-anchor.z)<9,item.map+' landmark');
    const mesh=deviceMesh('relic','#efbb77',.45,.54,.45);
    const d={...pos,secretId:item.id,end:10,mesh};drawRelic(d,0,pos);
    assert.ok(mesh.userData.relic.prop.children.length>=2,item.shape);
    drawRelic(d,1,pos);assert.equal(mesh.children.length,3);
    d.claimed=true;drawRelic(d,2,pos);assert.equal(mesh.visible,false);
    mesh.material.dispose();
  }
});
test('preparation is continuous, cancels on stow or suppression, and only upgrades one cast per round',()=>{
  for(const [id,rule] of Object.entries(tricks).filter(([,r])=>r.hold)){
    const p=actor();trackPreparation(p,rule.skill,10,true);
    assert.equal(prepared(p,rule.skill,10+rule.hold-.01),null);
    trackPreparation(p,rule.skill,11,false);assert.equal(prepared(p,rule.skill,20),null);
    trackPreparation(p,rule.skill,12,true);trackPreparation(p,rule.skill,13,true);
    assert.equal(prepared(p,rule.skill,12+rule.hold),id);
    discover(p,id,20);trackPreparation(p,rule.skill,21,true);assert.equal(p.preparation,null);
    p.roundSecrets=[];trackPreparation(p,rule.skill,22,true);assert.equal(p.preparation.id,id);
    discover(p,id,27);assert.deepEqual(p.foundSecrets,[id]);
  }
});
test('one shared relic pays exactly one claimant and handles saturated rewards',()=>{
  for(const [map,bonus] of [['어센트','실드 +15'],['스플릿','6초간 발소리 제거'],['바인드','궁극기 포인트 +1']]){
    const p=actor(),other=actor(),relic={secretId:mapSecrets[map].id,end:20};
    assert.ok(claimRelic(p,relic,4,5,true));assert.equal(p.discovery.bonus,bonus);
    assert.equal(claimRelic(other,relic,4,5,true),false);assert.deepEqual(other.foundSecrets,[]);
    if(map==='바인드')assert.equal(p.charges[3],1);
  }
  const p=actor();p.shield=50;
  claimRelic(p,{secretId:'relic-ascent',end:5},0,8,true);assert.equal(p.quietUntil,6);
  claimRelic(p,{secretId:'relic-bind',end:5},1,8,false);assert.equal(p.quietUntil,7);
  assert.equal(claimRelic(p,{secretId:'relic-bind',end:3},3,8,true),false);
});
test('gliding, returning to a beacon and actual PvP records grant their stated benefits',()=>{
  const p=actor(),other=actor();
  p.glideSeconds=.99;traitLanding(p,1);assert.deepEqual(p.roundSecrets,[]);
  p.glideSeconds=1;traitLanding(p,2);assert.equal(p.quietUntil,8);assert.equal(p.glideSeconds,0);
  const trip={from:{x:0,y:0,z:0},to:{x:11.99,y:0,z:0}};
  traitReturn(p,trip,2);assert.equal(p.shield,0);trip.to.x=12;traitReturn(p,trip,3);assert.equal(p.shield,15);
  recordDuel(p,other,4);recordDuel(p,other,5);p.hp=90;
  recordDuel(other,p,6);assert.equal(p.hp,100);assert.equal(p.shield,30);assert.equal(p.unansweredDeaths,0);
  recordDuel({...other,target:true},p,7);recordDuel(p,p,7);assert.equal(p.duelKills,1);
  recordDuel(other,p,8);recordDuel(other,p,9);assert.equal(p.hasteUntil,13);
  assert.deepEqual(p.foundSecrets,['drift','prism','return','tempo']);
});
test('the journal keeps locked rewards hidden and reveals the collected entry only',()=>{
  assert.equal(Object.keys(secretCatalog).length,21);
  const blank=secretJournal(new Set(),'agents');
  assert.ok(blank.includes(tricks.frost.hint));assert.ok(!blank.includes(tricks.frost.detail));
  const found=secretJournal(new Set(['frost']),'agents');
  assert.ok(found.includes(tricks.frost.detail));assert.ok(!found.includes(tricks.dusk.detail));
});
