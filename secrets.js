const relics = [
  ['ascent','어센트','중앙 피자가게','마지막 한 조각','식기 부딪히는 소리가 들릴 만한 곳.','pizza','guard'],
  ['split','스플릿','중앙 우편실','반송된 편지','두 층 사이에 배달이 밀려 있다.','letter','quiet'],
  ['fracture','프랙처','B 오락실','추가 코인','기계는 멈췄지만 한 판이 남았다.','coin','point'],
  ['bind','바인드','B 분수','분수의 소원','물이 흐르는 곳에 누군가 소원을 두고 갔다.','drop','point'],
  ['breeze','브리즈','중앙 대포','북쪽을 잃은 나침반','오래된 포신 곁에서 바늘이 흔들린다.','compass','quiet'],
  ['abyss','어비스','중앙 도서관','접어 둔 페이지','낭떠러지 위에도 책 읽을 자리는 있다.','book','point'],
  ['lotus','로터스','C 폭포','물 위의 연꽃','떨어지는 물소리 아래에서 꽃이 피었다.','lotus','guard'],
  ['sunset','선셋','B 보바','막차 전 한 잔','빨대 끝에 노을이 걸렸다.','tea','quiet'],
  ['pearl','펄','A 꽃집','잠수부의 꽃','바닷속 가게에서 시들지 않는 꽃을 찾는다.','flower','guard'],
  ['summit','서밋','B 트로피','빈 시상대','누군가 상을 가지러 돌아오지 않았다.','cup','point'],
  ['icebox','아이스박스','B 눈사람','녹지 않는 별','눈으로 만든 경비병이 지키고 있다.','snow','quiet'],
  ['corrode','코로드','A 크레인','빠진 톱니','무거운 짐을 드는 기계에서 떨어졌다.','gear','guard'],
  ['haven','헤이븐','A 정원','정원의 풍경','잎이 흔들릴 때 작은 종도 울린다.','bell','quiet'],
  ['range','사격장','사격선','연습생의 표식','사격선 오른쪽에서 작은 빛을 찾아보세요.','target','guard'],
];
const rewards={guard:'실드 +15',quiet:'6초간 발소리 제거',point:'궁극기 포인트 +1'};
export const mapSecrets=Object.fromEntries(relics.map(([slug,map,area,title,hint,shape,reward])=>
  [map,{id:'relic-'+slug,map,area,title,hint,shape,reward,detail:area+'에서 획득 · '+rewards[reward]+(reward==='quiet'?'':' (받을 수 없을 때는 6초간 발소리 제거)')}]));
export const tricks={
  frost:{title:'겹서리',agent:'세이지',hint:'얼음이 한 겹 더 맺힐 때까지 기다려 보세요.',detail:'둔화 구슬을 4초간 준비한 뒤 던지면 얼음 반경이 5m에서 6.25m로 늘어납니다.',skill:'둔화 구슬',hold:4,bonus:'둔화 반경 +1.25m'},
  echo:{title:'세 번째 메아리',agent:'소바',hint:'시위를 놓기 전에 활이 다시 울린다.',detail:'정찰용 화살을 4초간 준비하면 착지 후 세 번째 탐지 파동이 발생합니다.',skill:'정찰용 화살',hold:4,bonus:'정찰 파동 +1회'},
  dusk:{title:'긴 황혼',agent:'오멘',hint:'그림자의 거리를 정한 뒤 잠시 머물러 보세요.',detail:'어둠의 장막을 5초간 준비한 뒤 전개하면 연막이 3초 더 유지됩니다.',skill:'어둠의 장막',hold:5,bonus:'연막 지속 +3초'},
  drift:{title:'깃털 착지',agent:'제트',hint:'바람을 타고 내려와 땅에 사뿐히 닿는다.',detail:'내려오며 1초 이상 연속 활공한 뒤 착지하면 6초간 발소리가 사라집니다.',bonus:'6초간 발소리 제거'},
  prism:{title:'빛의 왕복표',agent:'웨이레이',hint:'멀리 나갔다가 내 빛을 따라 집으로.',detail:'표식에서 12m 이상 떨어진 곳에서 굴절로 돌아오면 실드를 최대 15 얻습니다. 실드가 가득 차 있으면 6초간 발소리가 사라집니다.',bonus:'실드 +15'},
  tempo:{title:'세 박자',agent:'대전 전적',hint:'한 라운드에서 적 셋을 쓰러뜨려 보세요.',detail:'한 라운드에서 적 플레이어를 세 번 처치하면 4초간 이동 속도가 10% 증가합니다.',bonus:'4초간 이동 속도 +10%'},
  return:{title:'다시 피는 불씨',agent:'대전 전적',hint:'두 번 쓰러졌어도 다음 한 번을 노려 보세요.',detail:'적 플레이어에게 두 번 연속 처치당한 뒤 다음 처치에 성공하면 체력 25를 회복합니다. 남은 회복량은 실드로 전환되며, 둘 다 가득 차 있으면 6초간 발소리가 사라집니다.',bonus:'체력·실드 최대 +25'},
};
export const secretCatalog={...tricks,...Object.fromEntries(Object.values(mapSecrets).map(r=>[r.id,r]))};
const holds=Object.fromEntries(Object.entries(tricks).filter(([,v])=>v.skill).map(([id,v])=>[v.skill,id]));

