"""Render a deck module to HTML with the real brand fonts, then to PDF via headless Chromium.
Also writes out/spec.json and crops one image asset per image element for the Figma upload.

Usage: python3 render_preview.py path/to/deck.py
The deck module defines `slides` (built with gru_kit) and `IMAGES` {key: (path, crop_box or None)}.
Output goes next to the deck module: out/spec.json, out/preview.html, out/preview.pdf, assets/*."""
import html
import importlib.util
import json
import os
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gru_kit import STYLES, FONT_DIR  # noqa

IMAGES = {}
OUT = ASSETS = None
CHROME = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'

PLUS_PATH = 'M14.5519 8.15717C14.5519 10.5116 16.4606 12.4203 18.8151 12.4203H27V14.5519H18.8151C16.4606 14.5519 14.5519 16.4606 14.5519 18.8151V27H12.4203V18.8151C12.4203 16.4606 10.5117 14.5519 8.15718 14.5519H0V12.4203H8.15717C10.5116 12.4203 12.4203 10.5117 12.4203 8.15718V0H14.5519V8.15717Z'
LOGO_SVG = open(os.path.join(HERE, 'logo_badge.svg')).read()


def prep_image(slide_id, e):
    src, box = IMAGES[e['s']]
    im = Image.open(src)
    if box:
        im = im.crop(box)
    has_alpha = im.mode in ('RGBA', 'LA') and im.getextrema()[-1][0] < 255
    im = im.convert('RGBA' if has_alpha else 'RGB')
    tw, th = e['w'], e['h']
    sw, sh = im.size
    target = tw / th
    if sw / sh > target:
        nw = round(sh * target)
        x0 = (sw - nw) // 2
        im = im.crop((x0, 0, x0 + nw, sh))
    else:
        nh = round(sw / target)
        y0 = (sh - nh) // 2
        im = im.crop((0, y0, sw, y0 + nh))
    scale = min(1.0, max(tw * 2.0, 640) / im.size[0])
    if scale < 1:
        im = im.resize((round(im.size[0] * scale), round(im.size[1] * scale)), Image.LANCZOS)
    ext = 'png' if has_alpha else 'jpg'
    name = f"{slide_id}-{e['s']}.{ext}"
    path = os.path.join(ASSETS, name)
    if has_alpha:
        im.save(path, optimize=True)
    else:
        im.save(path, quality=90, optimize=True)
    return name


def rgba(hexc, op):
    h = hexc.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f'rgba({r},{g},{b},{op})'


def text_html(e):
    k = e['k']
    paras = [[]]
    for t, st, op in e['r']:
        parts = t.split('\n')
        for i, p in enumerate(parts):
            if i:
                paras.append([])
            if p:
                paras[-1].append((p, st, op))
    lh = max(STYLES[st]['lh'] * k for _t, st, _o in e['r'])
    para_sp = max(STYLES[st]['para'] * k for _t, st, _o in e['r'])
    out = []
    for i, para in enumerate(paras):
        spans = []
        for p, st, op in para:
            s = STYLES[st]
            css = (f"font-family:'{s['fam']}';font-weight:{s['wt']};font-size:{s['size'] * k:.3f}px;"
                   f"letter-spacing:{s['ls'] * s['size'] * k:.3f}px;color:{rgba('#FFFFFF', op)};"
                   + ('text-transform:uppercase;' if s['case'] == 'upper' else ''))
            spans.append(f'<span style="{css}line-height:0">{html.escape(p).replace(chr(0x2028), "<br>")}</span>')
        mb = para_sp if i < len(paras) - 1 else 0
        s0 = STYLES[e['r'][0][1]]
        strut = f"font-family:'{s0['fam']}';font-size:{s0['size'] * k:.3f}px;"
        out.append(f'<div style="{strut}line-height:{lh:.3f}px;margin-bottom:{mb:.2f}px;min-height:{lh:.2f}px">{"".join(spans)}</div>')
    width = f"width:{e['w']}px;" if 'w' in e else 'white-space:nowrap;'
    align = {'L': 'left', 'C': 'center', 'R': 'right'}[e.get('a', 'L')]
    return f'<div class="el" style="left:{e["x"]}px;top:{e["y"]}px;{width}text-align:{align}">{"".join(out)}</div>'


