import catalog from './banner-index.json' with { type: 'json' };

const images = new Map();
let serial = 0;
function image(file) {
  if (!file) return Promise.resolve(null);
  if (!images.has(file)) {
    const img = new Image();
    img.src = '/banners/' + file;
    images.set(
      file,
      img
        .decode()
        .then(() => img)
        .catch(() => null),
    );
    if (images.size > 72) images.delete(images.keys().next().value);
  }
  return images.get(file);
}

export function killBanner(event, volume) {
  const skin = catalog[event?.style] ?? catalog.default;
  if (!skin) return false;
  const stamp = ++serial,
    count = Math.min(6, Math.max(1, Math.trunc(event?.count) || 1));
  const idx = Number(event?.variant) || 0,
    variant = idx > 0 && idx <= 3 ? '-v' + idx : '';
  const canvas = document.getElementById('killmark'),
    ctx = canvas.getContext('2d');
  canvas.hidden = true;
  const step = skin.steps?.[count - 1];
  const layers = [
    step || skin.frame,
    step ? null : skin.circle,
    step ? null : skin['emblem' + variant] || skin.emblem,
    step ? null : skin['pip' + variant] || skin.pip,
    event?.head ? skin.headshot : null,
  ];
  void Promise.all(layers.map(image)).then(([frame, ring, emblem, pip, head]) => {
    if (stamp !== serial) return;
    ctx.clearRect(0, 0, 300, 300);
    const centered = (img, x = 150, y = 150) => {
      if (img) ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
    };
    centered(frame);
    centered(ring);
    centered(emblem);
    if (pip)
      for (let i = 1; i <= count; i++) {
        const angle = (2 * Math.PI * i) / count + (count === 2 ? Math.PI / 2 : 0);
        ctx.save();
        ctx.translate(150 - Math.sin(angle) * skin.radius, 150 - Math.cos(angle) * skin.radius);
        ctx.rotate(-angle);
        centered(pip, 0, 0);
        ctx.restore();
      }
    centered(head, 150 + skin.dx, 150 + skin.dy);
    canvas.hidden = false;
    canvas.getAnimations().forEach((a) => a.cancel());
    const a = canvas.animate(
      [
        { opacity: 0, transform: 'translateX(-50%) scale(.83)' },
        { opacity: 1, offset: 0.09, transform: 'translateX(-50%) scale(1)' },
        { opacity: 1, offset: 0.76 },
        { opacity: 0 },
      ],
      { duration: 1900, fill: 'forwards' },
    );
    a.onfinish = () => {
      if (stamp === serial) canvas.hidden = true;
    };
  });
  const clip = skin.sounds[Math.min(count, skin.sounds.length) - 1];
  if (!clip) return false;
  const audio = new Audio('/banners/' + clip);
  audio.volume = Math.max(0, Math.min(1, volume * 0.58));
  void audio.play().catch(() => {});
  return true;
}
