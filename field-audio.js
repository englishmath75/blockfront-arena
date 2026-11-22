// Short transients stay separate so a second scan or footstep can overlap the first.
export function fieldAudio(ctx, event, volume, pan=0) {
  if (!ctx || ctx.state !== 'running' || volume<=0) return;
  const start=ctx.currentTime, out=ctx.createGain(), spatial=ctx.createStereoPanner();
  out.gain.value=Math.min(1,volume); spatial.pan.value=Math.min(1,Math.max(-1,pan));
  out.connect(spatial).connect(ctx.destination);
  function note(delay,duration,from,to,gain,wave='sine') {
    const osc=ctx.createOscillator(),env=ctx.createGain(),at=start+delay;
    osc.type=wave;osc.frequency.setValueAtTime(from,at);osc.frequency.exponentialRampToValueAtTime(to,at+duration);
    env.gain.setValueAtTime(.0001,at);env.gain.exponentialRampToValueAtTime(gain,at+.007);env.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(env).connect(out);osc.start(at);osc.stop(at+duration+.02);
    osc.onended=()=>{osc.disconnect();env.disconnect();};
  }
  if(event==='recon-ping') {
    for(const [delay,amplitude] of [[0,.22],[.09,.067],[.19,.025]]) {
      note(delay,.32,1560,560,amplitude);
      note(delay+.026,.19,2410,1070,amplitude*.32);
    }
  } else {
    const burst=event==='ice-break',duration=burst?.56:.19,count=burst?12:5;
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-5*i/samples.length);
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=buffer;filter.type='bandpass';filter.frequency.value=burst?2700:1650;filter.Q.value=.7;
    gain.gain.value=burst?.36:.26;source.connect(filter).connect(gain).connect(out);source.start();
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    for(let i=0;i<count;i++) {
      const pitch=800+Math.random()*2800;
      note(i*duration/count,.04+Math.random()*.10,pitch,pitch*.74,.07/(1+i*.2),'triangle');
    }
  }
  setTimeout(()=>{out.disconnect();spatial.disconnect();},1150);
}
