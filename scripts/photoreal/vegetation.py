"""Procedural vegetation for the photoreal renders.

Plant positions come from the site's landscaping generator (same beds and
plant list as the model renders). Each plant type maps to a "master" built
from instanced leaf cards over a dark core, reused through collection
instances. Lawns get particle-hair grass masked to planted areas.
"""

import math
import random

import bpy  # noqa: I001
import bmesh
import numpy as np
from mathutils import Vector

import materials as M


# --- textures ---------------------------------------------------------------

def _rgba_image(name, arr):
    h, w, _ = arr.shape
    img = bpy.data.images.new(name, w, h, alpha=True, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    img.update()
    img.alpha_mode = 'STRAIGHT'
    return img


def leaf_mask(shape='ellipse', size=128):
    yy, xx = np.mgrid[0:size, 0:size] / (size - 1)
    x = (xx - 0.5) * 2
    y = yy
    arr = np.zeros((size, size, 4), dtype=np.float32)
    if shape == 'petal':
        r = np.hypot(x * 1.6, (y - 0.55) * 2.2)
        alpha = (r < 1).astype(np.float32)
    elif shape == 'needle':
        width = 0.18 * np.sin(np.clip(y, 0, 1) * np.pi)
        alpha = (np.abs(x) < width).astype(np.float32)
    else:
        width = 0.85 * np.sin(np.clip(y, 0, 1) * np.pi) ** 0.8
        alpha = (np.abs(x) < width).astype(np.float32)
    vein = np.clip(1 - np.abs(x) * 25, 0, 1) * 0.25
    shade = 0.75 + 0.25 * y - vein
    arr[..., 0] = shade
    arr[..., 1] = shade
    arr[..., 2] = shade
    arr[..., 3] = alpha
    return arr


_IMAGES = {}


def leaf_image(shape):
    if shape not in _IMAGES:
        _IMAGES[shape] = _rgba_image(f'leaf_{shape}', leaf_mask(shape))
    return _IMAGES[shape]


# --- materials --------------------------------------------------------------

def foliage_material(name, color, shape='ellipse', variation=0.25, translucency=0.35, roughness=0.55):
    g = M.Graph(name)
    tex = g.node('ShaderNodeTexImage', image=leaf_image(shape))
    uvn = g.node('ShaderNodeTexCoord')
    g.link(uvn.outputs['UV'], tex.inputs['Vector'])
    info = g.node('ShaderNodeObjectInfo')
    hue = g.node('ShaderNodeHueSaturation')
    hue.inputs['Hue'].default_value = 0.5
    g.link(g.math('MULTIPLY_ADD', info.outputs['Random'], variation * 0.12, 0.5 - variation * 0.06), hue.inputs['Hue'])
    g.link(g.math('MULTIPLY_ADD', info.outputs['Random'], variation * 0.8, 1 - variation * 0.4), hue.inputs['Value'])
    hue.inputs['Color'].default_value = color
    shade = g.node('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    shade.inputs['Factor'].default_value = 1.0
    g.link(hue.outputs['Color'], shade.inputs[6])
    g.link(tex.outputs['Color'], shade.inputs[7])
    g.set('Base Color', shade.outputs[2])
    g.set('Roughness', roughness)
    g.set('Subsurface Weight', 0.0)
    g.set('Transmission Weight', 0.0)
    g.set('Alpha', 1.0)
    g.link(tex.outputs['Alpha'], g.bsdf.inputs['Alpha'])
    # Thin-leaf translucency: mix a translucent lobe behind the principled one.
    trans = g.node('ShaderNodeBsdfTranslucent')
    g.link(shade.outputs[2], trans.inputs['Color'])
    mix = g.node('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = translucency
    g.link(g.bsdf.outputs[0], mix.inputs[1])
    g.link(trans.outputs[0], mix.inputs[2])
    transparent = g.node('ShaderNodeBsdfTransparent')
    cut = g.node('ShaderNodeMixShader')
    g.link(tex.outputs['Alpha'], cut.inputs['Fac'])
    g.link(transparent.outputs[0], cut.inputs[1])
    g.link(mix.outputs[0], cut.inputs[2])
    g.link(cut.outputs[0], g.out.inputs['Surface'])
    return g.mat


def flat_material(name, color, roughness=0.8):
    g = M.Graph(name)
    g.set('Base Color', color)
    g.set('Roughness', roughness)
    return g.mat


def bark_material():
    g = M.Graph('bark')
    uvv, u, v = g.uv()
    n = g.noise(g.combine(g.math('MULTIPLY', u, 6.0), g.math('MULTIPLY', v, 0.8)), 3.0, 6.0, 0.6)
    g.set('Base Color', g.mix_color(n.outputs['Fac'], (0.05, 0.035, 0.025, 1), (0.16, 0.12, 0.09, 1)))
    g.set('Roughness', 0.95)
    g.set('Normal', g.bump(n.outputs['Fac'], 1.0, 0.15))
    return g.mat


# --- geometry helpers ---------------------------------------------------------

def card_object(name, material, width=1.0, length=1.0):
    """Leaf card: unit quad from the origin along +Y (stem at origin)."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(-width / 2, 0, 0), (width / 2, 0, 0), (width / 2, length, 0), (-width / 2, length, 0)], [], [(0, 1, 2, 3)])
    uv = mesh.uv_layers.new(name='UVMap')
    for i, loop in enumerate(mesh.loops):
        uv.data[i].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][loop.vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(material)
    return obj


def blob_mesh(name, radius=(1, 1, 1), center=(0, 0, 0), subdiv=3, jitter=0.18, seed=1, cone=False):
    bm = bmesh.new()
    if cone:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=1.0, radius2=0.0, depth=1.0)
        for v in bm.verts:
            v.co.z += 0.5
    else:
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    rng = random.Random(seed)
    cache = {}
    for v in bm.verts:
        key = (round(v.co.x, 3), round(v.co.y, 3), round(v.co.z, 3))
        f = cache.setdefault(key, 1 + (rng.random() - 0.5) * jitter)
        v.co = Vector((v.co.x * radius[0] * f + center[0], v.co.y * radius[1] * f + center[1], v.co.z * radius[2] * f + center[2]))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def scatter_group(name, instance_obj, density, scale_range, rotation_min, rotation_max, density_attr=None, seed=0):
    """Geometry Nodes: scatter instances of an object over the mesh surface."""
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nodes, links = ng.nodes, ng.links
    gin = nodes.new('NodeGroupInput')
    gout = nodes.new('NodeGroupOutput')
    dist = nodes.new('GeometryNodeDistributePointsOnFaces')
    dist.inputs['Seed'].default_value = seed
    if density_attr:
        attr = nodes.new('GeometryNodeInputNamedAttribute')
        attr.data_type = 'FLOAT'
        attr.inputs['Name'].default_value = density_attr
        mul = nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        mul.inputs[1].default_value = density
        links.new(attr.outputs['Attribute'], mul.inputs[0])
        links.new(mul.outputs[0], dist.inputs['Density'])
    else:
        dist.inputs['Density'].default_value = density
    info = nodes.new('GeometryNodeObjectInfo')
    info.inputs['Object'].default_value = instance_obj
    inst = nodes.new('GeometryNodeInstanceOnPoints')
    rot = nodes.new('FunctionNodeRandomValue')
    rot.data_type = 'FLOAT_VECTOR'
    vec_in = [sock for sock in rot.inputs if sock.type == 'VECTOR' and sock.name in ('Min', 'Max')]
    vec_in[0].default_value = rotation_min
    vec_in[1].default_value = rotation_max
    rot.inputs['Seed'].default_value = seed + 1
    scl = nodes.new('FunctionNodeRandomValue')
    scl.data_type = 'FLOAT'
    float_in = [sock for sock in scl.inputs if sock.type == 'VALUE' and sock.name in ('Min', 'Max')]
    float_in[0].default_value = scale_range[0]
    float_in[1].default_value = scale_range[1]
    scl.inputs['Seed'].default_value = seed + 2
    scl_out = next(sock for sock in scl.outputs if sock.type == 'VALUE')
    links.new(gin.outputs[0], dist.inputs['Mesh'])
    links.new(dist.outputs['Points'], inst.inputs['Points'])
    links.new(info.outputs['Geometry'], inst.inputs['Instance'])
    links.new(next(sock for sock in rot.outputs if sock.type == 'VECTOR'), inst.inputs['Rotation'])
    links.new(scl_out, inst.inputs['Scale'])
    links.new(inst.outputs['Instances'], gout.inputs[0])
    return ng


def mesh_area(mesh):
    return sum(p.area for p in mesh.polygons)


def foliage_master(name, collection, leaf_mat, core_color, count, leaf_size, radius=(1, 1, 0.85),
                   center=(0, 0, 0.7), shape_cone=False, size_random=0.4, seed=1, leaf_length=1.6, emit='FACE'):
    """Leaf cards scattered over a jittered shell, around a dark core (Geometry Nodes)."""
    core_mesh = blob_mesh(f'{name}_core', tuple(r * 0.82 for r in radius), center, 2, 0.25, seed, cone=shape_cone)
    core = bpy.data.objects.new(f'{name}_core', core_mesh)
    core.data.materials.append(flat_material(f'{name}_core_mat', core_color, 0.9))
    collection.objects.link(core)

    shells = [(1.0, 0.75), (0.9, 0.25)]  # outer shell carries most leaves, an inner one adds depth
    leaf = card_object(f'{name}_leaf', leaf_mat, 1.0, leaf_length)
    for i, (k, share) in enumerate(shells):
        mesh = blob_mesh(f'{name}_shell{i}', tuple(r * k for r in radius), center, 3, 0.22, seed + 1 + i, cone=shape_cone)
        shell = bpy.data.objects.new(f'{name}_shell{i}', mesh)
        collection.objects.link(shell)
        density = count * share / max(mesh_area(mesh), 1e-3)
        ng = scatter_group(f'{name}_scatter{i}', leaf, density, (leaf_size * (1 - size_random), leaf_size * (1 + size_random)),
                           (0, 0, 0), (6.283, 6.283, 6.283), seed=seed * 10 + i)
        shell.modifiers.new('leaves', 'NODES').node_group = ng
    return core


def collection_instance(name, coll, location, scale, rot_z=0.0, parent_coll=None):
    empty = bpy.data.objects.new(name, None)
    empty.instance_type = 'COLLECTION'
    empty.instance_collection = coll
    empty.location = location
    empty.scale = scale
    empty.rotation_euler = (0, 0, rot_z)
    (parent_coll or bpy.context.scene.collection).objects.link(empty)
    return empty


def hex_to_rgb(value):
    return ((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255


def lin(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


# --- masters -----------------------------------------------------------------

def build_masters(detail):
    lib = {}

    def coll(name):
        c = bpy.data.collections.new(name)
        lib[name] = c
        return c

    k = detail
    foliage_master('boxwood', coll('boxwood'), foliage_material('boxwood_leaf', lin((0.17, 0.3, 0.12)), roughness=0.45),
                   lin((0.05, 0.1, 0.035)), int(9000 * k), 0.075, seed=2, leaf_length=1.5)
    foliage_master('shrub', coll('shrub'), foliage_material('shrub_leaf', lin((0.24, 0.4, 0.15))),
                   lin((0.07, 0.13, 0.04)), int(5500 * k), 0.13, seed=3)
    foliage_master('loropetalum', coll('loropetalum'), foliage_material('loro_leaf', lin((0.36, 0.13, 0.17)), variation=0.18),
                   lin((0.12, 0.04, 0.05)), int(7000 * k), 0.09, seed=4)
    foliage_master('hydrangea', coll('hydrangea'), foliage_material('hydrangea_leaf', lin((0.22, 0.38, 0.13))),
                   lin((0.07, 0.13, 0.04)), int(4200 * k), 0.17, seed=5, leaf_length=1.3)
    for cname, rgb in (('bloom_blue', (0.48, 0.58, 0.86)), ('bloom_white', (0.93, 0.94, 0.9)),
                       ('bloom_pink', (0.85, 0.34, 0.5)), ('bloom_purple', (0.62, 0.3, 0.66)),
                       ('bloom_orange', (0.92, 0.6, 0.2)), ('bloom_red', (0.78, 0.18, 0.24))):
        foliage_master(cname, coll(cname), foliage_material(f'{cname}_petal', lin(rgb), 'petal', variation=0.12, translucency=0.25, roughness=0.6),
                       lin(tuple(c * 0.55 for c in rgb)), int(700 * k), 0.16, radius=(1, 1, 0.8), center=(0, 0, 0),
                       seed=6, leaf_length=1.0, emit='FACE')
    foliage_master('juniper', coll('juniper'), foliage_material('juniper_needle', lin((0.12, 0.22, 0.12)), 'needle', roughness=0.6),
                   lin((0.03, 0.06, 0.03)), int(9000 * k), 0.05, radius=(0.5, 0.5, 1.0), center=(0, 0, 0), shape_cone=True,
                   seed=7, leaf_length=2.4)
    foliage_master('canopy', coll('canopy'), foliage_material('canopy_leaf', lin((0.26, 0.42, 0.15)), variation=0.35),
                   lin((0.07, 0.13, 0.04)), int(26000 * k), 0.05, radius=(1, 1, 1), center=(0, 0, 0), seed=8, leaf_length=1.4)
    foliage_master('fir', coll('fir'), foliage_material('fir_needle', lin((0.08, 0.16, 0.08)), 'needle', roughness=0.65),
                   lin((0.04, 0.08, 0.035)), int(20000 * k), 0.028, radius=(0.5, 0.5, 1.0), center=(0, 0, 0), shape_cone=True,
                   seed=9, leaf_length=2.5)

    trunk_coll = coll('trunk')
    cyl = bmesh.new()
    bmesh.ops.create_cone(cyl, cap_ends=False, segments=10, radius1=1.0, radius2=0.7, depth=1.0)
    uv_layer = cyl.loops.layers.uv.new('UVMap')
    for face in cyl.faces:
        for loop in face.loops:
            co = loop.vert.co
            loop[uv_layer].uv = (math.atan2(co.y, co.x) / math.tau * 4, co.z + 0.5)
    for v in cyl.verts:
        v.co.z += 0.5
    mesh = bpy.data.meshes.new('trunk')
    cyl.to_mesh(mesh)
    cyl.free()
    trunk = bpy.data.objects.new('trunk', mesh)
    trunk.data.materials.append(bark_material())
    trunk_coll.objects.link(trunk)
    return lib


def classify_shrub(color):
    r, g, b = hex_to_rgb(color)
    if r > g * 0.95:
        return 'loropetalum'
    if g < 0.3 and r < 0.2:
        return 'boxwood'
    if abs(r - 0.24) < 0.04 and g > 0.38:
        return 'hydrangea'
    return 'shrub'


def classify_bloom(color):
    r, g, b = hex_to_rgb(color)
    if b > r and b > g:
        return 'bloom_blue'
    if r > 0.85 and g > 0.85 and b > 0.85:
        return 'bloom_white'
    if r > 0.8 and g > 0.5 and b < 0.35:
        return 'bloom_orange'
    if b > 0.55 and r < 0.8:
        return 'bloom_purple'
    if g < 0.3:
        return 'bloom_red'
    return 'bloom_pink'


def place_plants(lib, plants, to_b, collection):
    rng = random.Random(11)
    for i, p in enumerate(plants.get('shrub', [])):
        kind = classify_shrub(p['color'])
        loc = to_b((p['x'], p['y'], p['z']))
        collection_instance(f'shrub{i}', lib[kind], loc, (p['sx'], p['sz'], p['sy']), p.get('rot', 0), collection)
    for i, p in enumerate(plants.get('bloom', [])):
        kind = classify_bloom(p['color'])
        loc = to_b((p['x'], p['y'], p['z']))
        s = (p['sx'] * 1.15, p['sz'] * 1.15, p['sy'] * 1.15)
        collection_instance(f'bloom{i}', lib[kind], loc, s, rng.random() * 6, collection)
    for i, p in enumerate(plants.get('conifer', [])):
        name = 'fir' if p['sy'] > 20 else 'juniper'
        collection_instance(f'conifer{i}', lib[name], to_b((p['x'], 0, p['z'])), (p['sx'], p['sz'], p['sy']), p.get('rot', 0), collection)
    for i, p in enumerate(plants.get('canopy', [])):
        collection_instance(f'canopy{i}', lib['canopy'], to_b((p['x'], p['y'], p['z'])), (p['sx'], p['sz'], p['sy']), p.get('rot', 0), collection)
    for i, p in enumerate(plants.get('trunk', [])):
        collection_instance(f'trunk{i}', lib['trunk'], to_b((p['x'], 0, p['z'])), (p['sx'], p['sz'], p['sy'] * 1.3), p.get('rot', 0), collection)


# --- lawn ----------------------------------------------------------------------

def grass_clump(material, seed=0):
    """Seven curved, tapered blades rooted at the origin (local Z = height)."""
    rng = random.Random(seed)
    bm = bmesh.new()
    for _ in range(7):
        az = rng.random() * math.tau
        lean = 0.08 + rng.random() * 0.22
        height = 0.15 + rng.random() * 0.11  # mown lawn, ~2-3"
        width = 0.016 + rng.random() * 0.008
        ox, oy = (rng.random() - 0.5) * 0.08, (rng.random() - 0.5) * 0.08
        dx, dy = math.cos(az), math.sin(az)
        px, py = -dy, dx
        segs = 3
        prev = None
        for k in range(segs + 1):
            t = k / segs
            bend = lean * t * t * height
            cx, cy, cz = ox + dx * bend, oy + dy * bend, height * t
            w = width * (1 - t) + 0.002
            left = bm.verts.new((cx - px * w, cy - py * w, cz))
            right = bm.verts.new((cx + px * w, cy + py * w, cz))
            if prev:
                bm.faces.new((prev[0], prev[1], right, left))
            prev = (left, right)
    mesh = bpy.data.meshes.new('grass_clump')
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new('grass_clump', mesh)
    obj.data.materials.append(material)
    return obj


def grass_material():
    g = M.Graph('grass_blades')
    info = g.node('ShaderNodeObjectInfo')
    tc = g.node('ShaderNodeTexCoord')
    sep = g.node('ShaderNodeSeparateXYZ')
    g.link(tc.outputs['Object'], sep.inputs[0])
    col = g.ramp(info.outputs['Random'], [
        (0.0, (0.05, 0.13, 0.02, 1)),
        (0.5, (0.08, 0.2, 0.03, 1)),
        (0.85, (0.11, 0.25, 0.04, 1)),
        (1.0, (0.18, 0.26, 0.06, 1)),
    ])
    base = g.node('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    g.link(g.math('SUBTRACT', 0.5, g.math('MULTIPLY', sep.outputs[2], 2.4)), base.inputs['Factor'])
    g.link(col, base.inputs[6])
    base.inputs[7].default_value = (0.35, 0.35, 0.35, 1)
    g.set('Base Color', base.outputs[2])
    g.set('Roughness', 0.5)
    trans = g.node('ShaderNodeBsdfTranslucent')
    g.link(base.outputs[2], trans.inputs['Color'])
    mix = g.node('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.3
    g.link(g.bsdf.outputs[0], mix.inputs[1])
    g.link(trans.outputs[0], mix.inputs[2])
    g.link(mix.outputs[0], g.out.inputs['Surface'])
    return g.mat


def lawn(scene_data, lawn_mask, to_b, detail, region, name='lawn'):
    (x0, x1), (z0, z1) = region
    step = 0.8
    nx = int((x1 - x0) / step) + 1
    nz = int((z1 - z0) / step) + 1
    box = scene_data['houseBox']
    cx = (box['min'][0] + box['max'][0]) / 2
    cz = (box['min'][2] + box['max'][2]) / 2
    verts = []
    weights = []
    for j in range(nz):
        z = z0 + j * step
        for i in range(nx):
            x = x0 + i * step
            verts.append((x, -z, 0.05))
            w = 0.0
            if z0 < z and lawn_mask(x, z):
                w = max(0.2, min(1.0, 1.3 - math.hypot(x - cx, z - cz) / 200))
                if name != 'lawn':
                    w = 1.0
            weights.append(w)
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(nz - 1) for i in range(nx - 1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    attr = mesh.attributes.new('density', 'FLOAT', 'POINT')
    attr.data.foreach_set('value', weights)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    clump = grass_clump(grass_material())
    holder = bpy.data.collections.new('grass_src')
    holder.objects.link(clump)  # referenced by the scatter only
    ng = scatter_group('grass_scatter', clump, 48.0 * detail, (0.8, 1.15), (-0.2, -0.2, 0), (0.2, 0.2, 6.283), density_attr='density', seed=5)
    # Keep the soil surface: join the original mesh with the grass instances.
    join = ng.nodes.new('GeometryNodeJoinGeometry')
    gin = next(n for n in ng.nodes if n.bl_idname == 'NodeGroupInput')
    gout = next(n for n in ng.nodes if n.bl_idname == 'NodeGroupOutput')
    inst = next(n for n in ng.nodes if n.bl_idname == 'GeometryNodeInstanceOnPoints')
    for link in list(gout.inputs[0].links):
        ng.links.remove(link)
    ng.links.new(inst.outputs['Instances'], join.inputs[0])
    ng.links.new(gin.outputs[0], join.inputs[0])
    ng.links.new(join.outputs[0], gout.inputs[0])
    obj.data.materials.append(M.lawn_soil())
    obj.modifiers.new('grass', 'NODES').node_group = ng
    return obj


def surrounding_trees(scene_data, keep_clear_until=None):
    """Neighbourhood trees across the street and beside the lot, so rear and
    aerial views have a tree line too (the exported backdrop sits behind the lot)."""
    rng = random.Random(77)
    box = scene_data['houseBox']
    cx = (box['min'][0] + box['max'][0]) / 2
    trees = {'canopy': [], 'trunk': [], 'conifer': []}

    def add(x, z):
        if rng.random() < 0.2:
            trees['conifer'].append({'x': x, 'y': 0, 'z': z, 'sx': 9 + rng.random() * 5, 'sy': 28 + rng.random() * 18,
                                     'sz': 9 + rng.random() * 5, 'color': 0x2c4a2a, 'rot': rng.random() * 6})
            return
        height = 26 + rng.random() * 20
        spread = 22 + rng.random() * 12
        trunk_h = height * 0.3
        r = 0.12 + height * 0.018
        trees['trunk'].append({'x': x, 'y': 0, 'z': z, 'sx': r, 'sy': trunk_h, 'sz': r, 'color': 0x5a4636, 'rot': rng.random() * 6})
        canopy_h = height - trunk_h * 0.75
        trees['canopy'].append({'x': x, 'y': trunk_h * 0.75 + canopy_h * 0.5, 'z': z, 'sx': spread / 2, 'sy': canopy_h / 2,
                                'sz': spread / 2, 'color': 0x47752f, 'rot': rng.random() * 6})

    for _ in range(26):  # across the street: front yards of the opposite row
        x, z = cx + (rng.random() - 0.5) * 420, 80 + rng.random() * 170
        if keep_clear_until is not None and z < keep_clear_until:
            continue  # would stand between a straight-on camera and the house
        add(x, z)
    for side in (-1, 1):  # neighbouring back yards
        for _ in range(7):
            add(cx + side * (95 + rng.random() * 120), box['min'][2] - 40 + rng.random() * 120)
    return trees


def dress(scene_data, view, ortho, lawn_mask, to_b, detail=1.0):
    scene = bpy.context.scene
    _IMAGES.clear()  # images from a previous scene reset are gone
    lib = build_masters(detail)
    plants_coll = bpy.data.collections.new('plants')
    scene.collection.children.link(plants_coll)
    place_plants(lib, scene_data['plants'], to_b, plants_coll)
    if not ortho:
        place_plants(lib, scene_data['backdrop'], to_b, plants_coll)
        straight = view.get('straight_on')
        clear = view['camera']['position'][2] + 25 if straight else None
        place_plants(lib, surrounding_trees(scene_data, clear), to_b, plants_coll)
    box = scene_data['houseBox']
    wide = view['camera']['position'][1] > 20 or view['camera']['position'][2] < box['min'][2]
    pad_x, pad_z = (95, 75) if wide else (60, 45)
    region = ((box['min'][0] - pad_x, box['max'][0] + pad_x), (box['min'][2] - pad_z, 12.8))
    if ortho:
        region = ((box['min'][0] - 40, box['max'][0] + 40), (box['min'][2] - 3, 12.8))
    lawn(scene_data, lawn_mask, to_b, detail, region)
    if view.get('straight_on'):
        # Foreground lawn on the camera's side of the street.
        road_far = scene_data['ground']['roadFar']
        cam_x, _, cam_z = view['camera']['position']
        half = (box['max'][0] - box['min'][0]) * 0.9 + 30
        lawn(scene_data, lawn_mask, to_b, detail, ((cam_x - half, cam_x + half), (road_far, cam_z - 6)), name='lawn_far')
