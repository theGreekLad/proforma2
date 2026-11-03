import * as THREE from 'three';
import { getModel } from './houseModels';

/**
 * Builds merged BufferGeometries (one per material key) for a house model.
 * Model-local frame: X across the facade (centred on the model width),
 * Y up, +Z toward the street. Authoring depth d maps to Z = -d.
 */

export const FLOOR = 1.7; // finished floor above grade (modular on foundation)
export const SKIRT = 1.4; // brick skirting height shown on every elevation
export const EAVE = 9.9; // 8' walls + floor system
const HEAD = 6.8; // window/door head height above the floor
const PITCH = 5 / 12; // 5:12 roof pitch from the elevations
const OVERHANG = 1.0;
const RAKE = 0.8;
const ROOF_T = 0.45;

const UP = new THREE.Vector3(0, 1, 0);
const AX = new THREE.Vector3(1, 0, 0);
const AZ = new THREE.Vector3(0, 0, 1);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function autoUV(points, normal) {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ay >= ax && ay >= az) return points.map((p) => [p.x, p.z]);
  if (ax >= az) return points.map((p) => [p.z, p.y]);
  return points.map((p) => [p.x, p.y]);
}

class GeoBuilder {
  constructor() {
    this.buckets = new Map();
  }

  bucket(key) {
    let b = this.buckets.get(key);
    if (!b) {
      b = { pos: [], nor: [], uv: [] };
      this.buckets.set(key, b);
    }
    return b;
  }

  tri(key, p0, p1, p2, uv0, uv1, uv2, hint) {
    const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
    if (n.lengthSq() < 1e-12) return;
    n.normalize();
    let a = p1;
    let b = p2;
    let ua = uv1;
    let ub = uv2;
    if (hint && n.dot(hint) < 0) {
      a = p2;
      b = p1;
      ua = uv2;
      ub = uv1;
      n.negate();
    }
    const bucket = this.bucket(key);
    [[p0, uv0], [a, ua], [b, ub]].forEach(([p, uv]) => {
      bucket.pos.push(p.x, p.y, p.z);
      bucket.nor.push(n.x, n.y, n.z);
      bucket.uv.push(uv[0], uv[1]);
    });
  }

