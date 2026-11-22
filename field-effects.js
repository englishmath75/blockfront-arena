import * as T from 'three';
import { fieldReach } from './ground-fields.js';
const ball = new T.SphereGeometry(0.5, 40, 28),
  flat = new T.CylinderGeometry(0.5, 0.5, 1, 48),
  ring = new T.SphereGeometry(0.5, 28, 16),
  crystal = new T.OctahedronGeometry(0.5),
  block = new T.BoxGeometry(1, 1, 1);
const vertex =
  'varying vec2 v; varying vec3 p; void main(){v=uv;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const volumeSize=32;
const noiseData=new Uint8Array(volumeSize**3);
let seed=21941;
for(let i=0;i<noiseData.length;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  noiseData[i]=seed>>>24;
}
const noiseVolume=new T.Data3DTexture(noiseData,volumeSize,volumeSize,volumeSize);
noiseVolume.format=T.RedFormat;
noiseVolume.minFilter=noiseVolume.magFilter=T.LinearFilter;
noiseVolume.wrapS=noiseVolume.wrapT=noiseVolume.wrapR=T.RepeatWrapping;
noiseVolume.needsUpdate=true;
function surface(color, kind) {
  const uniforms = {
    t: { value: 0 },
    span: { value: 1 },
    opacity: { value: 1 },
    shade: { value: new T.Color(color) },
    kind: { value: kind },
    front: { value: 1 },
    back: { value: 0 },
    noiseVolume:{value:noiseVolume},
  };
  return new T.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    side: T.DoubleSide,
    transparent: kind !== 0,
    forceSinglePass: true,
    depthWrite: kind === 0,
    fragmentShader: `
varying vec2 v;varying vec3 p;uniform float t,opacity,kind,front,back;uniform vec3 shade;uniform float span;
uniform highp sampler3D noiseVolume;
float noise(vec3 pos){vec3 f=fract(pos);return texture(noiseVolume,(floor(pos)+f*f*(3.-2.*f)+.5)/32.).r;}
void main(){vec3 c=shade;float a=opacity;if(kind<.5){float n=noise(p*8.+vec3(t*.3,t*.24,-t*.4));float flow=sin(p.y*28.+n*5.+p.x*3.-t*2.);c=mix(shade*.56,shade*1.45+.015, .43+.34*n+.18*flow);c+=.12*pow(max(0.,flow),5.);}
else if(kind<1.5){
  if(v.x>front||v.x<back)discard;
  float distanceAlong=v.x*span,distort=noise(vec3(distanceAlong*.45,v.y*1.8,t*.6));
  float x=distanceAlong*.82+distort*1.8;
  float bolt=abs(fract(x+.22*sin(19.*v.y-t*6.+x)+.13*sin(37.*v.y+x*3.))-.5);
  float arc=1.-smoothstep(.012,.075,bolt);
  c=mix(vec3(.008,.09,.70),vec3(.015,.73,1.),clamp(.9-v.y*.62+distort*.26,0.,1.));
  c+=arc*vec3(.24,.81,1.)*(.45+.55*distort);
  c=mix(c,vec3(.72,1.,.17),1.-smoothstep(.015,.18+.12*distort,v.y));
  float top=.91+.09*noise(vec3(distanceAlong*.75,t*.8,4.));
  a*=1.-smoothstep(top-.025,top,v.y);
}
else if(kind>6.5){
  float r=length(p.xz)*2., angular=atan(p.z,p.x);
  float edge=1.-smoothstep(.018,.08,abs(.94-r));
  float pulse=pow(.5+.5*cos(r*27.-t*6.),5.);
  if(kind<7.5){float flame=noise(vec3(p.xz*19.,t*2.2));c=mix(shade*.56,vec3(1.,.76,.18),smoothstep(.35,.84,flame));a*=.76+.2*edge;}
  else if(kind<8.5){c=shade*(.52+pulse*.6)+edge*vec3(.4,1.,.85);a*=.42+.36*edge+.19*pulse;}
  else if(kind<9.5){float grid=pow(.5+.5*cos(angular*14.+r*13.-t*2.),9.);c=shade*(.6+grid)+edge*vec3(1.,.83,.48);a*=.45+.42*edge+.12*grid;}
  else {float band=pow(.5+.5*cos(v.y*41.-t*8.),6.);c=shade*(.75+1.5*band);a*=.40+.50*band;}
}
else if(kind>4.5){
  float radius=length(p.xz)*2., angle=atan(p.z,p.x);
  float grain=noise(vec3(p.xz*19.,t*1.4));
  float edge=smoothstep(.86,.97,radius);
  if(kind<5.5){
    float cells=sin(27.*p.x+grain*4.)*cos(30.*p.z-grain*5.);
    c=mix(vec3(.04,.30,.08),vec3(.58,.99,.04),smoothstep(-.35,.65,cells)+.24*edge);
    c+=front*vec3(.68,.45,.06);
  }else{
    float strands=pow(.5+.5*sin(15.*angle+radius*18.+grain*4.-t*2.),7.);
    c=mix(vec3(.06,.027,.10),vec3(.67,.28,.53),strands*.78+edge*.65);
  }
  a*=.78+.18*edge;
}
else if(kind>3.5){float wave=noise(vec3(v.x*span*.35,v.y*2.-t*1.5,t*.4));float rip=sin(v.y*24.+wave*7.-t*3.);c=mix(vec3(.03,.45,.48),vec3(.61,1.,.91),.48+.28*rip+.20*wave);a*=1.-smoothstep(.89+.08*wave,1.,v.y);}
else if(kind>2.5){float wave=noise(vec3(v.x*span*.75,v.y*3.-t*3.,t*.55));float top=.64+.36*wave;a*=1.-smoothstep(top-.12,top,v.y);c=mix(vec3(.98,.14,.025),vec3(1.,.85,.22),clamp(1.-v.y+.23*sin(v.x*18.-t*4.)+.35*wave,0.,1.));}
else{float band=pow(abs(sin(v.y*36.+t*4.)),8.);a*=.14+band*.44;c*=1.6;}
gl_FragColor=vec4(c,a);
#include <colorspace_fragment>
}`,
  });
}
export function deviceMesh(type, color, w, h, d) {
  const smoke = ['smoke', 'cloud', 'darkCover', 'pit'].includes(type),
    lane = type === 'lane' || type === 'blaze' || type === 'tide',
    pulse = ['sonar', 'dronePulse', 'pulse'].includes(type);
  const field={fire:7,slow:8,stimField:8,orbital:9,groundWave:10,agentPulse:10}[type];
  const mat =
    field ? surface(color,field) : type === 'mosh' || type === 'seize' ? surface(color,type === 'mosh' ? 5 : 6) : smoke || lane || pulse
      ? surface(color, type === 'tide' ? 4 : type === 'blaze' ? 3 : lane ? 1 : pulse ? 2 : 0)
      : new T.MeshStandardMaterial({
          color,
          roughness: 0.45,
          emissive: color,
          emissiveIntensity: 0.26,
          transparent: type !== 'wall',
          opacity: type === 'wall' ? 1 : type === 'meshPanel' ? 0.32 : type === 'groundWave' ? 0.58 : 0.82,
        });
  const mesh = new T.Mesh(
    smoke || pulse
      ? ball
      : [
            'recon',
            'deployed',
            'companion',
            'agentPulse',
            'meshNode',
            'star',
            'globule',
            'zoneEmitter',
          ].includes(type)
        ? crystal
        : ['fire', 'slow', 'orbital', 'stimField', 'mosh', 'seize'].includes(type)
          ? flat
          : block,
    mat,
  );
  mesh.scale.set(w, h, d);
  mesh.userData.owned = false;
  return mesh;
}

