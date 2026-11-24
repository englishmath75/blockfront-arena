import * as T from 'three';
import {secretCatalog} from './secrets.js';

const box=new T.BoxGeometry(1,1,1), ball=new T.SphereGeometry(.5,12,10);
const disk=new T.CylinderGeometry(.5,.5,1,24), cup=new T.CylinderGeometry(.50,.32,1,18);
const tetra=new T.OctahedronGeometry(.5), wedge=new T.CylinderGeometry(.52,.52,1,3);
const loop=new T.TorusGeometry(.5,.055,8,32);
const color=(hex,metalness=.23)=>new T.MeshStandardMaterial({color:hex,metalness,roughness:.34});
const brass=color(0xeeac49,.58),shell=color(0xffdd9a),ink=color(0x20405b),teal=color(0x59dcca);
const coral=color(0xfb6d65),leaf=color(0x548f71),ice=color(0xacdeff),pink=color(0xdb7ab4);
const gleam=new T.MeshBasicMaterial({color:0xb2fff0});
const prototypes=new Map();
function model(shape){
  if(prototypes.has(shape))return prototypes.get(shape).clone();
  const group=new T.Group();
  const part=(geo,mat,x,y,z,w,h,d,rx=0,ry=0,rz=0)=>{
    const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.set(rx,ry,rz);group.add(mesh);
  };
  function coin(material,r=.29){part(disk,material,0,0,0,r,.055,r,Math.PI/2);}
  function petals(count,mat,r,h){
    for(let i=0;i<count;i++){const a=i*Math.PI*2/count;
      part(tetra,mat,Math.cos(a)*r,h,Math.sin(a)*r,.10,.16,.065,Math.sin(a)*.75,a,-Math.cos(a)*.75);}
  }
  switch(shape){
    case 'pizza':
      part(wedge,brass,0,0,0,.35,.055,.35);part(wedge,shell,0,.029,0,.32,.012,.32);
      for(const [x,z] of [[0,.07],[.058,-.049],[-.045,-.036]])part(disk,coral,x,.04,z,.054,.013,.054);group.rotation.x=.6;break;
    case 'letter':
      part(box,shell,0,0,0,.32,.20,.045);for(const s of [-1,1])part(box,brass,s*.073,.033,.026,.181,.012,.01,0,0,s*.47);
      part(disk,coral,0,-.014,.037,.054,.016,.054,Math.PI/2);break;
    case 'book':
      part(box,shell,0,0,0,.23,.29,.060);for(const s of [-1,1])part(box,ink,0,0,s*.038,.25,.31,.018);
      part(box,brass,-.103,0,.053,.021,.31,.013);part(box,teal,.042,-.13,.054,.038,.092,.012);break;
    case 'tea': case 'cup':
      part(cup,shape==='tea'?pink:brass,0,.018,0,.21,.22,.21);
      if(shape==='tea'){part(disk,shell,0,.133,0,.22,.018,.22);part(box,teal,.035,.18,0,.018,.112,.018,0,0,-.18);}
      else{part(disk,brass,0,-.105,0,.042,.098,.042);part(disk,ink,0,-.159,0,.15,.025,.15);for(const s of [-1,1])part(loop,brass,s*.093,.056,0,.099,.13,.10);}
      break;
    case 'lotus':case 'flower':
      petals(shape==='lotus'?8:5,shape==='lotus'?pink:coral,.078,.022);part(ball,shell,0,.05,0,.08,.06,.08);
      if(shape==='flower'){part(box,leaf,0,-.11,0,.017,.23,.017);part(tetra,leaf,.044,-.11,0,.092,.036,.036,0,0,.45);}
      else petals(6,leaf,.058,-.046);break;
    case 'snow':
      for(let i=0;i<6;i++){const a=i*Math.PI/3;part(box,ice,.072*Math.sin(a),.072*Math.cos(a),0,.018,.16,.026,0,0,-a);
        for(const s of [-1,1])part(box,teal,.09*Math.sin(a)+s*.018*Math.cos(a),.09*Math.cos(a)-s*.018*Math.sin(a),0,.012,.060,.014,0,0,-a-s*.6);}
      part(tetra,gleam,0,0,0,.069,.069,.04);break;
    case 'drop':part(ball,teal,0,-.04,0,.16,.15,.16);part(tetra,ice,0,.041,0,.14,.21,.14);
      part(loop,brass,0,-.136,0,.22,.22,.22,Math.PI/2);break;
    case 'bell':part(cup,brass,0,0,0,.23,.19,.23,Math.PI);part(ball,teal,0,-.098,0,.061,.061,.061);part(loop,shell,0,.118,0,.058,.066,.055);break;
    case 'gear':
      part(loop,brass,0,0,0,.235,.235,.22);for(let i=0;i<8;i++){const a=i*Math.PI/4;part(box,brass,.122*Math.sin(a),.122*Math.cos(a),0,.059,.068,.063,0,0,-a);}
      part(tetra,teal,0,0,0,.11,.11,.07);break;
    case 'compass':
      coin(ink);part(loop,brass,0,0,.031,.27,.27,.27);for(const s of [-1,1])part(tetra,s===1?coral:shell,s*.018,s*.061,.043,.05,.14,.035,0,0,-.28);break;
    case 'target':
      coin(ink);for(const r of [.23,.12])part(loop,teal,0,0,.033,r,r,r);part(ball,brass,0,0,.041,.046,.046,.03);break;
    default:
      coin(brass);part(loop,shell,0,0,.031,.23,.23,.23);
      for(const s of [-1,1])part(box,teal,s*.026,0,.038,.026,.115,.018,0,0,-.19);
  }
  prototypes.set(shape,group);return group.clone();
}
export function drawRelic(d,now,viewer){
  const mesh=d.mesh,item=secretCatalog[d.secretId];
  if(!item)return;
  mesh.visible=!d.claimed && now<d.end;
  if(!mesh.visible)return;
  if(!mesh.userData.relic){
    mesh.material.visible=false;mesh.scale.setScalar(1);
    const prop=model(item.shape),halo=new T.Mesh(loop,brass),spark=new T.Mesh(tetra,gleam);
    halo.rotation.x=-Math.PI/2;halo.scale.setScalar(.37);halo.position.y=.022;
    spark.scale.set(.023,.048,.023);mesh.add(prop,halo,spark);mesh.userData.relic={prop,spark};
  }
  mesh.position.set(d.x,d.y,d.z);
  const {prop,spark}=mesh.userData.relic;
  prop.position.y=.34+.032*Math.sin(now*2.3);prop.rotation.y=now*.67;
  spark.visible=Math.hypot(viewer.x-d.x,viewer.z-d.z)<10;
  spark.position.set(.15*Math.cos(now*1.8),.45+.09*Math.sin(now*2),.14*Math.sin(now*1.8));
}
export function secretChime(audio,volume,discovery=false){
  if(audio?.state!=='running' || volume<=0)return;
  const time=audio.currentTime;
  const notes=discovery?[523.25,659.25,880,1046.5]:[659.25,880];
  for(const [i,freq] of notes.entries()){
    const start=time+i*.085,osc=audio.createOscillator(),gain=audio.createGain();
    osc.type='sine';osc.frequency.value=freq;
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*.105),start+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,start+.39);
    osc.connect(gain).connect(audio.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    osc.start(start);osc.stop(start+.40);
  }
}
