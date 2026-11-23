import {MathUtils,Quaternion,Vector3} from 'three';

// Muzzle and wrist landmarks in the 16:9 collection demonstration, followed
// by the openness of the support palm. Intermediate poses stay in 3D.
const idle=[.60,.54,.83,1.03,.60,.82,0];
const tracks={
 neptune:{
  reload:[idle,[.65,.23,.89,1.08,.32,.83,.45],[.66,.38,.91,1.06,.19,1.2,.2],[.71,.34,.91,1.03,.58,.98,-.6],[.67,.20,.85,1.04,.62,.89,-.55],[.66,.22,.84,1.03,.70,.76,-.2],[.63,.45,.85,1.05,.64,.86,0],idle],
  inspect:[idle,[.02,.52,.86,1.02,.22,.85,-.26],[.015,.40,.86,.99,.23,.81,-.18],[.09,.41,.89,1.02,.26,.81,-.2],[.20,.04,.71,.89,.29,.80,-.24],[.20,.03,.71,.88,.29,.80,-.25],[.59,.54,.83,1.03,.60,.82,0],idle]},
 magepunk:{
  reload:[idle,[.63,.29,.82,1.04,.34,.79,.4],[.67,.46,.85,1.03,.38,1.12,0],[.66,.48,.85,1.03,.60,.95,-.7],[.66,.23,.84,1.03,.59,.80,-.34],[.65,.24,.84,1.03,.64,.85,-.1],[.64,.38,.83,1.03,.66,.81,-.25],idle],
  inspect:[idle,[.04,.49,.85,1.0,.24,.85,-.35],[.015,.39,.85,1.0,.25,.82,-.35],[.06,.36,.86,1.0,.30,.79,-.23],[.22,.05,.75,.86,.29,.78,-.34],[.22,.05,.75,.86,.29,.78,-.34],[.57,.54,.82,1.0,.59,.86,0],idle]},
 chronovoid:{
  reload:[idle,[.59,.35,.88,1.03,.12,.79,.8],[.67,.41,.89,1.04,.18,.90,.94],[.68,.44,.88,1.04,.18,.84,1],[.70,.47,.88,1.03,.24,.87,.83],[.70,.24,.88,1.03,.44,1.04,.56],[.69,.15,.87,1.03,.64,.95,-.3],idle],
  inspect:[idle,[.54,.41,.86,1.02,.17,.80,.59],[.63,.19,.92,1.02,.15,.84,.91],[.69,.04,.93,1.02,.29,.99,1],[.69,.04,.93,1.02,.32,.99,1],[.60,.52,.87,1.01,.52,1.01,.6],idle,idle]},
 kuronami:{
  reload:[idle,[.69,.43,.92,1.04,.14,.66,.94],[.70,.52,.91,1.04,.19,.80,.83],[.70,.26,.90,1.02,.78,.81,.68],[.66,.43,.87,1.02,.69,.94,.86],[.67,.39,.90,1.02,.50,.87,.95],[.67,.42,.89,1.02,.48,.91,.83],idle],
  inspect:[idle,[.01,.41,.89,1.01,.21,.85,-.38],[.01,.39,.88,1.0,.23,.83,-.37],[.23,.03,.78,.91,.30,.78,-.42],[.20,.035,.77,.91,.29,.77,-.31],[.34,.49,.76,1.09,.32,1.0,.28],idle,idle]}
};
export const signatureTrack=(skin,gun,action)=>skin && gun==='vandal' && skin.level>=(skin.banner==='neptune'?2:3)?tracks[skin.banner]?.[action]:undefined;
const smooth=MathUtils.smoothstep;
export function recordedGrip(){
 const screen=new Float32Array(7),ray=new Vector3(),from=new Vector3(),candidate=new Vector3(),tip=new Vector3(),shift=new Vector3(),targetRotation=new Quaternion();
 const tan=Math.tan(29*Math.PI/180);
 function towards(x,y){return ray.set(1,(1-2*y)*tan,(2*x-1)*tan*16/9);}
 return (keys,t,eye,right,left,muzzle,turn,delta)=>{
  const k=MathUtils.clamp(t,0,1)*(keys.length-1),i=Math.floor(k),f=smooth(k-i,0,1);
  for(let n=0;n<7;n++)screen[n]=MathUtils.lerp(keys[i][n],keys[Math.min(i+1,keys.length-1)][n],f);
  const w=smooth(t,0,.13)*(1-smooth(t,.86,1)),origin=from.copy(eye);origin.x-=.04;origin.z-=.057;origin.y-=.032;
  const depth=MathUtils.clamp(right.x-origin.x,.22,.48);
  candidate.copy(towards(screen[2],screen[3])).multiplyScalar(depth).add(origin);
  delta.lerp(shift.subVectors(candidate,right),w);
  const initial=tip.subVectors(muzzle,right);const length=initial.length();
  towards(screen[0],screen[1]).normalize();
  candidate.sub(origin);const axis=candidate.dot(ray);
  const along=axis+Math.sqrt(Math.max(.002,length*length-candidate.lengthSq()+axis*axis));
  const next=ray.multiplyScalar(along).sub(candidate).normalize();
  turn.slerp(targetRotation.setFromUnitVectors(initial.normalize(),next),w);
  const palmDepth=MathUtils.clamp(left.x-origin.x,.29,.65);
  left.lerp(towards(screen[4],screen[5]).multiplyScalar(palmDepth).add(origin),w);
  return screen[6]*w;
 };
}


