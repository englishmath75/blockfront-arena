import * as T from 'three';
const plane = new T.PlaneGeometry(1, 1);
export function drawBlocks(scene, data) {
  const header = new DataView(data),
    half = header.getFloat32(4, true),
    base = header.getFloat32(8, true),
    runs = new Uint16Array(data, 12);
  const groups = new Map();
  for (let i = 0; i < runs.length; i += 7) {
    const key = (runs[i] >> 5) * 4096 + (runs[i + 2] >> 5) * 16 + (runs[i + 1] >> 5);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  }
  const mat = new T.MeshLambertMaterial();
  // Keep small squares on large merged faces at the same scale as a single block.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 blockPoint;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nblockPoint=(instanceMatrix*vec4(transformed,1.)).xyz;',
      );
    shader.fragmentShader =
      'varying vec3 blockPoint;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nvec3 p=floor((blockPoint+0.0003)*12.);float grain=fract(sin(dot(p,vec3(12.9898,78.233,46.17)))*43758.5453);diffuseColor.rgb*=0.94+grain*0.12;',
      );
  };
  const obj = new T.Object3D(),
    color = new T.Color();
  for (const indices of groups.values()) {
    const mesh = new T.InstancedMesh(plane, mat, indices.length);
    for (let j = 0; j < indices.length; j++) {
      const i = indices[j],
        x = runs[i],
        y = runs[i + 1],
        z = runs[i + 2],
        u = runs[i + 3],
        v = runs[i + 4],
        dir = runs[i + 5],
        tag = runs[i + 6] - 1,
        axis = dir >> 1,
        plus = dir % 2;
      obj.position.set(x * 0.5 - half, y * 0.25 + base, z * 0.5 - half);
      if (axis === 0) {
        obj.position.z += u * 0.25;
        obj.position.y += v * 0.125;
        obj.scale.set(u * 0.5, v * 0.25, 1);
        obj.rotation.set(0, plus ? Math.PI / 2 : -Math.PI / 2, 0);
      }
      if (axis === 1) {
        obj.position.x += u * 0.25;
        obj.position.z += v * 0.25;
        obj.scale.set(u * 0.5, v * 0.5, 1);
        obj.rotation.set(plus ? -Math.PI / 2 : Math.PI / 2, 0, 0);
      }
      if (axis === 2) {
        obj.position.x += u * 0.25;
        obj.position.y += v * 0.125;
        obj.scale.set(u * 0.5, v * 0.25, 1);
        obj.rotation.set(0, plus ? 0 : Math.PI, 0);
      }
      obj.updateMatrix();
      mesh.setMatrixAt(j, obj.matrix);
      color.setRGB((tag >> 8) / 15, ((tag >> 4) & 15) / 15, (tag & 15) / 15, T.SRGBColorSpace);
      mesh.setColorAt(j, color);
    }
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
}
