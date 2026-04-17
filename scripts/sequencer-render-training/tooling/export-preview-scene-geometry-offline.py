#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path


def norm(value=''):
    return str(value or '').strip()


def low(value=''):
    return norm(value).lower()


def to_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def to_int(value, default=0):
    try:
        return int(float(value))
    except Exception:
        return default


def infer_channels_per_node(string_type=''):
    s = low(string_type)
    if 'rgb' in s:
        return 3
    if 'single color' in s:
        return 1
    return 3


def load_controller_bases(networks_path: Path):
    root = ET.parse(networks_path).getroot()
    controller_bases = {}
    channel_base = 0
    for controller in root.findall('Controller'):
        name = controller.attrib.get('Name')
        network = controller.find('network')
        if not name or network is None:
            continue
        max_channels = int(network.attrib.get('MaxChannels', '0') or '0')
        controller_bases[name] = {
            'baseZero': channel_base,
            'maxChannels': max_channels,
        }
        channel_base += max_channels
    return controller_bases


def parse_start_channel(raw, controller_bases, model_lookup=None, seen=None):
    raw = norm(raw)
    if not raw:
        raise ValueError('missing StartChannel')
    if raw.isdigit():
        return int(raw) - 1
    m = re.match(r'^([!@<>]?)(.*?):(\d+)$', raw)
    if not m:
        raise ValueError(f'unsupported StartChannel format: {raw}')
    ref_kind = m.group(1)
    ref_name = norm(m.group(2))
    offset_one = int(m.group(3))
    if ref_name in controller_bases:
        return controller_bases[ref_name]['baseZero'] + offset_one - 1
    model_lookup = model_lookup or {}
    seen = seen or set()
    if ref_name in seen:
        raise ValueError(f'circular StartChannel reference: {ref_name}')
    ref_model = model_lookup.get(ref_name)
    if ref_model is None:
        raise ValueError(f'controller/model not found for StartChannel reference: {ref_name}')
    seen.add(ref_name)
    base_zero = parse_start_channel(ref_model.attrib.get('StartChannel', ''), controller_bases, model_lookup=model_lookup, seen=seen)
    channels_per_node = infer_channels_per_node(ref_model.attrib.get('StringType'))
    node_count = estimate_node_count(ref_model)
    if ref_kind == '>':
        return base_zero + node_count * channels_per_node + offset_one - 1
    return base_zero + offset_one - 1


def parse_start_channel_reference(raw):
    raw = norm(raw)
    if not raw:
        return {'raw': raw, 'kind': 'missing'}
    if raw.isdigit():
        return {'raw': raw, 'kind': 'absolute_numeric'}
    m = re.match(r'^([!@<>]?)(.*?):(\d+)$', raw)
    if not m:
        return {'raw': raw, 'kind': 'unsupported'}
    prefix = m.group(1)
    name = norm(m.group(2))
    offset_one = int(m.group(3))
    if prefix == '!':
        kind = 'controller_relative'
    elif prefix == '@':
        kind = 'model_first_channel'
    elif prefix == '>':
        kind = 'model_after_last_channel'
    elif prefix == '<':
        kind = 'model_before_first_channel'
    else:
        kind = 'legacy_output_relative'
    return {'raw': raw, 'kind': kind, 'referenceName': name, 'offsetOne': offset_one}


def parse_aliases(model):
    aliases = []
    aliases_node = model.find('Aliases')
    if aliases_node is None:
        aliases_node = model.find('aliases')
    if aliases_node is None:
        return aliases
    for child in aliases_node.findall('alias'):
        name = norm(child.attrib.get('name'))
        if name:
            aliases.append(name)
    return aliases


def estimate_node_count(model):
    attrs = model.attrib
    display_as = norm(attrs.get('DisplayAs'))
    if display_as in ('Horiz Matrix', 'Vert Matrix'):
        rows = max(1, to_int(attrs.get('parm1', 1), 1))
        cols = max(1, to_int(attrs.get('parm2', 1), 1))
        return rows * cols
    if display_as in ('Tree 360', 'Tree Flat', 'Star', 'Icicles'):
        return max(1, to_int(attrs.get('parm1', 1), 1)) * max(1, to_int(attrs.get('parm2', 1), 1))
    if display_as in ('Single Line', 'Poly Line'):
        return max(1, to_int(attrs.get('parm1', attrs.get('PixelCount', 1)), 1)) * max(1, to_int(attrs.get('parm2', 1), 1) if display_as == 'Single Line' else 1)
    if display_as == 'Custom':
        locations = parse_custom_model_data(attrs)
        found = set()
        for layer in locations:
            for row in layer:
                for value in row:
                    if value > 0:
                        found.add(value)
        return max(1, len(found))
    return max(1, to_int(attrs.get('PixelCount', 1), 1))


