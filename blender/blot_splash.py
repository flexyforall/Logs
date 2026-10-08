"""
Blot (Belote) splash screen previs — Blender scene builder.

Usage
-----
  GUI:       open Blender > Scripting tab > open this file > Run Script.
             The scene is built; press Space to play, Numpad 0 for camera view.
  Headless:  blender -b -P blot_splash.py -- --render
             Builds the scene, saves blot_splash.blend, renders PNG stills
             (1s, 3s, 5s, 7s, last frame) and blot_splash_preview.mp4.
  Options:   --render     render stills + video after building
             --stills     render only the stills
             --scale N    resolution percentage (default 100 = 1080x1920)
             --out DIR    output folder (default: folder of this script)

Tested with Blender 5.1; written to also run on Blender 4.2+.
Characters are proxies: silhouette, color, placement and timing only.
"""

import bpy
import math
import os
import random
import sys
from mathutils import Matrix, Vector

random.seed(7)

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DO_RENDER = "--render" in argv
DO_STILLS = DO_RENDER or "--stills" in argv
RES_SCALE = int(argv[argv.index("--scale") + 1]) if "--scale" in argv else 100
try:
    _here = os.path.dirname(os.path.abspath(__file__))
except NameError:
    _here = ""
if not _here or not os.path.isdir(_here) or _here.endswith(".blend"):
    _here = os.path.join(os.path.expanduser("~"), "blot_splash")
OUT_DIR = argv[argv.index("--out") + 1] if "--out" in argv else _here
os.makedirs(OUT_DIR, exist_ok=True)

FPS = 30
FRAME_END = 300  # 10 s

# Key story beats (frames)
F_BOSS_SLAM = 54
F_KNIGHT_PUNCH = 108
F_COWBOY_FLICK = 142
F_COWBOY_LAND = 168
F_MEDUSA_LAND = 222

TABLE_TOP = 0.77           # felt surface height
CARD_W, CARD_H, CARD_T = 0.09, 0.126, 0.002
SEAT_DIST = 1.35

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = FRAME_END
scene.render.fps = FPS
scene.render.resolution_x = 1080
scene.render.resolution_y = 1920
scene.render.resolution_percentage = RES_SCALE

for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        pass


# ---------------------------------------------------------------- helpers
def mat(name, color, metallic=0.0, rough=0.5, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            m.blend_method = "BLEND"
    return m


def bsdf_of(m):
    return m.node_tree.nodes.get("Principled BSDF")


def volume_mat(name, color, density):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*color, 1)
    vol.inputs["Density"].default_value = density
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return m, vol


def link(obj):
    if obj.name not in scene.collection.objects:
        scene.collection.objects.link(obj)
    return obj


def empty(name, loc=(0, 0, 0), parent=None, size=0.1):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    link(e)
    e.parent = parent
    e.location = loc
    return e


def prim(kind, name, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0),
         material=None, parent=None, bevel=0.0, smooth=True, **kw):
    ops = {
        "cube": bpy.ops.mesh.primitive_cube_add,
        "sphere": bpy.ops.mesh.primitive_uv_sphere_add,
        "ico": bpy.ops.mesh.primitive_ico_sphere_add,
        "cyl": bpy.ops.mesh.primitive_cylinder_add,
        "cone": bpy.ops.mesh.primitive_cone_add,
        "torus": bpy.ops.mesh.primitive_torus_add,
        "plane": bpy.ops.mesh.primitive_plane_add,
    }
    if kind == "sphere":
        kw.setdefault("segments", 24)
        kw.setdefault("ring_count", 12)
    if kind in ("cyl", "cone"):
        kw.setdefault("vertices", 24)
    ops[kind](**kw)
    o = bpy.context.active_object
    o.name = name
    if parent is not None:
        o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    if material is not None:
        o.data.materials.append(material)
    if bevel > 0:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    if smooth and kind != "plane":
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def key(obj, frame, loc=None, rot=None, scale=None):
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert("location", frame=frame)
    if rot is not None:
        obj.rotation_euler = rot
        obj.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = scale if hasattr(scale, "__len__") else (scale,) * 3
        obj.keyframe_insert("scale", frame=frame)


def key_value(owner, prop, frame, value):
    setattr(owner, prop, value)
    owner.keyframe_insert(prop, frame=frame)


def fcurves_of(id_data):
    """F-curves of an ID's action — works with legacy and slotted actions."""
    ad = id_data.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    if hasattr(act, "fcurves") and len(getattr(act, "fcurves", [])):
        return list(act.fcurves)
    try:
        from bpy_extras import anim_utils
        cb = anim_utils.action_get_channelbag_for_slot(act, ad.action_slot)
        return list(cb.fcurves) if cb else []
    except Exception:
        out = []
        for layer in getattr(act, "layers", []):
            for strip in layer.strips:
                for cb in getattr(strip, "channelbags", []):
                    out.extend(cb.fcurves)
        return out


def l2w(base, theta, local):
    """Seat-local -> world. Local +Y points at the table centre."""
    x, y, z = local
    c, s = math.cos(theta), math.sin(theta)
    return Vector((base[0] + c * x - s * y, base[1] + s * x + c * y, z))


