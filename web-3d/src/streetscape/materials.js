import * as THREE from 'three';
import {
  asphaltTexture,
  boardBattenTexture,
  brickTexture,
  concreteTexture,
  courtTexture,
  doorTexture,
  foliageTexture,
  fieldTexture,
  garageDoorTexture,
  grassTexture,
  gravelTexture,
  lapSidingTexture,
  mulchTexture,
  rockTexture,
  shakeTexture,
  shingleTexture,
  shutterTexture,
  stoneTexture,
} from './textures';

let houseMaterials = null;
let groundMaterials = null;
let plantMaterials = null;

function std(params) {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...params });
}

/** House materials keyed like the builder buckets. Colours come from instanceColor. */
export function getHouseMaterials() {
  if (houseMaterials) return houseMaterials;
  const lap = lapSidingTexture();
  const shake = shakeTexture();
  const bnb = boardBattenTexture();
  const shingle = shingleTexture();
  houseMaterials = {
    siding: std({ map: lap, bumpMap: lap, bumpScale: 0.6, roughness: 0.7 }),
    shake: std({ map: shake, bumpMap: shake, bumpScale: 1.2, roughness: 0.9 }),
    bnb: std({ map: bnb, bumpMap: bnb, bumpScale: 0.8, roughness: 0.75 }),
    roof: std({ map: shingle, bumpMap: shingle, bumpScale: 1.4, roughness: 0.95 }),
    trim: std({ color: '#f5f5f1', roughness: 0.55 }),
    skirt: std({ map: brickTexture(), roughness: 0.95 }),
    concrete: std({ map: concreteTexture(), roughness: 0.92 }),
    stone: std({ map: stoneTexture(), bumpMap: stoneTexture(), bumpScale: 1.5, roughness: 0.95 }),
    glass: std({ color: '#3b4a58', roughness: 0.06, metalness: 0.75, envMapIntensity: 3.5 }),
    door: std({ map: doorTexture(), roughness: 0.5 }),
    garageDoor: std({ map: garageDoorTexture(), roughness: 0.55 }),
    shutter: std({ map: shutterTexture(), roughness: 0.6 }),
    post: std({ color: '#ffffff', roughness: 0.6 }),
    lamp: std({ color: '#1c1d1f', roughness: 0.4, metalness: 0.4 }),
    lampGlass: std({ color: '#f7e7c4', emissive: '#ffcf8a', emissiveIntensity: 0.6, roughness: 0.3 }),
  };
  return houseMaterials;
}

export function getGroundMaterials() {
  if (groundMaterials) return groundMaterials;
  const offset = (factor) => ({ polygonOffset: true, polygonOffsetFactor: factor, polygonOffsetUnits: factor });
  groundMaterials = {
    field: std({ map: fieldTexture(), roughness: 1 }),
    asphalt: std({ map: asphaltTexture(), roughness: 0.95, ...offset(-1) }),
    grass: std({ map: grassTexture(), roughness: 0.95, ...offset(-2) }),
    gravel: std({ map: gravelTexture(), roughness: 1, ...offset(-2) }),
    parkGrass: std({ map: grassTexture(), roughness: 0.95, ...offset(-3) }),
    parkGravel: std({ map: gravelTexture(), roughness: 1, ...offset(-3) }),
    concrete: std({ map: concreteTexture(), roughness: 0.92, ...offset(-4) }),
    driveway: std({ map: concreteTexture(), roughness: 0.9, ...offset(-5) }),
    mulch: std({ map: mulchTexture(), roughness: 1, ...offset(-6) }),
    rock: std({ map: rockTexture(), roughness: 1, ...offset(-6) }),
    curb: std({ color: '#c9c7c1', roughness: 0.9 }),
    water: std({ color: '#3f9fc4', roughness: 0.15, metalness: 0.1, ...offset(-3) }),
    court: std({ map: courtTexture(), roughness: 0.9, ...offset(-3) }),
    dirt: std({ color: '#a88c68', roughness: 1, ...offset(-2) }),
    fence: std({ color: '#f4f4f0', roughness: 0.5, side: THREE.DoubleSide }),
    commercial: std({ color: '#d8ccb6', roughness: 0.8 }),
    commercialRoof: std({ color: '#7a7470', roughness: 0.9 }),
  };
  return groundMaterials;
}

export function getPlantMaterials() {
  if (plantMaterials) return plantMaterials;
  plantMaterials = {
    foliage: std({ color: '#ffffff', roughness: 0.9, flatShading: true }),
    canopy: (() => {
      const map = foliageTexture().clone();
      map.needsUpdate = true;
      map.repeat.set(4, 3);
      return std({ color: '#ffffff', map, bumpMap: map, bumpScale: 2, roughness: 0.85 });
    })(),
    bark: std({ color: '#ffffff', roughness: 0.95 }),
    boulder: std({ color: '#ffffff', roughness: 0.95, flatShading: true }),
  };
  return plantMaterials;
}