def euler_rotate(x, y, z, rx_deg, ry_deg, rz_deg):
    rx = math.radians(rx_deg)
    ry = math.radians(ry_deg)
    rz = math.radians(rz_deg)
    # X
    cy = math.cos(rx)
    sy = math.sin(rx)
    y, z = (y * cy - z * sy), (y * sy + z * cy)
    # Y
    cy = math.cos(ry)
    sy = math.sin(ry)
    x, z = (x * cy + z * sy), (-x * sy + z * cy)
    # Z
    cz = math.cos(rz)
    sz = math.sin(rz)
    x, y = (x * cz - y * sz), (x * sz + y * cz)
    return x, y, z


def transform_point(local_xyz, attrs):
    x, y, z = local_xyz
    sx = to_float(attrs.get('ScaleX', 1.0), 1.0)
    sy = to_float(attrs.get('ScaleY', 1.0), 1.0)
    sz = to_float(attrs.get('ScaleZ', 1.0), 1.0)
    x *= sx
    y *= sy
    z *= sz
    x, y, z = euler_rotate(
        x,
        y,
        z,
        to_float(attrs.get('RotateX', 0.0), 0.0),
        to_float(attrs.get('RotateY', 0.0), 0.0),
        to_float(attrs.get('RotateZ', 0.0), 0.0),
    )
    x += to_float(attrs.get('WorldPosX', 0.0), 0.0)
    y += to_float(attrs.get('WorldPosY', 0.0), 0.0)
    z += to_float(attrs.get('WorldPosZ', 0.0), 0.0)
    return {'x': x, 'y': y, 'z': z}


def make_coord(local_xyz, attrs, buffer=None):
    world = transform_point(local_xyz, attrs)
    coord = {
        'world': world,
        'screen': dict(world),
    }
    if buffer is not None:
        coord['buffer'] = {'x': float(buffer[0]), 'y': float(buffer[1])}
    return coord


def parse_custom_model_data(attrs):
    compressed = norm(attrs.get('CustomModelCompressed'))
    if compressed:
        locations = []
        entries = [part for part in compressed.split(';') if part.strip()]
        parsed = []
        max_layer = max_row = max_col = 0
        for entry in entries:
            parts = [p.strip() for p in entry.split(',')]
            if len(parts) not in (3, 4):
                continue
            node = int(parts[0])
            row = int(parts[1])
            col = int(parts[2])
            layer = int(parts[3]) if len(parts) == 4 else 0
            parsed.append((node, row, col, layer))
            max_layer = max(max_layer, layer)
            max_row = max(max_row, row)
            max_col = max(max_col, col)
        locations = [[[-1 for _ in range(max_col + 1)] for _ in range(max_row + 1)] for _ in range(max_layer + 1)]
        for node, row, col, layer in parsed:
            locations[layer][row][col] = node
        return locations

    custom = norm(attrs.get('CustomModel'))
    layers = []
    for layer_str in custom.split('|') if custom else ['']:
        rows = []
        row_parts = layer_str.split(';') if layer_str != '' else ['']
        width = 0
        raw_rows = []
        for row_str in row_parts:
            cols = [c.lstrip() for c in row_str.split(',')]
            width = max(width, len(cols))
            raw_rows.append(cols)
        for cols in raw_rows:
            row = []
            for value in cols:
                row.append(int(value) if value else -1)
            while len(row) < width:
                row.append(-1)
            rows.append(row)
        layers.append(rows)
    max_height = max((len(layer) for layer in layers), default=1)
    max_width = max((len(row) for layer in layers for row in layer), default=1)
    for idx, layer in enumerate(layers):
        while len(layer) < max_height:
            layer.append([-1] * max_width)
        layers[idx] = [row + ([-1] * (max_width - len(row))) for row in layer]
    return layers


