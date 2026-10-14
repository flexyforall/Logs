"""GRU deck kit: brand tokens, text layout and element constructors.

All coordinates are Figma px on a 1920x1080 slide. A slide spec is plain JSON so the
same data drives the Chromium preview and the Figma build.
"""
import os
from PIL import ImageFont

FONT_DIR = os.path.expanduser('~/.fonts/gru')
FONT_FILES = {
    ('Overused Grotesk', 400): 'OverusedGrotesk-Roman.otf',
    ('Overused Grotesk', 500): 'OverusedGrotesk-Medium.otf',
    ('PP Mondwest', 400): 'PPMondwest-Regular.otf',
}
# vertical metrics (hhea / unitsPerEm) and cap height, used to place cap tops
METRICS = {
    'Overused Grotesk': dict(asc=1.054, desc=0.276, cap=0.700),
    'PP Mondwest': dict(asc=0.7998, desc=0.2400, cap=0.6399),
}

# Text styles that already exist in the GRU Figma file. The Figma build applies the
# style (which carries the brand font) and then rescales the node by k.
STYLES = {
    'H1OG': dict(id='S:de6f98243046b3ce6bde246ea15edbbe740233b0,', fam='Overused Grotesk', wt=400, size=64, lh=72, ls=0, case=None, para=0),
    'H1PP': dict(id='S:c4186cbf4fe48c0556f2ee14f8920f2f25d71734,', fam='PP Mondwest', wt=400, size=64, lh=72, ls=0, case=None, para=0),
    'H2OG': dict(id='S:4e263d7662fc62c4f0372e3920c58581325e7e77,', fam='Overused Grotesk', wt=400, size=56, lh=62, ls=0, case=None, para=0),
    'H2PP': dict(id='S:1ce7431787aa3ed5346655ad4b9dfe465c7791b7,', fam='PP Mondwest', wt=400, size=60, lh=62, ls=0, case=None, para=0),
    'B2':   dict(id='S:a1dee3ceb3a8ed58360558fc518f1d386093eb4f,', fam='Overused Grotesk', wt=400, size=20, lh=28, ls=0, case=None, para=12),
    'U1PP': dict(id='S:e1dc005eb887b9f8d22dd27f91d0377b17550132,', fam='PP Mondwest', wt=400, size=16, lh=20, ls=0, case='upper', para=0),
    'C1PP': dict(id='S:2854b54f36c718deadf9b366b0e6d6fdee4a8e2d,', fam='PP Mondwest', wt=400, size=16, lh=20, ls=0, case=None, para=0),
    'U2OGM': dict(id='S:001773a3e1c623a685e40163b68d65705d51430d,', fam='Overused Grotesk', wt=500, size=14, lh=22, ls=0.02, case='upper', para=0),
}

# Brand roles: (style for each run kind, scale k)
K_HEAD = 90 / 56        # Overused 90 + Mondwest 96.4, line 99.6
K_SUB = 1.4             # Overused 28 / 39.2
K_BODY = 1.4            # Overused 28 / 39.2
K_BODY_L = 2.0          # Overused 40 / 56
K_CAP = 1.0             # Overused 20 / 28
K_LABEL = 1.5           # Mondwest 24 / 30, uppercase
K_NUM = 1.75            # Mondwest 28 / 35
K_MW_L = 2.5            # Mondwest 40 / 50

M = 60                  # side margin
CW = 1800               # content width
HAIR = 0.16             # hairline / card stroke opacity
PILL_STROKE = 0.12

_font_cache = {}


def _font(fam, wt, size):
    key = (fam, wt, round(size, 2))
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(os.path.join(FONT_DIR, FONT_FILES[(fam, wt)]), size=max(1.0, float(size)))
    return _font_cache[key]


def run_style(st, k):
    s = STYLES[st]
    return dict(fam=s['fam'], wt=s['wt'], size=s['size'] * k, lh=s['lh'] * k, ls=s['ls'], case=s['case'], para=s['para'] * k)


def measure_lines(runs, k, width):
    """Greedy word wrap over styled runs. Returns list of line widths (one per visual line)."""
    lines = [[0.0]]
    for text, st, _op in runs:
        s = run_style(st, k)
        f = _font(s['fam'], s['wt'], s['size'])
        t = text.upper() if s['case'] == 'upper' else text
        paras = t.replace('\u2028', '\n').split('\n')
        for pi, para in enumerate(paras):
            if pi > 0:
                lines.append([0.0])
            words = para.split(' ')
            for wi, w in enumerate(words):
                token = w + (' ' if wi < len(words) - 1 else '')
                tw = f.getlength(token) + s['ls'] * s['size'] * len(token)
                core = f.getlength(w) + s['ls'] * s['size'] * len(w)
                cur = lines[-1]
                if width and cur[0] > 0 and cur[0] + core > width:
                    lines.append([0.0])
                    cur = lines[-1]
                cur[0] += tw
    return [l[0] for l in lines]


def text_height(runs, k, width):
    lh = max(run_style(st, k)['lh'] for _t, st, _o in runs)
    para = max(run_style(st, k)['para'] for _t, st, _o in runs)
    n = len(measure_lines(runs, k, width))
    paras = sum(t.count('\n') for t, _s, _o in runs)
    return n * lh + paras * para


