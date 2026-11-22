const clips = ['recon-ping', 'ice-break', 'ice-step-1', 'ice-step-2', 'ice-step-3', 'pack-burst', 'pack-stick', 'rift-jump'];
const contexts = new WeakMap();

export function prepareFieldAudio(ctx) {
  if (contexts.has(ctx)) return contexts.get(ctx);
  const bank = { steps: 0, files: new Map() };
  contexts.set(ctx, bank);
  for (const id of clips) {
    bank.files.set(id, fetch('/agent-sfx/' + id + '.ogg')
      .then(response => {
        if (!response.ok) throw Error(id);
        return response.arrayBuffer();
      })
      .then(data => ctx.decodeAudioData(data))
      .catch(() => null));
  }
  return bank;
}

export function fieldAudio(ctx, event, volume, pan = 0) {
  if (!ctx || ctx.state !== 'running' || volume <= 0) return;
  const bank = prepareFieldAudio(ctx), at = ctx.currentTime;
  const id = event === 'ice-step' ? 'ice-step-' + (1 + bank.steps++ % 3) : event;
  bank.files.get(id)?.then(buffer => {
    const elapsed = ctx.currentTime - at;
    if (!buffer || elapsed >= buffer.duration || ctx.state !== 'running') return;
    const voice = ctx.createBufferSource(), gain = ctx.createGain(), spatial = ctx.createStereoPanner();
    voice.buffer = buffer;
    gain.gain.value = Math.min(1, volume);
    spatial.pan.value = Math.max(-1, Math.min(1, pan));
    voice.connect(gain).connect(spatial).connect(ctx.destination);
    voice.onended = () => { voice.disconnect(); gain.disconnect(); spatial.disconnect(); };
    voice.start(0, elapsed);
  });
}
