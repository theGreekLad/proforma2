# Photoreal CrossMod renders

Path-traced (Blender Cycles) versions of the CrossMod studio views shown on
the Layouts page. The houses are the same plan-accurate models the site uses
(`web-3d/src/streetscape/houseModels.js`); only materials, lighting and
vegetation change.

```
export-scenes.mjs    three.js models + lot + plants + cameras  →  scenes/<model>.json
render_photoreal.py  builds each scene in Blender and renders front / rear / aerial / elevation
materials.py         procedural PBR materials (lap vinyl, shake, shingles, brick, concrete, …)
vegetation.py        grass, shrubs, flowers and trees (Geometry Nodes instancing)
```

## Regenerate

1. Export the scenes (camera framing matches `crossmod-render.html`):

   ```bash
   cd web-3d && npx vite-node ../scripts/photoreal/export-scenes.mjs ../scripts/photoreal/scenes
   ```

2. Install Blender as a Python module (bpy 5.2 needs Python 3.13):

   ```bash
   python3.13 -m venv .bpy && .bpy/bin/pip install bpy
   ```

3. Render (about 8 minutes per 2400×1350 image on 4 CPU cores):

   ```bash
   .bpy/bin/python scripts/photoreal/render_photoreal.py scripts/photoreal/scenes \
     web-3d/public/building-assets/crossmod-photoreal --samples 64
   ```

   `--models hawthorne,aspen` and `--views front,rear` limit the batch.
   Environment knobs: `PR_SKY` (sky light, default 0.08), `PR_SUN` (sun, 5.5),
   `PR_DETAIL` (vegetation density, 1.0), `PR_CLOUDS` (`1`/`0`).

The sun is placed for raking light (mirrored across the facade from the
camera) so eaves, porches and garages cast visible shadows.
