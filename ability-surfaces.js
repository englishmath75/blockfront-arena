import * as T from 'three';
import {worldSculpture} from './ability-sculptures.js';

const floor=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
const orb=new T.SphereGeometry(.5,32,20),wall=new T.BoxGeometry(1,1,1),curtain=new T.PlaneGeometry(1,1);
const cylinder=new T.CylinderGeometry(.5,.5,1,64,1,true);
const vertex=`varying vec2 uv0;varying vec3 local;
void main(){uv0=uv;local=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment=`varying vec2 uv0;varying vec3 local;
uniform float t,age,front,style,alpha;
float line(float p,float w){return 1.-smoothstep(w,w+max(.008,fwidth(p)),abs(p));}
float filament(float p,float w){return line(fract(p+.5)-.5,w);}
void main(){
  vec2 v=uv0;vec2 p=v*2.-1.;float r=length(p),a=0.;vec3 c;
  if(style<=3.){
    float lead=front-v.y;
    float skew=sin(p.x*11.+floor(v.y*18.)*2.3)*.09;
    float cracks=filament(p.x*5.+abs(fract(v.y*13.)-.5)*2.+skew,.035);
    float wake=smoothstep(-.026,.018,lead)*(1.-smoothstep(.04,.37,lead));
    float edge=line(lead,.016);
    if(style==3.){
      float veins=filament(v.x*8.+sin(v.y*17.+p.x*4.+t*3.)*.64,.026);
      a=wake*(.67+.32*veins)+.6*edge;c=mix(vec3(.024,.007,.049),vec3(.025,.93,.86),veins*.85+edge*.15);
    }else{
      a=wake*(.10+.89*cracks)+edge*.65;
      c=mix(vec3(.78,.115,.009),vec3(1.,.83,.12),cracks+edge*.25);
    }
    if(front<0.)a=style==3.?0.:.14*cracks+.65*line(abs(p.x)-.98,.014);
  }else if(style==4.){
    float strand=max(filament((v.x+v.y*.25)*19.,.016),filament((v.x-v.y*.25)*19.,.016));
    float border=line(abs(p.y)-.97,.012);
    a=.055+strand*.44+border*.84;c=mix(vec3(.01,.30,.73),vec3(.37,.98,1.),max(strand,border));
  }else if(style==5.){
    float wire=max(filament(v.x*14.+v.y*6.+t*.8,.047),filament(v.x*9.-v.y*7.-t*.55,.032));
    float ribbon=filament(v.y*4.+v.x*2.-t,.19);
    a=.15+.8*wire+.34*ribbon;c=mix(vec3(.05,.24,.72),vec3(.39,1.,1.),wire+.38*ribbon);
  }else if(style==6.){
    float net=max(filament((p.x+p.y)*4.+sin(p.y*6.)*.15,.018),filament((p.x-p.y)*4.,.018));
    float rim=line(r-front,.035);a=(.10+.55*net)*step(r,front)+rim*.96;
    c=mix(vec3(.16,.32,.84),vec3(.72,1.,1.),rim+net*.45);
  }else if(style==15.){
    float scan=filament(v.y*41.+sin(v.x*31.-t*2.)*.20-t*.6,.135);
    float edge=exp(-min(v.y,1.-v.y)*28.);
    a=.85+.12*scan+.13*edge;c=mix(vec3(.49,.64,.70),vec3(.8,1.,1.),edge+.20*scan);
  }else if(style==16.){
    float petals=.72+.19*sin(v.x*51.+v.y*9.+t*5.)+.11*cos(v.x*23.-v.y*17.);
    float ink=sin(v.x*30.+v.y*17.+front*3.);a=petals*(1.-front*.6);
    c=mix(vec3(1.,.13,.014),vec3(1.,.76,.032),smoothstep(-.35,.6,ink));
    c=mix(c,vec3(.02,.85,.78),smoothstep(.80,.99,sin(v.x*42.-v.y*26.))*.9);
  }else if(style==17. || style==18.){
    float echo=filament(r*3.-front*3.,.065),pulse=line(r-front,.052);
    a=step(r,1.)*(.16+.44*echo+.66*pulse);
    c=style==17.?mix(vec3(.13,.025,.45),vec3(.70,.31,1.),echo+pulse):mix(vec3(.22,.10,.02),vec3(1.,.77,.31),echo+pulse);
  }else if(style==20.){
    float seed=fract(v.x*11.+floor(v.y*5.)*.39);
    float leaf=pow(max(0.,1.-abs(seed-.5)*4.),2.)*pow(.5+.5*sin(v.y*20.-t*6.),4.);
    float spiral=filament(v.y*2.-v.x*2.+front*.6,.055);
    a=(leaf+.36*spiral)*sin(v.y*3.14159);c=mix(vec3(.06,.76,.49),vec3(.91,.99,.42),leaf);
  }else if(style==19.){
    float cut=filament(v.x*4.+v.y*.72-front,.03);
    a=.12+.84*cut;c=mix(vec3(.42,.17,.09),vec3(1.,.83,.34),cut);
  }else if(style==13.){
    float stretch=v.x*10.+sin(v.y*6.+v.x*13.+t*4.)*.76;
    float veins=filament(stretch+sin(v.y*21.-t*4.)*.19,.031);
    float crest=.52+.43*(.5+.5*sin(v.x*36.+sin(v.x*87.)+t*6.));
    a=(.46+.54*veins)*(1.-smoothstep(crest-.23,crest,v.y));c=mix(vec3(.022,.008,.047),vec3(.02,.91,.85),veins);
  }else if(style==14.){
    float cell=fract(v.x*17.+floor(v.x*5.)*.32);
    float shard=1.-abs(2.*cell-1.);
    float crest=shard*(.35+.55*abs(sin(floor(v.x*17.)*7.3+t*3.)));
    a=(1.-smoothstep(crest-.04,crest,v.y))*(.9-.55*v.y);
    c=mix(vec3(.65,.11,.014),vec3(1.,.84,.18),line(v.y-crest+.09,.09)+.29*shard);
  }else if(style==12.){
    float angle=abs(atan(p.x,p.y));float radius=length(p);if(angle>.567 || radius>1.)discard;
    float ripple=line(radius-front,.09);a=.15+.8*ripple;c=mix(vec3(.94,.57,.05),vec3(.92,.75,1.),ripple);
  }else if(style==11.){
    float grid=filament(v.x*10.+v.y*2.,.025);float hot=pow(.5+.5*cos(v.x*51.+sin(v.y*14.+t*9.)*2.),3.);
    a=.13+grid*.52+hot*.59*front;c=mix(vec3(.95,.19,.012),vec3(1.,.91,.26),hot);
  }else{
    float lat=v.y,angular=v.x*6.28318;
    float cells=filament(v.x*12.+sin(lat*19.+t*4.)*.6,.042);
    float belt=filament(lat*(style==10.?4.:6.)-front*2.+sin(angular*5.)*.12,.042);
    if(style==8.){
      float ray=pow(.5+.5*cos(angular*12.),8.);
      a=(.35+ray*.6)*(.55+.45*sin(lat*3.14159));c=mix(vec3(1.,.22,.045),vec3(1.,.92,.65),ray);
    }else{
      a=.09+.44*cells+.6*belt;
      c=style==10.?mix(vec3(.00,.35,.78),vec3(.05,1.,1.),belt):
        mix(vec3(.91,.13,.012),vec3(1.,.81,.12),belt+cells*.36);
    }
  }
  if(a*alpha<.018)discard;gl_FragColor=vec4(c,clamp(a*alpha,0.,1.));
  #include <colorspace_fragment>
}`;
const waveStyles={'균열':1,'지진 강타':2,'황혼':3};
function surfaceStyle(d){
  if(d.kind==='cyberCage')return 15;
  if(d.kind==='paintBurst' || d.type==='sonar' && d.name==='폭발 봇')return 16;
  if(d.type==='zoneEmitter' && d.kind==='fragment' || d.type==='sonar' && ['무력화/명령','제로/포인트'].includes(d.name))return 17;
  if(d.type==='slow' && d.name==='트레이드마크')return 18;
  if(d.kind==='rendezvousFold')return 19;
  if(d.kind==='regrowth')return 20;
  if(d.type==='groundWave')return waveStyles[d.name];
  if(d.kind==='wingmanBlast')return 12;
  if(d.type==='meshPanel')return 4;
  if(d.type==='cocoon')return 5;
  if(d.type==='net')return 6;
  if(d.type==='aftershock')return 7;
  if(d.type==='wallFlash')return 8;
  if(d.type==='armageddon')return 11;
  if(d.kind==='guided' || d.name==='특별 배송' && d.type==='concuss')return 9;
  if(d.type==='dronePulse' || d.type==='sonar' && d.name==='요동봇')return 10;
}
function makeMaterial(style){
  return new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,side:T.DoubleSide,
    depthWrite:false,forceSinglePass:true,uniforms:{style:{value:style},front:{value:0},age:{value:0},t:{value:0},alpha:{value:1}}});
}
export function warmAbilitySurface(){
  return new T.Mesh(orb,makeMaterial(7));
}
const saturate=T.MathUtils.clamp;
export function presentAbility(d,now){
  const mesh=d.mesh,kind=d.kind;
  let sculpt,span,height;
  if(d.type==='haunt'){sculpt='귀체';span=.72;height=.39;}
  else if(kind==='prowler'){sculpt='추적귀';span=1.1;height=.37;}
  else if(kind==='seeker'){sculpt='추적자';span=.61;height=.42;}
  else if(d.type==='meshNode'){sculpt='meshNode';span=d.parent ? .46:.68;height=span*.54;}
  else if(d.type==='globule'){sculpt=['green','yellow','blue','pink'][d.slot]??'blue';span=.41;height=.24;}
  if(sculpt){
    if(!mesh.userData.sculpture){
      mesh.material.visible=false;mesh.scale.setScalar(1);
      mesh.userData.sculpture=worldSculpture(sculpt,span);mesh.add(mesh.userData.sculpture);
    }
    const at=now-d.born,part=mesh.userData.sculpture;
    mesh.position.set(d.x,d.y+height,d.z);mesh.rotation.y=d.angle??0;
    if(kind==='prowler'){part.position.y=.04*Math.sin(at*15);part.rotation.z=.055*Math.sin(at*13);}
    if(kind==='seeker'){part.position.y=.12*Math.sin(at*5);part.rotation.y=at*2.7;}
    if(d.type==='haunt'){part.position.y=.46*saturate(at/.65,0,1);part.rotation.y=.3*Math.sin(at*3);}
    if(d.type==='globule'){const reclaim=saturate((d.reclaim??0)/1.5,0,1);part.position.y=.055*Math.sin(at*4)+.26*reclaim;part.rotation.y=at*.95+reclaim*5;}
    if(d.type==='meshNode')part.rotation.y=at*.8;
    return true;
  }
  const style=surfaceStyle(d);if(!style)return false;
  if(!mesh.userData.abilitySurface){
    mesh.material.dispose();mesh.material=makeMaterial(style);mesh.userData.abilitySurface=true;
    mesh.geometry=style===15 || style===19?cylinder:style<=3 || [6,12,17,18].includes(style)?floor:style===4 || style===11?wall:orb;
    if(style<=3){
      const face=new T.Mesh(curtain,makeMaterial(style===3?13:14));mesh.add(face);mesh.userData.face=face;
      mesh.userData.disposeField=()=>face.material.dispose();
    }
  }
  const uniforms=mesh.material.uniforms,age=now-d.born,dt=now-(d.start??d.born);
  uniforms.t.value=now;uniforms.age.value=age;uniforms.alpha.value=saturate((d.end-now)*8,0,1);
  mesh.visible=true;
  if(style>=15 && style<=19){
    const q=saturate(age/Math.max(.01,d.end-d.born),0,1);
    if(style===15){const h=d.h*saturate(age/.16,.005,1);mesh.scale.set(d.w,h,d.d);mesh.position.set(d.x,d.y+h*.5,d.z);}
    else if(style===16){const size=(.16+q*.87)*d.w;mesh.scale.set(size,size*.59,size);mesh.position.set(d.x,d.y+(kind==='paintBurst'?.30:d.h*.5),d.z);}
    else if(style===19){mesh.scale.set(1.1+.8*q,2.2*(1-q*.38),1.1+.8*q);mesh.position.set(d.x,d.y+1.1,d.z);}
    else{const size=d.radius?2*d.radius:d.w;mesh.position.set(d.x,d.y+(d.type==='sonar'?d.h*.5:.045),d.z);mesh.scale.set(size,1,size);}
    uniforms.front.value=style===17 && d.type==='zoneEmitter'?Math.max(0,dt%1):style===18?(age%1.3)/1.3:q;
    return true;
  }
  if(style<=3){
    const v=saturate(dt*d.speed/d.reach,0,1);
    uniforms.front.value=dt<0?-1:v;
    mesh.position.set(d.originX-Math.sin(d.angle)*d.reach*.5,d.y+.055,d.originZ-Math.cos(d.angle)*d.reach*.5);
    mesh.rotation.y=d.angle;mesh.scale.set(d.w,1,d.reach);
    const face=mesh.userData.face,h=style===3?3.9:style===2?1.65:.7;
    face.scale.set(1,h,1);face.position.set(0,h/2,.5-v);face.visible=dt>=0;
    face.material.uniforms.t.value=now;face.material.uniforms.alpha.value=uniforms.alpha.value;
    if(style===1 && dt>=0)uniforms.alpha.value*=Math.min(1,(d.end-now)*5);
  }else if(style===20){
    const progress=saturate(age/(d.end-d.born),0,1);mesh.scale.set(.88,.85,.88);mesh.position.set(d.x,d.y+.55+progress*.36,d.z);uniforms.front.value=progress;uniforms.alpha.value*=Math.sin(progress*Math.PI);
  }else if(style===4){
    const lift=saturate((age-.57)/.43,.001,1);
    mesh.scale.set(d.w,d.h*lift,d.d);mesh.position.set(d.x,d.y+d.h*lift*.5,d.z);
  }else if(style===5){
    mesh.visible=!!d.caught;
    mesh.scale.set(d.w,d.h,d.d);mesh.position.set(d.x,d.y+d.h*.5,d.z);
  }else if(style===6){
    mesh.position.set(d.x,d.y+.04,d.z);mesh.scale.set(d.radius*2,1,d.radius*2);
    uniforms.front.value=saturate(age/Math.max(.1,d.start-d.born),.02,1);
  }else if(style===12){
    mesh.position.set(d.x,d.y+d.h/2+.055,d.z);mesh.rotation.y=d.angle;mesh.scale.set(d.w,1,d.d);
    uniforms.front.value=saturate(age/(d.end-d.born),0,1);
  }else if(style===11){
    const hot=dt<0?0:1-saturate((dt%.25)/.25,0,1);
    const h=dt<0?.045:.20+hot*2.8;
    mesh.rotation.y=d.angle;mesh.scale.set(d.w,h,d.d);mesh.position.set(d.x,d.y+h*.5+.015,d.z);
    uniforms.front.value=hot;uniforms.alpha.value*=dt<0?.25+.4*saturate(1+dt,0,1):1;
  }else if(style===10){
    const wait=d.type==='dronePulse'?.4:0;
    const v=saturate((age-wait)/(d.end-d.born-wait),.001,1);
    mesh.position.set(d.x,d.y+d.h*.5,d.z);mesh.scale.setScalar(d.w*v);
    uniforms.front.value=v;uniforms.alpha.value*=.65;
  }else{
    const guided=kind==='guided',waiting=dt<0;
    const radius=d.radius??(style===8?.25:d.w*.5);
    if(guided && now<d.land){
      const v=saturate(age/Math.max(.01,d.land-d.born),0,1),from=d.from;
      mesh.position.set(from[0]+(d.x-from[0])*v,from[1]+(d.y+.20-from[1])*v+Math.sin(v*Math.PI)*1.8,from[2]+(d.z-from[2])*v);
      mesh.rotation.y=Math.atan2(d.x-from[0],d.z-from[2]);mesh.scale.set(.23,.22,.85);uniforms.front.value=v;return true;
    }
    const phase=guided?Math.max(0,dt)%d.gap:Math.max(0,dt)%(style===7?.6:1);
    const pulse=saturate(phase/.38,0,1);
    const size=style===8?(waiting?.1+age*.12:.4):radius*2*(waiting?.95:.24+.76*pulse);
    mesh.scale.set(size,waiting && style!==8?.06:style===8?size:size*.85,size);
    mesh.position.set(d.x,style===7||style===8?d.y+d.h*.5:d.y+.07,d.z);
    uniforms.front.value=pulse;uniforms.alpha.value*=waiting?.44:1-pulse*.47;
  }
  return true;
}

