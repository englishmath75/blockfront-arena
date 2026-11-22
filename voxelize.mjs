// Convert a local glTF structural mesh into horizontal 0.5 m and vertical
// 0.25 m blocks. VXB1 stores the origin and packed runs, independent of Three.
import fs from 'node:fs';
import * as T from 'three';
import path from 'node:path';
export async function voxelize(file, metadata, map, out, decodeImage) {
  const raw = fs.readFileSync(file),
    jsonSize = raw.readUInt32LE(12),
    g = JSON.parse(raw.subarray(20, 20 + jsonSize)),
    bin = 28 + jsonSize;
  const get = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      ctor = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
    return new ctor(
      raw.buffer,
      raw.byteOffset + bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0),
      a.count * (a.type === 'VEC3' ? 3 : a.type === 'VEC2' ? 2 : a.type === 'VEC4' ? 4 : 1),
    );
  };
  const side = Math.ceil((map.cell * map.rows.length) / 0.5),
    half = side / 4,
    base = Math.floor(Math.min(...map.nodes.map((n) => n.y))) - 4,
    h = 132,
    vox = new Uint16Array(side * side * h);
  const mat = new T.Matrix4().makeRotationY(metadata.rotation),
    p = new T.Vector3();
  mat.setPosition(metadata.tx, metadata.ty, metadata.tz);
  const xShift = (metadata.xAdd - 0.5) * map.cell * 96,
    zShift = (metadata.zAdd - 0.5) * map.cell * 96;
  const materials = [],
    textures = new Map();
  if (decodeImage)
    for (const m of g.materials) {
      const pbr = m.pbrMetallicRoughness ?? {},
        tex = g.textures?.[pbr.baseColorTexture?.index];
      const image = g.images?.[tex?.extensions?.EXT_texture_webp?.source ?? tex?.source];
      if (image && !textures.has(image.bufferView)) {
        const v = g.bufferViews[image.bufferView];
        textures.set(
          image.bufferView,
          await decodeImage(
            raw.subarray(bin + (v.byteOffset ?? 0), bin + (v.byteOffset ?? 0) + v.byteLength),
          ),
        );
      }
      const factor = (pbr.baseColorFactor ?? [1, 1, 1, 1]).map((v, i) =>
        i < 3 ? Math.max(0, v) ** (1 / 2.2) : v,
      );
      materials.push({
        factor,
        color: textures.get(image?.bufferView),
        mask: m.alphaMode === 'MASK',
        blend: m.alphaMode === 'BLEND',
        uv: pbr.baseColorTexture?.texCoord ?? 0,
      });
    }
  function raster(a, b, c, kind, material, uvs, ids) {
    const u = b.map((p, i) => p - a[i]),
      v = c.map((p, i) => p - a[i]),
      n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const k =
      Math.abs(n[1]) > Math.abs(n[0])
        ? Math.abs(n[2]) > Math.abs(n[1])
          ? 2
          : 1
        : Math.abs(n[2]) > Math.abs(n[0])
          ? 2
          : 0;
    if (Math.abs(n[k]) < 0.001) return;
    const s = (k + 1) % 3,
      t = (k + 2) % 3,
      size = [side, h, side],
      pos = [0, 0, 0];
    const minI = Math.max(0, Math.floor(Math.min(a[s], b[s], c[s]))),
      maxI = Math.min(size[s] - 1, Math.floor(Math.max(a[s], b[s], c[s])));
    const minJ = Math.max(0, Math.floor(Math.min(a[t], b[t], c[t]))),
      maxJ = Math.min(size[t] - 1, Math.floor(Math.max(a[t], b[t], c[t])));
    for (let i = minI; i <= maxI; i++)
      for (let j = minJ; j <= maxJ; j++) {
        const di = i + 0.5 - a[s],
          dj = j + 0.5 - a[t],
          w1 = (di * v[t] - dj * v[s]) / n[k],
          w2 = (u[s] * dj - u[t] * di) / n[k];
        if (w1 < -0.002 || w2 < -0.002 || w1 + w2 > 1.002) continue;
        pos[s] = i;
        pos[t] = j;
        pos[k] = Math.floor(a[k] + u[k] * w1 + v[k] * w2 - 0.0001);
        if (pos[k] < 0 || pos[k] >= size[k]) continue;
        let tag = kind || (k === 1 ? 1 : 2);
        if (material) {
          const { factor, color, mask, blend } = material;
          let o = 0;
          if (uvs && color) {
            const u = uvs[ids[0] * 2] * (1 - w1 - w2) + uvs[ids[1] * 2] * w1 + uvs[ids[2] * 2] * w2;
            const v =
              uvs[ids[0] * 2 + 1] * (1 - w1 - w2) + uvs[ids[1] * 2 + 1] * w1 + uvs[ids[2] * 2 + 1] * w2;
            o = 4 * (Math.floor((v - Math.floor(v)) * 32) * 32 + Math.floor((u - Math.floor(u)) * 32));
          }
          if ((mask || blend) && (color ? color[o + 3] / 255 : 1) * factor[3] < 0.48) continue;
          const channel = (i) =>
            Math.min(15, Math.max(0, Math.round(((color ? color[o + i] : 210) * factor[i]) / 17)));
          tag = 1 + (channel(0) << 8) + (channel(1) << 4) + channel(2);
        }
        vox[(pos[1] * side + pos[2]) * side + pos[0]] = tag;
      }
  }
  function visit(id, parent) {
    const node = g.nodes[id],
      local = node.matrix
        ? new T.Matrix4().fromArray(node.matrix)
        : new T.Matrix4().compose(
            new T.Vector3(...(node.translation ?? [0, 0, 0])),
            new T.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
            new T.Vector3(...(node.scale ?? [1, 1, 1])),
          );
    const world = parent.clone().multiply(local);
    for (const pr of g.meshes[node.mesh]?.primitives ?? []) {
      const coords = get(pr.attributes.POSITION),
        indices = pr.indices != null ? get(pr.indices) : null,
        points = [];
      for (let i = 0; i < coords.length; i += 3) {
        p.fromArray(coords, i).applyMatrix4(world);
        points.push([(p.x + xShift + half) * 2, (p.y - base) * 4, (p.z + zShift + half) * 2]);
      }
      const kind = /roof|tile|awning/i.test(node.name)
        ? 3
        : /wood|timber|crate|plank/i.test(node.name)
          ? 4
          : /steel|metal|pipe|container|rail|vent/i.test(node.name)
            ? 5
            : /tree|leaf|moss|grass/i.test(node.name)
              ? 6
              : 0;
      const material = materials[pr.material],
        uvIndex = pr.attributes['TEXCOORD_' + (material?.uv ?? 0)],
        uvs = uvIndex != null ? get(uvIndex) : null;
      for (let i = 0; i < (indices?.length ?? points.length); i += 3) {
        const ids = indices ? indices.subarray(i, i + 3) : [i, i + 1, i + 2];
        raster(points[ids[0]], points[ids[1]], points[ids[2]], kind, material, uvs, ids);
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  }
  for (const id of g.scenes[g.scene ?? 0].nodes) visit(id, mat);
  const runs = [],
    at = (x, y, z) => (y * side + z) * side + x;
  for (let y = 0; y < h; y++)
    for (let z = 0; z < side; z++)
      for (let x = 0; x < side; x++) {
        const tag = vox[at(x, y, z)];
        if (!tag) continue;
        let w = 1,
          d = 1,
          dy = 1;
        while (x + w < side && vox[at(x + w, y, z)] === tag) w++;
        depth: while (z + d < side) {
          for (let a = 0; a < w; a++) if (vox[at(x + a, y, z + d)] !== tag) break depth;
          d++;
        }
        height: while (y + dy < h) {
          for (let j = 0; j < d; j++)
            for (let a = 0; a < w; a++) if (vox[at(x + a, y + dy, z + j)] !== tag) break height;
          dy++;
        }
        for (let j = 0; j < dy; j++)
          for (let k = 0; k < d; k++) vox.fill(0, at(x, y + j, z + k), at(x, y + j, z + k) + w);
        runs.push(x, y, z, w, dy, d, tag);
      }
  const result = Buffer.alloc(12 + runs.length * 2);
  result.write('VXB1');
  result.writeFloatLE(half, 4);
  result.writeFloatLE(base, 8);
  for (let i = 0; i < runs.length; i++) result.writeUInt16LE(runs[i], 12 + 2 * i);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, result);
  return runs.length / 7;
}