# ---------------------------------------------------------------- materials
M = {
    "wood": mat("Wood", (0.16, 0.07, 0.03), rough=0.45),
    "wood_dark": mat("WoodDark", (0.05, 0.025, 0.012), rough=0.6),
    "felt": mat("Felt", (0.02, 0.22, 0.08), rough=0.95),
    "floor": mat("Floor", (0.03, 0.018, 0.012), rough=0.8),
    "gold": mat("Gold", (1.0, 0.68, 0.22), metallic=1.0, rough=0.25),
    "steel": mat("Steel", (0.62, 0.63, 0.66), metallic=1.0, rough=0.3),
    "silver": mat("Silver", (0.8, 0.82, 0.85), metallic=1.0, rough=0.22),
    "skin": mat("Skin", (0.72, 0.47, 0.33), rough=0.55),
    "skin_tan": mat("SkinTan", (0.62, 0.38, 0.24), rough=0.6),
    "white": mat("Shirt", (0.85, 0.82, 0.74), rough=0.6),
    "paper": mat("Paper", (0.92, 0.9, 0.82), rough=0.8),
    "card_face": mat("CardFace", (0.93, 0.9, 0.8), rough=0.4),
    "card_back": mat("CardBack", (0.45, 0.03, 0.05), rough=0.35),
    "ink_red": mat("InkRed", (0.75, 0.02, 0.03), rough=0.4),
    "ink_black": mat("InkBlack", (0.02, 0.02, 0.025), rough=0.4),
    "glass": mat("Ashtray", (0.05, 0.06, 0.07), metallic=0.3, rough=0.1),
    "ash": mat("Ash", (0.25, 0.24, 0.23), rough=1.0),
    "eye_white": mat("EyeWhite", (0.9, 0.9, 0.88), rough=0.3),
    "pupil": mat("Pupil", (0.02, 0.03, 0.05), rough=0.3),
    # BOSS
    "suit": mat("Suit", (0.035, 0.03, 0.035), rough=0.7),
    "tie": mat("Tie", (0.32, 0.01, 0.03), rough=0.5),
    "hair_dark": mat("HairDark", (0.03, 0.02, 0.015), rough=0.5),
    "red_eye": mat("RedEye", (1.0, 0.1, 0.02), emit=(1.0, 0.1, 0.02), strength=8),
    "cigar": mat("Cigar", (0.18, 0.08, 0.03), rough=0.8),
    "cigar_tip": mat("CigarTip", (1.0, 0.25, 0.02), emit=(1.0, 0.3, 0.02), strength=15),
    # KNIGHT
    "hair_blond": mat("HairBlond", (0.9, 0.85, 0.66), rough=0.5),
    "teal": mat("Teal", (0.02, 0.12, 0.14), rough=0.6),
    # COWBOY
    "hat": mat("Hat", (0.55, 0.42, 0.26), rough=0.85),
    "hat_band": mat("HatBand", (0.2, 0.1, 0.05), rough=0.6),
    "hair_brown": mat("HairBrown", (0.17, 0.09, 0.04), rough=0.6),
    "vest": mat("Vest", (0.13, 0.06, 0.03), rough=0.7),
    "bandana": mat("Bandana", (0.42, 0.07, 0.03), rough=0.7),
    # MEDUSA
    "medusa_skin": mat("MedusaSkin", (0.36, 0.5, 0.32), rough=0.55),
    "snake": mat("Snake", (0.03, 0.18, 0.14), rough=0.4),
    "snake_eye": mat("SnakeEye", (1.0, 0.8, 0.05), emit=(1.0, 0.75, 0.05), strength=4),
    "toga": mat("Toga", (0.22, 0.04, 0.17), rough=0.65),
    "stone": mat("Stone", (0.55, 0.53, 0.5), rough=0.95),
    # FX
    "spark": mat("Spark", (1.0, 0.6, 0.15), emit=(1.0, 0.55, 0.12), strength=40),
    "shock": mat("Shockwave", (1.0, 0.75, 0.25), emit=(1.0, 0.7, 0.2), strength=25),
    "dust": mat("Dust", (0.6, 0.57, 0.52), rough=1.0, alpha=0.55),
    "bulb": mat("Bulb", (1.0, 0.8, 0.5), emit=(1.0, 0.72, 0.4), strength=30),
    "shade": mat("Shade", (0.09, 0.2, 0.12), metallic=0.6, rough=0.35),
}

# Card back gold border
M["card_back_trim"] = M["gold"]

# ---------------------------------------------------------------- world
world = bpy.data.worlds.new("Room")
scene.world = world
world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes.get("Background")
bg.inputs["Color"].default_value = (0.004, 0.004, 0.006, 1)
bg.inputs["Strength"].default_value = 1.0
wvol = wnt.nodes.new("ShaderNodeVolumePrincipled")
wvol.inputs["Density"].default_value = 0.006
wvol.inputs["Color"].default_value = (1.0, 0.92, 0.85, 1)
wnt.links.new(wvol.outputs[0], wnt.nodes["World Output"].inputs["Volume"])

ee = scene.eevee
for attr, val in (("use_volumetric_shadows", True), ("volumetric_tile_size", "4"),
                  ("volumetric_end", 12.0), ("taa_render_samples", 64),
                  ("use_shadows", True), ("use_raytracing", True),
                  ("use_gtao", True)):
    try:
        setattr(ee, attr, val)
    except (AttributeError, TypeError):
        pass
scene.view_settings.view_transform = "AgX" if "AgX" in [
    i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items
] else "Filmic"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass

# ---------------------------------------------------------------- room / table
prim("plane", "Floor", loc=(0, 0, 0), scale=(6, 6, 1), material=M["floor"])

table = empty("Table", (0, 0, 0))
prim("cyl", "TableTop", loc=(0, 0, 0.73), scale=(1.0, 1.0, 0.03),
     material=M["wood"], parent=table, bevel=0.01, vertices=64)
prim("cyl", "Felt", loc=(0, 0, 0.765), scale=(0.9, 0.9, 0.005),
     material=M["felt"], parent=table, vertices=64)
prim("torus", "TableRim", loc=(0, 0, 0.765), material=M["wood_dark"], parent=table,
     major_radius=0.95, minor_radius=0.025, major_segments=64)
prim("cyl", "Pedestal", loc=(0, 0, 0.36), scale=(0.12, 0.12, 0.36),
     material=M["wood_dark"], parent=table)
prim("cyl", "Foot", loc=(0, 0, 0.03), scale=(0.5, 0.5, 0.03),
     material=M["wood_dark"], parent=table)

# Hanging lamp
LAMP_Z = 1.9
prim("cyl", "LampCord", loc=(0, 0, LAMP_Z + 1.5), scale=(0.008, 0.008, 1.5),
     material=M["ink_black"])
prim("cone", "LampShade", loc=(0, 0, LAMP_Z), scale=(0.32, 0.32, 0.16),
     material=M["shade"], radius1=1.0, radius2=0.25, depth=1.0, end_fill_type="NOTHING")
bpy.context.active_object.modifiers.new("Solid", "SOLIDIFY").thickness = 0.02
prim("sphere", "Bulb", loc=(0, 0, LAMP_Z - 0.06), scale=(0.06,) * 3, material=M["bulb"])

lamp_data = bpy.data.lights.new("LampKey", "SPOT")
lamp_data.energy = 380
lamp_data.color = (1.0, 0.68, 0.38)
lamp_data.spot_size = math.radians(85)
lamp_data.spot_blend = 0.35
lamp_data.shadow_soft_size = 0.08
lamp_key = link(bpy.data.objects.new("LampKey", lamp_data))
lamp_key.location = (0, 0, LAMP_Z - 0.08)

fill_data = bpy.data.lights.new("LampGlow", "POINT")
fill_data.energy = 25
fill_data.color = (1.0, 0.6, 0.3)
fill_data.shadow_soft_size = 0.1
link(bpy.data.objects.new("LampGlow", fill_data)).location = (0, 0, LAMP_Z + 0.02)


def rim_light(name, pos, target):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = 70
    d.size = 1.2
    d.color = (0.35, 0.55, 1.0)
    o = link(bpy.data.objects.new(name, d))
    o.location = pos
    c = o.constraints.new("TRACK_TO")
    c.target = empty(name + "_Aim", target, size=0.05)
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    return o


# ---------------------------------------------------------------- cards
SUIT_GLYPH = {"S": "♠", "H": "♥", "D": "♦", "C": "♣"}
_card_count = [0]


