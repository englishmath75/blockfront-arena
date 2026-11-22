import finishers from './finisher-frames.json' with { type: 'json' };
import artwork from './art-levels.json' with { type: 'json' };
import variantFinishes from './finisher-variants.json' with { type: 'json' };
const profiles = new WeakMap();
export const stageNames = {
  Model: '외형',
  SoundEffects: '음향',
  VFX: '시각 효과',
  Animation: '애니메이션',
  Finisher: '마무리',
  KillBanner: '처치 배너',
  InspectAndKill: '살펴보기·처치',
  TopFrag: '챔피언의 오라',
  Transformation: '변신',
  KillEffect: '처치 효과',
  KillCounter: '처치 수',
  FishAnimation: '수족관',
  SongShuffle: '음악 전환',
  Voiceover: '음성',
  HeartbeatAndMapSensor: '심박·지도 센서',
  Randomizer: '무작위 효과',
  AttackerDefenderSwap: '공수 전환',
};
export function skinProfile(s, choice = {}) {
  if (!s) return;
  const levels = s.levels ?? ['Model'],
    level = Number.isInteger(choice?.level)
      ? Math.max(1, Math.min(levels.length, choice.level))
      : levels.length;
  const variant = level === levels.length ? s.variants?.find((v) => v.id === choice?.variant) : null,
    key = level + '/' + (variant?.id ?? '');
  let pool = profiles.get(s);
  if (!pool) {
    pool = new Map();
    profiles.set(s, pool);
  }
  if (pool.has(key)) return pool.get(key);
  const at = (type) => levels.indexOf(type) + 1,
    enabled = (type) => !at(type) || level >= at(type);
  const soundOn = enabled(at('SoundEffects') ? 'SoundEffects' : 'VFX'),
    motionOn = enabled('Animation');
  const art = artwork[s.id];
  const layer =
    art && level < levels.length
      ? Object.entries(art.lev)
          .filter(([n]) => Number(n) <= level)
          .at(-1)?.[1]
      : null;
  const original = art ? '/skin-art/' + (layer || art.full) + '.webp' : s.image;
  const p = {
    ...s,
    profileKey: s.id + '/' + key,
    level,
    variant: variant?.id,
    sourceImage: original,
    image: variant ? '/variants/' + variant.id + '.webp' : original,
    soundOn,
    motionOn,
    visualOn: enabled(at('VFX') ? 'VFX' : 'SoundEffects'),
    finishOn: enabled('Finisher'),
    inspectOn: enabled('InspectAndKill'),
    killOn: enabled(
      at('InspectAndKill')
        ? 'InspectAndKill'
        : at('KillBanner')
          ? 'KillBanner'
          : at('KillEffect')
            ? 'KillEffect'
            : 'Finisher',
    ),
    topFragOn: enabled('TopFrag') && !!at('TopFrag'),
  };
  p.family ??= {
    '1b9b0131-42fe-b6a7-d212-699b342ba642': 'rogue',
    'b0f65660-4c51-13b7-9d01-e29a1e2879b0': 'champions23',
    'd6c7ff28-467e-bb3f-3c0c-c5b9445e55ca': 'singularity',
  }[s.id];
  if (levels.includes('Finisher') && p.finishOn) {
    const saved = variantFinishes[p.variant] ?? 'set-' + s.banner;
    p.family = Object.hasOwn(finishers, saved)
      ? saved
      : (p.family ??
        {
          elderflame: 'dragon',
          reaver: 'reaver',
          prime: 'prime',
          ion: 'ion',
          singularityep9: 'singularity',
          rogue: 'rogue',
          champions2023: 'champions23',
        }[s.banner]);
  }
  if (!p.finishOn) p.family = undefined;
  if (!p.visualOn) p.performance = undefined;
  pool.set(key, p);
  return p;
}
