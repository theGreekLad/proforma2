import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './textures';
import { getModel } from './houseModels';
import { CURB_OFFSET, ROW, placeModelOnLot } from './siteLayout';

export const LANDSCAPES = [
  {
    id: 'builder',
    name: 'Builder basic',
    blurb: 'Sod lawn, a single row of foundation shrubs and one young tree per lot.',
  },
  {
    id: 'lush',
    name: 'Brochure lush',
    blurb: 'Hydrangea, boxwood and loropetalum beds, flowering accent trees, street trees in the park strip.',
  },
  {
    id: 'xeric',
    name: 'High-desert xeriscape',
    blurb: 'Water-wise rock mulch, boulders, native grasses, sage, yucca and desert-adapted trees.',
  },
  {
    id: 'mature',
    name: 'Mature canopy (10+ yrs)',
    blurb: 'Grown-in shade trees lining the street, clipped hedges and full planting beds.',
  },
];

export const LANDSCAPE_IDS = LANDSCAPES.map((preset) => preset.id);

const PLANT_TYPES = ['shrub', 'bloom', 'grass', 'spiky', 'boulder', 'conifer', 'trunk', 'canopy'];

function jitterGeometry(source, amount, seed, smooth = false) {
  const rand = mulberry32(seed);
  const geometry = smooth ? mergeVertices(source.deleteAttribute('normal'), 1e-4) : source;
  const pos = geometry.getAttribute('position');
  const map = new Map();
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, 1 + (rand() - 0.5) * amount);
    const f = map.get(key);
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function mergeGeometries(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((sum, g) => sum + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let offset = 0;
  parts.forEach((g) => {
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    pos.set(g.getAttribute('position').array, offset * 3);
    nor.set(g.getAttribute('normal').array, offset * 3);
    if (g.getAttribute('uv')) uv.set(g.getAttribute('uv').array, offset * 2);
    offset += g.getAttribute('position').count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

let plantGeometries = null;

/** Unit-sized low-poly plant geometries (base at y = 0 unless noted). */
export function getPlantGeometries() {
  if (plantGeometries) return plantGeometries;
  const shrub = jitterGeometry(new THREE.IcosahedronGeometry(1, 1), 0.3, 11);
  shrub.scale(1, 0.85, 1);
  shrub.translate(0, 0.7, 0);

  const bloom = jitterGeometry(new THREE.IcosahedronGeometry(1, 0), 0.25, 5);

  const blades = [];
  for (let i = 0; i < 11; i += 1) {
    const blade = new THREE.ConeGeometry(0.06, 1, 3);
    blade.translate(0, 0.5, 0);
    blade.rotateZ(0.18 + (i % 3) * 0.12);
    blade.rotateY((i / 11) * Math.PI * 2);
    blades.push(blade);
  }
  const grass = mergeGeometries(blades);

  const spikes = [];
  for (let i = 0; i < 16; i += 1) {
    const spike = new THREE.ConeGeometry(0.05, 1, 3);
    spike.translate(0, 0.5, 0);
    spike.rotateZ(0.25 + (i % 4) * 0.2);
    spike.rotateY((i / 16) * Math.PI * 2 + (i % 2) * 0.2);
    spikes.push(spike);
  }
  const spiky = mergeGeometries(spikes);

  const boulder = jitterGeometry(new THREE.DodecahedronGeometry(1, 0), 0.45, 23);
  boulder.scale(1, 0.62, 0.85);

  const tiers = [0, 1, 2].map((i) => {
    const cone = new THREE.ConeGeometry(0.5 - i * 0.12, 0.5, 8);
    cone.translate(0, 0.25 + 0.08 + i * 0.27, 0);
    return cone;
  });
  const stem = new THREE.CylinderGeometry(0.05, 0.06, 0.1, 6);
  stem.translate(0, 0.05, 0);
  const conifer = mergeGeometries([...tiers, stem]);

  const trunk = new THREE.CylinderGeometry(0.7, 1, 1, 7);
  trunk.translate(0, 0.5, 0);

  const blobs = [];
  const rand = mulberry32(99);
  [[0, 0.05, 0, 0.7], [0.45, -0.1, 0.12, 0.5], [-0.45, -0.05, 0.15, 0.5], [0.1, -0.12, -0.48, 0.5],
    [-0.15, -0.15, 0.48, 0.48], [-0.1, 0.42, 0.05, 0.48], [0.3, 0.28, -0.25, 0.42], [-0.32, 0.25, -0.22, 0.42],
    [0.3, 0.2, 0.32, 0.4], [-0.3, -0.35, -0.2, 0.4]].forEach(([x, y, z, r], i) => {
    const blob = jitterGeometry(new THREE.IcosahedronGeometry(r, 2), 0.22, 40 + i, true);
    blob.translate(x + (rand() - 0.5) * 0.06, y, z);
    blobs.push(blob);
  });
  const canopy = mergeGeometries(blobs);

  plantGeometries = { shrub, bloom, grass, spiky, boulder, conifer, trunk, canopy };
  return plantGeometries;
}

const tmpColor = new THREE.Color();
function vary(hex, rand, amount = 0.06) {
  tmpColor.set(hex);
  tmpColor.offsetHSL((rand() - 0.5) * amount * 0.5, (rand() - 0.5) * amount, (rand() - 0.5) * amount);
  return tmpColor.getHex();
}

const C = {
  boxwood: '#2f5a26',
  shrub: '#3f6e2c',
  youngShrub: '#4f7d33',
  loropetalum: '#5e2433',
  hydrangeaLeaf: '#3d6b2c',
  hydrangeaBlue: '#7d95d6',
  hydrangeaWhite: '#eef0ea',
  flowers: ['#d9577f', '#b04aa8', '#f2f0f2', '#e9a03a', '#c8364a'],
  sage: '#8e9c7c',
  rabbitbrush: '#a7a65a',
  grassTan: '#b8a06a',
  grassGreen: '#7f8f4e',
  yucca: '#6f8a5c',
  boulder: '#9b8d7a',
  boulderDark: '#7c7369',
  canopy: ['#3d6b2a', '#47752f', '#365f27', '#527d34'],
  canopyLight: ['#7f9d4c', '#8fa65a'],
  ornamentalPink: '#e6a2bd',
  ornamentalWhite: '#e3e8d2',
  plum: '#6a3a44',
  conifer: '#2c4a2a',
  juniper: '#3e5a3b',
  bark: '#5a4636',
  barkLight: '#7a6a58',
};

class PlantSink {
  constructor() {
    this.items = Object.fromEntries(PLANT_TYPES.map((type) => [type, []]));
    this.streetTreeCandidates = [];
  }

  streetTree(x, z, params, rand) {
    this.streetTreeCandidates.push({ x, z, params, rand });
  }

  /** Place street trees that clear every driveway apron and keep their spacing. */
  flushStreetTrees(driveways) {
    const accepted = [];
    const boxes = driveways.map((poly) => {
      const xs = poly.map((p) => p[0]);
      const zs = poly.map((p) => p[1]);
      return { poly, minX: Math.min(...xs) - 6, maxX: Math.max(...xs) + 6, minZ: Math.min(...zs) - 6, maxZ: Math.max(...zs) + 6 };
    });
    const nearDrive = (x, z) => boxes.some((b) => {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
      for (let i = 0; i < b.poly.length; i += 1) {
        const a = b.poly[i];
        const c = b.poly[(i + 1) % b.poly.length];
        const dx = c[0] - a[0];
        const dz = c[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        if (Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz)) < 4.5) return true;
      }
      return pointInRing([x, z], b.poly);
    });
    this.streetTreeCandidates.forEach(({ x, z, params, rand }) => {
      if (nearDrive(x, z)) return;
      const minGap = params.spacing * 0.6;
      if (accepted.some((t) => Math.hypot(t[0] - x, t[1] - z) < minGap)) return;
      accepted.push([x, z]);
      this.tree(x, z, { ...params, rand });
    });
    this.streetTreeCandidates = [];
  }

  add(type, x, y, z, sx, sy, sz, color, rot = 0) {
    this.items[type].push({ x, y, z, sx, sy, sz, color, rot });
  }

  tree(x, z, { height, spread, canopy, rand, trunk = C.bark, multi = false, clear = null }) {
    const trunkH = clear != null ? clear / 0.75 : height * 0.3;
    const trunkR = 0.12 + height * 0.018;
    if (multi) {
      [-0.6, 0.6].forEach((o) => this.add('trunk', x + o * trunkR * 2, 0, z, trunkR * 0.7, trunkH * 1.1, trunkR * 0.7, vary(trunk, rand), rand() * 6));
    } else {
      this.add('trunk', x, 0, z, trunkR, trunkH, trunkR, vary(trunk, rand), rand() * 6);
    }
    const canopyH = height - trunkH * 0.75;
    this.add('canopy', x, trunkH * 0.75 + canopyH * 0.5, z, spread / 2, canopyH / 2, spread / 2, vary(canopy, rand, 0.08), rand() * 6);
  }

  conifer(x, z, height, width, color, rand) {
    this.add('conifer', x, 0, z, width, height, width, vary(color, rand), rand() * 6);
  }
}

/** Collects ground polygons (world XZ) per material. */
class SurfaceSink {
  constructor() {
    this.polys = { grass: [], gravel: [], parkGrass: [], parkGravel: [], concrete: [], driveway: [], mulch: [], rock: [] };
    this.curbs = [];
    this.fences = [];
  }
}

function pointInRing([px, pz], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

function rectWorld(pl, X0, X1, Z0, Z1) {
  return [pl.toWorld(X0, Z0), pl.toWorld(X1, Z0), pl.toWorld(X1, Z1), pl.toWorld(X0, Z1)];
}

function expandRing(ring, amount) {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.hypot(dx, dz) || 1;
    return [x + (dx / d) * amount, z + (dz / d) * amount];
  });
}

function clipBelow(ring, zCut) {
  const out = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const aIn = a[1] <= zCut;
    const bIn = b[1] <= zCut;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (zCut - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), zCut, true]);
    }
  }
  return out;
}

