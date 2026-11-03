import { R4_ZONING } from '../data/zoning';
import { modelExtents } from './houseBuilder';

/**
 * Street-frontage analysis for the plat lots.
 *
 * The plat has no reliable street centrelines, so a lot edge is treated as
 * street frontage when the ground just outside it is open (not another lot or
 * an amenity area) and there are lots/areas across a ~60' right-of-way.
 * Houses face their primary frontage, set back 25' per R-4.
 */

export const SETBACK = R4_ZONING.setbacks.front;
export const SIDE_SETBACK = R4_ZONING.setbacks.side;
export const REAR_SETBACK = R4_ZONING.setbacks.rear;
/** Right-of-way cross section measured from the lot line toward the street. */
export const ROW = { sidewalk: 5, parkStrip: 7, curb: 0.8 };
export const CURB_OFFSET = ROW.sidewalk + ROW.parkStrip;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};

export function convexHull(points) {
  const pts = points.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  pts.forEach((p) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  });
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Drop tiny edges and near-collinear vertices left over from the plat trace. */
function simplifyRing(ring, minEdge = 4, minTurnDeg = 7) {
  let pts = ring.slice();
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length > 3; i += 1) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const cur = pts[i];
      const next = pts[(i + 1) % pts.length];
      const a = sub(cur, prev);
      const b = sub(next, cur);
      const turn = Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], dot(a, b))) * (180 / Math.PI);
      if (len(b) < minEdge || turn < minTurnDeg) {
        pts.splice(len(b) < minEdge ? (i + 1) % pts.length : i, 1);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

export function pointInPolygon([px, pz], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

function bbox(poly) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  poly.forEach(([x, z]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  });
  return { minX, maxX, minZ, maxZ };
}

function centroidOf(poly) {
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    const f = x1 * z2 - x2 * z1;
    area += f;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  if (Math.abs(area) < 1e-6) return poly[0];
  return [cx / (3 * area), cz / (3 * area)];
}

function makeIndex(site) {
  const entries = [];
  site.lots.forEach((lot) => entries.push({ id: lot.id, poly: lot.polygon, box: bbox(lot.polygon) }));
  site.siteAreas
    .filter((area) => area.type !== 'road')
    .forEach((area) => entries.push({ id: area.id, poly: area.polygon, box: bbox(area.polygon) }));
  return {
    occupied(p, excludeId) {
      for (const e of entries) {
        if (e.id === excludeId) continue;
        const { box } = e;
        if (p[0] < box.minX || p[0] > box.maxX || p[1] < box.minZ || p[1] > box.maxZ) continue;
        if (pointInPolygon(p, e.poly)) return true;
      }
      return false;
    },
  };
}

/** Lateral [lo, hi] of the lot along r at a given depth behind the frontage line. */
function lateralAt(localHull, depth) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < localHull.length; i += 1) {
    const [u1, w1] = localHull[i];
    const [u2, w2] = localHull[(i + 1) % localHull.length];
    if ((w1 - depth) * (w2 - depth) > 0 || w1 === w2) continue;
    const u = u1 + ((depth - w1) / (w2 - w1)) * (u2 - u1);
    lo = Math.min(lo, u);
    hi = Math.max(hi, u);
  }
  return { lo, hi };
}

function analyseEdges(lot, hull, centroid, index) {
  const edges = [];
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const edgeLen = len(sub(b, a));
    if (edgeLen < 20) continue;
    const t = norm(sub(b, a));
    let n = [t[1], -t[0]];
    const mid = mul(add(a, b), 0.5);
    if (dot(n, sub(mid, centroid)) < 0) n = mul(n, -1);

    let open = 0;
    let total = 0;
    [0.25, 0.5, 0.75].forEach((f) => {
      const base = add(a, mul(sub(b, a), f));
      [6, 16, 26].forEach((d) => {
        total += 1;
        if (!index.occupied(add(base, mul(n, d)), lot.id)) open += 1;
      });
    });
    const openFrac = open / total;

    let gap = null;
    for (let d = 30; d <= 120; d += 5) {
      if (index.occupied(add(mid, mul(n, d)), lot.id)) {
        gap = d;
        break;
      }
    }
    edges.push({ a, b, n, t, mid, length: edgeLen, openFrac, gap, across: gap != null && gap <= 95 });
  }
  return edges;
}

/**
 * @returns {{ lots: object[], byId: Map<string, object>, hull: number[][], bounds: object }}
 */
