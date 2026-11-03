"""Procedural physically based materials for the photoreal renders.

All house and ground UVs are in feet (walls: u along the wall, v height;
roofs: u along the ridge, v up the slope), so every pattern below is sized
in real units: 7" lap exposure, 16" batten spacing, 5⅝" shingle rows, etc.
Door and garage-door details come from small height/glass masks generated
here with numpy (UV 0..1 across the slab).
"""

import bpy
import numpy as np


def srgb(hex_color):
    h = hex_color.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def scale_color(c, f):
    return tuple(min(1.0, v * f) for v in c[:3]) + (1.0,)


class Graph:
    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.nt = self.mat.node_tree
        self.nt.nodes.clear()
        self.out = self.node('ShaderNodeOutputMaterial')
        self.bsdf = self.node('ShaderNodeBsdfPrincipled')
        self.link(self.bsdf.outputs[0], self.out.inputs['Surface'])
        self._uv = None

    def node(self, kind, **props):
        n = self.nt.nodes.new(kind)
        for key, value in props.items():
            setattr(n, key, value)
        return n

    def link(self, a, b):
        self.nt.links.new(a, b)

    def value(self, v):
        n = self.node('ShaderNodeValue')
        n.outputs[0].default_value = v
        return n.outputs[0]

    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, x in enumerate((a, b, c)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                n.inputs[i].default_value = x
            else:
                self.link(x, n.inputs[i])
        return n.outputs[0]

    def smoothstep(self, edge0, edge1, x):
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP', clamp=True)
        n.inputs['From Min'].default_value = edge0
        n.inputs['From Max'].default_value = edge1
        self.link(x, n.inputs['Value'])
        return n.outputs['Result']

    def uv(self):
        if self._uv is None:
            tc = self.node('ShaderNodeTexCoord')
            sep = self.node('ShaderNodeSeparateXYZ')
            self.link(tc.outputs['UV'], sep.inputs[0])
            self._uv = (tc.outputs['UV'], sep.outputs[0], sep.outputs[1])
        return self._uv

    def combine(self, x, y, z=0.0):
        n = self.node('ShaderNodeCombineXYZ')
        for i, c in enumerate((x, y, z)):
            if isinstance(c, (int, float)):
                n.inputs[i].default_value = c
            else:
                self.link(c, n.inputs[i])
        return n.outputs[0]

    def noise(self, vector, scale, detail=2.0, roughness=0.5):
        n = self.node('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = roughness
        if vector is not None:
            self.link(vector, n.inputs['Vector'])
        return n

    def mix_color(self, fac, a, b):
        n = self.node('ShaderNodeMix', data_type='RGBA')
        if isinstance(fac, (int, float)):
            n.inputs['Factor'].default_value = fac
        else:
            self.link(fac, n.inputs['Factor'])
        for sock, c in ((n.inputs[6], a), (n.inputs[7], b)):
            if isinstance(c, tuple):
                sock.default_value = c
            else:
                self.link(c, sock)
        return n.outputs[2]

    def ramp(self, fac, stops):
        n = self.node('ShaderNodeValToRGB')
        self.link(fac, n.inputs['Fac'])
        els = n.color_ramp.elements
        els[0].position, els[0].color = stops[0]
        els[1].position, els[1].color = stops[-1]
        for pos, col in stops[1:-1]:
            e = els.new(pos)
            e.color = col
        return n.outputs['Color']

    def bump(self, height, strength=1.0, distance=0.03, normal=None):
        n = self.node('ShaderNodeBump')
        n.inputs['Strength'].default_value = strength
        n.inputs['Distance'].default_value = distance
        self.link(height, n.inputs['Height'])
        if normal is not None:
            self.link(normal, n.inputs['Normal'])
        return n.outputs['Normal']

    def set(self, name, value):
        sock = self.bsdf.inputs[name]
        if isinstance(value, (int, float, tuple)):
            sock.default_value = value
        else:
            self.link(value, sock)


def paint(name, color, roughness=0.4, bump=0.02):
    g = Graph(name)
    uvv, _, _ = g.uv()
    n = g.noise(uvv, 18.0, 3.0)
    g.set('Base Color', color)
    g.set('Roughness', roughness)
    if bump:
        g.set('Normal', g.bump(n.outputs['Fac'], 0.15, bump))
    return g.mat


def lap_siding(color):
    g = Graph('lap_siding')
    uvv, u, v = g.uv()
    t = g.math('FRACT', g.math('DIVIDE', v, 0.5833))
    ao = g.math('MULTIPLY_ADD', g.smoothstep(0.0, 0.08, t), 0.22, 0.78)
    grain = g.noise(g.combine(g.math('MULTIPLY', u, 1.2), g.math('MULTIPLY', v, 70.0)), 1.0, 3.0)
    tint = g.math('MULTIPLY_ADD', grain.outputs['Fac'], 0.08, 0.96)
    k = g.math('MULTIPLY', ao, tint)
    col = g.node('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    col.inputs['Factor'].default_value = 1.0
    col.inputs[6].default_value = color
    kc = g.combine(k, k, k)
    g.link(kc, col.inputs[7])
    g.set('Base Color', col.outputs[2])
    g.set('Roughness', 0.52)
    height = g.math('ADD', t, g.math('MULTIPLY', grain.outputs['Fac'], 0.04))
    g.set('Normal', g.bump(height, 1.0, 0.035))
    return g.mat


def shake(color):
    g = Graph('shake')
    uvv, u, v = g.uv()
    brick = g.node('ShaderNodeTexBrick', offset=0.5, offset_frequency=2, squash=0.6, squash_frequency=3)
    g.link(uvv, brick.inputs['Vector'])
    brick.inputs['Color1'].default_value = scale_color(color, 0.78)
    brick.inputs['Color2'].default_value = scale_color(color, 1.08)
    brick.inputs['Mortar'].default_value = scale_color(color, 0.35)
    brick.inputs['Scale'].default_value = 1.0
    brick.inputs['Mortar Size'].default_value = 0.012
    brick.inputs['Mortar Smooth'].default_value = 0.2
    brick.inputs['Brick Width'].default_value = 0.5
    brick.inputs['Row Height'].default_value = 0.58
    grain = g.noise(g.combine(g.math('MULTIPLY', u, 25.0), g.math('MULTIPLY', v, 2.0)), 1.0, 4.0)
    col = g.mix_color(g.math('MULTIPLY', grain.outputs['Fac'], 0.35), brick.outputs['Color'], scale_color(color, 0.7))
    g.set('Base Color', col)
    g.set('Roughness', 0.82)
    row = g.math('FRACT', g.math('DIVIDE', v, 0.58))
    height = g.math('ADD', g.math('MULTIPLY', row, 0.8), g.math('MULTIPLY', g.math('SUBTRACT', 1.0, brick.outputs['Fac']), 0.6))
    height = g.math('ADD', height, g.math('MULTIPLY', grain.outputs['Fac'], 0.25))
    g.set('Normal', g.bump(height, 1.0, 0.04))
    return g.mat


def board_batten(color):
    g = Graph('board_batten')
    uvv, u, v = g.uv()
    t = g.math('FRACT', g.math('DIVIDE', u, 1.3333))
    d = g.math('ABSOLUTE', g.math('SUBTRACT', t, 0.5))
    batten = g.math('SUBTRACT', 1.0, g.smoothstep(0.045, 0.06, d))
    n = g.noise(uvv, 6.0, 3.0)
    g.set('Base Color', g.mix_color(g.math('MULTIPLY', n.outputs['Fac'], 0.12), color, scale_color(color, 0.85)))
    g.set('Roughness', 0.45)
    g.set('Normal', g.bump(g.math('ADD', batten, g.math('MULTIPLY', n.outputs['Fac'], 0.03)), 1.0, 0.06))
    return g.mat


def shingles(color):
    g = Graph('shingles')
    uvv, u, v = g.uv()
    tabs = []
    for width, offset in ((1.15, 0.5), (0.8, 0.33)):
        b = g.node('ShaderNodeTexBrick', offset=offset, offset_frequency=1, squash=0.75, squash_frequency=2)
        g.link(uvv, b.inputs['Vector'])
        b.inputs['Color1'].default_value = scale_color(color, 0.72)
        b.inputs['Color2'].default_value = scale_color(color, 1.18)
        b.inputs['Mortar'].default_value = scale_color(color, 0.35)
        b.inputs['Mortar Size'].default_value = 0.006
        b.inputs['Brick Width'].default_value = width
        b.inputs['Row Height'].default_value = 0.47
        tabs.append(b)
    pick = g.noise(uvv, 0.7, 1.0)
    sel = g.math('GREATER_THAN', pick.outputs['Fac'], 0.5)
    col = g.mix_color(sel, tabs[0].outputs['Color'], tabs[1].outputs['Color'])
    gran = g.noise(uvv, 140.0, 2.0, 0.7)
    col = g.mix_color(g.math('MULTIPLY', gran.outputs['Fac'], 0.45), col, scale_color(color, 0.55))
    g.set('Base Color', col)
    g.set('Roughness', 0.9)
    row = g.math('FRACT', g.math('DIVIDE', v, 0.47))
    gaps = g.math('MULTIPLY', g.math('SUBTRACT', 1.0, g.math('MAXIMUM', tabs[0].outputs['Fac'], tabs[1].outputs['Fac'])), 0.4)
    height = g.math('ADD', g.math('ADD', g.math('MULTIPLY', row, 0.9), gaps), g.math('MULTIPLY', gran.outputs['Fac'], 0.25))
    g.set('Normal', g.bump(height, 1.0, 0.03))
    return g.mat


def brick():
    g = Graph('brick')
    uvv, _, _ = g.uv()
    b = g.node('ShaderNodeTexBrick', offset=0.5, offset_frequency=2)
    g.link(uvv, b.inputs['Vector'])
    b.inputs['Color1'].default_value = (0.15, 0.045, 0.03, 1)
    b.inputs['Color2'].default_value = (0.24, 0.08, 0.05, 1)
    b.inputs['Mortar'].default_value = (0.36, 0.34, 0.31, 1)
    b.inputs['Mortar Size'].default_value = 0.025
    b.inputs['Mortar Smooth'].default_value = 0.3
    b.inputs['Brick Width'].default_value = 0.667
    b.inputs['Row Height'].default_value = 0.222
    n = g.noise(uvv, 30.0, 3.0)
    g.set('Base Color', g.mix_color(g.math('MULTIPLY', n.outputs['Fac'], 0.25), b.outputs['Color'], (0.2, 0.08, 0.05, 1)))
    g.set('Roughness', 0.9)
    g.set('Normal', g.bump(g.math('ADD', g.math('SUBTRACT', 1.0, b.outputs['Fac']), g.math('MULTIPLY', n.outputs['Fac'], 0.2)), 1.0, 0.02))
    return g.mat


def stone():
    g = Graph('stone')
    uvv, _, _ = g.uv()
    edge = g.node('ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE')
    edge.inputs['Scale'].default_value = 2.6
    g.link(uvv, edge.inputs['Vector'])
    cells = g.node('ShaderNodeTexVoronoi', feature='F1')
    cells.inputs['Scale'].default_value = 2.6
    g.link(uvv, cells.inputs['Vector'])
    bw = g.node('ShaderNodeRGBToBW')
    g.link(cells.outputs['Color'], bw.inputs[0])
    col = g.ramp(bw.outputs[0], [(0.0, (0.2, 0.18, 0.15, 1)), (1.0, (0.45, 0.4, 0.33, 1))])
    mortar = g.math('LESS_THAN', edge.outputs['Distance'], 0.04)
    g.set('Base Color', g.mix_color(mortar, col, (0.12, 0.11, 0.1, 1)))
    g.set('Roughness', 0.92)
    n = g.noise(uvv, 12.0, 4.0)
    height = g.math('ADD', g.math('MINIMUM', edge.outputs['Distance'], 0.12), g.math('MULTIPLY', n.outputs['Fac'], 0.05))
    g.set('Normal', g.bump(height, 1.0, 0.25))
    return g.mat


def glass():
    g = Graph('glass')
    g.set('Base Color', (0.012, 0.016, 0.022, 1))
    g.set('Roughness', 0.03)
    g.set('IOR', 1.52)
    g.set('Specular IOR Level', 0.6)
    return g.mat


def lamp_glass():
    g = Graph('lamp_glass')
    g.set('Base Color', (0.9, 0.82, 0.62, 1))
    g.set('Roughness', 0.2)
    g.set('Emission Color', (1.0, 0.8, 0.5, 1))
    g.set('Emission Strength', 1.5)
    return g.mat


def _image(name, rgb):
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False, float_buffer=True)
    # Colour space first: changing it afterwards regenerates (blanks) the buffer.
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = rgb
    img.pixels.foreach_set(rgba.ravel())
    img.update()
    return img


def _rect(arr, x0, x1, y0, y1, value, channel):
    h, w, _ = arr.shape
    arr[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w), channel] = value


def _raised_panel(arr, x0, x1, y0, y1, border=0.012):
    _rect(arr, x0, x1, y0, y1, 0.0, 0)
    _rect(arr, x0 + border, x1 - border, y0 + border * 2, y1 - border * 2, 0.6, 0)
    _rect(arr, x0 + border * 2.2, x1 - border * 2.2, y0 + border * 4.4, y1 - border * 4.4, 1.0, 0)


def garage_door_map():
    w, h = 1024, 448
    arr = np.full((h, w, 3), 1.0, dtype=np.float32)
    arr[..., 1] = 0.0
    rows, cols = 4, 8
    for r in range(rows):
        y0, y1 = r / rows, (r + 1) / rows
        _rect(arr, 0, 1, y1 - 0.006, y1, 0.3, 0)  # section joints
        for c in range(cols):
            x0, x1 = c / cols, (c + 1) / cols
            if r == rows - 1:
                if c % 2 == 0:
                    _rect(arr, x0 + 0.012, x0 + 2 / cols - 0.012, y0 + 0.045, y1 - 0.06, 1.0, 1)
                    _rect(arr, x0 + 1 / cols - 0.003, x0 + 1 / cols + 0.003, y0 + 0.045, y1 - 0.06, 0.0, 1)
                continue
            _raised_panel(arr, x0 + 0.01, x1 - 0.01, y0 + 0.04, y1 - 0.04)
    return _image('garage_door_map', arr)


def door_map(style):
    w, h = 300, 680
    arr = np.full((h, w, 3), 1.0, dtype=np.float32)
    arr[..., 1] = 0.0
    if style == 'nineLite':
        for r in range(3):
            for c in range(3):
                x0 = 0.2 + c * 0.2
                y0 = 0.52 + r * 0.13
                _rect(arr, x0 + 0.015, x0 + 0.185, y0 + 0.01, y0 + 0.12, 1.0, 1)
        _raised_panel(arr, 0.18, 0.47, 0.08, 0.42, 0.02)
        _raised_panel(arr, 0.53, 0.82, 0.08, 0.42, 0.02)
    else:
        for r in range(2):
            for c in range(3):
                x0 = 0.22 + c * 0.19
                y0 = 0.74 + r * 0.09
                _rect(arr, x0 + 0.012, x0 + 0.178, y0 + 0.008, y0 + 0.082, 1.0, 1)
        _raised_panel(arr, 0.18, 0.47, 0.08, 0.64, 0.02)
        _raised_panel(arr, 0.53, 0.82, 0.08, 0.64, 0.02)
    return _image(f'door_map_{style}', arr)


def slab_with_lites(name, color, image, roughness=0.35):
    """Painted slab with raised panels (R = height) and glass lites (G = mask)."""
    g = Graph(name)
    uvv, _, _ = g.uv()
    tex = g.node('ShaderNodeTexImage', image=image, interpolation='Cubic')
    g.link(uvv, tex.inputs['Vector'])
    sep = g.node('ShaderNodeSeparateColor')
    g.link(tex.outputs['Color'], sep.inputs[0])
    mask = sep.outputs[1]
    g.set('Base Color', g.mix_color(mask, color, (0.01, 0.013, 0.018, 1)))
    rough = g.node('ShaderNodeMix', data_type='FLOAT')
    g.link(mask, rough.inputs['Factor'])
    rough.inputs[2].default_value = roughness
    rough.inputs[3].default_value = 0.03
    g.set('Roughness', rough.outputs[0])
    g.set('Normal', g.bump(sep.outputs[0], 1.0, 0.02))
    return g.mat


def shutter(color):
    g = Graph('shutter')
    uvv, u, v = g.uv()
    t = g.math('FRACT', g.math('DIVIDE', v, 0.16))
    g.set('Base Color', color)
    g.set('Roughness', 0.45)
    g.set('Normal', g.bump(t, 1.0, 0.02))
    return g.mat


def house_materials(pal):
    siding = srgb(pal['siding'])
    gable = srgb(pal['gable'])
    door = srgb(pal['door'])
    return {
        'siding': lap_siding(siding),
        'shake': shake(gable),
        'bnb': board_batten(gable),
        'roof': shingles(srgb(pal['roof'])),
        'trim': paint('trim', srgb('#f4f3ee'), 0.38),
        'post': paint('post', srgb(pal['post']), 0.4),
        'skirt': brick(),
        'concrete': concrete('house_concrete', 5.0),
        'stone': stone(),
        'glass': glass(),
        'door': slab_with_lites('door', door, door_map('craftsman')),
        'doorRear': slab_with_lites('door_rear', door, door_map('nineLite')),
        'garageDoor': slab_with_lites('garage_door', srgb('#f1f1ee'), garage_door_map(), 0.4),
        'shutter': shutter(srgb(pal['shutter'])),
        'lamp': paint('lamp', (0.02, 0.02, 0.02, 1), 0.35, 0),
        'lampGlass': lamp_glass(),
    }


def concrete(name, joint):
    g = Graph(name)
    uvv, u, v = g.uv()
    big = g.noise(uvv, 0.35, 3.0)
    fine = g.noise(uvv, 45.0, 2.0)
    col = g.mix_color(g.math('MULTIPLY', big.outputs['Fac'], 0.5), (0.5, 0.49, 0.46, 1), (0.36, 0.35, 0.33, 1))
    ju = g.math('LESS_THAN', g.math('PINGPONG', g.math('DIVIDE', u, joint), 0.5), 0.004)
    jv = g.math('LESS_THAN', g.math('PINGPONG', g.math('DIVIDE', v, joint), 0.5), 0.004)
    j = g.math('MAXIMUM', ju, jv)
    g.set('Base Color', g.mix_color(g.math('MULTIPLY', j, 0.6), col, (0.18, 0.18, 0.17, 1)))
    g.set('Roughness', 0.88)
    g.set('Normal', g.bump(g.math('SUBTRACT', g.math('MULTIPLY', fine.outputs['Fac'], 0.3), j), 1.0, 0.01))
    return g.mat


def asphalt():
    g = Graph('asphalt')
    uvv, _, _ = g.uv()
    agg = g.node('ShaderNodeTexVoronoi')
    agg.inputs['Scale'].default_value = 26.0
    g.link(uvv, agg.inputs['Vector'])
    patch = g.noise(uvv, 0.08, 3.0)
    base = g.mix_color(g.math('MULTIPLY', patch.outputs['Fac'], 0.6), (0.05, 0.05, 0.055, 1), (0.085, 0.085, 0.09, 1))
    spot = g.math('GREATER_THAN', agg.outputs['Distance'], 0.42)
    g.set('Base Color', g.mix_color(g.math('MULTIPLY', spot, 0.5), base, (0.16, 0.16, 0.16, 1)))
    g.set('Roughness', 0.92)
    g.set('Normal', g.bump(agg.outputs['Distance'], 0.6, 0.01))
    return g.mat


def mulch():
    g = Graph('mulch')
    uvv, _, _ = g.uv()
    chips = g.node('ShaderNodeTexVoronoi')
    chips.inputs['Scale'].default_value = 9.0
    stretch = g.combine(g.math('MULTIPLY', g.uv()[1], 1.0), g.math('MULTIPLY', g.uv()[2], 2.2))
    g.link(stretch, chips.inputs['Vector'])
    bw = g.node('ShaderNodeRGBToBW')
    g.link(chips.outputs['Color'], bw.inputs[0])
    col = g.ramp(bw.outputs[0], [(0.0, (0.06, 0.03, 0.015, 1)), (0.5, (0.16, 0.08, 0.035, 1)), (1.0, (0.25, 0.13, 0.06, 1))])
    g.set('Base Color', col)
    g.set('Roughness', 0.95)
    g.set('Normal', g.bump(chips.outputs['Distance'], 1.0, 0.05))
    return g.mat


def lawn_soil():
    g = Graph('lawn_soil')
    uvv, _, _ = g.uv()
    # Reads as mown turf from a distance, so the hair-grass region blends into it.
    n = g.noise(uvv, 0.12, 5.0)
    fine = g.noise(uvv, 9.0, 3.0)
    base = g.mix_color(n.outputs['Fac'], (0.05, 0.13, 0.022, 1), (0.1, 0.2, 0.04, 1))
    g.set('Base Color', g.mix_color(g.math('MULTIPLY', fine.outputs['Fac'], 0.35), base, (0.04, 0.09, 0.02, 1)))
    g.set('Roughness', 0.95)
    g.set('Normal', g.bump(g.noise(uvv, 40.0, 3.0).outputs['Fac'], 0.5, 0.02))
    return g.mat


def field():
    g = Graph('field')
    uvv, _, _ = g.uv()
    n = g.noise(uvv, 0.01, 5.0)
    g.set('Base Color', g.mix_color(n.outputs['Fac'], (0.13, 0.13, 0.06, 1), (0.25, 0.21, 0.12, 1)))
    g.set('Roughness', 1.0)
    return g.mat


def mountain():
    # Distant ridges take on the sky's haze: mostly emission close to the horizon colour.
    g = Graph('mountain')
    g.set('Base Color', (0.2, 0.23, 0.28, 1))
    g.set('Emission Color', (0.5, 0.57, 0.68, 1))
    g.set('Emission Strength', 0.55)
    g.set('Roughness', 1.0)
    return g.mat


def ground_materials():
    soil = lawn_soil()
    return {
        'grass': soil,
        'parkGrass': soil,
        'gravel': field(),
        'parkGravel': field(),
        'asphalt': asphalt(),
        'concrete': concrete('concrete', 5.0),
        'driveway': concrete('driveway', 10.0),
        'mulch': mulch(),
        'rock': mulch(),
        'field': field(),
        'mountain': mountain(),
    }


def elevation_backdrop(scene_data, view, to_b):
    """Sky gradient + lawn band behind the house for orthographic elevations."""
    box = scene_data['houseBox']
    cam = view['camera']
    g = Graph('elevation_backdrop')
    g.nt.nodes.remove(g.bsdf)
    emit = g.node('ShaderNodeEmission')
    emit.inputs['Strength'].default_value = 1.0
    g.link(emit.outputs[0], g.out.inputs['Surface'])
    tc = g.node('ShaderNodeTexCoord')
    sep = g.node('ShaderNodeSeparateXYZ')
    g.link(tc.outputs['Object'], sep.inputs[0])
    z = g.math('MULTIPLY_ADD', sep.outputs[2], 0.5 / cam['height'], 0.5)
    col = g.ramp(z, [(0.0, (0.06, 0.13, 0.03, 1)), (0.495, (0.09, 0.18, 0.04, 1)), (0.5, (0.62, 0.72, 0.8, 1)), (1.0, (0.2, 0.38, 0.62, 1))])
    g.link(col, emit.inputs['Color'])
    mesh = bpy.data.meshes.new('backdrop')
    w = cam['width'] * 3
    hgt = cam['height']
    mesh.from_pydata([(-w, 0, -hgt), (w, 0, -hgt), (w, 0, hgt), (-w, 0, hgt)], [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.new('backdrop', mesh)
    obj.data.materials.append(g.mat)
    center_x = (box['min'][0] + box['max'][0]) / 2
    obj.location = to_b((center_x, 0, box['min'][2] - 3))
    obj.visible_shadow = False
    obj.visible_diffuse = False
    obj.visible_glossy = False
    bpy.context.scene.collection.objects.link(obj)
    return obj
