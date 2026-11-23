import * as T from 'three';

// Project the authoritative impact into the hand camera so the discharge stays
// attached to the animated finger even though hands use their own field of view.
export function overdriveBeam(scene) {
  const segments=12;
  const xyz=new Float32Array((segments+1)*6), uv=[],indices=[];
  for(let i=0;i<=segments;i++){
    uv.push(0,i/segments,1,i/segments);
    const a=i*2;if(i<segments)indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
  const geo=new T.BufferGeometry(),pos=new T.BufferAttribute(xyz,3).setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position',pos);geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
  const material=new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 v;void main(){float r=abs(v.x*2.-1.);float core=1.-smoothstep(.07,.36,r);vec3 c=mix(vec3(.02,.49,1.),vec3(.76,1.,1.),core);gl_FragColor=vec4(c,(1.-r)*(1.-r)*.91);}'});
  const mesh=new T.Mesh(geo,material);mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  const start=new T.Vector3(),end=new T.Vector3(),forward=new T.Vector3(),across=new T.Vector3(),point=new T.Vector3(),ndc=new T.Vector3();
  return {
    draw(tip,hit,worldCamera,handCamera,time){
      mesh.visible=!!(tip && hit && worldCamera);if(!mesh.visible)return;
      handCamera.updateMatrixWorld();
      tip.getWorldPosition(start);
      ndc.fromArray(hit).project(worldCamera);
      if(ndc.z>1 || ndc.z< -1){mesh.visible=false;return;}
      ndc.z=.997;end.copy(ndc).unproject(handCamera);
      forward.subVectors(end,start);across.subVectors(start,handCamera.position).cross(forward).normalize();
      for(let i=0;i<=segments;i++){
        const u=i/segments;
        const flicker=Math.sin(i*3.7+time*65)*.003*Math.sin(Math.PI*u);
        const width=.008+u*.009;
        point.copy(start).addScaledVector(forward,u).addScaledVector(across,flicker-width);
        pos.setXYZ(i*2,point.x,point.y,point.z);point.addScaledVector(across,2*width);
        pos.setXYZ(i*2+1,point.x,point.y,point.z);
      }
      pos.needsUpdate=true;
    },
    dispose(){mesh.removeFromParent();geo.dispose();material.dispose();}
  };
}
