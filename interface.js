import { skinProfile, stageNames } from './skin-levels.js';
import timing from './ability-times.json' with { type: 'json' };
import demos from './ability-demos.json' with { type: 'json' };
import { AGENTS, WEAPONS, ARMOR, SLOTS, GAME_MODES, skillIcon } from './rules.js';
import { MAPS } from './arena.js';
import skins from './skins.json' with { type: 'json' };
export const escape = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const btn = (action, label, style = '') =>
  '<button class="' + style + '" data-action="' + action + '">' + label + '</button>';
export function lobby(map, mode) {
  return (
    '<header class="topbar"><b>VALORANT</b><nav>' +
    btn('home', '플레이', 'active') +
    btn('agents', '요원') +
    btn('collection', '컬렉션') +
    '</nav>' +
    btn('settings', '설정') +
    '</header>' +
    '<div class="lobby-art" aria-hidden="true"></div><section class="lobby-main"><span class="eyebrow">VALORANT // 플레이</span><h1>플레이</h1>' +
    '<div class="mode-tabs">' +
    GAME_MODES.map(
      (m) => '<button data-mode="' + m + '" aria-pressed="' + (mode === m) + '">' + m + '</button>',
    ).join('') +
    '</div>' +
    '<label class="field">맵<select id="map-choice">' +
    MAPS.map((m) => '<option ' + (m.name === map ? 'selected' : '') + '>' + m.name + '</option>').join('') +
    '</select></label>' +
    '<div class="row">' +
    btn('find', mode === '사용자 설정 게임' ? '방 만들기' : '대전 찾기', 'primary') +
    btn('join', '코드로 참가') +
    btn('tour', '맵 자유 연습') +
    '</div>' +
    '<button class="range-link" data-action="range"><span>◎</span><span><strong>사격장</strong><small>무기 시험 · 고정 표적 · 자유 구매</small></span><b>↗</b></button></section>'
  );
}
export function agentCards(id) {
  const a = AGENTS[id];
  return (
    '<div class="agent-layout"><div class="agent-roster">' +
    Object.values(AGENTS)
      .map(
        (o) =>
          '<button title="' +
          o.name +
          '" aria-label="' +
          o.name +
          '" data-agent="' +
          o.name +
          '" aria-pressed="' +
          (o === a) +
          '"><img src="' +
          o.icon +
          '" alt=""><small>' +
          o.name +
          '</small></button>',
      )
      .join('') +
    '</div>' +
    '<article class="agent-detail" style="--agent:' +
    a.color +
    '"><img class="agent-face" src="' +
    a.icon.replace('/agents-', '/agent-').replace('.png', '.webp') +
    '" alt=""><small>' +
    a.role +
    '</small><h2>' +
    a.name +
    '</h2>' +
    a.gear
      .map(
        (name, i) =>
          '<details ' +
          (i === 2 ? 'open' : '') +
          '><summary><img alt="" src="' +
          skillIcon(id, i) +
          '"><kbd>' +
          SLOTS[i] +
          '</kbd> ' +
          escape(name) +
          '</summary><p>' +
          escape(a.info[i]) +
          '</p>' +
          [
            ['equip time', '장착'],
            ['duration', '지속'],
            ['unequip time', '무기 복귀'],
          ]
            .filter(([k]) => timing[name]?.[k] !== undefined)
            .map(([k, label]) => label + ' ' + timing[name][k] + '초')
            .join(' · ') +
          (demos[name]
            ? '<details class="ability-demo"><summary>스킬 시연</summary><video controls playsinline preload="none" src="' +
              demos[name] +
              '"></video></details>'
            : '') +
          '</details>',
      )
      .join('') +
    (a.passive ? '<small>기본 지속 효과 · ' + escape(a.passive) + '</small>' : '') +
    '</article></div>'
  );
}
export function gunDetail(id) {
  const w = WEAPONS[id];
  const stat = (tag, v) => '<div><dt>' + tag + '</dt><dd>' + v + '</dd></div>';
  return (
    '<aside class="weapon-detail"><small>' +
    w.type +
    '</small><h2>' +
    w.name +
    '</h2><img src="' +
    w.icon +
    '" alt=""><dl>' +
    stat('탄창 / 예비탄', w.size + ' / ' + w.reserve) +
    stat(
      '초탄 오차 (기본 / 조준)',
      w.accuracy + '° / ' + (w.ads ? Math.max(0, w.ads.firstBulletAccuracy) + '°' : '—'),
    ) +
    stat('초당 발사 수', (1 / w.interval).toFixed(2)) +
    stat('재장전', w.reload + '초') +
    '</dl><table><thead><tr><th>거리</th><th>머리</th><th>몸통</th><th>다리</th></tr></thead><tbody>' +
    w.damageRanges
      .map(
        (r) =>
          '<tr><td>' +
          r.rangeStartMeters +
          '–' +
          r.rangeEndMeters +
          'm</td><td>' +
          Math.round(r.headDamage) +
          '</td><td>' +
          r.bodyDamage +
          '</td><td>' +
          Math.round(r.legDamage) +
          '</td></tr>',
      )
      .join('') +
    '</tbody></table></aside>'
  );
}
export function armory(p, id, free) {
  const categories = ['Pistols', 'SMGs', 'Shotguns', 'Rifles', 'Sniper Rifles', 'Heavy Weapons'];
  const groups = categories
    .map((category) => {
      const guns = Object.entries(WEAPONS)
        .filter(([, w]) => w.category === category)
        .sort((a, b) => a[1].cost - b[1].cost);
      return (
        '<div class="weapon-group"><h3>' +
        guns[0][1].type +
        '</h3>' +
        guns
          .map(
            ([key, w]) =>
              '<button data-inspect="' +
              key +
              '" data-buy="' +
              key +
              '" class="gun-card" aria-disabled="' +
              (!free && p.credits < w.cost) +
              '"><img src="' +
              w.icon +
              '" alt=""><span>' +
              w.name +
              '<small>' +
              w.cost.toLocaleString() +
              ' ₡</small></span></button>',
          )
          .join('') +
        '</div>'
      );
    })
    .join('');
  return (
    '<header class="sheet-head"><div><span class="eyebrow">' +
    (free ? '사격장 / 장비' : '구매 단계') +
    '</span><h2>구매 메뉴</h2></div><b>' +
    (free ? '∞' : p.credits) +
    ' ₡</b>' +
    btn('back-game', '닫기 [B]') +
    '</header><div class="armory"><div class="weapon-grid">' +
    groups +
    '</div><div id="gun-details">' +
    gunDetail(id) +
    '</div></div>' +
    '<div class="equipment-row">' +
    Object.entries(ARMOR)
      .map(([key, v]) => '<button data-buy="' + key + '">' + v.name + ' · ' + v.cost + ' ₡</button>')
      .join('') +
    AGENTS[p.agent].gear
      .slice(0, 3)
      .map(
        (n, i) =>
          '<button data-buy="skill-' +
          i +
          '">' +
          SLOTS[i] +
          ' ' +
          n +
          ' · ' +
          (AGENTS[p.agent].economy[i].cost ? '충전 ' + AGENTS[p.agent].economy[i].cost + ' ₡' : '기본 스킬') +
          '</button>',
      )
      .join('') +
    '</div>'
  );
}
import skinSources from './skin-sources.json' with {type:'json'};
export function collection(gun, equipped, options = {},agent='제트') {
  const selected = equipped[gun],
    items = skins[gun] ?? [];
  return (
    '<header class="sheet-head"><h2>컬렉션</h2>' +
    btn('home', '돌아가기') +
    '</header><label class="field">무기<select id="collection-weapon">' +
    Object.keys(skins)
      .map(
        (id) =>
          '<option value="' +
          id +
          '" ' +
          (gun === id ? 'selected' : '') +
          '>' +
          WEAPONS[id].name +
          '</option>',
      )
      .join('') +
    '</select></label><div id="weapon-turntable" aria-label="3D 무기 미리보기"></div><small>드래그해서 회전</small>' +
    '<div class="collection-actions"><label>미리보기 요원 <select id="preview-agent">'+Object.keys(AGENTS).map(n=>'<option'+(n===agent?' selected':'')+'>'+escape(n)+'</option>').join('')+'</select></label>'+
    [['model','외형 회전'],['equip','장착'],...(gun==='melee'?[]:[['reload','재장전']]),['inspect','살펴보기']].map(([id,label])=>'<button data-preview="'+id+'" aria-pressed="'+(id==='model')+'">'+label+'</button>').join('')+'</div>'+
    (skinSources[selected]?'<a class="skin-reference" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/watch?v='+skinSources[selected]+'">스킨 시연 영상</a>':'')+
    skinPreviews(
      skinProfile(
        items.find((s) => s.id === selected),
        options[selected],
      ),
    ) +
    '<div class="skin-grid"><button data-skin="" aria-pressed="' +
    !selected +
    '"><img src="' +
    WEAPONS[gun].icon +
    '" alt="">기본 ' +
    WEAPONS[gun].name +
    '</button>' +
    items
      .map(
        (s) =>
          '<button data-skin="' +
          s.id +
          '" aria-pressed="' +
          (s.id === selected) +
          '"><img loading="lazy" src="' +
          escape(s.image) +
          '" alt="">' +
          escape(s.name) +
          '</button>',
      )
      .join('') +
    '</div>'
  );
}
export function settingsForm(s) {
  return (
    '<h2>설정</h2><div class="settings-grid"><label>마우스 감도 <input id="s-sens" type="range" min=".1" max="3" step=".05" value="' +
    s.sens +
    '"><output>' +
    s.sens +
    '</output></label>' +
    '<label>전체 음량 <input id="s-volume" type="range" min="0" max="1" step=".05" value="' +
    s.volume +
    '"><output>' +
    s.volume +
    '</output></label><label>조준점 색상 <input id="s-color" type="color" value="' +
    s.color +
    '"></label>' +
    '<label>이동·사격 오차 표시 <input id="s-dynamic" type="checkbox" ' +
    (s.dynamic ? 'checked' : '') +
    '></label><label for="crosshair-code">발로란트 조준점 코드</label><a class="skin-reference" target="_blank" rel="noopener noreferrer" href="https://www.vcrdb.net/">조준점 코드 찾기 ↗</a><input id="crosshair-code" maxlength="700" spellcheck="false" placeholder="0;P;…" value="'+escape(s.crosshairCode??'')+'">' +
    '<div class="reticle-preview"><canvas id="reticle-preview" width="160" height="160"></canvas><div>'+btn('import-reticle','코드 적용')+btn('reset-reticle','기본값')+'</div></div><output id="reticle-result" role="status"></output></div>' +
    btn('settings-back', '돌아가기')
  );
}

