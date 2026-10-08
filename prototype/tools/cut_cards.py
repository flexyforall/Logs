"""Cut the playing cards out of their background.

    python3 tools/cut_cards.py

The uploaded cards in assets/table/cards/ (1060x1484, RGB) share one template: a rounded
card with a thin grey outline on a light background of almost the same colour as the card,
so the background cannot be keyed out by colour. Instead the alpha is the exact card shape:
a rounded rectangle along the outer edge of the outline (measured: outline centred on
x 3.00..1055.84, y 1.93..1481.06, corner radius 40.25), anti-aliased by signed distance.
The colour pixels are left untouched and the result is written as lossless PNG over the
originals. A 300x420 PNG of each Blot card (7..A) goes to assets/table/cards/play/ for the
game. Running it again on already cut cards gives the same result.
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, '..', 'assets', 'table', 'cards')
OUT = os.path.join(DIR, 'play')
L, R, T, B, RADIUS = 3.00, 1055.84, 1.93, 1481.06, 40.25   # outline centre, in pixel indices
GROW = .6                      # cut just outside the middle of the outline: its outer anti-aliased
                               # pixel was blended with the light background and shows as a pale rim
PLAY_SIZE = (300, 420)
RANKS = {'A': 'A', '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'J', 'Q': 'Q', 'K': 'K'}
SUITS = {'Clubs': 'C', 'Diamonds': 'D', 'Hearts': 'H', 'Spades': 'S'}


def card_alpha(w, h):
    # pixel index i covers [i, i + 1), so its centre is i + .5
    x0, x1, y0, y1, r = L + .5 - GROW, R + .5 + GROW, T + .5 - GROW, B + .5 + GROW, RADIUS + GROW
    cx, cy, hx, hy = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64) + .5
    qx = np.abs(xx - cx) - (hx - r)
    qy = np.abs(yy - cy) - (hy - r)
    sd = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    return np.clip(.5 - sd, 0, 1)


def main():
    os.makedirs(OUT, exist_ok=True)
    alpha = None
    for name in sorted(os.listdir(DIR)):
        if not name.endswith('.png'):
            continue
        path = os.path.join(DIR, name)
        im = Image.open(path)
        rgb = np.array(im.convert('RGB'))
        h, w = rgb.shape[:2]
        if alpha is None or alpha.shape != (h, w):
            alpha = card_alpha(w, h)
        a8 = np.round(alpha * 255).astype(np.uint8)
        cut = Image.fromarray(np.dstack([rgb, a8]), 'RGBA')
        cut.save(path, optimize=True)
        # 01_A_of_Spades.png -> AS
        rank, suit = name[:-4].split('_', 1)[1].split('_of_')
        if rank in RANKS:
            small = cut.convert('RGBa').resize(PLAY_SIZE, Image.LANCZOS).convert('RGBA')
            small.save(os.path.join(OUT, RANKS[rank] + SUITS[suit] + '.png'), optimize=True)
        print(name)


if __name__ == '__main__':
    main()
