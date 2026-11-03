import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { getModelGeometries, modelExtents } from '../streetscape/houseBuilder';
import { getModel, getPalette } from '../streetscape/houseModels';
import { getGroundMaterials, getHouseMaterials, getPlantMaterials } from '../streetscape/materials';
import { C, PlantSink, bedPlants, getPlantGeometries, vary } from '../streetscape/landscaping';
import { gravelTexture, mulberry32 } from '../streetscape/textures';

/**
 * Single-home "studio" renderer for the Layouts page.
 *
 * Builds the same CrossMod house geometry the Streetscape uses (houseModels.js
 * + houseBuilder.js), sets it on a lot with a driveway, front walk, xeriscape
 * beds and sidewalk, and renders a street-level front view against a high-desert
 * mountain backdrop. The output matches the existing layout renderings: a 16:9
 * still, 1280 × 720 by default.
 */

const PALETTE_KEYS = { siding: 'siding', shake: 'gable', bnb: 'gable', roof: 'roof', shutter: 'shutter', door: 'door', post: 'post' };

const SUN_DIR = new THREE.Vector3(-0.8, 0.66, 0.78).normalize();
const SKY_TOP = new THREE.Color('#2f6fc4');
const SKY_HORIZON = new THREE.Color('#b8d2ea');
const HAZE = '#c3d3e2';

let renderer = null;

function getRenderer() {
  if (renderer) return renderer;
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/* ---------- noise ---------- */

function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const vals = Float32Array.from({ length: 256 }, () => rand());
  const fade = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const value = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = fade(x - xi);
    const fy = fade(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (x, y, octaves = 5) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < octaves; o += 1) {
      sum += amp * value(x * freq, y * freq);
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum;
  };
}

/* ---------- backdrop ---------- */

function skyDome() {
  const geometry = new THREE.SphereGeometry(30000, 48, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY_TOP.clone() },
      horizon: { value: SKY_HORIZON.clone() },
      sun: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sun;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 col = mix(horizon, top, pow(smoothstep(0.0, 0.32, h), 0.55));
        float glow = pow(max(dot(normalize(vDir), normalize(sun)), 0.0), 8.0);
        col += vec3(1.0, 0.95, 0.85) * glow * 0.12;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  material.toneMapped = false;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  return mesh;
}

/** A few soft cumulus wisps low on the horizon. */
function clouds(rand) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 26; i += 1) {
    const x = 40 + rand() * 176;
    const y = 60 + (rand() - 0.5) * 30;
    const r = 18 + rand() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), material);
    const w = 2500 + rand() * 2500;
    sprite.scale.set(w, w * 0.7, 1);
    sprite.position.set((rand() - 0.5) * 14000, 1700 + rand() * 900, -12000 - rand() * 2000);
    group.add(sprite);
  }
  return group;
}

