import * as T from 'three';

// Render the map at its frame-budget resolution. Clear its depth before the
// first-person pass, so the hands and weapon can use the display resolution.
export function worldResolution(renderer) {
  const size=new T.Vector2(), scene=new T.Scene(), camera=new T.Camera();
  const material=new T.MeshBasicMaterial({depthTest:false,depthWrite:false,toneMapped:false});
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),material);
  quad.frustumCulled=false;scene.add(quad);
  let target;
  return {
    draw(ratio,drawMap){
      if(ratio>=renderer.getPixelRatio()-.005){drawMap(null);return;}
      renderer.getSize(size);
      const w=Math.max(1,Math.floor(size.x*ratio)),h=Math.max(1,Math.floor(size.y*ratio));
      if(!target){
        target=new T.WebGLRenderTarget(w,h,{depthBuffer:true,generateMipmaps:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter});
        target.texture.colorSpace=T.SRGBColorSpace;material.map=target.texture;material.needsUpdate=true;
      }else if(target.width!==w || target.height!==h)target.setSize(w,h);
      const prior=renderer.getRenderTarget();
      try{renderer.setRenderTarget(target);drawMap(target);}
      finally{renderer.setRenderTarget(prior);}
      renderer.render(scene,camera);
    },
    dispose(){target?.dispose();quad.geometry.dispose();material.dispose();}
  };
}