def cap_offset(st, k):
    """Distance from a text box top to the cap top of its first line."""
    s = run_style(st, k)
    m = METRICS[s['fam']]
    return (s['lh'] - (m['asc'] + m['desc']) * s['size']) / 2 + (m['asc'] - m['cap']) * s['size']


# ---------- element constructors (JSON-friendly dicts) ----------

def T(x, y, w, k, runs, n=None, a='L', cap_top=False):
    """Text. runs = [(text, style, opacity)]. If cap_top, y is the cap-top of line 1."""
    if cap_top:
        y = y - cap_offset(runs[0][1], k)
    e = dict(t='x', x=round(x, 1), y=round(y, 1), k=round(k, 5), r=[[t, s, o] for t, s, o in runs], a=a)
    if w:
        e['w'] = round(w, 1)
    if n:
        e['n'] = n
    return e


def R(x, y, w, h, f=None, fo=1, s=None, so=HAIR, sw=2, rd=0, d=0, n=None):
    e = dict(t='r', x=x, y=y, w=w, h=h)
    if f:
        e.update(f=f, fo=fo)
    if s:
        e.update(s=s, so=so, sw=sw)
    if rd:
        e['rd'] = rd
    if d:
        e['d'] = 1
    if n:
        e['n'] = n
    return e


def HL(x, y, w, o=0.10, n='line'):
    return R(x, y - 1, w, 2, f='#FFFFFF', fo=o, n=n)


def VL(x, y, h, o=0.10, n='line'):
    return R(x - 1, y, 2, h, f='#FFFFFF', fo=o, n=n)


def G(x, y, w, h, dir='lr', a0=1.0, a1=0.0, n='shade'):
    return dict(t='g', x=x, y=y, w=w, h=h, dir=dir, a0=a0, a1=a1, n=n)


def IMG(x, y, w, h, src, n=None, o=1, rd=0):
    e = dict(t='i', x=x, y=y, w=w, h=h, s=src, n=n or ('img/' + src))
    if o != 1:
        e['o'] = o
    if rd:
        e['rd'] = rd
    return e


def ARROW(x1, y1, x2, y2, o=0.6):
    return dict(t='a', x1=x1, y1=y1, x2=x2, y2=y2, o=o)


def PLUS(x, y, sz=27):
    return dict(t='p', x=x, y=y, sz=sz)


def LOGO(x, y, sz=120):
    return dict(t='l', x=x, y=y, sz=sz)


def PILL(x, y, text, k=K_LABEL, st='U1PP', op=0.8, h=None, padx=24, fill=None, fo=0.0, so=PILL_STROKE, n='pill'):
    """Outlined capsule with a centred label. Returns a list of elements."""
    s = run_style(st, k)
    tw = measure_lines([(text, st, op)], k, None)[0]
    h = h or round(s['lh'] + 22)
    w = round(tw + 2 * padx + 2)
    els = [R(x, y, w, h, f=fill, fo=fo, s='#FFFFFF', so=so, sw=2, rd=h / 2, n=n)]
    els.append(T(x, y + (h - s['lh']) / 2, w, k, [(text, st, op)], a='C', n=n + '-label'))
    return els, w, h


def NUMPILL(x, y, num, w=84, h=52):
    s = run_style('C1PP', K_NUM)
    return [R(x, y, w, h, s='#FFFFFF', so=PILL_STROKE, sw=2, rd=h / 2, n='num'),
            T(x, y + (h - s['lh']) / 2, w, K_NUM, [(num, 'C1PP', 1)], a='C', n='num-label')]


def chrome(num, caption, backup=False, plus=True):
    """Shared slide furniture: plus mark, footer caption and slide number."""
    els = []
    if plus:
        els.append(PLUS(1833, 72))
    if caption:
        els.append(T(M, 1000, 1560, K_CAP, [(caption, 'B2', 0.45)], n='footer-caption', cap_top=True))
    if num:
        label = ('Backup · ' if backup else '') + num
        els.append(T(1560, 1000, 300, K_LABEL, [(label, 'U1PP', 0.45)], a='R', n='slide-number', cap_top=True))
    return els


def heading(a, b, w=1760, sub=None, sub_w=1100):
    """Two-tone GRU heading (Overused white + Mondwest 60%) with optional subtitle.
    Returns (elements, bottom_y)."""
    runs = [(a, 'H2OG', 1)] + ([(b, 'H2PP', 0.6)] if b else [])
    h = T(M, 72, w, K_HEAD, runs, n='heading', cap_top=True)
    hh = text_height(runs, K_HEAD, w)
    bottom = h['y'] + hh
    els = [h]
    if sub:
        sy = bottom + 18
        els.append(T(M, sy, sub_w, K_SUB, [(sub, 'B2', 0.6)], n='subtitle'))
        bottom = sy + text_height([(sub, 'B2', 0.6)], K_SUB, sub_w)
    return els, bottom


def audit(slides, slack=0.96):
    """Report text whose widest line comes close to its box width (wrap may differ in Figma)."""
    issues = []
    for sl in slides:
        for e in sl['els']:
            if e.get('t') != 'x' or 'w' not in e:
                continue
            runs = [tuple(r) for r in e['r']]
            nowrap = measure_lines(runs, e['k'], None)
            if max(nowrap) > e['w'] * slack:
                wrapped = measure_lines(runs, e['k'], e['w'])
                issues.append((sl['id'], e.get('n'), round(max(nowrap)), e['w'], len(wrapped), ''.join(r[0] for r in runs)[:60]))
    return issues
