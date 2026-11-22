// Prepare a compact instanced triangle scene and a single texture atlas per map.
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import * as T from 'three';
// Baked UV charts have black gutters. Extend their edge colour before mipmapping.
function padCharts(pixels, size) {
  const result = Buffer.from(pixels),
    filled = new Uint8Array(size * size),
    queue = new Uint32Array(size * size);
  let read = 0,
    end = 0;
  for (let i = 0; i < filled.length; i++) {
    const k = i * 4;
    if (Math.max(result[k], result[k + 1], result[k + 2]) > 20) {
      filled[i] = 1;
      queue[end++] = i;
    }
  }
  const visit = (from, to) => {
    if (filled[to]) return;
    filled[to] = 1;
    queue[end++] = to;
    result.copy(result, to * 4, from * 4, from * 4 + 3);
  };
  while (read < end) {
    const p = queue[read++],
      x = p % size;
    if (x) visit(p, p - 1);
    if (x < size - 1) visit(p, p + 1);
    if (p >= size) visit(p, p - size);
    if (p + size < filled.length) visit(p, p + size);
  }
  return result;
}
export async function packMap(file, transform, output, sharp, { atlasOnly = false } = {}) {
  const raw = fs.readFileSync(file),
    n = raw.readUInt32LE(12),
    g = JSON.parse(raw.subarray(20, 20 + n)),
    start = 28 + n;
  const view = (i) => {
    const v = g.bufferViews[i];
    return raw.subarray(start + (v.byteOffset ?? 0), start + (v.byteOffset ?? 0) + v.byteLength);
  };
  const def =
    g.materials.push({ name: 'Default', pbrMetallicRoughness: { baseColorFactor: [0.6, 0.6, 0.6, 1] } }) - 1;
  const tile = 128,
    cols = Math.ceil(Math.sqrt(g.materials.length)),
    size = cols * tile,
    atlas = Buffer.alloc(size * size * 4);
  const cache = new Map();
  async function texture(m) {
    const p = m.pbrMetallicRoughness ?? {},
      t = g.textures[p.baseColorTexture?.index],
      im = g.images[t?.extensions?.EXT_texture_webp?.source ?? t?.source];
    if (!im) return null;
    if (!cache.has(im.bufferView))
      cache.set(
        im.bufferView,
        sharp(view(im.bufferView))
          .resize(tile - 2, tile - 2, { fit: 'fill' })
          .ensureAlpha()
          .raw()
          .toBuffer(),
      );
    return cache.get(im.bufferView);
  }
  for (let i = 0; i < g.materials.length; i++) {
    const m = g.materials[i],
      image = await texture(m),
      t =
        image && /SourceBaked-|VideoCalibrated-/i.test(m.name) && !m.alphaMode
          ? padCharts(image, tile - 2)
          : image,
      factor = m.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1],
      rgb = factor.map((v) => Math.max(0, v) ** (1 / 2.2)),
      left = (i % cols) * tile,
      top = Math.floor(i / cols) * tile;
    for (let y = 0; y < tile; y++)
      for (let x = 0; x < tile; x++) {
        const o = ((top + y) * size + left + x) * 4,
          s =
            (Math.min(tile - 3, Math.max(0, y - 1)) * (tile - 2) + Math.min(tile - 3, Math.max(0, x - 1))) *
            4;
        for (let c = 0; c < 3; c++) atlas[o + c] = Math.min(255, (t ? t[s + c] : 255) * rgb[c]);
        atlas[o + 3] =
          m.alphaMode === 'BLEND' || m.alphaMode === 'MASK' ? (t ? t[s + 3] : 255) * factor[3] : 255;
      }
  }
  await sharp(atlas, { raw: { width: size, height: size, channels: 4 } })
    .webp({ quality: 86, alphaQuality: 95, effort: 3 })
    .toFile(output + '.webp');
  if (atlasOnly) return;
  const segments = [],
    accessors = [],
    ids = new Map();
  let len = 0;
  function keep(idx) {
    if (idx == null) return null;
    if (ids.has(idx)) return ids.get(idx);
    let a = g.accessors[idx],
      v = g.bufferViews[a.bufferView],
      src = view(a.bufferView),
      bytes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType],
      width = { VEC2: 2, VEC3: 3, VEC4: 4, SCALAR: 1 }[a.type],
      stride = v.byteStride ?? width * bytes,
      begin = a.byteOffset ?? 0,
      dst;
    if (stride === width * bytes) dst = src.subarray(begin, begin + a.count * stride);
    else {
      dst = Buffer.alloc(a.count * width * bytes);
      for (let k = 0; k < a.count; k++)
        src.copy(dst, k * width * bytes, begin + k * stride, begin + k * stride + width * bytes);
    }
    const pad = (4 - (len % 4)) % 4;
    if (pad) {
      segments.push(Buffer.alloc(pad));
      len += pad;
    }
    const id = accessors.length;
    accessors.push([len, a.count, width, a.componentType]);
    ids.set(idx, id);
    segments.push(dst);
    len += dst.length;
    return id;
  }
  const meshes = g.meshes.map((m) =>
    m.primitives
      .filter((p) => p.mode == null || p.mode === 4)
      .map((p) => {
        const mat = g.materials[p.material ?? def],
          uv = mat.pbrMetallicRoughness?.baseColorTexture?.texCoord ?? 0;
        return [
          keep(p.attributes.POSITION),
          keep(p.attributes.NORMAL),
          keep(p.attributes['TEXCOORD_' + uv]),
          keep(p.indices),
          p.material ?? def,
        ];
      }),
  );
  const moving = {},
    instances = [];
  function visit(id, parent) {
    const node = g.nodes[id],
      m = node.matrix
        ? new T.Matrix4().fromArray(node.matrix)
        : new T.Matrix4().compose(
            new T.Vector3(...(node.translation ?? [0, 0, 0])),
            new T.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
            new T.Vector3(...(node.scale ?? [1, 1, 1])),
          );
    m.premultiply(parent);
    if (node.mesh !== undefined) {
      const entry = [node.mesh, ...m.elements.map((n) => +n.toFixed(6))];
      if (node.name === 'FTDoor_0_B') moving.gate = entry;
      else instances.push(entry);
    }
    for (const c of node.children ?? []) visit(c, m);
  }
  for (const id of g.scenes[g.scene ?? 0].nodes) visit(id, transform);
  const meta = Buffer.from(JSON.stringify({ cols, tile, meshes, accessors, instances, moving })),
    pad = (4 - (meta.length % 4)) % 4,
    head = Buffer.alloc(4);
  head.writeUInt32LE(meta.length);
  fs.writeFileSync(
    output + '.scene.gz',
    gzipSync(Buffer.concat([head, meta, Buffer.alloc(pad), ...segments]), { level: 5 }),
  );
}