export function computeStreetLayout(site) {
  const index = makeIndex(site);
  // The plat trace gives several lot numbers the same polygon where the plat
  // draws an attached multi-unit block (e.g. lots 113–116 on Starlight Lane).
  // Treat each shared polygon as one building site.
  const groupsByShape = new Map();
  site.lots
    .filter((lot) => lot.type === 'single-family' || lot.type === 'townhome')
    .forEach((lot) => {
      const key = lot.polygon.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(';');
      if (!groupsByShape.has(key)) groupsByShape.set(key, []);
      groupsByShape.get(key).push(lot);
    });
  const residential = [...groupsByShape.values()].map((group) => {
    if (group.length === 1) return group[0];
    const numbers = group.map((lot) => lot.lotNumber).sort((a, b) => a - b);
    return {
      ...group[0],
      type: 'townhome',
      unitCount: group.length,
      unitLots: numbers,
      label: `Lots ${numbers[0]}–${numbers[numbers.length - 1]}`,
      sharedPolygon: true,
    };
  });

  const analysed = residential.map((lot) => {
    const hull = simplifyRing(convexHull(lot.polygon));
    const centroid = centroidOf(hull);
    const edges = analyseEdges(lot, hull, centroid, index);
    const streets = edges.filter((edge) => edge.openFrac >= 0.7);
    const withAcross = streets.filter((edge) => edge.across);
    return { lot, hull, centroid, edges, streets, candidates: withAcross.length ? withAcross : streets };
  });

  // Pass 1: lots with one obvious frontage.
  analysed.forEach((entry) => {
    if (entry.candidates.length === 1) entry.primary = entry.candidates[0];
  });

  // Pass 2: corner / ambiguous lots follow the street their neighbours face.
  analysed.forEach((entry) => {
    if (entry.primary || !entry.candidates.length) return;
    let best = null;
    entry.candidates.forEach((edge) => {
      let support = 0;
      analysed.forEach((other) => {
        if (other === entry || !other.primary) return;
        if (len(sub(other.centroid, entry.centroid)) > 160) return;
        if (dot(other.primary.n, edge.n) < 0.85) return;
        const offset = Math.abs(dot(sub(other.primary.mid, edge.mid), edge.n));
        if (offset < 14) support += 1;
      });
      const score = support * 1000 - edge.length;
      if (!best || score > best.score) best = { edge, score };
    });
    entry.primary = best.edge;
  });

  const lots = [];
  analysed.forEach((entry) => {
    if (!entry.primary) return;
    const { lot, hull, primary } = entry;
    const F = primary.mid;
    const n = primary.n;
    const r = [n[1], -n[0]];
    const localHull = hull.map((p) => {
      const rel = sub(p, F);
      return [dot(rel, r), -dot(rel, n)];
    });
    const lotDepth = Math.max(...localHull.map(([, w]) => w));
    let lo = -Infinity;
    let hi = Infinity;
    [SETBACK + 2, SETBACK + 25, SETBACK + 50].forEach((depth) => {
      if (depth > lotDepth - 2) return;
      const span = lateralAt(localHull, depth);
      if (Number.isFinite(span.lo)) {
        lo = Math.max(lo, span.lo);
        hi = Math.min(hi, span.hi);
      }
    });
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      lo = dot(sub(primary.a, F), r);
      hi = dot(sub(primary.b, F), r);
      if (lo > hi) [lo, hi] = [hi, lo];
    }

    const frontLo = Math.min(dot(sub(primary.a, F), r), dot(sub(primary.b, F), r));
    const frontHi = Math.max(dot(sub(primary.a, F), r), dot(sub(primary.b, F), r));

    lots.push({
      id: lot.id,
      lotNumber: lot.lotNumber,
      label: lot.unitLots ? `${lot.unitLots[0]}–${lot.unitLots[lot.unitLots.length - 1]}` : String(lot.lotNumber),
      unitLots: lot.unitLots || null,
      type: lot.type,
      phase: lot.phase,
      sqft: lot.sqft,
      polygon: lot.polygon,
      hull,
      F,
      n,
      r,
      lo,
      hi,
      frontLo,
      frontHi,
      lotDepth,
      buildableWidth: hi - lo - 2 * SIDE_SETBACK,
      streetGap: primary.gap ?? 60,
      isCorner: entry.streets.length > 1,
      streetEdges: entry.streets.map((edge) => ({ a: edge.a, b: edge.b, n: edge.n, primary: edge === primary })),
      lineKey: `${Math.round(Math.atan2(n[1], n[0]) / (Math.PI / 18))}:${Math.round(dot(F, n) / 30)}`,
    });
  });

  // Order lots along each block face so neighbours are adjacent in the list.
  const groups = new Map();
  lots.forEach((lot) => {
    if (!groups.has(lot.lineKey)) groups.set(lot.lineKey, []);
    groups.get(lot.lineKey).push(lot);
  });
  const ordered = [];
  [...groups.values()]
    .sort((a, b) => a[0].F[0] - b[0].F[0])
    .forEach((group) => {
      group.sort((a, b) => dot(a.F, a.r) - dot(b.F, b.r));
      group.forEach((lot, i) => {
        lot.rowIndex = i;
        lot.rowSize = group.length;
        ordered.push(lot);
      });
    });

  const allPoints = [
    ...site.lots.flatMap((lot) => lot.polygon),
    ...site.siteAreas.filter((area) => area.type !== 'road').flatMap((area) => area.polygon),
  ];
  const hull = convexHull(allPoints);
  const center = centroidOf(hull);
  const paved = hull.map((p) => add(p, mul(norm(sub(p, center)), 24)));

  return {
    lots: ordered,
    isOpen: (p) => !index.occupied(p, null),
    byId: new Map(ordered.map((lot) => [lot.id, lot])),
    pavedHull: paved,
    center,
    bounds: bbox(paved),
  };
}

