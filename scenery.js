import { unpack } from './compressed.js';
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
export function drawScenery(scene, source, texture) {
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
    parts.map(([p, n, u, i, t]) => {
      const g = new T.BufferGeometry(),
        pos = attr(p);
      g.setAttribute('position', pos);
      g.setAttribute('uv', u === null ? new T.BufferAttribute(new Float32Array(pos.count * 2), 2) : attr(u));
      if (i !== null) g.setIndex(attr(i));
      else g.setIndex(Array.from({ length: pos.count }, (_, a) => a));
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
  for (const [mesh, ...matrix] of meta.instances) {
    mat.fromArray(matrix);
    for (const id of ids[mesh]) batch.setMatrixAt(batch.addInstance(id), mat);
  }
  batch.computeBoundingSphere();
  scene.add(batch);
  return batch;
}
