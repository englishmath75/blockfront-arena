import { Vector4 } from 'three';

// Evaluate pulses on the actual rendered surfaces, including instanced doors and rafters.
export function terrainFeedback(scene) {
  const slots = () => ({ value: Array.from({length:4}, () => new Vector4(0,0,0,-1)) });
  const scans=slots(), ice=slots(), clock={value:0}, materials=new Set();
  scene.traverse(o => { if(o.isMesh) for(const m of [o.material].flat()) if(m&&!m.isShaderMaterial) materials.add(m); });
  for(const material of materials) {
    const prior = material.onBeforeCompile.bind(material), key=material.customProgramCacheKey();
    material.customProgramCacheKey=()=>key+'-terrain-feedback-v1';
    material.onBeforeCompile=(shader,renderer)=>{
      prior(shader,renderer);
      Object.assign(shader.uniforms,{scanFields:scans,iceFields:ice,fieldClock:clock});
      shader.vertexShader='varying vec3 fieldWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 fieldPoint=vec4(transformed,1.);
        #ifdef USE_BATCHING
          fieldPoint=batchingMatrix*fieldPoint;
        #endif
        #ifdef USE_INSTANCING
          fieldPoint=instanceMatrix*fieldPoint;
        #endif
        fieldWorld=(modelMatrix*fieldPoint).xyz;`);
      shader.fragmentShader=`varying vec3 fieldWorld;
        uniform vec4 scanFields[4],iceFields[4]; uniform float fieldClock;
        vec2 iceSeed(vec2 q){ return fract(sin(vec2(dot(q,vec2(127.1,311.7)),dot(q,vec2(269.5,183.3))))*43758.5453); }
        \n`+shader.fragmentShader.replace('#include <opaque_fragment>',`
        for(int i=0;i<4;i++){
          vec4 zone=iceFields[i]; vec2 local=fieldWorld.xz-zone.xz;
          if(zone.w>0. && abs(fieldWorld.y-zone.y)<.78 && length(local)<zone.w){
            float coverage=smoothstep(0.,.42,zone.w-length(local))* (1.-smoothstep(.45,.78,abs(fieldWorld.y-zone.y)));
            vec2 tile=local*1.58,base=floor(tile),f=fract(tile); float near1=9.,near2=9.,facet=0.;
            for(int j=-1;j<=1;j++) for(int k=-1;k<=1;k++){
              vec2 idx=vec2(float(j),float(k)),seed=iceSeed(base+idx);
              float v=length(idx+.15+.7*seed-f);
              if(v<near1){near2=near1;near1=v;facet=seed.x;} else near2=min(near2,v);
            }
            float crack=1.-smoothstep(.013,.085,near2-near1);
            float sheen=pow(max(0.,cos(local.x*1.4+local.y*.8-fieldClock*1.6)),16.);
            vec3 crystal=mix(vec3(.018,.19,.25),vec3(.10,.77,.68),facet)+crack*vec3(.39,.91,.79)+.18*sheen;
            outgoingLight=mix(outgoingLight,crystal,.78*coverage);
          }
          vec4 wave=scanFields[i];
          if(wave.w>=0.){
            float depth=wave.w-distance(fieldWorld,wave.xyz);
            float line=(1.-smoothstep(.02,.30,abs(depth)))+.42*(1.-smoothstep(.04,.38,abs(depth-1.1)));
            float grid=pow(max(0.,cos(fieldWorld.x*7.)*cos(fieldWorld.z*7.)),6.);
            float trail=step(0.,depth)*exp(-max(0.,depth)*1.8);
            outgoingLight+=vec3(.05,.74,1.)*(1.9*line+trail*(.14+.6*grid));
          }
        }
        #include <opaque_fragment>`);
    };
  }
  return (devices,now)=>{
    clock.value=now;let a=0,b=0;
    for(const d of devices) {
      if(d.end<=now)continue;
      if(d.type==='reconWave' && a<4) scans.value[a++].set(d.x,d.y,d.z,Math.min(30,(now-d.born)*48));
      if(d.type==='ice' && b<4) ice.value[b++].set(d.x,d.y,d.z,iceRadius(d,now));
    }
    while(a<4)scans.value[a++].w=-1;
    while(b<4)ice.value[b++].w=-1;
  };
}

export function iceRadius(d,now) {
  return d.w*.5*Math.max(0,Math.min(1,(now-d.born)/.5,(d.end-now)/.32));
}
export function onIce(d,p,now) {
  return !p.down && Math.abs(d.y-p.y)<1.4 && Math.hypot(p.x-d.x,p.z-d.z)<iceRadius(d,now);
}
