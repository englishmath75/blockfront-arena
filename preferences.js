import {parseCrosshair} from './crosshair.js';

export const profileLimit=15;
export const palette=['#ffffff','#00ff00','#80ff00','#dfff00','#ffff00','#00ffff','#ff00ff','#ff0000'];
export const templates=[
  ['정밀 십자','0;P;c;5;h;0;0l;4;0o;2;0t;1;0a;1;0m;0;0f;0;1b;0'],
  ['중앙 도트','0;P;c;4;h;1;d;1;z;3;a;1;0b;0;1b;0'],
  ['클래식 그린','0;P;c;1;h;1;0l;6;0o;3;0m;0;0f;0;1b;0'],
  ['분홍 이중선','0;P;c;8;u;FFA8D2FF;h;0;0l;3;0t;1;0o;2;0a;1;0m;0;0f;0;1b;1;1l;2;1o;7;1t;1;1a;0.6;1m;0;1f;1'],
  ['가로 정렬','0;P;c;4;h;0;0l;8;0g;1;0v;3;0o;2;0t;1;0a;1;0m;0;0f;0;1b;0'],
  ['열린 사각','0;P;c;0;h;0;0l;2;0t;4;0o;3;0a;1;0m;0;0f;0;1b;0'],
];
export const bindings={KeyW:'앞으로',KeyS:'뒤로',KeyA:'왼쪽',KeyD:'오른쪽',ShiftLeft:'걷기',ControlLeft:'앉기',Space:'점프',KeyF:'상호작용',KeyR:'재장전',KeyB:'상점',KeyY:'무기 살펴보기',KeyG:'버리기',Digit1:'주 무기',Digit2:'보조 무기',Digit3:'근접 무기',Digit4:'스파이크',KeyC:'스킬 1',KeyQ:'스킬 2',KeyE:'고유 스킬',KeyX:'궁극기',Tab:'전광판',KeyV:'팀 음성',KeyU:'파티 음성'};
export const keyName=k=>({ShiftLeft:'Shift',ControlLeft:'Ctrl',Space:'Space',Tab:'Tab'})[k]??k.replace(/^(Key|Digit)/,'');
const physical=key=>({ShiftRight:'ShiftLeft',ControlRight:'ControlLeft'})[key]??key;
const validKey=k=>/^(Key[A-Z]|Digit[0-9]|Tab|Space|ShiftLeft|ControlLeft)$/.test(k);
export function bindKey(s,action,key){
  key=physical(key);
  if(!Object.hasOwn(bindings,action)||!validKey(key))return false;
  const old=s.keys[action],used=Object.keys(s.keys).find(a=>s.keys[a]===key);
  if(used)s.keys[used]=old;
  s.keys[action]=key;return true;
}
export function inputCode(s,code){
  const key=physical(code),assigned=Object.keys(s.keys).find(k=>s.keys[k]===key);
  return assigned??(Object.hasOwn(bindings,key)?'':code);
}
export const defaults={sens:1,adsSens:1,invert:false,volume:.7,effects:1,interfaceVolume:1,dialogue:1,voiceOutput:.8,micGain:1,teamVoice:true,partyVoice:false,micDevice:'',voiceDevice:'',
  quality:'auto',antialias:'auto',vignette:false,texture:'linear',anisotropy:4,fpsCap:0,showFps:false,showFrame:false,dynamic:true};
export function defaultCode(color='#80ffcf'){
  const hex=/^#[0-9a-f]{6}$/i.test(color)?color.slice(1).toUpperCase():'80FFCF';
  return '0;P;c;8;u;'+hex+'FF;0l;7;0t;2;0o;3;0a;1;0m;1;0f;1;1b;0;S;c;7;d;1;s;2;o;1';
}
export function serializeProfile(p){
  const tokens=['0'];
  for(const key of ['global','P','A','S']){
    if(key!=='global' && (key==='P'||Object.keys(p[key]).length))tokens.push(key);
    for(const [k,v] of Object.entries(p[key]))tokens.push(k,k==='u'?v.slice(1).toUpperCase():String(v));
  }
  return tokens.join(';');
}
export function normalizePreferences(raw={}){
  if(!raw || typeof raw!=='object')raw={};
  const s={...defaults,keys:Object.fromEntries(Object.keys(bindings).map(k=>[k,k]))};
  for(const k of Object.keys(defaults))if(typeof raw[k]===typeof defaults[k])s[k]=raw[k];
  for(const [k,min,max] of [['sens',.1,3],['adsSens',.1,3],...['volume','effects','interfaceVolume','dialogue','voiceOutput','micGain'].map(k=>[k,0,1])]){
    s[k]=Number.isFinite(s[k])?Math.max(min,Math.min(max,s[k])):defaults[k];
  }
  if(!['auto','low','medium','high'].includes(s.quality))s.quality='auto';
  if(!['auto','0','2','4'].includes(s.antialias))s.antialias='auto';
  if(!['linear','nearest'].includes(s.texture))s.texture='linear';
  if(![1,2,4,8,16].includes(s.anisotropy))s.anisotropy=4;
  if(![0,30,60,90,120,144,240].includes(s.fpsCap))s.fpsCap=0;
  for(const [a,k] of Object.entries(raw.keys??{}))if(typeof k==='string')bindKey(s,a,k);
  s.profiles=(Array.isArray(raw.profiles)?raw.profiles:[]).filter(p=>p && typeof p.name==='string'&&parseCrosshair(p.code)).slice(0,profileLimit).map(p=>({name:p.name.trim().slice(0,32)||'내 조준점',code:p.code}));
  if(!s.profiles.length)s.profiles.push({name:'내 조준점',code:parseCrosshair(raw.crosshairCode)?raw.crosshairCode:defaultCode(raw.color)});
  s.selected=Number.isInteger(raw.selected)&&s.profiles[raw.selected]?raw.selected:0;
  return s;
}
export function addProfile(s,name,code){
  if(s.profiles.length>=profileLimit || !parseCrosshair(code))return false;
  s.profiles.push({name:String(name).trim().slice(0,32)||'새 프로필',code:code.trim()});s.selected=s.profiles.length-1;return true;
}
export function removeProfile(s){
  if(s.profiles.length<2)return false;
  s.profiles.splice(s.selected,1);s.selected=Math.min(s.selected,s.profiles.length-1);return true;
}
export function profileValue(s,section,key,value){
  const row=s.profiles[s.selected],p=parseCrosshair(row.code);
  if(section==='A' && (p.global.a===0 || !Object.keys(p.A).length))p.A={...p.P};
  if(section==='A')p.global.a=1;
  if(key==='color'){p[section].c=8;p[section].u=value+'FF';}
  else p[section][key]=value;
  row.code=serializeProfile(p);
}
export const mixVolume=(s,channel)=>s.volume*s[channel];