function skinPreviews(s) {
  if (!s) return '';
  const levels = s.levels ?? ['Model'];
  const option = (value, name, selected) =>
    '<option value="' +
    escape(value) +
    '"' +
    (selected ? ' selected' : '') +
    '>' +
    escape(name) +
    '</option>';
  const color = s.variants?.find((v) => v.id === s.variant);
  const clip = color?.clip ? { url: color.clip } : s.clips?.find((c) => c.level === s.level);
  const preview = clip
    ? '<a class="skin-reference" target="_blank" rel="noopener noreferrer" href="'+escape(clip.url)+'">' +
      escape(s.name) +
      ' · ' +
      s.level +
      '레벨' +
      (color?.clip ? ' · ' + escape(color.name) : '') +
      ' 공식 시연 ↗</a>'
    : '';
  return (
    '<div class="skin-loadout"><img src="' +
    escape(s.image) +
    '" alt="' +
    escape(s.name) +
    '"><label class="field">장착 레벨<select id="skin-level">' +
    levels
      .map((l, i) => option(i + 1, i + 1 + '레벨 · ' + (stageNames[l] ?? l), i + 1 === s.level))
      .join('') +
    '</select></label>' +
    (s.variants?.length
      ? '<label class="field">색상<select id="skin-variant"' +
        (s.level === levels.length ? '' : ' disabled') +
        '>' +
        option('', '기본', !s.variant) +
        s.variants.map((v) => option(v.id, v.name, v.id === s.variant)).join('') +
        '</select></label>'
      : '') +
    btn('try-skin', '사격장에서 사용') +
    '</div>' +
    preview
  );
}
