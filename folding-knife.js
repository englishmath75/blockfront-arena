import {Vector3,Float32BufferAttribute} from 'three';
import families from './melee-families.json' with {type:'json'};

// Fold the blade and free handle around the pin in the collection mesh.
// The other handle stays on the palm throughout the opening gesture.
export function butterflyHinge(skin,art,worldX,worldY,center){
  if(families[skin?.id]!=='butterfly')return;
  const mid=art.left+(art.right-art.left)*.52;
  const strips=art.columns[Math.round(mid)];
  if(!strips?.length)return;
  const y=(strips[0][0]+strips.at(-1)[1])*.5,hinge=new Vector3(worldX(mid),worldY(y),center.z);
  const sign=Math.sign(worldX(art.right)-worldX(art.left));
  const affected=[];
  return {
    shape(geo,transform){
      const inv=transform.clone().invert(),pos=geo.attributes.position,uv=geo.attributes.uv;
      const vertex=new Vector3(),morphs=[[],[]];
      for(let i=0;i<pos.count;i++){
        const x=uv.getX(i)*art.w,row=art.columns[Math.min(art.right-1,Math.max(art.left,Math.floor(x)))]??[];
        const centerY=row.length?(row[0][0]+row.at(-1)[1])*.5:y;
        const angle=x<mid ? 2.68 : uv.getY(i)*art.h>centerY?-.79:0;
        for(let j=0;j<2;j++){
          vertex.fromBufferAttribute(pos,i).applyMatrix4(inv).sub(hinge);
          const a=sign*angle*(j+1)*.5,c=Math.cos(a),s=Math.sin(a),px=vertex.x,py=vertex.y;
          vertex.set(c*px-s*py,s*px+c*py,vertex.z).add(hinge).applyMatrix4(transform);
          morphs[j].push(vertex.x,vertex.y,vertex.z);
        }
      }
      geo.morphAttributes.position=morphs.map(values=>new Float32BufferAttribute(values,3));
    },
    attach(mesh){affected.push(mesh)},
    pose(tag,t){
      const bend=tag==='equip' ? Math.max(0,1-t/.80)**1.25 :
        tag==='inspect' ? Math.sin(Math.PI*t)**2*(.5-.5*Math.cos(6*Math.PI*t)):0;
      const step=bend*2;
      for(const mesh of affected){
        mesh.morphTargetInfluences[0]=Math.max(0,1-Math.abs(1-step));
        mesh.morphTargetInfluences[1]=Math.max(0,step-1);
      }
    },
  };
}