def make_card(rank="", suit="S", face_mat=None, ink_mat=None):
    """Card root empty; card lies flat, face up (+Z), centred on the root."""
    _card_count[0] += 1
    n = "Card_%02d_%s%s" % (_card_count[0], rank, suit)
    root = empty(n, size=0.04)
    prim("cube", n + "_Body", scale=(CARD_W / 2, CARD_H / 2, CARD_T / 2),
         material=M["card_back"], parent=root, bevel=0.0, smooth=False)
    face = prim("plane", n + "_Face", loc=(0, 0, CARD_T / 2 + 0.0003),
                scale=(CARD_W / 2 - 0.003, CARD_H / 2 - 0.003, 1),
                material=face_mat or M["card_face"], parent=root)
    # back trim (gold frame under the card)
    prim("plane", n + "_BackTrim", loc=(0, 0, -CARD_T / 2 - 0.0003), rot=(math.pi, 0, 0),
         scale=(CARD_W / 2 - 0.008, CARD_H / 2 - 0.008, 1),
         material=M["card_back_trim"], parent=root)
    prim("plane", n + "_BackIn", loc=(0, 0, -CARD_T / 2 - 0.0006), rot=(math.pi, 0, 0),
         scale=(CARD_W / 2 - 0.012, CARD_H / 2 - 0.012, 1),
         material=M["card_back"], parent=root)
    if rank:
        ink = ink_mat or (M["ink_red"] if suit in "HD" else M["ink_black"])
        for txt, size, loc in ((rank, 0.05, (0, 0.018, 0)),
                               (SUIT_GLYPH[suit], 0.06, (0, -0.035, 0))):
            cu = bpy.data.curves.new(n + "_T", "FONT")
            cu.body = txt
            cu.size = size
            cu.align_x = "CENTER"
            cu.align_y = "CENTER"
            cu.extrude = 0.0004
            t = link(bpy.data.objects.new(n + "_Txt", cu))
            t.data.materials.append(ink)
            t.parent = root
            t.location = (loc[0], loc[1], CARD_T / 2 + 0.0008)
    return root


# Centre pile (already-played cards)
pile_cards = []
for i, (r, s) in enumerate([("7", "C"), ("Q", "D"), ("9", "S"), ("8", "H"), ("10", "C")]):
    c = make_card(r, s)
    c.location = (random.uniform(-0.05, 0.05), random.uniform(-0.05, 0.05),
                  TABLE_TOP + CARD_T / 2 + i * CARD_T)
    c.rotation_euler = (0, 0, random.uniform(-0.9, 0.9))
    pile_cards.append(c)

# Remaining deck (face down) near the notepad
for i in range(10):
    c = make_card()
    c.location = (0.5, 0.42, TABLE_TOP + CARD_T / 2 + i * CARD_T)
    c.rotation_euler = (math.pi, 0, 0.6 + random.uniform(-0.03, 0.03))

# Props: coins, notepad, ashtray
coins = []
for i, (x, y) in enumerate([(-0.45, -0.5), (-0.42, -0.53), (0.55, 0.15),
                            (0.58, 0.2), (-0.55, 0.35), (0.1, 0.6), (0.14, 0.58)]):
    stack = 1 + (i % 3)
    for k in range(stack):
        co = prim("cyl", "Coin_%d_%d" % (i, k), material=M["gold"],
                  loc=(x + random.uniform(-0.004, 0.004), y, TABLE_TOP + 0.003 + k * 0.006),
                  scale=(0.022, 0.022, 0.003), vertices=20)
        coins.append(co)

prim("cube", "Notepad", loc=(0.45, -0.45, TABLE_TOP + 0.004), rot=(0, 0, -0.35),
     scale=(0.08, 0.11, 0.004), material=M["paper"], bevel=0.002)
prim("cyl", "Pencil", loc=(0.53, -0.42, TABLE_TOP + 0.008), rot=(math.pi / 2, 0, 0.3),
     scale=(0.005, 0.005, 0.08), material=M["gold"], vertices=6)
prim("cyl", "Ashtray", loc=(-0.6, -0.3, TABLE_TOP + 0.015), scale=(0.07, 0.07, 0.015),
     material=M["glass"], bevel=0.005)
prim("cyl", "AshtrayAsh", loc=(-0.6, -0.3, TABLE_TOP + 0.031), scale=(0.055, 0.055, 0.002),
     material=M["ash"])


# ---------------------------------------------------------------- characters
def label(text, parent, z):
    cu = bpy.data.curves.new("Label_" + text, "FONT")
    cu.body = text
    cu.size = 0.12
    cu.align_x = "CENTER"
    o = link(bpy.data.objects.new("Label_" + text, cu))
    o.parent = parent
    o.location = (0, 0, z)
    o.rotation_euler = (math.pi / 2, 0, math.pi)
    o.hide_render = True
    o.show_in_front = True
    return o