/** Where a model sits on a lot, and helpers to map model-local XZ to world XZ. */
export function placeModelOnLot(lotLayout, model) {
  const ext = modelExtents(model);
  const c = (lotLayout.lo + lotLayout.hi) / 2;
  const back = SETBACK - ext.dMin;
  const { F, n, r } = lotLayout;
  const origin = [F[0] + r[0] * c - n[0] * back, F[1] + r[1] * c - n[1] * back];
  const toWorld = (X, Z) => [origin[0] + r[0] * X + n[0] * Z, origin[1] + r[1] * X + n[1] * Z];
  const needed = ext.width + 2 * SIDE_SETBACK;
  const available = lotLayout.hi - lotLayout.lo;
  const depthNeeded = SETBACK + ext.depth + REAR_SETBACK;
  return {
    origin,
    toWorld,
    ext,
    frontageZ: back,
    latLo: lotLayout.lo - c,
    latHi: lotLayout.hi - c,
    frontLo: lotLayout.frontLo - c,
    frontHi: lotLayout.frontHi - c,
    fits: needed <= available + 0.5 && depthNeeded <= lotLayout.lotDepth + 0.5,
    widthShortfall: Math.max(0, needed - available),
    depthShortfall: Math.max(0, depthNeeded - lotLayout.lotDepth),
    /** Column-major basis for THREE.Matrix4.set (X→r, Y→up, Z→n). */
    basis: { r, n, origin },
  };
}

export function modelFitsLot(lotLayout, model) {
  return placeModelOnLot(lotLayout, model).fits;
}

/**
 * Camera presets for a lot: eye-level from the far curb, down the row, and a
 * low drone shot. Positions are pulled back toward the street if they would
 * land inside another lot.
 */
export function lotViewpoints(lotLayout, placement, eye = 5.5, isOpen = () => true) {
  const { F, n, r } = lotLayout;
  const gap = Math.min(Math.max(lotLayout.streetGap, 50), 70);
  const road = gap - 2 * (CURB_OFFSET + ROW.curb);
  const farCurb = CURB_OFFSET + ROW.curb + road;
  const facade = placement.toWorld(0, -placement.ext.dMin);
  const pt = (base, alongN, alongR) => [base[0] + n[0] * alongN + r[0] * alongR, base[1] + n[1] * alongN + r[1] * alongR];
  const safe = (alongN, alongR) => {
    for (let d = alongN; d > CURB_OFFSET + 4; d -= 3) {
      const p = pt(F, d, alongR);
      if (isOpen(p)) return p;
    }
    return pt(F, CURB_OFFSET + 8, alongR);
  };
  const roadMid = CURB_OFFSET + ROW.curb + road / 2;
  const across = safe(roadMid + road * 0.1, 0);
  const street = safe(roadMid, -40);
  const streetLook = pt(F, -30, 14);
  const drone = pt(F, farCurb + 40, -70);
  const droneLook = pt(F, -30, 10);
  return {
    across: { position: [across[0], eye, across[1]], target: [facade[0], 8, facade[1]], fov: 42 },
    street: { position: [street[0], eye, street[1]], target: [streetLook[0], 7.5, streetLook[1]], fov: 46 },
    drone: { position: [drone[0], 48, drone[1]], target: [droneLook[0], 4, droneLook[1]], fov: 50 },
  };
}
