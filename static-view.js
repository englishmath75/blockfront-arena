import * as T from 'three';
import { fieldUniforms, fieldLighting } from './terrain-feedback.js';

// On a software GPU the static map can dominate a stationary frame. Retain
// both color and depth so moving players and overlapping abilities still draw
// in the right order. Any camera, fog or animated surface change invalidates it.
export function staticView(renderer,scene,camera,scenery,sky,fields) {
  const staticLayer=3;
  for(const root of [scenery,sky])root.traverse(o=>o.layers.set(staticLayer));
  for(const o of scene.children)if(o.isLight)o.layers.enable(staticLayer);
  camera.layers.enable(staticLayer);
  const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
  target.texture.colorSpace=T.SRGBColorSpace;
  target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const copyScene=new T.Scene(),copyCamera=new T.Camera();
  const material=new T.ShaderMaterial({
    uniforms:{picture:{value:target.texture},zBuffer:{value:target.depthTexture},worldFromClip:{value:new T.Matrix4()},...fields},
    vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D picture,zBuffer;uniform mat4 worldFromClip;varying vec2 coord;
      ${fieldUniforms}
      void main(){
        float depth=texture2D(zBuffer,coord).r;
        vec3 outgoingLight=texture2D(picture,coord).rgb;
        if(depth<1. && (scanCount>0 || iceCount>0)){
          vec4 pos=worldFromClip*vec4(coord*2.-1.,depth*2.-1.,1.);
          vec3 fieldWorld=pos.xyz/pos.w;
          ${fieldLighting}
        }
        gl_FragDepth=depth;gl_FragColor=vec4(outgoingLight,1.);
        #include <colorspace_fragment>
      }`,
    depthTest:true,depthWrite:true,depthFunc:T.AlwaysDepth,toneMapped:false,
  });
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),material);
  quad.frustumCulled=false;copyScene.add(quad);
  const clip=new T.Matrix4(), previous=new T.Matrix4(), size=new T.Vector2();
  let ready=false, fogNear=-1, fogFar=-1, fogColor=-1;
  return {
    draw(output=null){
      camera.updateMatrixWorld();
      clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      if(output)size.set(output.width,output.height);
      else renderer.getDrawingBufferSize(size);
      const color=scene.fog.color.getHex();
      const changed=!previous.equals(clip) || fogNear!==scene.fog.near ||
        fogFar!==scene.fog.far || fogColor!==color || size.x!==target.width || size.y!==target.height;
      if(changed){
        ready=false;previous.copy(clip);material.uniforms.worldFromClip.value.copy(clip).invert();fogNear=scene.fog.near;fogFar=scene.fog.far;fogColor=color;
        if(size.x!==target.width || size.y!==target.height)target.setSize(size.x,size.y);
      }
      const mask=camera.layers.mask, background=scene.background, clear=renderer.autoClear;
      try{
        if(!ready){
          camera.layers.set(staticLayer);
          const scans=fields.scanCount.value, ice=fields.iceCount.value;
          fields.scanCount.value=fields.iceCount.value=0;
          try{renderer.setRenderTarget(target);renderer.render(scene,camera)}
          finally{fields.scanCount.value=scans;fields.iceCount.value=ice;renderer.setRenderTarget(output)}
          ready=true;
        }
        renderer.render(copyScene,copyCamera);
        camera.layers.set(0);renderer.autoClear=false;scene.background=null;
        renderer.render(scene,camera);
      }finally{
        renderer.setRenderTarget(output);
        camera.layers.mask=mask;renderer.autoClear=clear;scene.background=background;
      }
    },
    dispose(){target.dispose();material.dispose();quad.geometry.dispose()},
  };
}
