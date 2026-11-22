import fs from 'node:fs';
// Merge adjacent exposed faces with the same sampled colour. Keep the collision
// runs separate so windows, foliage and other art do not change player movement.
export function surfaceMesh(file, out) {
  const data = fs.readFileSync(file),
    half = data.readFloatLE(4),
    n = Math.round(half * 4),
    h = 132,
    dims = [n, h, n],
    vox = new Uint16Array(n * n * h),
    runs = new Uint16Array(data.buffer, data.byteOffset + 12, (data.length - 12) / 2),
    faces = [];
  const idx = (x, y, z) => (y * n + z) * n + x;
  for (let i = 0; i < runs.length; i += 7) {
    const x = runs[i],
      y = runs[i + 1],
      z = runs[i + 2],
      w = runs[i + 3],
      hh = runs[i + 4],
      d = runs[i + 5],
      v = runs[i + 6];
    for (let q = 0; q < hh; q++)
      for (let r = 0; r < d; r++) vox.fill(v, idx(x, y + q, z + r), idx(x + w, y + q, z + r));
  }
  for (let axis = 0; axis < 3; axis++) {
    const u = axis === 0 ? 2 : 0,
      v = axis === 1 ? 2 : 1,
      width = dims[u],
      height = dims[v],
      mask = new Uint16Array(width * height);
    const du = [1, n * n, n][u],
      dv = [1, n * n, n][v],
      da = [1, n * n, n][axis];
    for (let side = 0; side < 2; side++)
      for (let slab = 0; slab < dims[axis]; slab++) {
        const base = slab * da,
          neighbor = side ? da : -da,
          edge = slab + (side ? 1 : -1) < 0 || slab + (side ? 1 : -1) >= dims[axis];
        for (let b = 0; b < height; b++)
          for (let a = 0; a < width; a++) {
            const i = base + b * dv + a * du;
            mask[b * width + a] = vox[i] && (edge || !vox[i + neighbor]) ? vox[i] : 0;
          }
        for (let b = 0; b < height; b++)
          for (let a = 0; a < width; a++) {
            const o = b * width + a,
              tag = mask[o];
            if (!tag) continue;
            let w = 1,
              d = 1;
            while (a + w < width && mask[o + w] === tag) w++;
            rows: while (b + d < height) {
              for (let j = 0; j < w; j++) if (mask[o + d * width + j] !== tag) break rows;
              d++;
            }
            const xyz = [0, 0, 0];
            xyz[axis] = slab + side;
            xyz[u] = a;
            xyz[v] = b;
            faces.push(...xyz, w, d, axis * 2 + side, tag);
            for (let k = 0; k < d; k++) mask.fill(0, o + k * width, o + k * width + w);
          }
      }
  }
  const bytes = Buffer.alloc(12 + faces.length * 2);
  data.copy(bytes, 0, 0, 12);
  bytes.write('VXF1');
  for (let i = 0; i < faces.length; i++) bytes.writeUInt16LE(faces[i], 12 + i * 2);
  fs.writeFileSync(out, bytes);
}
