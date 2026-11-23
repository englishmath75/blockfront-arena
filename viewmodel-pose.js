import { BufferAttribute } from 'three';

// First-person meshes end at an open upper-arm cuff. Extend the cuff out of the
// view frustum, tapering the correction to zero before the elbow.
const prepared=new WeakSet();
export function sleeveEdges(rig){
  rig.traverse(o=>{
    if(!o.isSkinnedMesh)return;
    const geo=o.geometry;
    if(!geo.getAttribute('sleeveEdge')){
      const ix=geo.attributes.skinIndex,w=geo.attributes.skinWeight;
      const weights=o.skeleton.bones.map(b=>/^[LR]_(Clavicle|Shoulder)/i.test(b.name)?1:
        /^[LR]_Upper(_MechPanel|arm_Mid)/i.test(b.name)?.68:/^[LR]_Upperarm_Low/i.test(b.name)?.24:0);
      const edge=new Float32Array(ix.count);
      for(let i=0;i<ix.count;i++)for(let j=0;j<4;j++)edge[i]+=weights[ix.getComponent(i,j)]*w.getComponent(i,j);
      geo.setAttribute('sleeveEdge',new BufferAttribute(edge,1));
    }
    for(const m of [o.material].flat()){
      if(prepared.has(m))continue;prepared.add(m);
      const prev=m.onBeforeCompile.bind(m),key=m.customProgramCacheKey();
      m.customProgramCacheKey=()=>key+'-fp-cuff';
      m.onBeforeCompile=(s,r)=>{prev(s,r);s.vertexShader='attribute float sleeveEdge;\n'+s.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nfloat cuff=smoothstep(.08,.93,sleeveEdge);mvPosition.y-=.24*cuff;mvPosition.z+=.44*cuff;gl_Position=projectionMatrix*mvPosition;');};
    }
  });
}
