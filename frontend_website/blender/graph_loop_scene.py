"""Builds and renders the landing-page graph loop in Blender.

The story, left to right (top to bottom on phones):
  six source files rest on the page  ->  nodes rise out of each file and link
  into a knowledge graph  ->  an agent queries the graph, a cited path lights up
  in blue and runs back down to the exact files it came from  ->  the agent's
  answer appears with one citation chip per file  ->  everything settles back.

The scene is built entirely from code so it renders the same way every time.
The ground is a shadow catcher on a transparent film; scripts/encode-graph-loop.mjs
composites the frames over the page colour, so the video has no edge of its own.

  blender -b --factory-startup -P blender/graph_loop_scene.py -- --layout wide --out /tmp/frames
  options: --layout wide|portrait  --out DIR  --frames START:END  --still F1,F2,...
           --samples N  --percent N  --save FILE.blend  --no-render

Run inside an open Blender (Scripting tab, or exec over the MCP socket) to
build the scene without rendering.
"""

import math
import random
import sys
from dataclasses import dataclass, field

import bmesh
import bpy
from mathutils import Vector

FPS = 24
LOOP_FRAMES = 288  # 12 s; frame 288 is identical to frame 0

# Page palette (frontend_website/src/theme.css, data-theme="paper").
GROUND = "#f4f2ed"
PAPER = "#fffaf1"
INK = "#111317"
INK_SOFT = "#5f5b54"
EDGE = "#a29d93"
THREAD = "#d6d0c4"
THREAD_RESTING = "#e6e2da"  # threads recede while the agent queries the graph
CITED = "#2457d6"

KINDS = ("doc", "image", "table", "audio", "code", "db")
NODES_PER_SOURCE = 3
UP = Vector((0, 0, 1))


# ---------------------------------------------------------------- arguments

def parse_args(argv):
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    opts = {"layout": "wide", "out": None, "frames": None, "still": None,
            "samples": 64, "percent": 100, "save": None, "render": True}
    i = 0
    while i < len(args):
        key = args[i].lstrip("-")
        if key == "no-render":
            opts["render"] = False
            i += 1
            continue
        value = args[i + 1]
        if key in ("samples", "percent"):
            opts[key] = int(value)
        elif key == "still":
            opts["still"] = [int(f) for f in value.split(",")]
        elif key == "frames":
            start, end = value.split(":")
            opts["frames"] = (int(start), int(end))
        else:
            opts[key] = value
        i += 2
    if opts["layout"] not in LAYOUTS:
        raise SystemExit(f"unknown layout {opts['layout']!r}; use one of {sorted(LAYOUTS)}")
    return opts


# ---------------------------------------------------------------- layouts

@dataclass(frozen=True)
class Layout:
    resolution: tuple
    sources: tuple            # (x, y) per KINDS entry
    card_lift: float          # cards float this high above the ground
    card_tilt: float          # degrees the cards lean toward the camera
    graph_box: tuple          # ((x0, x1), (y0, y1), (z0, z1))
    node_spacing: float
    flow: Vector              # direction from sources toward the agent
    agent: Vector
    answer: Vector
    camera_target: Vector
    camera_elevation: float   # degrees
    camera_distance: float
    lens: float
    sway: float = 3.0         # degrees of slow orbit across the loop
    seed: int = 7


LAYOUTS = {
    "wide": Layout(
        resolution=(1440, 608),
        sources=((-5.3, 1.9), (-3.9, 1.2), (-5.3, 0.2), (-3.9, -0.5), (-5.3, -1.5), (-3.9, -2.0)),
        card_lift=0.5,
        card_tilt=48,
        graph_box=((-2.3, 2.3), (-1.6, 1.6), (0.8, 1.8)),
        node_spacing=0.9,
        flow=Vector((1, 0, 0)),
        agent=Vector((3.55, 0.0, 1.3)),
        answer=Vector((5.1, 0.2, 1.15)),
        camera_target=Vector((-0.2, 0.1, 0.75)),
        camera_elevation=30,
        camera_distance=20.0,
        lens=50,
    ),
    "portrait": Layout(
        resolution=(720, 900),
        sources=((-1.8, -3.0), (0.0, -3.0), (1.8, -3.0), (-1.8, -4.4), (0.0, -4.4), (1.8, -4.4)),
        card_lift=0.45,
        card_tilt=30,
        graph_box=((-2.3, 2.3), (-1.3, 1.5), (0.9, 1.9)),
        node_spacing=0.85,
        flow=Vector((0, 1, 0)),
        agent=Vector((-1.0, 3.1, 1.3)),
        answer=Vector((1.0, 3.3, 1.2)),
        camera_target=Vector((0.0, -0.75, 0.9)),
        camera_elevation=42,
        camera_distance=15.5,
        lens=50,
    ),
}


