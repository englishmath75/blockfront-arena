// Combat-state helpers shared by the authoritative simulation and its visual cues.
export function focus(p,now,shield=true){
  p.focusUntil=now+12;
  if(shield)p.isoShield=true;
}
export function damageCredit(victim,attacker,now){
  if(!attacker || victim===attacker || victim.team===attacker.team)return;
  (victim.damageLedger??={})[attacker.id]=now;
}
export function eliminationRewards(victim,killer,players,now,spawn){
  for(const p of players){
    if(p===victim || p.down || p.team===victim.team || !(p===killer || victim.damageLedger?.[p.id]>=now-5))continue;
    if(p.agent==='클로브'){p.pickupUntil=now+5;p.pickupTarget={x:victim.x,y:victim.y,z:victim.z};p.mustKillBy=0;}
    if(p.agent==='아이소' && p.focusUntil>now)spawn(p,victim);
    if(p===killer && p.agent==='네온' && p.slideStock===0 && ++p.slideKills>=2){p.slideStock=1;p.slideKills=0;}
  }
  victim.damageLedger={};
}
export function applyDecay(p,maximum,until){
  if(p.evolution || p.down)return;
  const loss=Math.min(Math.max(0,maximum-(p.decayLost??0)),Math.max(0,p.hp-1));
  p.hp-=loss;p.decayLost=(p.decayLost??0)+loss;p.decayUntil=Math.max(p.decayUntil??0,until);
}
export function neonDamage(distance,part){
  const body=distance<20?18:distance<50?12:10;
  return Math.round(body*(part==='head'?3:part==='legs'?.85:1));
}
export function inCloneFlash(d,p){
  const dx=p.x-d.x,dz=p.z-d.z,dist=Math.hypot(dx,dz);
  return dist<.1 || (dx*Math.sin(d.angle)+dz*Math.cos(d.angle))/dist>=Math.cos(Math.PI/3);
}