function mirrorX(model, x, mirror) {
  const X = x - model.width / 2;
  return mirror ? -X : X;
}

function bedPlants(sink, pl, X0, X1, Zwall, depth, preset, rand, model) {
  const length = Math.abs(X1 - X0);
  const lo = Math.min(X0, X1);
  const at = (X, Z) => pl.toWorld(X, Z);
  const back = Zwall + Math.min(1.4, depth * 0.4);
  const front = Zwall + depth - 0.9;

  if (preset === 'builder') {
    const count = Math.max(1, Math.floor(length / 3.5));
    for (let i = 0; i < count; i += 1) {
      const [x, z] = at(lo + (i + 0.5) * (length / count), Zwall + depth * 0.5);
      const s = 0.75 + rand() * 0.2;
      sink.add('shrub', x, 0, z, s, s * 0.9, s, vary(C.youngShrub, rand), rand() * 6);
    }
    return;
  }

  if (preset === 'lush') {
    const count = Math.max(1, Math.floor(length / 3.2));
    for (let i = 0; i < count; i += 1) {
      const X = lo + (i + 0.5) * (length / count);
      const [x, z] = at(X, back);
      const kind = i % 3;
      if (kind === 0) {
        const s = 1.1 + rand() * 0.2;
        sink.add('shrub', x, 0, z, s, s, s, vary(C.boxwood, rand), rand() * 6);
      } else if (kind === 1) {
        const s = 1.35 + rand() * 0.25;
        sink.add('shrub', x, 0, z, s, s * 1.05, s, vary(C.hydrangeaLeaf, rand), rand() * 6);
        const bloomColor = (model.id.length + Math.floor(pl.origin[0])) % 2 ? C.hydrangeaBlue : C.hydrangeaWhite;
        for (let b = 0; b < 6; b += 1) {
          const a = rand() * Math.PI * 2;
          const rr = s * (0.35 + rand() * 0.45);
          sink.add('bloom', x + Math.cos(a) * rr, s * 1.35 + rand() * 0.25, z + Math.sin(a) * rr, 0.36, 0.3, 0.36, vary(bloomColor, rand, 0.04));
        }
      } else {
        const s = 1.15 + rand() * 0.2;
        sink.add('shrub', x, 0, z, s, s * 1.1, s, vary(C.loropetalum, rand, 0.04), rand() * 6);
      }
    }
    const flowers = Math.floor(length * 2.2);
    for (let i = 0; i < flowers; i += 1) {
      const [x, z] = at(lo + rand() * length, front - rand() * 0.9);
      const color = C.flowers[(i + Math.floor(rand() * 2)) % C.flowers.length];
      const s = 0.28 + rand() * 0.18;
      sink.add('bloom', x, 0.35 + rand() * 0.25, z, s, s * 0.8, s, vary(color, rand, 0.05));
      if (i % 2 === 0) sink.add('shrub', x, 0, z, 0.38, 0.32, 0.38, vary(C.shrub, rand), rand() * 6);
    }
    return;
  }

  if (preset === 'xeric') {
    let X = lo + 1 + rand();
    while (X < lo + length - 1) {
      const [x, z] = at(X, Zwall + depth * (0.3 + rand() * 0.45));
      const pick = rand();
      if (pick < 0.3) {
        const s = 1 + rand() * 0.5;
        sink.add('shrub', x, 0, z, s, s * 0.8, s, vary(C.sage, rand, 0.05), rand() * 6);
      } else if (pick < 0.6) {
        const s = 1.6 + rand() * 0.8;
        sink.add('grass', x, 0, z, s * 0.9, s, s * 0.9, vary(rand() < 0.5 ? C.grassTan : C.grassGreen, rand), rand() * 6);
      } else if (pick < 0.75) {
        const s = 1.8 + rand() * 0.6;
        sink.add('spiky', x, 0, z, s, s, s, vary(C.yucca, rand), rand() * 6);
      } else if (pick < 0.88) {
        const s = 1 + rand() * 0.9;
        sink.add('boulder', x, 0.1, z, s * 1.3, s, s, vary(rand() < 0.5 ? C.boulder : C.boulderDark, rand), rand() * 6);
      } else {
        const s = 0.9 + rand() * 0.3;
        sink.add('shrub', x, 0, z, s, s * 0.7, s, vary(C.rabbitbrush, rand), rand() * 6);
      }
      X += 2.4 + rand() * 2.2;
    }
    return;
  }

  // mature
  const count = Math.max(1, Math.floor(length / 2.1));
  for (let i = 0; i < count; i += 1) {
    const [x, z] = at(lo + (i + 0.5) * (length / count), back + 0.3);
    sink.add('shrub', x, 0, z, 1.45, 1.6, 1.3, vary(C.boxwood, rand, 0.03), rand() * 6);
  }
  const fronts = Math.max(1, Math.floor(length / 3));
  for (let i = 0; i < fronts; i += 1) {
    const [x, z] = at(lo + (i + 0.5) * (length / fronts), front);
    const s = 0.9 + rand() * 0.3;
    sink.add('shrub', x, 0, z, s, s * 0.8, s, vary(i % 2 ? C.shrub : C.loropetalum, rand), rand() * 6);
    for (let b = 0; b < 3; b += 1) {
      sink.add('bloom', x + (rand() - 0.5) * 1.6, s * 1.2, z + (rand() - 0.5) * 1.2, 0.28, 0.24, 0.28, vary(C.flowers[(i + b) % C.flowers.length], rand, 0.04));
    }
  }
}

