import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences,addProfile,removeProfile,profileValue,templates,bindKey,inputCode,mixVolume} from './preferences.js';
import {parseCrosshair} from './crosshair.js';
import {roomMiddleware} from './room-server.js';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';

test('previous settings migrate and all 15 profiles survive saving, switching and deletion',()=>{
  const old='0;P;c;5;0l;4;0f;0;1b;0',s=normalizePreferences({crosshairCode:old,volume:.45,sens:2});
  assert.equal(s.profiles[0].code,old);assert.equal(s.volume,.45);assert.equal(s.sens,2);
  assert.ok(!addProfile(s,'bad','0;garbled'));
  for(let i=1;i<15;i++)assert.ok(addProfile(s,'프로필 '+i,templates[i%4][1]));
  const full=structuredClone(s);assert.equal(addProfile(s,'limit',old),false);assert.deepEqual(s,full);
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(s))),s);
  s.selected=7;assert.ok(removeProfile(s));assert.equal(s.profiles[s.selected].name,'프로필 8');assert.equal(removeProfile(normalizePreferences({})),false);
});
test('primary, ADS and sniper edits round-trip without overwriting each other',()=>{
  const s=normalizePreferences({color:'#aaccff'});profileValue(s,'P','0l',9);profileValue(s,'A','0l',3);profileValue(s,'S','color','#aaff00');
  const p=parseCrosshair(s.profiles[0].code);
  assert.equal(p.P['0l'],9);assert.equal(p.A['0l'],3);assert.equal(p.A['0t'],p.P['0t']);assert.equal(p.S.u,'#AAFF00FF');
  assert.equal(p.global.a,1);assert.equal(p.P.u,'#AACCFFFF');
});
test('bindings swap conflicts and persist free keys, and mix controls stay independent',()=>{
  const s=normalizePreferences({});bindKey(s,'KeyQ','KeyE');assert.equal(inputCode(s,'KeyQ'),'KeyE');
  bindKey(s,'KeyQ','KeyL');assert.equal(inputCode(s,'KeyL'),'KeyQ');assert.equal(inputCode(s,'KeyE'),'');
  assert.equal(bindKey(s,'KeyC','Escape'),false);assert.deepEqual(normalizePreferences(s).keys,s.keys);
  s.volume=.5;s.effects=.25;s.dialogue=0;assert.equal(mixVolume(s,'effects'),.125);assert.equal(mixVolume(s,'dialogue'),0);
});
test('voice is room-authenticated, team or private-party scoped, validated and rate limited',async()=>{
  const run=roomMiddleware(),listeners=[];
  async function request(action,body={},member,open=false){
    const search=open?'?code='+member.room.code+'&key='+member.token:'';
    const req=Readable.from(open?[]:[Buffer.from(JSON.stringify({...body,...(member?{code:member.room.code}:{})}))]);
    req.method=open?'GET':'POST';req.url='/arena-api/'+action+search;req.headers={host:'game',...(member?{authorization:'Bearer '+member.token}:{})};
    const res=new EventEmitter();res.writeHead=s=>res.status=s;res.end=t=>{res.result=t?JSON.parse(t):{};};res.data=[];res.write=s=>{res.data.push(s);return true;};
    await run(req,res,()=>{});if(open)listeners.push(res);return res;
  }
  try{
    const join={mode:'사용자 설정 게임',map:'어센트',agent:'세이지'};
    const a=(await request('join',join)).result,b=(await request('join',{...join,code:a.room.code})).result,c=(await request('join',{...join,code:a.room.code})).result;
    const streams=[];for(const m of [a,b,c])streams.push(await request('events',{},m,true));
    assert.equal((await request('start',{},a)).status,200);
    const frame={channel:'team',sequence:1,pcm:'A'.repeat(5120)},sent=i=>streams[i].data.filter(v=>v.startsWith('event: voice')).length;
    assert.equal((await request('voice',frame)).status,404);
    assert.equal((await request('voice',{...frame,pcm:'oops'},a)).status,400);
    assert.equal((await request('voice',frame,a)).status,200);assert.deepEqual([sent(0),sent(1),sent(2)],[0,0,1]);
    assert.equal((await request('voice',{...frame,channel:'party'},a)).status,200);assert.deepEqual([sent(0),sent(1),sent(2)],[0,1,2]);
    for(let i=0;i<12;i++)await request('voice',frame,a);
    assert.equal((await request('voice',frame,a)).status,429);
  }finally{for(const res of listeners)res.emit('close');}
});
