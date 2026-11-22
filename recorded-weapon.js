import films from './weapon-films.json' with { type: 'json' };
import gestures from './hand-actions.json' with { type: 'json' };
import { motionAction } from './weapon-motion.js';

export function recordedAction(s, name, sound = false) {
  const gesture=gestures[s?.variant ?? s?.id];
  if(gesture && s.level>=gesture.level && gesture.actions[name]) return gesture.actions[name];
  const film = films[s?.id];
  if (!film) return;
  const champion = !!s.levels?.includes('InspectAndKill');
  const upgraded = champion ? s.level >= 2 : sound ? s.soundOn : s.motionOn;
  return (film.variants?.[s.variant] ?? film[upgraded ? 'full' : 'base'])[name === 'shot' ? 'fire' : name];
}

export function weaponFilm() {
  const canvas = document.getElementById('performance-layer');
  const ctx = canvas.getContext('2d');
  const cache = new Map();
  let last = '',
    equippedAt = 0;
  function image(url) {
    let img = cache.get(url);
    if (!img) {
      img = new Image();
      img.src = url;
      cache.set(url, img);
      if (cache.size > 28) cache.delete(cache.keys().next().value);
    }
    return img;
  }
  function page(action, index) {
    return image('/performances/' + action.key + '-' + index + '.webp');
  }
  function captured(s, p, now, reloadTime) {
    if (s?.variant || p.ads) return false;
    const name = p.reloading > now ? 'reload' : p.inspectUntil > now ? 'inspect' : null;
    const action = name && motionAction(s, name);
    const tile = action?.tile;
    if (!tile) return false;
    const sheet = image('/motion/' + s.id + '-' + name + '.webp');
    if (!sheet.complete || !sheet.naturalWidth) return false;
    const progress =
      name === 'reload' ? 1 - (p.reloading - now) / reloadTime : 1 - (p.inspectUntil - now) / action.seconds;
    const frame = Math.min(tile.frames - 1, Math.max(0, Math.floor(progress * tile.frames)));
    canvas.hidden = false;
    const w = canvas.clientWidth || window.innerWidth,
      h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w / 256, h / 144);
    ctx.drawImage(
      sheet,
      (frame % tile.cols) * tile.w,
      Math.floor(frame / tile.cols) * tile.h,
      tile.w,
      tile.h,
      w - (256 - tile.x) * scale,
      h - (144 - tile.y) * scale,
      tile.w * scale,
      tile.h * scale,
    );
    return true;
  }
  function hide() {
    canvas.hidden = true;
  }
  return {
    hide,
    draw(s, p, now, enabled, reloadTime) {
      const idle = recordedAction(s, 'idle');
      const gesture = p.reloading>now ? recordedAction(s,'reload') : p.inspectUntil>now ? recordedAction(s,'inspect') : null;
      if (!enabled || (!idle && !gesture)) {
        if (enabled && captured(s, p, now, reloadTime)) return true;
        hide();
        last = '';
        return false;
      }
      if (last !== s.profileKey) {
        equippedAt = now;
        last = s.profileKey;
      }
      const age = now - p.shot;
      let action = idle,
        elapsed = 0;
      if (p.reloading > now) {
        action = recordedAction(s, 'reload');
        elapsed = (1 - (p.reloading - now) / reloadTime) * action.seconds;
      } else if (p.inspectUntil > now) {
        action = recordedAction(s, 'inspect');
        elapsed = action.seconds - (p.inspectUntil - now);
      } else if (p.ads && recordedAction(s, 'ads')) {
        action = recordedAction(s, 'ads');
      } else if (age >= 0 && age < recordedAction(s, 'fire').seconds) {
        action = recordedAction(s, 'fire');
        elapsed = age;
      } else if (now - equippedAt < recordedAction(s, 'equip').seconds) {
        action = recordedAction(s, 'equip');
        elapsed = now - equippedAt;
      }
      const frame = Math.min(action.n - 1, Math.max(0, Math.floor(elapsed * action.fps)));
      let sheet = Math.floor(frame / action.capacity),
        cell = frame % action.capacity;
      let img = page(action, sheet);
      if ((sheet + 1) * action.capacity < action.n) page(action, sheet + 1);
      if (!img.complete || !img.naturalWidth) {
        if (!idle) { hide(); return false; }
        img = page(idle, 0);
        action = idle;
        cell = 0;
        if (!img.complete || !img.naturalWidth) {
          hide();
          return false;
        }
      }
      const width = canvas.clientWidth || window.innerWidth,
        height = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      canvas.hidden = false;
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(width / 640, height / 360);
      if (s.topFragOn && p.championAura) {
        ctx.shadowBlur = 8 + Math.cos(now * 3) * 3;
        ctx.shadowColor = '#ffc954';
      }
      ctx.drawImage(
        img,
        (cell % action.cols) * action.w,
        Math.floor(cell / action.cols) * action.h,
        action.w,
        action.h,
        action === recordedAction(s, 'ads')
          ? width / 2 - (320 - action.x) * scale
          : width - (640 - action.x) * scale,
        height -
          (360 - action.y) * scale +
          (p.ads && age >= 0 && age < 0.15 ? -5 * scale * Math.sin((age / 0.15) * Math.PI) : 0),
        action.w * scale,
        action.h * scale,
      );
      ctx.shadowBlur = 0;
      return true;
    },
  };
}
