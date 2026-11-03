/**
 * Export CrossMod studio scenes (geometry, materials keys, lot, plants,
 * cameras) to JSON for the photoreal Blender renderer.
 *
 *   cd web-3d && npx vite-node ../scripts/photoreal/export-scenes.mjs <outDir> [model,...]
 *
 * Coordinates are three.js feet (Y up, +Z toward the street); the Blender
 * script converts them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getModelGeometries } from '../../web-3d/src/streetscape/houseBuilder.js';
import { HOUSE_MODELS } from '../../web-3d/src/streetscape/houseModels.js';
import { computeStudioSpec } from '../../web-3d/src/streetscape/studioSpec.js';

const outDir = path.resolve(process.argv[2] || 'photoreal-scenes');
const only = process.argv[3] ? process.argv[3].split(',') : HOUSE_MODELS.map((m) => m.id);
fs.mkdirSync(outDir, { recursive: true });

const round = (arr, digits = 3) => Array.from(arr, (v) => Number(v.toFixed(digits)));

for (const id of only) {
  const spec = computeStudioSpec({ modelId: id, landscape: 'lush', aspect: 16 / 9 });
  const house = {};
  getModelGeometries(id, spec.mirror).forEach((geometry, key) => {
    house[key] = {
      pos: round(geometry.getAttribute('position').array),
      uv: round(geometry.getAttribute('uv').array),
    };
  });
  // Ground-floor footprint rectangles (masses, porch, decks) in world XZ, for masking grass.
  const W = spec.model.width;
  const [ox, oz] = spec.placement.origin;
  const rect = ({ x0, x1, d0, d1 }) => {
    let X0 = x0 - W / 2;
    let X1 = x1 - W / 2;
    if (spec.mirror) [X0, X1] = [-X1, -X0];
    return [[ox + X0, oz - d1], [ox + X1, oz - d1], [ox + X1, oz - d0], [ox + X0, oz - d0]];
  };
  const footprints = [
    ...spec.model.masses.map(rect),
    ...(spec.model.porch ? [rect({ ...spec.model.porch, d0: spec.model.porch.d0 - (spec.model.porch.steps?.count ?? 0) })] : []),
    ...(spec.model.decks || []).map(rect),
  ];
  const scene = {
    id,
    footprints,
    name: spec.model.name,
    width: spec.model.width,
    palette: spec.palette,
    origin: spec.placement.origin,
    frontageZ: spec.placement.frontageZ,
    houseBox: { min: spec.houseBox.min.toArray(), max: spec.houseBox.max.toArray() },
    house,
    ground: spec.ground,
    surfaces: spec.landscape.surfaces.polys,
    curbs: spec.landscape.surfaces.curbs,
    plants: spec.landscape.plants,
    backdrop: spec.backdrop,
    views: Object.fromEntries(Object.entries(spec.views).map(([view, v]) => [view, { camera: v.camera, sun: v.sun }])),
  };
  const file = path.join(outDir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(scene));
  console.log(`${id}: ${Object.keys(house).length} material groups, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB → ${file}`);
}
