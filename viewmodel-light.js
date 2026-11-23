import * as T from 'three';

// Reflection cards for polished housings and bevels. The same small environment
// texture is reused for first person and collection views across model swaps.
let studio;
export function lightViewmodel(scene){
  if(!studio){
    const w=128,h=64,data=new Uint16Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const lat=Math.PI*((y+.5)/h-.5),lon=((x+.5)/w-.5)*Math.PI*2;
      const dx=Math.cos(lat)*Math.cos(lon),dy=Math.sin(lat),dz=Math.cos(lat)*Math.sin(lon);
      const panel=(nx,ny,nz,width)=>Math.exp((dx*nx+dy*ny+dz*nz-1)*width);
      const strip=5.2*panel(-.52,.62,.59,36),rim=4.1*panel(.36,.81,-.46,25);
      const sky=.13+.37*Math.max(0,dy),ground=.09*Math.max(0,-dy);
      const rgb=[sky*.94+strip+rim*.72+ground,sky+strip*.93+rim*.91+ground*.86,sky*1.12+strip*.87+rim*1.15+ground*.8,1];
      for(let k=0;k<4;k++)data[(y*w+x)*4+k]=T.DataUtils.toHalfFloat(rgb[k]);
    }
    studio=new T.DataTexture(data,w,h,T.RGBAFormat,T.HalfFloatType);
    studio.mapping=T.EquirectangularReflectionMapping;studio.needsUpdate=true;
  }
  scene.environment=studio;scene.environmentIntensity=.82;
}