def build_custom_model(attrs, start_channel_zero, channels_per_node):
    locations = parse_custom_model_data(attrs)
    depth = len(locations)
    height = len(locations[0]) if depth else 1
    width = len(locations[0][0]) if depth and height else 1
    nodes_by_index = {}
    for layer, layer_rows in enumerate(locations):
        for row, cols in enumerate(layer_rows):
            for col, value in enumerate(cols):
                if value <= 0:
                    continue
                idx = value - 1
                local = (
                    float(col) - (float(width) / 2.0),
                    float(height) - float(row) - 1.0 - (float(height) / 2.0),
                    float(depth) - float(layer) - 1.0 - (float(depth) / 2.0),
                )
                coord = make_coord(local, attrs, buffer=(layer * width + col, height - row - 1))
                entry = nodes_by_index.setdefault(idx, {
                    'nodeId': idx,
                    'stringIndex': idx,
                    'channelStart': start_channel_zero + idx * channels_per_node,
                    'channelCount': channels_per_node,
                    'coords': [],
                })
                entry['coords'].append(coord)
    return [nodes_by_index[idx] for idx in sorted(nodes_by_index.keys())]


def sample_polyline_segment(p0, p1, cp0=None, cp1=None, steps=32):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        if cp0 is None or cp1 is None:
            x = p0[0] + (p1[0] - p0[0]) * t
            y = p0[1] + (p1[1] - p0[1]) * t
            z = p0[2] + (p1[2] - p0[2]) * t
        else:
            mt = 1 - t
            x = mt**3 * p0[0] + 3 * mt**2 * t * cp0[0] + 3 * mt * t**2 * cp1[0] + t**3 * p1[0]
            y = mt**3 * p0[1] + 3 * mt**2 * t * cp0[1] + 3 * mt * t**2 * cp1[1] + t**3 * p1[1]
            z = mt**3 * p0[2] + 3 * mt**2 * t * cp0[2] + 3 * mt * t**2 * cp1[2] + t**3 * p1[2]
        pts.append((x, y, z))
    return pts


def parse_point_triplets(value):
    parts = [p.strip() for p in norm(value).split(',') if p.strip()]
    nums = [float(p) for p in parts]
    out = []
    for i in range(0, len(nums) - 2, 3):
        out.append((nums[i], nums[i+1], nums[i+2]))
    return out


def parse_curve_segments(value):
    parts = [p.strip() for p in norm(value).split(',') if p.strip()]
    nums = [float(p) for p in parts]
    out = {}
    for i in range(0, len(nums) - 6, 7):
        seg = int(nums[i])
        out[seg] = ((nums[i+1], nums[i+2], nums[i+3]), (nums[i+4], nums[i+5], nums[i+6]))
    return out


def cumulative_lengths(points):
    out = [0.0]
    total = 0.0
    for i in range(1, len(points)):
        dx = points[i][0] - points[i-1][0]
        dy = points[i][1] - points[i-1][1]
        dz = points[i][2] - points[i-1][2]
        total += math.sqrt(dx*dx + dy*dy + dz*dz)
        out.append(total)
    return out, total


def sample_along_path(points, n):
    if not points:
        return []
    if n <= 1:
        return [points[0]]
    cum, total = cumulative_lengths(points)
    if total <= 0:
        return [points[0] for _ in range(n)]
    out = []
    for idx in range(n):
        target = total * idx / (n - 1)
        j = 1
        while j < len(cum) and cum[j] < target:
            j += 1
        if j >= len(cum):
            out.append(points[-1])
            continue
        a = points[j-1]
        b = points[j]
        base = cum[j-1]
        span = cum[j] - base
        t = 0 if span <= 0 else (target - base) / span
        out.append((a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t))
    return out


def build_polyline_model(attrs, start_channel_zero, channels_per_node):
    pts = parse_point_triplets(attrs.get('PointData'))
    if len(pts) < 2:
        return []
    curves = parse_curve_segments(attrs.get('cPointData'))
    expanded = []
    for i in range(len(pts) - 1):
        cp = curves.get(i)
        segment = sample_polyline_segment(pts[i], pts[i+1], cp[0], cp[1], steps=48) if cp else sample_polyline_segment(pts[i], pts[i+1], steps=24)
        if expanded:
            segment = segment[1:]
        expanded.extend(segment)
    node_count = max(1, to_int(attrs.get('parm2', attrs.get('PixelCount', 1)), 1))
    ordered = sample_along_path(expanded, node_count)
    if norm(attrs.get('Dir', 'L')) == 'R':
        ordered = list(reversed(ordered))
    nodes = []
    for idx, local in enumerate(ordered):
        nodes.append({
            'nodeId': idx,
            'stringIndex': 0,
            'channelStart': start_channel_zero + idx * channels_per_node,
            'channelCount': channels_per_node,
            'coords': [make_coord(local, attrs, buffer=(idx, 0))],
        })
    return nodes


