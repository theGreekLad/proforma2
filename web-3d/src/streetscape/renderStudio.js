import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { getModelGeometries } from './houseBuilder';
import { getGroundMaterials, getHouseMaterials, getPlantMaterials } from './materials';
import { curbsToGeometry, getPlantGeometries, polygonsToGeometry } from './landscaping';
import { mulberry32 } from './textures';
import { RENDER_VIEWS, computeStudioSpec } from './studioSpec';

/**
 * Offline "photo studio" for single CrossMod homes: one house on a landscaped
 * lot with sky lighting, rendered to a still image from a preset camera.
 */

export { RENDER_VIEWS };

const PALETTE_KEYS = { siding: 'siding', shake: 'gable', bnb: 'gable', roof: 'roof', shutter: 'shutter', door: 'door', doorRear: 'door', post: 'post' };

const LAYER_HEIGHT = {
  grass: 0.06, gravel: 0.06, parkGrass: 0.09, parkGravel: 0.09, concrete: 0.12, driveway: 0.15, mulch: 0.17, rock: 0.17,
};

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
  const spec = computeStudioSpec({ modelId, landscape, paletteId, mirror, aspect: width / height });
  const { model, palette, placement, houseBox, ground } = spec;
  const { camera: cam, sun: sunArr, setup } = spec.views[view] || spec.views.front;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const sunDir = new THREE.Vector3(...sunArr);

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
  const envGround = new THREE.Mesh(new THREE.PlaneGeometry(100000, 100000), new THREE.MeshBasicMaterial({ color: '#7d8460' }));
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -5;
  envScene.add(envGround);
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

  const groundMats = getGroundMaterials();
  ground.polys.forEach(({ key, poly, y }) => {
    const mesh = new THREE.Mesh(polygonsToGeometry([poly], y), groundMats[key]);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
  scene.add(new THREE.Mesh(polygonsToGeometry([[[-30000, -30000], [30000, -30000], [30000, 30000], [-30000, 30000]]], -0.6), groundMats.field));
  const { plants, surfaces } = spec.landscape;
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
  if (!setup.ortho) addPlants(scene, spec.backdrop);

  const houseMaterials = getHouseMaterials();
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

  const center = houseBox.getCenter(new THREE.Vector3());
  const size = houseBox.getSize(new THREE.Vector3());
  const shadowSpan = Math.max(size.x, size.z) * 0.9 + 30;
  sun.position.copy(center).addScaledVector(sunDir, 600);
  sun.target.position.copy(center);
  Object.assign(sun.shadow.camera, { left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan, near: 100, far: 1400 });
  sun.shadow.camera.updateProjectionMatrix();

  let camera;
  if (cam.type === 'orthographic') {
    camera = new THREE.OrthographicCamera(-cam.width / 2, cam.width / 2, cam.height / 2, -cam.height / 2, 1, 5000);
    // Lawn band behind the house so it stands on ground rather than floating.
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 60),
      new THREE.MeshBasicMaterial({ color: '#5f8a3c', toneMapped: false, fog: false }),
    );
    band.position.set(center.x, -30, houseBox.min.z - 80);
    scene.add(band);
  } else {
    camera = new THREE.PerspectiveCamera(cam.fov, cam.aspect, 0.5, 40000);
  }
  camera.position.set(...cam.position);
  camera.lookAt(new THREE.Vector3(...cam.target));
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL(format, quality);
  const canvas = renderer.domElement;
  env.dispose();
  pmrem.dispose();
  return { canvas, dataURL, renderer };
}