function addFence(surfaces, pl, lotLayout, model) {
  const { r, n } = lotLayout;
  const ringLocal = expandRing(lotLayout.hull, -0.6).map((p) => {
    const rel = [p[0] - pl.origin[0], p[1] - pl.origin[1]];
    return [rel[0] * r[0] + rel[1] * r[1], rel[0] * n[0] + rel[1] * n[1]];
  });
  const zCut = -pl.ext.dMin - 14;
  const clipped = clipBelow(ringLocal, zCut);
  if (clipped.length < 3) return;
  const segments = [];
  for (let i = 0; i < clipped.length; i += 1) {
    const a = clipped[i];
    const b = clipped[(i + 1) % clipped.length];
    if (a[2] && b[2]) {
      const left = Math.min(a[0], b[0]);
      const right = Math.max(a[0], b[0]);
      const halfW = model.width / 2;
      if (left < -halfW - 1) segments.push([[left, zCut], [-halfW, zCut]]);
      if (right > halfW + 1) segments.push([[halfW, zCut], [right, zCut]]);
    } else {
      segments.push([a, b]);
    }
  }
  segments.forEach(([a, b]) => surfaces.fences.push([pl.toWorld(a[0], a[1]), pl.toWorld(b[0], b[1])]));
}

function streetStrips(surfaces, sink, edge, gravelStrip, streetTrees, rand) {
  const { a, b, n } = edge;
  const off = (p, d) => [p[0] + n[0] * d, p[1] + n[1] * d];
  const t = [b[0] - a[0], b[1] - a[1]];
  const L = Math.hypot(t[0], t[1]);
  const tu = [t[0] / L, t[1] / L];
  const ext = (p, d) => [p[0] + tu[0] * d, p[1] + tu[1] * d];
  const a2 = ext(a, -2.2);
  const b2 = ext(b, 2.2);
  surfaces.polys.concrete.push([a2, b2, off(b2, ROW.sidewalk), off(a2, ROW.sidewalk)]);
  surfaces.polys[gravelStrip ? 'parkGravel' : 'parkGrass'].push([off(a2, ROW.sidewalk), off(b2, ROW.sidewalk), off(b2, CURB_OFFSET), off(a2, CURB_OFFSET)]);
  surfaces.curbs.push({ a: off(a2, CURB_OFFSET), b: off(b2, CURB_OFFSET), n, height: 0.5 });
  if (streetTrees) {
    const count = Math.max(1, Math.round(L / (streetTrees.spacing / 2)));
    for (let i = 0; i < count; i += 1) {
      const p = off(ext(a, (i + 0.5) * (L / count)), ROW.sidewalk + ROW.parkStrip / 2);
      sink.streetTree(p[0], p[1], streetTrees, rand);
    }
  }
}

