import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { getModelGeometries, modelExtents } from './houseBuilder';
import { getModel, getPalette } from './houseModels';
import { getGroundMaterials, getHouseMaterials } from './materials';

const PALETTE_KEYS = { siding: 'siding', shake: 'gable', bnb: 'gable', roof: 'roof', shutter: 'shutter', door: 'door', post: 'post' };

/** Single-model turntable used to check a model against its brochure rendering. */
export default function ModelPreview({ modelId, mirror = false, angle = 0.45 }) {
  const model = getModel(modelId);
  const palette = getPalette(model.defaultPalette);
  const ext = modelExtents(model);
  const parts = useMemo(() => {
    const materials = getHouseMaterials();
    return [...getModelGeometries(modelId, mirror).entries()].map(([key, geometry]) => {
      const material = materials[key].clone();
      const paletteKey = PALETTE_KEYS[key];
      if (paletteKey) material.color.set(palette[paletteKey]);
      return { key, geometry, material };
    });
  }, [modelId, mirror, palette]);
  const ground = getGroundMaterials();
  const dist = Math.max(model.width, 40) * 1.35;
  const cz = -(ext.dMin + ext.dMax) / 2;
  const pos = [Math.sin(angle) * dist, 6, -ext.dMin + Math.cos(angle) * dist];

  return (
    <Canvas shadows gl={{ preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }} camera={{ fov: 45, position: pos, near: 0.5, far: 5000 }}>
      <Sky sunPosition={[1, 0.5, 1]} />
      <hemisphereLight args={['#dfe9f5', '#6f6a55', 0.6]} />
      <directionalLight position={[60, 90, 120]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={ground.grass}>
        <planeGeometry args={[600, 600]} />
      </mesh>
      {parts.map(({ key, geometry, material }) => (
        <mesh key={key} geometry={geometry} material={material} castShadow receiveShadow />
      ))}
      <OrbitControls target={[0, 6, cz * 0.4]} />
    </Canvas>
  );
}
