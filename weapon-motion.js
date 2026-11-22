import actions from './motion-index.json' with { type: 'json' };

export function motionAction(skin, name) {
  const action = actions[skin?.id]?.[name];
  return action && skin.level >= action.level ? action : undefined;
}

export function sampleMotion(action, ratio) {
  if (!action?.path?.length) return;
  const last = action.path.length - 1;
  const frame = Math.min(1, Math.max(0, ratio)) * last;
  const i = Math.floor(frame),
    left = action.path[i],
    right = action.path[Math.min(i + 1, last)];
  return left.map((v, j) => v + (right[j] - v) * (frame - i));
}
