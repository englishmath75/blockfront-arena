import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// XY follows the collection silhouette from muzzle to stock. Z is thickness.
// The bevels, sights, rails and core below are true solids visible from above.
export function buildVandalTrim(root, bone, skin, box, forward, aspect) {
  const family = skin.banner;
  if (
    !['rogue', 'singularityep9', 'champions2023', 'araxys', 'neptune', 'reaver'].includes(family) ||
    !skin.name.includes('밴달')
  )
    return;
  const length = box.max.x - box.min.x,
    height = length * aspect;
  const center = box.getCenter(new T.Vector3());
  const pivot = new T.Group();
  pivot.applyMatrix4(bone.matrixWorld.clone().invert().multiply(root.matrixWorld));
  bone.add(pivot);
  const x = (u) => (forward ? box.min.x + u * length : box.max.x - u * length);
  const y = (v) => center.y + (0.5 - v) * height;
  const colors = {
    rogue: ['#242a2c', '#555959', '#ed4533'],
    singularityep9: ['#1e182c', '#3f364c', '#d7a7ff'],
    champions2023: ['#29242b', '#c79839', '#ffe999'],
    araxys: ['#393433', '#9d8365', '#6fe3f1'],
    neptune: ['#253536', '#9a805a', '#62dfd7'],
    reaver: ['#272130', '#665975', '#bca2ff'],
  }[family];
  const variant = skin.variants?.find((v) => v.id === skin.variant)?.name ?? '';
  if (variant.includes('검은색')) {
    colors[0] = '#191b20';
    colors[1] = '#3f4653';
    if (family === 'araxys') colors[2] = '#ff514d';
  }
  if (variant.includes('흰색')) {
    colors[0] = '#767f88';
    colors[1] = '#acafad';
  }
  for (const [name, color] of [
    ['빨간색', '#ff6658'],
    ['보라색', '#bc8dff'],
    ['녹색', '#7ced99'],
    ['파란색', '#62b9ff'],
  ])
    if (variant.includes(name)) colors[2] = color;
  const batches = [[], [], []],
    materials = colors.map(
      (color, i) =>
        new T.MeshStandardMaterial({
          color,
          roughness: i === 1 ? 0.34 : 0.5,
          metalness: i === 2 ? 0.1 : 0.48,
          emissive: i === 2 ? color : 0,
          emissiveIntensity: i === 2 ? 0.95 : 0,
        }),
    );
  function shell(points, z, depth, material) {
    const shape = new T.Shape();
    points.forEach(([u, v], i) => {
      if (i) shape.lineTo(x(u), y(v));
      else shape.moveTo(x(u), y(v));
    });
    shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: length * depth,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelThickness: length * 0.0009,
      bevelSize: length * 0.0013,
    });
    geometry.clearGroups();
    geometry.translate(0, 0, center.z + z * length);
    batches[material].push(geometry);
  }
  function pair(points, width, depth, mat) {
    shell(points, width, depth, mat);
    shell(points, -width - depth, depth, mat);
  }
  if (family === 'rogue') {
    // Vent louvers, bevelled rail, charging handle, and the recessed indicators.
    for (let j = 0; j < 5; j++) {
      const a = 0.215 + j * 0.043;
      pair(
        [
          [a, 0.122],
          [a + 0.025, 0.122],
          [a + 0.009, 0.238],
          [a - 0.012, 0.218],
        ],
        0.027,
        0.007,
        1,
      );
    }
    for (let j = 0; j < 6; j++) {
      const u = 0.3 + j * 0.041;
      shell(
        [
          [u, 0.065],
          [u + 0.026, 0.065],
          [u + 0.023, 0.1],
          [u - 0.004, 0.1],
        ],
        -0.023,
        0.046,
        0,
      );
    }
    pair(
      [
        [0.49, 0.1],
        [0.64, 0.1],
        [0.69, 0.17],
        [0.53, 0.2],
      ],
      0.026,
      0.009,
      0,
    );
    pair(
      [
        [0.6, 0.14],
        [0.625, 0.14],
        [0.62, 0.16],
        [0.596, 0.16],
      ],
      0.036,
      0.002,
      2,
    );
    shell(
      [
        [0.173, 0.16],
        [0.173, 0.015],
        [0.193, 0.025],
        [0.198, 0.16],
      ],
      -0.008,
      0.016,
      0,
    );
    shell(
      [
        [0.176, 0.054],
        [0.186, 0.054],
        [0.186, 0.078],
        [0.176, 0.078],
      ],
      -0.01,
      0.02,
      2,
    );
  } else if (family === 'singularityep9' || family === 'araxys' || family === 'reaver') {
    const alien = family === 'araxys',
      ghost = family === 'reaver';
    for (let j = 0; j < 4; j++) {
      const u = 0.19 + j * 0.112,
        offset = (j % 2) * 0.018;
      pair(
        [
          [u, 0.165 + offset],
          [u + 0.066, 0.061],
          [u + 0.142, 0.12],
          [u + 0.078, 0.215],
          [u + 0.01, 0.255],
        ],
        0.02,
        0.01,
        alien ? 1 : 0,
      );
      pair(
        [
          [u + 0.02, 0.246],
          [u + 0.073, 0.181],
          [u + 0.125, 0.145],
          [u + 0.075, 0.214],
        ],
        0.031,
        0.0018,
        2,
      );
      shell(
        [
          [u + 0.018, 0.108],
          [u + 0.063, 0.033],
          [u + 0.121, 0.066],
          [u + 0.093, 0.134],
        ],
        -0.018,
        0.036,
        ghost ? 1 : 0,
      );
    }
    if (!alien) {
      pair(
        [
          [0.39, 0.24],
          [0.47, 0.145],
          [0.53, 0.19],
          [0.476, 0.3],
        ],
        0.032,
        0.003,
        1,
      );
      pair(
        [
          [0.422, 0.229],
          [0.474, 0.168],
          [0.505, 0.193],
          [0.472, 0.261],
        ],
        0.036,
        0.002,
        2,
      );
    }
  } else if (family === 'champions2023') {
    pair(
      [
        [0.16, 0.17],
        [0.39, 0.072],
        [0.61, 0.073],
        [0.55, 0.116],
        [0.31, 0.125],
      ],
      0.024,
      0.006,
      1,
    );
    pair(
      [
        [0.4, 0.27],
        [0.52, 0.135],
        [0.62, 0.095],
        [0.52, 0.205],
      ],
      0.033,
      0.005,
      1,
    );
    for (let j = 0; j < 3; j++) {
      const u = 0.45 + j * 0.025;
      pair(
        [
          [u, 0.241],
          [u + 0.032, 0.15],
          [u + 0.041, 0.15],
          [u + 0.01, 0.246],
        ],
        0.039,
        0.0015,
        2,
      );
    }
    shell(
      [
        [0.226, 0.101],
        [0.218, 0.02],
        [0.247, 0],
        [0.266, 0.104],
      ],
      -0.011,
      0.022,
      1,
    );
  } else {
    pair(
      [
        [0.32, 0.13],
        [0.54, 0.118],
        [0.56, 0.226],
        [0.31, 0.232],
      ],
      0.03,
      0.004,
      2,
    );
    for (const u of [0.3, 0.53])
      pair(
        [
          [u, 0.102],
          [u + 0.022, 0.104],
          [u + 0.029, 0.251],
          [u + 0.006, 0.251],
        ],
        0.034,
        0.005,
        1,
      );
    for (let i = 0; i < 3; i++) {
      const u = 0.35 + 0.061 * i,
        v = 0.184 - 0.022 * (i % 2);
      pair(
        [
          [u, v],
          [u + 0.014, v - 0.018],
          [u + 0.032, v],
          [u + 0.014, v + 0.014],
        ],
        0.035,
        0.0015,
        0,
      );
    }
  }
  const meshes = [];
  batches.forEach((geos, i) => {
    if (!geos.length) return;
    const combined = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new T.Mesh(combined, materials[i]);
    pivot.add(mesh);
    meshes.push(mesh);
  });
  if(family==='rogue' && skin.visualOn){
    root.userData.drawGlow=(tag,t)=>{
      const pulse=tag==='equip'?.62*Math.exp(-Math.pow((t-.52)/.12,2))+Math.exp(-Math.pow((t-.76)/.09,2)):0;
      materials[2].emissiveIntensity=.95+2.8*pulse;
    };
  }
  return () => {
    delete root.userData.drawGlow;
    pivot.removeFromParent();
    meshes.forEach((m) => m.geometry.dispose());
    materials.forEach((m) => m.dispose());
  };
}