# ---------------------------------------------------------------- timeline (frames)

RISE_START = 10
RISE_SOURCE_STAGGER = 7
RISE_NODE_STAGGER = 5
RISE_LEN = 34
EDGE_DELAY = 4
EDGE_LEN = 14
AGENT_PULSE = 116
QUERY_START = 122
QUERY_LEN = 16
HOP_LEN = 12
CITE_DELAY = 4
CITE_LEN = 16
POP_LEN = 8
ANSWER_LEN = 10
CHIP_STAGGER = 6
RELEASE = 244
RETURN_START = 254
RETURN_LEN = 24  # the last node departs at RETURN_START + 8, so all are home by frame 286


# ---------------------------------------------------------------- colour and materials

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(hex_value):
    h = hex_value.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def _node_tree(name):
    mat = bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    return mat, out


def surface(name, color, roughness=0.55, glow=0.0, coat=0.0):
    mat, out = _node_tree(name)
    bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    if glow:
        bsdf.inputs["Emission Color"].default_value = rgba(color)
        bsdf.inputs["Emission Strength"].default_value = glow
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.15
    mat.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def flat(name, color):
    """Unlit colour: with the Standard view transform it renders as the exact hex."""
    mat, out = _node_tree(name)
    emission = mat.node_tree.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = rgba(color)
    emission.inputs["Strength"].default_value = 1.0
    mat.node_tree.links.new(emission.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_materials():
    return {
        "paper": surface("paper", PAPER, roughness=0.6),
        "ink": surface("ink", INK, roughness=0.5),
        "ink_soft": surface("ink_soft", INK_SOFT, roughness=0.55),
        "node": surface("node", "#ffffff", roughness=0.3, coat=0.4),
        "agent": surface("agent", INK, roughness=0.22, coat=1.0),
        "agent_glyph": flat("agent_glyph", PAPER),
        "edge": flat("edge", EDGE),
        "thread": flat("thread", THREAD),
        "cited_line": flat("cited_line", CITED),
        "cited_solid": surface("cited_solid", CITED, roughness=0.3, glow=0.35, coat=0.5),
    }


# ---------------------------------------------------------------- geometry

def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def mesh_object(name, build, material, parent=None, location=(0, 0, 0), smooth=False, bevel=0.0):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    build(bm)
    for face in bm.faces:
        face.smooth = smooth or bevel > 0
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    obj = bpy.data.objects.new(name, me)
    obj.location = location
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
    return link(obj, parent)


def box(name, size, material, parent=None, location=(0, 0, 0), bevel=0.0):
    def build(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    return mesh_object(name, build, material, parent, location, bevel=bevel)


def sphere(name, radius, material, parent=None, location=(0, 0, 0)):
    def build(bm):
        bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=radius)
    return mesh_object(name, build, material, parent, location, smooth=True)


def cylinder(name, radius, depth, material, parent=None, location=(0, 0, 0), bevel=0.0):
    def build(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=64,
                              radius1=radius, radius2=radius, depth=depth)
    return mesh_object(name, build, material, parent, location, bevel=bevel)


def torus(name, major, minor, material, parent=None, location=(0, 0, 0)):
    def build(bm):
        major_segments, minor_segments = 64, 12
        rings = []
        for i in range(major_segments):
            a = 2 * math.pi * i / major_segments
            centre = Vector((math.cos(a), math.sin(a), 0)) * major
            outward = Vector((math.cos(a), math.sin(a), 0))
            ring = []
            for j in range(minor_segments):
                b = 2 * math.pi * j / minor_segments
                ring.append(bm.verts.new(centre + outward * (minor * math.cos(b)) + UP * (minor * math.sin(b))))
            rings.append(ring)
        for i in range(major_segments):
            a, b = rings[i], rings[(i + 1) % major_segments]
            for j in range(minor_segments):
                k = (j + 1) % minor_segments
                bm.faces.new((a[j], b[j], b[k], a[k]))
    return mesh_object(name, build, material, parent, location, smooth=True)


def prism(name, points_2d, depth, material, parent=None, location=(0, 0, 0)):
    """Extrudes a flat polygon (card-local x, y) upward by depth."""
    def build(bm):
        bottom = [bm.verts.new((x, y, 0)) for x, y in points_2d]
        top = [bm.verts.new((x, y, depth)) for x, y in points_2d]
        bm.faces.new(top)
        bm.faces.new(list(reversed(bottom)))
        n = len(points_2d)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    return mesh_object(name, build, material, parent, location)


def glyph(name, text, size, material, parent=None, location=(0, 0, 0)):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = text
    curve.size = size
    curve.extrude = 0.01
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.materials.append(material)
    obj = bpy.data.objects.new(name, curve)
    obj.location = location
    return link(obj, parent)


def bezier(p0, h0, h1, p1, t):
    s = 1 - t
    return p0 * (s ** 3) + h0 * (3 * s * s * t) + h1 * (3 * s * t * t) + p1 * (t ** 3)


def tube(name, p0, h0, h1, p1, radius, material):
    """A two-point Bezier tube. bevel_factor_start/end are animated to draw it."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.resolution_u = 32
    curve.use_fill_caps = False
    curve.bevel_factor_mapping_start = "RESOLUTION"
    curve.bevel_factor_mapping_end = "RESOLUTION"
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(1)
    a, b = spline.bezier_points
    for point in (a, b):
        point.handle_left_type = "FREE"
        point.handle_right_type = "FREE"
    a.co, a.handle_right, a.handle_left = p0, h0, p0 * 2 - h0
    b.co, b.handle_left, b.handle_right = p1, h1, p1 * 2 - h1
    curve.bevel_factor_start = 0.0
    curve.bevel_factor_end = 0.0
    curve.materials.append(material)
    obj = link(bpy.data.objects.new(name, curve))
    obj.visible_shadow = False
    return obj


def outline(name, width, height, radius, material, parent=None, location=(0, 0, 0)):
    """A rounded-rectangle tube outline in the parent's local XY plane."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    corner, steps = min(width, height) * 0.12, 6
    hw, hh = width / 2 - corner, height / 2 - corner
    points = []
    for cx, cy, start in ((hw, hh, 0), (-hw, hh, 90), (-hw, -hh, 180), (hw, -hh, 270)):
        for k in range(steps + 1):
            a = math.radians(start + 90 * k / steps)
            points.append((cx + corner * math.cos(a), cy + corner * math.sin(a), 0, 1))
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = co
    spline.use_cyclic_u = True
    curve.materials.append(material)
    obj = bpy.data.objects.new(name, curve)
    obj.location = location
    obj.visible_shadow = False
    return link(obj, parent)


# ---------------------------------------------------------------- animation

class Interpolation:
    """New keys use this interpolation while inside the block (default is eased Bezier)."""

    def __init__(self, kind):
        self.kind = kind

    def __enter__(self):
        edit = bpy.context.preferences.edit
        self.previous = edit.keyframe_new_interpolation_type
        edit.keyframe_new_interpolation_type = self.kind

    def __exit__(self, *exc):
        bpy.context.preferences.edit.keyframe_new_interpolation_type = self.previous


def key(target, path, frame, value):
    setattr(target, path, value)
    target.keyframe_insert(data_path=path, frame=frame)


def pop(obj, frame_in, frame_out, length=POP_LEN, size=1.0):
    """Scale from nothing at frame_in, back to nothing by frame_out."""
    full = (size, size, size)
    key(obj, "scale", 0, (0, 0, 0))
    key(obj, "scale", frame_in, (0, 0, 0))
    key(obj, "scale", frame_in + length, full)
    key(obj, "scale", frame_out, full)
    key(obj, "scale", frame_out + length, (0, 0, 0))


def draw_line(obj, start, length, release, release_len):
    """Draw from p0 to p1, then let the line flow out through p1."""
    data = obj.data
    key(data, "bevel_factor_end", 0, 0.0)
    key(data, "bevel_factor_end", start, 0.0)
    key(data, "bevel_factor_end", start + length, 1.0)
    key(data, "bevel_factor_start", 0, 0.0)
    key(data, "bevel_factor_start", release, 0.0)
    key(data, "bevel_factor_start", release + release_len, 1.0)


def key_color(material, frame, hex_value):
    socket = material.node_tree.nodes["Emission"].inputs["Color"]
    socket.default_value = rgba(hex_value)
    socket.keyframe_insert("default_value", frame=frame)


def ease(t):
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- scene pieces

@dataclass
class Source:
    kind: str
    root: object
    anchor: Vector               # where nodes leave the source
    highlight: object = None
    nodes: list = field(default_factory=list)


CARD = (1.0, 0.76, 0.05)
DETAIL = 0.012


def card_details(kind, root, m):
    w, h, d = CARD
    top = d / 2

    def bar(name, x, y, bw, bh, mat=None):
        box(name, (bw, bh, DETAIL), mat or m["ink"], root, (x, y, top + DETAIL / 2), bevel=0.003)

    if kind == "doc":
        bar("doc_title", -0.16, 0.25, 0.48, 0.07)
        for i, width in enumerate((0.74, 0.68, 0.74, 0.52, 0.7)):
            bar(f"doc_line_{i}", -0.37 + width / 2, 0.11 - i * 0.1, width, 0.032, m["ink_soft"])
    elif kind == "table":
        bar("table_head", 0, 0.24, 0.8, 0.1)
        for i in range(4):
            bar(f"table_row_{i}", 0, 0.13 - i * 0.12, 0.8, 0.012, m["ink_soft"])
        for i, x in enumerate((-0.13, 0.14)):
            bar(f"table_col_{i}", x, -0.06, 0.012, 0.5, m["ink_soft"])
        bar("table_cell", 0.27, -0.01, 0.2, 0.07)
    elif kind == "audio":
        for i in range(17):
            x = -0.4 + i * 0.05
            amp = 0.08 + 0.42 * abs(math.sin(i * 0.9) * math.cos(i * 0.31))
            bar(f"audio_bar_{i}", x, 0, 0.026, amp, m["ink"] if i % 4 else m["ink_soft"])
    elif kind == "image":
        prism("image_peak_back", ((-0.1, -0.24), (0.13, 0.08), (0.36, -0.24)), DETAIL, m["ink_soft"], root, (0, 0, top))
        prism("image_peak", ((-0.38, -0.24), (-0.12, 0.14), (0.14, -0.24)), DETAIL * 1.6, m["ink"], root, (0, 0, top))
        cylinder("image_sun", 0.07, DETAIL, m["ink"], root, (0.24, 0.18, top + DETAIL / 2))
    elif kind == "code":
        for i in range(3):
            cylinder(f"code_dot_{i}", 0.022, DETAIL, m["ink_soft"], root, (-0.38 + i * 0.065, 0.27, top + DETAIL / 2))
        for i, (indent, width) in enumerate(((0, 0.42), (0.08, 0.5), (0.16, 0.34), (0.08, 0.28), (0, 0.18))):
            bar(f"code_line_{i}", -0.4 + indent + width / 2, 0.14 - i * 0.095, width, 0.034,
                m["ink"] if i != 2 else m["ink_soft"])


def build_source(kind, xy, layout, m):
    root = bpy.data.objects.new(f"source_{kind}", None)
    link(root)
    if kind == "db":
        root.location = (xy[0], xy[1], 0)
        for i in range(3):
            z = 0.12 + i * 0.22
            cylinder(f"db_disc_{i}", 0.36, 0.18, m["paper"], root, (0, 0, z), bevel=0.02)
            cylinder(f"db_band_{i}", 0.362, 0.025, m["ink"], root, (0, 0, z - 0.035))
        anchor = Vector((xy[0], xy[1], 0.72))
        ring = torus("db_highlight", 0.52, 0.016, m["cited_line"], root, (0, 0, 0.01))
        ring.visible_shadow = False
        return Source(kind, root, anchor, ring)

    root.location = (xy[0], xy[1], layout.card_lift)
    root.rotation_euler = (math.radians(layout.card_tilt), 0, 0)
    w, h, d = CARD
    box(f"{kind}_card", CARD, m["paper"], root, bevel=0.018)
    card_details(kind, root, m)
    frame = outline(f"{kind}_highlight", w + 0.14, h + 0.14, 0.014, m["cited_line"], root, (0, 0, 0))
    bpy.context.view_layer.update()
    anchor = root.matrix_world @ Vector((0, 0, d / 2))
    return Source(kind, root, anchor, frame)


@dataclass
class Node:
    index: int
    position: Vector
    radius: float
    owner: Source = None
    obj: object = None
    arrive: int = 0
    depart: int = 0
    rise: tuple = None           # Bezier control points from the source


def sample_nodes(rng, layout):
    (x0, x1), (y0, y1), (z0, z1) = layout.graph_box
    count = NODES_PER_SOURCE * len(KINDS)
    points = []
    for _ in range(40000):
        if len(points) == count:
            break
        p = Vector((rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(z0, z1)))
        if all((p.xy - q.xy).length >= layout.node_spacing for q in points):
            points.append(p)
    if len(points) < count:
        raise ValueError(f"only placed {len(points)} of {count} nodes")
    return [Node(i, p, rng.uniform(0.1, 0.17)) for i, p in enumerate(points)]


def assign_owners(nodes, sources):
    pairs = sorted(((n.position.xy - s.anchor.xy).length, n.index, si)
                   for n in nodes for si, s in enumerate(sources))
    for _, ni, si in pairs:
        node, source = nodes[ni], sources[si]
        if node.owner is None and len(source.nodes) < NODES_PER_SOURCE:
            node.owner = source
            source.nodes.append(node)


def connect(nodes, spacing):
    """Minimum spanning tree plus short extra links, so every node is reachable."""
    def dist(a, b):
        return (nodes[a].position - nodes[b].position).length

    n = len(nodes)
    in_tree, edges = {0}, set()
    while len(in_tree) < n:
        a, b = min(((a, b) for a in in_tree for b in range(n) if b not in in_tree), key=lambda e: dist(*e))
        edges.add((min(a, b), max(a, b)))
        in_tree.add(b)
    degree = [0] * n
    for a, b in edges:
        degree[a] += 1
        degree[b] += 1
    for a in range(n):
        for b in sorted(range(n), key=lambda b: dist(a, b))[1:4]:
            e = (min(a, b), max(a, b))
            if e not in edges and dist(a, b) < spacing * 1.7 and degree[a] < 4 and degree[b] < 4:
                edges.add(e)
                degree[a] += 1
                degree[b] += 1
    return sorted(edges)


def shortest_path(nodes, edges, start, goal):
    graph = {n.index: [] for n in nodes}
    for a, b in edges:
        w = (nodes[a].position - nodes[b].position).length
        graph[a].append((b, w))
        graph[b].append((a, w))
    best, previous, todo = {start: 0.0}, {}, {start}
    while todo:
        current = min(todo, key=best.get)
        todo.remove(current)
        if current == goal:
            break
        for nxt, w in graph[current]:
            if best[current] + w < best.get(nxt, math.inf):
                best[nxt] = best[current] + w
                previous[nxt] = current
                todo.add(nxt)
    path = [goal]
    while path[-1] != start:
        path.append(previous[path[-1]])
    return list(reversed(path))


def plan_graph(layout, sources):
    """Finds a seed whose cited path is 4-6 hops and touches at least three files."""
    for seed in range(layout.seed, layout.seed + 200):
        for s in sources:
            s.nodes = []
        rng = random.Random(seed)
        try:
            nodes = sample_nodes(rng, layout)
        except ValueError:
            continue
        assign_owners(nodes, sources)
        edges = connect(nodes, layout.node_spacing)
        along = [n.position.dot(layout.flow) for n in nodes]
        entry = max(range(len(nodes)), key=lambda i: along[i] - abs(nodes[i].position.cross(layout.flow).length) * 0.3)
        goal = min(range(len(nodes)), key=lambda i: along[i])
        path = shortest_path(nodes, edges, entry, goal)
        owners = []
        for i in path:
            if nodes[i].owner not in owners:
                owners.append(nodes[i].owner)
        if 4 <= len(path) <= 6 and len(owners) >= 3:
            print(f"graph seed {seed}: {len(nodes)} nodes, {len(edges)} edges, path {path}")
            return nodes, edges, path
    raise RuntimeError("no seed produced a usable cited path; widen graph_box or lower node_spacing")


# ---------------------------------------------------------------- the loop

def build_graph(layout, sources, m):
    nodes, edges, path = plan_graph(layout, sources)

    # Nodes rise out of their source along an arc, drawing a provenance thread.
    with Interpolation("LINEAR"):
        for si, source in enumerate(sources):
            for k, node in enumerate(source.nodes):
                start = RISE_START + si * RISE_SOURCE_STAGGER + k * RISE_NODE_STAGGER
                node.arrive = start + RISE_LEN
                p0, p1 = source.anchor, node.position
                h0 = p0 + UP * 1.1
                h1 = p1 + UP * 0.7
                node.rise = (p0, h0, h1, p1)
                node.obj = sphere(f"node_{node.index}", node.radius, m["node"], location=p0)
                thread = tube(f"thread_{node.index}", p0, h0, h1, p1, 0.006, m["thread"])
                node.depart = RETURN_START + (node.index * 5) % 9
                ret_end = node.depart + RETURN_LEN
                key(thread.data, "bevel_factor_start", 0, 0.0)
                key(thread.data, "bevel_factor_end", 0, 0.0)
                key(node.obj, "location", 0, p0)
                key(node.obj, "scale", 0, (0, 0, 0))
                for f in list(range(start, node.arrive + 1)) + list(range(node.depart, ret_end + 1)):
                    t = ease((f - start) / RISE_LEN) if f <= node.arrive else 1 - ease((f - node.depart) / RETURN_LEN)
                    key(node.obj, "location", f, bezier(p0, h0, h1, p1, t))
                    key(thread.data, "bevel_factor_end", f, t)
                    grow = min(1.0, t * 4)
                    key(node.obj, "scale", f, (grow, grow, grow))

    for frame, colour in ((0, THREAD), (AGENT_PULSE - 8, THREAD), (QUERY_START + 8, THREAD_RESTING),
                          (RETURN_START - 8, THREAD_RESTING), (RETURN_START + 6, THREAD)):
        key_color(m["thread"], frame, colour)

    # Relationships link up once both ends have arrived.
    lines = {}
    for i, (a, b) in enumerate(edges):
        pa, pb = nodes[a].position, nodes[b].position
        sag = Vector((0, 0, -0.06))
        h0, h1 = pa.lerp(pb, 1 / 3) + sag, pa.lerp(pb, 2 / 3) + sag
        line = tube(f"edge_{a}_{b}", pa, h0, h1, pb, 0.011, m["edge"])
        start = max(nodes[a].arrive, nodes[b].arrive) + EDGE_DELAY + (i * 3) % 7
        draw_line(line, start, EDGE_LEN, RELEASE + 4 + (i * 2) % 6, EDGE_LEN)
        lines[(a, b)] = (pa, h0, h1, pb)
    return nodes, edges, path, lines


def build_agent(layout, camera, m):
    agent = sphere("agent", 0.42, m["agent"], location=layout.agent)
    mark = glyph("agent_mark", ">_", 0.34, m["agent_glyph"], agent, (0, 0, 0))
    track = mark.constraints.new("TRACK_TO")
    track.target = camera
    track.track_axis = "TRACK_Z"
    track.up_axis = "UP_Y"
    # Push the glyph to the sphere's surface on the camera side.
    to_camera = (camera.matrix_world.translation - layout.agent).normalized()
    mark.location = to_camera * 0.43
    key(agent, "scale", 0, (1, 1, 1))
    key(agent, "scale", AGENT_PULSE, (1, 1, 1))
    key(agent, "scale", AGENT_PULSE + 6, (1.14, 1.14, 1.14))
    key(agent, "scale", AGENT_PULSE + 14, (1, 1, 1))
    return agent


def build_answer(layout, camera, cited_count, start, m):
    root = bpy.data.objects.new("answer", None)
    root.location = layout.answer
    link(root)
    track = root.constraints.new("TRACK_TO")
    track.target = camera
    track.track_axis = "TRACK_Z"
    track.up_axis = "UP_Y"
    w, h, d = 1.55, 0.98, 0.05
    box("answer_card", (w, h, d), m["paper"], root, bevel=0.018)
    top = d / 2 + DETAIL / 2
    for i, width in enumerate((1.18, 1.05, 0.7)):
        box(f"answer_line_{i}", (width, 0.05, DETAIL), m["ink"] if i == 0 else m["ink_soft"], root,
            (-0.59 + width / 2, 0.3 - i * 0.14, top), bevel=0.003)
    pop(root, start, RELEASE, ANSWER_LEN)
    for i in range(cited_count):
        chip = box(f"answer_chip_{i}", (0.24, 0.13, DETAIL * 2), m["cited_solid"], root,
                   (-0.5 + i * 0.3, -0.27, top + DETAIL / 2), bevel=0.03)
        pop(chip, start + ANSWER_LEN + i * CHIP_STAGGER, RELEASE - 4, 6)


def build_citation(layout, nodes, path, lines, agent, camera, m):
    entry = nodes[path[0]]
    p0, p1 = layout.agent, entry.position
    query = tube("query", p0, p0.lerp(p1, 1 / 3) + UP * 0.25, p0.lerp(p1, 2 / 3) + UP * 0.25, p1, 0.02, m["cited_line"])
    draw_line(query, QUERY_START, QUERY_LEN, RELEASE, 12)

    reached = QUERY_START + QUERY_LEN
    cited_sources = []
    last_cite = reached
    for step, ni in enumerate(path):
        node = nodes[ni]
        at = reached + step * HOP_LEN
        cap = sphere(f"cited_node_{ni}", node.radius * 1.08, m["cited_solid"], location=node.position)
        pop(cap, at, RELEASE + 2, 6)
        ring = torus(f"cited_ring_{ni}", node.radius * 1.9, 0.011, m["cited_line"], location=node.position)
        ring.visible_shadow = False
        pop(ring, at, RELEASE + 2, 8)

        if step + 1 < len(path):
            a, b = ni, path[step + 1]
            pa, h0, h1, pb = lines[(min(a, b), max(a, b))]
            if a > b:
                pa, h0, h1, pb = pb, h1, h0, pa
            hop = tube(f"cited_edge_{a}_{b}", pa, h0, h1, pb, 0.02, m["cited_line"])
            draw_line(hop, at, HOP_LEN, RELEASE + 2, 12)

        # The first node from each file sends the citation back down to it.
        source = node.owner
        if source in cited_sources:
            continue
        cited_sources.append(source)
        q0, qh0, qh1, q1 = node.rise
        back = tube(f"cited_thread_{ni}", q1, qh1, qh0, q0, 0.016, m["cited_line"])
        cite_at = at + CITE_DELAY
        draw_line(back, cite_at, CITE_LEN, RELEASE + 6, 14)
        pop(source.highlight, cite_at + CITE_LEN - 2, RELEASE + 6, POP_LEN)
        last_cite = cite_at + CITE_LEN

    answer_at = reached + (len(path) - 1) * HOP_LEN + 8
    build_answer(layout, camera, len(cited_sources), answer_at, m)
    print(f"cited files: {[s.kind for s in cited_sources]}; last citation lands at frame {last_cite}")


# ---------------------------------------------------------------- stage

def reset_scene():
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                       bpy.data.lights, bpy.data.cameras, bpy.data.actions):
        for block in list(collection):
            collection.remove(block)


