import {Vector3,Quaternion,Euler,MathUtils} from 'three';
import {reachArm} from './sova-bow.js';
import {recordedGrip,signatureTrack} from './signature-handling.js';

// Keep the socket's animated transform when bringing the elbow down. On some
// rigs the weapon socket is itself parented to the firing hand.
export function firearmGrip(rig,weapon,gun){
  const eye=rig.getObjectByName('Camera');
  const muzzle=weapon.getObjectByName('MuzzlePoint')??weapon.getObjectByName('Muzzle');
  if(!eye || !muzzle || gun==='melee' || gun==='blades')return;
  const twoHanded=!['headhunter','sheriff','classic','ghost','frenzy','bandit','shorty'].includes(gun);
  const arms=['L','R'].map(side=>{
    const joints=['Shoulder','Elbow','Hand'].map(n=>rig.getObjectByName(side+'_'+n));
    if(joints.some(b=>!b))return null;
    return {joints,rot:joints.map(()=>new Quaternion()),pos:new Vector3(),palm:new Vector3(),orientation:new Quaternion(),
      pole:new Vector3(-.62,-.85,side==='L'?-.64:.65),reach:reachArm(rig,side)};
  });
  if(arms.some(a=>!a))return;
  const socket=weapon.parent,local=weapon.position.clone(),rotation=weapon.quaternion.clone(),scale=weapon.scale.clone();
  const at=new Vector3(),delta=new Vector3(),pivot=new Vector3(),goal=new Vector3(),base=new Vector3(),end=new Vector3();
  const turn=new Quaternion(),rot=new Euler(),parent=new Quaternion(),orientation=new Quaternion();
  const fit=recordedGrip(),support=new Vector3(),axis=new Vector3(),up=new Vector3(),vertical=new Vector3(),cross=new Vector3(),roll=new Quaternion();
  const digits=['Thumb','Index','Middle','Ring','Pinky'].map(n=>rig.getObjectByName('L_'+n+'2'));
  const fingerRest=digits.map(()=>new Quaternion());
  let active=false;
  return {
    restore(){
      if(!active)return;
      socket.add(weapon);weapon.position.copy(local);weapon.quaternion.copy(rotation);weapon.scale.copy(scale);
      for(const a of arms){
        a.joints[0].position.copy(a.pos);
        a.joints.forEach((b,i)=>b.quaternion.copy(a.rot[i]));
      }digits.forEach((b,i)=>{if(b)b.quaternion.copy(fingerRest[i]);});active=false;
    },
    update(tag,t,skin,ads){
      if(ads)return;
      eye.getWorldPosition(at);
      for(const a of arms){
        a.pos.copy(a.joints[0].position);a.joints.forEach((b,i)=>a.rot[i].copy(b.quaternion));
        a.joints[2].getWorldPosition(a.palm);a.joints[2].getWorldQuaternion(a.orientation);
      }
      digits.forEach((b,i)=>{if(b)fingerRest[i].copy(b.quaternion);});
      local.copy(weapon.position);rotation.copy(weapon.quaternion);scale.copy(weapon.scale);
      rig.attach(weapon);active=true;
      const inspect=tag==='inspect'?MathUtils.smoothstep(t,0,.16)*(1-MathUtils.smoothstep(t,.83,1)):0;
      const turnProfile=twoHanded && !weapon.userData.chaosCore && skin?.motionOn!==false;
      const bareInspect=turnProfile ? .66*inspect : 0;
      const release=tag==='reload'||tag==='equip'?Math.sin(Math.PI*t)**2:0;
      // Yaw the displayed side toward the viewer about the trigger wrist.
      pivot.copy(arms[1].palm);
      turn.setFromEuler(rot.set(twoHanded?-.07:0,bareInspect+(twoHanded?.07:0),-.06*inspect));
      delta.set(twoHanded?-.036:0,-.024-.025*inspect,.022+.075*inspect);
      const keys=signatureTrack(skin,gun,tag);
      support.copy(arms[0].palm);muzzle.getWorldPosition(end);
      const open=keys?fit(keys,t,at,pivot,support,end,turn,delta):0;
      if(keys && inspect){
        axis.subVectors(end,pivot).applyQuaternion(turn).normalize();weapon.getWorldQuaternion(orientation);
        up.set(0,1,0).applyQuaternion(orientation).applyQuaternion(turn);up.addScaledVector(axis,-up.dot(axis)).normalize();
        vertical.set(0,1,0);vertical.addScaledVector(axis,-vertical.dot(axis)).normalize();
        const angle=Math.atan2(axis.dot(cross.crossVectors(up,vertical)),up.dot(vertical));
        // After the first side view the Vandal turns over to expose the
        // opposite rail and magazine, then rolls back into its firing grip.
        const flip=skin.banner==='chronovoid'?0:MathUtils.smoothstep(t,.44,.57)*(1-MathUtils.smoothstep(t,.73,.86));
        turn.premultiply(roll.setFromAxisAngle(axis,angle*inspect*.90+Math.PI*.90*flip));
      }
      weapon.getWorldPosition(base).sub(pivot).applyQuaternion(turn).add(pivot).add(delta);
      weapon.getWorldQuaternion(orientation);
      weapon.position.copy(rig.worldToLocal(base));rig.getWorldQuaternion(parent);
      weapon.quaternion.copy(parent.invert().multiply(turn).multiply(orientation));
      for(const [i,a] of arms.entries()){
        const [shoulder,,hand]=a.joints;
        goal.copy(a.palm).sub(pivot).applyQuaternion(turn).add(pivot).add(delta);
        if(i===0 && keys)goal.copy(support);
        if(i===0 && twoHanded && tag==='idle'){
          muzzle.getWorldPosition(end).sub(pivot).normalize();
          goal.addScaledVector(end,-.083);goal.y-=.009;
        }
        // Shoulder follows the torso; a reload may bring the hand up, but
        // should never bring the open end of the upper arm into the image.
        shoulder.getWorldPosition(base);
        base.x=Math.min(base.x,at.x+.035);base.y=Math.min(base.y,at.y-.34);
        base.z=MathUtils.lerp(base.z,at.z+(i===0?-.20:.21),.46);
        shoulder.position.copy(shoulder.parent.worldToLocal(base));
        if(i===0 && !twoHanded && release>.2)a.reach(goal);else a.reach(goal,a.pole);
        hand.parent.getWorldQuaternion(parent);
        hand.quaternion.copy(parent.invert().multiply(turn).multiply(a.orientation));
        if(i===0 && keys){hand.rotateZ(.26*open);digits.forEach((b,j)=>{if(b)b.rotateX(-open*(j===0?.22:.53));});}
      }
    }
  };
}

