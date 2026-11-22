import * as T from 'three';
// Packed bounding volumes and triangle vertices share a centimetre coordinate system.
export function triangleTerrain(data, coarse) {
  const header = new Uint32Array(data, 0, 2),
    tree = new Int32Array(data, 8, header[0] * 8),
    vertices = new Int16Array(data, 8 + tree.byteLength, header[1] * 9),
    tri = new T.Triangle(),
    bounds = new T.Box3(),
    query = new T.Box3(),
    point = new T.Vector3(),
    normal = new T.Vector3(),
    hit = new T.Vector3(),
    ray = new T.Ray(),
    stack = [], slopePlane=new T.Plane();
  function load(i) {
    let j = i * 9;
    tri.a.set(vertices[j] / 100, vertices[j + 1] / 100, vertices[j + 2] / 100);
    tri.b.set(vertices[j + 3] / 100, vertices[j + 4] / 100, vertices[j + 5] / 100);
    tri.c.set(vertices[j + 6] / 100, vertices[j + 7] / 100, vertices[j + 8] / 100);
  }
  function walk(accept, visit) {
    stack.length = 0;
    stack.push(0);
    while (stack.length) {
      const at = stack.pop() * 8;
      bounds.min.set(tree[at] / 100, tree[at + 1] / 100, tree[at + 2] / 100);
      bounds.max.set(tree[at + 3] / 100, tree[at + 4] / 100, tree[at + 5] / 100);
      if (!accept(bounds)) continue;
      const first = tree[at + 6],
        n = tree[at + 7];
      if (n) {
        for (let i = first; i < first + n; i++) {
          load(i);
          if (visit(tri)) return true;
        }
      } else stack.push(first + 1, first);
    }
    return false;
  }
  function intersect(r, limit, result, ground = false) {
    let best = limit;
    walk(
      (b) =>
        b.containsPoint(r.origin) ||
        (r.intersectBox(b, point) && r.origin.distanceToSquared(point) <= best * best + 0.00001),
      () => {
        if (!r.intersectTriangle(tri.a, tri.b, tri.c, false, hit)) return false;
        const dist = hit.distanceTo(r.origin);
        if (dist > best + 0.000001) return false;
        tri.getNormal(normal);
        if (ground && Math.abs(normal.y) < 0.58) return false;
        best = dist;
        if (result) {
          if (normal.dot(r.direction) > 0) normal.negate();
          result.normal = normal.toArray();
          result.surfaceDistance = dist;
        }
        return false;
      },
    );
    return best;
  }
  function scanSupport(x,z,limit,r) {
    const start = Number.isFinite(limit) ? Math.min(300, limit + 0.009) : 300;
    let found = -Infinity;
    const offsets =
      r > 0.08
        ? [
            [0, 0],
            [-r * 0.67, 0],
            [r * 0.67, 0],
            [0, -r * 0.67],
            [0, r * 0.67],
          ]
        : [[0, 0]];
    for (const [dx, dz] of offsets) {
      ray.origin.set(x + dx, start, z + dz);
      ray.direction.set(0, -1, 0);
      const d = intersect(ray, 600, undefined, true);
      if (d < 600) found = Math.max(found, start - d);
    }
    return found;
  }
  function ceiling(x, z, feet, head, r = 0.22) {
    let first = Infinity;
    for (const [dx, dz] of [
      [0, 0],
      [-r, 0],
      [r, 0],
      [0, -r],
      [0, r],
    ]) {
      ray.origin.set(x + dx, feet - 0.005, z + dz);
      ray.direction.set(0, 1, 0);
      const len = head - feet + 0.012,
        t = intersect(ray, len);
      if (t < len) first = Math.min(first, ray.origin.y + t);
    }
    return first;
  }
  function scanBody(x,z,y,r,h) {
    query.min.set(x - r, y + 0.09, z - r);
    query.max.set(x + r, y + h - 0.012, z + r);
    return walk(
      (b) => b.intersectsBox(query),
      () => {
        if (!query.intersectsTriangle(tri)) return false;
        tri.getNormal(normal);
        if (
          Math.abs(normal.y) > 0.57 &&
          Math.max(tri.a.y, tri.b.y, tri.c.y) > y &&
          Math.min(tri.a.y, tri.b.y, tri.c.y) < y + 0.34
        ) {
          const onPlane = tri.getPlane(slopePlane);
          if (Math.abs(onPlane.distanceToPoint(point.set(x, y, z))) < r * 0.8 + 0.045) return false;
        }
        return true;
      },
    );
  }
  // Exact repeated capsule queries from stationary actors and input replay can
  // share results. Moving doors and constructed walls are tested separately.
  function cachedQuery(query){
    const entries=new Array(2048);
    return (x,z,y,r,h)=>{
      const slot=((Math.imul(Math.round(x*40),73856093)^Math.imul(Math.round(z*40),19349663)^Math.imul(Math.round(y*50),83492791)^Math.round(r*100)^Math.round((h||0)*100))>>>0)%entries.length;
      const entry=entries[slot];
      if(entry && entry.x===x && entry.z===z && entry.y===y && entry.r===r && entry.h===h)return entry.value;
      const value=query(x,z,y,r,h);entries[slot]={x,z,y,r,h,value};return value;
    };
  }
  const floorQuery=cachedQuery(scanSupport),bodyQuery=cachedQuery(scanBody);
  function support(x,z,limit=256,r=.015){return floorQuery(x,z,limit,r,0)}
  function blocked(x,z,y,r=.28,h=1.67){return bodyQuery(x,z,y,r,h)}
  function spawn(x, z, hint) {
    const base = coarse.spawn(x, z, hint);
    for (let radius of [0, 0.35, 0.7, 1.4, 2.1, 3.5])
      for (let i = 0; i < (radius ? 8 : 1); i++) {
        const px = base.x + Math.cos((i * Math.PI) / 4) * radius,
          pz = base.z + Math.sin((i * Math.PI) / 4) * radius,
          y = support(px, pz, base.y + 0.7);
        if (Number.isFinite(y) && Math.abs(y - base.y) < 1.05 && !blocked(px, pz, y, 0.27, 1.65))
          return { x: px, y, z: pz };
      }
    return base;
  }
  const landings = new Map([...coarse.landings].map(([name, p]) => [name, spawn(p.x, p.z, p.y)]));
  return { ...coarse, landings, spawn, support, ceiling, blocked, intersect };
}