const STREET_TREES = {
  builder: null,
  lush: { spacing: 55, height: 15, spread: 9, canopy: C.canopy[1] },
  xeric: { spacing: 60, height: 14, spread: 10, canopy: C.canopyLight[0], multi: true, trunk: C.barkLight },
  mature: { spacing: 38, height: 40, spread: 26, canopy: C.canopy[0], clear: 13 },
};

/**
 * Plants and ground surfaces for every assigned lot.
 * @param {object} layout from computeStreetLayout
 * @param {Map<string, object>} assignments lotId → { modelId, mirror, landscapeId }
 */
export function generateLandscape(layout, assignments, { fences = false } = {}) {
  const sink = new PlantSink();
  const surfaces = new SurfaceSink();

  layout.lots.forEach((lotLayout) => {
    const assignment = assignments.get(lotLayout.id);
    const preset = assignment?.landscapeId || 'builder';
    const rand = mulberry32((lotLayout.lotNumber || 1) * 977 + preset.length * 13);
    const gravelYard = preset === 'xeric';
    surfaces.polys[gravelYard ? 'gravel' : 'grass'].push(expandRing(lotLayout.hull, 2.5));

    if (!assignment) {
      lotLayout.streetEdges.forEach((edge) => streetStrips(surfaces, sink, edge, gravelYard, null, rand));
      return;
    }

    const model = getModel(assignment.modelId);
    const mirror = assignment.mirror;
    const pl = placeModelOnLot(lotLayout, model);
    const fz = pl.frontageZ;
    const bedDepth = { builder: 3, lush: 5, xeric: 5.5, mature: 6 }[preset];
    const bedMat = preset === 'xeric' ? 'rock' : 'mulch';

    // Driveways (one per garage door).
    const doors = model.garageDoors
      ? model.garageDoors.map((door) => ({ ...door, d: door.d ?? 0 }))
      : model.garageDoor ? [model.garageDoor] : [];
    const drives = doors.map((door) => {
      const gx = mirrorX(model, door.x, mirror);
      const half = door.width / 2 + 1;
      surfaces.polys.driveway.push(rectWorld(pl, gx - half, gx + half, -door.d - 0.2, fz + CURB_OFFSET + ROW.curb));
      return { gx, half };
    });

    // Front walk from the porch steps to the driveway.
    let walkFrontZ = -Infinity;
    const beds = model.plantingBeds || [];
    beds.forEach((bed) => {
      walkFrontZ = Math.max(walkFrontZ, -bed.d + bedDepth);
    });
    if (model.porch?.steps && drives.length) {
      const sx = mirrorX(model, model.porch.steps.x, mirror);
      const stepFront = -model.porch.d0 + 2;
      const turnZ = Math.max(stepFront, walkFrontZ + 0.6);
      surfaces.polys.concrete.push(rectWorld(pl, sx - 1.8, sx + 1.8, stepFront - 0.3, turnZ + 3.6));
      const drive = drives[0];
      const edgeX = sx < drive.gx ? drive.gx - drive.half : drive.gx + drive.half;
      surfaces.polys.concrete.push(rectWorld(pl, Math.min(sx, edgeX), Math.max(sx, edgeX), turnZ, turnZ + 3.6));
    }

    // Foundation beds.
    beds.forEach((bed) => {
      const X0 = mirrorX(model, bed.x0, mirror);
      const X1 = mirrorX(model, bed.x1, mirror);
      const Zwall = -bed.d;
      surfaces.polys[bedMat].push(rectWorld(pl, Math.min(X0, X1), Math.max(X0, X1), Zwall, Zwall + bedDepth));
      bedPlants(sink, pl, X0, X1, Zwall, bedDepth, preset, rand, model);
    });

    // Front-yard tree on the side away from the driveway.
    const gx = drives[0]?.gx ?? 0;
    const yardSide = gx > 0 ? -1 : 1;
    const yardX = yardSide < 0 ? pl.latLo * 0.55 : pl.latHi * 0.55;
    const yard = pl.toWorld(yardX, fz - 10);
    if (preset === 'builder') {
      sink.tree(yard[0], yard[1], { height: 11, spread: 6, canopy: C.canopy[3], rand });
    } else if (preset === 'lush') {
      sink.tree(yard[0], yard[1], { height: 15, spread: 11, canopy: (lotLayout.lotNumber % 2) ? C.ornamentalPink : C.plum, rand });
      const corner = pl.toWorld(mirror ? model.width / 2 - 0.5 : -model.width / 2 + 0.5, -pl.ext.dMin + 2);
      sink.conifer(corner[0], corner[1], 8, 2.4, C.juniper, rand);
    } else if (preset === 'xeric') {
      sink.tree(yard[0], yard[1], { height: 15, spread: 13, canopy: C.canopyLight[1], rand, multi: true, trunk: C.barkLight });
      const yardCount = 5 + Math.floor(rand() * 4);
      for (let i = 0; i < yardCount; i += 1) {
        const X = yardSide < 0 ? pl.latLo * (0.25 + rand() * 0.6) : pl.latHi * (0.25 + rand() * 0.6);
        const Z = fz - 4 - rand() * (fz + pl.ext.dMin - 12);
        const [x, z] = pl.toWorld(X, Z);
        const pick = rand();
        if (pick < 0.35) sink.add('boulder', x, 0.1, z, 1.6 + rand(), 1 + rand() * 0.6, 1.3, vary(C.boulder, rand), rand() * 6);
        else if (pick < 0.75) sink.add('grass', x, 0, z, 1.6, 1.8 + rand(), 1.6, vary(C.grassTan, rand), rand() * 6);
        else sink.add('shrub', x, 0, z, 1.2, 0.9, 1.2, vary(C.sage, rand), rand() * 6);
      }
    } else {
      sink.tree(yard[0], yard[1], { height: 34, spread: 26, canopy: C.canopy[2], rand, clear: 9 });
      const corner = pl.toWorld(mirror ? model.width / 2 + 3 : -model.width / 2 - 3, -pl.ext.dMin + 6);
      sink.tree(corner[0], corner[1], { height: 16, spread: 11, canopy: (lotLayout.lotNumber % 2) ? C.plum : C.canopyLight[0], rand });
    }

    // Right-of-way: sidewalk, park strip, curb (with street trees by preset).
    lotLayout.streetEdges.forEach((edge) => {
      if (!edge.primary) {
        streetStrips(surfaces, sink, edge, gravelYard, STREET_TREES[preset], rand);
        return;
      }
      const X0 = pl.frontLo - 2.2;
      const X1 = pl.frontHi + 2.2;
      surfaces.polys.concrete.push(rectWorld(pl, X0, X1, fz, fz + ROW.sidewalk));
      surfaces.polys[gravelYard ? 'parkGravel' : 'parkGrass'].push(rectWorld(pl, X0, X1, fz + ROW.sidewalk, fz + CURB_OFFSET));
      const curbZ = fz + CURB_OFFSET;
      const cuts = drives.map((d) => [d.gx - d.half, d.gx + d.half]).sort((a, b) => a[0] - b[0]);
      let start = X0;
      cuts.forEach(([c0, c1]) => {
        if (c0 > start) surfaces.curbs.push({ a: pl.toWorld(start, curbZ), b: pl.toWorld(c0, curbZ), n: lotLayout.n, height: 0.5 });
        surfaces.curbs.push({ a: pl.toWorld(Math.max(c0, X0), curbZ), b: pl.toWorld(Math.min(c1, X1), curbZ), n: lotLayout.n, height: 0.1 });
        start = Math.max(start, c1);
      });
      if (start < X1) surfaces.curbs.push({ a: pl.toWorld(start, curbZ), b: pl.toWorld(X1, curbZ), n: lotLayout.n, height: 0.5 });

      const trees = STREET_TREES[preset];
      if (trees) {
        // Dense candidates; the global pass keeps the ones clear of driveways at proper spacing.
        const span = X1 - X0;
        const count = Math.max(2, Math.round(span / 6));
        for (let i = 0; i < count; i += 1) {
          const X = X0 + (i + 0.5) * (span / count);
          const p = pl.toWorld(X, fz + ROW.sidewalk + ROW.parkStrip / 2);
          sink.streetTree(p[0], p[1], trees, rand);
        }
      }
    });

    if (fences && !model.conceptual) addFence(surfaces, pl, lotLayout, model);
  });

  sink.flushStreetTrees(surfaces.polys.driveway);
  return { plants: sink.items, surfaces };
}

