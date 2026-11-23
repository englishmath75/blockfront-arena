import * as T from 'three';
import {reachArm} from './sova-bow.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Dimensions below are in metres. Bake the rigid parts once so a flock or a
// bank of emitters reuses geometry and only submits one draw per material.
const sphere=new T.SphereGeometry(1,24,16), box=new T.BoxGeometry(1,1,1);
const ring=new T.TorusGeometry(1,.07,8,36), spike=new T.ConeGeometry(1,1,8);
const metal=(color,metalness=.25)=>new T.MeshStandardMaterial({color,metalness,roughness:.34});
const light=color=>new T.MeshBasicMaterial({color});
const ink=metal(0x171626),purple=metal(0x352539),red=light(0xff264f),aqua=light(0x62eadb);
const steel=metal(0x555c68,.77),black=metal(0x242733,.65),gold=metal(0xb97622,.7),amber=light(0xffb127);
const lightIris=light(0xffb7d3),lime=light(0x85f53c);
const pearl=metal(0xc5e1ef,.5),blue=light(0x66edff),violet=light(0xca79ff);
const cache=new Map(), matrix=new T.Object3D();
function bake(draw){
  const buckets=new Map();
  function part(shape,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
    matrix.position.set(x,y,z);matrix.scale.set(sx,sy,sz);matrix.rotation.set(rx,ry,rz);matrix.updateMatrix();
    const geo=shape.clone().applyMatrix4(matrix.matrix);
    if(!buckets.has(mat))buckets.set(mat,[]);
    buckets.get(mat).push(geo);
  }
  function strand(mat,points,r){
    const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),16,r,6,false);
    part(geo,mat,0,0,0,1,1,1);geo.dispose();
  }
  draw(part,strand);
  const group=new T.Group();
  for(const [mat,list] of buckets){
    group.add(new T.Mesh(mergeGeometries(list),mat));list.forEach(g=>g.dispose());
  }
  return group;
}
function nightmare(kind,part,strand){
  const hound=kind==='추적귀',eye=kind==='귀체';
  if(kind==='황혼'){
    for(let k=0;k<5;k++){
      const points=Array.from({length:12},(_,i)=>{const a=i*.52+k*1.257,r=.013+i*.007;
        return [Math.cos(a)*r,(i-5)*.011,Math.sin(a)*r];});
      strand(k%2?ink:aqua,points,k%2?.008:.003);
    }
    return;
  }
  if(kind==='포박'){
    part(sphere,ink,0,0,0,.072,.075,.071);
    for(let k=0;k<6;k++){
      const a=k*Math.PI/3,c=Math.cos(a),s=Math.sin(a);
      strand(k%2?purple:red,[[c*.018,-.07,s*.018],[c*.071,-.025,s*.071],[c*.064,.034,s*.058],[c*.029,.081,s*.035]],k%2?.012:.005);
    }
    return;
  }
  part(sphere,ink,0,0,0,.09,hound?.067:.083,hound?.16:.086);
  for(const s of [-1,1]){
    part(sphere,purple,s*.049,.021,-.034,.044,.051,.075,0,0,-s*.55);
    part(sphere,red,s*.046,.028,-.101,.038,.012,.012,0,s*.24,s*.43);
    part(sphere,lightIris,s*.045,.029,-.109,.022,.005,.006,0,s*.19,s*.43);
    strand(ink,[[s*.068,.002,-.016],[s*.105,.052,.024],[s*.086,.104,.05],[s*.065,.122,.09]],.011);
    strand(eye?aqua:red,[[s*.06,-.025,.024],[s*.09,-.041,.063],[s*.055,-.074,.12],[s*.026,-.092,.14]],.003);
    if(hound){
      strand(ink,[[s*.05,-.018,0],[s*.105,-.04,-.02],[s*.112,-.07,-.067],[s*.14,-.067,-.1]],.016);
      strand(red,[[s*.05,.05,.03],[s*.041,.047,.10],[s*.015,.034,.17]],.005);
    }
  }
  if(!hound)part(ring,eye?aqua:purple,0,-.01,.002,.087,.08,.085,.84,.58,0);
  else strand(ink,[[0,.023,.08],[.008,.042,.17],[-.006,.029,.23],[0,.047,.28]],.017);
}
function bracer(kind,part){
  const wide=kind==='지진 강타',flash=kind==='섬광 폭발',z=wide?.042:.031;
  part(sphere,steel,0,0,0,.064,.045,.095);
  for(const s of [-1,1]){
    part(box,black,s*.048,0,-.012,.019,.043,.139,0,s*.09,0);
    part(box,gold,s*z,.029,-.028,.018,.013,.113);
    for(let i=0;i<(wide?4:3);i++)part(box,amber,s*.048,.018,.025-i*.023,.011,.012,.011,0,0,s*.3);
  }
  for(let i=0;i<3;i++){
    part(ring,black,0,.004,.023+i*.016,.059,.043,.05,0,0,.08);
    part(ring,amber,0,.004,.023+i*.016,.060,.044,.052,0,0,.08);
  }
  const n=flash?3:wide?4:2;
  for(let i=0;i<n;i++){
    const x=(i-(n-1)/2)*.024;
    part(sphere,black,x,.002,-.09,.019,.018,.025);
    part(ring,amber,x,.002,-.107,.014,.014,.014);
  }
  if(kind==='균열')part(spike,amber,0,.042,-.052,.012,.042,.012,Math.PI/3);
}
function transmitter(kind,part){
  const charge=kind==='특별 배송',ultimate=kind==='아마겟돈';
  part(sphere,black,0,0,0,charge?.055:.066,.029,charge?.074:.09);
  for(const s of [-1,1]){
    part(box,gold,s*.037,.018,0,.022,.015,.108,0,s*.16);
    part(box,amber,s*.029,.031,-.004,.01,.006,.074,0,s*.14);
  }
  if(charge){part(spike,amber,0,.018,-.046,.038,.077,.034,-Math.PI/2);return;}
  for(let i=0;i<(ultimate?3:2);i++)part(ring,amber,0,.045+i*.011,-.02,.036+i*.009,.036+i*.009,.032,Math.PI/2);
}
function globule(kind,part){
  const tint=kind==='green'?lime:kind==='pink'?violet:kind==='yellow'?amber:blue;
  part(sphere,tint,0,0,0,.087,.081,.078);
  part(sphere,ink,0,0,-.062,.056,.046,.022);
  for(const s of [-1,1]){part(sphere,amber,s*.026,.002,-.08,.011,.018,.006);
    part(sphere,tint,s*.077,-.01,.003,.022,.052,.028,0,0,-s*.36);}
  part(ring,blue,0,-.012,.005,.094,.086,.097,1.28,.25);
}
const leafGreen=metal(0x3d8b4c),vein=light(0xc7ed61),sky=light(0x65e8ff);
function carvedTrinket(kind,part,strand){
  if(kind==='파편/탄' || kind==='무력화/명령'){
    part(sphere,black,0,0,0,.061,.070,.058);
    for(let i=0;i<3;i++)part(ring,i===1?sky:violet,0,(i-1)*.026,0,.059,.059,.059,Math.PI/2);
    for(let i=0;i<5;i++){const a=i*Math.PI*.4;part(box,steel,.053*Math.sin(a),0,.053*Math.cos(a),.023,.087,.012,.13,a,0);}
    return;
  }
  const seeker=kind==='추적자';
  part(sphere,leafGreen,0,0,0,.057,.047,.059);
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7,c=Math.cos(a),s=Math.sin(a);
    part(sphere,i%2?leafGreen:lime,c*.046,.018,s*.046,.018,.053,seeker?.03:.017,s*.6,0,-c*.6);
    strand(vein,[[c*.035,-.02,s*.035],[c*.056,.02,s*.056],[c*.070,.067,s*.07]],.0028);
  }
  part(sphere,seeker?blue:vein,0,.041,0,.026,.027,.026);
}
const instruments=new Set(['M-파동','화음','웨이브폼','요동치는 베이스','폭풍 쇄도','만조','해만','심판','가지치기','강철 정원']);
const ocean=metal(0x176679,.65),lilac=metal(0x7354a4,.43);
function instrument(kind,part,strand){
  if(['폭풍 쇄도','만조','해만','심판'].includes(kind)){
    const broad=kind==='심판'?.079:.058;
    for(let n=0;n<3;n++){
      part(ring,n===1?ocean:gold,0,0,(n-1)*.027,broad,.048,.055);
      for(let j=0;j<6;j++){const a=j*Math.PI/3;
        part(sphere,gold,Math.sin(a)*broad,Math.cos(a)*.047,(n-1)*.027,.017,.012,.021,0,0,-a);}
    }
    const radius=kind==='폭풍 쇄도'?.047:kind==='해만'?.039:.027;
    part(sphere,ocean,0,.067,-.019,radius,radius,radius);part(ring,amber,0,.068,-.019,radius*1.23,radius*1.23,radius,.85,.5);
    for(let i=0;i<3;i++)part(ring,i===1?pearl:aqua,0,.066,-.019,radius*1.09,radius*.99,radius,.65+i*.81,.38+i*.83);
  }else if(kind==='가지치기' || kind==='강철 정원'){
    const count=kind==='가지치기'?5:8;
    for(let i=0;i<count;i++){
      const a=i*2*Math.PI/count,c=Math.cos(a),s=Math.sin(a);
      strand(i%2?steel:pearl,[[0,-.02,0],[.053*c,-.008,.053*s],[.076*c,.025,.076*s],[.046*Math.cos(a+.6),.082,.046*Math.sin(a+.6)]],.009);
      part(spike,i%2?lilac:violet,.059*c,.039,.059*s,.017,.065,.014,-.42*s,0,.42*c);
    }
  }else{
    const radio=kind==='M-파동',map=kind==='웨이브폼',bass=kind==='요동치는 베이스';
    part(sphere,ink,0,0,0,radio?.052:.054,radio?.039:.021,radio?.068:.055);
    part(sphere,lilac,0,.014,-.012,.048,.022,.052);
    for(let n=0;n<(bass?4:2);n++)part(ring,n%2?amber:pearl,0,.034+n*.005,-.012,.023+n*.007,.023+n*.007,.025,Math.PI/2);
    for(let j=0;j<7;j++)part(box,radio?amber:violet,(j-3)*.009,.040,-.032,.004,.004,.007+.013*Math.abs(Math.sin(j*1.24)));
    if(map){part(ring,amber,0,.09,0,.105,.105,.105,.26);part(ring,violet,0,.09,0,.098,.098,.098,.26);}
    if(radio)for(const s of [-1,1])part(box,steel,s*.043,0,0,.015,.042,.08,0,0,s*.22);
  }
}
const focusSets=[
  ['뱀 이빨','독성 연기','독성 장막','독사의 구덩이'],
  ['격류','섬광등','진형 붕괴','일체 정지'],
  ['불길','뜨거운 손','커브볼','역습'],
  ['지름길','목조르기','요격기','진화'],
  ['중력의 샘','신성 파동','성운','우주 장벽'],
  ['자극제 신호기','소이탄','공중 연막','궤도 일격'],
  ['대비책','약화','구슬 보호막','청부 계약'],
  ['활력 회복','간섭','계략','아직 안 죽었어'],
  ['추월 차선','릴레이 볼트','고속 기어','오버드라이브'],
  ['기만','기습','관문 충돌','차원 표류']
];
const focus=Object.fromEntries(focusSets.flatMap((set,g)=>set.map((name,i)=>[name,{g,i}])));
const focusLeft=new Set(['뱀 이빨','독성 장막','독사의 구덩이','격류','섬광등','불길','뜨거운 손','지름길','진화',...focusSets[4],'공중 연막','궤도 일격','약화','청부 계약','계략','기만']);
const shell=metal(0x253a38,.79),petrol=metal(0x12282c,.76),jet=metal(0x141222,.73);
const hot=light(0xff571b),sun=light(0xffdb89),orchid=light(0xf284ff),astrum=light(0xffcb6b);
const arcBand=new T.TorusGeometry(1,.055,8,26,Math.PI*1.38);
const crystal=new T.OctahedronGeometry(1),teal=light(0x34d9cf),riftBlue=light(0x405bf8);
const ionHalo=new T.MeshBasicMaterial({color:0x34e9ff,transparent:true,opacity:.32,depthWrite:false,blending:T.AdditiveBlending});
crystal.setIndex(Array.from({length:crystal.attributes.position.count},(_,i)=>i));
function focusProp(kind,part,strand){
  const {g,i}=focus[kind];
  const loop=(mat,r,y,tilt)=>part(ring,mat,0,y,0,r,r,r,tilt,.2*i);
  if(g===5){
    if(i<2){
      part(i===0?crystal:sphere,steel,0,0,0,.052,.029,.073);
      for(let j=0;j<3;j++){const a=j*2.094;part(box,amber,.032*Math.cos(a),.024,.032*Math.sin(a),.008,.007,.046,0,-a,0);}
    }else{
      part(box,black,0,-.01,0,.105,.028,.14);part(box,steel,0,.004,0,.094,.012,.129);
      part(box,jet,0,.013,0,.087,.006,.118);
      for(const r of [.022,.039,.064])loop(amber,r,.038,Math.PI/2);
      const radar=Array.from({length:8},(_,n)=>[.046*Math.sin(n*1.73),.035,.040*Math.cos(n*2.83)]);strand(astrum,radar,.0014);
      for(let j=0;j<12;j++){const a=j*Math.PI/6;part(box,amber,.063*Math.sin(a),.039,.063*Math.cos(a),.002,.002,.009,0,a,0);}
    }
  }else if(g===6){
    const r=[.042,.054,.035,.052][i],height=i===1?.015:r;
    part(crystal,purple,0,0,0,r,height,r);
    for(let k=0;k<3;k++){
      const radius=r*(1+k*.20),points=Array.from({length:7},(_,j)=>{const a=j*Math.PI/3+k*.16;return [radius*Math.cos(a),.011*(k-1)+Math.sin(a)*height*.45,radius*Math.sin(a)];});
      strand(k===1?lightIris:violet,points,.0025);
    }
    part(crystal,lightIris,0,.006,0,r*.53,height*.87,r*.53);
  }else if(g===7){
    const r=i===1?.048:.026;
    part(sphere,i===1?purple:lightIris,0,0,0,r,r,r);
    for(let j=0;j<4;j++){const a=j*1.57;part(arcBand,j%2?orchid:blue,0,.005,0,r*1.18,r*1.15,r,.48+j*.51,a,j*.7);}
    if(i!==1)for(const side of [-1,1]){
      part(sphere,orchid,side*.032,.031,.002,.032,.008,.019,0,.39*side,side*.77);
      part(sphere,lightIris,side*.023,.007,.020,.022,.005,.012,0,-.55*side,side*.49);
    }
  }else if(g===8){
    for(let j=0;j<4;j++){const s=j*.015-.022;strand(j===1?sun:blue,[[s,-.010,0],[s+.009,.009,-.009],[s-.007,.018,-.019],[s+.003,.035,-.029]],.0026);}
  }else if(g===9){
    const r=i===1?.037:.048;
    part(i===1?crystal:sphere,jet,0,0,0,r,r*(i===1?1.23:.88),r*.86);
    for(let j=0;j<5;j++){
      const path=Array.from({length:9},(_,n)=>{const u=n/8,theta=j*1.256+u*2.6,rad=r*(.45+.62*Math.sin(Math.PI*u));
        return [Math.cos(theta)*rad,(u-.5)*r*1.95,Math.sin(theta)*rad];});
      strand(j%3===0?blue:riftBlue,path,j%3===0?.0024:.006);
    }
    if(i===1)for(const s of [-1,1])part(crystal,blue,s*.026,.018,0,.019,.061,.012,0,0,-s*.39);
  }else if(g===0){
    const can=i===1,r=can?.048:.034;
    part(sphere,shell,0,0,0,r,.042,r*1.48);
    for(let j=0;j<3;j++)part(ring,j===1?lime:steel,0,0,(j-1)*.029,r,r,r);
    for(const s of [-1,1])part(box,lime,s*r*.71,.027,0,.009,.014,.058);
    if(i===2)for(const s of [-1,1])part(box,shell,s*.036,0,-.035,.026,.03,.094,0,s*.13);
  }else if(g===1){
    const r=[.023,.037,.048,.059][i];
    part(i===1?sphere:crystal,i===0?orchid:purple,0,0,0,r,i===1?r*1.35:r,r);
    part(crystal,orchid,0,i===1?.035:.006,0,r*.61,r*.92,r*.61);
    for(let n=0;n<(i===1?2:3);n++){
      const radius=r*(1.2+n*.14);part(arcBand,n%2?violet:lightIris,0,0,0,radius,radius,radius,.75+n*1.08,n*.8,n);
    }
    if(i===0)for(let n=0;n<9;n++)part(sphere,n%3?purple:orchid,.04*Math.cos(n*.70),-.034,.04*Math.sin(n*.70),.011,.011,.011);
  }else if(g===2){
    const r=i===2?.037:i===3?.027:.038;
    part(sphere,i===2?jet:hot,0,0,0,r,r,r);
    for(let n=0;n<(i===2?3:7);n++){
      const a=n*2.39996, c=Math.cos(a),s=Math.sin(a);
      if(i===2)loop(n===1?sun:hot,r*1.26,0,.28+n*1.10);
      else strand(n%3?hot:sun,[[c*r,-.022,s*r],[c*r*1.1,.02,s*r*1.1],[Math.cos(a+.9)*r,.046,Math.sin(a+.9)*r],[c*.015,.069+.023*Math.sin(n*3.4),s*.015]],n%3?.006:.004);
    }
  }else if(g===3){
    const r=[.042,.047,.056,.045][i];
    part(sphere,petrol,0,0,0,r,r*(i===2?1.35:.88),r);
    for(let n=0;n<7;n++){
      const a=n*.898;
      const pts=Array.from({length:7},(_,j)=>{const u=j/6,phi=a+u*(i===1?2.1:1.24),w=r*(.35+.85*Math.sin(u*Math.PI));return [Math.cos(phi)*w,(u-.5)*(i===2?.145:.108),Math.sin(phi)*w]});
      strand(n%2?teal:steel,pts,n%2?.003:.006);
    }
    if(i===2)for(let n=0;n<3;n++){const a=n*2.094;part(spike,petrol,.047*Math.cos(a),-.024,.047*Math.sin(a),.019,.088,.019,0,0,.49);}
  }else{
    part(crystal,astrum,0,0,0,.017,.031,.017);
    loop(gold,.043,0,.39+i*.28);loop(violet,.048,0,1.39);
    for(let n=0;n<5+i;n++){const a=n*2.39996;part(crystal,n%2?astrum:violet,.049*Math.cos(a),.021*Math.sin(a*2),.049*Math.sin(a),.004,.009,.004);}
  }
}
function prototype(kind){
  if(!cache.has(kind))cache.set(kind,bake((part,strand)=>{
    if(focus[kind])focusProp(kind,part,strand);
    else if(instruments.has(kind))instrument(kind,part,strand);
    else if(['재생','추적자','파편/탄','무력화/명령'].includes(kind))carvedTrinket(kind,part,strand);
    else if(['귀체','포박','추적귀','황혼'].includes(kind))nightmare(kind,part,strand);
    else if(['여진','섬광 폭발','균열','지진 강타'].includes(kind))bracer(kind,part);
    else if(['특별 배송','유도 일제 사격','아마겟돈'].includes(kind))transmitter(kind,part);
    else if(kind==='meshNode'){
      part(sphere,blue,0,0,0,.2,.25,.2);
      part(ring,pearl,0,-.04,0,.25,.25,.25,1.25,0,.2);
      part(ring,violet,0,.015,0,.22,.22,.22,-.65,.7);
    }else globule(kind,part);
  }));
  return cache.get(kind);
}
const held=new Set(['귀체','포박','추적귀','황혼','여진','섬광 폭발','균열','지진 강타','특별 배송','유도 일제 사격','아마겟돈']);
export function sculptedHand(skill){
  if(!focus[skill] && !held.has(skill) && !instruments.has(skill) && !['재생','추적자','파편/탄','무력화/명령'].includes(skill))return;
  const root=new T.Group(),prop=prototype(skill).clone();root.add(prop);root.userData.authoredSkill=true;
  const fx=focus[skill];
  if(fx?.g===1)prop.scale.setScalar(fx.i===3?.80:.71);
  const floating=(focus[skill]?.g??0)>0 || ['귀체','포박','추적귀','황혼','추적자','재생'].includes(skill);
  const leds=skill==='M-파동'?prop.children.filter(m=>m.material===amber):[];
  root.userData.animate=(time,tag,progress,heal)=>{
    for(const led of leds)led.material=heal?aqua:amber;
    if(instruments.has(skill) && !['만조','해만','심판'].includes(skill))prop.rotation.y=.10*Math.sin(time*2.8);
    const casting=['throw','place','short throw','cast','fire'].includes(tag);
    prop.visible=!(floating && casting && progress>.43);
    if(floating){const g=focus[skill]?.g;prop.rotation.y=g===2?time*1.9:g===4?time*.92:.28*Math.sin(time*2.5);prop.position.y=.025+.005*Math.sin(time*4);if(g===2)prop.scale.y=1+.07*Math.sin(time*12);}
  };
  return root;
}
export function authoredHandling(rig,prop,eye,skill){
  if(!eye || (!prop.userData.authoredSkill && !['잠입 드론','아크 장미','면도날 덩굴'].includes(skill)))return;
  const shade=['귀체','추적귀','포박','황혼','추적자','재생'].includes(skill);
  const brace=['여진','균열','섬광 폭발','지진 강타'].includes(skill),drone=skill==='잠입 드론';
  const tablet=['유도 일제 사격','아마겟돈','웨이브폼','만조','해만','심판','화음','요동치는 베이스','공중 연막','궤도 일격'].includes(skill);
  const pose=focus[skill];
  const wrist=focusLeft.has(skill) || brace && skill==='섬광 폭발' || tablet || skill==='파편/탄' || skill==='재생'?'L':'R';
  const hand=rig.getObjectByName(wrist+'_Hand'),elbow=rig.getObjectByName(wrist+'_Elbow');
  if(!hand || !elbow)return;
  const joints=[],fingers=[];
  for(const side of ['L','R']){
    for(const n of ['Shoulder','Elbow','Hand']){const joint=rig.getObjectByName(side+'_'+n);if(joint)joints.push(joint);}
    for(const digit of ['Thumb','Index','Middle','Ring','Pinky']){
      const finger=rig.getObjectByName(side+'_'+digit+'2');if(finger){joints.push(finger);fingers.push(finger);}
    }
  }
  const saved=joints.map(()=>new T.Quaternion());
  const left=reachArm(rig,'L'),right=reachArm(rig,'R'),at=new T.Vector3(),target=new T.Vector3(),other=new T.Vector3();
  const leftPole=new T.Vector3(-.45,-.8,-.74),rightPole=new T.Vector3(-.42,-.8,.82);
  const forwardQ=new T.Quaternion(),parentQ=new T.Quaternion(),rot=new T.Euler(),direction=new T.Vector3();
  rig.add(prop);
  if(shade)prop.scale.setScalar(['재생','추적자'].includes(skill)?1:skill==='추적귀'?.52:skill==='황혼'?.82:.62);
  if(brace)prop.scale.setScalar(.82);
  const restore=()=>{if(framed)joints.forEach((j,i)=>j.quaternion.copy(saved[i]));framed=false;};
  let framed=false;
  // Match the knuckle direction in camera space after solving the two elbows.
  const knuckles=pose?.g>=5?['L','R'].map(s=>[s,rig.getObjectByName(s+'_Hand'),rig.getObjectByName(s+'_Middle1')]).filter(([,w,k])=>w && k):[];
  const wristAt=new T.Vector3(),knuckleAt=new T.Vector3(),pointing=new T.Vector3(),wristTurn=new T.Quaternion(),wristQ=new T.Quaternion();
  const tips=pose?.g===8?['R','L'].flatMap(s=>['Index','Middle','Ring','Pinky'].flatMap((digit,j)=>{
    if(pose.i!==0 && s==='L' || pose.i===3 && j>0)return [];
    const bone=rig.getObjectByName(s+'_'+digit+'3');if(!bone)return [];
    const glow=new T.Mesh(sphere,j===1?sun:blue);
    bone.getWorldScale(knuckleAt);glow.scale.set(.008/knuckleAt.x,.009/knuckleAt.y,.014/knuckleAt.z);
    const end=rig.getObjectByName(s+'_'+digit+'4');if(end)glow.position.copy(end.position).multiplyScalar(.53);
    const halo=new T.Mesh(sphere,ionHalo);halo.scale.setScalar(1.65);glow.add(halo);bone.add(glow);return [glow];
  })):[];
  const pointBones=pose?.g===8 && pose.i===3?[1,2].map(n=>[rig.getObjectByName('R_Index'+n),rig.getObjectByName('R_Index'+(n+1))]).filter(([a,b])=>a && b):[];
  for(const [joint] of pointBones)if(!joints.includes(joint)){joints.push(joint);saved.push(new T.Quaternion());}
  return {restore,update(tag,ratio,time=0){
    joints.forEach((j,i)=>saved[i].copy(j.quaternion));framed=true;
    const casting=['throw','short throw','fire','cast','place'].includes(tag);
    const release=casting?Math.sin(Math.min(1,ratio)*Math.PI):0;
    const lower=tag==='equip'?.09*(1-T.MathUtils.smoothstep(ratio,0,.65)):0;
    eye.getWorldPosition(at);
    const side=wrist==='L'?-1:1;
    const wristTool=tablet && instruments.has(skill);
    const palmDepth=shade?.54:drone?.48:brace?.52:wristTool?.52:.45;
    target.copy(at).add(direction.set(palmDepth+release*.13,(shade?-.095:-.15)-lower+.055*release,side*(wristTool?.12:tablet?.225:.18)));
    other.copy(at).add(direction.set(.45+.052*release,-.19-lower,-side*(tablet?.24:drone?.095:.21)));
    if(pose){
      const {g,i}=pose;
      const paired=skill==='일체 정지' || skill==='역습' || skill==='독사의 구덩이';
      const wind=casting?Math.sin(Math.PI*Math.min(1,ratio/.4)):0;
      target.y+=(g===2 && wrist==='L'?.087:g===2?.012:g===1?.041:.023)+release*.04;
      if(g===2 && wrist==='L'){target.z-=side*.055;target.x+=.038;}
      target.x+=release*(i===3?.045:.13)-wind*.065;
      target.z+=side*(paired?-.04:.021);
      other.z+=side*(paired?.061:g===0?.065:0);other.y+=paired?.068:.009;
      other.x+=paired?release*.11:.025;
      if(g===5 && i>=2){target.set(at.x+.43,at.y-.13-lower,at.z-.058);other.set(target.x+.045,target.y+.055+.023*Math.cos(time*4),target.z+.068);}
      if(g===6){target.y+=.044;other.y+=.065;if(i===2){target.z=at.z+.10;other.z=at.z-.10;}if(i===1)target.x+=release*.12;}
      if(g===7){target.y+=.065;other.y+=.038;target.z+=side*.019*Math.sin(time*2.4);other.x+=release*.065;}
      if(g===8){
        const run=i===2?Math.sin(time*12):0;
        target.set(at.x+.47+run*.12+release*.11,at.y-.13-lower+run*.035,at.z+(i===3?.115:.206));
        other.set(at.x+.45-run*.12+release*(i===0?.12:0),at.y-.15-lower-run*.047,at.z-.205);
        for(const tip of tips)tip.visible=true;
      }
      if(g===9){target.y+=.039;other.z+=side*.034;target.x+=release*.081;}
    }
    if(wrist==='R'){right(target,rightPole);left(other,leftPole);}else{left(target,leftPole);right(other,rightPole);}
    for(const [s,w,k] of knuckles){
      const sign=s==='L'?-1:1,lead=s===wrist,group=pose.g,slot=pose.i;
      w.getWorldPosition(wristAt);k.getWorldPosition(knuckleAt).sub(wristAt).normalize();
      pointing.set(.66,lead?.30:.16,-sign*(lead?.54:.36));
      if(group===5)pointing.set(s==='L'?.72:-.08,s==='L'?.24:-.65,s==='L'?.15:-.78);
      if(group===6)pointing.set(.62,slot===2?.47:.24,-sign*(slot===2?.59:.40));
      if(group===7)pointing.set(.45+.54*release,lead?.56:.29,-sign*.50);
      if(group===8)pointing.set(slot===3 && lead?1:.76,slot===3 && lead?.02:slot===0?.55:.13,-sign*(slot===3 && lead?.16:.42));
      if(group===9)pointing.set(.56+.35*release,lead?.48:.13,-sign*(lead?.46:.61));
      wristTurn.setFromUnitVectors(knuckleAt,pointing.normalize());w.getWorldQuaternion(wristQ);w.parent.getWorldQuaternion(parentQ);
      w.quaternion.copy(parentQ.invert().multiply(wristTurn).multiply(wristQ));
    }
    for(const f of fingers){
      let curl=shade?-.16:drone?.09:-.04;
      if(pose){
        const grip=(f.name.startsWith(wrist+'_') || skill==='역습');
        const pinching=['섬광등','커브볼','신성 파동','지름길'].includes(skill);
        curl=grip?(skill==='역습'?.37:pinching && /Thumb|Index/.test(f.name)?.21:/Index|Middle/.test(f.name)?-.15:.12):.065;
        if(pose.g===5 && pose.i>=2 && f.name.startsWith('R_'))curl=/Index/.test(f.name)?-.34:.39;
        if(pose.g===6 && pose.i===2)curl=.49-release*.28;
        if(pose.g===7)curl=/Thumb|Index/.test(f.name)?.05:.24;
        if(pose.g===8)curl=pose.i===3 && f.name.startsWith('R_')?(/Index/.test(f.name)?-.39:.56):pose.i===2?.34:-.11;
        curl-=release*.16;
      }
      f.rotateX(curl);
    }
    for(const [segment,tip] of pointBones){
      segment.getWorldPosition(wristAt);tip.getWorldPosition(knuckleAt).sub(wristAt).normalize();
      pointing.set(1,.03,-.16).normalize();wristTurn.setFromUnitVectors(knuckleAt,pointing);
      segment.getWorldQuaternion(wristQ);segment.parent.getWorldQuaternion(parentQ);
      segment.quaternion.copy(parentQ.invert().multiply(wristTurn).multiply(wristQ));
    }
    hand.getWorldPosition(target);
    if(brace || tablet){
      elbow.getWorldPosition(other);target.lerp(other,brace?.35:.27);
      target.y+=brace?.043:.051;
    }else{
      target.x+=drone?.029:.016;target.y+=drone?.068:shade?.094:.056;
      target.z-=side*.012;
    }
    prop.position.copy(rig.worldToLocal(target));
    rot.set(brace?-.25:-.08,shade?Math.PI/2+.15:brace?-Math.PI/2:drone?Math.PI/2:Math.PI/2+.23,brace?-.18:.07);
    forwardQ.setFromEuler(rot);rig.getWorldQuaternion(parentQ);prop.quaternion.copy(parentQ.invert().multiply(forwardQ));
    prop.visible=!(pose?.g===8 && pose.i!==1) && !(casting && !brace && !tablet && ratio>.46);
  }};
}
export function worldSculpture(name,span){
  const proto=prototype(name),root=proto.clone();
  if(!proto.userData.span){
    const v=new T.Box3().setFromObject(proto).getSize(new T.Vector3());
    proto.userData.span=Math.max(v.x,v.y,v.z);
  }
  root.scale.setScalar(span/proto.userData.span);
  return root;
}

