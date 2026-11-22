import { Vector4, TextureLoader, RepeatWrapping } from 'three';

export const fieldUniforms=`
        uniform vec4 scanFields[32],iceFields[32]; uniform int scanCount,iceCount;
        uniform float fieldClock; uniform sampler2D iceFacet;
`;
export const fieldLighting=`
        for(int i=0;i<iceCount;i++){
          vec4 zone=iceFields[i]; vec2 local=fieldWorld.xz-zone.xz;
          if(zone.w>0. && abs(fieldWorld.y-zone.y)<.78 && length(local)<zone.w){
            float coverage=smoothstep(0.,.42,zone.w-length(local))* (1.-smoothstep(.45,.78,abs(fieldWorld.y-zone.y)));
            vec2 crystalSample=texture2D(iceFacet,local*(1.58/8.)).rg;
            float facet=crystalSample.r,crack=crystalSample.g;
            float sheen=pow(max(0.,cos(local.x*1.4+local.y*.8-fieldClock*1.6)),16.);
            vec3 crystal=mix(vec3(.018,.19,.25),vec3(.10,.77,.68),facet)+crack*vec3(.39,.91,.79)+.18*sheen;
            outgoingLight=mix(outgoingLight,crystal,.78*coverage);
          }
        }
        for(int i=0;i<scanCount;i++){
          vec4 wave=scanFields[i];
          if(wave.w>=0.){
            float depth=wave.w-distance(fieldWorld,wave.xyz);
            if(depth<-.39 || depth>5.)continue;
            float line=(1.-smoothstep(.02,.30,abs(depth)))+.42*(1.-smoothstep(.04,.38,abs(depth-1.1)));
            float grid=pow(max(0.,cos(fieldWorld.x*7.)*cos(fieldWorld.z*7.)),6.);
            float trail=step(0.,depth)*exp(-max(0.,depth)*1.8);
            outgoingLight+=vec3(.05,.74,1.)*(1.9*line+trail*(.14+.6*grid));
          }
        }
        `;
let facets;

// Evaluate pulses on the actual rendered surfaces, including instanced doors and rafters.
export function terrainFeedback(scene) {
  const slots = () => ({ value: Array.from({length:32}, () => new Vector4()) });
  const scans=slots(), ice=slots(), clock={value:0}, materials=new Set();
  const scanCount={value:0}, iceCount={value:0};
  if(!facets){
    facets=new TextureLoader().load('/effects/ice-facets.png');
    facets.wrapS=facets.wrapT=RepeatWrapping;
  }
  const uniforms={scanFields:scans,iceFields:ice,fieldClock:clock,scanCount,iceCount,iceFacet:{value:facets}};
  scene.traverse(o => { if(o.isMesh) for(const m of [o.material].flat()) if(m&&!m.isShaderMaterial) materials.add(m); });
  for(const material of materials) {
    const prior = material.onBeforeCompile.bind(material), key=material.customProgramCacheKey();
    material.customProgramCacheKey=()=>key+'-terrain-feedback-v1';
    material.onBeforeCompile=(shader,renderer)=>{
      prior(shader,renderer);
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 fieldWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 fieldPoint=vec4(transformed,1.);
        #ifdef USE_BATCHING
          fieldPoint=batchingMatrix*fieldPoint;
        #endif
        #ifdef USE_INSTANCING
          fieldPoint=instanceMatrix*fieldPoint;
        #endif
        fieldWorld=(modelMatrix*fieldPoint).xyz;`);
      shader.fragmentShader='varying vec3 fieldWorld;\n'+fieldUniforms+shader.fragmentShader.replace('#include <opaque_fragment>',fieldLighting+'\n#include <opaque_fragment>');
    };
  }
  const update=(devices,now)=>{
    clock.value=now;let a=0,b=0;
    for(const d of devices) {
      if(d.end<=now)continue;
      if(d.type==='reconWave' && a<scans.value.length) scans.value[a++].set(d.x,d.y,d.z,Math.min(30,(now-d.born)*48));
      if(d.type==='ice' && b<ice.value.length) ice.value[b++].set(d.x,d.y,d.z,iceRadius(d,now));
    }
    scanCount.value=a;
    iceCount.value=b;
  };
  update.uniforms=uniforms;
  return update;
}

export function iceRadius(d,now) {
  return d.w*.5*Math.max(0,Math.min(1,(now-d.born)/.5,(d.end-now)/.32));
}
export function onIce(d,p,now) {
  return !p.down && Math.abs(d.y-p.y)<1.4 && Math.hypot(p.x-d.x,p.z-d.z)<iceRadius(d,now);
}
