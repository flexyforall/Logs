"""
Blot (Belote) splash screen previs v2 — landscape, whoosh camera, mansion card room.

Usage
-----
  Build the scene (recommended):
      blender -b -P blot_splash_v2.py
      -> saves blot_splash_v2.blend next to this script; open it in Blender.
  Build + render:
      blender -b -P blot_splash_v2.py -- --render
      -> test frames (PNG) + preview.mp4 next to this script.
  Options:
      --render     render test frames + preview video
      --stills     render only the test frames
      --scale N    resolution percentage (default 100 = 1920x1080)
      --out DIR    output folder (default: folder of this script)

Tested with Blender 5.1 (bpy module); written to also run on Blender 4.2+.
Characters are proxies: silhouette, color, placement and timing only.
"""

import bpy
import math
import os
import random
import sys
from mathutils import Matrix, Vector

random.seed(11)

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
    _here = os.path.join(os.path.expanduser("~"), "build2_blot_splash")
OUT_DIR = argv[argv.index("--out") + 1] if "--out" in argv else _here
os.makedirs(OUT_DIR, exist_ok=True)

FPS = 30
FRAME_END = 210                  # 7 s
TEST_FRAMES = (1, 30, 50, 66, 90, 120, 150, 175, 210)

# Story beats (frames)
F_FACE = 30          # whoosh back lands on the BOSS's face
F_KING = 50          # King of Hearts hits the felt
F_FLICK = 104        # KNIGHT snaps the Ace
F_ACE_TOUCH = 119    # Ace touches the felt
F_ACE_STOP = 128     # Ace stops on top of the King
F_WIDE = 162         # camera snaps into the wide shot

TABLE_TOP = 0.77
CARD_W, CARD_H, CARD_T = 0.09, 0.126, 0.002
SEAT_DIST = 1.35

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = FRAME_END
scene.render.fps = FPS
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = RES_SCALE

for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        pass

# Motion blur (property moved between versions)
scene.render.use_motion_blur = True
for owner, attr in ((scene.render, "motion_blur_shutter"), (scene.eevee, "motion_blur_shutter")):
    try:
        setattr(owner, attr, 0.5)
    except AttributeError:
        pass
try:
    scene.eevee.use_motion_blur = True
except AttributeError:
    pass


