export const customOptions=['clock','ammo','skills','credits'];
const captions={clock:'라운드 시계 정지',ammo:'탄약 무제한',skills:'스킬 충전 무제한',credits:'크레드 무제한'};
export function customControls(host, cheats, ghost){
  const button=(id,text,on)=>'<button data-custom="'+id+'"'+(on===undefined?'':' aria-pressed="'+!!on+'"')+'>'+text+(on===undefined?'':on?' · 켜짐':' · 꺼짐')+'</button>';
  if(!host && !cheats.enabled)return '';
  let items=host?button('enabled','치트 허용',cheats.enabled):'';
  if(cheats.enabled){
    items+=button('ghost','유령 모드',ghost);
    if(host)items+=customOptions.map(k=>button(k,captions[k],cheats[k])).join('')+
      button('skip','현재 단계 건너뛰기')+button('round','다음 라운드')+button('restart','경기 재시작');
  }
  return '<fieldset class="custom-game-controls"><legend>사용자 설정 경기</legend>'+items+'</fieldset>';
}
export function fly(p,keys,dt){
  const forward=+keys.has('KeyW')-+keys.has('KeyS'),side=+keys.has('KeyD')-+keys.has('KeyA');
  const up=+keys.has('Space')-+(keys.has('ControlLeft')||keys.has('ControlRight'));
  const scale=dt*(keys.has('ShiftLeft')?4:12)/Math.max(1,Math.hypot(forward,side,up));
  p.x+=scale*(side*Math.cos(p.yaw)-forward*Math.sin(p.yaw)*Math.cos(p.pitch));
  p.z+=scale*(-side*Math.sin(p.yaw)-forward*Math.cos(p.yaw)*Math.cos(p.pitch));
  p.y+=scale*(up+forward*Math.sin(p.pitch));
  p.vx=p.vy=p.vz=0;
}
