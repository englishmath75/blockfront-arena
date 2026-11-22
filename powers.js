// Shared effect primitives for the voxel adaptation. Bind by the localized ability
// name because source-file slot ordering differs between agents.
const groups = {
  jump: '상승 기류',
  dash: '순풍|광속|고속 기어',
  knives: '칼날 폭풍',
  slow: '둔화 구슬|포박|진형 붕괴|격류|면도날 덩굴|중력그물|포화|중력의 샘',
  heal: '회복 구슬|재생|포식|활력 회복|화음',
  revive: '부활|아직 안 죽었어',
  smoke: '연막 폭발|어둠의 장막|공중 연막|독성 연기|독사의 구덩이|사이버 감옥|성운|해만|계략',
  wall: '장벽 구슬|장벽망|가지치기|우주 장벽|불길|독성 장막|만조|폭풍 쇄도|추월 차선|대비책',
  blink: '어둠의 발자국|그림자 습격|관문 충돌|랑데부|굴절|지름길',
  flash: '피해망상|섬광 폭발|플래시/드라이브|인도하는 빛|커브볼|기습|눈총|아크 장미|기절봇|섬광등',
  scan: '황혼|정찰용 화살|올빼미 드론|신경 절도|스파이캠|추적귀|귀체|정찰자|추적자|잠입 드론|기만|제로/포인트',
  damage:
    '충격 화살|사냥꾼의 분노|페인트탄|대미 장식|폭발 봇|폭발 팩|궤도 일격|여진|지진 강타|유도 일제 사격|아마겟돈|폭파봇 지옥|소멸|요동치는 베이스|심판|청부 계약|오버드라이브',
  fire: '소이탄|뜨거운 손|뱀 이빨|파편/탄|나노스웜',
  trap: '함정|음향 센서|트레이드마크|알람봇|포탑|봉쇄|지원봇|요격기|목조르기',
  stun: '균열|특별 배송|요동봇|신성 파동|릴레이 볼트|M-파동|일체 정지|초점 교차|강철 정원|간섭|약화',
  stim: '자극제 신호기|여제|무력화/명령|진화|웨이브폼',
  phase: '무시|차원 표류',
  shield: '구슬 보호막',
  recall: '역습',
  sidearm: '헤드헌터',
  sniper: '역작',
};
export const effects = Object.fromEntries(
  Object.entries(groups).flatMap(([effect, names]) => names.split('|').map((name) => [name, effect])),
);