def build_single_line_model(attrs, start_channel_zero, channels_per_node):
    strings = max(1, to_int(attrs.get('parm1', 1), 1))
    nodes_per_string = max(1, to_int(attrs.get('parm2', attrs.get('PixelCount', 1)), 1))
    total = strings * nodes_per_string
    start = (0.0, 0.0, 0.0)
    end = (to_float(attrs.get('X2', 0.0)), to_float(attrs.get('Y2', 0.0)), to_float(attrs.get('Z2', 0.0)))
    ordered = []
    for idx in range(total):
        t = 0.0 if total == 1 else idx / float(total - 1)
        ordered.append((start[0] + (end[0]-start[0])*t, start[1] + (end[1]-start[1])*t, start[2] + (end[2]-start[2])*t))
    if norm(attrs.get('Dir', 'L')) == 'R':
        ordered = list(reversed(ordered))
    return [{
        'nodeId': idx,
        'stringIndex': idx // nodes_per_string,
        'channelStart': start_channel_zero + idx * channels_per_node,
        'channelCount': channels_per_node,
        'coords': [make_coord(local, attrs, buffer=(idx, 0))],
    } for idx, local in enumerate(ordered)]


def build_matrix_model(attrs, start_channel_zero, channels_per_node):
    rows = max(1, to_int(attrs.get('parm1', 1), 1))
    cols = max(1, to_int(attrs.get('parm2', 1), 1))
    start_side = norm(attrs.get('StartSide', 'T')).upper()
    direction = norm(attrs.get('Dir', 'L')).upper()
    step_x = 1.0
    step_y = 1.0
    row_iter = range(rows) if start_side == 'T' else range(rows - 1, -1, -1)
    nodes = []
    node_id = 0
    for logical_row in row_iter:
        col_iter = range(cols - 1, -1, -1) if direction == 'L' else range(cols)
        for logical_col in col_iter:
            local = (logical_col * step_x, logical_row * step_y, 0.0)
            nodes.append({
                'nodeId': node_id,
                'stringIndex': logical_row,
                'channelStart': start_channel_zero + node_id * channels_per_node,
                'channelCount': channels_per_node,
                'coords': [make_coord(local, attrs, buffer=(logical_col, logical_row))],
            })
            node_id += 1
    return nodes


def build_tree360_model(attrs, start_channel_zero, channels_per_node):
    string_count = max(1, to_int(attrs.get('parm1', 1), 1))
    nodes_per_string = max(1, to_int(attrs.get('parm2', 1), 1))
    spiral_rotations = to_float(attrs.get('TreeSpiralRotations', 0.0), 0.0)
    start_side = norm(attrs.get('StartSide', 'B')).upper()
    direction = norm(attrs.get('Dir', 'L')).upper()
    radius = max(1.0, string_count / 2.0)
    top_radius = radius
    nodes = []
    node_id = 0
    for s in range(string_count):
        string_index = (string_count - 1 - s) if direction == 'L' else s
        base_angle = (2.0 * math.pi * string_index) / max(1, string_count)
        for n in range(nodes_per_string):
            t = 0.0 if nodes_per_string == 1 else n / float(nodes_per_string - 1)
            if start_side != 'B':
                t = 1.0 - t
            angle = base_angle + (spiral_rotations * 2.0 * math.pi * t)
            r = radius + (top_radius - radius) * t
            local = (r * math.sin(angle), t * nodes_per_string * 1.8 - (nodes_per_string * 0.9), r * math.cos(angle))
            nodes.append({
                'nodeId': node_id,
                'stringIndex': s,
                'channelStart': start_channel_zero + node_id * channels_per_node,
                'channelCount': channels_per_node,
                'coords': [make_coord(local, attrs, buffer=(string_index, n))],
            })
            node_id += 1
    return nodes


