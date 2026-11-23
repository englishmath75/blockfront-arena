import * as T from 'three';

// Each marked target leaves a bounded ground ribbon. Vertices are shared by the
// dark ink and its turquoise edge; samples stay put when the target turns.
const maxPoints=64;
const vertex='varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const fragment=`varying vec2 st;uniform float time;
void main(){float width=abs(st.x*2.-1.);float vein=abs(width-.68-.13*sin(st.y*3.+time*3.));
float rim=1.-smoothstep(.025,.15,vein);vec3 c=mix(vec3(.019,.007,.043),vec3(.02,.77,.78),rim);
gl_FragColor=vec4(c,.82*(1.-smoothstep(.82,1.,width)));
#include <colorspace_fragment>
}`;
function newTrail(scene){
  const geom=new T.BufferGeometry(),indices=[];
  for(let i=0;i<maxPoints-1;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  geom.setIndex(indices);
  geom.setAttribute('position',new T.BufferAttribute(new Float32Array(maxPoints*6),3).setUsage(T.DynamicDrawUsage));
  geom.setAttribute('uv',new T.BufferAttribute(new Float32Array(maxPoints*4),2).setUsage(T.DynamicDrawUsage));
  geom.setDrawRange(0,0);
  const mat=new T.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:vertex,fragmentShader:fragment,
    side:T.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true});
  const mesh=new T.Mesh(geom,mat);mesh.frustumCulled=false;scene.add(mesh);
  return {mesh,points:[]};
}
const wrapGeometry=new T.SphereGeometry(1,12,6),wrapInk=new T.MeshBasicMaterial({color:0x79dfff,wireframe:true,transparent:true,opacity:.5,depthWrite:false});
const cordInk=new T.LineBasicMaterial({color:0x9479bf,transparent:true,opacity:.86});
function presentBindings(world,p,viewer,time){
  const binds=world.abilityBindings??=new Map();
  const net=p.netUntil>time && !p.down,tether=p.tether?.until>time && p.tether?.kind==='seize' && !p.down;
  let b=binds.get(p.id);
  if(!net && !tether){
    if(b){b.wrap.removeFromParent();b.line.removeFromParent();b.line.geometry.dispose();binds.delete(p.id);}
    return;
  }
  if(!b){
    const wrap=new T.Mesh(wrapGeometry,wrapInk),geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.BufferAttribute(new Float32Array(45),3).setUsage(T.DynamicDrawUsage));
    const line=new T.Line(geo,cordInk);line.frustumCulled=false;world.scene.add(wrap,line);
    b={wrap,line};binds.set(p.id,b);
  }
  b.wrap.visible=net && p!==viewer;b.line.visible=!!tether;
  if(net){b.wrap.position.set(p.x,p.y+.36,p.z);b.wrap.scale.set(.39,.37,.36);}
  if(tether){const pos=b.line.geometry.attributes.position;
    for(let i=0;i<15;i++){const u=i/14,k=Math.sin(Math.PI*u);
      pos.setXYZ(i,p.tether.x+(p.x-p.tether.x)*u+k*.045*Math.sin(18*u+time*5),p.y+.08+.52*u+k*.09,p.tether.z+(p.z-p.tether.z)*u);}
    pos.needsUpdate=true;
  }
}
export function drawTrails(world,players,viewer,time){
  const trails=world.terrorTrails??=new Map();
  for(const p of players){
    presentBindings(world,p,viewer,time);
    const existing=trails.get(p.id),active=p.trailEnd>time && !p.down && p.trailOrigin && (viewer.team===p.trailTeam || p===viewer);
    if(!active){
      if(existing){existing.mesh.removeFromParent();existing.mesh.material.dispose();existing.mesh.geometry.dispose();trails.delete(p.id);}
      continue;
    }
    const trail=existing??newTrail(world.scene);
    if(!existing){trails.set(p.id,trail);trail.points.push([...p.trailOrigin]);}
    const points=trail.points,pt=points.at(-1),dist=Math.hypot(p.x-pt[0],p.z-pt[2]);
    trail.mesh.material.uniforms.time.value=time;
    if(dist<.26 && points.length>1)continue;
    if(dist>12 && points.length>1)points.length=0;
    points.push([p.x,p.y,p.z]);if(points.length>maxPoints)points.shift();
    const geo=trail.mesh.geometry,pos=geo.attributes.position,uv=geo.attributes.uv;let length=0;
    for(let i=0;i<points.length;i++){
      const [x,y,z]=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const dx=b[0]-a[0],dz=b[2]-a[2],k=.18/Math.max(.01,Math.hypot(dx,dz));
      if(i)length+=Math.hypot(x-a[0],z-a[2]);
      pos.setXYZ(i*2,x-dz*k,y+.045,z+dx*k);pos.setXYZ(i*2+1,x+dz*k,y+.045,z-dx*k);
      uv.setXY(i*2,0,length);uv.setXY(i*2+1,1,length);
    }
    geo.setDrawRange(0,6*(points.length-1));pos.needsUpdate=uv.needsUpdate=true;
  }
}