  quad(key, p0, p1, p2, p3, uvs, hint) {
    let coords = uvs;
    if (!coords) {
      const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0)).normalize();
      coords = autoUV([p0, p1, p2, p3], n);
    }
    this.tri(key, p0, p1, p2, coords[0], coords[1], coords[2], hint);
    this.tri(key, p0, p2, p3, coords[0], coords[2], coords[3], hint);
  }

  /** Box spanning origin + ax*[0,sx] + ay*[0,sy] + az*[0,sz] (ax × ay = az). */
  orientedBox(key, origin, ax, ay, az, sx, sy, sz, { unitFront = false, skipBottom = true } = {}) {
    const c = (i, j, k) => origin.clone()
      .addScaledVector(ax, i * sx)
      .addScaledVector(ay, j * sy)
      .addScaledVector(az, k * sz);
    const faces = [
      { pts: [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)], n: az, front: true },
      { pts: [c(1, 0, 0), c(0, 0, 0), c(0, 1, 0), c(1, 1, 0)], n: az.clone().negate() },
      { pts: [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)], n: ax },
      { pts: [c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0)], n: ax.clone().negate() },
      { pts: [c(0, 1, 0), c(0, 1, 1), c(1, 1, 1), c(1, 1, 0)], n: ay },
      { pts: [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)], n: ay.clone().negate(), bottom: true },
    ];
    faces.forEach((face) => {
      if (face.bottom && skipBottom) return;
      const uvs = face.front && unitFront ? [[0, 0], [1, 0], [1, 1], [0, 1]] : null;
      this.quad(key, ...face.pts, uvs, face.n);
    });
  }

  aabb(key, x0, x1, y0, y1, z0, z1, opts) {
    this.orientedBox(key, v3(x0, y0, z0), AX, UP, AZ, x1 - x0, y1 - y0, z1 - z0, opts);
  }

  /** Box in a wall's face frame: u along the wall, v up, w out of the wall. */
  faceBox(key, face, u0, u1, v0, v1, w0, w1, opts) {
    const origin = face.o.clone()
      .addScaledVector(face.r, u0)
      .addScaledVector(UP, v0)
      .addScaledVector(face.n, w0);
    this.orientedBox(key, origin, face.r, UP, face.n, u1 - u0, v1 - v0, w1 - w0, opts);
  }

  toGeometries(mirror) {
    const out = new Map();
    this.buckets.forEach((bucket, key) => {
      const pos = bucket.pos.slice();
      const nor = bucket.nor.slice();
      const uv = bucket.uv.slice();
      if (mirror) {
        for (let i = 0; i < pos.length; i += 3) {
          pos[i] = -pos[i];
          nor[i] = -nor[i];
        }
        for (let t = 0; t < pos.length / 9; t += 1) {
          const a = t * 9 + 3;
          const b = t * 9 + 6;
          for (let k = 0; k < 3; k += 1) {
            [pos[a + k], pos[b + k]] = [pos[b + k], pos[a + k]];
            [nor[a + k], nor[b + k]] = [nor[b + k], nor[a + k]];
          }
          const ua = t * 6 + 2;
          const ub = t * 6 + 4;
          for (let k = 0; k < 2; k += 1) {
            [uv[ua + k], uv[ub + k]] = [uv[ub + k], uv[ua + k]];
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.computeBoundingSphere();
      out.set(key, geometry);
    });
    return out;
  }
}

function gableKey(finish) {
  if (finish === 'shake') return 'shake';
  if (finish === 'bnb') return 'bnb';
  return 'siding';
}

/**
 * Gable roof over [A0,A1] × [B0,B1]; the ridge runs along B.
 * axis 'z' → A is X, B is Z (front-facing gable). axis 'x' → A is Z, B is X.
 */
function gableRoof(g, { A0, A1, B0, B1, axis, eave, gable, gableBack, gableAtB0, gableAtB1 }) {
  const map = axis === 'z' ? (a, y, b) => v3(a, y, b) : (a, y, b) => v3(b, y, a);
  const dirA = (s) => map(s, 0, 0);
  const dirB = (s) => map(0, 0, s);
  const s = (A1 - A0) / 2;
  const ac = (A0 + A1) / 2;
  const top = eave + s * PITCH;
  const eaveY = eave - OVERHANG * PITCH;
  const run = s + OVERHANG;
  const L = Math.hypot(run, run * PITCH);
  const bLo = B0 - (gableAtB0 ? RAKE : 0);
  const bHi = B1 + (gableAtB1 ? RAKE : 0);
  const keyFor = (sign) => gableKey(sign > 0 ? gable : (gableBack ?? gable));

  [[A0 - OVERHANG, -1], [A1 + OVERHANG, 1]].forEach(([aEdge, side]) => {
    const p0 = map(aEdge, eaveY, bLo);
    const p1 = map(aEdge, eaveY, bHi);
    const p2 = map(ac, top, bHi);
    const p3 = map(ac, top, bLo);
    g.quad('roof', p0, p1, p2, p3, [[bLo, 0], [bHi, 0], [bHi, L], [bLo, L]], UP);
    const lower = (p) => p.clone().setY(p.y - ROOF_T);
    g.quad('trim', lower(p0), lower(p1), lower(p2), lower(p3), null, UP.clone().negate());
    // Fascia board along the eave.
    g.quad(
      'trim',
      map(aEdge, eaveY - ROOF_T - 0.35, bLo),
      map(aEdge, eaveY - ROOF_T - 0.35, bHi),
      map(aEdge, eaveY + 0.04, bHi),
      map(aEdge, eaveY + 0.04, bLo),
      null,
      dirA(side),
    );
    // Rake boards on gable ends.
    [[gableAtB1, bHi, 1], [gableAtB0, bLo, -1]].forEach(([has, b, sign]) => {
      if (!has) return;
      g.quad(
        'trim',
        map(aEdge, eaveY - ROOF_T - 0.35, b),
        map(ac, top - ROOF_T - 0.35, b),
        map(ac, top + 0.05, b),
        map(aEdge, eaveY + 0.05, b),
        null,
        dirB(sign),
      );
    });
  });

  // Ridge cap.
  g.quad('roof', map(ac - 0.45, top - 0.1, bLo), map(ac - 0.45, top - 0.1, bHi), map(ac, top + 0.12, bHi), map(ac, top + 0.12, bLo), null, UP);
  g.quad('roof', map(ac + 0.45, top - 0.1, bLo), map(ac + 0.45, top - 0.1, bHi), map(ac, top + 0.12, bHi), map(ac, top + 0.12, bLo), null, UP);

  [[gableAtB1, B1, 1], [gableAtB0, B0, -1]].forEach(([has, b, sign]) => {
    if (!has) return;
    const off = sign * 0.02;
    const key = keyFor(sign);
    g.tri(key, map(A0, eave, b + off), map(A1, eave, b + off), map(ac, top, b + off), [0, 0], [0, 0], [0, 0], dirB(sign));
    // Re-UV the gable triangle in world feet.
    const bucket = g.bucket(key);
    const n = bucket.uv.length;
    const pts = bucket.pos.slice(bucket.pos.length - 9);
    const normal = dirB(sign);
    const uvs = autoUV([v3(pts[0], pts[1], pts[2]), v3(pts[3], pts[4], pts[5]), v3(pts[6], pts[7], pts[8])], normal);
    bucket.uv.splice(n - 6, 6, ...uvs.flat());
    if (key !== 'siding') {
      // Frieze board where the accent gable meets the wall line.
      const n = dirB(sign);
      const r = UP.clone().cross(n);
      const e0 = map(A0 - 0.1, eave - 0.75, b);
      const e1 = map(A1 + 0.1, eave - 0.75, b);
      const origin = e0.dot(r) < e1.dot(r) ? e0 : e1;
      g.orientedBox('trim', origin, r, UP, n, A1 - A0 + 0.2, 0.8, 0.25);
    }
  });
}

function frontFace(model, d) {
  return { o: v3(-model.width / 2, 0, -d), r: AX.clone(), n: AZ.clone() };
}

/** Face frame (u along the wall as seen from outside) for an opening spec. */
function openingFrame(model, item) {
  const W = model.width;
  switch (item.face) {
    case 'left':
      return { face: { o: v3(item.at - W / 2, 0, 0), r: AZ.clone(), n: AX.clone().negate() }, u: -item.pos };
    case 'right':
      return { face: { o: v3(item.at - W / 2, 0, 0), r: v3(0, 0, -1), n: AX.clone() }, u: item.pos };
    case 'rear':
      return { face: { o: v3(0, 0, -item.at), r: AX.clone().negate(), n: AZ.clone().negate() }, u: W / 2 - item.pos };
    default:
      return { face: frontFace(model, item.at ?? 0), u: item.pos };
  }
}

function buildWindow(g, face, u, sill, w, h, { shutterLeft = false, shutterRight = false, grid = true } = {}) {
  const l = u - w / 2;
  const r = u + w / 2;
  const top = sill + h;
  g.faceBox('glass', face, l, r, sill, top, 0, 0.06);
  g.faceBox('trim', face, l - 0.35, l, sill - 0.12, top + 0.05, 0, 0.18);
  g.faceBox('trim', face, r, r + 0.35, sill - 0.12, top + 0.05, 0, 0.18);
  g.faceBox('trim', face, l - 0.45, r + 0.45, top, top + 0.42, 0, 0.22);
  g.faceBox('trim', face, l - 0.5, r + 0.5, sill - 0.3, sill, 0, 0.3);
  const mid = sill + h / 2;
  g.faceBox('trim', face, l, l + 0.14, sill, top, 0, 0.1);
  g.faceBox('trim', face, r - 0.14, r, sill, top, 0, 0.1);
  g.faceBox('trim', face, l, r, top - 0.14, top, 0, 0.1);
  g.faceBox('trim', face, l, r, sill, sill + 0.14, 0, 0.1);
  if (grid) {
    // Single-hung sash, 3-over-1 (2-over-1 on small units) as drawn on the elevations.
    g.faceBox('trim', face, l, r, mid - 0.08, mid + 0.08, 0, 0.12);
    const lites = w < 2.4 ? [u] : [u - w / 6, u + w / 6];
    lites.forEach((mu) => g.faceBox('trim', face, mu - 0.04, mu + 0.04, mid, top, 0, 0.09));
  }
  const sw = Math.min(1.5, w * 0.5);
  if (shutterLeft) g.faceBox('shutter', face, l - 0.38 - sw, l - 0.38, sill - 0.1, top + 0.1, 0, 0.14);
  if (shutterRight) g.faceBox('shutter', face, r + 0.38, r + 0.38 + sw, sill - 0.1, top + 0.1, 0, 0.14);
}

function buildDoor(g, face, u, base, w = 3, h = HEAD, style = 'craftsman') {
  g.faceBox(style === 'nineLite' ? 'doorRear' : 'door', face, u - w / 2, u + w / 2, base, base + h, 0.02, 0.14, { unitFront: true });
  g.faceBox('trim', face, u - w / 2 - 0.4, u - w / 2, base, base + h + 0.05, 0, 0.2);
  g.faceBox('trim', face, u + w / 2, u + w / 2 + 0.4, base, base + h + 0.05, 0, 0.2);
  g.faceBox('trim', face, u - w / 2 - 0.5, u + w / 2 + 0.5, base + h, base + h + 0.5, 0, 0.24);
}

/** 6'-0" sliding patio door: two glass panels in a white frame. */
function buildSlider(g, face, u, base, w = 6, h = HEAD) {
  const l = u - w / 2;
  const r = u + w / 2;
  g.faceBox('glass', face, l, r, base, base + h, 0, 0.06);
  g.faceBox('trim', face, l - 0.35, l + 0.2, base, base + h + 0.05, 0, 0.2);
  g.faceBox('trim', face, r - 0.2, r + 0.35, base, base + h + 0.05, 0, 0.2);
  g.faceBox('trim', face, l - 0.45, r + 0.45, base + h, base + h + 0.45, 0, 0.22);
  g.faceBox('trim', face, l, r, base, base + 0.25, 0, 0.14);
  g.faceBox('trim', face, u - 0.12, u + 0.12, base, base + h, 0, 0.16);
  g.faceBox('lamp', face, u - 0.5, u - 0.35, base + 3, base + 3.6, 0.1, 0.22);
}

/** Raised patio / stoop at floor height: brick sides with a concrete cap. */
function buildDeck(g, model, deck) {
  const W = model.width;
  const X0 = deck.x0 - W / 2;
  const X1 = deck.x1 - W / 2;
  const Z0 = -deck.d1;
  const Z1 = -deck.d0;
  const h = deck.height ?? FLOOR - 0.15;
  g.aabb('skirt', X0, X1, 0, h - 0.18, Z0, Z1);
  g.aabb('concrete', X0 - 0.12, X1 + 0.12, h - 0.18, h, Z0 - 0.12, Z1 + 0.12);
}

/** Shed (lean-to) porch roof sloping down toward the street. */
function shedRoof(g, model, shed) {
  const W = model.width;
  const X0 = shed.x0 - W / 2 - 0.4;
  const X1 = shed.x1 - W / 2 + OVERHANG;
  const zLow = -shed.dLow + 0.8;
  const zHigh = -shed.dHigh;
  const slope = shed.rise / (zLow - 0.8 - zHigh);
  const yLow = EAVE - 0.8 * slope;
  const yHigh = EAVE + shed.rise;
  const p0 = v3(X0, yLow, zLow);
  const p1 = v3(X1, yLow, zLow);
  const p2 = v3(X1, yHigh, zHigh);
  const p3 = v3(X0, yHigh, zHigh);
  const L = Math.hypot(zLow - zHigh, yHigh - yLow);
  g.quad('roof', p0, p1, p2, p3, [[X0, 0], [X1, 0], [X1, L], [X0, L]], UP);
  const lower = (p) => p.clone().setY(p.y - ROOF_T);
  g.quad('trim', lower(p0), lower(p1), lower(p2), lower(p3), null, UP.clone().negate());
  g.quad('trim', v3(X0, yLow - ROOF_T - 0.35, zLow), v3(X1, yLow - ROOF_T - 0.35, zLow), v3(X1, yLow + 0.04, zLow), v3(X0, yLow + 0.04, zLow), null, AZ);
  g.quad('trim', v3(X1, yLow - ROOF_T - 0.35, zLow), v3(X1, yHigh - ROOF_T - 0.35, zHigh), v3(X1, yHigh + 0.04, zHigh), v3(X1, yLow + 0.04, zLow), null, AX);
}

function buildLamp(g, face, u, v) {
  g.faceBox('lamp', face, u - 0.18, u + 0.18, v - 0.6, v + 0.45, 0.04, 0.16);
  g.faceBox('lampGlass', face, u - 0.24, u + 0.24, v - 0.45, v + 0.28, 0.16, 0.62);
  g.faceBox('lamp', face, u - 0.32, u + 0.32, v + 0.28, v + 0.42, 0.12, 0.7);
}

function buildGarageDoor(g, face, x, width, height) {
  g.faceBox('garageDoor', face, x - width / 2, x + width / 2, 0.05, height, 0.02, 0.12, { unitFront: true });
  g.faceBox('trim', face, x - width / 2 - 0.45, x - width / 2, 0, height + 0.45, 0, 0.24);
  g.faceBox('trim', face, x + width / 2, x + width / 2 + 0.45, 0, height + 0.45, 0, 0.24);
  g.faceBox('trim', face, x - width / 2 - 0.45, x + width / 2 + 0.45, height, height + 0.55, 0, 0.26);
}

function buildMass(g, model, mass) {
  const W = model.width;
  const X0 = mass.x0 - W / 2;
  const X1 = mass.x1 - W / 2;
  const Zf = -mass.d0;
  const Zb = -mass.d1;
  const eave = mass.eave ?? EAVE;
  const base = SKIRT;
  const floor = mass.kind === 'house' ? FLOOR : 0;

  const walls = [
    { pts: [v3(X0, 0, Zf), v3(X1, 0, Zf), v3(X1, 1, Zf), v3(X0, 1, Zf)], n: AZ, out: v3(0, 0, 0.05) },
    { pts: [v3(X1, 0, Zb), v3(X0, 0, Zb), v3(X0, 1, Zb), v3(X1, 1, Zb)], n: AZ.clone().negate(), out: v3(0, 0, -0.05) },
    { pts: [v3(X0, 0, Zb), v3(X0, 0, Zf), v3(X0, 1, Zf), v3(X0, 1, Zb)], n: AX.clone().negate(), out: v3(-0.05, 0, 0) },
    { pts: [v3(X1, 0, Zf), v3(X1, 0, Zb), v3(X1, 1, Zb), v3(X1, 1, Zf)], n: AX, out: v3(0.05, 0, 0) },
  ];
  walls.forEach(({ pts, n, out }) => {
    const at = (y, offset) => pts.map((p, i) => p.clone().setY(i < 2 ? y[0] : y[1]).add(offset ? out : v3(0, 0, 0)));
    g.quad('siding', ...at([base, eave]), null, n);
    g.quad('skirt', ...at([0, base], true), null, n);
  });

  [[X0, Zf, -1, 1], [X1, Zf, 1, 1], [X0, Zb, -1, -1], [X1, Zb, 1, -1]].forEach(([x, z, sx, sz]) => {
    const xa = sx < 0 ? x - 0.08 : x - 0.3;
    const za = sz > 0 ? z - 0.3 : z - 0.08;
    g.aabb('trim', xa, xa + 0.38, base, eave, za, za + 0.38);
  });

  const roof = mass.roof;
  if (roof) {
    const zFront = roof.frontAt != null ? -roof.frontAt : Zf;
    const zBack = roof.backTo != null ? -roof.backTo : Zb;
    if (roof.ridge === 'd') {
      gableRoof(g, {
        A0: X0, A1: X1, B0: zBack, B1: zFront, axis: 'z', eave, gable: roof.gable, gableBack: 'lap',
        gableAtB1: true, gableAtB0: roof.backTo == null,
      });
    } else {
      gableRoof(g, {
        A0: zBack, A1: zFront, B0: X0, B1: X1, axis: 'x', eave, gable: roof.gable,
        gableAtB0: true, gableAtB1: true,
      });
    }
  }

  (mass.autoWindows || []).forEach((side) => {
    let face;
    let len;
    if (side === 'left') {
      face = { o: v3(X0, 0, Zb), r: AZ.clone(), n: AX.clone().negate() };
      len = Zf - Zb;
    } else if (side === 'right') {
      face = { o: v3(X1, 0, Zf), r: v3(0, 0, -1), n: AX.clone() };
      len = Zf - Zb;
    } else {
      face = { o: v3(X1, 0, Zb), r: AX.clone().negate(), n: AZ.clone().negate() };
      len = X1 - X0;
    }
    const count = Math.max(1, Math.floor(len / 13));
    const spacing = len / count;
    const rows = mass.twoStory ? [floor + 3, floor + 12.5] : [floor + HEAD - 5];
    for (let i = 0; i < count; i += 1) {
      rows.forEach((sill) => buildWindow(g, face, spacing * (i + 0.5), sill, 3, 4.6));
    }
  });
}

function buildPorch(g, model, porch) {
  const W = model.width;
  const X0 = porch.x0 - W / 2;
  const X1 = porch.x1 - W / 2;
  const Zf = -porch.d0;
  const Zb = -porch.d1;
  const hp = FLOOR - 0.15;
  const eave = EAVE;
  // Raised porch deck: brick skirt with a concrete cap, as on the elevations.
  g.aabb('skirt', X0 + 0.1, X1 - 0.1, 0, hp - 0.2, Zb, Zf - 0.1);
  g.aabb('concrete', X0, X1, hp - 0.2, hp, Zb, Zf);

  if (porch.steps) {
    const sx = porch.steps.x - W / 2;
    const sw = porch.steps.width / 2;
    const count = porch.steps.count ?? 2;
    for (let i = 0; i < count; i += 1) {
      g.aabb('concrete', sx - sw, sx + sw, 0, (hp * (count - i)) / (count + 1), Zf + i, Zf + i + 1);
    }
  }

  const postZ = Zf - 0.4;
  const beamKey = porch.postStyle === 'square-dark' ? 'post' : 'trim';
  porch.posts.forEach((px) => {
    const x = px - W / 2;
    if (porch.postStyle === 'craftsman') {
      g.aabb('stone', x - 0.85, x + 0.85, hp, hp + 2.8, postZ - 0.85, postZ + 0.85);
      g.aabb('trim', x - 0.95, x + 0.95, hp + 2.8, hp + 3.0, postZ - 0.95, postZ + 0.95);
      const height = eave - 1.0 - (hp + 3.0);
      const column = new THREE.CylinderGeometry(0.46, 0.7, height, 4, 1);
      column.rotateY(Math.PI / 4);
      column.translate(x, hp + 3.0 + height / 2, postZ);
      appendGeometry(g, 'trim', column);
    } else {
      g.aabb('post', x - 0.27, x + 0.27, hp, eave - 0.9, postZ - 0.27, postZ + 0.27);
    }
  });

  g.aabb(beamKey, X0 - 0.1, X1 + 0.1, eave - 1.0, eave + 0.05, Zf - 0.75, Zf + 0.1);
  g.quad('trim', v3(X0, eave - 1.0, Zb), v3(X1, eave - 1.0, Zb), v3(X1, eave - 1.0, Zf), v3(X0, eave - 1.0, Zf), null, UP.clone().negate());

  if (porch.roof) {
    gableRoof(g, {
      A0: X0, A1: X1, B0: -porch.roof.backTo, B1: Zf + 0.1, axis: 'z', eave, gable: porch.roof.gable,
      gableAtB1: true, gableAtB0: false,
    });
  }
}

function appendGeometry(g, key, geometry) {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geom.getAttribute('position');
  const nor = geom.getAttribute('normal');
  const bucket = g.bucket(key);
  for (let i = 0; i < pos.count; i += 1) {
    bucket.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    bucket.nor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    bucket.uv.push(pos.getX(i) + pos.getZ(i), pos.getY(i));
  }
}

function buildModelGeometry(model) {
  const g = new GeoBuilder();
  model.masses.forEach((mass) => buildMass(g, model, mass));
  if (model.porch) buildPorch(g, model, model.porch);

  const W = model.width;
  (model.roofs || []).forEach((roof) => {
    const X0 = roof.x0 - W / 2;
    const X1 = roof.x1 - W / 2;
    const eave = roof.eave ?? EAVE;
    if (roof.ridge === 'd') {
      gableRoof(g, {
        A0: X0, A1: X1, B0: -roof.d1, B1: -roof.d0, axis: 'z', eave,
        gable: roof.front, gableBack: roof.back,
        gableAtB1: roof.front != null, gableAtB0: roof.back != null,
      });
    } else {
      gableRoof(g, {
        A0: -roof.d1, A1: -roof.d0, B0: X0, B1: X1, axis: 'x', eave,
        gable: roof.right, gableBack: roof.left,
        gableAtB1: roof.right != null, gableAtB0: roof.left != null,
      });
    }
  });
  (model.sheds || []).forEach((shed) => shedRoof(g, model, shed));
  (model.decks || []).forEach((deck) => buildDeck(g, model, deck));

  const doors = model.garageDoors
    ? model.garageDoors.map((door) => ({ ...door, d: door.d ?? 0 }))
    : model.garageDoor ? [model.garageDoor] : [];
  doors.forEach((door) => buildGarageDoor(g, frontFace(model, door.d), door.x, door.width, door.height));

  (model.openings || []).forEach((item) => {
    const { face, u } = openingFrame(model, item);
    const base = item.base ?? (item.onGarage ? 0 : FLOOR);
    const shutters = item.shutters || null;
    if (item.type === 'window' || item.type === 'transom') {
      const small = item.size === '2436';
      const w = item.w ?? (small ? 2 : 3);
      const h = item.h ?? (item.type === 'transom' ? 1 : small ? 3 : 5);
      const top = base + (item.top ?? HEAD);
      buildWindow(g, face, u, top - h, w, h, {
        shutterLeft: shutters === 'both' || shutters === 'left',
        shutterRight: shutters === 'both' || shutters === 'right',
        grid: item.type !== 'transom',
      });
    } else if (item.type === 'door') {
      buildDoor(g, face, u, base, 3, HEAD, item.style);
    } else if (item.type === 'slider') {
      buildSlider(g, face, u, base);
    } else if (item.type === 'lamp') {
      buildLamp(g, face, u, item.onGarage ? item.v : base + item.v);
    }
  });

  return g;
}

export function modelExtents(model) {
  const ds = model.masses.map((mass) => mass.d0);
  if (model.porch) ds.push(model.porch.d0);
  const dMin = Math.min(...ds);
  const dMax = Math.max(...model.masses.map((mass) => mass.d1));
  return { dMin, dMax, depth: dMax - dMin, width: model.width };
}

const geometryCache = new Map();

/** @returns {Map<string, THREE.BufferGeometry>} */
export function getModelGeometries(modelId, mirror) {
  const key = `${modelId}|${mirror ? 'L' : 'R'}`;
  if (!geometryCache.has(key)) {
    const builder = buildModelGeometry(getModel(modelId));
    geometryCache.set(key, builder.toGeometries(mirror));
  }
  return geometryCache.get(key);
}
