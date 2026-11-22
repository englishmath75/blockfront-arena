import * as T from 'three';
const crystal=new T.OctahedronGeometry(1), petal=new T.SphereGeometry(1,12,8), plate=new T.IcosahedronGeometry(1,0);
const decoded=new Map();let profiles,loading;
export function prepareVolumes(){return loading??=import('./finish-volumes.json',{with:{type:'json'}}).then(m=>profiles=m.default).catch(()=>{loading=null})}
const themes=[
  [/mystbloom|gaia|cherry|silvanus|dreamwing|valiant|evori/,'flower'],
  [/reaver|oni|nocturn|blackspyre|thorn|primord|chaos|ruin|doombringer|kuronami/,'spire'],
  [/ion|chronovoid|singular|origin|gravity|cosmic|solar|holomeridian/,'orbit'],
  [/rgx|protocol|exo|neofrontier|magepunk|prime|aemondir|overdrive|glitch|bolt|phaseguard/,'array'],
  [/cryostasis|imperium|forsaken|sovereign|champions|aeris|sentinels/,'crown'],
];
export function sculptedFinisher(scene,family,theme,point,born,sequence,tint,light){
  void prepareVolumes();
  const name=(theme??family)+' '+family,style=themes.find(([re])=>re.test(name))?.[1]??'spiral';
  const parent=new T.Group(),mat=new T.MeshStandardMaterial({color:tint,emissive:tint,emissiveIntensity:.6,roughness:.24,metalness:.42}),
    spark=new T.MeshBasicMaterial({color:tint,transparent:true,opacity:.72,depthWrite:false,blending:T.AdditiveBlending});
  const parts=new T.InstancedMesh(style==='flower'?petal:style==='array'?plate:crystal,mat,48),
    sparks=new T.InstancedMesh(crystal,spark,48),o=new T.Object3D();parts.frustumCulled=sparks.frustumCulled=false;
  parent.add(parts,sparks);parent.position.set(point.x,point.y,point.z);scene.add(parent);
  return {update(t){
    const age=Math.max(0,t-born),u=age/sequence.duration;
    if(u>=1){parent.removeFromParent();parts.dispose();sparks.dispose();mat.dispose();spark.dispose();light?.dispose();return false}
    if(!decoded.has(family) && profiles?.[family])decoded.set(family,Uint8Array.from(atob(profiles[family]),c=>c.charCodeAt(0)));
    const data=decoded.get(family),at=u*((data?.length??12)/12-1),index=Math.floor(at),f=at-index;
    const frame=light?.update(age),fade=Math.min(1,age*4,(sequence.duration-age)*3);
    if(frame){spark.color.copy(frame.color);mat.emissive.copy(frame.color)}
    for(let j=0;j<6;j++){
      const sample=k=>{if(!data)return .4;const i=index*12+2*j+k;return (data[i]+((data[i+12]??data[i])-data[i])*f)/255};
      const radius=.07+sample(0)*1.75,e=sample(1),h=.07+j*(.43+.20*(frame?.height??.5)),n=j*8;
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4+j*(style==='spire'?.13:.45)+age*(style==='orbit'?.9:style==='array'?.08:.27);
        const r=radius*(style==='crown'?.52+j*.15:1),v=fade*(.035+.25*e);
        o.position.set(Math.cos(a)*r,h+(style==='orbit'?.24*Math.sin(a):0),Math.sin(a)*r);
        o.rotation.set(style==='flower'?.85:style==='spire'?.17:.38,a,style==='array'?.55:Math.cos(a)*.38);
        o.scale.set(v*(style==='flower'?1.4:.75),v*(style==='spire'?3.7:style==='array'?1.3:2.1),v*.65);
        o.updateMatrix();parts.setMatrixAt(n+i,o.matrix);
        const drift=(age*.52+i*.22+j*.17)%1;
        o.position.multiplyScalar(1+drift*.6);o.position.y+=drift*.7;
        o.scale.setScalar((.015+.06*e)*fade*(1-drift));o.updateMatrix();sparks.setMatrixAt(n+i,o.matrix);
      }
    }
    parts.instanceMatrix.needsUpdate=sparks.instanceMatrix.needsUpdate=true;
    return true;
  }};
}