def build_stage(layout, opts):
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    scene.frame_end = LOOP_FRAMES - 1
    scene.render.resolution_x, scene.render.resolution_y = layout.resolution
    scene.render.resolution_percentage = opts["percent"]
    scene.render.film_transparent = True
    scene.render.use_persistent_data = True
    scene.render.dither_intensity = 1.0
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"

    scene.render.engine = "CYCLES"
    cycles = scene.cycles
    cycles.samples = opts["samples"]
    cycles.use_adaptive_sampling = True
    cycles.adaptive_threshold = 0.02
    cycles.use_denoising = True
    cycles.max_bounces = 4
    cycles.diffuse_bounces = 2
    cycles.glossy_bounces = 2
    cycles.transparent_max_bounces = 4
    cycles.caustics_reflective = False
    cycles.caustics_refractive = False
    use_gpu(scene)

    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    if bpy.app.version < (5, 0, 0):
        world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = rgba("#ffffff")
    background.inputs["Strength"].default_value = 0.75

    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 1.9
    sun_data.angle = math.radians(18)
    sun = link(bpy.data.objects.new("sun", sun_data))
    direction = Vector((0.45, 0.65, -1.0)).normalized()
    sun.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    ground = mesh_object("ground", lambda bm: bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=60),
                         surface("ground", GROUND))
    ground.is_shadow_catcher = True

    rig = link(bpy.data.objects.new("camera_rig", None))
    rig.location = layout.camera_target
    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = layout.lens
    cam_data.sensor_fit = "AUTO"
    camera = link(bpy.data.objects.new("camera", cam_data), rig)
    el = math.radians(layout.camera_elevation)
    camera.location = (0, -layout.camera_distance * math.cos(el), layout.camera_distance * math.sin(el))
    aim = camera.constraints.new("TRACK_TO")
    aim.target = rig
    aim.track_axis = "TRACK_NEGATIVE_Z"
    aim.up_axis = "UP_Y"
    scene.camera = camera
    # A slow orbit that is at its extremes on the loop seam, so it never jolts.
    sway = math.radians(layout.sway)
    key(rig, "rotation_euler", 0, (0, 0, sway))
    key(rig, "rotation_euler", LOOP_FRAMES // 2, (0, 0, -sway))
    key(rig, "rotation_euler", LOOP_FRAMES, (0, 0, sway))
    bpy.context.view_layer.update()
    return camera


def use_gpu(scene):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.get_devices()
        devices = [d for d in prefs.devices if d.type == backend]
        if devices:
            for d in prefs.devices:
                d.use = d.type == backend
            scene.cycles.device = "GPU"
            # OptiX denoises on the GPU; Open Image Denoise fell back to the CPU here at ~5 s a frame.
            scene.cycles.denoiser = "OPTIX" if backend == "OPTIX" else "OPENIMAGEDENOISE"
            scene.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
            print(f"rendering on {backend}: {', '.join(d.name for d in devices)}")
            return
    scene.cycles.device = "CPU"
    print("no GPU backend found; rendering on CPU")


def build(opts):
    layout = LAYOUTS[opts["layout"]]
    reset_scene()
    m = make_materials()
    camera = build_stage(layout, opts)
    sources = [build_source(kind, xy, layout, m) for kind, xy in zip(KINDS, layout.sources)]
    for source in sources:
        key(source.highlight, "scale", 0, (0, 0, 0))  # hidden until cited
    nodes, edges, path, lines = build_graph(layout, sources, m)
    agent = build_agent(layout, camera, m)
    build_citation(layout, nodes, path, lines, agent, camera, m)
    bpy.context.scene.frame_set(0)


def render(opts):
    scene = bpy.context.scene
    out = opts["out"].rstrip("/")
    if opts["still"] is not None:
        for frame in opts["still"]:
            scene.frame_set(frame)
            scene.render.filepath = f"{out}/still_{opts['layout']}_{frame:04d}.png"
            bpy.ops.render.render(write_still=True)
        return
    start, end = opts["frames"] or (0, LOOP_FRAMES - 1)
    scene.frame_start, scene.frame_end = start, end
    scene.render.filepath = f"{out}/"
    scene.render.use_file_extension = True
    bpy.ops.render.render(animation=True)


def main():
    opts = parse_args(sys.argv)
    build(opts)
    if opts["save"]:
        bpy.ops.wm.save_as_mainfile(filepath=opts["save"])
    if opts["render"] and opts["out"]:
        render(opts)


if __name__ == "__main__":
    main()
