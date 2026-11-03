import * as THREE from 'three';
import { getModelGeometries } from './houseBuilder';
import { getModel, getPalette } from './houseModels';
import { generateLandscape } from './landscaping';
import { CURB_OFFSET, ROW, placeModelOnLot } from './siteLayout';
import { mulberry32 } from './textures';

/**
 * Scene description for single-home studio renders, shared by the browser
 * renderer (renderStudio.js) and the photoreal Blender exporter
 * (scripts/photoreal/export-scenes.mjs) so both frame the house identically.
 * Coordinates are three.js world feet: Y up, +Z toward the street.
 */

export const RENDER_VIEWS = [
  { id: 'front', label: 'Front' },
  { id: 'elevation', label: 'Front elevation' },
  { id: 'rear', label: 'Rear' },
  { id: 'aerial', label: 'Aerial' },
];

/** Sun direction (toward the sun) and camera direction per view. */
export const VIEW_SETUP = {
  front: { azimuth: -24, elevation: 0, eye: 5.6, sun: [-0.75, 0.95, 1.0], fov: 38, frontDepth: 40 },
  elevation: { ortho: true, sun: [-0.55, 0.85, 1.0] },
  rear: { azimuth: 150, elevation: 0, eye: 5.6, sun: [0.8, 0.95, -0.9], fov: 38 },
  aerial: { azimuth: 35, elevation: 28, sun: [-0.7, 1.1, 0.9], fov: 32 },
};

const deg = THREE.MathUtils.degToRad;

export function studioLot(model) {
  const width = Math.max(model.width + 46, 84);
  const depth = 135;
  const hull = [[-width / 2, 0], [width / 2, 0], [width / 2, -depth], [-width / 2, -depth]];
  return {
    id: 'studio',
    lotNumber: 2,
    label: 'Studio',
    type: 'single-family',
    hull,
    polygon: hull,
    F: [0, 0],
    n: [0, 1],
    r: [1, 0],
    lo: -width / 2,
    hi: width / 2,
    frontLo: -width / 2,
    frontHi: width / 2,
    lotDepth: depth,
    streetEdges: [{ a: [-width / 2, 0], b: [width / 2, 0], n: [0, 1], primary: true }],
    streetGap: 60,
    isCorner: false,
    lineKey: 'studio',
    rowIndex: 0,
    rowSize: 1,
  };
}

export function backdropTrees(lot, rand) {
  const trees = { canopy: [], trunk: [], conifer: [] };
  const add = (x, z, height, spread, color) => {
    const trunkH = height * 0.3;
    const r = 0.12 + height * 0.018;
    trees.trunk.push({ x, y: 0, z, sx: r, sy: trunkH, sz: r, color: 0x5a4636, rot: rand() * 6 });
    const canopyH = height - trunkH * 0.75;
    trees.canopy.push({
      x, y: trunkH * 0.75 + canopyH * 0.5, z, sx: spread / 2, sy: canopyH / 2, sz: spread / 2,
      color: color ?? [0x3d6b2a, 0x47752f, 0x365f27, 0x527d34][Math.floor(rand() * 4)], rot: rand() * 6,
    });
  };
  const half = (lot.hi - lot.lo) / 2;
  for (let i = 0; i < 26; i += 1) {
    const x = (rand() - 0.5) * 2 * (half + 140);
    const z = -lot.lotDepth - 10 - rand() * 160;
    if (rand() < 0.22) trees.conifer.push({ x, y: 0, z, sx: 9 + rand() * 5, sy: 30 + rand() * 20, sz: 9 + rand() * 5, color: 0x2c4a2a, rot: rand() * 6 });
    else add(x, z, 30 + rand() * 22, 24 + rand() * 14);
  }
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 4; i += 1) {
      add(side * (half + 45 + rand() * 50), -55 - rand() * 90, 28 + rand() * 16, 22 + rand() * 10);
    }
  });
  return trees;
}

/** Perspective distance that fits the box in frame from a given direction. */
function fitPerspective(camera, box, dir, target, margin) {
  const corners = [];
  for (let i = 0; i < 8; i += 1) {
    corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  }
  const fits = (d) => {
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    return corners.every((corner) => {
      const ndc = corner.clone().project(camera);
      return ndc.z < 1 && Math.abs(ndc.x) <= margin.x && Math.abs(ndc.y) <= margin.y;
    });
  };
  let lo = 5;
  let hi = 3000;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  fits(hi);
}

