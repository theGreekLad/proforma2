import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { getModelGeometries } from './houseBuilder';
import { getModel, getPalette } from './houseModels';
import { getGroundMaterials, getHouseMaterials, getPlantMaterials } from './materials';
import { curbsToGeometry, generateLandscape, getPlantGeometries, polygonsToGeometry } from './landscaping';
import { CURB_OFFSET, ROW, placeModelOnLot } from './siteLayout';
import { mulberry32 } from './textures';

/**
 * Offline "photo studio" for single CrossMod homes: one house on a landscaped
 * lot with sky lighting, rendered to a still image from a preset camera.
 */

export const RENDER_VIEWS = [
  { id: 'front', label: 'Front' },
  { id: 'elevation', label: 'Front elevation' },
  { id: 'rear', label: 'Rear' },
  { id: 'aerial', label: 'Aerial' },
];

const PALETTE_KEYS = { siding: 'siding', shake: 'gable', bnb: 'gable', roof: 'roof', shutter: 'shutter', door: 'door', doorRear: 'door', post: 'post' };

const LAYER_HEIGHT = {
  grass: 0.06, gravel: 0.06, parkGrass: 0.09, parkGravel: 0.09, concrete: 0.12, driveway: 0.15, mulch: 0.17, rock: 0.17,
};

const deg = THREE.MathUtils.degToRad;

/** Sun direction (toward the sun) and camera direction per view. */
const VIEW_SETUP = {
  front: { azimuth: -24, elevation: 0, eye: 5.6, sun: [-0.75, 0.95, 1.0], fov: 38, frontDepth: 40 },
  elevation: { ortho: true, sun: [-0.55, 0.85, 1.0] },
  rear: { azimuth: 150, elevation: 0, eye: 5.6, sun: [0.8, 0.95, -0.9], fov: 38 },
  aerial: { azimuth: 35, elevation: 28, sun: [-0.7, 1.1, 0.9], fov: 32 },
};

function studioLot(model) {
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

function addPlants(scene, plants) {
  const geometries = getPlantGeometries();
  const materials = getPlantMaterials();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const yAxis = new THREE.Vector3(0, 1, 0);
  Object.entries(plants).forEach(([type, items]) => {
    if (!items.length) return;
    const material = type === 'trunk' ? materials.bark
      : type === 'boulder' ? materials.boulder
        : type === 'canopy' || type === 'conifer' ? materials.canopy
          : materials.foliage;
    const mesh = new THREE.InstancedMesh(geometries[type], material, items.length);
    items.forEach((item, i) => {
      p.set(item.x, item.y, item.z);
      q.setFromAxisAngle(yAxis, item.rot || 0);
      s.set(item.sx, item.sy, item.sz);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHex(item.color));
    });
    mesh.castShadow = type !== 'bloom';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  });
}

function backdropTrees(lot, rand) {
  const trees = { canopy: [], trunk: [], conifer: [] };
  const add = (x, z, height, spread, color) => {
    const trunkH = height * 0.3;
    trees.trunk.push({ x, y: 0, z, sx: 0.12 + height * 0.018, sy: trunkH, sz: 0.12 + height * 0.018, color: 0x5a4636, rot: rand() * 6 });
    const canopyH = height - trunkH * 0.75;
    trees.canopy.push({ x, y: trunkH * 0.75 + canopyH * 0.5, z, sx: spread / 2, sy: canopyH / 2, sz: spread / 2, color: [0x3d6b2a, 0x47752f, 0x365f27, 0x527d34][Math.floor(rand() * 4)], rot: rand() * 6 });
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

function mountains(scene) {
  const build = (radius, minH, maxH, seed, color) => {
    const r = mulberry32(seed);
    const pos = [];
    const segments = 160;
    const pts = [];
    for (let i = 0; i <= segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      const h = i === segments ? pts[0][2] : minH + (Math.sin(a * 3 + seed) * 0.5 + 0.5) * (maxH - minH) * 0.6 + r() * (maxH - minH) * 0.4;
      pts.push([Math.cos(a) * radius, Math.sin(a) * radius, h]);
    }
    for (let i = 0; i < segments; i += 1) {
      const [x1, z1, h1] = pts[i];
      const [x2, z2, h2] = pts[i + 1];
      pos.push(x1, -80, z1, x2, -80, z2, x2, h2, z2, x1, -80, z1, x2, h2, z2, x1, h1, z1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide })));
  };
  build(15000, 300, 1500, 3, '#b4c1cd');
  build(11000, 120, 650, 9, '#a3ad9f');
}

