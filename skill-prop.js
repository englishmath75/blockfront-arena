import * as T from 'three';

const styles = {
  세이지: ['jade', '#49d5c2'],
  오멘: ['shadow', '#8862e8'],
  페이드: ['eye', '#c5597a'],
  레이나: ['eye', '#da50fc'],
  네온: ['bolt', '#50ceff'],
  웨이레이: ['prism', '#ffdb62'],
  제트: ['wind', '#c5f8ff'],
  피닉스: ['fire', '#ff8e30'],
  하버: ['water', '#44dfce'],
  아스트라: ['star', '#cb8dff'],
  클로브: ['wing', '#edabff'],
  스카이: ['leaf', '#a7ef8c'],
  아이소: ['prism', '#ab83ff'],
  바이스: ['leaf', '#cbaff9'],
  브리치: ['bracer', '#ffb148'],
  테호: ['tablet', '#ffbe57'],
  브림스톤: ['tablet', '#f7a246'],
  믹스: ['wave', '#72ffc6'],
  바이퍼: ['bracer', '#95f53c'],
  비토: ['prism', '#82fa9b'],
  허시: ['wave', '#63b5ff'],
  요루: ['shadow', '#497dff'],
  '케이/오': ['bracer', '#957dff'],
  체임버: ['card', '#eec371'],
  킬조이: ['bracer', '#f5de65'],
  사이퍼: ['bracer', '#8de5ff'],
};
const globe = new T.SphereGeometry(1, 24, 16),
  shard = new T.OctahedronGeometry(1),
  band = new T.TorusGeometry(1, 0.044, 6, 48),
  box = new T.BoxGeometry(1, 1, 1);
const lightning = new T.BufferGeometry().setFromPoints(
  [
    [-0.059, -0.006, 0.012],
    [-0.024, 0.037, -0.012],
    [-0.015, 0.008, 0.006],
    [0.013, 0.053, 0],
    [0.027, 0.025, 0.008],
    [0.065, 0.072, -0.014],
  ].map((p) => new T.Vector3(...p)),
);
const bare = new Set([
  '순풍',
  '상승 기류',
  '고속 기어',
  '광속',
  '무시',
  '포식',
  '여제',
  '진화',
  '역습',
  '활력 회복',
  '부활',
  '재생',
  '어둠의 발자국',
]);

export function abilityProp(agent, skill) {
  const root = new T.Group();
  const [kind, tint] = styles[agent] ?? ['prism', '#88cdef'];
  const core = new T.Group();
  root.add(core);
  const accent = new T.MeshBasicMaterial({ color: tint });
  const shell = new T.MeshStandardMaterial({
    color: tint,
    metalness: 0.28,
    roughness: 0.28,
    emissive: tint,
    emissiveIntensity: 0.22,
  });
  const dark = new T.MeshStandardMaterial({ color: '#182333', metalness: 0.5, roughness: 0.36 });
  const glass = new T.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.33, depthWrite: false });
  function piece(geometry, mat, size, pos = [0, 0, 0]) {
    const o = new T.Mesh(geometry, mat);
    o.scale.set(...size);
    o.position.set(...pos);
    core.add(o);
    return o;
  }
  const orbit = [];
  if (!bare.has(skill)) {
    if (kind === 'tablet' || kind === 'bracer' || kind === 'card') {
      const tablet = kind === 'tablet',
        w = tablet ? 0.16 : 0.083,
        h = tablet ? 0.1 : 0.061;
      piece(box, dark, [w, h, 0.018]);
      piece(box, shell, [w * 0.86, h * 0.79, 0.006], [0, 0, 0.012]);
      for (let j = 0; j < 3; j++)
        piece(box, accent, [w * (0.32 + j * 0.1), 0.002, 0.003], [-w * 0.05, (j - 1) * 0.012, 0.016]);
    } else if (kind === 'bolt') {
      for (let i = 0; i < 3; i++) {
        const line = new T.Line(lightning, accent);
        line.rotation.y = i * 2.1;
        core.add(line);
        orbit.push(line);
      }
    } else if (kind === 'eye') {
      piece(globe, shell, [0.068, 0.049, 0.047]);
      piece(globe, dark, [0.016, 0.032, 0.008], [0, 0, 0.045]);
      piece(globe, accent, [0.006, 0.023, 0.004], [0, 0, 0.052]);
    } else if (['jade', 'shadow', 'wind', 'water', 'wave', 'star'].includes(kind)) {
      piece(globe, glass, [0.067, 0.067, 0.067]);
      piece(kind === 'jade' || kind === 'star' ? shard : globe, shell, [0.043, 0.048, 0.043]);
      for (let i = 0; i < 3; i++) {
        const r = 0.069 + i * 0.004,
          b = piece(band, i === 1 ? glass : accent, [r, r, r]);
        b.rotation.set(i * 0.92, 0.35 + i * 0.55, 0.28 + i * 0.36);
        orbit.push(b);
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3,
          r = kind === 'fire' ? 0.025 : 0.037;
        const p = piece(
          shard,
          i % 2 ? shell : accent,
          [0.016, 0.042 + (i % 2) * 0.012, 0.013],
          [r * Math.cos(a), (i % 2) * 0.014, r * Math.sin(a)],
        );
        p.rotation.z = -Math.cos(a) * 0.46;
        p.rotation.x = Math.sin(a) * 0.46;
        orbit.push(p);
      }
    }
  }
  root.userData.animate = (t, tag, ratio) => {
    const casting = ['cast', 'fire', 'throw', 'place', 'short throw'].includes(tag);
    const release = casting ? Math.max(0, 1 - Math.max(0, ratio - 0.35) * 3) : 1;
    core.scale.setScalar(release);
    core.position.y = Math.sin(t * 3.2) * 0.003;
    if (kind === 'bolt') core.rotation.y = t * 4;
    for (let i = 0; i < orbit.length; i++) orbit[i].rotation.y = t * (0.72 + 0.17 * i) + i * 1.33;
  };
  root.userData.release = () => {
    for (const m of [accent, shell, dark, glass]) m.dispose();
  };
  return root;
}