def build_tree_flat_model(attrs, start_channel_zero, channels_per_node):
    string_count = max(1, to_int(attrs.get('parm1', 1), 1))
    nodes_per_string = max(1, to_int(attrs.get('parm2', 1), 1))
    start_side = norm(attrs.get('StartSide', 'B')).upper()
    direction = norm(attrs.get('Dir', 'L')).upper()
    half_span = (string_count - 1) / 2.0
    nodes = []
    node_id = 0
    logical_strings = list(range(string_count - 1, -1, -1)) if direction == 'L' else list(range(string_count))
    for s, logical_string in enumerate(logical_strings):
        x_base = (logical_string - half_span)
        for n in range(nodes_per_string):
            t = 0.0 if nodes_per_string == 1 else n / float(nodes_per_string - 1)
            if start_side != 'B':
                t = 1.0 - t
            local = (x_base * (1.0 - t), t * nodes_per_string * 1.8 - (nodes_per_string * 0.9), 0.0)
            nodes.append({
                'nodeId': node_id,
                'stringIndex': s,
                'channelStart': start_channel_zero + node_id * channels_per_node,
                'channelCount': channels_per_node,
                'coords': [make_coord(local, attrs, buffer=(logical_string, n))],
            })
            node_id += 1
    return nodes


def build_star_model(attrs, start_channel_zero, channels_per_node):
    strings = max(1, to_int(attrs.get('parm1', 1), 1))
    nodes_per_string = max(1, to_int(attrs.get('parm2', 1), 1))
    points = max(1, to_int(attrs.get('parm3', strings), strings))
    total = strings * nodes_per_string
    nodes = []
    node_id = 0
    for s in range(strings):
        angle = (2.0 * math.pi * (s % points)) / points
        for n in range(nodes_per_string):
            t = 0.0 if nodes_per_string == 1 else n / float(nodes_per_string - 1)
            local = (math.cos(angle) * (t * 10.0), math.sin(angle) * (t * 10.0), 0.0)
            nodes.append({
                'nodeId': node_id,
                'stringIndex': s,
                'channelStart': start_channel_zero + node_id * channels_per_node,
                'channelCount': channels_per_node,
                'coords': [make_coord(local, attrs, buffer=(s, n))],
            })
            node_id += 1
    return nodes


