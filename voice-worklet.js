class VoiceCapture extends AudioWorkletProcessor {
  constructor(){super();this.samples=new Int16Array(1920);this.count=0;}
  process(inputs){
    const input=inputs[0]?.[0];
    if(input)for(const v of input){
      this.samples[this.count++]=Math.round(Math.max(-1,Math.min(1,v))*32767);
      if(this.count===this.samples.length){this.port.postMessage(this.samples,[this.samples.buffer]);this.samples=new Int16Array(1920);this.count=0;}
    }
    return true;
  }
}
registerProcessor('arena-voice',VoiceCapture);