/** Perspective distance that fits the box in frame from a given direction. */
function fitPerspective(camera, box, dir, target, margin = { x: 0.86, y: 0.72 }) {
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

/**
 * Render one view of a CrossMod model.
 * @returns {{ canvas: HTMLCanvasElement, dataURL: string }}
 */
export function renderStudio({
  modelId,
  view = 'front',
  width = 2400,
  height = 1350,
  landscape = 'lush',
  paletteId,
  mirror = false,
  format = 'image/jpeg',
  quality = 0.92,
}) {
  const model = getModel(modelId);
  const palette = getPalette(paletteId || model.defaultPalette);
  let setup = VIEW_SETUP[view] || VIEW_SETUP.front;
  if (view === 'front' && model.studioFrontAzimuth != null) {
    const flip = Math.sign(model.studioFrontAzimuth) !== Math.sign(setup.azimuth);
    setup = { ...setup, azimuth: model.studioFrontAzimuth, sun: flip ? [-setup.sun[0], setup.sun[1], setup.sun[2]] : setup.sun };
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(...setup.sun).normalize();

  // Sky dome + image-based light from the same sky.
  const sky = new Sky();
  sky.scale.setScalar(450000);
  const u = sky.material.uniforms;
  u.turbidity.value = 4.5;
  u.rayleigh.value = 1.3;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(450000);
  Object.keys(u).forEach((key) => {
    if (envSky.material.uniforms[key]) envSky.material.uniforms[key].value = u[key].value;
  });
  envScene.add(envSky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100000, 100000), new THREE.MeshBasicMaterial({ color: '#7d8460' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -5;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.35;
  scene.fog = new THREE.Fog('#d4dde6', 1200, 9000);

  scene.add(new THREE.HemisphereLight('#dfe9f5', '#6f6a55', 0.42));
  const sun = new THREE.DirectionalLight('#fff3e0', 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.4;
  scene.add(sun);
  scene.add(sun.target);

  if (setup.ortho) {
    // Elevations read best against a clean sky gradient, without depth cues.
    sky.visible = false;
    const grad = document.createElement('canvas');
    grad.width = 4;
    grad.height = 256;
    const ctx = grad.getContext('2d');
    const fill = ctx.createLinearGradient(0, 0, 0, 256);
    fill.addColorStop(0, '#9fc0dc');
    fill.addColorStop(1, '#e9f0f5');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 4, 256);
    const bg = new THREE.CanvasTexture(grad);
    bg.colorSpace = THREE.SRGBColorSpace;
    scene.background = bg;
    scene.fog = null;
  } else {
    mountains(scene);
  }

  // Lot, landscaping and house.
  const lot = studioLot(model);
  const assignments = new Map([[lot.id, { modelId: model.id, mirror, paletteId: palette.id, landscapeId: landscape }]]);
  const { plants, surfaces } = generateLandscape({ lots: [lot] }, assignments, { streetTrees: false, yardTrees: false });
  const placement = placeModelOnLot(lot, model);
  const groundMats = getGroundMaterials();

  const far = 600;
  const roadNear = CURB_OFFSET + ROW.curb;
  const roadFar = roadNear + 34;
  const groundPolys = [
    { key: 'grass', poly: [[-far, -far], [far, -far], [far, roadNear], [-far, roadNear]], y: 0 },
    { key: 'asphalt', poly: [[-far, roadNear], [far, roadNear], [far, roadFar], [-far, roadFar]], y: 0 },
    { key: 'concrete', poly: [[-far, roadFar + ROW.curb + ROW.parkStrip], [far, roadFar + ROW.curb + ROW.parkStrip], [far, roadFar + ROW.curb + ROW.parkStrip + ROW.sidewalk], [-far, roadFar + ROW.curb + ROW.parkStrip + ROW.sidewalk]], y: 0.12 },
    { key: 'grass', poly: [[-far, roadFar], [far, roadFar], [far, far], [-far, far]], y: 0 },
  ];
  groundPolys.forEach(({ key, poly, y }) => {
    const mesh = new THREE.Mesh(polygonsToGeometry([poly], y), groundMats[key]);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
  const fieldMesh = new THREE.Mesh(polygonsToGeometry([[[-30000, -30000], [30000, -30000], [30000, 30000], [-30000, 30000]]], -0.6), groundMats.field);
  scene.add(fieldMesh);
  // Far-side curb so the street reads as a street.
  surfaces.curbs.push({ a: [far, roadFar], b: [-far, roadFar], n: [0, -1], height: 0.5 });
  Object.entries(surfaces.polys).forEach(([key, polys]) => {
    if (!polys.length) return;
    const mesh = new THREE.Mesh(polygonsToGeometry(polys, LAYER_HEIGHT[key] ?? 0.06), groundMats[key]);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
  const curbs = new THREE.Mesh(curbsToGeometry(surfaces.curbs), groundMats.curb);
  curbs.receiveShadow = true;
  scene.add(curbs);

  addPlants(scene, plants);
  if (!setup.ortho) addPlants(scene, backdropTrees(lot, mulberry32(model.id.length * 31 + 7)));

  const houseMaterials = getHouseMaterials();
  const houseBox = new THREE.Box3();
  const house = new THREE.Group();
  house.position.set(placement.origin[0], 0, placement.origin[1]);
  getModelGeometries(model.id, mirror).forEach((geometry, key) => {
    const material = (houseMaterials[key] || houseMaterials.trim).clone();
    const paletteKey = PALETTE_KEYS[key];
    if (paletteKey) material.color.set(palette[paletteKey]);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = key !== 'glass' && key !== 'lampGlass';
    mesh.receiveShadow = true;
    house.add(mesh);
  });
  scene.add(house);
  house.updateMatrixWorld(true);
  houseBox.setFromObject(house);

  const center = houseBox.getCenter(new THREE.Vector3());
  const size = houseBox.getSize(new THREE.Vector3());
  const shadowSpan = Math.max(size.x, size.z) * 0.9 + 30;
  sun.position.copy(center).addScaledVector(sunDir, 600);
  sun.target.position.copy(center);
  Object.assign(sun.shadow.camera, { left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan, near: 100, far: 1400 });
  sun.shadow.camera.updateProjectionMatrix();

  const aspect = width / height;
  let camera;
  if (setup.ortho) {
    const frameW = Math.max(size.x * 1.16, size.y * 1.75 * aspect);
    const frameH = frameW / aspect;
    camera = new THREE.OrthographicCamera(-frameW / 2, frameW / 2, frameH / 2, -frameH / 2, 1, 5000);
    // True elevation (no tilt) with grade about a sixth of the way up the frame.
    const aimY = frameH * 0.34;
    camera.position.set(center.x, aimY, houseBox.max.z + 400);
    camera.lookAt(center.x, aimY, houseBox.min.z);
    // Lawn band behind the house so it stands on ground rather than floating.
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 60),
      new THREE.MeshBasicMaterial({ color: '#5f8a3c', toneMapped: false, fog: false }),
    );
    band.position.set(center.x, -30, houseBox.min.z - 80);
    scene.add(band);
  } else {
    camera = new THREE.PerspectiveCamera(setup.fov, aspect, 0.5, 40000);
    const az = deg(setup.azimuth);
    const el = deg(setup.elevation);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    const target = center.clone();
    target.y = size.y * 0.42;
    if (setup.elevation === 0) {
      // Eye-level: fit horizontally, then drop the camera to standing height while keeping the aim.
      const fitBox = houseBox.clone();
      if (setup.frontDepth) fitBox.min.z = Math.max(fitBox.min.z, fitBox.max.z - setup.frontDepth);
      fitPerspective(camera, fitBox, dir, target, { x: 0.93, y: 0.7 });
      camera.position.y = setup.eye;
      camera.lookAt(target);
    } else {
      fitPerspective(camera, houseBox, dir, target, { x: 1.04, y: 0.94 });
    }
  }
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL(format, quality);
  const canvas = renderer.domElement;
  env.dispose();
  pmrem.dispose();
  return { canvas, dataURL, renderer };
}
