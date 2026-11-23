import * as T from 'three';
import { reachArm } from './sova-bow.js';

const smooth = (a,b,t) => T.MathUtils.smoothstep(t,a,b);
const pulse = (a,b,c,d,t) => smooth(a,b,t)*(1-smooth(c,d,t));

// A machined socket, split housing and loose power cell share the receiver's
// coordinates. The cell travels in 3D and is occluded by the agent's fingers.
export function installChaosCore(root, mount, skin, box, muzzleLeft, aspect) {
  if (skin?.id !== '522a264e-4ca7-adb0-6cf1-28b2ef938727') return;
  const length=box.max.x-box.min.x, center=box.getCenter(new T.Vector3());
  const assembly=new T.Group(), chamber=new T.Group();
  assembly.applyMatrix4(mount.matrixWorld.clone().invert().multiply(root.matrixWorld));
  mount.add(assembly); assembly.add(chamber);
  chamber.name='ChaosCoreSocket';
  chamber.position.set(center.x+length*(muzzleLeft?.055:-.055),center.y+aspect*length*.405,center.z);
  chamber.scale.setScalar(length);
  const variant=skin.variants?.find(v=>v.id===skin.variant)?.name??'';
  const color=variant.includes('녹색')?0x55ff84:variant.includes('흰색')?0xff653c:variant.includes('파란색')?0x4feeff:0x9261ff;
  const metal=(color,roughness,metalness)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const gunmetal=metal(0x232334,.34,.6), brass=metal(0xa98749,.31,.63), cell=metal(0x392652,.26,.44);
  const ion=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.2,metalness:.32,roughness:.23});
  const flare=new T.MeshBasicMaterial({color:0x93eaff,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending});
  const geometries=new Set();
  function part(parent,geo,material,x=0,y=0,z=0) {
    geometries.add(geo);const mesh=new T.Mesh(geo,material);parent.add(mesh);mesh.position.set(x,y,z);return mesh;
  }
  const axial=(radius,width,material,y)=>{
    const band=part(chamber,new T.TorusGeometry(radius,width,8,32),material,0,y);band.rotation.x=Math.PI/2;return band;
  };
  part(chamber,new T.CylinderGeometry(.047,.054,.022,24),gunmetal,0,-.013);
  axial(.044,.006,brass,.001);axial(.034,.0026,skin.visualOn?ion:gunmetal,.003);
  const guards=[];
  for(const sign of [-1,1]){
    const hinge=new T.Group();chamber.add(hinge);hinge.position.z=sign*.044;guards.push(hinge);
    const rail=part(hinge,new T.BoxGeometry(.114,.021,.013),gunmetal,0,.004);rail.rotation.z=.09;
    const trim=part(hinge,new T.CylinderGeometry(.0043,.0043,.115,10),brass,0,.016);trim.rotation.z=Math.PI/2;
    for(let i=0;i<4;i++)part(hinge,new T.BoxGeometry(.008,.011,.004),brass,(i-1.5)*.021,-.008,sign*.007);
  }
  const orb=new T.Group();orb.name='ChaosPowerCell';chamber.add(orb);
  const time={value:0}, plasma={value:new T.Color(color)};
  cell.onBeforeCompile=shader=>{
    shader.uniforms.coreTime=time;shader.uniforms.coreColor=plasma;
    shader.vertexShader='varying vec3 corePos;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ncorePos=position/.031;');
    shader.fragmentShader='uniform float coreTime;uniform vec3 coreColor;varying vec3 corePos;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      vec3 p=normalize(corePos);float angle=atan(p.z,p.x)+coreTime*.69;
      float stream=sin(angle*3.+p.y*8.+sin(angle*2.+p.y*5.-coreTime)*1.4);
      float vein=pow(max(0.,1.-abs(stream)),6.);
      float rim=pow(1.-abs(dot(normalize(vViewPosition),normal)),2.);
      totalEmissiveRadiance+=coreColor*(.11+vein*1.7+rim*.4)+vec3(.17,.63,.97)*vein*vein;`);
  };
  cell.customProgramCacheKey=()=>'chaos-plasma-1';
  const globe=part(orb,new T.SphereGeometry(.031,24,18),skin.visualOn?cell:gunmetal);
  for(let j=0;j<3;j++){
    const band=part(globe,new T.TorusGeometry(.031,.0011,6,40),skin.visualOn?ion:brass);
    band.rotation.set(.53+j*.90,j*1.2,.28);
  }
  const shards=new T.Group();chamber.add(shards);
  const chip=new T.OctahedronGeometry(.006);
  for(let i=0;i<14;i++)part(shards,chip,i%3===0?brass:ion);
  const arcs=new T.Group();chamber.add(arcs);
  for(let i=0;i<3;i++){
    const ring=part(arcs,new T.TorusGeometry(.037+i*.005,.0016,5,26,Math.PI*1.5),flare);
    ring.rotation.set(.65+i*.86,i*.75,.36);
  }
  const charged=skin.visualOn;
  const incomingTint=new T.Color(color),seatedTint=new T.Color(variant?color:0x4bc9ff);
  function update(tag,t,now){
    time.value=now;
    const reload=tag==='reload', inspect=tag==='inspect';
    const settled=reload?smooth(.58,.75,t):1;
    plasma.value.copy(incomingTint).lerp(seatedTint,settled);
    ion.color.copy(plasma.value);ion.emissive.copy(plasma.value);
    const opening=reload?pulse(.01,.10,.71,.92,t):inspect?pulse(.08,.26,.76,.95,t):0;
    guards.forEach((g,i)=>g.rotation.x=(i?1:-1)*opening*.79);
    orb.visible=!reload || t<.16 || t>.345;
    let rise=0, side=0;
    if(reload && t<.16){rise=.12*smooth(.035,.16,t);orb.scale.setScalar(1-smooth(.10,.16,t));}
    else if(reload && t<.57){
      const descent=1-smooth(.408,.495,t);
      rise=.19*descent;side=.085*descent;
      orb.scale.setScalar(smooth(.345,.396,t));
    }else{orb.scale.setScalar(1);if(inspect)rise=.09*opening+.005*opening*Math.sin(now*4.3);}
    orb.position.set(0,.011+rise-settled*.014*(inspect?1-opening:1),side);
    globe.rotation.set(.13*now,now*(inspect?2.3:1.1),.27);
    const spray=reload && t>.055 && t<.34, age=(t-.055)/.285;
    shards.visible=spray;
    if(spray)shards.children.forEach((s,i)=>{
      const a=i*2.4,d=(.025+i%4*.012)*age;
      s.position.set(Math.cos(a)*d,.012+(.13+.016*(i%5))*age-.065*age*age,Math.sin(a)*d);
      s.scale.setScalar((i%3+1)*.47*(1-age));s.rotation.set(a+age*4,age*5,a);
    });
    const surge=reload?pulse(.68,.74,.84,.95,t):inspect?opening:tag==='equip'?pulse(.1,.32,.55,.93,t):0;
    arcs.visible=charged && surge>.025;
    if(arcs.visible){arcs.position.copy(orb.position);arcs.rotation.y=now*5;arcs.scale.setScalar(.75+surge*.4);flare.opacity=surge*.57;}
    ion.emissiveIntensity=charged ? .65+surge*2.5 : 0;
  }
  update('idle',0,0);
  root.userData.chaosCore={chamber,orb,update,enabled:skin.motionOn};
  return ()=>{
    delete root.userData.chaosCore;assembly.removeFromParent();
    for(const geometry of geometries)geometry.dispose();
    for(const mat of [gunmetal,brass,cell,ion,flare])mat.dispose();
  };
}

export function coreHandling(rig,weapon) {
  const core=weapon.userData.chaosCore;
  if(!core?.enabled)return;
  const right=rig.getObjectByName('R_Hand'),left=rig.getObjectByName('L_Hand');
  if(!right || !left)return;
  const arms=[left,right],reaches=[reachArm(rig,'L',true),reachArm(rig,'R')];
  const fingers=['Thumb','Index','Middle','Ring','Pinky'].map(n=>rig.getObjectByName('R_'+n+'2'));
  const joints=['L','R'].flatMap(s=>['Shoulder','Elbow','Hand'].map(n=>rig.getObjectByName(s+'_'+n))).concat(fingers).filter(Boolean);
  const rest=joints.map(()=>new T.Quaternion()),grips=arms.map(()=>new T.Vector3()),turns=arms.map(()=>new T.Quaternion());
  const mount=weapon.parent, pos=new T.Vector3(), rot=new T.Quaternion(), scale=new T.Vector3();
  const rightPole=new T.Vector3();
  const pivot=new T.Vector3(), off=new T.Vector3(), target=new T.Vector3(),point=new T.Vector3(),handQ=new T.Quaternion();
  const change=new T.Quaternion(),angles=new T.Euler(),parentQ=new T.Quaternion(),worldQ=new T.Quaternion();
  let active=false;
  return {
    restore(){
      if(!active)return;
      mount.add(weapon);weapon.position.copy(pos);weapon.quaternion.copy(rot);weapon.scale.copy(scale);
      joints.forEach((j,i)=>j.quaternion.copy(rest[i]));active=false;
    },
    update(tag,t,now){
      core.update(tag,t,now);
      if(!['reload','inspect','equip'].includes(tag))return;
      active=true;pos.copy(weapon.position);rot.copy(weapon.quaternion);scale.copy(weapon.scale);
      joints.forEach((j,i)=>rest[i].copy(j.quaternion));
      arms.forEach((hand,i)=>{hand.getWorldPosition(grips[i]);hand.getWorldQuaternion(turns[i]);});
      pivot.copy(grips[1]);rig.attach(weapon);
      const reload=tag==='reload',equip=tag==='equip';
      const opening=equip?1-smooth(.48,1,t):reload?pulse(0,.12,.87,1,t):pulse(0,.23,.78,1,t);
      const latch=equip?pulse(.08,.23,.53,.79,t):reload?pulse(.52,.67,.82,.98,t):0;
      const pitch=equip?.95*opening:opening*(reload?.11:.12)+.45*latch;
      change.setFromEuler(angles.set(opening*(reload?-.23:-.49)-.22*latch,opening*(reload?.15:equip?.27:.63),pitch));
      off.set(-.048*opening,equip?-.16*(1-smooth(0,.27,t)):-.005*opening,.006*opening);
      weapon.getWorldQuaternion(worldQ);weapon.getWorldPosition(point).sub(pivot).applyQuaternion(change).add(pivot).add(off);
      weapon.position.copy(rig.worldToLocal(point));rig.getWorldQuaternion(parentQ);
      weapon.quaternion.copy(parentQ.invert().multiply(change).multiply(worldQ));
      const carry=reload?pulse(.26,.385,.51,.64,t):0;
      if(reload && t>=.345 && t<.57){
        const descent=1-smooth(.408,.495,t);
        core.chamber.getWorldPosition(point);
        point.x-=.065*descent;point.y+=.014+.18*descent;point.z+=.21*descent;
        core.orb.position.copy(core.chamber.worldToLocal(point));
      }
      arms.forEach((hand,i)=>{
        target.copy(grips[i]).sub(pivot).applyQuaternion(change).add(pivot).add(off);
        if(i===1 && carry){
          core.orb.getWorldPosition(point);point.x-=.035;point.y+=.028;point.z+=.044;target.lerp(point,carry);
        } else if(i===0 && latch){
          core.chamber.getWorldPosition(point);point.x+=.03;point.y-=.047;point.z-=.029;target.lerp(point,latch*.62);
        }
        if(i===1 && carry){
          rightPole.set(-.18,-.85+1.17*carry,.7+.95*carry);
          reaches[i](target,rightPole);
        } else reaches[i](target);
        hand.parent.getWorldQuaternion(parentQ);
        handQ.copy(change).multiply(turns[i]);hand.quaternion.copy(parentQ.invert().multiply(handQ));
        if(i===1 && carry){hand.rotateX(-.61*carry);hand.rotateZ(.32*carry);}
      });
      fingers.forEach((f,i)=>{if(f)f.rotateX((i===0?.16:-.20)*carry);});
    }
  };
}