def arm(name, root, shoulder_local, hand_obj, material, radius):
    """Stretchy arm: unit-length cylinder along +Y, stretched to the hand."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=1.0)
    a = bpy.context.active_object
    a.name = name
    a.data.transform(Matrix.Translation((0, 0.5, 0)) @ Matrix.Rotation(-math.pi / 2, 4, "X"))
    for p in a.data.polygons:
        p.use_smooth = True
    a.data.materials.append(material)
    a.parent = root
    a.location = shoulder_local
    c = a.constraints.new("STRETCH_TO")
    c.target = hand_obj
    c.rest_length = 1.0
    c.volume = "NO_VOLUME"
    return a


def seat(name, angle_to_centre):
    """Create a seat root. angle: world position angle around the table."""
    pos = (SEAT_DIST * math.cos(angle_to_centre), SEAT_DIST * math.sin(angle_to_centre), 0)
    # local +Y must point to the centre
    theta = math.atan2(-pos[1], -pos[0]) - math.pi / 2
    root = empty(name, pos, size=0.3)
    root.rotation_euler = (0, 0, theta)
    # stool
    prim("cube", name + "_Stool", loc=(0, -0.05, 0.25), scale=(0.28, 0.28, 0.25),
         material=M["wood_dark"], parent=root, bevel=0.02)
    return root, pos, theta


def eyes(head, mat_l, mat_r, y=0.17, z=0.03, spread=0.07, r=0.028):
    for side, m in ((-1, mat_l), (1, mat_r)):
        prim("sphere", head.name + ("_EyeL" if side < 0 else "_EyeR"),
             loc=(side * spread, y, z), scale=(r,) * 3, material=m, parent=head)


def play_spot(theta, base, dist=0.4):
    d = Vector((-base[0], -base[1], 0)).normalized()
    p = Vector((0, 0, 0)) - d * dist
    return Vector((p.x, p.y, TABLE_TOP + CARD_T / 2 + 0.006))


characters = {}

# ---- BOSS (south)
boss, boss_pos, boss_th = seat("BOSS", -math.pi / 2)
prim("cube", "Boss_Torso", loc=(0, 0, 0.98), scale=(0.48, 0.27, 0.42),
     material=M["suit"], parent=boss, bevel=0.12)
prim("cube", "Boss_Shirt", loc=(0, 0.255, 1.15), scale=(0.12, 0.03, 0.22),
     material=M["white"], parent=boss, bevel=0.02)
prim("cube", "Boss_Tie", loc=(0, 0.28, 1.12), scale=(0.04, 0.02, 0.18),
     material=M["tie"], parent=boss, bevel=0.01)
prim("sphere", "Boss_ShoulderL", loc=(-0.42, 0, 1.3), scale=(0.2, 0.2, 0.14),
     material=M["suit"], parent=boss)
prim("sphere", "Boss_ShoulderR", loc=(0.42, 0, 1.3), scale=(0.2, 0.2, 0.14),
     material=M["suit"], parent=boss)
boss_head = prim("sphere", "Boss_Head", loc=(0, 0.04, 1.6), scale=(0.2, 0.2, 0.22),
                 material=M["skin"], parent=boss)
prim("sphere", "Boss_Hair", loc=(0, -0.03, 0.08), scale=(1.02, 1.0, 0.75),
     material=M["hair_dark"], parent=boss_head)
prim("cube", "Boss_JawPlate", loc=(-0.62, 0.35, -0.38), rot=(0, 0.3, 0.4),
     scale=(0.28, 0.42, 0.38), material=M["steel"], parent=boss_head, bevel=0.05)
eyes(boss_head, M["red_eye"], M["pupil"], y=0.88, z=0.12, spread=0.36, r=0.13)
cigar = prim("cyl", "Boss_Cigar", loc=(0.2, 0.22, 1.5), rot=(math.radians(80), 0, 0.5),
             scale=(0.014, 0.014, 0.08), material=M["cigar"], parent=boss)
prim("cyl", "Boss_CigarTip", loc=(0, 0, 1.0), scale=(1.05, 1.05, 0.08),
     material=M["cigar_tip"], parent=cigar)

boss_hand = prim("cube", "Boss_RoboHand", scale=(0.06, 0.07, 0.04), material=M["steel"],
                 bevel=0.015)
boss_idle = prim("sphere", "Boss_HandR", parent=boss, loc=(0.3, 0.42, 0.86),
                 scale=(0.07, 0.08, 0.05), material=M["skin"])
prim("torus", "Boss_Ring", parent=boss_idle, loc=(0.2, 0.3, 0.3), scale=(0.35,) * 3,
     material=M["gold"], major_radius=1.0, minor_radius=0.3)
arm("Boss_ArmL", boss, (-0.42, 0.0, 1.22), boss_hand, M["suit"], 0.1)
arm("Boss_ArmR", boss, (0.42, 0.0, 1.22), boss_idle, M["suit"], 0.1)
label("BOSS", boss, 2.05)

# ---- KNIGHT (west)
knight, knight_pos, knight_th = seat("KNIGHT", math.pi)
prim("cube", "Knight_Torso", loc=(0, 0, 1.0), scale=(0.3, 0.2, 0.38),
     material=M["silver"], parent=knight, bevel=0.08)
prim("cube", "Knight_Collar", loc=(0, 0.02, 1.38), scale=(0.13, 0.12, 0.06),
     material=M["teal"], parent=knight, bevel=0.03)
prim("cube", "Knight_Trim", loc=(0, 0.19, 1.0), scale=(0.31, 0.02, 0.03),
     material=M["gold"], parent=knight)
for side in (-1, 1):
    pa = prim("sphere", "Knight_Pauldron" + ("L" if side < 0 else "R"),
              loc=(side * 0.36, 0, 1.3), scale=(0.18, 0.17, 0.12),
              material=M["silver"], parent=knight)
    prim("cone", pa.name + "_Star", loc=(side * 0.45, 0, 0.55), rot=(0, side * 1.2, 0),
         scale=(0.45, 0.45, 0.35), material=M["gold"], parent=pa, vertices=4)
knight_head = prim("sphere", "Knight_Head", loc=(0, 0.04, 1.57), scale=(0.16, 0.17, 0.19),
                   material=M["skin"], parent=knight)
for i in range(9):
    a = -1.1 + i * 0.28
    prim("cone", "Knight_Spike%d" % i, loc=(math.sin(a) * 0.55, -0.1 + math.cos(a) * 0.15, 0.75),
         rot=(-0.7 + random.uniform(-0.2, 0.2), a * 0.9, 0), scale=(0.3, 0.3, 0.6),
         material=M["hair_blond"], parent=knight_head, vertices=6)
eyes(knight_head, M["pupil"], M["pupil"], y=0.9, z=0.12, spread=0.38, r=0.1)
knight_hand = prim("cube", "Knight_Gauntlet", scale=(0.07, 0.08, 0.06), material=M["silver"],
                   bevel=0.02)
prim("cube", "Knight_GauntletTrim", loc=(0, -0.9, 0), scale=(1.1, 0.25, 1.1),
     material=M["gold"], parent=knight_hand)
knight_idle = prim("cube", "Knight_GauntletL", parent=knight, loc=(-0.28, 0.42, 0.86),
                   scale=(0.06, 0.07, 0.05), material=M["silver"], bevel=0.02)
arm("Knight_ArmR", knight, (0.36, 0, 1.22), knight_hand, M["silver"], 0.075)
arm("Knight_ArmL", knight, (-0.36, 0, 1.22), knight_idle, M["silver"], 0.075)
label("KNIGHT", knight, 2.0)

# ---- COWBOY (north)
cowboy, cowboy_pos, cowboy_th = seat("COWBOY", math.pi / 2)
prim("cube", "Cowboy_Shirt", loc=(0, 0, 1.05), scale=(0.25, 0.15, 0.44),
     material=M["white"], parent=cowboy, bevel=0.07)
for side in (-1, 1):
    prim("cube", "Cowboy_Vest" + ("L" if side < 0 else "R"), loc=(side * 0.14, 0.03, 1.02),
         scale=(0.12, 0.14, 0.4), material=M["vest"], parent=cowboy, bevel=0.03)
prim("cone", "Cowboy_Bandana", loc=(0, 0.1, 1.42), rot=(math.pi + 0.3, 0, 0),
     scale=(0.13, 0.08, 0.12), material=M["bandana"], parent=cowboy)
cowboy_head = prim("sphere", "Cowboy_Head", loc=(0, 0.03, 1.7), scale=(0.14, 0.15, 0.21),
                   material=M["skin_tan"], parent=cowboy)
prim("cube", "Cowboy_Hair", loc=(0, -0.45, -0.45), scale=(0.95, 0.45, 0.75),
     material=M["hair_brown"], parent=cowboy_head, bevel=0.1)
for side in (-1, 1):
    prim("cone", "Cowboy_Stache" + ("L" if side < 0 else "R"), loc=(side * 0.3, 0.85, -0.35),
         rot=(0, side * 2.1, 0), scale=(0.15, 0.12, 0.45), material=M["hair_brown"],
         parent=cowboy_head)
eyes(cowboy_head, M["pupil"], M["pupil"], y=0.9, z=0.12, spread=0.38, r=0.07)
hat = empty("Cowboy_HatPivot", (0, 0, 0.75), parent=cowboy_head, size=0.1)
prim("cyl", "Cowboy_HatBrim", loc=(0, 0, 0), scale=(2.3, 2.1, 0.06),
     material=M["hat"], parent=hat, vertices=32)
prim("cyl", "Cowboy_HatCrown", loc=(0, 0, 0.45), scale=(1.15, 1.05, 0.45),
     material=M["hat"], parent=hat, bevel=0.05)
prim("cyl", "Cowboy_HatBand", loc=(0, 0, 0.12), scale=(1.18, 1.08, 0.08),
     material=M["hat_band"], parent=hat)
cowboy_hand = prim("sphere", "Cowboy_HandR", scale=(0.055, 0.065, 0.04), material=M["skin_tan"])
cowboy_idle = prim("sphere", "Cowboy_HandL", parent=cowboy, loc=(-0.24, 0.42, 0.88),
                   scale=(0.05, 0.06, 0.04), material=M["skin_tan"])
arm("Cowboy_ArmR", cowboy, (0.26, 0, 1.36), cowboy_hand, M["white"], 0.06)
arm("Cowboy_ArmL", cowboy, (-0.26, 0, 1.36), cowboy_idle, M["white"], 0.06)
label("COWBOY", cowboy, 2.2)

# ---- MEDUSA (east)
medusa, medusa_pos, medusa_th = seat("MEDUSA", 0.0)
prim("cube", "Medusa_Torso", loc=(0, 0, 1.0), scale=(0.24, 0.15, 0.38),
     material=M["medusa_skin"], parent=medusa, bevel=0.1)
prim("cube", "Medusa_Toga", loc=(0.04, 0.01, 0.92), rot=(0, 0.45, 0),
     scale=(0.18, 0.17, 0.42), material=M["toga"], parent=medusa, bevel=0.05)
prim("torus", "Medusa_Clasp", loc=(0.17, 0.15, 1.28), rot=(math.pi / 2, 0, 0),
     scale=(0.045,) * 3, material=M["gold"], parent=medusa,
     major_radius=1.0, minor_radius=0.25)
medusa_head = prim("sphere", "Medusa_Head", loc=(0, 0.04, 1.56), scale=(0.15, 0.16, 0.19),
                   material=M["medusa_skin"], parent=medusa)
prim("cube", "Medusa_StonePatch", loc=(-0.55, 0.62, 0.0), rot=(0, 0, 0.6),
     scale=(0.12, 0.25, 0.4), material=M["stone"], parent=medusa_head)
prim("torus", "Medusa_Earring", loc=(-0.98, 0.1, -0.45), rot=(0, math.pi / 2, 0),
     scale=(0.32,) * 3, material=M["gold"], parent=medusa_head,
     major_radius=1.0, minor_radius=0.3)
eyes(medusa_head, M["snake_eye"], M["snake_eye"], y=0.9, z=0.12, spread=0.38, r=0.09)

snake_pivots = []
for i in range(7):
    ang = -2.6 + i * (5.2 / 6)           # spread around the back/top of the head
    pivot = empty("Medusa_SnakePivot%d" % i,
                  (math.sin(ang) * 0.12, -math.cos(ang) * 0.06, 1.66 + abs(math.cos(ang)) * 0.03),
                  parent=medusa, size=0.03)
    out = Vector((math.sin(ang), -math.cos(ang) * 0.6, 0)).normalized()
    cu = bpy.data.curves.new("Snake%d" % i, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.022
    cu.bevel_resolution = 3
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(2)
    pts = [Vector((0, 0, 0)), out * 0.18 + Vector((0, 0, 0.14)),
           out * 0.24 + Vector((0, 0.06, 0.26))]
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    sp.bezier_points[2].radius = 0.8
    so = link(bpy.data.objects.new("Medusa_Snake%d" % i, cu))
    so.data.materials.append(M["snake"])
    so.parent = pivot
    shead = prim("sphere", "Medusa_SnakeHead%d" % i, loc=pts[2] + Vector((0, 0.02, 0.01)),
                 scale=(0.035, 0.05, 0.028), material=M["snake"], parent=pivot)
    for side in (-1, 1):
        prim("sphere", shead.name + "_Eye%d" % side, loc=(side * 0.6, 0.5, 0.45),
             scale=(0.28,) * 3, material=M["snake_eye"], parent=shead)
    snake_pivots.append((pivot, ang))

medusa_hand = prim("sphere", "Medusa_HandR", scale=(0.05, 0.06, 0.035), material=M["medusa_skin"])
for k in range(3):
    prim("cone", "Medusa_Claw%d" % k, loc=((k - 1) * 0.55, 1.3, -0.2), rot=(-math.pi / 2, 0, 0),
         scale=(0.18, 0.18, 0.8), material=M["gold"], parent=medusa_hand)
medusa_idle = prim("sphere", "Medusa_HandL", parent=medusa, loc=(-0.24, 0.42, 0.88),
                   scale=(0.05, 0.06, 0.035), material=M["medusa_skin"])
arm("Medusa_ArmR", medusa, (0.24, 0, 1.3), medusa_hand, M["medusa_skin"], 0.05)
arm("Medusa_ArmL", medusa, (-0.24, 0, 1.3), medusa_idle, M["medusa_skin"], 0.05)
prim("cyl", "Medusa_ArmCuff", loc=(-0.25, 0.12, 1.12), rot=(math.pi / 2.6, 0, 0),
     scale=(0.06, 0.06, 0.05), material=M["gold"], parent=medusa)
label("MEDUSA", medusa, 2.0)

# Held card fans in every idle hand (backs toward the table)
for hand in (boss_idle, knight_idle, cowboy_idle, medusa_idle):
    for k in range(4):
        c = make_card()
        c.parent = hand
        c.location = (0.2 + k * 0.25, 0.6, 1.4)
        c.rotation_euler = (math.radians(-70), math.radians(-25 + k * 14), 0)
        c.scale = (1 / hand.scale.x,) * 3
        c.scale = (1 / hand.scale[0], 1 / hand.scale[1], 1 / hand.scale[2])

# Rim lights behind each player
for name, pos in (("BOSS", boss_pos), ("KNIGHT", knight_pos),
                  ("COWBOY", cowboy_pos), ("MEDUSA", medusa_pos)):
    d = Vector(pos).normalized()
    rim_light("Rim_" + name, tuple(d * 2.5 + Vector((0, 0, 2.1))),
              (pos[0], pos[1], 1.4))

# ---------------------------------------------------------------- performances
spot_boss = play_spot(boss_th, boss_pos)
spot_knight = play_spot(knight_th, knight_pos)
spot_medusa = play_spot(medusa_th, medusa_pos)
spot_centre = Vector((0.0, 0.0, TABLE_TOP + CARD_T / 2 + 6 * CARD_T + 0.002))


def W(base, th, local):
    return tuple(l2w(base, th, local))


def card_track(card, hand, frames_locs, offset=(0, 0, -0.045)):
    """Key a card so it rides just under the hand at the given frames."""
    for f, loc in frames_locs:
        key(hand, f, loc=loc)
        key(card, f, loc=tuple(Vector(loc) + Vector(offset)))


# ---- BOSS: cigar out, smoke, robotic SLAM with the Jack of trumps (spades = trumps)
jack = make_card("J", "S")
rest = W(boss_pos, boss_th, (-0.3, 0.42, 0.86))
raise_ = W(boss_pos, boss_th, (-0.25, 0.55, 1.55))
slam = tuple(spot_boss + Vector((0, 0, 0.045)))
for f, loc in ((1, rest), (34, rest), (46, raise_), (49, raise_),
               (F_BOSS_SLAM, slam), (F_BOSS_SLAM + 12, slam),
               (F_BOSS_SLAM + 26, tuple(Vector(slam) + Vector((0, -0.1, 0.12)))),
               (F_BOSS_SLAM + 40, rest)):
    key(boss_hand, f, loc=loc)
for f, loc, r in ((1, rest, (0.4, 0, 0)), (34, rest, (0.4, 0, 0)), (46, raise_, (1.1, 0, 0.2)),
                  (49, raise_, (1.2, 0, 0.2)), (F_BOSS_SLAM, slam, (0, 0, 0.12))):
    key(jack, f, loc=tuple(Vector(loc) + Vector((0, 0, -0.045))), rot=r)
key(jack, F_BOSS_SLAM, loc=tuple(spot_boss))

# cigar out of mouth and back (local coords)
cig_mouth, cig_out = (0.2, 0.22, 1.5), (0.42, 0.55, 1.3)
for f, loc in ((1, cig_mouth), (8, cig_mouth), (20, cig_out), (30, cig_out), (42, cig_mouth)):
    key(cigar, f, loc=loc)
# right hand follows cigar
for f, loc in ((1, (0.3, 0.42, 0.86)), (8, (0.3, 0.42, 0.86)), (12, (0.24, 0.32, 1.45)),
               (20, (0.45, 0.58, 1.25)), (30, (0.45, 0.58, 1.25)), (42, (0.3, 0.42, 0.86))):
    key(boss_idle, f, loc=loc)

# smoke puffs (volume spheres)
smoke_mat, smoke_vol = volume_mat("Smoke", (0.75, 0.72, 0.7), 0.0)
for f, d in ((1, 0.0), (22, 0.0), (26, 9.0), (60, 2.5), (110, 0.0)):
    smoke_vol.inputs["Density"].default_value = d
    smoke_vol.inputs["Density"].keyframe_insert("default_value", frame=f)
mouth_w = l2w(boss_pos, boss_th, (0.0, 0.32, 1.52))
for i in range(6):
    s = prim("ico", "Smoke%d" % i, material=smoke_mat, subdivisions=2)
    drift = Vector((random.uniform(-0.15, 0.15), random.uniform(0.2, 0.5), random.uniform(0.1, 0.4)))
    drift = l2w((0, 0, 0), boss_th, drift)
    key(s, 22 + i, loc=tuple(mouth_w), scale=0.001)
    key(s, 30 + i, scale=0.06 + i * 0.01)
    key(s, 100, loc=tuple(Vector(mouth_w) + drift), scale=0.2 + i * 0.03)

# sparks from the metal fingers
for i in range(14):
    sp = prim("ico", "Spark%d" % i, material=M["spark"], subdivisions=1, smooth=False)
    a = random.uniform(0, 2 * math.pi)
    v = Vector((math.cos(a) * random.uniform(0.15, 0.4), math.sin(a) * random.uniform(0.15, 0.4),
                random.uniform(0.1, 0.35)))
    start = Vector(slam)
    key(sp, F_BOSS_SLAM - 1, loc=tuple(start), scale=0.0)
    key(sp, F_BOSS_SLAM, scale=0.012)
    key(sp, F_BOSS_SLAM + 5, loc=tuple(start + v * 0.7), scale=0.008)
    key(sp, F_BOSS_SLAM + 12, loc=tuple(start + v + Vector((0, 0, -0.25))), scale=0.0)

# red eye flare
eye_in = bsdf_of(M["red_eye"]).inputs["Emission Strength"]
for f, v in ((1, 8), (F_BOSS_SLAM - 2, 8), (F_BOSS_SLAM + 1, 80), (F_BOSS_SLAM + 14, 8)):
    eye_in.default_value = v
    eye_in.keyframe_insert("default_value", frame=f)

# table jolt + coins hop
tbl_parts = [o for o in table.children]
for f, z in ((1, 0), (F_BOSS_SLAM - 1, 0), (F_BOSS_SLAM + 1, -0.012), (F_BOSS_SLAM + 5, 0.004),
             (F_BOSS_SLAM + 9, 0)):
    key(table, f, loc=(0, 0, z))
for co in coins:
    z0 = co.location.z
    hop = random.uniform(0.02, 0.05)
    key(co, F_BOSS_SLAM, loc=tuple(co.location), rot=(0, 0, 0))
    key(co, F_BOSS_SLAM + 4, loc=(co.location.x, co.location.y, z0 + hop),
        rot=(random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6), 0))
    key(co, F_BOSS_SLAM + 9, loc=(co.location.x, co.location.y, z0), rot=(0, 0, 0))

# ---- KNIGHT: fist up, gauntlet PUNCH, golden shockwave
k_card = make_card("9", "S")
k_rest = W(knight_pos, knight_th, (0.28, 0.42, 0.86))
k_up = W(knight_pos, knight_th, (0.25, 0.4, 1.75))
k_hit = tuple(spot_knight + Vector((0, 0, 0.06)))
for f, loc in ((1, k_rest), (82, k_rest), (96, k_up), (102, k_up), (F_KNIGHT_PUNCH, k_hit),
               (F_KNIGHT_PUNCH + 14, k_hit), (F_KNIGHT_PUNCH + 34, k_rest)):
    key(knight_hand, f, loc=loc)
for f, loc, r in ((1, k_rest, (0.3, 0, 0)), (82, k_rest, (0.3, 0, 0)), (96, k_up, (1.2, 0, 0)),
                  (102, k_up, (1.3, 0, 0)), (F_KNIGHT_PUNCH, k_hit, (0, 0, -0.3))):
    key(k_card, f, loc=tuple(Vector(loc) + Vector((0, 0, -0.06))), rot=r)
key(k_card, F_KNIGHT_PUNCH, loc=tuple(spot_knight))

ring = prim("torus", "Shockwave", loc=tuple(spot_knight + Vector((0, 0, 0.004))),
            material=M["shock"], major_radius=1.0, minor_radius=0.025, major_segments=64)
key(ring, F_KNIGHT_PUNCH - 1, scale=(0.0, 0.0, 0.0))
key(ring, F_KNIGHT_PUNCH, scale=(0.05, 0.05, 0.5))
key(ring, F_KNIGHT_PUNCH + 14, scale=(1.0, 1.0, 0.35))
key(ring, F_KNIGHT_PUNCH + 22, scale=(1.3, 1.3, 0.0))
shock_in = bsdf_of(M["shock"]).inputs["Emission Strength"]
for f, v in ((F_KNIGHT_PUNCH, 40), (F_KNIGHT_PUNCH + 22, 0)):
    shock_in.default_value = v
    shock_in.keyframe_insert("default_value", frame=f)
for i, c in enumerate(pile_cards + [jack]):
    base = c.location.copy() if c is not jack else spot_boss.copy()
    t0 = F_KNIGHT_PUNCH + 4 + i
    key(c, t0, loc=tuple(base), rot=tuple(c.rotation_euler))
    key(c, t0 + 5, loc=tuple(base + Vector((0, 0, 0.04 + i * 0.006))),
        rot=(random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), c.rotation_euler.z))
    key(c, t0 + 11, loc=tuple(base), rot=(0, 0, c.rotation_euler.z))

# ---- COWBOY: tip hat, card from the sleeve, flick, spinning arc
c_card = make_card("K", "S")
c_rest = W(cowboy_pos, cowboy_th, (0.24, 0.42, 0.88))
c_wind = W(cowboy_pos, cowboy_th, (0.2, 0.3, 1.2))
c_flick = W(cowboy_pos, cowboy_th, (0.12, 0.62, 1.12))
for f, loc in ((1, c_rest), (118, c_rest), (124, W(cowboy_pos, cowboy_th, (0.12, 0.25, 1.98))),
               (132, W(cowboy_pos, cowboy_th, (0.12, 0.25, 1.98))), (136, c_wind),
               (F_COWBOY_FLICK, c_flick), (F_COWBOY_FLICK + 20, c_rest)):
    key(cowboy_hand, f, loc=loc)
for f, rx in ((118, 0), (124, -0.35), (132, -0.35), (138, 0)):
    key(hat, f, rot=(rx, 0, 0))
key(c_card, 1, loc=c_wind, scale=0.0)
key(c_card, 135, loc=c_wind, scale=0.0, rot=(1.2, 0, 0))
key(c_card, 138, loc=tuple(Vector(c_wind) + Vector((0, 0, -0.03))), scale=1.0)
key(c_card, F_COWBOY_FLICK, loc=tuple(Vector(c_flick) + Vector((0, 0, -0.03))), rot=(0.9, 0, 0))
mid = (Vector(c_flick) + spot_centre) / 2 + Vector((0, 0, 0.38))
key(c_card, F_COWBOY_FLICK + 13, loc=tuple(mid), rot=(0.4, 0, 6.5))
key(c_card, F_COWBOY_LAND, loc=tuple(spot_centre), rot=(0, 0, 4 * math.pi + 0.35))

# ---- MEDUSA: snakes turn and hiss, Ace placed with one claw, turns to stone
ace_face = mat("AceFace", (0.93, 0.9, 0.8), rough=0.4)
ace_ink = mat("AceInk", (0.75, 0.02, 0.03), rough=0.4)
ace = make_card("A", "H", face_mat=ace_face, ink_mat=ace_ink)
m_rest = W(medusa_pos, medusa_th, (0.24, 0.42, 0.88))
m_lift = W(medusa_pos, medusa_th, (0.18, 0.55, 1.05))
m_place = tuple(spot_medusa + Vector((0, 0, 0.035)))
for f, loc in ((1, m_rest), (196, m_rest), (206, m_lift), (216, tuple(Vector(m_place) + Vector((0, 0, 0.05)))),
               (F_MEDUSA_LAND, m_place), (F_MEDUSA_LAND + 12, m_place), (F_MEDUSA_LAND + 30, m_rest)):
    key(medusa_hand, f, loc=loc)
for f, loc, r in ((1, m_rest, (0.5, 0, 0)), (196, m_rest, (0.5, 0, 0)), (206, m_lift, (0.3, 0, 0)),
                  (216, tuple(Vector(m_place) + Vector((0, 0, 0.05))), (0.1, 0, 0.2))):
    key(ace, f, loc=tuple(Vector(loc) + Vector((0, 0, -0.035))), rot=r)
key(ace, F_MEDUSA_LAND, loc=tuple(spot_medusa), rot=(0, 0, 0.2))

for pivot, ang in snake_pivots:
    key(pivot, 182, rot=(0, 0, 0))
    turn = -ang * 0.75                    # swing heads toward the front (+Y)
    key(pivot, 194, rot=(0.35, 0, turn))
    key(pivot, 198, rot=(0.45, 0, turn), scale=1.0)
    key(pivot, 201, scale=1.12)            # hiss pulse
    key(pivot, 204, scale=1.0)
    key(pivot, F_MEDUSA_LAND + 30, rot=(0.25, 0, turn * 0.5))

stone_col = (0.5, 0.49, 0.46, 1)
for m, c0 in ((ace_face, (0.93, 0.9, 0.8, 1)), (ace_ink, (0.75, 0.02, 0.03, 1))):
    inp = bsdf_of(m).inputs["Base Color"]
    inp.default_value = c0
    inp.keyframe_insert("default_value", frame=F_MEDUSA_LAND)
    inp.default_value = stone_col if m is ace_face else (0.25, 0.24, 0.22, 1)
    inp.keyframe_insert("default_value", frame=F_MEDUSA_LAND + 8)
    r = bsdf_of(m).inputs["Roughness"]
    r.default_value = 0.4
    r.keyframe_insert("default_value", frame=F_MEDUSA_LAND)
    r.default_value = 1.0
    r.keyframe_insert("default_value", frame=F_MEDUSA_LAND + 8)

for i in range(10):
    d = prim("ico", "Dust%d" % i, material=M["dust"], subdivisions=2)
    a = random.uniform(0, 2 * math.pi)
    start = spot_medusa + Vector((0, 0, 0.01))
    end = start + Vector((math.cos(a) * 0.14, math.sin(a) * 0.14, random.uniform(0.03, 0.09)))
    key(d, F_MEDUSA_LAND - 1, loc=tuple(start), scale=0.0)
    key(d, F_MEDUSA_LAND + 4, scale=0.025)
    key(d, F_MEDUSA_LAND + 20, loc=tuple(end), scale=0.0)

# ---------------------------------------------------------------- camera
cam_rig = empty("CamRig", (0, 0, 0), size=0.2)
cam_data = bpy.data.cameras.new("Cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.sensor_height = 24
cam_data.clip_start = 0.02
cam = link(bpy.data.objects.new("Camera", cam_data))
cam.parent = cam_rig
scene.camera = cam
aim = empty("CamAim", size=0.08)
focus = empty("CamFocus", size=0.06)
tt = cam.constraints.new("TRACK_TO")
tt.target = aim
tt.track_axis = "TRACK_NEGATIVE_Z"
tt.up_axis = "UP_Y"
cam_data.dof.use_dof = True
cam_data.dof.focus_object = focus

# (frame, camera position, aim point, focus point, f-stop, lens mm)
SHOTS = [
    # 0-2s: high above, dive down, over BOSS's left shoulder
    (1,   (1.3, -3.0, 3.8),   (0.0, -0.1, 1.0), (0.0, -0.4, 0.9),  8.0, 24),
    (30,  (-1.2, -1.75, 2.05), (-0.05, -0.4, 0.9), (-0.15, -0.4, 0.8), 2.0, 26),
    (46,  (-1.08, -1.6, 1.9), (-0.05, -0.42, 0.88), (-0.1, -0.38, 0.8), 1.8, 28),
    (F_BOSS_SLAM, (-1.02, -1.55, 1.82), (-0.03, -0.42, 0.82), tuple(spot_boss), 1.8, 28),
    (F_BOSS_SLAM + 12, (-1.0, -1.53, 1.8), (-0.03, -0.42, 0.82), tuple(spot_boss), 1.8, 28),
    # 2-4s: whip-arc to a low angle facing KNIGHT
    (76,  (1.15, -1.2, 1.45), (-0.4, -0.1, 0.95), (-0.4, 0.0, 0.85), 2.4, 24),
    (88,  (0.8, -0.3, 0.92),  (-1.1, 0.0, 1.1),  (-0.9, 0.0, 1.2), 1.6, 24),
    (F_KNIGHT_PUNCH, (0.72, -0.26, 0.9), (-1.0, 0.0, 1.0), tuple(spot_knight), 1.6, 24),
    (F_KNIGHT_PUNCH + 12, (0.7, -0.25, 0.9), (-1.0, 0.0, 1.0), tuple(spot_knight), 1.6, 24),
    # 4-6s: swing up to 3/4 on COWBOY, follow the flicked card
    (132, (-0.85, -0.6, 1.5), (0.05, 1.1, 1.35), (0.0, 1.2, 1.5), 2.2, 26),
    (F_COWBOY_FLICK, (-0.8, -0.62, 1.45), (0.05, 0.9, 1.2), (0.1, 0.8, 1.1), 2.2, 26),
    (F_COWBOY_FLICK + 13, (-0.76, -0.66, 1.4), tuple(mid), tuple(mid), 2.2, 26),
    (F_COWBOY_LAND, (-0.72, -0.7, 1.35), (0.0, 0.05, 0.85), tuple(spot_centre), 2.2, 26),
    (F_COWBOY_LAND + 12, (-0.71, -0.71, 1.34), (0.0, 0.05, 0.85), tuple(spot_centre), 2.2, 26),
    # 6-8s: low dolly at card height toward MEDUSA, rack focus
    (194, (-0.78, -0.22, 0.86), (1.3, 0.05, 1.3), (1.35, 0.05, 1.6), 1.4, 24),
    (206, (-0.6, -0.17, 0.85), (1.3, 0.04, 1.25), (1.35, 0.05, 1.6), 1.4, 24),
    (F_MEDUSA_LAND, (-0.45, -0.12, 0.85), (1.3, 0.02, 1.15), tuple(spot_medusa), 1.4, 24),
    (F_MEDUSA_LAND + 12, (-0.42, -0.11, 0.85), (1.3, 0.02, 1.15), tuple(spot_medusa), 1.4, 24),
    # 8-10s: pull up and back to the hero wide shot
    (250, (1.0, -1.25, 2.35), (0.0, 0.0, 1.0), (0.0, 0.0, 0.9), 4.0, 24),
    (268, (1.95, -1.95, 2.75), (0.0, 0.0, 0.92), (0.0, 0.0, 0.9), 5.6, 26),
    (FRAME_END, (2.05, -2.05, 2.82), (0.0, 0.0, 0.92), (0.0, 0.0, 0.9), 5.6, 26),
]
for f, c, a, fo, fstop, lens in SHOTS:
    key(cam_rig, f, loc=c)
    key(aim, f, loc=a)
    key(focus, f, loc=fo)
    key_value(cam_data.dof, "aperture_fstop", f, fstop)
    key_value(cam_data, "lens", f, lens)

# Snappy timing: sharp acceleration out of each hold
for o in (cam_rig, aim):
    for fc in fcurves_of(o):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"

# Handheld shake + extra kick on every impact
key(cam, 1, loc=(0, 0, 0))
for fc in fcurves_of(cam):
    if fc.data_path != "location":
        continue
    n = fc.modifiers.new("NOISE")
    n.scale, n.strength, n.phase = 14.0, 0.008, random.uniform(0, 100)
    for hit in (F_BOSS_SLAM, F_KNIGHT_PUNCH, F_COWBOY_LAND, F_MEDUSA_LAND):
        k = fc.modifiers.new("NOISE")
        k.scale, k.strength, k.phase = 1.5, 0.05 if hit != F_COWBOY_LAND else 0.02, random.uniform(0, 100)
        k.use_restricted_range = True
        k.frame_start, k.frame_end = hit, hit + 10
        k.blend_in, k.blend_out = 0.0, 7.0

# ---------------------------------------------------------------- bloom / glare (best effort)
def setup_glare():
    try:
        if hasattr(scene, "compositing_node_group"):        # Blender 5.x
            ng = bpy.data.node_groups.new("Compositing", "CompositorNodeTree")
            scene.compositing_node_group = ng
            ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
            rl = ng.nodes.new("CompositorNodeRLayers")
            gl = ng.nodes.new("CompositorNodeGlare")
            out = ng.nodes.new("NodeGroupOutput")
            for name, val in (("Type", "Bloom"), ("Threshold", 1.0), ("Strength", 0.6),
                              ("Size", 0.6)):
                if name in gl.inputs:
                    try:
                        gl.inputs[name].default_value = val
                    except Exception:
                        pass
            ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
            ng.links.new(gl.outputs["Image"], out.inputs[0])
        else:                                                # Blender 4.x
            scene.use_nodes = True
            nt = scene.node_tree
            rl = nt.nodes.get("Render Layers") or nt.nodes.new("CompositorNodeRLayers")
            comp = nt.nodes.get("Composite") or nt.nodes.new("CompositorNodeComposite")
            gl = nt.nodes.new("CompositorNodeGlare")
            gl.glare_type = "BLOOM" if "BLOOM" in [i.identifier for i in gl.bl_rna.properties["glare_type"].enum_items] else "FOG_GLOW"
            gl.threshold = 1.0
            nt.links.new(rl.outputs["Image"], gl.inputs["Image"])
            nt.links.new(gl.outputs["Image"], comp.inputs["Image"])
    except Exception as e:
        print("Glare setup skipped:", e)


setup_glare()

# ---------------------------------------------------------------- save + render
scene.frame_set(1)
blend_path = os.path.join(OUT_DIR, "blot_splash.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print("Saved", blend_path)


def set_output(kind):
    ims = scene.render.image_settings
    if hasattr(ims, "media_type"):
        ims.media_type = "IMAGE" if kind == "PNG" else "VIDEO"
    if kind == "PNG":
        ims.file_format = "PNG"
    else:
        ims.file_format = "FFMPEG"
        scene.render.ffmpeg.format = "MPEG4"
        scene.render.ffmpeg.codec = "H264"
        scene.render.ffmpeg.constant_rate_factor = "HIGH"


if DO_STILLS:
    set_output("PNG")
    for f in (30, 90, 150, 210, FRAME_END):
        scene.frame_set(f)
        scene.render.filepath = os.path.join(OUT_DIR, "still_%03d.png" % f)
        bpy.ops.render.render(write_still=True)
        print("Rendered still", f)

if DO_RENDER:
    set_output("VIDEO")
    scene.render.filepath = os.path.join(OUT_DIR, "blot_splash_preview.mp4")
    bpy.ops.render.render(animation=True)
    print("Rendered video", scene.render.filepath)