/** Shaded high-desert mountain range: fractal ridges lit by the sun, hazed by fog. */
function mountains() {
  const noise = makeNoise(7);
  const nx = 420;
  const nz = 110;
  const x0 = -16000;
  const x1 = 16000;
  const z0 = -6500;
  const z1 = -15000;
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const col = new Float32Array((nx + 1) * (nz + 1) * 3);
  const heights = new Float32Array((nx + 1) * (nz + 1));
  const ridge = (x) => {
    // Ranges along the horizon, separated by lower saddles.
    const r = 0.5 + 0.5 * Math.sin(x / 2400 + 1.3) * Math.cos(x / 5200 - 0.4);
    return 300 + 1500 * Math.pow(r, 1.3);
  };
  for (let j = 0; j <= nz; j += 1) {
    const t = j / nz;
    const z = z0 + (z1 - z0) * t;
    for (let i = 0; i <= nx; i += 1) {
      const x = x0 + (x1 - x0) * (i / nx);
      const peak = ridge(x + t * 1200);
      // Rise from the valley floor, crest around t≈0.45, fall off behind.
      const profile = Math.sin(Math.min(1, t / 0.9) * Math.PI) ** 0.75;
      const n = noise(x / 1500, z / 1500, 6);
      const ridged = 1 - Math.abs(noise(x / 900 + 11, z / 900 + 5, 4) * 2 - 1);
      const detail = noise(x / 380 + 3, z / 380 + 9, 4) - 0.5;
      const crags = 1 - Math.abs(noise(x / 520 + 21, z / 520 + 2, 3) * 2 - 1);
      let h = peak * profile * (0.5 + 0.75 * n) + (ridged * 300 + crags * crags * 260 + detail * 220) * profile;
      h = Math.max(-30, h - 60 * (1 - t));
      const k = j * (nx + 1) + i;
      heights[k] = h;
      pos.set([x, h, z], k * 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const index = [];
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + (nx + 1);
      const d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  }
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  const nor = geometry.getAttribute('normal');
  const rock = new THREE.Color('#8c7360');
  const scrub = new THREE.Color('#a99070');
  const dark = new THREE.Color('#5a4a3e');
  const tmp = new THREE.Color();
  for (let k = 0; k < heights.length; k += 1) {
    const slope = 1 - nor.getY(k);
    const h = heights[k];
    const n = noise(pos[k * 3] / 300, pos[k * 3 + 2] / 300, 3);
    tmp.copy(scrub).lerp(rock, Math.min(1, slope * 3 + h / 2200));
    tmp.lerp(dark, Math.min(0.7, Math.max(0, n - 0.45) * 1.8 + Math.max(0, slope - 0.35)));
    col.set([tmp.r, tmp.g, tmp.b], k * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;
  return mesh;
}

/* ---------- site ---------- */

function rect(x0, x1, z0, z1, y) {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  g.rotateX(-Math.PI / 2);
  // World-feet UVs so textures keep their real-world scale.
  const uv = g.getAttribute('uv');
  const pos = g.getAttribute('position');
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, pos.getX(i) + cx, -(pos.getZ(i) + cz));
  g.translate(cx, y, cz);
  return g;
}

function groundMesh(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function desertMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(31);
  ctx.fillStyle = '#a88f6c';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i += 1) {
    const t = rand();
    ctx.fillStyle = t < 0.35 ? '#9a8262' : t < 0.7 ? '#b79f7c' : t < 0.92 ? '#8c7656' : '#7d7a52';
    ctx.fillRect(rand() * 512, rand() * 512, 1.5 + rand() * 2, 1.5 + rand() * 2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1 / 18, 1 / 18);
  map.anisotropy = 8;
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map, roughness: 1 });
}

function rockMulchMaterial() {
  const map = gravelTexture().clone();
  map.needsUpdate = true;
  map.repeat.set(1 / 3.5, 1 / 3.5);
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 2, roughness: 1, color: '#d8d2c8', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

function addPlants(scene, sink) {
  const geometries = getPlantGeometries();
  const materials = getPlantMaterials();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const color = new THREE.Color();
  Object.entries(sink.items).forEach(([type, items]) => {
    if (!items.length) return;
    const material = type === 'trunk' ? materials.bark
      : type === 'boulder' ? materials.boulder
        : type === 'canopy' || type === 'conifer' || type === 'shrub' ? materials.canopy
          : materials.foliage;
    const mesh = new THREE.InstancedMesh(geometries[type], material, items.length);
    items.forEach((item, i) => {
      p.set(item.x, item.y, item.z);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, item.rot || 0);
      s.set(item.sx, item.sy, item.sz);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      color.setHex(item.color);
      mesh.setColorAt(i, color);
    });
    mesh.castShadow = type !== 'bloom';
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}

function addHouse(scene, model, palette, mirror) {
  const materials = getHouseMaterials();
  getModelGeometries(model.id, mirror).forEach((geometry, key) => {
    const material = (materials[key] || materials.trim).clone();
    const paletteKey = PALETTE_KEYS[key];
    if (paletteKey) material.color.set(palette[paletteKey]);
    if (key === 'glass') {
      material.envMapIntensity = 1.6;
      material.metalness = 0.6;
      material.roughness = 0.08;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = key !== 'glass' && key !== 'lampGlass';
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}

/**
 * Lot, driveway, walk, beds, sidewalk and street in the model-local frame
 * (X across the facade, +Z toward the street, front wall at Z = 0).
 */
function addSite(scene, model, mirror, rand, yardDepth) {
  const ground = getGroundMaterials();
  const ext = modelExtents(model);
  const W = model.width;
  const sx = (x) => (mirror ? -1 : 1) * (x - W / 2);
  const zFront = -ext.dMin;
  const walkZ0 = zFront + yardDepth;
  const walkZ1 = walkZ0 + 4.5;
  const curbZ = walkZ1 + 2.5;
  const lotHalf = W / 2 + 14;

  scene.add(groundMesh(rect(-30000, 30000, -16000, 4000, -0.25), desertMaterial()));
  const mulch = rockMulchMaterial();
  scene.add(groundMesh(rect(-lotHalf, lotHalf, -ext.dMax - 12, walkZ0, 0.05), mulch));

  // Sidewalk, park strip, curb and street.
  scene.add(groundMesh(rect(-400, 400, walkZ0, walkZ1, 0.12), ground.concrete));
  scene.add(groundMesh(rect(-400, 400, walkZ1, curbZ, 0.08), mulch));
  const curb = new THREE.Mesh(new THREE.BoxGeometry(800, 0.5, 0.6), ground.curb);
  curb.position.set(0, 0.25, curbZ + 0.3);
  curb.castShadow = true;
  curb.receiveShadow = true;
  scene.add(curb);
  scene.add(groundMesh(rect(-400, 400, curbZ + 0.6, curbZ + 160, 0.02), ground.asphalt));

  // Driveway(s) from each garage door to the street.
  const doors = model.garageDoors || (model.garageDoor ? [model.garageDoor] : []);
  const drives = doors.map((door) => {
    const gx = sx(door.x);
    const half = door.width / 2 + 1;
    const z0 = -(door.d ?? 0);
    scene.add(groundMesh(rect(gx - half, gx + half, z0, walkZ0, 0.16), ground.driveway));
    scene.add(groundMesh(rect(gx - half - 1.5, gx + half + 1.5, walkZ1, curbZ + 0.6, 0.14), ground.driveway));
    return { gx, half };
  });

  // Foundation beds with water-wise planting.
  const bedDepth = 4.5;
  const sink = new PlantSink();
  const pl = { toWorld: (X, Z) => [X, Z], origin: [0, 0] };
  const rockBed = new THREE.MeshStandardMaterial({ map: ground.rock.map, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  let bedFront = -Infinity;
  (model.plantingBeds || []).forEach((bed) => {
    const X0 = sx(bed.x0);
    const X1 = sx(bed.x1);
    const Zwall = -bed.d;
    bedFront = Math.max(bedFront, Zwall + bedDepth);
    scene.add(groundMesh(rect(Math.min(X0, X1), Math.max(X0, X1), Zwall, Zwall + bedDepth, 0.1), rockBed));
    bedPlants(sink, pl, X0, X1, Zwall, bedDepth, 'xeric', rand, model);
  });

  // Front walk: steps → short lead → turn to the driveway.
  if (model.porch?.steps && drives.length) {
    const stepX = sx(model.porch.steps.x);
    const stepFront = -model.porch.d0 + 2;
    const turnZ = Math.max(stepFront, bedFront + 0.6);
    scene.add(groundMesh(rect(stepX - 1.8, stepX + 1.8, stepFront - 0.3, turnZ + 3.6, 0.15), ground.concrete));
    const drive = drives[0];
    const edgeX = stepX < drive.gx ? drive.gx - drive.half : drive.gx + drive.half;
    scene.add(groundMesh(rect(Math.min(stepX, edgeX), Math.max(stepX, edgeX), turnZ, turnZ + 3.6, 0.15), ground.concrete));
  }

  // A few accent plants and boulders in the front yard, kept off the walks.
  const blocked = (x, z) => drives.some((d) => Math.abs(x - d.gx) < d.half + 2.5) || z > walkZ0 - 2;
  for (let i = 0; i < 8; i += 1) {
    const x = (rand() - 0.5) * 2 * (lotHalf - 2);
    const z = zFront + 6 + rand() * (yardDepth - 8);
    if (blocked(x, z)) continue;
    const pick = rand();
    if (pick < 0.45) {
      const sc = 1.3 + rand() * 0.7;
      sink.add('grass', x, 0, z, sc * 0.8, sc, sc * 0.8, vary(rand() < 0.5 ? C.grassTan : C.grassGreen, rand), rand() * 6);
    } else if (pick < 0.75) {
      const sc = 0.7 + rand() * 0.5;
      sink.add('shrub', x, 0, z, sc, sc * 0.75, sc, vary(C.sage, rand, 0.05), rand() * 6);
    } else {
      const sc = 0.8 + rand() * 0.8;
      sink.add('boulder', x, 0.05, z, sc * 1.3, sc, sc, vary(rand() < 0.5 ? C.boulder : C.boulderDark, rand), rand() * 6);
    }
  }

  // Native scrub and junipers on the open desert behind and beside the lot.
  for (let i = 0; i < 900; i += 1) {
    const x = (rand() - 0.5) * 1600;
    const z = -ext.dMax - 15 - rand() * 1400;
    if (Math.abs(x) < lotHalf && z > -ext.dMax - 20) continue;
    const d = Math.hypot(x, z);
    const pick = rand();
    if (pick < 0.7) {
      const sc = 0.8 + rand() * 1.2 + d / 900;
      sink.add('shrub', x, 0, z, sc, sc * 0.7, sc, vary(rand() < 0.6 ? C.sage : C.rabbitbrush, rand, 0.08), rand() * 6);
    } else if (pick < 0.94) {
      sink.conifer(x, z, 5 + rand() * 7, 4 + rand() * 4, rand() < 0.5 ? C.juniper : C.conifer, rand);
    } else {
      sink.tree(x, z, { height: 12 + rand() * 8, spread: 10 + rand() * 6, canopy: '#6f7d4a', rand, multi: true });
    }
  }
  // Side yards.
  for (let i = 0; i < 60; i += 1) {
    const side = rand() < 0.5 ? -1 : 1;
    const x = side * (lotHalf + 3 + rand() * 120);
    const z = -ext.dMax + rand() * (walkZ0 + ext.dMax - 2);
    const sc = 0.7 + rand() * 1.1;
    sink.add('shrub', x, 0, z, sc, sc * 0.7, sc, vary(rand() < 0.6 ? C.sage : C.rabbitbrush, rand, 0.08), rand() * 6);
  }

  addPlants(scene, sink);
  return { zFront, walkZ0, curbZ };
}

/** Low-res gradient environment for image-based light and window reflections. */
function environmentMap(gl) {
  const envScene = new THREE.Scene();
  envScene.add(skyDome());
  const groundDisk = new THREE.Mesh(new THREE.CircleGeometry(20000, 32), new THREE.MeshBasicMaterial({ color: '#8f7a5e' }));
  groundDisk.rotation.x = -Math.PI / 2;
  groundDisk.position.y = -10;
  envScene.add(groundDisk);
  const pmrem = new THREE.PMREMGenerator(gl);
  const target = pmrem.fromScene(envScene, 0.02, 1, 40000);
  pmrem.dispose();
  return target;
}

let queue = Promise.resolve();

/**
 * Render one CrossMod design. Calls share one WebGL context, so they run in order.
 * @returns {Promise<HTMLCanvasElement>} a 2D canvas at width × height
 */
export function renderDesign(options) {
  const job = queue.then(() => renderNow(options));
  queue = job.catch(() => {});
  return job;
}

async function renderNow({
  modelId,
  paletteId,
  mirror = false,
  width = 1280,
  height = 720,
  supersample = 2,
  ao = true,
} = {}) {
  const model = getModel(modelId);
  const palette = getPalette(paletteId || model.defaultPalette);
  const gl = getRenderer();
  const rw = Math.round(width * supersample);
  const rh = Math.round(height * supersample);
  gl.setSize(rw, rh, false);

  const rand = mulberry32(model.id.length * 131 + (mirror ? 7 : 0));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 5000, 70000);
  scene.add(skyDome());
  scene.add(clouds(rand));
  scene.add(mountains());

  const envTarget = environmentMap(gl);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.4;

  // Street-level camera on the near side of the street, a little off-centre
  // like a curbside photo. The front yard depth follows from the framing.
  const aspect = width / height;
  const fov = 36;
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
  const frameWidth = Math.max(model.width * 1.14, 50);
  const dist = (frameWidth / 2) / Math.tan(hfov / 2);
  const yardDepth = THREE.MathUtils.clamp(dist * 0.42, 20, 30);

  addHouse(scene, model, palette, mirror);
  const site = addSite(scene, model, mirror, rand, yardDepth);

  const sun = new THREE.DirectionalLight('#fff4e2', 3.6);
  const ext = modelExtents(model);
  const focus = new THREE.Vector3(0, 0, -ext.depth / 2 + site.zFront / 2);
  sun.position.copy(focus).addScaledVector(SUN_DIR, 300);
  sun.target.position.copy(focus);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const span = Math.max(70, model.width * 0.9 + 20);
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 50, far: 700 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.25;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#d7e6f7', '#9a8263', 0.35));

  const camera = new THREE.PerspectiveCamera(fov, aspect, 2, 60000);
  const offsetX = (mirror ? 1 : -1) * model.width * 0.08;
  camera.position.set(offsetX, 5.2, site.zFront + dist);
  camera.lookAt(0, 6.4, site.zFront - 10);
  camera.updateProjectionMatrix();

  if (ao) {
    const composer = new EffectComposer(gl, new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType, samples: 4 }));
    composer.setPixelRatio(1);
    composer.setSize(rw, rh);
    composer.addPass(new RenderPass(scene, camera));
    const gtao = new GTAOPass(scene, camera, rw, rh);
    gtao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.5, thickness: 2, scale: 1.0, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
    composer.render();
    composer.dispose();
  } else {
    gl.render(scene, camera);
  }

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(gl.domElement, 0, 0, width, height);

  // Gentle photographic finish: vignette.
  const vignette = ctx.createRadialGradient(width / 2, height * 0.55, height * 0.45, width / 2, height * 0.55, width * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(20,16,10,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  envTarget.dispose();
  scene.traverse((obj) => {
    if (obj.isInstancedMesh) obj.dispose();
  });
  return out;
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
