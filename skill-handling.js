import {Vector3,Quaternion,Euler} from 'three';
import {reachArm} from './sova-bow.js';

const entries={
  tablet:'공중 연막|궤도 일격|유도 일제 사격|아마겟돈|웨이브폼',
  bracer:'여진|섬광 폭발|균열|지진 강타|소이탄|독성 장막|뱀 이빨|포탑|봉쇄|신경 절도|강철 정원',
  charge:'폭발 팩|자극제 신호기|특별 배송|음향 센서|함정|요격기|목조르기|장벽망|중력그물|알람봇|나노스웜|사이버 감옥|대비책',
  pilot:'잠입 드론|올빼미 드론|스파이캠|폭발 봇|정찰자',
  card:'랑데부|트레이드마크',
  prism:'광속|포화|굴절|초점 교차|지름길|일체 정지|진형 붕괴|섬광등|약화',
  crack:'관문 충돌|기습|기만|어둠의 발자국|그림자 습격',
  eye:'귀체|포박|눈총|추적귀|황혼',
  jade:'회복 구슬|둔화 구슬|장벽 구슬|부활',
  water:'해만|만조|심판|폭풍 쇄도|격류',
  fire:'뜨거운 손|불길|커브볼',
  star:'중력의 샘|신성 파동|성운|우주 장벽',
  shadow:'어둠의 장막|피해망상|계략|간섭|독사의 구덩이',
  wave:'화음|M-파동|요동치는 베이스',
  bolt:'릴레이 볼트|추월 차선|오버드라이브',
  wing:'활력 회복|아직 안 죽었어',
  leaf:'가지치기|면도날 덩굴|아크 장미|인도하는 빛|추적자',
  wind:'연막 폭발|순풍|상승 기류'
};
export const handStyle=Object.fromEntries(Object.entries(entries).flatMap(([key,names])=>names.split('|').map(n=>[n,key])));
const positions={
  tablet:[.43,-.15,.03,.11],bracer:[.39,-.21,-.04,.07],charge:[.42,-.22,.08,.065],pilot:[.45,-.20,.05,.095],
  card:[.37,-.16,.05,.033],crack:[.42,-.17,.12,.09],eye:[.43,-.18,.10,.08],jade:[.46,-.19,.03,.10],
  water:[.44,-.19,.06,.095],fire:[.43,-.16,.12,.082],star:[.38,-.14,.08,.08],bolt:[.40,-.18,.13,.07],
  leaf:[.41,-.21,.08,.073],wave:[.42,-.20,.07,.09],prism:[.41,-.19,.10,.07],wing:[.38,-.17,.09,.08],
  shadow:[.46,-.18,.055,.11],wind:[.39,-.18,.16,.06]
};
export function skillHandling(rig,item,eye,skill) {
  const style=handStyle[skill],position=positions[style];
  if(!position || !eye)return;
  const left=rig.getObjectByName('L_Hand'),right=rig.getObjectByName('R_Hand');
  if(!left || !right)return;
  const joints=[];
  for(const side of ['L','R'])for(const n of ['Shoulder','Elbow','Hand']){const b=rig.getObjectByName(side+'_'+n);if(b)joints.push(b)}
  const fingers=[];
  for(const side of ['L','R'])for(const [i,digit] of ['Thumb','Index','Middle','Ring','Pinky'].entries())
    for(const seg of [1,2]){const bone=rig.getObjectByName(side+'_'+digit+seg);if(bone){fingers.push({bone,i,seg,left:side==='L'});joints.push(bone)}}
  const original=joints.map(()=>new Quaternion()),at=new Vector3(),target=new Vector3(),palm=new Vector3();
  const reachL=reachArm(rig,'L',true),reachR=reachArm(rig,'R',true);
  const twoHands=['tablet','pilot','jade','water','shadow','bracer'].includes(style);
  let changed=false;
  return {
    restore(){if(changed)joints.forEach((b,i)=>b.quaternion.copy(original[i]));changed=false},
    update(tag,t){
      const throwing=['throw','short throw','cast','fire','place'].includes(tag);
      const take=tag==='equip'?Math.min(1,t*3):1;
      const swing=throwing?Math.sin(Math.PI*Math.min(1,t)*1.05):0;
      joints.forEach((b,i)=>original[i].copy(b.quaternion));changed=true;
      eye.getWorldPosition(at);
      const [depth,y,z,width]=position;
      for(const side of [1,-1]){
        if(side<0 && !twoHands)continue;
        const hand=side>0?right:left;hand.getWorldPosition(palm);
        target.set(depth+swing*.13,y+(throwing?.03*swing:0),z+side*width).add(at);
        target.lerp(palm,1-take*.50);
        (side>0?reachR:reachL)(target);
      }
      for(const {bone,i,seg,left:l} of fingers){
        if(l && !twoHands)continue;
        const point=(style==='tablet' || style==='bracer') && l && i===1;
        const curl=point?-.19:style==='charge'||style==='pilot'?.13:-.065;
        bone.rotateX(take*(curl*(.5+i*.16)-.16*swing)*(seg===1?1:.7));
        if(seg===1)bone.rotateZ((i-2)*.022*(1+swing));
      }
    }
  };
}
