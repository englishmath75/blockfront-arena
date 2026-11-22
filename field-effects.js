import * as T from 'three';
const ball = new T.SphereGeometry(0.5, 40, 28),
  flat = new T.CylinderGeometry(0.5, 0.5, 1, 48),
  ring = new T.SphereGeometry(0.5, 28, 16),
  crystal = new T.OctahedronGeometry(0.5),
  block = new T.BoxGeometry(1, 1, 1);
const vertex =
  'varying vec2 v; varying vec3 p; void main(){v=uv;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
let wallFilm;
function surface(color, kind) {
  if (kind === 1 && !wallFilm) {
    wallFilm = new T.TextureLoader().load('/effects/neon-wall.webp');
    wallFilm.colorSpace = T.SRGBColorSpace;
    wallFilm.generateMipmaps = false;
    wallFilm.minFilter = T.LinearFilter;
  }
  const uniforms = {
    t: { value: 0 },
    film: { value: kind === 1 ? wallFilm : null },
    span: { value: 1 },
    opacity: { value: 1 },
    shade: { value: new T.Color(color) },
    kind: { value: kind },
    front: { value: 1 },
    back: { value: 0 },
  };
  return new T.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    side: T.DoubleSide,
    transparent: kind !== 0,
    depthWrite: kind === 0,
    fragmentShader: `
varying vec2 v;varying vec3 p;uniform float t,opacity,kind,front,back;uniform vec3 shade;uniform sampler2D film;uniform float span;
float hash(vec3 pos){return fract(sin(dot(pos,vec3(43.81,57.13,13.71)))*45758.5453);}
float noise(vec3 pos){vec3 i=floor(pos),f=fract(pos);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
void main(){vec3 c=shade;float a=opacity;if(kind<.5){float n=noise(p*8.+vec3(t*.3,t*.24,-t*.4));float flow=sin(p.y*28.+n*5.+p.x*3.-t*2.);c=mix(shade*.56,shade*1.45+.015, .43+.34*n+.18*flow);c+=.12*pow(max(0.,flow),5.);}
else if(kind<1.5){
  if(v.x>front||v.x<back)discard;
  float distanceAlong=v.x*span,distort=noise(vec3(distanceAlong*.45,v.y*1.8,t*.6));
  float u=.02+.96*(1.-abs(mod(distanceAlong*.31+t*.12+distort*.14,2.)-1.));
  float h=clamp(.06+.83*v.y+distort*.025,.02,.94);
  float frame=floor(mod(t*12.,30.));frame=frame>15.?30.-frame:frame;
  vec2 tile=vec2(mod(frame,4.),3.-floor(frame/4.));
  c=texture2D(film,(tile+vec2(u,h))*.25).rgb;
  c=mix(c,vec3(.72,.94,.32),.5*(1.-smoothstep(0.,.065,v.y)));
  float top=.91+.09*noise(vec3(distanceAlong*.75,t*.8,4.));
  a*=1.-smoothstep(top-.025,top,v.y);
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
  const mat =
    smoke || lane || pulse
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
        : ['fire', 'slow', 'orbital', 'stimField'].includes(type)
          ? flat
          : block,
    mat,
  );
  mesh.scale.set(w, h, d);
  mesh.userData.owned = false;
  return mesh;
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
function ribbon(path, h) {
  const pos = [],
    uv = [],
    indices = [];
  for (let i = 0; i < path.length; i++) {
    const [x, y, z] = path[i];
    pos.push(x, y, z, x, y + h, z);
    uv.push(i / (path.length - 1), 0, i / (path.length - 1), 1);
    if (i) {
      const a = 2 * i;
      indices.push(a - 2, a, a - 1, a - 1, a, a + 1);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}
export function drawDevice(d, now) {
  const m = d.mesh,
    u = m.material.uniforms;
  if (!u) return;
  u.t.value = now;
  const age = now - d.born;
  const fade = Math.min(1, Math.max(0, (d.end - now) * 4));
  if (['lane', 'blaze', 'tide'].includes(d.type)) {
    if (!d.path) return;
    if (!m.userData.owned || m.userData.length !== d.path.length) {
      if (m.userData.owned) m.geometry.dispose();
      m.userData.length = d.path.length;
      m.geometry = ribbon(d.path, d.h);
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
