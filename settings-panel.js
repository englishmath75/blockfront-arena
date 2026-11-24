import {escape} from './interface.js';
import {parseCrosshair,reticle} from './crosshair.js';
import {defaults,templates,bindings,keyName,defaultCode,palette,addProfile,removeProfile,profileValue,serializeProfile,bindKey,profileLimit} from './preferences.js';

const pages={general:'일반',controls:'조작',cross:'조준점',video:'화면',audio:'음향'};
const sections={cross:{P:'주 무기',A:'조준 사격',S:'저격소총 조준경',library:'조준점 보관함'},video:{display:'일반',quality:'그래픽 품질',stats:'통계'},audio:{sounds:'사운드',voice:'음성 채팅',dialogue:'음성 대사'}};
const buttons=(items,active,type)=>Object.entries(items).map(([id,name])=>'<button type="button" data-'+type+'="'+id+'" aria-pressed="'+(active===id)+'">'+name+'</button>').join('');
const button=(id,title,disabled=false)=>'<button type="button" data-cmd="'+id+'" '+(disabled?'disabled':'')+'>'+title+'</button>';
const group=title=>'<h3 class="pref-group">'+title+'</h3>';
const row=(label,control)=>'<label class="pref-row"><span>'+label+'</span><span class="pref-value">'+control+'</span></label>';
const option=(value,name,current)=>'<option value="'+escape(value)+'" '+(String(value)===String(current)?'selected':'')+'>'+escape(name)+'</option>';
const select=(id,value,list)=>'<select data-pref="'+id+'">'+list.map(([v,n])=>option(v,n,value)).join('')+'</select>';
const toggle=(id,value)=>'<span class="pref-toggle"><input data-pref="'+id+'" type="checkbox" '+(value?'checked':'')+'><i aria-hidden="true"></i><output>'+(value?'켜짐':'꺼짐')+'</output></span>';
const slider=(id,value,min,max,step,percent=false)=>'<input data-pref="'+id+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"><output data-percent="'+(percent?1:0)+'">'+(percent?Math.round(value*100)+'%':value)+'</output>';
const vol=(s,id,label)=>row(label,slider(id,s[id],0,1,.01,true));
const colorNames=['흰색','초록색','연두색','녹황색','노란색','청록색','자홍색','빨간색','사용자 설정'];
function dotFields(c,sniper){
  return group('중앙 도트')+row('중앙 도트',toggle('cross:d',c.d??sniper))+row('중앙 도트 불투명도',slider('cross:'+(sniper?'o':'a'),c[sniper?'o':'a']??1,0,1,.05))+row('중앙 도트 두께',slider('cross:'+(sniper?'s':'z'),c[sniper?'s':'z']??2,1,10,1));
}
function lines(c,i,label){
  const field=(k,fallback)=>c[i+k]??fallback;
  const range=(k,name,start,max,step=1)=>row(label+' '+name,slider('cross:'+i+k,field(k,start),0,max,step));
  return group(label)+row(label+' 표시',toggle('cross:'+i+'b',field('b',1)))+range('a','불투명도',i?.35:.8,1,.05)+range('l','가로 길이',i?2:6,20)+row('가로·세로 길이 개별 설정',toggle('cross:'+i+'g',field('g',0)))+(field('g',0)?range('v','세로 길이',field('l',i?2:6),20):'')+range('t','두께',2,10)+range('o','간격',i?10:3,20)+row('이동 오차',toggle('cross:'+i+'m',field('m',i)))+row('사격 오차',toggle('cross:'+i+'f',field('f',1)));
}
function editor(s,tab){
  const item=s.profiles[s.selected],p=parseCrosshair(item.code),sniper=tab==='S';
  const c=tab==='A'&&(p.global.a===0 || !Object.keys(p.A).length)?p.P:p[tab];
  const ink=c.c===8?(c.u??'#ffffff').slice(0,7):palette[c.c??(sniper?7:0)]??'#ffffff';
  return '<div class="pref-preview"><canvas id="reticle-preview" width="160" height="160" aria-label="조준점 미리보기"></canvas></div>'+
    row('조준점 프로필',select('profile',s.selected,s.profiles.map((p,i)=>[i,p.name])))+
    (tab==='A'?row('주 무기 조준점 사용',toggle('inherit',p.global.a===0||!Object.keys(p.A).length)):'')+
    group('조준점')+row('조준점 색상',select('cross:c',c.c??(sniper?7:0),colorNames.map((name,i)=>[i,name])))+
    row('사용자 설정 색상','<input data-pref="hex" type="color" value="'+ink+'"><input data-pref="hexText" aria-label="HEX 색상" type="text" maxlength="7" value="'+ink.toUpperCase()+'">')+
    (sniper?'':row('윤곽선',toggle('cross:h',c.h??1))+row('윤곽선 불투명도',slider('cross:o',c.o??.5,0,1,.05))+row('윤곽선 두께',slider('cross:t',c.t??1,1,6,1)))+
    dotFields(c,sniper)+(sniper?'':lines(c,0,'안쪽 선')+lines(c,1,'바깥쪽 선'))+
    row('이동·사격 오차 반영',toggle('dynamic',s.dynamic));
}
function library(s,dialog){
  const full=s.profiles.length>=profileLimit,item=s.profiles[s.selected],card=(p,i,recommended)=>'<button class="profile-card" data-'+(recommended?'preset':'pick')+'="'+i+'" '+(recommended?(full?'disabled':''):'aria-pressed="'+(i===s.selected)+'"')+'><canvas data-example="'+escape(p.code)+'" width="64" height="64"></canvas><span>'+escape(p.name)+'</span></button>';
  return group('내 조준점 · '+s.profiles.length+' / '+profileLimit)+'<div class="profile-cards">'+s.profiles.map((p,i)=>card(p,i,false)).join('')+'</div>'+
    row('프로필 이름','<input data-pref="name" maxlength="32" value="'+escape(item.name)+'">')+
    '<div class="pref-tools">'+button('new','새로 만들기',full)+button('copy','복제',full)+button('import','코드 가져오기',full)+button('export','코드 내보내기')+button('delete','삭제',s.profiles.length===1)+'</div>'+
    (dialog==='import'?'<div class="pref-dialog"><label>조준점 코드<input id="crosshair-code" maxlength="700" spellcheck="false" placeholder="0;P;…"></label>'+button('apply','가져오기')+button('cancel','취소')+'</div>':
     dialog==='export'?'<div class="pref-dialog"><label>공유 코드<input id="export-code" readonly value="'+escape(item.code)+'"></label>'+button('clipboard','복사')+button('cancel','닫기')+'</div>':
     dialog==='delete'?'<div class="pref-dialog"><span>‘'+escape(item.name)+'’ 프로필을 삭제할까요?</span>'+button('confirm-delete','삭제')+button('cancel','취소')+'</div>':'')+
    group('기본 조준점 모음')+'<div class="profile-cards">'+templates.map(([name,code],i)=>card({name,code},i,true)).join('')+'</div><a class="pref-link" href="https://www.vcrdb.net/" target="_blank" rel="noopener noreferrer">조준점 코드 더 찾기 ↗</a>';
}
export function settingsPanel({s,save,close,custom,voice,preview,fullscreen},state){
  const root=document.createElement('div');root.className='preferences';
  const status=msg=>{const el=root.querySelector('.pref-status');if(el)el.textContent=msg;};
  const getSection=()=>state.sub[state.page]??Object.keys(sections[state.page]??{})[0];
  let capture=null,dialog='',micList=[],outputs=[],disposed=false;
  function previewCross(){
    const canvas=root.querySelector('#reticle-preview');
    if(canvas){const tab=getSection();reticle(canvas,parseCrosshair(s.profiles[s.selected].code),{ads:tab==='A',sniper:tab==='S'});}
    for(const c of root.querySelectorAll('canvas[data-example]'))reticle(c,parseCrosshair(c.dataset.example));
  }
  function draw(keepScroll=false){
    const top=keepScroll?root.querySelector('.pref-body')?.scrollTop??0:0;
    const page=state.page,tab=getSection();
    let html='';
    if(page==='general')html=group('마우스')+row('조준 감도',slider('sens',s.sens,.1,3,.05))+row('조준 사격·조준경 감도 배율',slider('adsSens',s.adsSens,.1,3,.05))+row('마우스 Y축 반전',toggle('invert',s.invert))+custom();
    if(page==='controls')html=group('키 설정')+Object.entries(bindings).map(([key,name])=>'<div class="pref-row"><span>'+name+'</span><button data-bind="'+key+'" aria-label="'+name+' 키 변경">'+(capture===key?'키 입력 대기…':keyName(s.keys[key]))+'</button></div>').join('')+button('reset-keys','조작 기본값 복원');
    if(page==='cross')html=tab==='library'?library(s,dialog):editor(s,tab);
    if(page==='video'){
      if(tab==='display')html=group('디스플레이')+row('화면 모드',button('fullscreen',document.fullscreenElement?'창 모드로 전환':'전체 화면으로 전환'))+row('최대 FPS',select('fpsCap',s.fpsCap,[0,30,60,90,120,144,240].map(n=>[n,n?n+' FPS':'제한 없음'])));
      if(tab==='quality')html=group('렌더링')+row('렌더링 해상도',select('quality',s.quality,[['auto','자동 · 적응형'],['low','낮음'],['medium','중간'],['high','높음']]))+row('안티앨리어싱',select('antialias',s.antialias,[['auto','자동'],['0','없음'],['2','MSAA 2×'],['4','MSAA 4×']]))+row('비네트 효과',toggle('vignette',s.vignette))+group('전장 텍스처')+row('텍스처 필터',select('texture',s.texture,[['nearest','최근접'],['linear','선형']]))+row('이방성 필터링',select('anisotropy',s.anisotropy,[1,2,4,8,16].map(n=>[n,n+'×'])));
      if(tab==='stats')html=group('성능 표시')+row('클라이언트 FPS',toggle('showFps',s.showFps))+row('프레임 시간',toggle('showFrame',s.showFrame));
    }
    if(page==='audio'){
      if(tab==='sounds')html=group('볼륨')+vol(s,'volume','전체 볼륨')+vol(s,'effects','효과음 볼륨')+vol(s,'interfaceVolume','인터페이스 볼륨')+'<div class="pref-tools">'+button('sample-effects','효과음 듣기')+button('sample-interface','인터페이스 소리 듣기')+'</div>';
      if(tab==='dialogue')html=group('요원 음성')+vol(s,'dialogue','음성 대사 볼륨')+button('sample-dialogue','요원 대사 듣기');
      if(tab==='voice')html=group('장치')+(voice.canRoute()?row('음성 출력 장치',select('voiceDevice',s.voiceDevice,[['','시스템 기본 장치'],...outputs.filter(d=>d.deviceId && d.deviceId!=='default').map((d,i)=>[d.deviceId,d.label||'출력 장치 '+(i+1)])])):'')+row('입력 장치',select('micDevice',s.micDevice,[['','시스템 기본 장치'],...micList.filter(d=>d.deviceId && d.deviceId!=='default').map((d,i)=>[d.deviceId,d.label||'마이크 '+(i+1)])]))+vol(s,'micGain','마이크 볼륨')+vol(s,'voiceOutput','수신 음성 볼륨')+row('루프백 테스트',button('loop',voice.testing()?'테스트 종료':'내 목소리 듣기'))+
        group('눌러서 말하기')+row('팀 음성 채팅 · '+keyName(s.keys.KeyV),toggle('teamVoice',s.teamVoice))+row('파티 음성 채팅 · '+keyName(s.keys.KeyU),toggle('partyVoice',s.partyVoice))+'<p class="pref-note">친구 방에서는 파티 음성이 양 팀에 전달됩니다. 루프백 테스트는 내 장치에서만 재생됩니다.</p>';
    }
    root.innerHTML='<header class="pref-header"><h2>설정</h2><nav aria-label="설정 분류">'+buttons(pages,page,'page')+'</nav><button data-cmd="close" aria-label="설정 닫기">×</button></header>'+
      (sections[page]?'<nav class="pref-sub" aria-label="세부 설정">'+buttons(sections[page],tab,'sub')+'</nav>':'')+
      '<div class="pref-body"><div class="pref-sheet">'+html+'</div></div><footer><output class="pref-status" role="status"></output>'+button('close','설정 닫기')+'</footer>';
    root.querySelector('.pref-body').scrollTop=top;previewCross();
  }
  async function devices(){try{const ds=await navigator.mediaDevices?.enumerateDevices();if(disposed || !ds)return;micList=ds.filter(d=>d.kind==='audioinput');outputs=ds.filter(d=>d.kind==='audiooutput');const out=root.querySelector('[data-pref=voiceDevice]');if(out)out.innerHTML=option('','시스템 기본 장치',s.voiceDevice)+outputs.filter(d=>d.deviceId && d.deviceId!=='default').map((d,i)=>option(d.deviceId,d.label||'출력 장치 '+(i+1),s.voiceDevice)).join('');const select=root.querySelector('[data-pref=micDevice]');if(select){select.innerHTML=option('','시스템 기본 장치',s.micDevice)+micList.filter(d=>d.deviceId&&d.deviceId!=='default').map((d,i)=>option(d.deviceId,d.label||'마이크 '+(i+1),s.micDevice)).join('');}}catch{}}
  function stopTest(){if(voice.testing())voice.stop();}
  root.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b||b.disabled||b.dataset.custom)return;
    event.stopPropagation();const d=b.dataset,cmd=d.cmd;
    if(d.page||d.sub){stopTest();dialog='';capture=null;if(d.page)state.page=d.page;else state.sub[state.page]=d.sub;draw();if(getSection()==='voice')void devices();return;}
    if(d.bind){capture=d.bind;draw(true);root.querySelector('[data-bind="'+capture+'"]').focus();return;}
    if(d.pick!==undefined){s.selected=Number(d.pick);dialog='';save();draw(true);return;}
    if(d.preset!==undefined){const [name,code]=templates[Number(d.preset)];addProfile(s,name,code);save();draw(true);return;}
    if(cmd==='close'){close();return;}
    if(cmd==='fullscreen'){try{await fullscreen();draw(true);}catch{status('이 브라우저에서 전체 화면을 사용할 수 없습니다.');}return;}
    if(cmd==='reset-keys'){s.keys=Object.fromEntries(Object.keys(bindings).map(k=>[k,k]));save();draw(true);return;}
    if(cmd?.startsWith('sample-')){preview(cmd.slice(7));return;}
    if(cmd==='loop'){if(voice.testing()){voice.stop();draw(true);}else{status('마이크 연결 중…');try{await voice.test();if(!disposed && getSection()==='voice'){draw(true);void devices();}}catch{status('마이크 사용 권한과 입력 장치를 확인하세요.');}}return;}
    if(['import','export','delete','cancel'].includes(cmd)){dialog=cmd==='cancel'?'':cmd;draw(true);root.querySelector('#crosshair-code,#export-code')?.focus();return;}
    if(cmd==='clipboard'){const input=root.querySelector('#export-code');input.select();try{await navigator.clipboard.writeText(input.value);status('공유 코드를 복사했습니다.');}catch{status('선택된 코드를 복사하세요.');}return;}
    if(cmd==='apply'){if(!addProfile(s,'가져온 조준점',root.querySelector('#crosshair-code').value)){status('조준점 코드 형식을 확인하세요.');return;}}
    else if(cmd==='new')addProfile(s,'새 프로필',defaultCode());
    else if(cmd==='copy')addProfile(s,s.profiles[s.selected].name+' 복사본',s.profiles[s.selected].code);
    else if(cmd==='confirm-delete')removeProfile(s);else return;
    dialog='';save();draw(true);
  });
  function changed(el,commit){
    const key=el.dataset.pref;if(!key)return;
    const tab=getSection();let v=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;
    if(key==='name' || key==='hexText'){if(!commit)return;}
    if(key==='name'){s.profiles[s.selected].name=v.trim().slice(0,32)||'내 조준점';}
    else if(key==='profile')s.selected=Number(v);
    else if(key==='inherit'){const p=parseCrosshair(s.profiles[s.selected].code);if(!Object.keys(p.A).length)p.A={...p.P};p.global.a=v?0:1;s.profiles[s.selected].code=serializeProfile(p);}
    else if(key==='hex'||key==='hexText'){if(!/^#?[a-f0-9]{6}$/i.test(v)){status('HEX 색상은 여섯 자리로 입력하세요.');return;}profileValue(s,tab,'color','#'+v.replace('#',''));}
    else if(key.startsWith('cross:'))profileValue(s,tab,key.slice(6),Number(v));
    else if(Object.hasOwn(defaults,key)){s[key]=typeof defaults[key]==='number'?Number(v):v;if(['micDevice','voiceDevice'].includes(key))stopTest();if(key==='voiceDevice')void voice.route().catch(()=>status('출력 장치를 연결할 수 없습니다. 시스템 기본 장치를 사용합니다.'));}
    else return;
    save();
    if(tab==='A' && (key.startsWith('cross:') || key==='hex' || key==='hexText')){
      const inherit=root.querySelector('[data-pref=inherit]');if(inherit){inherit.checked=false;inherit.parentElement.querySelector('output').value='꺼짐';}
    }
    const output=el.nextElementSibling;
    if(output?.tagName==='OUTPUT')output.value=output.dataset.percent==='1'?Math.round(v*100)+'%':v;
    if(el.type==='checkbox')el.parentElement.querySelector('output').value=v?'켜짐':'꺼짐';
    if(commit && (key==='name'||key==='profile'||key==='hexText'||key==='hex'||key==='cross:c'||key==='inherit'||key==='micDevice'||key==='voiceDevice'||key.endsWith('g')||tab==='A' && key.startsWith('cross:'))){draw(true);return;}
    previewCross();
  }
  root.addEventListener('input',e=>{if(e.target.matches('input[type=range],input[type=color]'))changed(e.target,false);});
  root.addEventListener('change',e=>{if(e.target.type!=='range')changed(e.target,true);});
  function keydown(e){
    if(capture){e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape'){capture=null;draw(true);return;}if(!bindKey(s,capture,e.code)){status('문자, 숫자, Shift, Ctrl, Tab 또는 Space를 입력하세요.');return;}capture=null;save();draw(true);return;}
    if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(dialog){dialog='';draw(true);}else close();}
  }
  document.addEventListener('keydown',keydown,true);
  const onFullscreen=()=>{if(state.page==='video'&&getSection()==='display')draw(true);};document.addEventListener('fullscreenchange',onFullscreen);
  draw();if(getSection()==='voice')void devices();
  return {root,dispose(){disposed=true;stopTest();document.removeEventListener('keydown',keydown,true);document.removeEventListener('fullscreenchange',onFullscreen);}};
}
