import * as T from 'three';
import {stickPack} from './blast-pack.js';
export const arrowNames = ['충격 화살', '정찰용 화살'];
export const tabletNames = [
  '공중 연막',
  '궤도 일격',
  '계략',
  '웨이브폼',
  '유도 일제 사격',
  '아마겟돈',
  '그림자 습격',
  '우주 장벽',
];
const throws = {
  '릴레이 볼트': ['relay', 28, 5, 5],

  '폭풍 쇄도': ['storm', 23, 9, 2],
  포화: ['saturate', 22, 12, 1],
  섬광등: ['flare', 21, 0, 1.5],
  '진형 붕괴': ['collapse', 21, 0, 1.5],
  '일체 정지': ['suspension', 14, 0, 2],
  '독성 연기':['poisonCan',17,12,7],목조르기:['vetoTrap',17,13,6],
  'M-파동': ['mpulse', 19, 12, 3],
  장벽망: ['barrier', 19, 12, 3],
  '특별 배송': ['delivery', 22, 8, 3],
  귀체: ['haunt', 18, 8, 1.5],
  포박: ['seize', 18, 8, 1.5],
  중력그물: ['net', 19, 12, 4],
  '폭파봇 지옥': ['mosh', 17, 13, 4],
  피해망상: ['paranoia', 20, 0, 1.7],
  기습: ['blindside', 21, 12, 4],
  간섭:['meddle',22,11,8],
  약화:['undercut',22.5,0,1.55],
  '충격 화살': ['shock', 38, 7, 8],
  '정찰용 화살': ['recon', 38, 7, 8],
  페인트탄: ['paint', 17, 15, 2.1],
  '둔화 구슬': ['slow', 16, 13, 6],
  소이탄: ['fire', 20, 13, 5],
  '뜨거운 손': ['fire', 18, 16, 8],
  '뱀 이빨': ['fire', 24, 12, 6],
  '파편/탄': ['fragment', 18, 13, 4],
  '플래시/드라이브': ['flash', 18, 12, 1.6],
  커브볼: ['curve', 10, 0, 0.6],
  '인도하는 빛': ['hawk', 18, 0, 2],
  '연막 폭발': ['cloud', 24, 0, 2],
  '제로/포인트': ['knife', 27, 10, 7],
  '폭발 팩': ['satchel', 9, 15, 4],
  '사이버 감옥':['cageDisc',15,14,6],
  '대미 장식': ['rocket', 35, 0, 4],
  '자극제 신호기': ['stim', 8, 15, 3],
  '면도날 덩굴':['vinePod',17,14,5],
  나노스웜: ['swarm', 17, 14, 4],
};
export const hasThrow = (n) => Object.hasOwn(throws, n);
export const shortThrows = [
  '플래시/드라이브',
  '페인트탄',
  '파편/탄',
  '뜨거운 손',
  '커브볼',
  '특별 배송',
  '중력그물',
  '폭파봇 지옥',
  '나노스웜','독성 연기','목조르기',
  '지원봇',
  '대비책',
  '관문 충돌',
  '기만',
  '화음',
  '광속',
  '아크 장미',
  '섬광등',
  '진형 붕괴',
];
export function launch(name, p, params, now, id) {
  const [type, base, gravity, fuse] = throws[name],
    arrow = arrowNames.includes(name),
    speed =
      params.alt && ['flare', 'collapse'].includes(type)
        ? 0
        : arrow
          ? 13 + base * params.charge
          : base * (params.alt && type !== 'curve' ? 0.53 : 1);
  const cp=Math.cos(p.pitch),offset=['flare','collapse','suspension'].includes(type)?.48:0;
  return {
    id,
    name,
    type,
    owner: p.id,
    x:p.x-Math.sin(p.yaw)*cp*offset,
    y:p.y+p.height-.07+Math.sin(p.pitch)*offset,
    z:p.z-Math.cos(p.yaw)*cp*offset,
    vx: -Math.sin(p.yaw) * cp * speed,
    vy: Math.sin(p.pitch) * speed,
    vz: -Math.cos(p.yaw) * cp * speed,
    gravity,
    bounces: arrow ? params.bounces : type === 'relay' || (type === 'delivery' && params.alt) ? 1 : 0,
    end:
      now +
      (['flare', 'collapse'].includes(type)
        ? params.alt
          ? 8
          : 3
        : type === 'flash' && params.alt
          ? 1
          : fuse),
    turn: type === 'curve' ? (params.alt ? -3.5 : 3.5) : 0,
    created: now,
    stuck: false,
    alt: !!params.alt,
    heal: !!params.heal,
  };
}
export function flight(a, dt, now, world, devices, owner) {
  if (['haunt','seize'].includes(a.type) && now >= a.end && !a.dropping) {
    Object.assign(a, { vx:0, vy:-10, vz:0, dropping:true, end:now+10 });
  }
  if (now >= a.end) return true;
  if (a.stuck) return false;
  if ((a.steer && owner) || (a.type === 'suspension' && owner)) {
    const speed = Math.hypot(a.vx, a.vy, a.vz),
      cp = Math.cos(owner.pitch);
    a.vx = -Math.sin(owner.yaw) * cp * speed;
    a.vy = Math.sin(owner.pitch) * speed;
    a.vz = -Math.cos(owner.yaw) * cp * speed;
  }
  if (a.type === 'hawk' && owner?.guiding) {
    const cp = Math.cos(owner.pitch);
    a.vx = -Math.sin(owner.yaw) * cp * 18;
    a.vy = Math.sin(owner.pitch) * 18;
    a.vz = -Math.cos(owner.yaw) * cp * 18;
  }
  if (a.type === 'cloud' && owner?.guiding) {
    const cp = Math.cos(owner.pitch);
    a.vx = -Math.sin(owner.yaw) * cp * 24;
    a.vy = Math.sin(owner.pitch) * 24;
    a.vz = -Math.cos(owner.yaw) * cp * 24;
  }
  if (a.turn) {
    const t = a.turn * dt,
      c = Math.cos(t),
      s = Math.sin(t);
    [a.vx, a.vz] = [a.vx * c + a.vz * s, a.vz * c - a.vx * s];
  }
  if(a.name==='뜨거운 손' && now-a.created>1.5){a.vx=a.vz=0;a.vy=Math.min(-7,a.vy);}
  a.vy -= a.gravity * dt;
  const vel = new T.Vector3(a.vx, a.vy, a.vz),
    len = vel.length(),
    dist = len * dt;
  if (!len) return false;
  const dir = vel.clone().normalize(),
    from = new T.Vector3(a.x, a.y, a.z),
    ray = new T.Ray(from, dir),
    hit = {};
  const distance = ['paranoia', 'undercut'].includes(a.type)
      ? dist
      : world.mapHit(ray, dist, devices, false, hit),
    point = ray.at(distance, new T.Vector3());
  Object.assign(a, { x: point.x, y: point.y, z: point.z });
  if (distance >= dist - 0.0001) return false;
  const norm = hit.normal ? new T.Vector3(...hit.normal) : dir.clone().negate();
  a.x += norm.x * 0.035;
  a.y += norm.y * 0.035;
  a.z += norm.z * 0.035;
  if (['fire','meddle','slow','mosh','haunt','seize','cageDisc','fragment','poisonCan','vetoTrap','vinePod','swarm','storm','mpulse'].includes(a.type) && norm.y < .55) {
    vel.reflect(norm).multiplyScalar(.65);
    Object.assign(a,{vx:vel.x,vy:vel.y,vz:vel.z});
    return false;
  }
  if(a.name==='소이탄' && norm.y>=.55 && (a.floorBounces??0)<2 && Math.abs(vel.y)>2.6){
    a.floorBounces=(a.floorBounces??0)+1;vel.reflect(norm).multiplyScalar(.43);
    Object.assign(a,{vx:vel.x,vy:vel.y,vz:vel.z});return false;
  }
  if(a.type==='satchel'){stickPack(a,norm,now);return false}
  if (a.type==='recon') a.surfaceNormal=norm.toArray();
  if (a.bounces > 0) {
    if (a.type === 'relay') a.impactPoint = { x: a.x, y: a.y, z: a.z };
    a.bounces--;
    vel.reflect(norm).multiplyScalar(0.9);
    Object.assign(a, { vx: vel.x, vy: vel.y, vz: vel.z });
    return false;
  }
  if (a.type === 'flash' && a.name === '플래시/드라이브') {
    vel.reflect(norm).multiplyScalar(0.52);
    Object.assign(a, { vx: vel.x, vy: vel.y, vz: vel.z, end: a.alt ? a.end : Math.min(a.end, now + 0.8) });
    return false;
  }
  if (a.type === 'blindside' && !a.stuck) {
    vel.reflect(norm).multiplyScalar(0.55);
    Object.assign(a, { vx: vel.x, vy: vel.y, vz: vel.z, type: 'flash', end: now + 0.6 });
    return false;
  }
  if (a.type==='flare') {
    a.stuck=true;
    a.end=now+.5;
    return false;
  }
  if(a.type==='paint' || a.type==='bomblet'){
    vel.reflect(norm).multiplyScalar(.47);
    if(norm.y>.66 && vel.length()<1.7)a.stuck=true;
    Object.assign(a,{vx:vel.x,vy:vel.y,vz:vel.z});return false;
  }
  if (['flash', 'curve', 'hawk'].includes(a.type)) {
    a.stuck = true;
    return false;
  }
  return true;
}
export const projectileColor = {
  satchel:'#ffac43',
  hawk: '#76e74e',
  shock: '#69bfff',
  recon: '#62edff',
  paint: '#f69331',
  flash: '#aeccff',
  curve: '#ffb84f',
  rocket: '#ec9349',
  cloud: '#c5f3ff',
  knife: '#b6a1ff',
  slow: '#70eedf',
};
export function accessHint(name, charge, bounces, marks) {
  if(['섬광등','진형 붕괴'].includes(name))return '좌클릭 발사 · 우클릭 공중 고정 · 스킬 키로 조준점에 유도';
  if(name==='일체 정지')return '좌클릭 발사 · 시선으로 유도 · 다시 좌클릭해 부유장 전개';
  if (name === '우주 장벽') return 'WASD 이동 · Space/Ctrl 높이 · 좌클릭 별 · C/Q/E 활성화 · F 회수 · 우클릭 장벽 두 지점';
  if(name==='포탑')return '좌클릭 설치 · E 방향 반전 · 설치 후 E를 길게 눌러 회수';
  if(name==='알람봇')return '좌클릭 설치 · 설치 후 Q를 길게 눌러 회수';
  if(name==='면도날 덩굴' || name==='나노스웜')return '좌클릭 투척 · 설치물을 조준하고 F로 작동';
  if(name==='아크 장미')return '좌클릭 벽에 설치 · 우클릭 벽 너머 설치 · E 섬광 · F 회수';
  if (name === 'M-파동') return '우클릭 치유·뇌진탕 전환 · 좌클릭 투척';
  if (name === '지원봇') return '좌클릭 추격 · 설치 지점 또는 스파이크 조준 후 우클릭';
  if(name==='관문 충돌')return '좌클릭 이동하는 관문 · 우클릭 제자리에 설치 · E 순간이동 · 관문 조준 후 F 속임수';
  if(name==='대비책')return '좌클릭 빠른 방벽 · 우클릭 느린 방벽';
  if (name === '기만') return '좌클릭 분신 전개 · 우클릭 표식 설치 · F 활성화';
  if (arrowNames.includes(name))
    return '좌클릭 유지 후 놓기 · 충전 ' + Math.round(charge * 100) + '% · 우클릭 반사 ' + bounces + '/2';
  if (['공중 연막', '계략', '웨이브폼', '유도 일제 사격'].includes(name))
    return '좌클릭 위치 표시 ' + marks + ' · 우클릭 일제 전개';
  if (name === '아마겟돈') return '좌클릭 시작점 · 두 번째 좌클릭 방향 확정 · 우클릭 취소';
  if (name === '그림자 습격') return '좌클릭 이동 위치 지정 · X 취소';
  if (name === '균열') return '좌클릭 유지 후 놓기 · 충전 ' + Math.round(charge * 100) + '%';
  if (name === '궤도 일격') return '지도에 좌클릭해 궤도 일격 지정';
  if (name === '회복 구슬') return '좌클릭 아군 치유 · 우클릭 자가 치유';
  if (name === '장벽 구슬') return 'C 방향 전환 · 우클릭 유지 후 마우스로 회전 · 좌클릭 설치';
  if (name === '인도하는 빛') return '좌클릭 유지로 매 유도 · E로 섬광 폭발';
  if (name === '불길') return '좌클릭 유지 · 시선으로 불벽 유도';
  if (name === '커브볼') return '좌클릭 왼쪽 · 우클릭 오른쪽';
  if (shortThrows.includes(name)) return '좌클릭 멀리 던지기 · 우클릭 가깝게 던지기';
  return '좌클릭 사용 · 무기 키로 취소';
}
