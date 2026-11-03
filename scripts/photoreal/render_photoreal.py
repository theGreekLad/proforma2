"""Photoreal CrossMod renders with Blender Cycles.

Builds each home from the JSON exported by export-scenes.mjs (the same
plan-accurate geometry used on the site), dresses it with procedural
photographic materials, grass, shrubs, flowers and trees, lights it with a
physical sky + sun and path-traces the studio views.

    python render_photoreal.py <scenes_dir> <out_dir> [--models a,b] [--views front,rear]
        [--width 2400] [--height 1350] [--samples 128]

Requires the `bpy` module (pip install bpy).
"""

import argparse
import json
import math
import os
import random
import sys

import bpy  # noqa: I001 - bpy must load before bmesh/mathutils
import bmesh
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import vegetation  # noqa: E402
import materials as M  # noqa: E402


def to_b(p):
    """three.js (Y up, +Z toward street) → Blender (Z up)."""
    x, y, z = p
    return Vector((x, -z, y))


def point_in_poly(x, z, poly):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, zi = poly[i]
        xj, zj = poly[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'NONE'
    return scene


def link(obj, collection=None):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_from_triangles(name, positions, uvs, material):
    """Non-indexed triangle soup in three.js coords → Blender mesh object."""
    pos = np.asarray(positions, dtype=np.float64).reshape(-1, 3)
    verts = [tuple(to_b(p)) for p in pos]
    faces = [(i, i + 1, i + 2) for i in range(0, len(verts), 3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name='UVMap')
    uv = np.asarray(uvs, dtype=np.float32).reshape(-1, 2)
    # Loops are in vertex order for this triangle soup.
    loop_vi = np.zeros(len(mesh.loops), dtype=np.int32)
    mesh.loops.foreach_get('vertex_index', loop_vi)
    uv_layer.data.foreach_set('uv', uv[loop_vi].ravel())
    for poly in mesh.polygons:
        poly.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(material)
    return obj


def polygon_object(name, polys, height, material, collection=None):
    """Flat ground polygons (three XZ) at a given height."""
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    for index, poly in enumerate(polys):
        if len(poly) < 3:
            continue
        # Overlapping coplanar faces in one mesh render black in Cycles; lift each a hair.
        h = height + index * 0.002
        verts = [bm.verts.new((x, -z, h)) for x, z in poly]
        try:
            face = bm.faces.new(verts)
        except ValueError:
            continue
        for loop in face.loops:
            co = loop.vert.co
            loop[uv_layer].uv = (co.x, co.y)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for face in bm.faces:
        if face.normal.z < 0:
            face.normal_flip()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(material)
    return link(obj, collection)


def curb_object(curbs, material):
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    w = 0.8
    for c in curbs:
        (ax, az), (bx, bz), (nx, nz), h = c['a'], c['b'], c['n'], c['height']
        a1 = (ax + nx * w, az + nz * w)
        b1 = (bx + nx * w, bz + nz * w)
        pts = [(ax, az, 0), (bx, bz, 0), (b1[0], b1[1], 0), (a1[0], a1[1], 0)]
        bottom = [bm.verts.new((x, -z, 0)) for x, z, _ in pts]
        top = [bm.verts.new((x, -z, h)) for x, z, _ in pts]
        faces = [top, [bottom[3], bottom[2], top[2], top[3]], [bottom[0], bottom[1], top[1], top[0]],
                 [bottom[1], bottom[2], top[2], top[1]], [bottom[3], bottom[0], top[0], top[3]]]
        for f in faces:
            try:
                face = bm.faces.new(f)
                for loop in face.loops:
                    co = loop.vert.co
                    loop[uv_layer].uv = (co.x + co.z, co.y + co.z)
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new('curbs')
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('curbs', mesh)
    obj.data.materials.append(material)
    return link(obj)


def mountains(material):
    rng = random.Random(3)
    bm = bmesh.new()
    for radius, lo, hi, seed in ((15000, 300, 1500, 3), (11000, 120, 650, 9)):
        r = random.Random(seed)
        segs = 160
        ring = []
        for i in range(segs):
            a = i / segs * math.tau
            h = lo + (math.sin(a * 3 + seed) * 0.5 + 0.5) * (hi - lo) * 0.6 + r.random() * (hi - lo) * 0.4
            ring.append((math.cos(a) * radius, math.sin(a) * radius, h))
        for i in range(segs):
            x1, y1, h1 = ring[i]
            x2, y2, h2 = ring[(i + 1) % segs]
            vs = [bm.verts.new(v) for v in ((x1, y1, -80), (x2, y2, -80), (x2, y2, h2), (x1, y1, h1))]
            bm.faces.new(vs)
    rng.random()
    mesh = bpy.data.meshes.new('mountains')
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('mountains', mesh)
    obj.data.materials.append(material)
    obj.visible_shadow = False
    return link(obj)


SKY_STRENGTH = float(os.environ.get('PR_SKY', 0.08))
SUN_STRENGTH = float(os.environ.get('PR_SUN', 5.5))
DETAIL = float(os.environ.get('PR_DETAIL', 1.0))
CLOUDS = os.environ.get('PR_CLOUDS', '1') == '1'

LAYER_HEIGHT = {
    'grass': 0.04, 'gravel': 0.04, 'parkGrass': 0.06, 'parkGravel': 0.06,
    'concrete': 0.12, 'driveway': 0.15, 'mulch': 0.17, 'rock': 0.17,
}


def setup_world(sun_dir):
    """Physical sky for ambient light + a sun lamp for crisp direct light."""
    world = bpy.data.worlds.new('Sky')
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'MULTIPLE_SCATTERING'
    d = to_b(sun_dir).normalized()
    elevation = math.asin(max(-1.0, min(1.0, d.z)))
    rotation = math.atan2(d.x, d.y)
    sky.sun_elevation = elevation
    sky.sun_rotation = -rotation + math.pi
    sky.sun_disc = False
    for attr, value in (('altitude', 1400.0), ('air_density', 1.0), ('aerosol_density', 1.2), ('ozone_density', 1.0)):
        if hasattr(sky, attr):
            setattr(sky, attr, value)
    bg.inputs['Strength'].default_value = SKY_STRENGTH
    sky_color = sky.outputs['Color']
    if CLOUDS:
        # Soft cumulus: noise projected on the sky dome, faded toward the horizon.
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['Generated'], sep.inputs[0])

        def m(op, a, b):
            node = nt.nodes.new('ShaderNodeMath')
            node.operation = op
            for i, x in enumerate((a, b)):
                if isinstance(x, (int, float)):
                    node.inputs[i].default_value = x
                else:
                    nt.links.new(x, node.inputs[i])
            return node.outputs[0]
        zc = m('MAXIMUM', sep.outputs[2], 0.04)
        uv = nt.nodes.new('ShaderNodeCombineXYZ')
        nt.links.new(m('DIVIDE', sep.outputs[0], zc), uv.inputs[0])
        nt.links.new(m('DIVIDE', sep.outputs[1], zc), uv.inputs[1])
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 0.55
        noise.inputs['Detail'].default_value = 8.0
        noise.inputs['Roughness'].default_value = 0.62
        nt.links.new(uv.outputs[0], noise.inputs['Vector'])
        shape = nt.nodes.new('ShaderNodeMapRange')
        shape.inputs['From Min'].default_value = 0.56
        shape.inputs['From Max'].default_value = 0.74
        nt.links.new(noise.outputs['Fac'], shape.inputs['Value'])
        fade = nt.nodes.new('ShaderNodeMapRange')
        fade.inputs['From Min'].default_value = 0.03
        fade.inputs['From Max'].default_value = 0.3
        nt.links.new(sep.outputs[2], fade.inputs['Value'])
        mask = m('MULTIPLY', m('MULTIPLY', shape.outputs['Result'], fade.outputs['Result']), 0.85)
        lum = nt.nodes.new('ShaderNodeRGBToBW')
        nt.links.new(sky_color, lum.inputs[0])
        white = nt.nodes.new('ShaderNodeCombineColor')
        bright = m('MULTIPLY', lum.outputs[0], 1.9)
        for i in range(3):
            nt.links.new(bright, white.inputs[i])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        nt.links.new(mask, mix.inputs['Factor'])
        nt.links.new(sky_color, mix.inputs[6])
        nt.links.new(white.outputs[0], mix.inputs[7])
        sky_color = mix.outputs[2]
    nt.links.new(sky_color, bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

    light = bpy.data.lights.new('Sun', 'SUN')
    light.energy = SUN_STRENGTH
    light.angle = math.radians(0.6)
    light.color = (1.0, 0.95, 0.88)
    sun = bpy.data.objects.new('Sun', light)
    sun.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    link(sun)
    return sky


def photoreal_sun(view):
    """Raking light: mirror the camera across the facade so eaves and porches cast visible shadows."""
    cam = view['camera']
    if cam['type'] == 'orthographic':
        d = Vector((-0.55, 0.0, 0.75))
    else:
        px, _, pz = cam['position']
        tx, _, tz = cam['target']
        d = Vector((-(px - tx), 0.0, pz - tz))
    d.normalize()
    elevation = math.radians(38)
    return (d.x * math.cos(elevation), math.sin(elevation), d.z * math.cos(elevation))


def setup_camera(view):
    cam_spec = view['camera']
    cam_data = bpy.data.cameras.new('Camera')
    cam = bpy.data.objects.new('Camera', cam_data)
    link(cam)
    pos = to_b(cam_spec['position'])
    target = to_b(cam_spec['target'])
    cam.location = pos
    cam.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
    if cam_spec['type'] == 'orthographic':
        cam_data.type = 'ORTHO'
        cam_data.sensor_fit = 'HORIZONTAL'
        cam_data.ortho_scale = cam_spec['width']
    else:
        cam_data.sensor_fit = 'VERTICAL'
        cam_data.angle_y = math.radians(cam_spec['fov'])
    cam_data.clip_start = 0.3
    cam_data.clip_end = 60000
    bpy.context.scene.camera = cam
    return cam


def build_house(scene_data):
    pal = scene_data['palette']
    mats = M.house_materials(pal)
    ox, oz = scene_data['origin']
    objs = []
    for key, geo in scene_data['house'].items():
        material = mats.get(key) or mats['trim']
        obj = mesh_from_triangles(f'house_{key}', geo['pos'], geo['uv'], material)
        obj.location = (ox, -oz, 0)
        link(obj)
        objs.append(obj)
    return objs


def build_ground(scene_data, ortho):
    mats = M.ground_materials()
    for item in scene_data['ground']['polys']:
        polygon_object(f"ground_{item['key']}", [item['poly']], item['y'], mats[item['key']])
    far = 30000
    polygon_object('field', [[[-far, -far], [far, -far], [far, far], [-far, far]]], -0.5, mats['field'])
    for key, polys in scene_data['surfaces'].items():
        if polys:
            polygon_object(f'surface_{key}', polys, LAYER_HEIGHT.get(key, 0.05), mats.get(key, mats['grass']))
    curb_object(scene_data['curbs'], mats['concrete'])
    if not ortho:
        mountains(mats['mountain'])


def lawn_mask_fn(scene_data):
    """True where a point (three XZ) is planted lawn (no paving, beds or house)."""
    grass_polys = [p['poly'] for p in scene_data['ground']['polys'] if p['key'] == 'grass']
    grass_polys += scene_data['surfaces'].get('grass', []) + scene_data['surfaces'].get('parkGrass', [])
    blocked = []
    for key in ('concrete', 'driveway', 'mulch', 'rock'):
        blocked += scene_data['surfaces'].get(key, [])
    blocked += [p['poly'] for p in scene_data['ground']['polys'] if p['key'] in ('asphalt', 'concrete')]
    blocked += scene_data.get('footprints', [])

    def fn(x, z):
        if not any(point_in_poly(x, z, p) for p in grass_polys):
            return False
        return not any(point_in_poly(x, z, p) for p in blocked)

    return fn


def configure_render(width, height, samples, transparent=False):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    cy = scene.cycles
    cy.device = 'CPU'
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.015
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.max_bounces = 8
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 3
    cy.transmission_bounces = 6
    cy.transparent_max_bounces = 24
    cy.sample_clamp_indirect = 8.0
    cy.blur_glossy = 1.0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.use_persistent_data = True
    vs = scene.view_settings
    vs.view_transform = 'AgX'
    try:
        vs.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    vs.exposure = 0.0
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 90


def render_scene(scene_data, views, out_dir, width, height, samples):
    for view_id in views:
        view = scene_data['views'][view_id]
        ortho = view['camera']['type'] == 'orthographic'
        reset_scene()
        configure_render(width, height, samples)
        setup_world(photoreal_sun(view))
        build_house(scene_data)
        build_ground(scene_data, ortho)
        vegetation.dress(scene_data, view, ortho, lawn_mask_fn(scene_data), to_b, DETAIL)
        if ortho:
            M.elevation_backdrop(scene_data, view, to_b)
        setup_camera(view)
        out = os.path.join(out_dir, f"{scene_data['id']}-{view_id}.jpg")
        bpy.context.scene.render.filepath = out
        bpy.ops.render.render(write_still=True)
        print(f"rendered {out}", flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument('scenes')
    parser.add_argument('out')
    parser.add_argument('--models', default='hawthorne,aspen,belmont,keeneland,magnolia')
    parser.add_argument('--views', default='front,elevation,rear,aerial')
    parser.add_argument('--width', type=int, default=2400)
    parser.add_argument('--height', type=int, default=1350)
    parser.add_argument('--samples', type=int, default=128)
    args = parser.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)
    for model in args.models.split(','):
        with open(os.path.join(args.scenes, f'{model}.json')) as f:
            scene_data = json.load(f)
        render_scene(scene_data, args.views.split(','), args.out, args.width, args.height, args.samples)


if __name__ == '__main__':
    main()
