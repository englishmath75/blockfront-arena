import { BufferAttribute,Vector3,Quaternion } from 'three';
import { reachArm } from './sova-bow.js';
import { muzzleSocket } from './skin-outline.js';

// First-person meshes end at an open upper-arm cuff. Extend the cuff out of the
// view frustum, tapering the correction to zero before the elbow.
const prepared=new WeakSet();
export function sleeveEdges(rig){
  rig.traverse(o=>{
    if(!o.isSkinnedMesh)return;
    const geo=o.geometry;
    if(!geo.getAttribute('sleeveEdge')){
      const ix=geo.attributes.skinIndex,w=geo.attributes.skinWeight;
      const weights=o.skeleton.bones.map(b=>/^(L|R)_(Shoulder|Clavicle)$/.test(b.name)?1:0);
      const edge=new Float32Array(ix.count);
      for(let i=0;i<ix.count;i++)for(let j=0;j<4;j++)edge[i]+=weights[ix.getComponent(i,j)]*w.getComponent(i,j);
      geo.setAttribute('sleeveEdge',new BufferAttribute(edge,1));
    }
    for(const m of [o.material].flat()){
      if(prepared.has(m))continue;prepared.add(m);
      const prev=m.onBeforeCompile.bind(m),key=m.customProgramCacheKey();
      m.customProgramCacheKey=()=>key+'-fp-cuff';
      m.onBeforeCompile=(s,r)=>{prev(s,r);s.vertexShader='attribute float sleeveEdge;\n'+s.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nfloat cuff=smoothstep(.08,.93,sleeveEdge);mvPosition.y-=.24*cuff;mvPosition.z+=.44*cuff;gl_Position=projectionMatrix*mvPosition;');};
    }
  });
}

export function frameGun(rig,gun,eye,enabled){
  const muzzle=muzzleSocket(gun),trigger=gun.getObjectByName('Trigger');
  if(!enabled || !eye || !trigger || !muzzle)return;
  const arms=['L','R'].map(side=>({hand:rig.getObjectByName(side+'_Hand'),reach:reachArm(rig,side,true),
    pos:new Vector3(),turn:new Quaternion()}));
  if(arms.some(a=>!a.hand))return;
  const joints=arms.flatMap(({hand},i)=>['Shoulder','Elbow','Hand'].map(n=>rig.getObjectByName((i?'R':'L')+'_'+n))).filter(Boolean);
  const rest=joints.map(()=>new Quaternion()),gunPos=new Vector3(),gunTurn=new Quaternion();
  const eyePos=new Vector3(),grip=new Vector3(),front=new Vector3(),goal=new Vector3(),axis=new Vector3(),vec=new Vector3();
  const change=new Quaternion(),parent=new Quaternion(),wq=new Quaternion();
  let active=false;
  return {
    restore(){if(!active)return;gun.position.copy(gunPos);gun.quaternion.copy(gunTurn);joints.forEach((j,i)=>j.quaternion.copy(rest[i]));active=false},
    update(tag,t,rogue=false){
      if(tag!=='reload' && tag!=='inspect')return;
      const envelope=Math.min(1,t/.22,(1-t)/.2);
      const blend=Math.max(0,envelope*envelope*(3-2*envelope));if(!blend)return;
      active=true;gunPos.copy(gun.position);gunTurn.copy(gun.quaternion);joints.forEach((j,i)=>rest[i].copy(j.quaternion));
      for(const a of arms){a.hand.getWorldPosition(a.pos);a.hand.getWorldQuaternion(a.turn)}
      eye.getWorldPosition(eyePos);trigger.getWorldPosition(grip);muzzle.getWorldPosition(front).sub(grip);
      const barrel=front.length();front.normalize();
      if(rogue && tag==='inspect'){
        // Keep the palm on the handguard while the barrel rolls over it.
        const palm=arms[0].pos,along=vec.subVectors(palm,grip).dot(front);
        palm.addScaledVector(front,-Math.max(0,along-.32*barrel)*blend);
      }
      if(tag==='inspect'){
        const rock=Math.sin(2*t*Math.PI);
        if(rogue){
          // The showcase holds the side profile before rolling the magazine upward.
          const flip=Math.max(0,Math.min(1,(t-.49)/.16)),mix=flip*flip*(3-2*flip);
          axis.set(.22+.09*mix,.23+.52*mix,-.93+.57*mix).normalize();
          goal.set(.32+.04*mix,-.205+.02*rock,.15-.02*mix);
        }else{axis.set(.43,.04+.18*rock,-.91).normalize();goal.set(.49,-.15+.055*rock,.18)}
      }else{
        axis.set(.76,.43,-.31).normalize();goal.set(.44,-.14,.16);
      }
      change.setFromUnitVectors(front,axis);wq.identity().slerp(change,blend*(tag==='inspect'?.93:.72));change.copy(wq);
      if(rogue && tag==='inspect'){
        const flip=Math.max(0,Math.min(1,(t-.49)/.16));
        change.premultiply(wq.setFromAxisAngle(axis,2.4*flip*flip*(3-2*flip)*blend));
      }
      goal.add(eyePos).lerp(grip,1-blend);
      gun.getWorldPosition(vec).sub(grip).applyQuaternion(change).add(goal);
      gun.parent.worldToLocal(vec);gun.getWorldQuaternion(wq);gun.parent.getWorldQuaternion(parent);
      gun.position.copy(vec);gun.quaternion.copy(parent.invert()).multiply(change).multiply(wq);
      for(const a of arms){
        a.pos.sub(grip).applyQuaternion(change).add(goal);a.reach(a.pos);
        a.hand.parent.getWorldQuaternion(parent);a.hand.quaternion.copy(parent.invert()).multiply(change).multiply(a.turn);
      }
    }
  };
}
