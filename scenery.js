import { unpack } from './compressed.js';
import { sceneryVisibility } from './scenery-visibility.js';
import * as T from 'three';
export async function readScene(response) {
  const buf = await unpack(response);
  const length = new DataView(buf).getUint32(0, true);
  return {
    meta: JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, length))),
    buffer: buf,
    offset: 4 + Math.ceil(length / 4) * 4,
  };
}
// For software WebGL, bake the static transforms into spatial groups once.
// This removes per-vertex instance-texture lookups while retaining the atlas,
// the original geometry and independently animated map mechanisms.
function staticSectors(instances,pieces,material) {
  const sectors=new Map(),root=new T.Group(),matrix=new T.Matrix4(),normal=new T.Matrix3(),point=new T.Vector3();
  const levels=pieces.some(parts=>parts.some(part=>part.userData.lods))?3:1;
  for(const [mesh,...elements] of instances){
    matrix.fromArray(elements);
    for(const part of pieces[mesh]){
      if(!part.boundingSphere)part.computeBoundingSphere();
      point.copy(part.boundingSphere.center).applyMatrix4(matrix);
      const extent=part.boundingSphere.radius*matrix.getMaxScaleOnAxis();
      const key=[Math.floor(point.x/8),Math.floor(point.y/8),Math.floor(point.z/8),extent>8?1:0].join('/');
      let sector=sectors.get(key);
      if(!sector){sector={entries:[],vertices:0,counts:[0,0,0]};sectors.set(key,sector)}
      sector.entries.push({part,elements});
      sector.vertices+=part.attributes.position.count;
      for(let i=0;i<levels;i++)sector.counts[i]+=(part.userData.lods?.[i]??part.index).count;
    }
  }
  for(const {entries,vertices,counts} of sectors.values()){
    const xyz=new Float32Array(vertices*3),normals=new Int8Array(vertices*3);
    const uvs=new Float32Array(vertices*2),tiles=new Uint16Array(vertices);
    const offsets=[0,counts[0],counts[0]+counts[1]], cursors=offsets.slice();
    const indices=counts[0]+counts[1]+counts[2];
    const index=vertices<65536?new Uint16Array(indices):new Uint32Array(indices);
    let vo=0;
    for(const {part,elements} of entries){
      matrix.fromArray(elements);normal.getNormalMatrix(matrix);
      const mirrored=matrix.determinant()<0,attrs=part.attributes;
      for(let i=0;i<attrs.position.count;i++){
        const j=vo+i;
        point.fromBufferAttribute(attrs.position,i).applyMatrix4(matrix).toArray(xyz,j*3);
        point.fromBufferAttribute(attrs.normal,i).applyNormalMatrix(normal);
        normals[j*3]=Math.round(point.x*127);normals[j*3+1]=Math.round(point.y*127);normals[j*3+2]=Math.round(point.z*127);
        uvs[j*2]=attrs.uv.getX(i);uvs[j*2+1]=attrs.uv.getY(i);
        tiles[j]=attrs.tileIndex.getX(i);
      }
      for(let lod=0;lod<levels;lod++){
        const src=part.userData.lods?.[lod]??part.index;
        for(let i=0;i<src.count;i+=3){
          index[cursors[lod]++]=vo+src.getX(i);
          index[cursors[lod]++]=vo+src.getX(i+(mirrored?2:1));
          index[cursors[lod]++]=vo+src.getX(i+(mirrored?1:2));
        }
      }
      vo+=attrs.position.count;
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(xyz,3));
    g.setAttribute('normal',new T.BufferAttribute(normals,3,true));
    g.setAttribute('uv',new T.BufferAttribute(uvs,2));
    g.setAttribute('tileIndex',new T.BufferAttribute(tiles,1));
    g.setIndex(new T.BufferAttribute(index,1));g.setDrawRange(0,counts[0]);
    g.computeBoundingSphere();g.computeBoundingBox();
    const mesh=new T.Mesh(g,material);
    if(levels>1)mesh.onBeforeRender=(renderer,scene,camera)=>{
      const distance=g.boundingBox.distanceToPoint(camera.position);
      const level=distance<12?0:distance<27?1:2;
      g.setDrawRange(offsets[level],counts[level]);
    };
    root.add(mesh);
  }
  return root;
}
export function drawScenery(scene, source, texture, bakeStatic=false) {
  const { meta, buffer, offset } = source,
    { cols, tile } = meta,
    types = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
  const attr = (id) => {
    const [start, count, width, type] = meta.accessors[id];
    return new T.BufferAttribute(new types[type](buffer, offset + start, count * width), width);
  };
  texture.flipY = false;
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new T.MeshLambertMaterial({ map: texture, side: T.DoubleSide, alphaTest: 0.38 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float tileIndex; varying float atlasTile;\n' +
      shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\natlasTile = tileIndex;');
    shader.fragmentShader =
      'varying float atlasTile;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `vec2 cell=vec2(mod(atlasTile,${cols}.0),floor(atlasTile/${cols}.0)); vec2 local=fract(vMapUv); vec2 coord=(cell+(1.0+local*${tile - 2}.0)/${tile}.0)/${cols}.0; vec4 tex=textureGrad(map,coord,dFdx(vMapUv)/${cols}.0,dFdy(vMapUv)/${cols}.0); diffuseColor*=tex;`,
      );
  };
  let vertices = 0,
    indices = 0,
    instances = 0;
  const pieces = meta.meshes.map((parts) =>
    parts.map(([p, n, u, i, t,medium,far]) => {
      const g = new T.BufferGeometry(),
        pos = attr(p);
      g.setAttribute('position', pos);
      g.setAttribute('uv', u === null ? new T.BufferAttribute(new Float32Array(pos.count * 2), 2) : attr(u));
      if (i !== null) g.setIndex(attr(i));
      else g.setIndex(Array.from({ length: pos.count }, (_, a) => a));
      if(medium!=null && far!=null)g.userData.lods=[g.index,attr(medium),attr(far)];
      if (n !== null) g.setAttribute('normal', attr(n));
      else g.computeVertexNormals();
      g.setAttribute('tileIndex', new T.BufferAttribute(new Float32Array(pos.count).fill(t), 1));
      vertices += pos.count;
      indices += g.index.count;
      return g;
    }),
  );
  if (meta.moving?.gate) {
    const [id, ...matrix] = meta.moving.gate,
      template = new T.Group();
    for (const geometry of pieces[id]) {
      const m = new T.Mesh(geometry, material);
      m.applyMatrix4(new T.Matrix4().fromArray(matrix));
      template.add(m);
    }
    const bounds = new T.Box3().setFromObject(template),
      center = bounds.getCenter(new T.Vector3()),
      size = bounds.getSize(new T.Vector3());
    template.position.set(-center.x, -bounds.min.y, -center.z);
    scene.userData.gate = (width, height) => {
      const root = new T.Group();
      root.add(template.clone(true));
      root.scale.set(width / size.x, height / size.y, 1);
      return root;
    };
  }
  if(bakeStatic){
    const root=staticSectors(meta.instances,pieces,material);
    scene.add(root);
    if(meta.occluders?.length){
      const update=sceneryVisibility(root,meta.occluders);
      scene.onBeforeRender=(renderer,scene,camera)=>update(camera);
    }
    for(const parts of pieces)for(const g of parts)g.dispose();
    return root;
  }
  for (const [id] of meta.instances) instances += pieces[id].length;
  const batch = new T.BatchedMesh(instances, vertices, indices, material);
  batch.sortObjects = false;
  const ids = pieces.map((parts) =>
    parts.map((g) => {
      const id = batch.addGeometry(g);
      g.dispose();
      return id;
    }),
  );
  const mat = new T.Matrix4();
  const bounds=[];
  for (const [mesh, ...matrix] of meta.instances) {
    mat.fromArray(matrix);
    for (const id of ids[mesh]){
      const instance=batch.addInstance(id);
      batch.setMatrixAt(instance,mat);
      bounds[instance]=batch.getBoundingSphereAt(id,new T.Sphere()).applyMatrix4(mat);
    }
  }
  // Static map pieces never change their local transforms. Cull their saved
  // spheres directly instead of transforming every instance for every draw.
  const frustum=new T.Frustum(),clip=new T.Matrix4(),previousClip=new T.Matrix4();
  const visibility=new Uint8Array(instances).fill(1);
  const beforeRender=batch.onBeforeRender.bind(batch);
  batch.perObjectFrustumCulled=false;
  batch.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
    clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(batch.matrixWorld);
    if(!previousClip.equals(clip)){
      frustum.setFromProjectionMatrix(clip,camera.coordinateSystem,camera.reversedDepth);
      for(let i=0;i<bounds.length;i++){
        const visible=Number(frustum.intersectsSphere(bounds[i]));
        if(visibility[i]!==visible){visibility[i]=visible;batch.setVisibleAt(i,!!visible)}
      }
      previousClip.copy(clip);
    }
    beforeRender(renderer,scene,camera,geometry,material,group);
  };
  batch.computeBoundingSphere();
  scene.add(batch);
  return batch;
}
