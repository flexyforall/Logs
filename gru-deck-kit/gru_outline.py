"""Lay out spec text with HarfBuzz and the real brand fonts, and export glyph outlines.

The Figma cloud runtime cannot load Overused Grotesk / PP Mondwest, so text drawn there
falls back to Inter. This module produces, for every text element, glyph placements
(font, glyph id, x, baseline) plus a glyph table of outlines in font units. The Figma
build turns them into vector layers that look exactly like the brand fonts everywhere.
"""
import os

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

from gru_kit import FONT_DIR, FONT_FILES, METRICS, STYLES

FONTS = [('Overused Grotesk', 400), ('Overused Grotesk', 500), ('PP Mondwest', 400)]
_hb, _tt = {}, {}


def _load(fi):
    if fi not in _hb:
        path = os.path.join(FONT_DIR, FONT_FILES[FONTS[fi]])
        blob = hb.Blob.from_file_path(path)
        face = hb.Face(blob)
        font = hb.Font(face)
        _hb[fi] = (font, face.upem)
        _tt[fi] = TTFont(path)
    return _hb[fi]


def font_index(fam, wt):
    return FONTS.index((fam, wt))


def shape(fi, text, size, ls):
    """Return [(gid, advance_px)] for text at size px with letter spacing ls (em fraction)."""
    font, upem = _load(fi)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True, 'liga': True})
    k = size / upem
    return [(info.codepoint, pos.x_advance * k + ls * size) for info, pos in zip(buf.glyph_infos, buf.glyph_positions)]


def layout(e):
    """Glyph placements for a text element: list of (fi, gid, x, baseline, size, opacity)."""
    k = e['k']
    first = STYLES[e['r'][0][1]]
    s0 = first['size'] * k
    m0 = METRICS[first['fam']]
    lh = max(STYLES[st]['lh'] * k for _t, st, _o in e['r'])
    para = max(STYLES[st]['para'] * k for _t, st, _o in e['r'])
    width = e.get('w')

    # tokens: (text, fi, size, ls, op, kind) kind in {'word','space','br','para'}
    tokens = []
    for text, st, op in e['r']:
        s = STYLES[st]
        fi = font_index(s['fam'], s['wt'])
        size = s['size'] * k
        t = text.upper() if s['case'] == 'upper' else text
        buf = ''
        for ch in t:
            if ch in ('\n', ' ', ' '):
                if buf:
                    tokens.append((buf, fi, size, s['ls'], op, 'word'))
                    buf = ''
                tokens.append((ch, fi, size, s['ls'], op, {'\n': 'para', ' ': 'br', ' ': 'space'}[ch]))
            else:
                buf += ch
        if buf:
            tokens.append((buf, fi, size, s['ls'], op, 'word'))

    # greedy wrap
    lines = [dict(items=[], w=0.0, para_before=0)]
    pending_space = []
    for text, fi, size, ls, op, kind in tokens:
        if kind in ('para', 'br'):
            lines.append(dict(items=[], w=0.0, para_before=1 if kind == 'para' else 0))
            pending_space = []
            continue
        glyphs = shape(fi, text, size, ls)
        adv = sum(a for _g, a in glyphs)
        if kind == 'space':
            pending_space.append((glyphs, fi, size, op))
            continue
        line = lines[-1]
        space_w = sum(sum(a for _g, a in g) for g, *_ in pending_space)
        if width and line['items'] and line['w'] + space_w + adv > width + 0.5:
            lines.append(dict(items=[], w=0.0, para_before=0))
            line = lines[-1]
            pending_space = []
        if line['items']:
            for g, sfi, ssize, sop in pending_space:
                line['items'].append((g, sfi, ssize, sop))
                line['w'] += sum(a for _g, a in g)
        pending_space = []
        line['items'].append((glyphs, fi, size, op))
        line['w'] += adv

    out = []
    y = e['y']
    align = e.get('a', 'L')
    box_w = width or max(l['w'] for l in lines)
    for i, line in enumerate(lines):
        if i:
            y += lh + (para if line['para_before'] else 0)
        baseline = y + (lh - (m0['asc'] + m0['desc']) * s0) / 2 + m0['asc'] * s0
        x = e['x'] + {'L': 0, 'C': (box_w - line['w']) / 2, 'R': box_w - line['w']}[align]
        for glyphs, fi, size, op in line['items']:
            for gid, adv in glyphs:
                out.append((fi, gid, x, baseline, size, op))
                x += adv
    return out


def glyph_path(fi, gid):
    _load(fi)
    tt = _tt[fi]
    gs = tt.getGlyphSet()
    name = tt.getGlyphName(gid)
    pen = SVGPathPen(gs)
    gs[name].draw(pen)
    return pen.getCommands()


def upem(fi):
    return _load(fi)[1]
