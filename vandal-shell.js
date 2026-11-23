import * as T from 'three';
import { installChaosCore } from './chaos-core.js';
import {signatureShell} from './signature-shells.js';
import {collectionParts} from './collection-parts.js';

const models = new Map([
  ['1b9b0131-42fe-b6a7-d212-699b342ba642','rogue'],
  ['522a264e-4ca7-adb0-6cf1-28b2ef938727','chaos'],
]);

const padded = new WeakMap();
function panelArtwork(image) {
  if(padded.has(image))return padded.get(image);
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
  const pixels=g.getImageData(0,0,canvas.width,canvas.height),d=pixels.data;
  const count=canvas.width*canvas.height,front=new Int32Array(count),visited=new Uint8Array(count);let n=0;
  for(let i=0;i<count;i++)if(d[i*4+3]>170){visited[i]=1;front[n++]=i;}
  function fill(dst,src){
    if(visited[dst])return;visited[dst]=1;front[n++]=dst;
    for(let k=0;k<3;k++)d[dst*4+k]=d[src*4+k];
  }
  for(let head=0;head<n;head++){
    const i=front[head],x=i%canvas.width;
    if(x)fill(i-1,i);if(x+1<canvas.width)fill(i+1,i);
    if(i>=canvas.width)fill(i-canvas.width,i);if(i+canvas.width<count)fill(i+canvas.width,i);
  }
  for(let i=0;i<count;i++)d[i*4+3]=255;
  g.putImageData(pixels,0,0);padded.set(image,canvas);return canvas;
}