def build_icicles_model(attrs, start_channel_zero, channels_per_node):
    strings = max(1, to_int(attrs.get('parm1', 1), 1))
    nodes_per_string = max(1, to_int(attrs.get('parm2', 1), 1))
    direction = norm(attrs.get('Dir', 'L')).upper()
    logical_strings = list(range(strings - 1, -1, -1)) if direction == 'L' else list(range(strings))
    half_span = (strings - 1) / 2.0
    nodes = []
    node_id = 0
    for s, logical_string in enumerate(logical_strings):
        base_x = logical_string - half_span
        drop = 1 + (logical_string % max(1, min(strings, 4)))
        count = max(1, min(nodes_per_string, drop * max(1, nodes_per_string // max(1, strings))))
        for n in range(nodes_per_string):
            local = (base_x, -float(n), 0.0)
            nodes.append({
                'nodeId': node_id,
                'stringIndex': s,
                'channelStart': start_channel_zero + node_id * channels_per_node,
                'channelCount': channels_per_node,
                'coords': [make_coord(local, attrs, buffer=(logical_string, n))],
            })
            node_id += 1
    return nodes


def compute_bounds(models):
    xs=[]; ys=[]; zs=[]
    for m in models:
        for node in m.get('nodes', []):
            for coord in node.get('coords', []):
                screen = coord.get('screen') or {}
                if {'x','y','z'} <= screen.keys():
                    xs.append(screen['x']); ys.append(screen['y']); zs.append(screen['z'])
    if not xs:
        return None
    return {
        'min': {'x': min(xs), 'y': min(ys), 'z': min(zs)},
        'max': {'x': max(xs), 'y': max(ys), 'z': max(zs)},
        'center': {'x': (min(xs)+max(xs))/2.0, 'y': (min(ys)+max(ys))/2.0, 'z': (min(zs)+max(zs))/2.0},
    }


def build_model_entry(model, controller_bases, model_lookup):
    attrs = dict(model.attrib)
    display_as = norm(attrs.get('DisplayAs'))
    start_channel_ref = parse_start_channel_reference(attrs.get('StartChannel', ''))
    start_channel_zero = parse_start_channel(attrs.get('StartChannel', ''), controller_bases, model_lookup=model_lookup)
    channels_per_node = infer_channels_per_node(attrs.get('StringType'))
    if display_as in ('Single Line', 'Poly Line'):
        builder = build_single_line_model if display_as == 'Single Line' else build_polyline_model
    elif display_as == 'Custom':
        builder = build_custom_model
    elif display_as in ('Horiz Matrix', 'Vert Matrix'):
        builder = build_matrix_model
    elif display_as == 'Tree 360':
        builder = build_tree360_model
    elif display_as == 'Tree Flat':
        builder = build_tree_flat_model
    elif display_as == 'Star':
        builder = build_star_model
    elif display_as == 'Icicles':
        builder = build_icicles_model
    else:
        raise NotImplementedError(display_as)
    nodes = builder(attrs, start_channel_zero, channels_per_node)
    return {
        'id': attrs.get('name'),
        'name': attrs.get('name'),
        'type': display_as or 'Model',
        'displayAs': display_as or 'Model',
        'layoutGroup': attrs.get('LayoutGroup', ''),
        'auditEligible': low(attrs.get('LayoutGroup')) != 'unassigned',
        'groupNames': [],
        'renderLayout': '',
        'defaultBufferStyle': '',
        'availableBufferStyles': [],
        'aliases': parse_aliases(model),
        'shadowModelFor': norm(attrs.get('ShadowModelFor')),
        'isShadowModel': bool(norm(attrs.get('ShadowModelFor'))),
        'startChannelReference': start_channel_ref,
        'startChannel': start_channel_zero,
        'endChannel': start_channel_zero + len(nodes) * channels_per_node - 1 if nodes else start_channel_zero,
        'dimensions': None,
        'transform': {
            'position': {
                'x': to_float(attrs.get('WorldPosX', 0.0), 0.0),
                'y': to_float(attrs.get('WorldPosY', 0.0), 0.0),
                'z': to_float(attrs.get('WorldPosZ', 0.0), 0.0),
            },
            'scale': {
                'x': to_float(attrs.get('ScaleX', 1.0), 1.0),
                'y': to_float(attrs.get('ScaleY', 1.0), 1.0),
                'z': to_float(attrs.get('ScaleZ', 1.0), 1.0),
            },
            'rotation': {
                'x': to_float(attrs.get('RotateX', 0.0), 0.0),
                'y': to_float(attrs.get('RotateY', 0.0), 0.0),
                'z': to_float(attrs.get('RotateZ', 0.0), 0.0),
            },
        },
        'submodels': [],
        'nodes': nodes,
    }


def annotate_shared_channel_groups(scene_models):
    by_range = defaultdict(list)
    for model in scene_models:
        model.setdefault('exclusivityGroupIds', [])
        by_range[(model['startChannel'], model['endChannel'])].append(model)

    groups = []
    for members in by_range.values():
        if len(members) < 2:
            continue
        group_id = f"shared_channels:{members[0]['startChannel']}:{members[0]['endChannel']}"
        group = {
            'groupId': group_id,
            'kind': 'shared_channel_exclusive',
            'startChannel': members[0]['startChannel'],
            'endChannel': members[0]['endChannel'],
            'members': [m['name'] for m in members],
        }
        groups.append(group)
        for model in members:
            model['exclusivityGroupIds'].append(group_id)

    by_name = {m['name']: m for m in scene_models}
    shadow_sets = []
    handled = set()
    for model in scene_models:
        target = model.get('shadowModelFor')
        if not target:
            continue
        members = sorted({model['name'], target})
        key = tuple(members)
        if key in handled:
            continue
        handled.add(key)
        shadow_sets.append(members)
    for members in shadow_sets:
        group_id = f"shadow_models:{':'.join(members)}"
        group = {
            'groupId': group_id,
            'kind': 'shadow_model_exclusive',
            'members': members,
        }
        groups.append(group)
        for name in members:
            model = by_name.get(name)
            if model is not None:
                model['exclusivityGroupIds'].append(group_id)

    for model in scene_models:
        exclusive = set()
        for group in groups:
            if model['name'] in group['members']:
                exclusive.update(m for m in group['members'] if m != model['name'])
        model['mutuallyExclusiveSequencingTargets'] = sorted(exclusive) or None
        model['sharedChannelGroupId'] = next((gid for gid in model['exclusivityGroupIds'] if gid.startswith('shared_channels:')), None)

    return groups


def parse_model_groups(root):
    groups = []
    node = root.find('modelGroups')
    if node is None:
        return groups
    for group in node.findall('modelGroup'):
        models = [m.strip() for m in norm(group.attrib.get('models')).split(',') if m.strip()]
        groups.append({
            'name': group.attrib.get('name', ''),
            'models': models,
            'layoutGroup': group.attrib.get('LayoutGroup', ''),
        })
    return groups


def parse_views(root):
    views = []
    node = root.find('views')
    if node is None:
        return views
    for view in list(node):
        views.append({'name': view.attrib.get('name', view.tag), 'tag': view.tag})
    return views


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--show-dir', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    show_dir = Path(args.show_dir)
    xrgb = ET.parse(show_dir / 'xlights_rgbeffects.xml').getroot()
    controller_bases = load_controller_bases(show_dir / 'xlights_networks.xml')

    models_node = xrgb.find('models')
    model_lookup = {m.attrib.get('name'): m for m in (models_node.findall('model') if models_node is not None else []) if m.attrib.get('name')}
    scene_models = []
    unsupported = []
    type_counts = Counter()
    for model in models_node.findall('model') if models_node is not None else []:
        display_as = norm(model.attrib.get('DisplayAs'))
        type_counts[display_as] += 1
        try:
            scene_models.append(build_model_entry(model, controller_bases, model_lookup))
        except NotImplementedError:
            unsupported.append({'name': model.attrib.get('name'), 'displayAs': display_as, 'reason': 'unsupported_display_as'})
        except Exception as exc:
            unsupported.append({'name': model.attrib.get('name'), 'displayAs': display_as, 'reason': str(exc)})

    group_map = parse_model_groups(xrgb)
    memberships = {}
    for group in group_map:
        for model_name in group['models']:
            memberships.setdefault(model_name, []).append(group['name'])
    for model in scene_models:
        model['groupNames'] = memberships.get(model['name'], [])

    shared_channel_groups = annotate_shared_channel_groups(scene_models)
    audit_models = [m for m in scene_models if m.get('auditEligible', True)]
    excluded_models = [
        {
            'name': m['name'],
            'displayAs': m['displayAs'],
            'layoutGroup': m.get('layoutGroup', ''),
            'reason': 'layout_group_unassigned',
        }
        for m in scene_models if not m.get('auditEligible', True)
    ]

    artifact = {
        'artifactType': 'preview_scene_geometry_v1',
        'artifactVersion': 1,
        'createdAt': None,
        'source': {
            'mode': 'offline_show_xml_export',
            'showFolder': str(show_dir),
            'layoutName': show_dir.name,
            'generatedFromFiles': ['xlights_rgbeffects.xml', 'xlights_networks.xml'],
            'knownGaps': [
                'offline exporter approximates some model-specific screen geometry',
                'polyline curve sampling follows PointData/cPointData but not full preview parity',
                'tree/star/icicle offline geometry is structurally faithful but not preview-exact',
            ],
        },
        'scene': {
            'views': parse_views(xrgb),
            'displayElements': [],
            'cameras': [],
            'models': scene_models,
            'modelGroups': group_map,
            'sharedChannelGroups': shared_channel_groups,
        },
        'summaries': {
            'modelCount': len(scene_models),
            'auditEligibleModelCount': len(audit_models),
            'auditExcludedModelCount': len(excluded_models),
            'auditExcludedModels': excluded_models,
            'exclusivityGroupCount': len(shared_channel_groups),
            'sharedChannelGroupCount': sum(1 for g in shared_channel_groups if g['kind'] == 'shared_channel_exclusive'),
            'shadowModelGroupCount': sum(1 for g in shared_channel_groups if g['kind'] == 'shadow_model_exclusive'),
            'unsupportedModelCount': len(unsupported),
            'unsupportedModels': unsupported,
            'displayTypeCounts': dict(type_counts),
            'sceneBounds': compute_bounds(scene_models),
            'auditSceneBounds': compute_bounds(audit_models),
        },
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(artifact, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': True, 'out': str(out), 'modelCount': len(scene_models), 'unsupportedModelCount': len(unsupported)}, indent=2))


if __name__ == '__main__':
    main()
