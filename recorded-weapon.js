import films from './weapon-films.json' with { type: 'json' };
import gestures from './hand-actions.json' with { type: 'json' };

import chromas from './motion-chromas.json' with { type: 'json' };
const hasFilmColor = new Set(chromas);

export function recordedAction(s, name, sound = false) {
  const gesture=gestures[s?.variant ?? s?.id] ?? (hasFilmColor.has(s?.variant) ? gestures[s.id] : null);
  if(gesture && s.level>=gesture.level && gesture.actions[name]) return gesture.actions[name];
  const film = films[s?.id];
  if (!film) return;
  const champion = !!s.levels?.includes('InspectAndKill');
  const upgraded = champion ? s.level >= 2 : sound ? s.soundOn : s.motionOn;
  return (film.variants?.[s.variant] ?? film[upgraded ? 'full' : 'base'])[name === 'shot' ? 'fire' : name];
}