export function discover(p,id,now,bonus=secretCatalog[id].bonus){
  if(p.roundSecrets.includes(id))return false;
  p.roundSecrets.push(id);
  if(!p.foundSecrets.includes(id))p.foundSecrets.push(id);
  p.discovery={id,at:now,bonus};
  return true;
}
export function trackPreparation(p,skill,now,enabled){
  const id=holds[skill];
  if(!enabled || !id || p.roundSecrets.includes(id)){p.preparation=null;return;}
  if(p.preparation?.id!==id)p.preparation={id,since:now};
}
export function prepared(p,skill,now){
  const hold=p.preparation;
  return hold && holds[skill]===hold.id && now-hold.since>=tricks[hold.id].hold?hold.id:null;
}
function addShield(p,amount){
  const before=p.shield;
  p.shield=Math.max(before,Math.min(50-(p.overheal??0),before+amount));
  return p.shield-before;
}
function silence(p,now){
  p.quietUntil=Math.max(p.quietUntil??0,now+6);
  return rewards.quiet;
}
function guard(p,now){
  const gain=addShield(p,15);
  return gain?'실드 +'+Math.ceil(gain):silence(p,now);
}
export function claimRelic(p,relic,now,points,allowPoint){
  if(relic.claimed || relic.end<=now || p.roundSecrets.includes(relic.secretId))return false;
  const item=secretCatalog[relic.secretId];
  let bonus;
  if(item.reward==='guard')bonus=guard(p,now);
  else if(item.reward==='point' && allowPoint && p.ult<points && !p.charges[3]){
    p.ult++;p.charges[3]=Number(p.ult>=points);bonus=rewards.point;
  }else bonus=silence(p,now);
  relic.claimed=true;relic.end=now;
  return discover(p,item.id,now,bonus);
}
export function findRelicPosition(item,areas,structure){
  const area=item.shape==='target'?{x:6,y:0,z:11}:areas.find(a=>a.sector+' '+a.name===item.area);
  if(!area)return null;
  const ref=structure.spawn(area.x,area.z,area.groundY??area.y??0);
  const seed=[...item.id].reduce((sum,s)=>sum+s.charCodeAt(0),0);
  // A short, walkable approach from the authored callout keeps props out of sealed rooms.
  for(const radius of [2.4,1.4,.65,0])for(let j=0;j<8;j++){
    const angle=(j+seed%8)*Math.PI/4;
    let floor=ref.y,x=ref.x,z=ref.z,clear=true;
    for(let k=1;k<=6;k++){
      x=ref.x+Math.cos(angle)*radius*k/6;z=ref.z+Math.sin(angle)*radius*k/6;
      const next=structure.support(x,z,floor+.30,.27);
      if(!Number.isFinite(next)||Math.abs(floor-next)>.36||structure.blocked(x,z,next,.32,1.72)){clear=false;break;}
      floor=next;
    }
    if(clear)return {x,y:floor,z};
  }
  return null;
}
export function traitLanding(p,now){
  if(p.glideSeconds>=1 && !p.roundSecrets.includes('drift'))discover(p,'drift',now,silence(p,now));
  p.glideSeconds=0;
}
export function traitReturn(p,trip,now){
  if(Math.hypot(trip.to.x-trip.from.x,trip.to.y-trip.from.y,trip.to.z-trip.from.z)>=12 && !p.roundSecrets.includes('prism'))
    discover(p,'prism',now,guard(p,now));
}
export function recordDuel(victim,killer,now){
  if(!killer || victim===killer || victim.target || killer.target)return;
  victim.unansweredDeaths=(victim.unansweredDeaths??0)+1;
  if(!killer.down && killer.unansweredDeaths>=2 && !killer.roundSecrets.includes('return')){
    const hp=Math.min(100-killer.hp,25);
    killer.hp+=hp;const shield=addShield(killer,25-hp);
    const bonus=hp || shield?'체력 +'+Math.ceil(hp)+' · 실드 +'+Math.ceil(shield):silence(killer,now);
    discover(killer,'return',now,bonus);
  }
  killer.unansweredDeaths=0;killer.duelKills=(killer.duelKills??0)+1;
  if(!killer.down && killer.duelKills===3 && discover(killer,'tempo',now))killer.hasteUntil=Math.max(killer.hasteUntil??0,now+4);
}