export async function warmFieldMaterials(world) {
  const staging=new T.Scene();
  for(const type of ['smoke','lane','wall','recon']){
    const mesh=deviceMesh(type,0x8fd9ef,1,1,1);
    staging.add(mesh);
  }
  // The registry keeps one instance of each program alive for this map.
  // Releasing the final material would force the next cast to compile it again.
  world.fieldMaterials.push(...staging.children.map(m=>m.material));
  await world.renderer.compileAsync(staging,world.camera,world.scene);
}
export function lanePaths(world, p, devices) {
  const paths = [];
  const forward = new T.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)),
    along = new T.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  for (const side of [-1, 1]) {
    const source = new T.Vector3(p.x, p.y + p.height, p.z)
      .addScaledVector(along, side * 1.75)
      .addScaledVector(forward, -1.5);
    const direction = forward.clone();
    direction.y = Math.tan(Math.min(1.05, Math.max(0, p.pitch)));
    direction.normalize();
    const len = Math.min(
      46.5,
      world.mapHit(new T.Ray(source, direction), 46.5 / Math.max(0.3, Math.cos(p.pitch)), devices) *
        Math.hypot(direction.x, direction.z),
    );
    if (len < 0.2) continue;
    const path = [];
    let y = p.y;
    for (let i = 0, n = Math.ceil(len / 1.5); i <= n; i++) {
      const a = source.clone().addScaledVector(forward, (len * i) / n);
      const g = world.structure.support(a.x, a.z, Math.max(y + 2.1, source.y + direction.y * i * 1.5));
      if (Number.isFinite(g)) y = g;
      path.push([a.x, y, a.z]);
    }
    paths.push(path);
  }
  return paths;
}
function updateRibbon(mesh, path, h) {
  const count=path.length;
  if(!mesh.userData.owned || mesh.userData.capacity<count){
    if(mesh.userData.owned)mesh.geometry.dispose();
    const capacity=Math.max(64,2**Math.ceil(Math.log2(count)));
    const g=mesh.geometry=new T.BufferGeometry(), indices=[];
    for(let i=1;i<capacity;i++){
      const a=2*i;indices.push(a-2,a,a-1,a-1,a,a+1);
    }
    g.setIndex(indices);
    g.setAttribute('position',new T.BufferAttribute(new Float32Array(capacity*6),3).setUsage(T.DynamicDrawUsage));
    g.setAttribute('uv',new T.BufferAttribute(new Float32Array(capacity*4),2).setUsage(T.DynamicDrawUsage));
    g.boundingSphere=new T.Sphere();
    mesh.userData.owned=true;
    mesh.userData.capacity=capacity;
  }
  const g=mesh.geometry, pos=g.attributes.position, uv=g.attributes.uv;
  const [cx,cy,cz]=path[count>>1];
  g.boundingSphere.center.set(cx,cy+h*.5,cz);
  let radiusSq=0;
  for(let i=0;i<count;i++){
    const [x,y,z]=path[i], u=i/(count-1);
    pos.setXYZ(i*2,x,y,z);pos.setXYZ(i*2+1,x,y+h,z);
    uv.setXY(i*2,u,0);uv.setXY(i*2+1,u,1);
    radiusSq=Math.max(radiusSq,(x-cx)**2+(Math.abs(y-cy)+h*.5)**2+(z-cz)**2);
  }
  g.boundingSphere.radius=Math.sqrt(radiusSq);
  g.setDrawRange(0,6*(count-1));
  pos.needsUpdate=uv.needsUpdate=true;
}
export function drawDevice(d, now) {
  const m = d.mesh,
    u = m.material.uniforms;
  if (!u) return;
  u.t.value = now;
  const age = now - d.born;
  const fade = Math.min(1, Math.max(0, (d.end - now) * 4));
  if (d.type==='mosh' || d.type==='seize') {
    const diameter=2*fieldReach(d,now);
    const burst=Math.max(0,Math.min(1,(now-d.start)/.08));
    m.scale.set(diameter,.045+(d.type==='mosh'?burst*.33:0),diameter);
    u.front.value=burst;
    u.opacity.value=Math.min(1,(d.end-now)*8);
    return;
  }
  if (['lane', 'blaze', 'tide'].includes(d.type)) {
    m.visible=(d.path?.length??0)>=2;
    if (!m.visible) return;
    if (!m.userData.owned || m.userData.length !== d.path.length) {
      m.userData.length = d.path.length;
      updateRibbon(m,d.path,d.h);
      const first = d.path[0],
        last = d.path.at(-1);
      u.span.value = Math.hypot(last[0] - first[0], last[2] - first[2]);
      m.userData.owned = true;
    }
    m.position.set(0, 0, 0);
    m.scale.setScalar(1);
    u.front.value = T.MathUtils.clamp(age / 0.4, 0, 1);
    u.back.value = d.type === 'lane' ? T.MathUtils.clamp((age - 4) / 2, 0, 1) : 0;
    u.opacity.value = 0.99 * fade;
    return;
  }
  if (['sonar', 'dronePulse', 'pulse'].includes(d.type)) {
    const f = T.MathUtils.clamp(
      (age - (d.delay ?? 0)) / Math.max(0.1, d.end - d.born - (d.delay ?? 0)),
      0,
      1,
    );
    m.visible = f > 0;
    m.scale.set(d.w * f, d.h * f, d.d * f);
    u.opacity.value = 1 - f * 0.65;
  }
  if (['smoke', 'cloud', 'darkCover'].includes(d.type)) {
    const grow = T.MathUtils.clamp((now - (d.start ?? d.born)) / (d.type === 'cloud' ? 0.6 : 0.18), 0, 1);
    m.visible = grow > 0;
    m.material.transparent = fade < 1;
    m.material.depthWrite = fade >= 1;
    m.scale.set(d.w * grow, d.h * grow, d.d * grow);
    u.opacity.value = fade;
  }
}
export function visionDistance(ray, d, now, limit) {
  if (d.end <= now || now < (d.start ?? d.born ?? 0)) return limit;
  if (['smoke', 'cloud', 'darkCover'].includes(d.type)) {
    const center = new T.Vector3(d.x, d.y + d.h / 2, d.z),
      v = ray.direction.clone(),
      o = ray.origin.clone().sub(center);
    const age = now - (d.start ?? d.born ?? 0),
      grow = T.MathUtils.clamp(age / (d.type === 'cloud' ? 0.6 : 0.18), 0, 1);
    if (grow < 0.002) return limit;
    const scale = new T.Vector3(d.w / 2, d.h / 2, d.d / 2).multiplyScalar(grow);
    v.divide(scale);
    o.divide(scale);
    const a = v.lengthSq(),
      b = o.dot(v),
      c = o.lengthSq() - 1,
      det = b * b - a * c;
    if (det < 0) return limit;
    const s = Math.sqrt(det),
      t1 = (-b - s) / a,
      t2 = (-b + s) / a;
    if (d.type !== 'darkCover' && t1 < 0 && t2 >= 0) return 0;
    const hit = t1 >= 0 ? t1 : t2;
    return hit >= 0 ? Math.min(limit, hit) : limit;
  }
  if (!['lane', 'blaze', 'tide'].includes(d.type) || !d.path) return limit;
  const age = now - d.born,
    front = d.type !== 'lane' ? 1 : Math.min(1, age / 0.4),
    back = d.type !== 'lane' ? 0 : Math.max(0, (age - 4) / 2);
  for (let i = 1; i < d.path.length; i++) {
    const [x, y, z] = d.path[i - 1],
      [xb, yb, zb] = d.path[i],
      ex = xb - x,
      ez = zb - z,
      den = ray.direction.x * ez - ray.direction.z * ex;
    if (Math.abs(den) < 0.00001) continue;
    const ox = x - ray.origin.x,
      oz = z - ray.origin.z,
      t = (ox * ez - oz * ex) / den,
      s = (ox * ray.direction.z - oz * ray.direction.x) / den;
    if (t < 0 || t > limit || s < 0 || s > 1) continue;
    const f = (i - 1 + s) / (d.path.length - 1),
      height = ray.origin.y + t * ray.direction.y - y - s * (yb - y);
    if (f >= back && f <= front && height >= 0 && height <= d.h) return t;
  }
  return limit;
}