function viewSetupFor(model, view) {
  let setup = VIEW_SETUP[view] || VIEW_SETUP.front;
  if (view === 'front' && model.studioFrontAzimuth != null) {
    const flip = Math.sign(model.studioFrontAzimuth) !== Math.sign(setup.azimuth);
    setup = { ...setup, azimuth: model.studioFrontAzimuth, sun: flip ? [-setup.sun[0], setup.sun[1], setup.sun[2]] : setup.sun };
  }
  return setup;
}

/** Camera description for one view, fitted to the house bounding box. */
export function studioCamera(model, view, houseBox, aspect) {
  const setup = viewSetupFor(model, view);
  const center = houseBox.getCenter(new THREE.Vector3());
  const size = houseBox.getSize(new THREE.Vector3());
  const sun = new THREE.Vector3(...setup.sun).normalize().toArray();
  if (setup.ortho) {
    const frameW = Math.max(size.x * 1.16, size.y * 1.75 * aspect);
    const frameH = frameW / aspect;
    const aimY = frameH * 0.34;
    return {
      setup,
      sun,
      camera: {
        type: 'orthographic',
        position: [center.x, aimY, houseBox.max.z + 400],
        target: [center.x, aimY, houseBox.min.z],
        width: frameW,
        height: frameH,
        aspect,
      },
    };
  }
  const camera = new THREE.PerspectiveCamera(setup.fov, aspect, 0.5, 40000);
  const az = deg(setup.azimuth);
  const el = deg(setup.elevation);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  const target = center.clone();
  target.y = size.y * 0.42;
  if (setup.elevation === 0) {
    const fitBox = houseBox.clone();
    if (setup.frontDepth) fitBox.min.z = Math.max(fitBox.min.z, fitBox.max.z - setup.frontDepth);
    fitPerspective(camera, fitBox, dir, target, { x: 0.93, y: 0.7 });
    camera.position.y = setup.eye;
  } else {
    fitPerspective(camera, houseBox, dir, target, { x: 1.04, y: 0.94 });
  }
  return {
    setup,
    sun,
    camera: { type: 'perspective', position: camera.position.toArray(), target: target.toArray(), fov: setup.fov, aspect },
  };
}

/** House bounding box in world space for a placement. */
export function houseBoxFor(modelId, mirror, origin) {
  const box = new THREE.Box3();
  getModelGeometries(modelId, mirror).forEach((geometry) => {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox);
  });
  box.translate(new THREE.Vector3(origin[0], 0, origin[1]));
  return box;
}

/** Street, far sidewalk and surrounding lawn around the studio lot. */
export function studioGround() {
  const far = 600;
  const roadNear = CURB_OFFSET + ROW.curb;
  const roadFar = roadNear + 34;
  const walk0 = roadFar + ROW.curb + ROW.parkStrip;
  return {
    far,
    roadNear,
    roadFar,
    polys: [
      { key: 'grass', poly: [[-far, -far], [far, -far], [far, roadNear], [-far, roadNear]], y: 0 },
      { key: 'asphalt', poly: [[-far, roadNear], [far, roadNear], [far, roadFar], [-far, roadFar]], y: 0 },
      { key: 'concrete', poly: [[-far, walk0], [far, walk0], [far, walk0 + ROW.sidewalk], [-far, walk0 + ROW.sidewalk]], y: 0.12 },
      { key: 'grass', poly: [[-far, roadFar], [far, roadFar], [far, far], [-far, far]], y: 0 },
    ],
    farCurb: { a: [far, roadFar], b: [-far, roadFar], n: [0, -1], height: 0.5 },
  };
}

/** Everything needed to stage one home in the studio. */
export function computeStudioSpec({ modelId, landscape = 'lush', paletteId, mirror = false, aspect = 16 / 9 }) {
  const model = getModel(modelId);
  const palette = getPalette(paletteId || model.defaultPalette);
  const lot = studioLot(model);
  const assignments = new Map([[lot.id, { modelId: model.id, mirror, paletteId: palette.id, landscapeId: landscape }]]);
  const land = generateLandscape({ lots: [lot] }, assignments, { streetTrees: false, yardTrees: false });
  const placement = placeModelOnLot(lot, model);
  const houseBox = houseBoxFor(model.id, mirror, placement.origin);
  const ground = studioGround();
  land.surfaces.curbs.push(ground.farCurb);
  const views = Object.fromEntries(RENDER_VIEWS.map(({ id }) => [id, studioCamera(model, id, houseBox, aspect)]));
  return {
    model,
    palette,
    mirror,
    lot,
    placement,
    houseBox,
    landscape: land,
    backdrop: backdropTrees(lot, mulberry32(model.id.length * 31 + 7)),
    ground,
    views,
  };
}
