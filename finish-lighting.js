import * as T from 'three';

const disk = new T.PlaneGeometry(1,1);
const decoded = new Map();
let tracks,loading;
export function prepareFinishLighting() {
  return loading??=import('./finish-light.json',{with:{type:'json'}})
    .then(module=>{tracks=module.default})
    .catch(()=>{loading=null});
}
export function finishLighting(scene, point, family, sequence) {
  void prepareFinishLighting();
  let bytes;
  const color=new T.Color();
  const material=new T.ShaderMaterial({
    uniforms:{tint:{value:color},strength:{value:0}},
    vertexShader:'varying vec2 v; void main(){v=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 v; uniform vec3 tint; uniform float strength; void main(){float d=dot(v,v)*4.;float a=pow(max(0.,1.-d),3.);gl_FragColor=vec4(tint,strength*a);\n#include <colorspace_fragment>\n}',
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-1,
  });
  const pool=new T.Mesh(disk,material);
  pool.rotation.x=-Math.PI/2;
  pool.position.set(point.x,point.y+.035,point.z);
  scene.add(pool);
  const sample={color,energy:0,height:0,width:0};
  return {
    update(age){
      if(!bytes){
        bytes=decoded.get(family);
        if(!bytes){
          const encoded=tracks?.[family];
          if(!encoded)return;
          bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
          decoded.set(family,bytes);
        }
      }
      const time=Math.min(sequence.frames-1,Math.max(0,age*sequence.fps));
      const a=Math.floor(time)*7,b=Math.min(bytes.length-7,a+7),mix=time%1;
      const channel=i=>(bytes[a+i]+mix*(bytes[b+i]-bytes[a+i]))/255;
      sample.energy=channel(0);sample.height=channel(2);sample.width=channel(3);
      color.setRGB(channel(4),channel(5),channel(6),T.SRGBColorSpace);
      material.uniforms.strength.value=sample.energy*.64;
      pool.scale.setScalar(1.5+6*sample.width);
      return sample;
    },
    dispose(){pool.removeFromParent();material.dispose()},
  };
}
