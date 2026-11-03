import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { getModelGeometries } from './houseBuilder';
import { getModel, getPalette } from './houseModels';
import { getGroundMaterials, getHouseMaterials, getPlantMaterials } from './materials';
import {
  curbsToGeometry,
  fencesToGeometry,
  generateBackdropTrees,
  getPlantGeometries,
  polygonsToGeometry,
} from './landscaping';
import { placeModelOnLot } from './siteLayout';
import { mulberry32 } from './textures';

export const TIME_OF_DAY = {
  morning: { label: 'Morning', elevation: 20, offset: 40, color: '#ffe3c4', intensity: 2.4, hemi: 0.55, fog: '#d6dde4' },
  afternoon: { label: 'Afternoon', elevation: 46, offset: 30, color: '#fff3e0', intensity: 2.8, hemi: 0.6, fog: '#cfdae4' },
  golden: { label: 'Golden hour', elevation: 9, offset: 55, color: '#ffb877', intensity: 2.3, hemi: 0.42, fog: '#e2d2c0' },
};

const PALETTE_KEYS = {
  siding: 'siding',
  shake: 'gable',
  bnb: 'gable',
  roof: 'roof',
  shutter: 'shutter',
  door: 'door',
  post: 'post',
};

const WHITE = new THREE.Color('#ffffff');
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function InstancedSet({ geometry, material, matrices, colors, castShadow = true, receiveShadow = true, onClick, onPointerOver, onPointerOut }) {
  const ref = useRef();
  const count = matrices.length / 16;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.needsUpdate = true;
    if (colors) {
      if (!mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      mesh.instanceColor.array.set(colors);
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [matrices, colors, count]);
  if (!count) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, count]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      frustumCulled={false}
    />
  );
}

