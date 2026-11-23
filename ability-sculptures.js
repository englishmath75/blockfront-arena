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
function prototype(kind){
  if(!cache.has(kind))cache.set(kind,bake((part,strand)=>{
    if(['귀체','포박','추적귀','황혼'].includes(kind))nightmare(kind,part,strand);
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
  if(!held.has(skill))return;
  const root=new T.Group(),prop=prototype(skill).clone();root.add(prop);root.userData.authoredSkill=true;
  const floating=['귀체','포박','추적귀','황혼'].includes(skill);
  root.userData.animate=(time,tag,progress)=>{
    const casting=['throw','place','short throw','cast','fire'].includes(tag);
    prop.visible=!(floating && casting && progress>.43);
    if(floating){prop.rotation.y=.28*Math.sin(time*2.5);prop.position.y=.035+.005*Math.sin(time*4);}
  };
  return root;
}
export function authoredHandling(rig,prop,eye,skill){
  if(!eye || (!prop.userData.authoredSkill && skill!=='잠입 드론'))return;
  const shade=['귀체','추적귀','포박','황혼'].includes(skill);
  const brace=['여진','균열','섬광 폭발','지진 강타'].includes(skill),drone=skill==='잠입 드론';
  const tablet=skill==='유도 일제 사격' || skill==='아마겟돈';
  const wrist=brace && skill==='섬광 폭발' || tablet?'L':'R';
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
  if(shade)prop.scale.setScalar(skill==='추적귀'?.52:skill==='황혼'?.82:.62);
  if(brace)prop.scale.setScalar(.82);
  const restore=()=>{if(framed)joints.forEach((j,i)=>j.quaternion.copy(saved[i]));framed=false;};
  let framed=false;
  return {restore,update(tag,ratio){
    joints.forEach((j,i)=>saved[i].copy(j.quaternion));framed=true;
    const casting=['throw','short throw','fire','cast','place'].includes(tag);
    const release=casting?Math.sin(Math.min(1,ratio)*Math.PI):0;
    const lower=tag==='equip'?.09*(1-T.MathUtils.smoothstep(ratio,0,.65)):0;
    eye.getWorldPosition(at);
    const side=wrist==='L'?-1:1;
    const palmDepth=shade?.54:drone?.48:brace?.52:.45;
    target.copy(at).add(direction.set(palmDepth+release*.13,(shade?-.095:-.15)-lower+.055*release,side*(tablet?.225:.18)));
    other.copy(at).add(direction.set(.45+.052*release,-.19-lower,-side*(tablet?.24:drone?.095:.21)));
    if(wrist==='R'){right(target,rightPole);left(other,leftPole);}else{left(target,leftPole);right(other,rightPole);}
    for(const f of fingers)f.rotateX(shade?-.16:drone?.09:-.04);
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
    prop.visible=!(casting && !brace && !tablet && ratio>.46);
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