# ---------------------------------------------------------------- helpers
def mat(name, color, metallic=0.0, rough=0.5, emit=None, strength=0.0, alpha=1.0,
        transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    if transmission:
        b.inputs["Transmission Weight"].default_value = transmission
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            m.blend_method = "BLEND"
    return m


def pattern_mat(name, c1, c2, kind="WAVE", scale=5.0, rough=0.6, bands="X"):
    """Two-colour procedural material (wood panels, rug, painting)."""
    m = mat(name, c1, rough=rough)
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    if kind == "WAVE":
        tex = nt.nodes.new("ShaderNodeTexWave")
        tex.bands_direction = bands
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Distortion"].default_value = 2.0
    elif kind == "CHECKER":
        tex = nt.nodes.new("ShaderNodeTexChecker")
        tex.inputs["Scale"].default_value = scale
    else:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
    nt.links.new(coord.outputs["Object"], tex.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(tex.outputs["Fac"] if "Fac" in tex.outputs else tex.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
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


def key_input(sock, frame, value):
    sock.default_value = value
    sock.keyframe_insert("default_value", frame=frame)


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


def add_noise(id_data, path_prefix, strength, scale, phase=None):
    for fc in fcurves_of(id_data):
        if fc.data_path.startswith(path_prefix):
            n = fc.modifiers.new("NOISE")
            n.strength, n.scale = strength, scale
            n.phase = random.uniform(0, 100) if phase is None else phase


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
    "panel": pattern_mat("WallPanels", (0.05, 0.022, 0.01), (0.1, 0.045, 0.02), "WAVE", 3.0,
                         rough=0.55, bands="X"),
    "floor": pattern_mat("Parquet", (0.04, 0.02, 0.01), (0.08, 0.04, 0.02), "WAVE", 6.0,
                         rough=0.5, bands="Y"),
    "rug": pattern_mat("Rug", (0.22, 0.02, 0.03), (0.45, 0.22, 0.05), "CHECKER", 14.0, rough=0.95),
    "stone": pattern_mat("Stone", (0.22, 0.2, 0.18), (0.38, 0.35, 0.31), "NOISE", 9.0, rough=0.9),
    "painting": pattern_mat("Painting", (0.1, 0.06, 0.03), (0.5, 0.32, 0.12), "NOISE", 3.0),
    "curtain": pattern_mat("Curtain", (0.14, 0.01, 0.02), (0.3, 0.02, 0.04), "WAVE", 10.0,
                           rough=0.8, bands="X"),
    "ceiling": mat("Ceiling", (0.03, 0.02, 0.015), rough=0.9),
    "soot": mat("Soot", (0.01, 0.01, 0.01), rough=1.0),
    "fire": mat("Fire", (1.0, 0.35, 0.05), emit=(1.0, 0.38, 0.06), strength=25),
    "fire_core": mat("FireCore", (1.0, 0.8, 0.3), emit=(1.0, 0.75, 0.3), strength=40),
    "window": mat("NightWindow", (0.1, 0.2, 0.5), emit=(0.25, 0.45, 1.0), strength=3),
    "gold": mat("Gold", (1.0, 0.68, 0.22), metallic=1.0, rough=0.25),
    "steel": mat("Steel", (0.62, 0.63, 0.66), metallic=1.0, rough=0.3),
    "silver": mat("Silver", (0.8, 0.82, 0.85), metallic=1.0, rough=0.22),
    "glass": mat("Glass", (0.9, 0.95, 1.0), rough=0.02, transmission=1.0),
    "whisky": mat("Whisky", (0.6, 0.25, 0.03), rough=0.05, transmission=0.8),
    "skin": mat("Skin", (0.72, 0.47, 0.33), rough=0.55),
    "skin_tan": mat("SkinTan", (0.62, 0.38, 0.24), rough=0.6),
    "white": mat("Shirt", (0.85, 0.82, 0.74), rough=0.6),
    "teeth": mat("Teeth", (0.95, 0.93, 0.88), rough=0.3),
    "paper": mat("Paper", (0.92, 0.9, 0.82), rough=0.8),
    "card_face": mat("CardFace", (0.95, 0.93, 0.85), rough=0.4),
    "card_back": mat("CardBack", (0.45, 0.03, 0.05), rough=0.35),
    "ink_red": mat("InkRed", (0.8, 0.02, 0.03), rough=0.4),
    "ink_black": mat("InkBlack", (0.02, 0.02, 0.025), rough=0.4),
    "ashtray": mat("Ashtray", (0.05, 0.06, 0.07), metallic=0.3, rough=0.1),
    "ash": mat("Ash", (0.3, 0.29, 0.28), rough=1.0),
    "pupil": mat("Pupil", (0.02, 0.03, 0.05), rough=0.3),
    "brow_dark": mat("BrowDark", (0.03, 0.02, 0.015), rough=0.6),
    "mouth": mat("Mouth", (0.15, 0.04, 0.03), rough=0.6),
    # BOSS
    "suit": pattern_mat("Pinstripe", (0.03, 0.028, 0.032), (0.2, 0.19, 0.2), "WAVE", 40.0,
                        rough=0.7, bands="X"),
    "tie": mat("Tie", (0.32, 0.01, 0.03), rough=0.5),
    "red_eye": mat("RedEye", (1.0, 0.1, 0.02), emit=(1.0, 0.1, 0.02), strength=10),
    "cigar": mat("Cigar", (0.18, 0.08, 0.03), rough=0.8),
    "cigar_tip": mat("CigarTip", (1.0, 0.25, 0.02), emit=(1.0, 0.3, 0.02), strength=20),
    "ember": mat("Ember", (1.0, 0.5, 0.1), emit=(1.0, 0.45, 0.08), strength=60),
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
    "stone_patch": mat("StonePatch", (0.55, 0.53, 0.5), rough=0.95),
    # FX / lamp
    "trail": mat("GoldTrail", (1.0, 0.75, 0.25), emit=(1.0, 0.7, 0.2), strength=35),
    "bulb": mat("Bulb", (1.0, 0.8, 0.5), emit=(1.0, 0.72, 0.4), strength=30),
    "shade": mat("Shade", (0.09, 0.2, 0.12), metallic=0.6, rough=0.35),
}

# ---------------------------------------------------------------- world / render look
world = bpy.data.worlds.new("Night")
scene.world = world
world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes.get("Background")
bg.inputs["Color"].default_value = (0.004, 0.004, 0.006, 1)
wvol = wnt.nodes.new("ShaderNodeVolumePrincipled")
wvol.inputs["Density"].default_value = 0.012
wvol.inputs["Color"].default_value = (1.0, 0.92, 0.85, 1)
wnt.links.new(wvol.outputs[0], wnt.nodes["World Output"].inputs["Volume"])

ee = scene.eevee
for attr, val in (("use_volumetric_shadows", True), ("volumetric_tile_size", "4"),
                  ("volumetric_end", 14.0), ("taa_render_samples", 64),
                  ("use_shadows", True), ("use_raytracing", True), ("use_gtao", True)):
    try:
        setattr(ee, attr, val)
    except (AttributeError, TypeError):
        pass
_vt = [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items]
scene.view_settings.view_transform = "AgX" if "AgX" in _vt else "Filmic"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass

# ---------------------------------------------------------------- room
ROOM_X, ROOM_N, ROOM_S, ROOM_H = 3.6, 3.4, -4.0, 3.6
prim("plane", "Floor", loc=(0, (ROOM_N + ROOM_S) / 2, 0),
     scale=(ROOM_X, (ROOM_N - ROOM_S) / 2, 1), material=M["floor"])
prim("plane", "Ceiling", loc=(0, (ROOM_N + ROOM_S) / 2, ROOM_H), rot=(math.pi, 0, 0),
     scale=(ROOM_X, (ROOM_N - ROOM_S) / 2, 1), material=M["ceiling"])
prim("cube", "Wall_N", loc=(0, ROOM_N + 0.05, ROOM_H / 2), scale=(ROOM_X, 0.05, ROOM_H / 2),
     material=M["panel"], smooth=False)
prim("cube", "Wall_S", loc=(0, ROOM_S - 0.05, ROOM_H / 2), scale=(ROOM_X, 0.05, ROOM_H / 2),
     material=M["panel"], smooth=False)
prim("cube", "Wall_W", loc=(-ROOM_X - 0.05, (ROOM_N + ROOM_S) / 2, ROOM_H / 2),
     scale=(0.05, (ROOM_N - ROOM_S) / 2, ROOM_H / 2), material=M["panel"], smooth=False)
prim("cube", "Wall_E", loc=(ROOM_X + 0.05, (ROOM_N + ROOM_S) / 2, ROOM_H / 2),
     scale=(0.05, (ROOM_N - ROOM_S) / 2, ROOM_H / 2), material=M["panel"], smooth=False)
# wainscot rail
for nm, loc, sc in (("Rail_N", (0, ROOM_N - 0.01, 1.0), (ROOM_X, 0.03, 0.03)),
                    ("Rail_W", (-ROOM_X + 0.01, -0.3, 1.0), (0.03, 3.7, 0.03))):
    prim("cube", nm, loc=loc, scale=sc, material=M["wood"], smooth=False)
prim("cyl", "Rug", loc=(0, 0, 0.005), scale=(2.3, 2.3, 0.005), material=M["rug"], vertices=48)

# Fireplace (north wall, behind the KNIGHT)
FP_X = 0.2
fp = empty("Fireplace", (FP_X, ROOM_N, 0))
prim("cube", "FP_Left", loc=(-0.75, -0.25, 0.65), scale=(0.2, 0.25, 0.65), material=M["stone"],
     parent=fp, bevel=0.02)
prim("cube", "FP_Right", loc=(0.75, -0.25, 0.65), scale=(0.2, 0.25, 0.65), material=M["stone"],
     parent=fp, bevel=0.02)
prim("cube", "FP_Top", loc=(0, -0.25, 1.2), scale=(0.95, 0.25, 0.12), material=M["stone"],
     parent=fp, bevel=0.02)
prim("cube", "FP_Mantel", loc=(0, -0.3, 1.36), scale=(1.1, 0.32, 0.05), material=M["wood_dark"],
     parent=fp, bevel=0.01)
prim("cube", "FP_Back", loc=(0, -0.05, 0.6), scale=(0.6, 0.05, 0.6), material=M["soot"], parent=fp)
prim("cube", "FP_Hearth", loc=(0, -0.45, 0.04), scale=(1.1, 0.25, 0.04), material=M["stone"],
     parent=fp, bevel=0.01)
prim("cube", "FP_Chimney", loc=(0, -0.2, 2.5), scale=(0.8, 0.2, 1.1), material=M["stone"],
     parent=fp, bevel=0.02)
for i in range(3):
    prim("cyl", "FP_Log%d" % i, loc=(-0.2 + i * 0.2, -0.25, 0.12 + (i % 2) * 0.06),
         rot=(0, math.pi / 2, 0.3 * (i - 1)), scale=(0.06, 0.06, 0.3), material=M["wood_dark"],
         parent=fp)
flames = []
for i in range(7):
    fl = prim("cone", "FP_Flame%d" % i, loc=(-0.3 + i * 0.1, -0.25, 0.32),
              scale=(0.07, 0.07, 0.22 + random.uniform(0, 0.12)),
              material=M["fire_core"] if i % 2 else M["fire"], parent=fp, vertices=10)
    key(fl, 1, scale=tuple(fl.scale))
    add_noise(fl, "scale", 0.06, 3.0)
    flames.append(fl)
fire_light = bpy.data.lights.new("FireLight", "POINT")
fire_light.energy = 260
fire_light.color = (1.0, 0.45, 0.12)
fire_light.shadow_soft_size = 0.3
fire_obj = link(bpy.data.objects.new("FireLight", fire_light))
fire_obj.location = (FP_X, ROOM_N - 0.6, 0.5)
fire_light.keyframe_insert("energy", frame=1)
add_noise(fire_light, "energy", 90.0, 2.5)
# painting above the fireplace
prim("cube", "Painting_Frame", loc=(FP_X, ROOM_N - 0.03, 2.25), scale=(0.75, 0.03, 0.52),
     material=M["gold"], bevel=0.02, smooth=False)
prim("cube", "Painting_Canvas", loc=(FP_X, ROOM_N - 0.06, 2.25), scale=(0.65, 0.02, 0.43),
     material=M["painting"], smooth=False)
pic_light = bpy.data.lights.new("PictureLight", "SPOT")
pic_light.energy = 40
pic_light.color = (1.0, 0.75, 0.45)
pic_light.spot_size = math.radians(60)
po = link(bpy.data.objects.new("PictureLight", pic_light))
po.location = (FP_X, ROOM_N - 0.6, 3.1)
po.rotation_euler = (math.radians(-30), 0, 0)

# Dresser (west wall) with whisky, glasses, cigar box, coins
dr = empty("Dresser", (-ROOM_X + 0.3, 1.2, 0))
dr.rotation_euler = (0, 0, -math.pi / 2)    # front faces +X (into the room)
prim("cube", "Dresser_Body", loc=(0, 0, 0.5), scale=(0.75, 0.28, 0.45), material=M["wood"],
     parent=dr, bevel=0.02)
prim("cube", "Dresser_Top", loc=(0, 0, 0.97), scale=(0.8, 0.31, 0.025), material=M["wood_dark"],
     parent=dr, bevel=0.01)
for r in range(3):
    for c in (-1, 1):
        prim("cube", "Dresser_Drawer%d%d" % (r, c), loc=(c * 0.37, 0.285, 0.25 + r * 0.25),
             scale=(0.33, 0.01, 0.1), material=M["wood_dark"], parent=dr, bevel=0.005)
        prim("sphere", "Dresser_Knob%d%d" % (r, c), loc=(c * 0.37, 0.3, 0.25 + r * 0.25),
             scale=(0.018,) * 3, material=M["gold"], parent=dr)
prim("cyl", "Decanter", loc=(-0.35, 0.05, 1.13), scale=(0.09, 0.09, 0.13), material=M["glass"],
     parent=dr, bevel=0.03)
prim("cyl", "Decanter_Whisky", loc=(-0.35, 0.05, 1.08), scale=(0.08, 0.08, 0.08),
     material=M["whisky"], parent=dr)
prim("cyl", "Decanter_Neck", loc=(-0.35, 0.05, 1.3), scale=(0.03, 0.03, 0.06), material=M["glass"],
     parent=dr)
prim("ico", "Decanter_Stopper", loc=(-0.35, 0.05, 1.38), scale=(0.045,) * 3, material=M["glass"],
     parent=dr, subdivisions=1, smooth=False)
for i, x in enumerate((-0.12, 0.0)):
    prim("cyl", "Glass%d" % i, loc=(x, 0.12, 1.04), scale=(0.04, 0.04, 0.045), material=M["glass"],
         parent=dr)
    prim("cyl", "Glass%d_Whisky" % i, loc=(x, 0.12, 1.02), scale=(0.035, 0.035, 0.02),
         material=M["whisky"], parent=dr)
prim("cube", "CigarBox", loc=(0.25, 0.05, 1.03), scale=(0.15, 0.1, 0.04), material=M["wood"],
     parent=dr, bevel=0.005)
for s in range(4):
    for k in range(3 + s % 3):
        prim("cyl", "DresserCoin%d_%d" % (s, k), loc=(0.48 + (s % 2) * 0.07, -0.05 + (s // 2) * 0.1,
                                                     1.0 + k * 0.008),
             scale=(0.025, 0.025, 0.004), material=M["gold"], parent=dr, vertices=16)

# Window + curtains (east wall) — cool rim light source
prim("plane", "Window", loc=(ROOM_X - 0.01, 0.3, 1.9), rot=(0, math.pi / 2, 0),
     scale=(0.9, 0.55, 1), material=M["window"])
for side in (-1, 1):
    for k in range(4):
        prim("cyl", "Curtain%d_%d" % (side, k), loc=(ROOM_X - 0.12, 0.3 + side * (0.62 + k * 0.08), 1.65),
             scale=(0.06, 0.06, 1.65), material=M["curtain"], vertices=12)
win_l = bpy.data.lights.new("WindowLight", "AREA")
win_l.energy = 220
win_l.size = 1.5
win_l.color = (0.35, 0.55, 1.0)
wo = link(bpy.data.objects.new("WindowLight", win_l))
wo.location = (ROOM_X - 0.3, 0.3, 1.9)
wo.rotation_euler = (0, math.radians(-90), 0)

# ---------------------------------------------------------------- table + lamp
table = empty("Table", (0, 0, 0))
prim("cyl", "TableTop", loc=(0, 0, 0.73), scale=(1.0, 1.0, 0.03), material=M["wood"],
     parent=table, bevel=0.01, vertices=64)
prim("cyl", "Felt", loc=(0, 0, 0.765), scale=(0.9, 0.9, 0.005), material=M["felt"],
     parent=table, vertices=64)
prim("torus", "TableRim", loc=(0, 0, 0.765), material=M["wood_dark"], parent=table,
     major_radius=0.95, minor_radius=0.025, major_segments=64)
prim("cyl", "Pedestal", loc=(0, 0, 0.36), scale=(0.12, 0.12, 0.36), material=M["wood_dark"],
     parent=table)
prim("cyl", "Foot", loc=(0, 0, 0.03), scale=(0.5, 0.5, 0.03), material=M["wood_dark"], parent=table)

LAMP_Z = 1.95
prim("cyl", "LampCord", loc=(0, 0, (LAMP_Z + ROOM_H) / 2), scale=(0.008, 0.008, (ROOM_H - LAMP_Z) / 2),
     material=M["ink_black"])
prim("cone", "LampShade", loc=(0, 0, LAMP_Z), scale=(0.32, 0.32, 0.16), material=M["shade"],
     radius1=1.0, radius2=0.25, depth=1.0, end_fill_type="NOTHING")
bpy.context.active_object.modifiers.new("Solid", "SOLIDIFY").thickness = 0.02
prim("sphere", "Bulb", loc=(0, 0, LAMP_Z - 0.06), scale=(0.06,) * 3, material=M["bulb"])
lamp_data = bpy.data.lights.new("LampKey", "SPOT")
lamp_data.energy = 420
lamp_data.color = (1.0, 0.68, 0.38)
lamp_data.spot_size = math.radians(85)
lamp_data.spot_blend = 0.35
lamp_data.shadow_soft_size = 0.08
link(bpy.data.objects.new("LampKey", lamp_data)).location = (0, 0, LAMP_Z - 0.08)
glow = bpy.data.lights.new("LampGlow", "POINT")
glow.energy = 20
glow.color = (1.0, 0.6, 0.3)
link(bpy.data.objects.new("LampGlow", glow)).location = (0, 0, LAMP_Z + 0.02)

# ---------------------------------------------------------------- cards
SUIT_GLYPH = {"S": "♠", "H": "♥", "D": "♦", "C": "♣"}
_n = [0]


def make_card(rank="", suit="S", scale=1.0):
    """Card root empty; flat, face up (+Z), centred on the root."""
    _n[0] += 1
    n = "Card_%02d_%s%s" % (_n[0], rank, suit)
    root = empty(n, size=0.04)
    root.scale = (scale,) * 3
    prim("cube", n + "_Body", scale=(CARD_W / 2, CARD_H / 2, CARD_T / 2), material=M["card_back"],
         parent=root, smooth=False)
    prim("plane", n + "_Face", loc=(0, 0, CARD_T / 2 + 0.0003),
         scale=(CARD_W / 2 - 0.003, CARD_H / 2 - 0.003, 1), material=M["card_face"], parent=root)
    prim("plane", n + "_BackTrim", loc=(0, 0, -CARD_T / 2 - 0.0003), rot=(math.pi, 0, 0),
         scale=(CARD_W / 2 - 0.008, CARD_H / 2 - 0.008, 1), material=M["gold"], parent=root)
    prim("plane", n + "_BackIn", loc=(0, 0, -CARD_T / 2 - 0.0006), rot=(math.pi, 0, 0),
         scale=(CARD_W / 2 - 0.012, CARD_H / 2 - 0.012, 1), material=M["card_back"], parent=root)
    if rank:
        ink = M["ink_red"] if suit in "HD" else M["ink_black"]
        for txt, size, loc in ((rank, 0.05, (0, 0.022, 0)), (SUIT_GLYPH[suit], 0.065, (0, -0.032, 0))):
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


# Already-played cards in the middle
for i, (r, s) in enumerate([("7", "C"), ("9", "D"), ("8", "S")]):
    c = make_card(r, s)
    c.location = (0.08 + random.uniform(-0.05, 0.05), 0.1 + random.uniform(-0.05, 0.05),
                  TABLE_TOP + CARD_T / 2 + i * CARD_T)
    c.rotation_euler = (0, 0, random.uniform(-0.9, 0.9))
# Face-down deck
for i in range(10):
    c = make_card()
    c.location = (0.55, 0.4, TABLE_TOP + CARD_T / 2 + i * CARD_T)
    c.rotation_euler = (math.pi, 0, 0.6)
# Cards and coins along the low whoosh path (they streak past the camera)
streak_cards = [((-0.25, -0.05), 0.4, ("Q", "S")), ((0.28, 0.0), -0.7, ("10", "C")),
                ((-0.18, 0.32), 1.2, ("J", "D"))]
for (x, y), rz, (r, s) in streak_cards:
    c = make_card(r, s)
    c.location = (x, y, TABLE_TOP + CARD_T / 2)
    c.rotation_euler = (0, 0, rz)

coins = []
for i, (x, y) in enumerate([(-0.3, -0.62), (0.22, -0.6), (0.12, -0.45), (-0.2, 0.1),
                            (0.2, 0.2), (-0.05, 0.45), (0.35, 0.55), (-0.55, 0.3),
                            (0.6, -0.2), (-0.6, -0.25)]):
    for k in range(1 + i % 3):
        coins.append(prim("cyl", "Coin_%d_%d" % (i, k), material=M["gold"],
                          loc=(x + random.uniform(-0.004, 0.004), y, TABLE_TOP + 0.003 + k * 0.006),
                          scale=(0.022, 0.022, 0.003), vertices=20))
prim("cube", "Notepad", loc=(0.5, -0.4, TABLE_TOP + 0.004), rot=(0, 0, -0.35),
     scale=(0.08, 0.11, 0.004), material=M["paper"], bevel=0.002)
prim("cyl", "Pencil", loc=(0.58, -0.37, TABLE_TOP + 0.008), rot=(math.pi / 2, 0, 0.3),
     scale=(0.005, 0.005, 0.08), material=M["gold"], vertices=6)
prim("cyl", "Ashtray", loc=(0.42, -0.62, TABLE_TOP + 0.015), scale=(0.07, 0.07, 0.015),
     material=M["ashtray"], bevel=0.005)
prim("cyl", "AshtrayAsh", loc=(0.42, -0.62, TABLE_TOP + 0.031), scale=(0.055, 0.055, 0.002),
     material=M["ash"])
for i, (x, y) in enumerate([(-0.5, -0.5), (0.55, 0.5), (-0.6, 0.55), (0.65, 0.1)]):
    prim("cyl", "TableGlass%d" % i, loc=(x, y, TABLE_TOP + 0.045), scale=(0.035, 0.035, 0.045),
         material=M["glass"])
    prim("cyl", "TableGlass%d_Whisky" % i, loc=(x, y, TABLE_TOP + 0.025), scale=(0.03, 0.03, 0.022),
         material=M["whisky"])


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


def seat(name, angle):
    pos = (SEAT_DIST * math.cos(angle), SEAT_DIST * math.sin(angle), 0)
    theta = math.atan2(-pos[1], -pos[0]) - math.pi / 2
    root = empty(name, pos, size=0.3)
    root.rotation_euler = (0, 0, theta)
    prim("cube", name + "_Chair", loc=(0, -0.05, 0.25), scale=(0.3, 0.28, 0.25),
         material=M["wood_dark"], parent=root, bevel=0.02)
    prim("cube", name + "_ChairBack", loc=(0, -0.3, 0.75), scale=(0.3, 0.04, 0.45),
         material=M["wood_dark"], parent=root, bevel=0.02)
    return root, pos, theta


def eyes(head, mat_l, mat_r, r=0.1):
    for side, m in ((-1, mat_l), (1, mat_r)):
        prim("sphere", head.name + ("_EyeL" if side < 0 else "_EyeR"),
             loc=(side * 0.38, 0.88, 0.12), scale=(r,) * 3, material=m, parent=head)


def brows(head, tilt, mat_, z=0.36):
    """tilt > 0: inner ends down (frown)."""
    for side in (-1, 1):
        prim("cube", head.name + "_Brow%d" % side, loc=(side * 0.38, 0.9, z),
             rot=(0, side * tilt, 0), scale=(0.24, 0.06, 0.05), material=mat_, parent=head)


def W(base, th, local):
    return tuple(l2w(base, th, local))


# ---- BOSS (south)
boss, boss_pos, boss_th = seat("BOSS", -math.pi / 2)
prim("cube", "Boss_Torso", loc=(0, 0, 0.98), scale=(0.48, 0.27, 0.42), material=M["suit"],
     parent=boss, bevel=0.12)
prim("cube", "Boss_Shirt", loc=(0, 0.255, 1.15), scale=(0.12, 0.03, 0.22), material=M["white"],
     parent=boss, bevel=0.02)
prim("cube", "Boss_Tie", loc=(0, 0.28, 1.12), scale=(0.04, 0.02, 0.18), material=M["tie"],
     parent=boss, bevel=0.01)
for side in (-1, 1):
    prim("sphere", "Boss_Shoulder%d" % side, loc=(side * 0.42, 0, 1.3), scale=(0.2, 0.2, 0.14),
         material=M["suit"], parent=boss)
boss_head = prim("sphere", "Boss_Head", loc=(0, 0.04, 1.6), scale=(0.2, 0.2, 0.22),
                 material=M["skin"], parent=boss)
prim("sphere", "Boss_Hair", loc=(0, -0.08, 0.12), scale=(1.02, 0.95, 0.72), material=M["brow_dark"],
     parent=boss_head)
prim("cube", "Boss_JawPlate", loc=(-0.62, 0.35, -0.38), rot=(0, 0.3, 0.4), scale=(0.28, 0.42, 0.38),
     material=M["steel"], parent=boss_head, bevel=0.05)
eyes(boss_head, M["red_eye"], M["pupil"], r=0.12)
brows(boss_head, 0.45, M["brow_dark"])
prim("cube", "Boss_Mouth", loc=(0.05, 0.93, -0.42), scale=(0.25, 0.05, 0.03), rot=(0, -0.08, 0),
     material=M["mouth"], parent=boss_head)
# Cigar in the right corner of the mouth, pointing forward/right
cigar = prim("cyl", "Boss_Cigar", loc=(0.13, 0.27, 1.5), rot=(math.radians(82), 0, math.radians(-25)),
             scale=(0.016, 0.016, 0.085), material=M["cigar"], parent=boss)
prim("cyl", "Boss_CigarTip", loc=(0, 0, 1.0), scale=(1.06, 1.06, 0.1), material=M["cigar_tip"],
     parent=cigar)
prim("cyl", "Boss_CigarAsh", loc=(0, 0, 1.12), scale=(1.0, 1.0, 0.06), material=M["ash"],
     parent=cigar)
bpy.context.view_layer.update()
CIGAR_TIP = cigar.matrix_world @ Vector((0, 0, 1.15))

boss_hand = prim("cube", "Boss_RoboHand", scale=(0.06, 0.07, 0.04), material=M["steel"], bevel=0.015)
boss_idle = prim("sphere", "Boss_HandR", parent=boss, loc=(0.3, 0.42, 0.86),
                 scale=(0.07, 0.08, 0.05), material=M["skin"])
prim("torus", "Boss_Ring", parent=boss_idle, loc=(0.2, 0.3, 0.3), scale=(0.35,) * 3,
     material=M["gold"], major_radius=1.0, minor_radius=0.3)
arm("Boss_ArmL", boss, (-0.42, 0.0, 1.22), boss_hand, M["suit"], 0.1)
arm("Boss_ArmR", boss, (0.42, 0.0, 1.22), boss_idle, M["suit"], 0.1)
label("BOSS", boss, 2.05)

# ---- KNIGHT (north, facing the BOSS)
knight, knight_pos, knight_th = seat("KNIGHT", math.pi / 2)
prim("cube", "Knight_Torso", loc=(0, 0, 1.0), scale=(0.3, 0.2, 0.38), material=M["silver"],
     parent=knight, bevel=0.08)
prim("cube", "Knight_Collar", loc=(0, 0.02, 1.38), scale=(0.13, 0.12, 0.06), material=M["teal"],
     parent=knight, bevel=0.03)
prim("cube", "Knight_Trim", loc=(0, 0.19, 1.0), scale=(0.31, 0.02, 0.03), material=M["gold"],
     parent=knight)
for side in (-1, 1):
    pa = prim("sphere", "Knight_Pauldron%d" % side, loc=(side * 0.36, 0, 1.3), scale=(0.18, 0.17, 0.12),
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
eyes(knight_head, M["pupil"], M["pupil"])
brows(knight_head, -0.25, M["hair_blond"])
prim("cube", "Knight_Grin", loc=(0.08, 0.92, -0.42), rot=(0, -0.2, 0), scale=(0.3, 0.05, 0.06),
     material=M["teeth"], parent=knight_head)
knight_hand = prim("cube", "Knight_Gauntlet", scale=(0.07, 0.08, 0.06), material=M["silver"], bevel=0.02)
prim("cube", "Knight_GauntletTrim", loc=(0, -0.9, 0), scale=(1.1, 0.25, 1.1), material=M["gold"],
     parent=knight_hand)
knight_idle = prim("cube", "Knight_GauntletL", parent=knight, loc=(-0.28, 0.42, 0.86),
                   scale=(0.06, 0.07, 0.05), material=M["silver"], bevel=0.02)
arm("Knight_ArmR", knight, (0.36, 0, 1.22), knight_hand, M["silver"], 0.075)
arm("Knight_ArmL", knight, (-0.36, 0, 1.22), knight_idle, M["silver"], 0.075)
label("KNIGHT", knight, 2.0)

# ---- COWBOY (west)
cowboy, cowboy_pos, cowboy_th = seat("COWBOY", math.pi)
prim("cube", "Cowboy_Shirt", loc=(0, 0, 1.05), scale=(0.25, 0.15, 0.44), material=M["white"],
     parent=cowboy, bevel=0.07)
for side in (-1, 1):
    prim("cube", "Cowboy_Vest%d" % side, loc=(side * 0.14, 0.03, 1.02), scale=(0.12, 0.14, 0.4),
         material=M["vest"], parent=cowboy, bevel=0.03)
prim("cone", "Cowboy_Bandana", loc=(0, 0.1, 1.42), rot=(math.pi + 0.3, 0, 0), scale=(0.13, 0.08, 0.12),
     material=M["bandana"], parent=cowboy)
cowboy_head = prim("sphere", "Cowboy_Head", loc=(0, 0.03, 1.7), scale=(0.14, 0.15, 0.21),
                   material=M["skin_tan"], parent=cowboy)
prim("cube", "Cowboy_Hair", loc=(0, -0.45, -0.45), scale=(0.95, 0.45, 0.75), material=M["hair_brown"],
     parent=cowboy_head, bevel=0.1)
for side in (-1, 1):
    prim("cone", "Cowboy_Stache%d" % side, loc=(side * 0.3, 0.85, -0.35), rot=(0, side * 2.1, 0),
         scale=(0.15, 0.12, 0.45), material=M["hair_brown"], parent=cowboy_head)
eyes(cowboy_head, M["pupil"], M["pupil"], r=0.07)
hat = empty("Cowboy_HatPivot", (0, 0, 0.75), parent=cowboy_head, size=0.1)
prim("cyl", "Cowboy_HatBrim", scale=(2.3, 2.1, 0.06), material=M["hat"], parent=hat, vertices=32)
prim("cyl", "Cowboy_HatCrown", loc=(0, 0, 0.45), scale=(1.15, 1.05, 0.45), material=M["hat"],
     parent=hat, bevel=0.05)
prim("cyl", "Cowboy_HatBand", loc=(0, 0, 0.12), scale=(1.18, 1.08, 0.08), material=M["hat_band"],
     parent=hat)
cowboy_r = prim("sphere", "Cowboy_HandR", parent=cowboy, loc=(0.18, 0.42, 0.95),
                scale=(0.055, 0.065, 0.04), material=M["skin_tan"])
cowboy_l = prim("sphere", "Cowboy_HandL", parent=cowboy, loc=(-0.18, 0.42, 0.95),
                scale=(0.055, 0.065, 0.04), material=M["skin_tan"])
arm("Cowboy_ArmR", cowboy, (0.26, 0, 1.36), cowboy_r, M["white"], 0.06)
arm("Cowboy_ArmL", cowboy, (-0.26, 0, 1.36), cowboy_l, M["white"], 0.06)
label("COWBOY", cowboy, 2.2)

# ---- MEDUSA (east)
medusa, medusa_pos, medusa_th = seat("MEDUSA", 0.0)
prim("cube", "Medusa_Torso", loc=(0, 0, 1.0), scale=(0.24, 0.15, 0.38), material=M["medusa_skin"],
     parent=medusa, bevel=0.1)
prim("cube", "Medusa_Toga", loc=(0.04, 0.01, 0.92), rot=(0, 0.45, 0), scale=(0.18, 0.17, 0.42),
     material=M["toga"], parent=medusa, bevel=0.05)
prim("torus", "Medusa_Clasp", loc=(0.17, 0.15, 1.28), rot=(math.pi / 2, 0, 0), scale=(0.045,) * 3,
     material=M["gold"], parent=medusa, major_radius=1.0, minor_radius=0.25)
medusa_head = prim("sphere", "Medusa_Head", loc=(0, 0.04, 1.56), scale=(0.15, 0.16, 0.19),
                   material=M["medusa_skin"], parent=medusa)
prim("cube", "Medusa_StonePatch", loc=(-0.55, 0.62, 0.0), rot=(0, 0, 0.6), scale=(0.12, 0.25, 0.4),
     material=M["stone_patch"], parent=medusa_head)
prim("torus", "Medusa_Earring", loc=(-0.98, 0.1, -0.45), rot=(0, math.pi / 2, 0), scale=(0.32,) * 3,
     material=M["gold"], parent=medusa_head, major_radius=1.0, minor_radius=0.3)
eyes(medusa_head, M["snake_eye"], M["snake_eye"], r=0.09)
for i in range(7):
    ang = -2.6 + i * (5.2 / 6)
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
    pts = [Vector((0, 0, 0)), out * 0.18 + Vector((0, 0, 0.14)), out * 0.24 + Vector((0, 0.06, 0.26))]
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    so = link(bpy.data.objects.new("Medusa_Snake%d" % i, cu))
    so.data.materials.append(M["snake"])
    so.parent = pivot
    shead = prim("sphere", "Medusa_SnakeHead%d" % i, loc=pts[2] + Vector((0, 0.02, 0.01)),
                 scale=(0.035, 0.05, 0.028), material=M["snake"], parent=pivot)
    for side in (-1, 1):
        prim("sphere", shead.name + "_Eye%d" % side, loc=(side * 0.6, 0.5, 0.45), scale=(0.28,) * 3,
             material=M["snake_eye"], parent=shead)
    key(pivot, 1, rot=(0, 0, 0))
    add_noise(pivot, "rotation_euler", 0.35, 12.0)          # sway
medusa_r = prim("sphere", "Medusa_HandR", parent=medusa, loc=(0.22, 0.42, 0.9),
                scale=(0.05, 0.06, 0.035), material=M["medusa_skin"])
for k in range(3):
    prim("cone", "Medusa_Claw%d" % k, loc=((k - 1) * 0.55, 1.3, -0.2), rot=(-math.pi / 2, 0, 0),
         scale=(0.18, 0.18, 0.8), material=M["gold"], parent=medusa_r)
medusa_l = prim("sphere", "Medusa_HandL", parent=medusa, loc=(-0.24, 0.42, 0.88),
                scale=(0.05, 0.06, 0.035), material=M["medusa_skin"])
arm("Medusa_ArmR", medusa, (0.24, 0, 1.3), medusa_r, M["medusa_skin"], 0.05)
arm("Medusa_ArmL", medusa, (-0.24, 0, 1.3), medusa_l, M["medusa_skin"], 0.05)
prim("cyl", "Medusa_ArmCuff", loc=(-0.25, 0.12, 1.12), rot=(math.pi / 2.6, 0, 0),
     scale=(0.06, 0.06, 0.05), material=M["gold"], parent=medusa)
label("MEDUSA", medusa, 2.0)

# Card fans held in hands
def fan(hand, n=4):
    cards = []
    for k in range(n):
        c = make_card()
        c.parent = hand
        c.location = (0.2 + k * 0.25, 0.6, 1.4)
        c.rotation_euler = (math.radians(-70), math.radians(-25 + k * 14), 0)
        c.scale = (1 / hand.scale[0], 1 / hand.scale[1], 1 / hand.scale[2])
        cards.append(c)
    return cards


fan(boss_idle)
fan(knight_idle)
fan(cowboy_l)
fan(medusa_l)

# Idle: COWBOY shuffles (right hand riffles cards into the left), MEDUSA's hand taps
shuffle_card = make_card()
for f in range(1, FRAME_END + 1, 12):
    up = (f // 12) % 2 == 0
    key(cowboy_r, f, loc=(0.18 if up else -0.05, 0.42, 1.05 if up else 0.96))
    loc_w = l2w(cowboy_pos, cowboy_th, (0.18 if up else -0.05, 0.47, 1.0 if up else 0.94))
    key(shuffle_card, f, loc=tuple(loc_w), rot=(math.radians(-60), 0, cowboy_th + (0.4 if up else -0.2)))
for f in range(1, FRAME_END + 1, 18):
    key(medusa_r, f, loc=(0.22, 0.42, 0.9 if (f // 18) % 2 == 0 else 0.86))

# ---------------------------------------------------------------- BOSS performance
SPOT_KING = Vector((-0.05, -0.36, TABLE_TOP + CARD_T / 2))
king = make_card("K", "H", scale=1.25)
h_rest = W(boss_pos, boss_th, (-0.3, 0.42, 0.86))
h_up = W(boss_pos, boss_th, (-0.18, 0.4, 1.62))
h_slam = tuple(SPOT_KING + Vector((0, 0, 0.05)))
for f, loc in ((1, h_rest), (30, h_rest), (40, h_up), (43, h_up), (F_KING, h_slam),
               (F_KING + 2, h_slam), (F_KING + 9, tuple(Vector(h_slam) + Vector((-0.12, -0.22, 0.3)))),
               (F_KING + 26, h_rest)):
    key(boss_hand, f, loc=loc)
for f, loc, r in ((1, h_rest, (0.6, 0, 0)), (30, h_rest, (0.6, 0, 0)), (40, h_up, (1.3, 0, 0.3)),
                  (43, h_up, (1.4, 0, 0.3))):
    key(king, f, loc=tuple(Vector(loc) + Vector((0, 0, -0.05))), rot=r)
key(king, F_KING, loc=tuple(SPOT_KING), rot=(0, 0, 0.15))

# Cigar: embers pop, smoke curls, ash drops
smoke_mat, smoke_vol = volume_mat("Smoke", (0.8, 0.77, 0.74), 1.2)
for i in range(7):
    s = prim("ico", "Smoke%d" % i, material=smoke_mat, subdivisions=2)
    start = CIGAR_TIP + Vector((0, 0, 0.01))
    drift = Vector((random.uniform(-0.05, 0.05), random.uniform(-0.05, 0.05), 0.25 + i * 0.03))
    f0 = 1 + i * 4
    key(s, f0, loc=tuple(start), scale=0.005)
    key(s, f0 + 30, loc=tuple(start + drift), scale=0.05 + i * 0.006)
    key(s, f0 + 60, loc=tuple(start + drift * 1.8 + Vector((0.08, 0, 0))), scale=0.0)
for i in range(12):
    e = prim("ico", "Ember%d" % i, material=M["ember"], subdivisions=1, smooth=False)
    f0 = random.randint(1, 26)
    v = Vector((random.uniform(-0.05, 0.05), random.uniform(-0.05, 0.05), random.uniform(0.04, 0.12)))
    key(e, f0 - 1, loc=tuple(CIGAR_TIP), scale=0.0)
    key(e, f0, scale=0.004)
    key(e, f0 + 8, loc=tuple(CIGAR_TIP + v), scale=0.0)
ash_bit = prim("ico", "AshBit", material=M["ash"], subdivisions=1)
key(ash_bit, 8, loc=tuple(CIGAR_TIP), scale=0.008)
key(ash_bit, 24, loc=tuple(CIGAR_TIP + Vector((0.01, 0.02, -0.4))), scale=0.006)
tip_in = bsdf_of(M["cigar_tip"]).inputs["Emission Strength"]
for f, v in ((1, 15), (6, 30), (10, 18), (16, 35), (22, 20)):
    key_input(tip_in, f, v)
eye_in = bsdf_of(M["red_eye"]).inputs["Emission Strength"]
for f, v in ((1, 8), (F_FACE - 6, 8), (F_FACE, 70), (F_FACE + 10, 25), (F_KING, 60), (F_KING + 10, 10)):
    key_input(eye_in, f, v)

for f, z in ((1, 0), (F_KING - 1, 0), (F_KING + 1, -0.012), (F_KING + 5, 0.004), (F_KING + 9, 0)):
    key(table, f, loc=(0, 0, z))
for co in coins:
    if (co.location.xy - SPOT_KING.xy).length > 0.5:
        continue
    z0 = co.location.z
    key(co, F_KING, loc=tuple(co.location), rot=(0, 0, 0))
    key(co, F_KING + 4, loc=(co.location.x, co.location.y, z0 + random.uniform(0.03, 0.06)),
        rot=(random.uniform(-0.8, 0.8), random.uniform(-0.8, 0.8), 0))
    key(co, F_KING + 9, loc=(co.location.x, co.location.y, z0), rot=(0, 0, 0))

# ---------------------------------------------------------------- KNIGHT performance
ace = make_card("A", "H", scale=1.25)
k_rest = W(knight_pos, knight_th, (0.28, 0.42, 0.86))
k_wind = W(knight_pos, knight_th, (0.34, 0.18, 1.32))
k_snap = W(knight_pos, knight_th, (0.2, 0.62, 1.28))
for f, loc in ((1, k_rest), (92, k_rest), (100, k_wind), (F_FLICK, k_snap), (F_FLICK + 8, k_snap),
               (F_FLICK + 26, k_rest)):
    key(knight_hand, f, loc=loc)
key(ace, 1, loc=tuple(Vector(k_rest) + Vector((0, 0, -0.06))), rot=(0.5, 0, 0))
key(ace, 92, loc=tuple(Vector(k_rest) + Vector((0, 0, -0.06))), rot=(0.5, 0, 0))
key(ace, 100, loc=tuple(Vector(k_wind) + Vector((0, 0, -0.06))), rot=(1.2, 0, 0))

# Flight: launch -> high spinning arc -> touch -> slide onto the King (keyed per frame)
P0 = Vector(k_snap) + Vector((0, 0, -0.04))
TOUCH = Vector((0.06, -0.12, TABLE_TOP + CARD_T / 2 + 0.003))
REST = SPOT_KING + Vector((0.01, 0.01, CARD_T * 1.25 + 0.001))
APEX_H = 0.85


def ace_pos(f):
    if f <= F_ACE_TOUCH:
        t = (f - F_FLICK) / (F_ACE_TOUCH - F_FLICK)
        p = P0.lerp(TOUCH, t)
        p.z += APEX_H * 4 * t * (1 - t) * (1 - 0.15 * t)
        return p, (1.2 * (1 - t) + 0.25 * math.sin(t * 9), 0.3 * math.sin(t * 7), t * 5 * math.pi)
    t = min(1.0, (f - F_ACE_TOUCH) / (F_ACE_STOP - F_ACE_TOUCH))
    e = 1 - (1 - t) ** 3                       # slide decelerates
    return TOUCH.lerp(REST, e), (0, 0, 5 * math.pi + e * 0.9 + 0.15)


for f in range(F_FLICK, F_ACE_STOP + 1):
    p, r = ace_pos(f)
    key(ace, f, loc=tuple(p), rot=r)
for fc in fcurves_of(ace):
    for kp in fc.keyframe_points:
        if kp.co[0] >= F_FLICK:
            kp.interpolation = "LINEAR"

# Gold light trail: beads that follow the ace's path with a delay
for i in range(10):
    b = prim("ico", "Trail%d" % i, material=M["trail"], subdivisions=1)
    lag = 0.7 * (i + 1)
    size = 0.012 * (1 - i / 11)
    key(b, F_FLICK - 1, loc=tuple(P0), scale=0.0)
    for f in range(F_FLICK, F_ACE_TOUCH + 4):
        tf = max(F_FLICK, min(F_ACE_TOUCH, f - lag))
        p, _ = ace_pos(tf)
        fade = 1.0 if f <= F_ACE_TOUCH else max(0.0, 1 - (f - F_ACE_TOUCH) / 4)
        key(b, f, loc=tuple(p), scale=size * fade)

# ---------------------------------------------------------------- camera
cam_rig = empty("CamRig", size=0.2)
cam_data = bpy.data.cameras.new("Cam")
cam_data.sensor_fit = "HORIZONTAL"
cam_data.sensor_width = 36
cam_data.clip_start = 0.01
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

HEAD_BOSS = Vector(W(boss_pos, boss_th, (0, 0.06, 1.58)))
HEAD_KNIGHT = Vector(W(knight_pos, knight_th, (0, 0.05, 1.5)))
FINAL_C = Vector((2.95, -3.3, 3.05))
FINAL_A = Vector((0.15, 0.05, 0.9))

# (frame, camera, aim, focus, f-stop, lens). Overshoot keys are added by whoosh().
CAM = []


def k(f, c, a, fo, fs, lens):
    CAM.append((f, Vector(c), Vector(a), Vector(fo), fs, lens))


def whoosh(f_land, c, a, fo, fs, lens, settle=5, amount=0.10):
    """Arrive past the target (overshoot), then spring back to it."""
    prev_c, prev_a = CAM[-1][1], CAM[-1][2]
    c, a = Vector(c), Vector(a)
    k(f_land, c + (c - prev_c) * amount, a + (a - prev_a) * amount * 0.5, fo, fs, lens)
    k(f_land + settle, c, a, fo, fs, lens)


tip = CIGAR_TIP
# 0-0.7s: ECU on the glowing cigar tip, creeping in
k(1, tip + Vector((0.34, 0.22, 0.05)), tip, tip, 1.0, 50)
k(20, tip + Vector((0.14, 0.09, 0.02)), tip, tip, 1.0, 50)
# 0.7-1.2s: WHOOSH back to the tense face
whoosh(F_FACE, (0.28, -0.28, 1.64), HEAD_BOSS, HEAD_BOSS, 2.0, 32, settle=4)
# 1.2-2.2s: whip down with the throwing hand, ride the card to the felt and keep going
k(42, (-0.62, -0.42, 1.42), Vector(h_up) + Vector((0, 0.05, -0.1)), Vector(h_up), 2.2, 30)
k(F_KING, (0.12, -0.02, 1.02), SPOT_KING, SPOT_KING, 2.0, 30)
k(58, (-0.08, 0.1, 0.92), SPOT_KING + Vector((0.05, 0.3, 0.05)), SPOT_KING, 2.0, 28)
# 2.2-3.2s: WHOOSH low across the felt toward the KNIGHT
k(66, (-0.18, 0.12, 0.87), HEAD_KNIGHT + Vector((0, 0, -0.2)), HEAD_KNIGHT, 2.8, 24)
whoosh(88, (0.24, 0.42, 0.85), HEAD_KNIGHT + Vector((0, 0, 0.05)), HEAD_KNIGHT, 2.8, 22, settle=4)
# 3.2-4.4s: low angle on the KNIGHT, follow the flicked Ace up and whip round to the landing
k(F_FLICK, (0.05, 0.5, 0.86), HEAD_KNIGHT + Vector((-0.2, -0.3, 0.05)), Vector(k_snap), 2.8, 22)
k(F_FLICK + 7, (0.3, 0.32, 0.88), ace_pos(F_FLICK + 7)[0], ace_pos(F_FLICK + 7)[0], 3.5, 22)
k(F_ACE_TOUCH - 3, (0.38, 0.18, 1.02), ace_pos(F_ACE_TOUCH - 3)[0], ace_pos(F_ACE_TOUCH - 3)[0], 3.5, 24)
whoosh(F_ACE_STOP, (0.36, -0.02, 1.0), REST + Vector((0, -0.02, 0)), REST, 3.0, 28, settle=4)
# 4.4-5.4s: WHOOSH up above the table and swing out
k(146, (0.95, -0.75, 2.3), Vector((0, 0, 1.0)), Vector((0, 0, 0.9)), 5.0, 26)
whoosh(F_WIDE, FINAL_C, FINAL_A, Vector((0, 0, 1.0)), 6.0, 26, settle=8, amount=0.08)
# 5.4-7s: final framing, subtle float
# keyed past the last frame so the camera is still moving at frame 210
k(FRAME_END + 40, FINAL_C + Vector((-0.6, 0.67, -0.35)), FINAL_A,
  Vector((0, 0, 1.0)), 6.0, 26)

for f, c, a, fo, fs, lens in CAM:
    key(cam_rig, f, loc=tuple(c))
    key(aim, f, loc=tuple(a))
    key(focus, f, loc=tuple(fo))
    key_value(cam_data.dof, "aperture_fstop", f, fs)
    key_value(cam_data, "lens", f, lens)

# Snappy: sharp acceleration (short handles) between keys
for o in (cam_rig, aim):
    for fc in fcurves_of(o):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"

# Handheld shake + kicks on impacts (on the camera's local offset)
key(cam, 1, loc=(0, 0, 0))
for fc in fcurves_of(cam):
    if fc.data_path != "location":
        continue
    n = fc.modifiers.new("NOISE")
    n.scale, n.strength, n.phase = 10.0, 0.006, random.uniform(0, 100)
    for hit, amp in ((F_FACE, 0.02), (F_KING, 0.045), (F_ACE_TOUCH, 0.03), (F_WIDE, 0.025)):
        kk = fc.modifiers.new("NOISE")
        kk.scale, kk.strength, kk.phase = 1.5, amp, random.uniform(0, 100)
        kk.use_restricted_range = True
        kk.frame_start, kk.frame_end = hit, hit + 9
        kk.blend_in, kk.blend_out = 0.0, 6.0

# ---------------------------------------------------------------- glare (best effort)
def setup_glare():
    try:
        if hasattr(scene, "compositing_node_group"):        # Blender 5.x
            ng = bpy.data.node_groups.new("Compositing", "CompositorNodeTree")
            scene.compositing_node_group = ng
            ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
            rl = ng.nodes.new("CompositorNodeRLayers")
            gl = ng.nodes.new("CompositorNodeGlare")
            out = ng.nodes.new("NodeGroupOutput")
            for name, val in (("Type", "Bloom"), ("Threshold", 1.0), ("Strength", 0.6), ("Size", 0.6)):
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
            types = [i.identifier for i in gl.bl_rna.properties["glare_type"].enum_items]
            gl.glare_type = "BLOOM" if "BLOOM" in types else "FOG_GLOW"
            gl.threshold = 1.0
            nt.links.new(rl.outputs["Image"], gl.inputs["Image"])
            nt.links.new(gl.outputs["Image"], comp.inputs["Image"])
    except Exception as e:
        print("Glare setup skipped:", e)


setup_glare()

# ---------------------------------------------------------------- save + render
scene.frame_set(1)
blend_path = os.path.join(OUT_DIR, "blot_splash_v2.blend")
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
    for f in TEST_FRAMES:
        scene.frame_set(f)
        scene.render.filepath = os.path.join(OUT_DIR, "test_frames", "frame_%03d.png" % f)
        bpy.ops.render.render(write_still=True)

if DO_RENDER:
    set_output("VIDEO")
    scene.render.filepath = os.path.join(OUT_DIR, "preview.mp4")
    bpy.ops.render.render(animation=True)
    print("Rendered", scene.render.filepath)
