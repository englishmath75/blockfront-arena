import * as T from 'three';
import { handlingTracks, sampleHandling } from './handling-motion.js';
import { reachArm } from './sova-bow.js';
import wrists from './support-wrists.json' with { type:'json' };
import { motionAction } from './weapon-motion.js';
import { recordedAction } from './recorded-weapon.js';
import handlingCues from './handling-cues.json' with {type:'json'};
import knifeFamilies from './melee-families.json' with {type:'json'};

const plateTravel = {singularityep9:.037,araxys:.024,reaver:.012,elderflame:.021,rogue:.005,champions2023:.004};
// These model-only releases also have individually authored handling events.
const modelEvents={
  '43538e40-48bf-0262-d4a7-bbba3c56df77':['inspect'],'a74f77fd-4e69-f16e-b1eb-ceb5198f423d':['inspect'],
  'a07941d7-42dc-5083-97a1-af850ca6fa26':['inspect'],'464887be-4a07-690e-2d02-e187c8bbe8d5':['inspect'],
  '95eb82e2-4859-5564-7b3b-ddbf2fb8088d':['inspect','reload'],
};
export function usesStandardAction(gun,skin,action){
  if(!skin || gun==='melee' || skin.levels?.some(type=>type!=='Model') || modelEvents[skin.id]?.includes(action))return false;
  return !motionAction(skin,action) && !recordedAction(skin,action);
}
export function skinArticulation(rig, weapon, gun, skin, actions, baseline) {
  const tracks = handlingTracks(gun,skin);
  if (!tracks) return;
  // Compare the hand clips independently. A bespoke gun mesh may still use
  // the stock inspect, even when its reload has an entirely separate rig clip.
  for(const name of Object.keys(actions)){
    const clip=actions[name],base=baseline[name];
    if(clip?.arms && (clip.arms!==base?.arms || clip.armFile!==base?.armFile))tracks[name]=undefined;
  }
  for(const name of ['inspect','reload']){
    if(usesStandardAction(gun,skin,name))tracks[name]=undefined;
  }
  const hand=rig.getObjectByName('R_Hand');
  const plateOffset=skin.visualOn ? plateTravel[skin.banner]??0 : 0;
  if(!hand || (!Object.values(tracks).some(Array.isArray) && !plateOffset && !tracks.guard))return;
  const joints=[], assembly=[], plates=[];
  const bind=(name,array,extra={})=>{
    const bone=rig.getObjectByName(name);
    if(bone) array.push({bone,rest:new T.Quaternion(),position:new T.Vector3(),...extra});
  };
  for(const name of ['L_Clavicle','R_Clavicle','MasterWeapon']) bind(name,assembly);
  bind('L_Hand',joints,{wrist:true});
  for (const side of ['L','R']) {
    for(const [digit,name] of ['Thumb','Index','Middle','Ring','Pinky'].entries()) {
      for(let segment=1;segment<=2;segment++) bind(side+'_'+name+segment,joints,{left:side==='L',digit,segment});
    }
  }
  weapon.traverse(o=>{if(o.userData.plate)plates.push(o)});
  const pivot=new T.Vector3(), move=new T.Vector3(), pos=new T.Vector3(), scale=new T.Vector3();
  const worldTurn=new T.Quaternion(), parentTurn=new T.Quaternion(), localTurn=new T.Quaternion();
  const angles=new T.Euler(), sample=new Float32Array(4);
  const all=[...assembly,...joints];
  const wristFrames=wrists[skin.id],support=rig.getObjectByName('L_Hand'),eye=rig.getObjectByName('Camera');
  const reach=wristFrames && reachArm(rig,'L',true);
  const target=new T.Vector3(), delta=new T.Vector3(), camera=new T.Vector3(), orientation=new T.Quaternion();
  if(reach){bind('L_Shoulder',all);bind('L_Elbow',all)}
  const family=gun==='melee' && knifeFamilies[skin.id];
  const pin=family==='karambit'?rig.getObjectByName('R_Index2'):hand;
  const bladePosition=weapon.position.clone(),bladeRotation=weapon.quaternion.clone();
  const bladeAxis=new T.Vector3(),pinWorld=new T.Vector3();
  let pivoted=false,modified=false;
  return {
    restore() {
      if(pivoted){weapon.position.copy(bladePosition);weapon.quaternion.copy(bladeRotation);pivoted=false;}
      if(!modified)return;
      for(const j of all){j.bone.quaternion.copy(j.rest); j.bone.position.copy(j.position)}
      modified=false;
    },
    update(tag,t,age) {
      const keys=tracks[tag];
      let spread=0;
      const moving=Array.isArray(keys) && t>0 && t<1;
      if(moving || tracks.guard){
        for(const j of all){j.rest.copy(j.bone.quaternion);j.position.copy(j.bone.position)}
        modified=true;
        if(moving)sampleHandling(keys,t,sample);else sample.fill(0);
        sample[0]+=tracks.guard??0;
        let [roll,lift,wrist,grip]=sample;
        const actionName=tag==='alt attack'?'heavy':tag.startsWith('attack ')?'light':tag;
        const sounds=skin.motionOn && handlingCues[skin.id]?.[actionName];
        if(moving && sounds)for(const [time,phase] of sounds){
          const proximity=1-Math.min(1,Math.abs(t-time)/.07);
          const pulse=proximity*proximity*Math.min(1,t*14,(1-t)*14);
          if(phase==='seat'){grip+=.38*pulse;lift+=.012*pulse;}
          if(phase==='release'){grip-=.26*pulse;wrist-=.10*pulse;}
          if(phase==='bolt')wrist+=.21*pulse;
          if(phase==='charge')grip-=.30*pulse;
          if(phase==='turn')roll+=.12*pulse;
        }
        const inspecting=tag==='inspect';
        hand.getWorldPosition(pivot);
        const reachScale=gun==='melee'?1:.68;
        move.set(-lift*.3,lift,lift*(tracks.balance-.26)).multiplyScalar(reachScale);
        let recordedRoll=0;
        const capture=tracks.capture[tag];
        if(capture){
          const at=t*(capture.length-1),i=Math.floor(at),a=capture[i],b=capture[i+1]??a,mix=at-i;
          move.z+=(a[0]+(b[0]-a[0])*mix)*.34;
          move.y-=(a[1]+(b[1]-a[1])*mix)*.23;
          recordedRoll=(a[2]+(b[2]-a[2])*mix)*.48;
        }
        worldTurn.setFromEuler(angles.set((roll+recordedRoll)*reachScale,lift*(tracks.balance-.29),wrist*.18));
        // Rotate the two shoulder chains and the independent weapon socket
        // about the same grip so the trigger hand stays on the handle.
        for(const {bone} of assembly){
          const parent=bone.parent;
          parent.getWorldQuaternion(parentTurn);
          localTurn.copy(parentTurn).invert().multiply(worldTurn).multiply(parentTurn);
          parent.getWorldScale(scale);
          pos.copy(pivot);parent.worldToLocal(pos);
          bone.position.sub(pos).applyQuaternion(localTurn).add(pos);
          bone.position.add(pos.copy(move).applyQuaternion(parentTurn.invert()).divide(scale));
          bone.quaternion.premultiply(localTurn);
        }
        for(const {bone,wrist:palm,left,digit,segment} of joints){
          if(palm){bone.rotateZ(wrist*(inspecting?.57:.31));bone.rotateX(-lift*.45);continue}
          const pressure=grip*(left?1:.18);
          const trace=left && digit===1 && tracks.point && inspecting;
          const bend=trace ? -Math.abs(wrist)*.82 : pressure*(digit===0?.38:.53+digit*.10);
          bone.rotateX(bend*(segment===2?.76:.94));
          if(left && gun==='vandal' && skin.banner==='rogue' && tag==='equip'){
            const release=Math.exp(-Math.pow((t-.42)/.13,2)),pinch=Math.exp(-Math.pow((t-.66)/.15,2));
            bone.rotateX(release*[-.15,-.44,-.49,-.46,-.39][digit]+pinch*[.26,-.49,.23,.38,.45][digit]);
          }
          if(segment===1)bone.rotateZ(digit===0?-pressure*.34:(digit-2.1)*.145*(wrist-pressure));
        }
        if(inspecting && moving && pin && skin.motionOn && (family==='karambit'||family==='butterfly')){
          bladePosition.copy(weapon.position);bladeRotation.copy(weapon.quaternion);pivoted=true;
          const phase=T.MathUtils.smoothstep(t,.15,.47);
          const back=family==='butterfly'?T.MathUtils.smoothstep(t,.54,.80):0;
          pin.getWorldPosition(pinWorld);weapon.parent.worldToLocal(pinWorld);
          pin.getWorldQuaternion(orientation);weapon.parent.getWorldQuaternion(parentTurn);
          bladeAxis.set(0,0,1).applyQuaternion(orientation).applyQuaternion(parentTurn.invert()).normalize();
          localTurn.setFromAxisAngle(bladeAxis,(phase-back)*Math.PI*2);
          weapon.position.sub(pinWorld).applyQuaternion(localTurn).add(pinWorld);
          weapon.quaternion.premultiply(localTurn);
        }
        const frames=wristFrames?.[tag];
        if(frames && eye && support && (motionAction(skin,tag) || recordedAction(skin,tag) || (skin.banner==='rogue' && tag==='equip'))){
          const time=t*(frames.length-1),i=Math.floor(time),a=frames[i],b=frames[Math.min(i+1,frames.length-1)];
          if(a || b){
            const l=a??b,r=b??a,mix=time-i;
            const x=l[0]+(r[0]-l[0])*mix,y=l[1]+(r[1]-l[1])*mix;
            support.getWorldPosition(target);eye.getWorldPosition(camera);
            const halfHeight=Math.max(.12,target.x-camera.x)*Math.tan(24*Math.PI/180);
            delta.set(0,camera.y+(1-2*y)*halfHeight-target.y,camera.z+(2*x-1)*halfHeight*16/9-target.z);
            delta.clampLength(0,.075).multiplyScalar(Math.sin(t*Math.PI)*(!a?mix:!b?1-mix:1));
            support.getWorldQuaternion(orientation);
            reach(target.add(delta));
            support.parent.getWorldQuaternion(parentTurn);
            support.quaternion.copy(parentTurn.invert().multiply(orientation));
          }
        }
        spread=Math.abs(wrist)+Math.abs(grip)*.4;
      }
      for(const plate of plates){
        const fire=age>=0 && age<.13 ? Math.sin(age/.13*Math.PI)*.28 : 0;
        plate.position.copy(plate.userData.recoilAxis).multiplyScalar(plateOffset*(spread+fire));
      }
    },
  };
}
