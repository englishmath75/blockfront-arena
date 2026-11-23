import * as T from 'three';

const sphere=new T.SphereGeometry(1,16,10),ring=new T.TorusGeometry(1,.10,6,32),fin=new T.ConeGeometry(1,1,3),disc=new T.CylinderGeometry(1,1,.17,24);
const liveFamilies=new Set(['neptune','chronovoid','kuronami','magepunk']);
export function collectionParts(weapon,body,skin,bounds,muzzleLeft,aspect){
  if(!liveFamilies.has(skin?.banner))return;
  if(skin.banner==='neptune' ? skin.level<2 : !skin.motionOn)return;
  const family=skin.banner,root=new T.Group(),center=bounds.getCenter(new T.Vector3()),len=bounds.max.x-bounds.min.x;
  root.applyMatrix4(body.matrixWorld.clone().invert().multiply(weapon.matrixWorld));body.add(root);
  const unit=new T.Group();root.add(unit);
  unit.position.set((muzzleLeft?bounds.min.x:bounds.max.x)+(muzzleLeft?1:-1)*len*.53,center.y+len*aspect*.28,center.z);
  if(!muzzleLeft)unit.rotation.y=Math.PI;
  unit.scale.setScalar(len);
  const color=skin.variants?.find(c=>c.id===skin.variant)?.name??'';
  const hue=/보라/.test(color)?0xbc88ff:/빨간|빨강/.test(color)?0xff765c:/녹색|초록/.test(color)?0x76e4ae:family==='chronovoid'?0x9b92ff:0x74eafb;
  const glow=new T.MeshBasicMaterial({color:hue}),dark=new T.MeshStandardMaterial({color:0x25263c,metalness:.65,roughness:.28});
  const glass=new T.MeshBasicMaterial({color:hue,transparent:true,opacity:.40,depthWrite:false});
  const gold=new T.MeshStandardMaterial({color:family==='neptune'?0xffad3b:0xb48047,metalness:.65,roughness:.31});
  const parts=[],paths=[];let chamber,fish;
  function part(parent,geo,mat,pos,size){
    const m=new T.Mesh(geo,mat);parent.add(m);m.position.set(...pos);m.scale.set(...size);return m;
  }
  if(family==='neptune'){
    fish=new T.Group();unit.add(fish);
    for(const s of [-1,1])part(unit,sphere,glass,[-.085,.004,.033*s],[.145,.024,.004]);
    for(let i=0;i<3;i++){
      const f=new T.Group();fish.add(f);
      part(f,sphere,i===1?glow:gold,[0,0,0],[.015,.008,.004]);
      part(f,fin,i===1?glow:gold,[-.016,0,0],[.008,.013,.004]).rotation.z=Math.PI/2;
      part(f,sphere,dark,[.008,.002,.003],[.002,.002,.002]);
    }
    for(let i=0;i<8;i++)parts.push(part(unit,sphere,glass,[0,0,0],[.002,.002,.002]));
  }else if(family==='chronovoid'){
    chamber=new T.Group();unit.add(chamber);
    part(chamber,sphere,dark,[0,0,0],[.040,.040,.040]);
    part(chamber,sphere,glow,[0,0,.034],[.019,.019,.011]);
    for(let i=0;i<3;i++)part(chamber,ring,i===1?dark:glow,[0,0,0],[.045,.045,.045]).rotation.set(.25+i*.70,i*.72,0);
  }else if(family==='kuronami'){
    chamber=new T.Group();unit.add(chamber);
    for(let i=0;i<4;i++){const m=part(chamber,disc,i%2?glass:glow,[0,0,0],[.032,.017,.032]);parts.push(m);}
    for(let i=0;i<3;i++){
      const points=Array.from({length:24},(_,k)=>new T.Vector3((k/23-.5)*.39,.017*Math.sin(k*.3+i),.018*Math.cos(k*.3+i)));
      const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.0025,5,false);paths.push(geo);parts.push(part(unit,geo,glow,[0,0,0],[1,1,1]));
    }
  }else{
    for(let i=0;i<3;i++){
      const pts=Array.from({length:10},(_,j)=>new T.Vector3((j/9-.5)*.15,.009*Math.sin(j*4+i),.008*Math.cos(j*2+i)));
      const geo=new T.TubeGeometry(new T.CatmullRomCurve3(pts),14,.0018,4,false);paths.push(geo);parts.push(part(unit,geo,glow,[0,0,0],[1,1,1]));
    }
  }
  const hand=new T.Vector3(),home=new T.Vector3();
  const update=(tag,t,now,palm)=>{
    const reload=tag==='reload',inspect=tag==='inspect';
    const u=T.MathUtils.smoothstep(t,.06,.25)*(1-T.MathUtils.smoothstep(t,.59,.81));
    if(family==='neptune'){
      fish.children.forEach((f,i)=>{const a=now*(.90+i*.18)+i*2;f.position.set(-.103+Math.sin(a)*.075,.002+Math.cos(a*1.8)*.013,(i%2?1:-1)*.044);f.rotation.y=Math.cos(a)>0?0:Math.PI;});
      parts.forEach((p,i)=>p.position.set(-.18+i*.022,((now*.035+i*.012)%.039)-.014,(i%2?1:-1)*.044));return;
    }
    if(chamber){
      home.set(0,0,0);if(palm && (reload || inspect && family==='chronovoid')){
        palm.getWorldPosition(hand);hand.y+=.095;hand.x+=.045;
        unit.worldToLocal(hand);home.lerp(hand,u);
      }
      chamber.position.copy(home);chamber.rotation.set(.35*Math.sin(now*2),now*(reload?5:2),now*.6);
      if(family==='kuronami'){
        chamber.visible=reload;parts.slice(0,4).forEach((m,i)=>{m.position.y=(i-1.5)*(.003+.018*u);});
        parts.slice(4).forEach((m,i)=>{m.visible=reload||inspect;m.rotation.x=now*5+i*2;m.position.set(-.10,.012,.026*Math.sin(now*4+i));});
      }
    }else{
      parts.forEach((m,i)=>{m.visible=(reload || inspect || tag==='fire') && (i===0 || Math.sin(now*39+i)>.1);
        m.position.set(-.09+i*.013,.027,.031*Math.cos(now*32+i));m.rotation.x=now*12+i;});
    }
  };
  update('idle',0,0);
  weapon.userData.collectionUpdate=update;
  return ()=>{delete weapon.userData.collectionUpdate;root.removeFromParent();for(const g of paths)g.dispose();for(const m of [glow,dark,glass,gold])m.dispose();};
}