function HouseInstances({ layout, assignments, onSelectLot }) {
  const groups = useMemo(() => {
    const byVariant = new Map();
    assignments.forEach((assignment, lotId) => {
      const lot = layout.byId.get(lotId);
      if (!lot) return;
      const key = `${assignment.modelId}|${assignment.mirror ? 'L' : 'R'}`;
      if (!byVariant.has(key)) byVariant.set(key, { modelId: assignment.modelId, mirror: assignment.mirror, items: [] });
      const placement = placeModelOnLot(lot, getModel(assignment.modelId));
      byVariant.get(key).items.push({ lotId, placement, palette: getPalette(assignment.paletteId) });
    });

    return [...byVariant.entries()].map(([key, group]) => {
      const geometries = getModelGeometries(group.modelId, group.mirror);
      const matrices = new Float32Array(group.items.length * 16);
      group.items.forEach(({ placement }, i) => {
        const { r, n, origin } = placement.basis;
        tmpMatrix.makeBasis(
          new THREE.Vector3(r[0], 0, r[1]),
          Y_AXIS,
          new THREE.Vector3(n[0], 0, n[1]),
        );
        tmpMatrix.setPosition(origin[0], 0, origin[1]);
        tmpMatrix.toArray(matrices, i * 16);
      });
      const parts = [...geometries.entries()].map(([materialKey, geometry]) => {
        const paletteKey = PALETTE_KEYS[materialKey];
        const colors = new Float32Array(group.items.length * 3);
        const color = new THREE.Color();
        group.items.forEach(({ palette }, i) => {
          if (paletteKey) color.set(palette[paletteKey]);
          else color.copy(WHITE);
          color.toArray(colors, i * 3);
        });
        return { materialKey, geometry, colors };
      });
      return { key: `${key}|${group.items.length}`, lotIds: group.items.map((item) => item.lotId), matrices, parts };
    });
  }, [layout, assignments]);

  const materials = getHouseMaterials();

  return (
    <group>
      {groups.map((group) => group.parts.map((part) => (
        <InstancedSet
          key={`${group.key}|${part.materialKey}`}
          geometry={part.geometry}
          material={materials[part.materialKey] || materials.trim}
          matrices={group.matrices}
          colors={part.colors}
          castShadow={part.materialKey !== 'glass' && part.materialKey !== 'lampGlass'}
          onClick={(event) => {
            if (event.delta > 5) return;
            event.stopPropagation();
            onSelectLot(group.lotIds[event.instanceId]);
          }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        />
      )))}
    </group>
  );
}

function plantBuffers(items) {
  const matrices = new Float32Array(items.length * 16);
  const colors = new Float32Array(items.length * 3);
  const color = new THREE.Color();
  items.forEach((item, i) => {
    tmpPos.set(item.x, item.y, item.z);
    tmpQuat.setFromAxisAngle(Y_AXIS, item.rot || 0);
    tmpScale.set(item.sx, item.sy, item.sz);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    tmpMatrix.toArray(matrices, i * 16);
    color.setHex(item.color);
    color.toArray(colors, i * 3);
  });
  return { matrices, colors };
}

function PlantInstances({ plants, castShadow = true }) {
  const geometries = getPlantGeometries();
  const materials = getPlantMaterials();
  const sets = useMemo(
    () => Object.entries(plants).map(([type, items]) => ({ type, items: items.length, ...plantBuffers(items) })),
    [plants],
  );
  return (
    <group>
      {sets.map((set) => (
        <InstancedSet
          key={`${set.type}-${set.items}`}
          geometry={geometries[set.type]}
          material={
            set.type === 'trunk' ? materials.bark
              : set.type === 'boulder' ? materials.boulder
                : set.type === 'canopy' || set.type === 'conifer' ? materials.canopy
                  : materials.foliage
          }
          matrices={set.matrices}
          colors={set.colors}
          castShadow={castShadow && set.type !== 'bloom'}
        />
      ))}
    </group>
  );
}

function Mountains() {
  const geometries = useMemo(() => {
    const rand = mulberry32(17);
    const build = (radius, minH, maxH, seed) => {
      const r = mulberry32(seed);
      const pos = [];
      const segments = 160;
      const heights = [];
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        const h = minH + (Math.sin(a * 3 + seed) * 0.5 + 0.5) * (maxH - minH) * 0.6 + r() * (maxH - minH) * 0.4;
        heights.push([Math.cos(a) * radius, Math.sin(a) * radius, i % segments === 0 ? heights[0]?.[2] ?? h : h]);
      }
      for (let i = 0; i < segments; i += 1) {
        const [x1, z1, h1] = heights[i];
        const [x2, z2, h2] = heights[i + 1];
        pos.push(x1, -80, z1, x2, -80, z2, x2, h2, z2);
        pos.push(x1, -80, z1, x2, h2, z2, x1, h1, z1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      return g;
    };
    rand();
    return [build(15000, 300, 1500, 3), build(11000, 120, 650, 9)];
  }, []);
  return (
    <group>
      <mesh geometry={geometries[0]}>
        <meshBasicMaterial color="#b4c1cd" fog={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometries[1]}>
        <meshBasicMaterial color="#a3ad9f" fog={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Ground layers stack a few hundredths of a foot apart (log depth keeps them stable). */
const LAYER_HEIGHT = {
  grass: 0.06,
  gravel: 0.06,
  parkGrass: 0.09,
  parkGravel: 0.09,
  concrete: 0.12,
  driveway: 0.15,
  mulch: 0.17,
  rock: 0.17,
};

const AMENITY_MATERIAL = {
  park: 'parkGrass',
  'open-space': 'gravel',
  pool: 'water',
  pickleball: 'court',
  'future-development': 'dirt',
};

function Ground({ site, layout, surfaces, onGroundClick }) {
  const materials = getGroundMaterials();
  const base = useMemo(() => {
    const [cx, cz] = layout.center;
    const big = 30000;
    return {
      field: polygonsToGeometry([[[cx - big, cz - big], [cx + big, cz - big], [cx + big, cz + big], [cx - big, cz + big]]], -0.6),
      asphalt: polygonsToGeometry([layout.pavedHull], 0),
    };
  }, [layout]);

  const amenities = useMemo(() => {
    const groups = {};
    site.siteAreas.forEach((area) => {
      const key = AMENITY_MATERIAL[area.type];
      if (!key) return;
      (groups[key] ||= []).push(area.polygon);
    });
    return Object.entries(groups).map(([key, polys]) => ({ key, geometry: polygonsToGeometry(polys, 0.07) }));
  }, [site]);

  const layers = useMemo(() => {
    const out = Object.entries(surfaces.polys)
      .filter(([, polys]) => polys.length)
      .map(([key, polys]) => ({ key, geometry: polygonsToGeometry(polys, LAYER_HEIGHT[key] ?? 0.06) }));
    return out;
  }, [surfaces]);

  const curbGeometry = useMemo(() => curbsToGeometry(surfaces.curbs), [surfaces]);
  const fenceGeometry = useMemo(() => (surfaces.fences.length ? fencesToGeometry(surfaces.fences) : null), [surfaces]);

  const commercial = useMemo(
    () => site.lots.filter((lot) => lot.type === 'commercial' && lot.building?.width > 1),
    [site],
  );

  return (
    <group>
      <mesh geometry={base.field} material={materials.field} receiveShadow />
      <mesh
        geometry={base.asphalt}
        material={materials.asphalt}
        receiveShadow
        onClick={(event) => {
          if (event.delta > 5) return;
          onGroundClick?.(event.point);
        }}
      />
      {amenities.map(({ key, geometry }) => (
        <mesh key={key} geometry={geometry} material={materials[key]} receiveShadow />
      ))}
      {layers.map(({ key, geometry }) => (
        <mesh key={key} geometry={geometry} material={materials[key]} receiveShadow />
      ))}
      <mesh geometry={curbGeometry} material={materials.curb} receiveShadow castShadow />
      {fenceGeometry && <mesh geometry={fenceGeometry} material={materials.fence} castShadow receiveShadow />}
      {commercial.map((lot) => {
        const { center, width, depth, rotation } = lot.building;
        return (
          <group key={lot.id} position={[center[0], 0, center[1]]} rotation={[0, rotation, 0]}>
            <mesh position={[0, 11, 0]} material={materials.commercial} castShadow receiveShadow>
              <boxGeometry args={[Math.min(width, 160), 22, Math.min(depth, 90)]} />
            </mesh>
            <mesh position={[0, 22.3, 0]} material={materials.commercialRoof}>
              <boxGeometry args={[Math.min(width, 160) + 1, 0.6, Math.min(depth, 90) + 1]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function SelectedOutline({ lot }) {
  const geometry = useMemo(() => {
    if (!lot) return null;
    const pts = lot.hull.map(([x, z]) => new THREE.Vector3(x, 0.6, z));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [lot]);
  if (!geometry) return null;
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color="#f2c14e" />
    </lineLoop>
  );
}

function sunDirection(yaw, preset) {
  const az = yaw + Math.PI + THREE.MathUtils.degToRad(preset.offset);
  const el = THREE.MathUtils.degToRad(preset.elevation);
  // Behind the viewer's shoulder so facades read front-lit, like marketing renders.
  return new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

function Lighting({ timeOfDay, mode, skyRef, quality }) {
  const preset = TIME_OF_DAY[timeOfDay] || TIME_OF_DAY.afternoon;
  const lightRef = useRef();
  const { camera, scene } = useThree();
  const target = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    scene.add(target);
    return () => scene.remove(target);
  }, [scene, target]);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const yaw = Math.atan2(-forward.x, -forward.z);
    const dir = sunDirection(yaw, preset);
    const ahead = mode === 'overview' ? 0 : 70;
    const focus = camera.position.clone().addScaledVector(new THREE.Vector3(forward.x, 0, forward.z).normalize(), ahead);
    if (mode === 'overview') focus.y = 0;
    focus.y = 0;
    target.position.copy(focus);
    light.target = target;
    light.position.copy(focus).addScaledVector(dir, 900);
    const span = mode === 'overview' ? Math.min(1400, Math.max(300, camera.position.y * 1.6)) : 190;
    const cam = light.shadow.camera;
    if (cam.right !== span) {
      cam.left = -span;
      cam.right = span;
      cam.top = span;
      cam.bottom = -span;
      cam.updateProjectionMatrix();
    }
    if (skyRef.current?.material?.uniforms?.sunPosition) {
      skyRef.current.material.uniforms.sunPosition.value.copy(dir);
    }
  });

  return (
    <>
      <hemisphereLight args={['#dfe9f5', '#6f6a55', quality === 'fast' ? preset.hemi : preset.hemi * 0.7]} />
      <directionalLight
        ref={lightRef}
        color={preset.color}
        intensity={preset.intensity}
        castShadow
        shadow-mapSize={quality === 'fast' ? [1536, 1536] : [4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-near={10}
        shadow-camera-far={2400}
      />
    </>
  );
}

/**
 * Street-level look/walk controls (drag to look, WASD/arrows to move, wheel to
 * change lens) plus animated transitions to camera presets.
 */
function CameraRig({ mode, view, controlsRef, onModeChange }) {
  const { camera, gl } = useThree();
  const st = useRef({ yaw: 0, pitch: 0, keys: {}, anim: null, dragging: false, last: null });

  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useEffect(() => {
    if (!view) return;
    const s = st.current;
    const to = new THREE.Vector3(...view.position);
    const look = new THREE.Vector3(...view.target);
    const dir = look.clone().sub(to).normalize();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    s.anim = {
      t: view.instant ? 1 : 0,
      fromPos: camera.position.clone(),
      toPos: to,
      fromYaw: Math.atan2(-forward.x, -forward.z),
      toYaw: Math.atan2(-dir.x, -dir.z),
      fromPitch: Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)),
      toPitch: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)),
      fromFov: camera.fov,
      toFov: view.fov || camera.fov,
      lookAt: look,
    };
    let dy = s.anim.toYaw - s.anim.fromYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    s.anim.toYaw = s.anim.fromYaw + dy;
  }, [view, camera]);

  // Keys are tracked in every mode: street view walks, aerial view pans.
  useEffect(() => {
    const s = st.current;
    const key = (e, value) => {
      if (e.target.closest?.('input, select, textarea')) return;
      s.keys[e.key.toLowerCase()] = value;
    };
    const kd = (e) => key(e, true);
    const ku = (e) => key(e, false);
    const clear = () => {
      s.keys = {};
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', clear);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'street') return undefined;
    const el = gl.domElement;
    const s = st.current;
    const down = (e) => {
      s.dragging = true;
      s.last = [e.clientX, e.clientY];
    };
    const move = (e) => {
      if (!s.dragging || !s.last) return;
      const dx = e.clientX - s.last[0];
      const dy = e.clientY - s.last[1];
      s.last = [e.clientX, e.clientY];
      const k = 0.0032 * (camera.fov / 60);
      s.yaw += dx * k;
      s.pitch = THREE.MathUtils.clamp(s.pitch + dy * k, -1.2, 1.2);
      s.anim = null;
    };
    const up = () => {
      s.dragging = false;
    };
    const wheel = (e) => {
      e.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + Math.sign(e.deltaY) * 3, 22, 80);
      camera.updateProjectionMatrix();
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [mode, gl, camera]);

  useFrame((_, delta) => {
    const s = st.current;
    const dt = Math.min(delta, 0.1);
    if (s.anim) {
      const a = s.anim;
      a.t = Math.min(1, a.t + dt / 1.1);
      const e = a.t < 1 ? 1 - (1 - a.t) ** 3 : 1;
      camera.position.lerpVectors(a.fromPos, a.toPos, e);
      s.yaw = THREE.MathUtils.lerp(a.fromYaw, a.toYaw, e);
      s.pitch = THREE.MathUtils.lerp(a.fromPitch, a.toPitch, e);
      camera.fov = THREE.MathUtils.lerp(a.fromFov, a.toFov, e);
      camera.updateProjectionMatrix();
      if (mode === 'overview' && controlsRef.current) {
        controlsRef.current.target.copy(a.lookAt);
        camera.lookAt(a.lookAt);
        controlsRef.current.update();
      } else {
        camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
      }
      if (a.t >= 1) s.anim = null;
      return;
    }
    const k = s.keys;
    if (mode !== 'street') {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      s.yaw = Math.atan2(-forward.x, -forward.z);
      s.pitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
      const controls = controlsRef.current;
      if (controls) {
        // Pan across the ground: up/down move toward/away from where the camera
        // faces, left/right slide sideways. Speed scales with how far out you are.
        const dist = camera.position.distanceTo(controls.target);
        const step = dist * (k.shift ? 1.5 : 0.6) * dt;
        const fwd = new THREE.Vector3(forward.x, 0, forward.z);
        if (fwd.lengthSq() < 1e-6) fwd.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
        fwd.normalize();
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const pan = new THREE.Vector3();
        if (k.w || k.arrowup) pan.add(fwd);
        if (k.s || k.arrowdown) pan.sub(fwd);
        if (k.a || k.arrowleft) pan.sub(right);
        if (k.d || k.arrowright) pan.add(right);
        if (pan.lengthSq() > 0) {
          pan.normalize().multiplyScalar(step);
          camera.position.add(pan);
          controls.target.add(pan);
          controls.update();
        }
      }
      return;
    }
    const speed = (k.shift ? 90 : 36) * dt;
    const fwd = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const right = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    if (k.w || k.arrowup) camera.position.addScaledVector(fwd, speed);
    if (k.s || k.arrowdown) camera.position.addScaledVector(fwd, -speed);
    if (k.a) camera.position.addScaledVector(right, -speed);
    if (k.d) camera.position.addScaledVector(right, speed);
    if (k.arrowleft) s.yaw += dt * 1.1;
    if (k.arrowright) s.yaw -= dt * 1.1;
    if (k.r) camera.position.y = Math.min(120, camera.position.y + speed);
    if (k.f) camera.position.y = Math.max(3, camera.position.y - speed);
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
  });

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  return mode === 'overview' ? (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.1}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={30}
      maxDistance={4500}
    />
  ) : null;
}

function CaptureBridge({ apiRef }) {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
  });
  useEffect(() => {
    apiRef.current = {
      /** Resolves after the renderer has drawn `count` more frames. */
      waitFrames(count = 2) {
        const target = frames.current + count;
        return new Promise((resolve) => {
          const check = () => (frames.current >= target ? resolve() : requestAnimationFrame(check));
          check();
        });
      },
      capture(scale = 1) {
        const prev = gl.getPixelRatio();
        if (scale !== 1) gl.setPixelRatio(prev * scale);
        gl.render(scene, camera);
        const url = gl.domElement.toDataURL('image/png');
        if (scale !== 1) gl.setPixelRatio(prev);
        return url;
      },
    };
  }, [gl, scene, camera, apiRef]);
  return null;
}

export default function StreetScene({
  site,
  layout,
  assignments,
  landscape,
  timeOfDay,
  quality = 'high',
  mode,
  view,
  selectedLotId,
  onSelectLot,
  onGroundClick,
  captureRef,
}) {
  const controlsRef = useRef();
  const skyRef = useRef();
  const backdrop = useMemo(() => generateBackdropTrees(layout), [layout]);
  const preset = TIME_OF_DAY[timeOfDay] || TIME_OF_DAY.afternoon;
  const selectedLot = selectedLotId ? layout.byId.get(selectedLotId) : null;

  return (
    <Canvas
      key={quality}
      shadows
      dpr={quality === 'fast' ? 1 : [1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      camera={{ fov: 55, near: 0.5, far: 40000, position: [0, 6, 0] }}
      onPointerMissed={() => {}}
    >
      <Suspense fallback={null}>
        <Sky ref={skyRef} distance={45000} sunPosition={[1, 0.4, 0.3]} turbidity={5} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.8} />
        {quality !== 'fast' && (
          <Environment frames={1} resolution={128} environmentIntensity={0.3}>
            <Sky distance={45000} sunPosition={[1, 0.6, 0.4]} turbidity={5} rayleigh={1.2} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
              <planeGeometry args={[100000, 100000]} />
              <meshBasicMaterial color="#8c8a70" />
            </mesh>
          </Environment>
        )}
        <fog attach="fog" args={[preset.fog, mode === 'overview' ? 3500 : 900, mode === 'overview' ? 16000 : 7000]} />
        <Lighting timeOfDay={timeOfDay} mode={mode} skyRef={skyRef} quality={quality} />
        <Mountains />
        <Ground site={site} layout={layout} surfaces={landscape.surfaces} onGroundClick={onGroundClick} />
        <HouseInstances layout={layout} assignments={assignments} onSelectLot={onSelectLot} />
        <PlantInstances plants={landscape.plants} />
        <PlantInstances plants={backdrop} castShadow={false} />
        <SelectedOutline lot={selectedLot} />
        <CameraRig mode={mode} view={view} controlsRef={controlsRef} />
        <CaptureBridge apiRef={captureRef} />
      </Suspense>
    </Canvas>
  );
}
