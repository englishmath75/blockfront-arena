import * as T from 'three';
import {worldSculpture} from './ability-sculptures.js';

const floor=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
const orb=new T.SphereGeometry(.5,32,20),wall=new T.BoxGeometry(1,1,1),curtain=new T.PlaneGeometry(1,1);
// A sixty-degree sound front in local space. Its normalized footprint follows
// the same circular range and angle used to test players against Bassquake.
const bassArc=new T.CylinderGeometry(1,1,1,40,5,true,Math.PI*5/6,Math.PI/3);
const cylinder=new T.CylinderGeometry(.5,.5,1,64,1,true);
const vertex=`varying vec2 uv0;varying vec3 local;
void main(){uv0=uv;local=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment=`varying vec2 uv0;varying vec3 local;
uniform float t,age,front,style,alpha;
float line(float p,float w){return 1.-smoothstep(w,w+max(.008,fwidth(p)),abs(p));}
float filament(float p,float w){return line(fract(p+.5)-.5,w);}
void main(){
  vec2 v=uv0;vec2 p=v*2.-1.;float r=length(p),a=0.;vec3 c;
  if(style>=65.){
    float phase=sin(v.x*18.+v.y*8.+sin(v.y*7.-t*1.7));
    float ribbon=filament(v.y*3.+v.x*.9+.20*phase-t*.55,.034);
    if(style==65.){
      // Slightly different cut faces on each block keep the four breakable sections readable.
      float seed=floor(front*.5),fortified=mod(front,2.);
      vec2 q=v*vec2(2.8,2.3)+vec2(2.71*seed,.63*seed);
      vec2 cell=floor(q),f=fract(q);float near1=9.,near2=9.,facet=0.;
      for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
        vec2 off=vec2(float(i),float(j)),id=cell+off;
        vec2 jitter=fract(sin(vec2(dot(id,vec2(127.1,311.7)),dot(id,vec2(269.5,183.3))))*4375.5453);
        vec2 diff=off+.19+.62*jitter-f;float dd=dot(diff,diff);
        if(dd<near1){near2=near1;near1=dd;facet=jitter.x;}else near2=min(near2,dd);
      }
      float edge=1.-smoothstep(.002,.036,near2-near1),h=local.y+.5;
      float seam=smoothstep(.0,.025,min(v.x,1.-v.x));
      vec3 base=mix(vec3(.013,.051,.097),vec3(.012,.43,.245),smoothstep(-.15,.87,h));
      c=base*(.71+.30*facet+.12*sin(2.7*v.x+h*2.3))*(.47+.53*seam);
      c+=vec3(.10,.28,.20)*edge*(.13+.23*fortified)*(.2+.8*h);
      c+=vec3(.06,.35,.24)*smoothstep(.89,1.,h);
      if(abs(local.x)>.499)c*=.78;
      a=1.;
    }else if(style==66.){
      c=mix(vec3(.04,.025,.12),vec3(.24,.16,.42),.39+.36*phase+.14*sin(v.y*24.+phase));a=1.;
    }else if(style==67.){
      c=mix(vec3(.46,.55,.73),vec3(.91,.97,1.),.5+.33*phase+.17*ribbon);a=1.;
    }else if(style==68.){
      float b=filament(p.x*3.+p.y*.77-t*2.,.042);
      c=.6+.42*cos(6.28*(v.x*1.35+v.y*.58-t*.25+vec3(.0,.33,.67)));a=.20+.53*b;
    }else{
      float strands=filament(v.x*4.+v.y*1.7-t*.75+.12*phase,.061);
      float base=1.-smoothstep(.67,1.,v.y);
      c=style==69.?mix(vec3(.02,.47,.41),vec3(.69,1.,.86),strands):mix(vec3(.08,.034,.17),vec3(.30,.56,.95),strands);
      if(style==72.)c=mix(vec3(.34,.63,.72),vec3(.88,.96,1.),strands);
      if(style==71.)c=mix(vec3(.42,.013,.42),vec3(1.,.26,.77),strands);
      a=(.065+.78*strands+.27*ribbon)*base*(.77+.23*sin(t*4.));
    }
  }else if(style>=50.){
    float az=atan(p.y,p.x),rim=line(r-.95,.016);
    float swirl=sin(v.x*19.+sin(v.y*9.-t*.7)*2.+t*.33);
    if(style==50. || style==51. || style==52.){
      float roll=sin(v.y*20.+1.8*swirl+t*.34),band=smoothstep(-.48,.74,roll);
      if(style==50.)c=mix(vec3(.25,.205,.17),vec3(.67,.62,.50),.36+.33*swirl+.19*band);
      else if(style==51.)c=mix(mix(vec3(.33,.26,.64),vec3(.54,.69,.88),.5+.5*swirl),vec3(.93,.70,.94),band);
      else c=mix(vec3(.10,.064,.19),vec3(.49,.32,.63),band*(.68+.3*swirl));
      c+=.045*filament(v.y*5.+swirl*.61+t*.18,.023);a=1.;
    }else if(style==53. || style==54. || style==55.){
      vec2 q=v*(style==54.?vec2(14.,20.):vec2(9.,6.));q.x+=mod(floor(q.y),2.)*.5;
      vec2 cell=abs(fract(q)-.5);float hex=max(cell.x,cell.x*.5+cell.y*.866);
      float grid=line(hex-.40,.021);float sweep=filament(v.y*1.5+v.x*.4-t*.37,.038);
      c=mix(style==54.?vec3(.052,.041,.12):vec3(.12,.078,.28),vec3(.62,.46,1.),grid*.80+sweep*.20);
      a=style==53.?.61+.36*grid:.99;
    }else if(style==56.){
      float filament1=filament(v.x*52.+sin(v.y*9.-t*5.)*.48,.09);
      float flare=filament(v.y*2.+t*2.4,.07);
      c=mix(vec3(1.,.28,.025),vec3(1.,.91,.54),filament1+.25*flare);
      a=front<0.?(.16+.36*filament1):.18+.62*filament1+.18*flare;
    }else if(style==57.){
      float circuit=filament(r*3.-t*.57,.032),ticks=filament(az*3.82,.037);
      c=mix(vec3(.84,.34,.035),vec3(1.,.83,.40),max(rim,ticks));
      a=step(r,1.)*(.07+.57*rim+.41*circuit+.32*ticks*step(.77,r));
    }else if(style==58. || style==59. || style==60.){
      float threads=filament(v.y*3.+swirl*.49-t*.54,.043);
      c=style==58.?mix(vec3(.31,.12,.53),vec3(.96,.64,.92),threads):
        style==59.?mix(vec3(.08,.44,.95),vec3(1.,.95,.18),threads):mix(vec3(.15,.16,.88),vec3(.58,.92,1.),threads);
      a=.12+.67*threads+.19*sin(front*3.14);
    }else{
      float fork=filament(p.x*2.+sin(v.y*15.+t*3.)*.32,.046);
      c=mix(vec3(.04,.49,.99),vec3(.71,.99,1.),fork);a=(1.-abs(p.y))*(.08+.69*fork);
    }
  }else if(style>=40.){
    float phi=atan(p.y,p.x);
    if(style==40. || style==41.){
      float turf=sin(p.x*9.+sin(p.y*13.+t*2.)*1.7+t)*cos(p.y*11.-t*2.);
      float cells=filament(r*4.+turf*.38-t*.54,.06);
      c=style==40.?mix(vec3(.035,.32,.055),vec3(.64,1.,.12),.45+.36*turf+.18*cells):
        mix(vec3(.83,.075,.003),vec3(1.,.88,.18),.39+.35*turf+.19*cells);
      a=(1.-smoothstep(.82+.05*turf,1.,r))*(.84+.15*cells);
    }else if(style==42. || style==43. || style==44.){
      float flow=sin(v.x*24.+sin(v.y*14.+t)*2.+v.y*8.-t*1.4);
      float veins=filament(v.y*4.+flow*.24-t*.17,.035);
      c=style==42.?mix(vec3(.025,.17,.045),vec3(.35,.78,.045),.49+.32*flow+.18*veins):
        mix(vec3(.105,.036,.22),vec3(.57,.27,.79),.43+.34*flow+.19*veins);
      float stars=pow(max(0.,sin(v.x*(style==44.?1300.:122.)+cos(v.y*109.))*sin(v.y*157.+v.x*52.)),24.);
      if(style!=42.)c+=vec3(1.,.79,.47)*stars;a=.99;
    }else{
      float wind=style==45.?-t*2.:t*1.4;
      float spiral=filament(r*3.+phi*.477+wind*.43+sin(r*11.-t)*.21,.075);
      float beat=filament(r*2.-front*2.,.042),rim=line(r-.94,.026);
      if(style==45.)c=mix(vec3(.12,.017,.27),vec3(.97,.70,.33),spiral);
      else if(style==46.)c=mix(vec3(.44,.034,.61),vec3(.99,.77,1.),beat);
      else if(style==47.)c=mix(vec3(.018,.083,.11),vec3(.11,.99,.96),spiral);
      else c=mix(vec3(.79,.087,.006),vec3(1.,.86,.20),max(spiral,rim));
      a=step(r,1.)*(.10+.46*spiral+.51*beat+.62*rim);
    }
  }else if(style<=3.){
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
  }else if(style==21. || style==22.){
    float plasma=filament(v.y*8.+v.x*4.+sin(v.x*31.-t*10.)*.43-t*8.,.06);
    float bolt=filament(v.x*7.+sin(v.y*29.+t*12.)*.16,.045);
    c=mix(vec3(.015,.11,.85),vec3(.63,.98,1.),max(plasma,bolt));
    a=(.10+.65*plasma+.34*bolt)*(.78+.22*sin(v.y*3.14));
  }else if(style==23. || style==24. || style==25.){
    float phi=atan(p.y,p.x),poly=r*cos(mod(phi+3.14159/5.,6.28318/5.)-3.14159/5.);
    float beat=filament(poly*2.9-front*2.7,.036),rim=line(r-.98,.018);
    c=mix(style==24.?vec3(.008,.24,.16):vec3(.20,.03,.31),style==24.?vec3(.43,1.,.67):vec3(1.,.67,.12),beat+rim);
    a=step(r,1.)*(.10+.69*beat+.57*rim);
    if(style==25.){float side=abs(p.x),height=.28+.68*sqrt(max(0.,1.-p.x*p.x));
      float ringLine=filament(length(vec2(p.x*1.36,v.y)) * 3.1-front*1.4,.022);
      float fabric=.5+.5*sin(p.x*12.+v.y*3.-t*8.);
      a=(.09+.13*fabric+.72*ringLine)*(1.-smoothstep(height-.15,height,v.y))*(1.-smoothstep(.85,1.,side));
      c=mix(vec3(.36,.018,.23),vec3(1.,.67,.28),ringLine+.16*fabric);}
  }else if(style==26. || style==27. || style==28.){
    float surf=sin(v.x*21.+v.y*7.+sin(v.y*14.-t*1.1)*2.+t*.6);
    float vein=filament(v.y*3.-v.x*2.+surf*.31-t*.29,.035),rim=filament(v.x*2.+v.y+surf*.13-t*.12,.021);
    c=style==26.?mix(vec3(.18,.095,.37),vec3(.30,.84,.58),smoothstep(-.55,.75,surf)):mix(vec3(.011,.062,.14),vec3(.04,.39,.48),.52+.45*surf);
    c=mix(c,vec3(.82,.98,.95),vein*.86);
    c=mix(c,vec3(1.,.70,.27),rim*(style==28.?.98:.44));
    a=.985;
  }else if(style==29. || style==30. || style==31.){
    float phi=atan(p.y,p.x),jag=floor(r*17.)*.13;
    float wires=filament(phi*5.9+r*(style==31.?4.:1.7)+sin(r*14.+t*.5)*.31+jag,.06);
    float edge=line(r-front,.04),mote=pow(max(0.,cos(phi*17.+r*22.-t*7.)),18.)*wires;
    c=style==29.?mix(vec3(.18,.008,.28),vec3(1.,.14,.81),max(wires,mote)):
      style==30.?mix(vec3(.08,.037,.12),vec3(.64,.50,.81),wires):mix(vec3(.015,.09,.16),vec3(.20,.87,.96),wires);
    c=mix(c,vec3(1.,.68,.18),mote*.9);a=step(r,1.)*(.17+wires*.68+mote*.39+edge*.72);
  }else if(style==35. || style==36.){
    float ray=atan(p.y,p.x),rim=line(r-.99,.009),echo=line(r-front,.022);
    if(style==35.){c=mix(vec3(.10,.39,.46),vec3(.37,1.,.97),echo);a=step(r,1.)*(rim*.79+echo*.22);}
    else{float poly=r*cos(mod(ray+3.14159/5.,6.28318/5.)-3.14159/5.);
      c=mix(vec3(.50,.13,.80),vec3(1.,.78,.24),echo);
      a=step(r,1.)*(.78*filament(poly*2.-front*1.75,.03)+.15*rim);}
  }else if(style==32.){
    float plate=fract(v.x*12.-v.y*.82),ridge=smoothstep(.72,.99,plate);
    c=mix(vec3(.14,.11,.20),vec3(.52,.48,.60),ridge+.17*v.y);
    c=mix(c,vec3(.89,.25,.76),smoothstep(.78,.98,v.y));a=1.;
  }else if(style==33. || style==34.){
    float spoke=filament(v.x*15.+sin(v.y*11.)*.3-t*.7,.057),wave=filament(v.y*4.-front*2.,.065);
    c=style==33.?mix(vec3(.21,.05,.38),vec3(.99,.72,.32),max(spoke,wave)):mix(vec3(.01,.42,.42),vec3(.34,1.,.9),wave);
    a=.045+spoke*.26+wave*.63;
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
  if(d.kind==='jadeWall')return 65;
  if(d.kind==='omenCover')return 66;
  if(d.type==='cloud')return 67;
  if(d.name==='초점 교차' && d.type==='groundWave' || d.kind==='saturate' && d.type==='zoneEmitter')return 68;
  if(d.kind==='resurrection' || d.kind==='healHalo')return 69;
  if(d.kind==='shadowStep')return 70;
  if(d.kind==='windLift' || d.kind==='windTrail')return 72;
  if(d.kind==='skySmoke')return 50;
  if(d.kind==='ruse')return d.posthumous?52:51;
  if(d.kind==='contingency')return 53;
  if(d.kind==='contractFloor')return 54;
  if(d.kind==='contractWall')return 55;
  if(d.type==='orbital')return 56;
  if(d.kind==='beaconField')return 57;
  if(['meddle','pickUp','cloveRevive'].includes(d.kind))return 58;
  if(d.kind==='relayPulse')return 59;
  if(d.kind==='riftFlash' || d.kind==='decoy' && d.type==='wallFlash')return 60;
  if(d.kind==='slideTrail')return 61;
  if(d.incendiary)return 41;
  if(d.acid)return 40;
  if(d.phoenix && d.type==='fire')return 41;
  if(d.kind==='toxinPit' || d.kind==='toxinCloud')return 42;
  if(d.kind==='nebula')return 43;
  if(d.kind==='divide')return 44;
  if(d.kind==='well' || d.kind==='nova')return 45;
  if(['collapse','suspension','flowAnchor'].includes(d.kind) || d.kind==='flashBloom' && d.name==='섬광등')return 46;
  if(d.kind==='vetoField' || d.kind==='vetoFold')return 47;
  if(['phoenixMark','phoenixEcho','flashBloom'].includes(d.kind))return 48;
  if(d.type==='hunterBeam')return 21;
  if(d.type==='shockBurst')return 22;
  if(d.kind==='mpulse')return d.heal?24:23;
  if(d.kind==='harmony' || d.name==='요동치는 베이스')return 25;
  if(d.kind==='waveform')return 26;
  if(d.kind==='cove')return 27;
  if(d.kind==='reckoning')return 28;
  if(d.kind==='swarmField')return 29;
  if(d.kind==='vineField' || d.kind==='steel')return 30;
  if(d.kind==='storm')return 31;
  if(d.kind==='shearWall')return 32;
  if(d.type==='wallFlash' && d.kind==='rose')return 33;
  if(d.type==='sonar' && d.name==='봉쇄')return 34;
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
const up=new T.Vector3(0,1,0),axis=new T.Vector3(),node=new T.Object3D();
const thorn=new T.ConeGeometry(.075,.57,4),alloy=new T.MeshStandardMaterial({color:0xa28ba8,metalness:.79,roughness:.32,emissive:0x2a0d31});
const nanoShard=new T.OctahedronGeometry(1),nanoPink=new T.MeshBasicMaterial({color:0xff70de});
function swarmMotes(mesh,radius){
  const fragments=new T.InstancedMesh(nanoShard,nanoPink,58);
  for(let i=0;i<58;i++){
    const angle=i*2.399963,r=.94*radius*Math.sqrt((i+.5)/58);
    node.position.set(Math.cos(angle)*r,.13+.9*(.5+.5*Math.sin(74.6*i)),Math.sin(angle)*r);
    node.rotation.set(angle,angle*1.6,.38*i);node.scale.set(.019,.045,.017);node.updateMatrix();fragments.setMatrixAt(i,node.matrix);
  }
  fragments.scale.set(1/(2*radius),1,1/(2*radius));mesh.add(fragments);return fragments;
}
function lockdownCountdown(d,now){
  const parent=d.mesh;
  if(!parent.userData.alarm){
    const radial=new T.Mesh(floor,makeMaterial(35));radial.scale.set(65,1,65);parent.add(radial);
    const rays=new T.Mesh(cylinder,makeMaterial(34));rays.scale.set(.46,2.5,.46);parent.add(rays);
    parent.userData.alarm={radial,rays};
    parent.userData.disposeField=()=>{radial.material.dispose();rays.material.dispose();};
  }
  const {radial,rays}=parent.userData.alarm,elapsed=now-d.born,f=1-(elapsed%2)/2;
  radial.position.y=-.50;radial.material.uniforms.front.value=f;
  rays.position.y=.79;rays.rotation.y=elapsed*.9;rays.material.uniforms.front.value=f;
  rays.material.uniforms.t.value=now;rays.material.uniforms.alpha.value=.4+.55*Math.pow(1-f,3);
}
function plantBriars(mesh,radius){
  const thorns=new T.InstancedMesh(thorn,alloy,96);
  for(let i=0;i<96;i++){const a=i*2.399963,r=radius*Math.sqrt((i+.5)/96),h=.48+.52*Math.abs(Math.sin(i*41.1));
    node.position.set(Math.cos(a)*r,.17*h,Math.sin(a)*r);
    node.scale.set(.9,h,1);node.rotation.set(.55*Math.sin(a),a,.61*Math.cos(a));node.updateMatrix();thorns.setMatrixAt(i,node.matrix);}
  mesh.add(thorns);thorns.scale.set(1/(2*radius),1,1/(2*radius));
  mesh.userData.disposeField=()=>thorns.dispose();
}
function presentNew(d,mesh,style,now){
  const u=mesh.material.uniforms,age=now-d.born,dt=now-(d.start??d.born),r=d.radius??d.w*.5;
  if(style===21){
    axis.fromArray(d.axis);mesh.quaternion.setFromUnitVectors(up,axis);
    const width=dt<0?.09+.12*age:2*r*(.4+.6*Math.sin(Math.PI*saturate(dt/.45,0,1)));
    mesh.position.set(d.x+axis.x*d.length*.5,d.y+axis.y*d.length*.5,d.z+axis.z*d.length*.5);
    mesh.scale.set(width,d.length,width);u.alpha.value*=dt<0?.55:1;
  }else if(style===22 || style===33 || style===34){
    const phase=style===34?saturate(age/(d.end-d.born),.02,1):saturate(dt/.35,.02,1);
    const size=style===33?.18+.65*phase:(style===34?d.w:2*r)*phase;
    mesh.scale.setScalar(size);mesh.position.set(d.x,d.y+(style===34?d.h*.5:0),d.z);u.front.value=phase;
  }else if(style===26 || style===27){
    const grow=saturate(dt/.22,.001,1);mesh.visible=dt>=0;
    mesh.scale.set(d.w*grow,d.h*grow,d.d*grow);mesh.position.set(d.x,d.y+d.h*.5,d.z);
    u.style.value=d.shield?28:style;
  }else if(style===28 || style===32 || style===25){
    if(d.type==='groundWave'){
      const reach=saturate(dt*d.speed,.015,d.reach),h=3.6+1.4*Math.sin(Math.PI*reach/d.reach);
      mesh.scale.set(reach,h,reach);mesh.rotation.y=d.angle;mesh.position.set(d.originX,d.y+h*.5,d.originZ);
      mesh.visible=dt>=0;u.front.value=reach/d.reach;return;
    }
    const rise=saturate((style===32?age:dt)/.26,.001,1);
    const width=d.w,h=d.h*rise;
    mesh.rotation.y=d.angle??0;mesh.scale.set(width,h,d.d);mesh.position.set(d.x,d.y+h*.5,d.z);
    mesh.visible=style===32 || dt>=0;
  }else{
    mesh.position.set(d.x,d.y+.048,d.z);mesh.scale.set(2*r,1,2*r);
    u.front.value=d.kind==='steel'?saturate(age/4.4,.01,1):dt<0?saturate(1+dt,.01,1):(dt%(d.gap??1.25))/(d.gap??1.25);
    u.alpha.value*=dt<0?.35:1;
    if(d.kind==='vineField' && !mesh.children.length)plantBriars(mesh,r);
    if(d.kind==='swarmField'){
      const particles=mesh.userData.motes??=swarmMotes(mesh,r);
      particles.rotation.y=age*.82;particles.position.y=.10*Math.sin(age*8);
      if(!mesh.userData.disposeField)mesh.userData.disposeField=()=>particles.dispose();
    }
    if(d.kind==='mpulse'){
      if(!mesh.userData.wave){
        const ring=new T.Mesh(orb,makeMaterial(36)),device=worldSculpture(d.name,.28);
        mesh.add(ring,device);mesh.userData.wave=ring;device.scale.x/=2*r;device.scale.z/=2*r;device.position.y=.11;
        mesh.userData.disposeField=()=>ring.material.dispose();
      }
      const ring=mesh.userData.wave,beat=dt<0?0:(dt%d.gap)/d.gap;
      ring.visible=dt>=0 && beat<.47;ring.scale.set(beat*1.85+.10,Math.min(1,beat*2.1+.08)*r*1.75,beat*1.85+.10);
      ring.material.uniforms.style.value=d.heal?24:36;ring.material.uniforms.front.value=beat;
      ring.material.uniforms.alpha.value=(1-beat)*.8;
    }
  }
}
const liftLoop=new T.TorusGeometry(1,.027,6,40,Math.PI*1.72).rotateX(Math.PI/2);
const liftTint=new T.MeshBasicMaterial({color:0xf19fff}),bindTint=new T.MeshBasicMaterial({color:0x4ee4d3});
export function playerFieldVisual(group,p,now){
  let shield=group.userData.focusShell;
  if(p.isoShield && !shield){
    shield=new T.Mesh(orb,makeMaterial(53));shield.scale.set(1.04,2.04,1.04);shield.position.y=.94;
    shield.material.uniforms.alpha.value=.38;group.add(shield);group.userData.focusShell=shield;
    group.addEventListener('removed',()=>shield.material.dispose());
  }
  if(shield){shield.visible=!!p.isoShield;if(shield.visible)shield.material.uniforms.t.value=now;}
  const lifting=p.suspendedUntil>now,held=p.deafUntil>now && p.tether?.until>now;
  let band=group.userData.statusBands;
  if(!lifting && !held){if(band)band.visible=false;return;}
  if(!band){
    band=new T.Group();for(let i=0;i<3;i++)band.add(new T.Mesh(liftLoop,liftTint));
    group.add(band);group.userData.statusBands=band;
  }
  band.visible=true;
  for(let i=0;i<3;i++){
    const arc=band.children[i],phase=i*2.094+now*(lifting?2.9:-2.4);
    arc.material=lifting?liftTint:bindTint;
    arc.position.y=lifting?.18+i*.43+.12*Math.sin(phase):.12+i*.16;
    arc.rotation.set(lifting?.22:.32,phase,.14*Math.cos(phase));
    arc.scale.setScalar((lifting?.48:.35)+.045*Math.cos(phase));
  }
}
export function presentAbility(d,now){
  const mesh=d.mesh,kind=d.kind;
  if(kind==='refractMote'){
    if(!mesh.userData.mote){mesh.material.visible=false;mesh.scale.setScalar(1);mesh.userData.mote=worldSculpture('굴절',.55);mesh.add(mesh.userData.mote);}
    const trip=d.trip,v=saturate((now-trip.start)/(trip.end-trip.start),0,1),u=v*v*(3-2*v);
    const m=mesh.userData.mote;m.rotation.y=now*9;m.scale.y=m.scale.x*(1+.35*Math.sin(v*Math.PI));
    mesh.position.set(T.MathUtils.lerp(trip.from.x,trip.to.x,u),T.MathUtils.lerp(trip.from.y,trip.to.y,u)+.9,T.MathUtils.lerp(trip.from.z,trip.to.z,u));return true;
  }
  if(kind==='soulStream'){
    if(!d.hand){mesh.visible=false;return true;}
    if(!mesh.userData.soulStream){mesh.material.dispose();mesh.geometry=cylinder;mesh.material=makeMaterial(71);mesh.userData.soulStream=true;}
    axis.fromArray(d.hand).sub(node.position.set(d.x,d.y,d.z));
    const length=axis.length();mesh.visible=length>.02;mesh.position.copy(node.position).addScaledVector(axis,.5);
    mesh.scale.set(.105,length,.105);mesh.quaternion.setFromUnitVectors(up,axis.normalize());
    mesh.material.uniforms.t.value=now;mesh.material.uniforms.alpha.value=saturate((d.end-now)*6,0,1);return true;
  }
  if(kind==='lockdown')lockdownCountdown(d,now);
  if(kind==='shearCollider'){mesh.visible=false;return true;}
  if(kind==='poisonLine' && d.path?.length){
    if(!mesh.userData.pucks){
      const pucks=new T.InstancedMesh(nanoShard,alloy,d.path.length);
      for(const [i,[x,y,z]] of d.path.entries()){node.position.set(x,y+.07,z);node.scale.set(.118,.075,.118);node.rotation.set(0,i*.4,0);node.updateMatrix();pucks.setMatrixAt(i,node.matrix);}
      mesh.material.visible=false;mesh.add(pucks);mesh.userData.pucks=pucks;mesh.userData.disposeField=()=>pucks.dispose();
    }
    mesh.scale.setScalar(1);mesh.position.set(0,0,0);return true;
  }
  let sculpt,span,height;
  if(kind==='beacon'){sculpt='굴절';span=.48;height=.17;}
  if(kind==='soulOrb'){sculpt='포식';span=.48;height=.15;}
  if(kind==='leer'){sculpt='눈총';span=.77;height=.26;}
  if(kind==='focusOrb'){sculpt='구슬 보호막';span=.52;height=.23;}
  if(kind==='decoyMark'){sculpt='기만';span=.36;height=.12;}
  if(kind==='star'){sculpt='성운';span=.47;height=.16;}
  if(['passage','vetoTrap','interceptor','poisonOrb'].includes(kind)){
    sculpt=d.name;span=kind==='interceptor'?.76:kind==='passage'?.65:kind==='vetoTrap'?.36:.28;height=span*.42;
  }
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
    const at=now-d.born,part=mesh.userData.sculpture;mesh.visible=true;
    mesh.position.set(d.x,d.y+height,d.z);if(kind!=='leer')mesh.rotation.y=d.angle??0;
    if(kind==='star' || kind==='passage' || kind==='focusOrb'){part.rotation.y=at*(kind==='star'?1.12:.66);part.position.y=.037*Math.sin(at*3.4);}
    if(kind==='interceptor' && d.on){part.rotation.y=at*2.5;
      if(!mesh.userData.beam){const beam=new T.Mesh(wall,new T.MeshBasicMaterial({color:0x91ffff}));mesh.add(beam);mesh.userData.beam=beam;mesh.userData.disposeField=()=>beam.material.dispose();}
      const beam=mesh.userData.beam;beam.visible=!!d.beam && now-d.cueAt<.20;
      if(beam.visible){axis.fromArray(d.beam);mesh.worldToLocal(axis);beam.scale.set(.036,.036,axis.length());beam.position.copy(axis).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),axis.normalize());}
    }
    if(kind==='beacon' || kind==='soulOrb' || kind==='leer'){
      const opening=saturate((now-d.born)/.28,.08,1);
      part.rotation.y=kind==='leer'?0:at*1.5;
      part.position.y=.06*Math.sin(at*3.6);
      mesh.scale.setScalar(opening*(.95+.05*Math.cos(at*5)));
    }
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
    if(kind==='rose')for(const child of mesh.children)child.visible=false;
    if(style>=21)mesh.geometry=style===25 && d.type==='groundWave'?bassArc:style===21 || kind==='harmony'?cylinder:[23,24,29,30,31].includes(style)?floor:[25,28,32].includes(style)?wall:orb;
    if(style>=40)mesh.geometry=[42,43].includes(style)?orb:style===44?wall:floor;
    if(style>=50){
      mesh.geometry=[50,51,52,58,59,60].includes(style)?orb:[53,54,55].includes(style)?wall:style===56?cylinder:floor;
      if(style===60 && mesh.userData.actor)for(const c of mesh.children)c.visible=false;
      if(style===57){const beacon=worldSculpture('자극제 신호기',.42);beacon.scale.x/=d.w;beacon.scale.z/=d.d;beacon.position.y=.07;mesh.add(beacon);}
    }
    if(style>=65)mesh.geometry=style===65?wall:style===68 && d.type==='groundWave'?floor:style>=69?cylinder:orb;
    if(style===65 || style===66 || style===67){mesh.material.transparent=false;mesh.material.depthWrite=true;}
    if(style<=3){
      const face=new T.Mesh(curtain,makeMaterial(style===3?13:14));mesh.add(face);mesh.userData.face=face;
      mesh.userData.disposeField=()=>face.material.dispose();
    }
  }
  const uniforms=mesh.material.uniforms,age=now-d.born,dt=now-(d.start??d.born);
  uniforms.t.value=now;uniforms.age.value=age;uniforms.alpha.value=saturate((d.end-now)*8,0,1);
  mesh.visible=true;
  if(style>=65){
    const span=d.radius?d.radius*2:d.w;
    if(style===65){const grow=saturate(age/.65,.012,1);mesh.scale.set(d.w,d.h*grow,d.d);mesh.position.set(d.x,d.y+d.h*grow/2,d.z);mesh.rotation.y=d.angle??0;uniforms.front.value=(d.panel??0)*2+(d.fortify?0:1);}
    else if(style===66 || style===67){
      const travel=style===66 && dt<0, v=travel?saturate(age/Math.max(.01,d.start-d.born-1),0,1):1;
      const grow=travel?.035:saturate(dt/(style===67?.6:.18),.035,1);
      mesh.position.set(travel?T.MathUtils.lerp(d.from.x,d.x,v):d.x,travel?T.MathUtils.lerp(d.from.y,d.y+d.h/2,v):d.y+d.h/2,travel?T.MathUtils.lerp(d.from.z,d.z,v):d.z);
      mesh.scale.set(d.w*grow,d.h*grow,d.d*grow);
    }else if(d.type==='groundWave'){
      mesh.rotation.y=d.angle;mesh.scale.set(dt<0?.15:Math.max(.15,Math.min(d.w,2*dt*d.speed)),1,d.reach);
      mesh.position.set(d.originX-Math.sin(d.angle)*d.reach*.5,d.y+.062,d.originZ-Math.cos(d.angle)*d.reach*.5);
    }else if(style===68){const k=dt<0?.035:saturate(dt/.16,.035,1);mesh.scale.setScalar(span*k);mesh.position.set(d.x,d.y+.12,d.z);}
    else if(style===72){
      const u=saturate(age/(d.end-d.born),0,1);
      mesh.position.set(d.x,d.y+.3+u*(kind==='windLift'?1.65:0),d.z);mesh.rotation.set(kind==='windTrail'?Math.PI/2:0,d.angle??0,0,'YXZ');
      mesh.scale.set(d.w*(.4+u*.68),d.h*(.5+u*.5),d.d*(.4+u*.68));uniforms.alpha.value=1-u;
    }else{const k=.88+.12*Math.sin(age*5),h=d.h*saturate(age/.3,.035,1);mesh.scale.set(d.w*k,h,d.d*k);mesh.position.set(d.x,d.y+h/2,d.z);}
    return true;
  }
  if(style>=50){
    const u=saturate(dt/(d.end-(d.start??d.born)),0,1);
    uniforms.front.value=dt<0?-1:u;
    mesh.scale.set(d.w,d.h,d.d);mesh.rotation.y=d.angle??0;mesh.position.set(d.x,d.y+d.h/2,d.z);
    if(style<=53){
      const k=saturate((dt+(style===53?.4:0))/(style===53?.4:.24),.001,1);
      mesh.visible=style===53 || dt>=0;
      mesh.scale.set(d.w*(style===53?1:k),d.h*k,d.d*(style===53?1:k));mesh.position.y=d.y+d.h*k/2;
    }else if(style===56){
      const h=dt<0?.11:Math.max(.1,d.h*saturate(dt/.1,0,1));mesh.scale.y=h;mesh.position.y=d.y+h/2;
    }else if(style===57 || style===61){mesh.scale.y=1;mesh.position.y=d.y+.046;}
    else if(style===58 || style===59 || style===60){
      const charged=['meddle','relayPulse'].includes(kind),k=charged?(dt<0?.95:.33+.67*saturate(dt/.23,0,1)):.31+.69*Math.sin(Math.PI*u);
      mesh.scale.set(d.w*k,(charged?d.w*.42:d.h)*k,d.d*k);mesh.position.y=d.y+(charged?.08:d.h*.51);
      uniforms.alpha.value*=dt<0?.46:1;
    }
    return true;
  }
  if(style>=40){
    const span=d.radius?2*d.radius:d.w;
    uniforms.front.value=dt<0?0:dt%1;
    if(style===42 || style===43){
      const k=T.MathUtils.clamp(dt/(kind==='toxinPit'?2:.23),.001,1);mesh.visible=dt>=0;
      mesh.position.set(d.x,d.y+d.h*k*.5,d.z);mesh.scale.set(d.w*k,d.h*k,d.d*k);
    }else if(style===44){
      const k=T.MathUtils.clamp((dt+1)/1,.001,1);mesh.position.set(d.x,d.y+d.h*k*.5,d.z);mesh.scale.set(d.w,d.h*k,d.d);mesh.rotation.y=d.angle;
    }else{
      const burst=kind==='flashBloom' || kind==='phoenixEcho',k=burst?T.MathUtils.clamp(age/(d.end-d.born),.1,1):1;
      mesh.scale.set(span*k,1,(d.radius?span:d.d)*k);mesh.position.set(d.x,d.y+.055,d.z);
      if(kind==='flashBloom'){mesh.geometry=orb;mesh.scale.setScalar(span*k);}
    }
    return true;
  }
  if(style>=21){presentNew(d,mesh,style,now);return true;}
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