/** Scattered windbreak trees beyond the development so the horizon isn't bare. */
export function generateBackdropTrees(layout) {
  const sink = new PlantSink();
  const rand = mulberry32(4242);
  const ring = layout.pavedHull;
  const [cx, cz] = layout.center;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.floor(L / 55);
    for (let k = 0; k < count; k += 1) {
      const f = (k + rand()) / count;
      const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const dx = p[0] - cx;
      const dz = p[1] - cz;
      const d = Math.hypot(dx, dz) || 1;
      const out = 120 + rand() * 900;
      const x = p[0] + (dx / d) * out;
      const z = p[1] + (dz / d) * out;
      if (rand() < 0.25) sink.conifer(x, z, 30 + rand() * 25, 12 + rand() * 6, C.conifer, rand);
      else sink.tree(x, z, { height: 28 + rand() * 22, spread: 22 + rand() * 16, canopy: C.canopy[Math.floor(rand() * 4)], rand });
    }
  }
  return sink.items;
}

/** Triangulated ground geometry (y-up) for a list of XZ polygons. */
export function polygonsToGeometry(polys, y = 0) {
  const pos = [];
  const uv = [];
  polys.forEach((poly) => {
    if (poly.length < 3) return;
    const contour = poly.map(([x, z]) => new THREE.Vector2(x, z));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    tris.forEach(([i0, i1, i2]) => {
      const p0 = poly[i0];
      let p1 = poly[i1];
      let p2 = poly[i2];
      const ny = (p2[0] - p0[0]) * (p1[1] - p0[1]) - (p1[0] - p0[0]) * (p2[1] - p0[1]);
      if (ny < 0) [p1, p2] = [p2, p1];
      [p0, p1, p2].forEach(([x, z]) => {
        pos.push(x, y, z);
        uv.push(x, -z);
      });
    });
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const normals = new Float32Array(pos.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Curb boxes: top face and street face for each curb run. */
export function curbsToGeometry(curbs) {
  const pos = [];
  const nor = [];
  const quad = (p, normal) => {
    [[0, 1, 2], [0, 2, 3]].forEach((tri) => tri.forEach((i) => {
      pos.push(...p[i]);
      nor.push(...normal);
    }));
  };
  curbs.forEach(({ a, b, n, height }) => {
    const w = ROW.curb;
    const a1 = [a[0] + n[0] * w, a[1] + n[1] * w];
    const b1 = [b[0] + n[0] * w, b[1] + n[1] * w];
    const top = [[a[0], height, a[1]], [b[0], height, b[1]], [b1[0], height, b1[1]], [a1[0], height, a1[1]]];
    const cross = (b[0] - a[0]) * (a1[1] - a[1]) - (b[1] - a[1]) * (a1[0] - a[0]);
    quad(cross < 0 ? top : [top[0], top[3], top[2], top[1]], [0, 1, 0]);
    const face = [[a1[0], 0, a1[1]], [b1[0], 0, b1[1]], [b1[0], height, b1[1]], [a1[0], height, a1[1]]];
    const fCross = (b1[0] - a1[0]) * n[1] - (b1[1] - a1[1]) * n[0];
    quad(fCross > 0 ? face : [face[1], face[0], face[3], face[2]], [n[0], 0, n[1]]);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** 6' white vinyl privacy fence panels with posts. */
export function fencesToGeometry(segments) {
  const pos = [];
  const nor = [];
  const pushQuad = (p, normal) => {
    [[0, 1, 2], [0, 2, 3]].forEach((tri) => tri.forEach((i) => {
      pos.push(...p[i]);
      nor.push(...normal);
    }));
  };
  segments.forEach(([a, b]) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const L = Math.hypot(dx, dz);
    if (L < 0.5) return;
    const n = [-dz / L, 0, dx / L];
    pushQuad([[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 6, b[1]], [a[0], 6, a[1]]], n);
    const posts = Math.max(1, Math.round(L / 8));
    for (let i = 0; i <= posts; i += 1) {
      const t = i / posts;
      const x = a[0] + dx * t;
      const z = a[1] + dz * t;
      const s = 0.25;
      pushQuad([[x - s, 6.3, z - s], [x + s, 6.3, z - s], [x + s, 6.3, z + s], [x - s, 6.3, z + s]], [0, 1, 0]);
      pushQuad([[x - s, 0, z + s], [x + s, 0, z + s], [x + s, 6.3, z + s], [x - s, 6.3, z + s]], [0, 0, 1]);
      pushQuad([[x + s, 0, z - s], [x - s, 0, z - s], [x - s, 6.3, z - s], [x + s, 6.3, z - s]], [0, 0, -1]);
      pushQuad([[x + s, 0, z + s], [x + s, 0, z - s], [x + s, 6.3, z - s], [x + s, 6.3, z + s]], [1, 0, 0]);
      pushQuad([[x - s, 0, z - s], [x - s, 0, z + s], [x - s, 6.3, z + s], [x - s, 6.3, z - s]], [-1, 0, 0]);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometry.computeBoundingSphere();
  return geometry;
}
