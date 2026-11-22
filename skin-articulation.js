import * as T from 'three';
import { handlingTracks, sampleHandling } from './handling-motion.js';
import { reachArm } from './sova-bow.js';
import wrists from './support-wrists.json' with { type:'json' };
import { motionAction } from './weapon-motion.js';
import { recordedAction } from './recorded-weapon.js';

const plateTravel = {singularityep9:.037,araxys:.024,reaver:.012,elderflame:.021,rogue:.005,champions2023:.004};
export function skinArticulation(rig, weapon, gun, skin, actions, baseline) {
  const tracks = handlingTracks(gun,skin);
  if (!tracks) return;
  // Compare the hand clips independently. A bespoke gun mesh may still use
  // the stock inspect, even when its reload has an entirely separate rig clip.
  for (const name of ['inspect','reload']) {
    if (actions[name]?.arms && actions[name].arms !== baseline[name]?.arms) tracks[name]=undefined;
  }
  const hand=rig.getObjectByName('R_Hand');
  const plateOffset=skin.visualOn ? plateTravel[skin.banner]??0 : 0;
  if (!hand || (!tracks.inspect && !tracks.reload && !plateOffset)) return;
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
  let modified=false;
  return {
    restore() {
      if(!modified)return;
      for(const j of all){j.bone.quaternion.copy(j.rest); j.bone.position.copy(j.position)}
      modified=false;
    },
    update(tag,t,age) {
      const keys=tracks[tag];
      let spread=0;
      if(Array.isArray(keys) && t>0 && t<1){
        for(const j of all){j.rest.copy(j.bone.quaternion);j.position.copy(j.bone.position)}
        modified=true;
        sampleHandling(keys,t,sample);
        const [roll,lift,wrist,grip]=sample;
        const inspecting=tag==='inspect';
        hand.getWorldPosition(pivot);
        move.set(-lift*.3,lift,lift*(tracks.balance-.26));
        let recordedRoll=0;
        const capture=tracks.capture[tag];
        if(capture){
          const at=t*(capture.length-1),i=Math.floor(at),a=capture[i],b=capture[i+1]??a,mix=at-i;
          move.z+=(a[0]+(b[0]-a[0])*mix)*.34;
          move.y-=(a[1]+(b[1]-a[1])*mix)*.23;
          recordedRoll=(a[2]+(b[2]-a[2])*mix)*.48;
        }
        worldTurn.setFromEuler(angles.set(roll+recordedRoll,lift*(tracks.balance-.29),wrist*.18));
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
          if(segment===1)bone.rotateZ(digit===0?-pressure*.34:(digit-2.1)*.145*(wrist-pressure));
        }
        const frames=wristFrames?.[tag];
        if(frames && eye && support && (motionAction(skin,tag) || recordedAction(skin,tag))){
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
