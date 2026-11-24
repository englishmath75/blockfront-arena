import {mapSecrets,tricks,secretCatalog} from './secrets.js';

const chapters={
  maps:{label:'전장',entries:Object.entries(mapSecrets).map(([,item])=>[item.id,item])},
  agents:{label:'요원',entries:Object.entries(tricks).filter(([,item])=>item.agent!=='대전 전적')},
  duels:{label:'전적',entries:Object.entries(tricks).filter(([,item])=>item.agent==='대전 전적')},
};

export function secretJournal(found,chapter='maps'){
  const current=chapters[chapter]??chapters.maps;
  const total=Object.keys(secretCatalog).length;
  const navigation=Object.entries(chapters).map(([key,{label,entries}])=>
    '<button data-action="journal-'+key+'" aria-pressed="'+(current===chapters[key])+'">'+label+' <small>'+entries.filter(([id])=>found.has(id)).length+' / '+entries.length+'</small></button>').join('');
  const cards=current.entries.map(([id,item])=>{
    const known=found.has(id);
    return '<li class="secret-page'+(known?' found':'')+'"><span class="secret-stamp" aria-hidden="true">'+(known?'✦':'◇')+'</span><div><small>'+(item.map??item.agent)+'</small><h3>'+(known?item.title:'미발견')+'</h3><p>'+(known?item.detail:item.hint)+'</p></div></li>';
  }).join('');
  return '<div class="journal-heading"><div><h2>발견 수첩</h2><p>전장에서 주운 단서와 직접 발견한 비밀이 이 브라우저에 기록됩니다.</p></div><span class="journal-count"><b>'+found.size+'</b> / '+total+'</span></div>'+
    '<nav class="journal-nav" aria-label="수첩 분류">'+navigation+'</nav><ul class="secret-pages">'+cards+'</ul>'+
    '<div class="journal-foot"><small>각 비밀의 보상은 라운드마다 한 번 발동합니다.</small><button data-action="secrets-back">돌아가기</button></div>';
}