// Side panels follow the collection artwork. The barrel, iron sights, rails,
// magazine lips and stock braces have independent cross sections and materials.
export function buildVandalShell(root, skin, art, bounds, muzzleLeft, mirror, original) {
  const signature=skin?.name.includes('밴달') && ['neptune','chronovoid','kuronami','magepunk'].includes(skin.banner);
  const family=signature?skin.banner:models.get(skin?.id);
  if(!family)return;
  const rogue=family==='rogue',len=bounds.max.x-bounds.min.x,center=bounds.getCenter(new T.Vector3());
  const aspect=(art.bottom-art.top)/(art.right-art.left);
  const variant=skin.variants?.find(v=>v.id===skin.variant)?.name??'';
  const colors=rogue?{녹색:0x515744,빨간색:0x803938,파란색:0x345674}:{녹색:0x365d4a,흰색:0xbcb7b3,파란색:0x274f82};
  const trim=colors[variant]??(rogue?0x545961:0x57476d);
  const texture=new T.Texture(panelArtwork(art.image));texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;texture.needsUpdate=true;
  const steel=(color,roughness=.43,metalness=.40)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const mats={
    paint:new T.MeshStandardMaterial({map:texture,roughness:.43,metalness:.20}),
    dark:steel(rogue?0x333639:0x292937),edge:steel(trim,.34),black:steel(0x161922,.62,.19),
    silver:steel(rogue?0x797d80:0xb99a68,.30,.53),pad:steel(0x28292d,.83,.06),
    light:new T.MeshStandardMaterial({color:rogue?0xd84c35:0x76bbff,emissive:rogue?0xcd2e1a:0x3899ff,emissiveIntensity:skin.visualOn?.65:0}),
  };
  if(signature){const edge={neptune:0xb9b8a6,magepunk:0x9e6e48,chronovoid:0x8a7970,kuronami:0x405264}[family];mats.edge.color.setHex(edge);mats.light.color.setHex(0x75dfea);mats.light.emissive.setHex(0x4fbddd);}
  if(signature){
    mats.silver.color.setHex(family==='magepunk'?0xc9ac82:family==='chronovoid'?0xc0a76f:0xaebfc9);
    mats.dark.color.setHex(family==='neptune'?0x35444e:0x202634);
  }
  const pools=new Map(),geometries=[];
  const y=v=>(.5-v)*aspect, coord=(u,v,z)=>new T.Vector3(u,y(v),z);
  function emit(geo,target,face,rim=face){
    const raw=geo.index?geo.toNonIndexed():geo,p=raw.attributes.position,n=raw.attributes.normal;
    for(let i=0;i<p.count;i+=3){
      const flat=Math.min(Math.abs(n.getZ(i)),Math.abs(n.getZ(i+1)),Math.abs(n.getZ(i+2)))>.92;
      const roof=signature && face==='paint' && n.getY(i)>.78;
      const mat=flat || roof?face:rim;
      const key=target+'/'+mat;
      if(!pools.has(key))pools.set(key,{target,mat,position:[],normal:[],uv:[]});
      const b=pools.get(key);
      for(let j=i;j<i+3;j++){
        const u=p.getX(j),v=.5-p.getY(j)/aspect+(roof?.025+Math.abs(p.getZ(j))*.48:0);
        b.position.push(u,p.getY(j),p.getZ(j));b.normal.push(n.getX(j),n.getY(j),n.getZ(j));
        b.uv.push((art.left+(mirror?1-u:u)*(art.right-art.left))/art.w,(art.top+v*(art.bottom-art.top))/art.h);
      }
    }
    if(raw!==geo)raw.dispose();geo.dispose();
  }
  const makePath=(path,pts)=>{pts.forEach(([u,v],i)=>i?path.lineTo(u,y(v)):path.moveTo(u,y(v)));path.closePath();return path;};
  function panel(pts,width,mat='paint',rim='dark',target='body',holes=[],bevel=.002,z=0){
    const shape=makePath(new T.Shape(),pts);for(const hole of holes)shape.holes.push(makePath(new T.Path(),hole));
    const g=new T.ExtrudeGeometry(shape,{depth:2*width,steps:1,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,curveSegments:5});
    emit(g.translate(0,0,z-width),target,mat,rim);
  }
  function rod(a,b,r1,r2,mat,target='body',sides=16){
    const from=coord(...a),to=coord(...b),axis=to.clone().sub(from);
    const g=new T.CylinderGeometry(r2,r1,axis.length(),sides);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize()));
    const middle=from.lerp(to,.5);emit(g.translate(middle.x,middle.y,middle.z),target,mat);
  }
  function sleeve(u,v,end,rad,mat){rod([u,v,0],[end,v,0],rad,rad,mat);}
  function pins(u,v,z,r=.004){for(const sign of [-1,1])rod([u,v,sign*z],[u,v,sign*(z+.0016)],r,r,'silver','body',8);}
  function stripe(points,width,mat,target='body'){for(const z of [-width,width])panel(points,.0008,mat,mat,target,[],.0003,z);}
  if(signature)signatureShell(family,{panel,rod,sleeve,stripe,pins},skin);
  else if(rogue){
    sleeve(.012,.192,.416,.013,'dark');
    sleeve(.004,.192,.097,.018,'black');sleeve(.092,.192,.119,.016,'silver');
    // The open cage has a dark barrel behind each real vent.
    const vents=Array.from({length:4},(_,i)=>{const u=.222+i*.039;return [[u,.158],[u+.025,.158],[u+.013,.246],[u-.010,.246]];});
    panel([[.174,.103],[.393,.080],[.457,.142],[.433,.310],[.201,.31],[.178,.263]],.026,'paint','edge','body',vents);
    for(const z of [-.017,.017])rod([.19,.13,z],[.435,.12,z],.006,.008,'dark');
    panel([[.342,.096],[.590,.083],[.697,.117],[.713,.191],[.673,.297],[.544,.318],[.49,.392],[.442,.34],[.386,.285]],.031,'paint','dark');
    panel([[.308,.053],[.622,.044],[.653,.093],[.314,.113]],.018,'dark','dark');
    for(let i=0;i<13;i++){const u=.308+i*.024;panel([[u,.043],[u+.014,.043],[u+.017,.072],[u-.002,.072]],.021,'edge','edge','body',[],.0007);}
    panel([[.172,.125],[.184,.014],[.195,.003],[.212,.054],[.205,.126]],.007,'dark','edge','body',[[[.185,.086],[.190,.043],[.197,.081]]],.0008);
    for(const z of [-.012,.012])rod([.598,.084,z],[.604,.021,z],.004,.004,'dark');
    sleeve(.688,.188,.928,.015,'edge');
    for(let i=0;i<8;i++)sleeve(.70+i*.024,.188,.707+i*.024,.019,'black');
    panel([[.798,.077],[.99,.070],[.999,.154],[.984,.583],[.942,.612],[.922,.518],[.905,.280],[.829,.261]],.020,'paint','edge','body',[[[.859,.146],[.918,.143],[.917,.206],[.853,.204]],[[.936,.261],[.960,.208],[.955,.468],[.945,.47]]]);
    panel([[.984,.093],[.998,.097],[.988,.564],[.969,.580]],.023,'pad','pad');
    panel([[.451,.354],[.551,.367],[.516,.586],[.464,.82],[.412,.988],[.380,.981],[.355,.798],[.395,.703],[.425,.525]],.024,'paint','dark','mag');
    for(let i=0;i<3;i++){const u=.438+.022*i;stripe([[u,.441],[u+.007,.442],[u-.047,.733],[u-.06,.773]],.0246,'edge','mag');}
    panel([[.353,.801],[.374,.772],[.421,.923],[.409,.993],[.382,.98]],.028,'paint','edge','mag');
    panel([[.533,.299],[.687,.25],[.752,.703],[.692,.799],[.66,.640],[.626,.442],[.554,.496],[.511,.455]],.017,'paint','dark','body',[[[.548,.333],[.625,.324],[.64,.414],[.559,.452],[.54,.425]],[[.668,.452],[.694,.437],[.704,.517],[.679,.531]],[[.695,.583],[.713,.562],[.728,.658],[.705,.687]]]);
    pins(.457,.183,.033);pins(.493,.19,.033);pins(.652,.152,.033);
    stripe([[.544,.205],[.568,.202],[.56,.216],[.54,.222]],.034,'light');
  }else{
    sleeve(.012,.212,.670,.016,'edge');
    panel([[0,.165],[.041,.14],[.49,.14],[.53,.194],[.491,.277],[.027,.276],[.009,.253]],.021,'paint','edge');
    for(const z of [-.024,.024]){
      rod([.06,.222,z],[.47,.222,z],.005,.006,'silver');
      rod([.14,.275,z],[.475,.275,z],.007,.012,'dark');
    }
    panel([[.128,.131],[.140,.053],[.158,.044],[.175,.126]],.010,'edge','silver','body',[[[.145,.111],[.150,.074],[.159,.115]]],.001);
    panel([[.164,.089],[.448,.074],[.468,.11],[.177,.13]],.011,'black','edge');
    panel([[.394,.14],[.427,.047],[.452,.047],[.46,.143]],.011,'edge','silver','body',[[[.419,.132],[.432,.072],[.443,.077],[.444,.136]]],.001);
    panel([[.443,.149],[.649,.139],[.700,.182],[.697,.277],[.633,.347],[.515,.341],[.473,.439],[.447,.351]],.028,'paint','dark');
    for(let i=0;i<3;i++){const v=.185+i*.041;for(const z of [-.03,.03])rod([.482,v,z],[.573,v,z],.0037,.0043,'silver');}
    panel([[.573,.118],[.827,.091],[.989,.126],[.994,.203],[.956,.313],[.738,.276],[.674,.309],[.639,.255]],.023,'paint','edge');
    for(const z of [-.018,.018])rod([.632,.117,z],[.98,.135,z],.004,.007,'edge');
    panel([[.774,.26],[.968,.245],[.995,.169],[.991,.501],[.876,.580],[.847,.533],[.811,.316]],.020,'paint','dark','body',[[[.838,.308],[.948,.30],[.937,.433],[.881,.491],[.871,.471]]]);
    panel([[.983,.147],[.999,.147],[.998,.492],[.979,.514]],.023,'pad','pad');
    panel([[.476,.33],[.551,.348],[.532,.628],[.486,.863],[.443,.995],[.406,.987],[.397,.846],[.448,.652]],.022,'paint','dark','mag');
    for(let i=0;i<6;i++){const v=.47+i*.072,u=.497-i*.009;stripe([[u,v],[u+.012,v+.005],[u+.01,v+.033],[u-.002,v+.029]],.022,'edge','mag');}
    panel([[.527,.294],[.686,.277],[.736,.76],[.683,.843],[.642,.609],[.619,.456],[.56,.504],[.519,.458]],.016,'paint','dark','body',[[[.552,.34],[.617,.336],[.631,.423],[.566,.463],[.548,.437]]]);
    for(const side of [-1,1]){
      const z=side*.014;
      rod([.615,.111,z],[.943,.104,z],.0045,.006,'silver');
      rod([.626,.113,z+side*.006],[.916,.108,z+side*.006],.003,.003,'dark');
      for(let j=0;j<7;j++){
        const u=.674+j*.03;
        rod([u,.105,z],[u+.017,.101,z],.0033,.0033,skin.visualOn?'light':'edge');
      }
    }
    for(let j=0;j<6;j++){
      const u=.225+j*.033;
      panel([[u,.139],[u+.012,.137],[u+.019,.164],[u+.006,.166]],.023,'edge','edge','body',[],.001);
    }
    pins(.458,.199,.030);pins(.63,.193,.030);
  }
  rod([.603,.314,0],[.612,.393,0],.004,.0025,'silver');
  const hidden=new T.MeshBasicMaterial({visible:false});original.forEach(o=>o.material=hidden);
  const primary=root.getObjectByName('Root')??root, mag=root.getObjectByName('Magazine_Main')??primary;
  const extra=root.getObjectByName('Magazine_Extra'),spare=new T.Group();if(extra){extra.add(spare);spare.visible=false;root.userData.spareMagazine=spare;}
  const rootToShape=new T.Matrix4().compose(new T.Vector3(muzzleLeft?bounds.min.x:bounds.max.x,center.y,center.z),
    new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),muzzleLeft?0:Math.PI),new T.Vector3(len,len,len));
  const pivots=[];
  for(const [target,bone] of [['body',primary],['mag',mag]]){
    const g=new T.Group();pivots.push(g);
    g.applyMatrix4(bone.matrixWorld.clone().invert().multiply(root.matrixWorld).multiply(rootToShape));bone.add(g);
    for(const batch of pools.values())if(batch.target===target){
      const geo=new T.BufferGeometry();geometries.push(geo);
      for(const [name,arr,size] of [['position',batch.position,3],['normal',batch.normal,3],['uv',batch.uv,2]])geo.setAttribute(name,new T.Float32BufferAttribute(arr,size));
      const mesh=new T.Mesh(geo,mats[batch.mat]);g.add(mesh);
    }
    if(target==='mag'&&extra)spare.add(g.clone());
  }
  if(rogue && skin.visualOn)root.userData.drawGlow=(tag,t)=>{mats.light.emissiveIntensity=.6+(tag==='equip'?2.5*Math.exp(-((t-.54)**2)/.012):0);};
  const releaseCore=installChaosCore(root,primary,skin,bounds,muzzleLeft,aspect);
  const releaseParts=signature?collectionParts(root,primary,skin,bounds,muzzleLeft,aspect):null;
  return ()=>{
    releaseCore?.();releaseParts?.();delete root.userData.spareMagazine;delete root.userData.drawGlow;
    spare.removeFromParent();pivots.forEach(p=>p.removeFromParent());geometries.forEach(g=>g.dispose());
    Object.values(mats).forEach(m=>m.dispose());texture.dispose();hidden.dispose();
  };
}
