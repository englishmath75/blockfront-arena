import * as T from 'three';
const hoop=new T.TorusGeometry(1,.035,6,44);
const shard=new T.OctahedronGeometry(1);
const sphere=new T.SphereGeometry(1,16,10);
const pose=new T.Object3D();
const normal=new T.Vector3(),up=new T.Vector3(0,1,0);
export function dimensionalEffect(d,t,viewer){
  const mesh=d.mesh;
  const pack=d.type==='satchelBurst',mark=d.type==='riftMark',blink=d.type==='riftBurst';
  if(!pack && !mark && !blink && d.kind!=='gatecrash')return false;
  let fx=mesh.userData.rift;
  if(!fx){
    mesh.material.visible=false;mesh.scale.setScalar(1);
    const group=new T.Group();mesh.add(group);
    const mat=new T.MeshBasicMaterial({color:pack?0xff9d43:0x659aff,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
    const edge=new T.MeshBasicMaterial({color:pack?0xffec96:0xb5e6ff,transparent:true,depthWrite:false});
    const shell=new T.Mesh(sphere,mat);group.add(shell);
    const rings=[mat,edge].map(m=>{const ring=new T.Mesh(hoop,m);group.add(ring);return ring});
    const pieces=new T.InstancedMesh(shard,edge,pack?16:12);pieces.frustumCulled=false;group.add(pieces);
    fx=mesh.userData.rift={group,mat,edge,shell,rings,pieces};
    mesh.userData.disposeField=()=>{pieces.dispose();mat.dispose();edge.dispose()};
    if(pack && d.normal)group.quaternion.setFromUnitVectors(up,normal.fromArray(d.normal).normalize());
  }
  const age=Math.max(0,t-d.born),u=Math.min(1,age/Math.max(.001,d.end-d.born)),pulse=.5+.5*Math.sin(age*8);
  mesh.visible=pack||mark||blink||viewer.team===d.team||Math.hypot(viewer.x-d.x,viewer.y-d.y,viewer.z-d.z)<4;
  mesh.position.set(d.x,d.y+.025,d.z);
  if(!mesh.visible)return true;
  const radius=pack?.15+2.25*u:mark?.31:blink?.24+.48*Math.sin(Math.PI*u):.16+.025*pulse;
  const h=pack?.06:mark?.018:blink?.75:.20;
  fx.shell.position.y=h;fx.shell.scale.set(radius*.65,h,radius*.65);
  fx.mat.opacity=pack?.75*(1-u):mark?.32:blink?.68*Math.sin(Math.PI*u):.68;
  fx.edge.opacity=pack?1-u:blink?Math.sin(Math.PI*u):.65+.3*pulse;
  for(const [i,r] of fx.rings.entries()){
    r.position.y=mark?.01:h*(i+.2);r.scale.setScalar(radius*(i?.76:1));
    r.rotation.set(mark||pack?Math.PI/2:1.05+i,.14*Math.sin(age*3+i),age*(i?1.6:-1.5));
  }
  for(let i=0;i<fx.pieces.count;i++){
    const a=i*2.39996+(pack||mark?0:age*1.5),f=(i%4)/4;
    pose.position.set(radius*Math.cos(a),pack?Math.sin(u*Math.PI)*(.4+f):mark?.018:h*(.3+f),radius*Math.sin(a));
    pose.rotation.set(i+u*1.6,a,mark?.5:age);
    const s=pack?.07*(1-u):.026;pose.scale.set(s,mark?.011:s*(pack?2.7:2.1),s);
    pose.updateMatrix();fx.pieces.setMatrixAt(i,pose.matrix);
  }
  fx.pieces.instanceMatrix.needsUpdate=true;
  return true;
}
