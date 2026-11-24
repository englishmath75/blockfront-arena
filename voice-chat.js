// 120 ms mono packets use the existing authenticated room connection, including behind NAT.
const rate=16000, packet=1920;
export function voiceChat({preferences,client,playback,status}){
  let version=0,mode='',stream,context,node,monitor,pending=0,sequence=0;
  const speakers=new Map();
  let output=null;
  const canRoute=()=>!!globalThis.AudioContext && 'setSinkId' in AudioContext.prototype;
  async function route(){
    const id=preferences().voiceDevice;
    if(!id || !canRoute()){if(output){void output.close().catch(()=>{});output=null;}return;}
    const ctx=output??=new AudioContext();
    try{await ctx.setSinkId(id);await ctx.resume();}
    catch(error){if(ctx===output){output=null;void ctx.close().catch(()=>{});}throw error;}
  }
  function stop(){
    version++;mode='';if(node){node.port.onmessage=null;node.disconnect();node=null;}
    if(monitor){monitor.disconnect();monitor=null;}
    stream?.getTracks().forEach(t=>t.stop());stream=null;
    if(context){void context.close().catch(()=>{});context=null;}status('');
  }
  function reset(){
    stop();
    for(const speaker of speakers.values())for(const source of speaker.sources.keys()){try{source.stop();}catch{}}
    speakers.clear();if(output){void output.close().catch(()=>{});output=null;}
  }
  async function begin(channel){
    if(mode===channel)return;
    stop();
    const s=preferences(),room=client();
    if(channel!=='test' && (!room?.room || !s[channel+'Voice'] || channel==='party' && !room.room.privateParty))return;
    mode=channel;const token=version;
    try{
      const mic=await navigator.mediaDevices.getUserMedia({audio:{...(s.micDevice?{deviceId:{exact:s.micDevice}}:{}),channelCount:1,echoCancellation:true,noiseSuppression:true}});
      if(token!==version){mic.getTracks().forEach(t=>t.stop());return;}
      stream=mic;context=new AudioContext({sampleRate:rate});const ctx=context;
      await ctx.resume();if(token!==version)return;
      const input=ctx.createMediaStreamSource(mic);
      if(channel==='test'){if(s.voiceDevice && canRoute())await ctx.setSinkId(s.voiceDevice).catch(()=>{});if(token!==version)return;monitor=ctx.createGain();monitor.gain.value=s.micGain*s.voiceOutput*s.volume;input.connect(monitor).connect(ctx.destination);return;}
      await ctx.audioWorklet.addModule(new URL('./voice-worklet.js',import.meta.url));
      if(token!==version)return;
      node=new AudioWorkletNode(ctx,'arena-voice',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
      input.connect(node);node.connect(ctx.destination);
      status((channel==='team'?'팀':'파티')+' 음성 송신 중');
      node.port.onmessage=({data})=>{
        const gain=preferences().micGain;
        if(token!==version || room!==client() || !gain || pending>=2)return;
        if(gain!==1)for(let i=0;i<data.length;i++)data[i]=Math.round(data[i]*gain);
        const pcm=btoa(String.fromCharCode(...new Uint8Array(data.buffer)));
        pending++;void room.request('voice',{channel,sequence:++sequence,pcm}).catch(()=>{}).finally(()=>pending--);
      };
    }catch(error){if(token===version){stop();throw error;}}
  }
  function receive(data){
    const s=preferences(),audio=output??playback(),room=client();
    if(!audio||audio.state!=='running'||!room?.room||!['team','party'].includes(data?.channel)||!s[data.channel+'Voice']||!s.volume||!s.voiceOutput)return;
    if(typeof data.pcm!=='string'||data.pcm.length!==5120||!Number.isSafeInteger(data.sequence))return;
    const member=room.room.players.find(p=>p.id===data.from);
    if(!member)return;
    let speaker=speakers.get(data.from);
    if(!speaker){speaker={last:-1,end:0,sources:new Map()};speakers.set(data.from,speaker);}
    if(data.sequence<=speaker.last)return;
    speaker.last=data.sequence;
    const now=audio.currentTime;if(speaker.end>now+.48)return;
    const bytes=Uint8Array.from(atob(data.pcm),c=>c.charCodeAt(0)),samples=new Int16Array(bytes.buffer);
    const buffer=audio.createBuffer(1,packet,rate),target=buffer.getChannelData(0);
    for(let i=0;i<packet;i++)target[i]=samples[i]/32768;
    const source=audio.createBufferSource(),gain=audio.createGain();
    gain.gain.value=s.voiceOutput*s.volume;source.buffer=buffer;source.connect(gain).connect(audio.destination);
    speaker.sources.set(source,{gain,channel:data.channel});source.onended=()=>{speaker.sources.delete(source);source.disconnect();gain.disconnect();};
    const start=Math.max(now+.035,speaker.end);source.start(start);speaker.end=start+buffer.duration;
    if(!mode)status((data.channel==='team'?'팀':'파티')+' · '+member.agent,420);
  }
  return {stop,reset,receive,canRoute,route,testing:()=>mode==='test',test:()=>begin('test'),release(channel){if(mode===channel)stop();},
    refresh(){
      const s=preferences();if(monitor)monitor.gain.value=s.micGain*s.voiceOutput*s.volume;
      for(const speaker of speakers.values())for(const {gain,channel} of speaker.sources.values())
        gain.gain.value=s[channel+'Voice']?s.voiceOutput*s.volume:0;
      if(['team','party'].includes(mode)&&!s[mode+'Voice'])stop();
    },
    speak(channel){void begin(channel).catch(()=>status('마이크 권한과 입력 장치를 확인하세요.',2600));}};
}