def el_html(sid, e, manifest):
    t = e['t']
    if t == 'x':
        return text_html(e)
    if t == 'r':
        css = f"left:{e['x']}px;top:{e['y']}px;width:{e['w']}px;height:{e['h']}px;"
        if 'f' in e:
            css += f"background:{rgba(e['f'], e['fo'])};"
        if 's' in e:
            css += f"border:{e.get('sw', 2)}px {'dashed' if e.get('d') else 'solid'} {rgba(e['s'], e['so'])};"
        if 'rd' in e:
            css += f"border-radius:{e['rd']}px;"
        return f'<div class="el" style="{css}"></div>'
    if t == 'g':
        d = {'lr': 'to right', 'rl': 'to left', 'tb': 'to bottom', 'bt': 'to top'}[e['dir']]
        return (f'<div class="el" style="left:{e["x"]}px;top:{e["y"]}px;width:{e["w"]}px;height:{e["h"]}px;'
                f'background:linear-gradient({d},rgba(0,0,0,{e["a0"]}),rgba(0,0,0,{e["a1"]}))"></div>')
    if t == 'i':
        name = prep_image(sid, e)
        manifest.append(dict(slide=sid, n=e['n'], file=name, w=e['w'], h=e['h']))
        css = f"left:{e['x']}px;top:{e['y']}px;width:{e['w']}px;height:{e['h']}px;object-fit:cover;opacity:{e.get('o', 1)};"
        if e.get('rd'):
            css += f"border-radius:{e['rd']}px;"
        return f'<img class="el" src="file://{ASSETS}/{name}" style="{css}">'
    if t == 'a':
        x1, y1, x2, y2 = e['x1'], e['y1'], e['x2'], e['y2']
        return (f'<svg class="el" style="left:0;top:0;overflow:visible" width="1" height="1">'
                f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="rgba(255,255,255,{e["o"]})" stroke-width="2"/>'
                f'<polyline points="{x2 - 10},{y2 - 7} {x2},{y2} {x2 - 10},{y2 + 7}" fill="none" stroke="rgba(255,255,255,{e["o"]})" stroke-width="2"/></svg>')
    if t == 'p':
        s = e['sz']
        return (f'<svg class="el" style="left:{e["x"]}px;top:{e["y"]}px" width="{s}" height="{s}" viewBox="0 0 27 27">'
                f'<path d="{PLUS_PATH}" fill="white" fill-opacity="0.5"/></svg>')
    if t == 'l':
        s = e['sz']
        return f'<div class="el" style="left:{e["x"]}px;top:{e["y"]}px;width:{s * 81 / 80:.1f}px;height:{s}px">{LOGO_SVG}</div>'
    raise ValueError(t)


def load_deck(path):
    spec = importlib.util.spec_from_file_location('deck', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    global IMAGES, OUT, ASSETS
    deck_path = os.path.abspath(sys.argv[1])
    deck = load_deck(deck_path)
    IMAGES = deck.IMAGES
    base = os.path.dirname(deck_path)
    OUT, ASSETS = os.path.join(base, 'out'), os.path.join(base, 'assets')
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ASSETS, exist_ok=True)
    spec = dict(slides=deck.slides, images={k: v[0] for k, v in IMAGES.items()})
    json.dump(spec, open(os.path.join(OUT, 'spec.json'), 'w'), ensure_ascii=False, indent=1)
    fonts = ''.join(
        f"@font-face{{font-family:'{fam}';font-weight:{wt};src:url('file://{FONT_DIR}/{fn}')}}"
        for (fam, wt, fn) in [('Overused Grotesk', 400, 'OverusedGrotesk-Roman.otf'),
                              ('Overused Grotesk', 500, 'OverusedGrotesk-Medium.otf'),
                              ('PP Mondwest', 400, 'PPMondwest-Regular.otf')])
    pages = []
    manifest = []
    for s in spec['slides']:
        body = ''.join(el_html(s['id'], e, manifest) for e in s['els'])
        pages.append(f'<section class="slide" style="background:{s["bg"]}">{body}</section>')
    doc = f"""<!doctype html><html><head><meta charset="utf-8"><style>{fonts}
@page {{ size: 1920px 1080px; margin: 0 }}
html,body {{ margin:0; padding:0; background:#000 }}
.slide {{ position:relative; width:1920px; height:1080px; overflow:hidden; page-break-after:always; -webkit-print-color-adjust:exact; print-color-adjust:exact }}
.el {{ position:absolute; box-sizing:border-box }}
svg.el {{ overflow:visible }}
</style></head><body>{''.join(pages)}</body></html>"""
    hp = os.path.join(OUT, 'preview.html')
    open(hp, 'w').write(doc)
    json.dump(manifest, open(os.path.join(OUT, 'images.json'), 'w'), indent=1)
    pdf = os.path.join(OUT, 'preview.pdf')
    subprocess.run([CHROME, '--headless', '--no-sandbox', '--allow-file-access-from-files', '--disable-gpu',
                    '--no-pdf-header-footer', f'--print-to-pdf={pdf}', 'file://' + hp],
                   check=True, capture_output=True, timeout=180)
    print('pdf ok', os.path.getsize(pdf))


if __name__ == '__main__':
    main()
