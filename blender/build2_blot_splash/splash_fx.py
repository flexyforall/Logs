"""
Blot Bazar splash: whirlpool-dissolve of the video into black + animated logo
with a light sweep, colour shimmer and sparkles.

    python3 splash_fx.py <video.mp4> <logo.png> <out.mp4> [WIDTHxHEIGHT]

Default size is 1920x1080. Other sizes (e.g. 2556x1180 for iPhone landscape)
fill the frame: the video is scaled to cover and cropped at the centre, and
the logo is centred on its letters. Width and height must be even.

The logo is expected on a black background (black becomes transparent).
Audio is copied from the input video and faded out at the end.
"""

import math
import subprocess
import sys

import cv2
import numpy as np

SRC, LOGO, OUT = sys.argv[1:4]
W, H = map(int, sys.argv[4].lower().split("x")) if len(sys.argv) > 4 else (1920, 1080)
FPS = 24
assert W % 2 == 0 and H % 2 == 0, "H.264 4:2:0 needs even width and height"

# Timeline (seconds)
SWIRL_START = 3.7     # video starts twisting as the card comes down
FADE_START = 3.85     # video starts going dark
FREEZE_AT = 3.9       # hold this frame (the source cuts to Medusa at 3.95)
VIDEO_END = 4.35      # video fully gone
LOGO_START = 4.0      # logo appears out of the whirlpool
START_SCALE = 1.15    # logo appears 15% bigger and shrinks to 1.0 exactly as the swirl closes
LOGO_FADE = 0.12      # logo fade-in, short so the shrink is visible
SHRINK = 0.04         # then drifts down another 4% towards the end
LOGO_H = int(0.62 * H)  # height of the letters at scale 1.0
SWEEPS = (0.7, 1.9, 3.0)   # light sweeps, seconds after LOGO_START
SWEEP_LEN = 0.55

rng = np.random.default_rng(3)


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- input video
probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", SRC], capture_output=True, text=True)
DURATION = float(probe.stdout.strip())
N = int(round(DURATION * FPS))
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE,
                       stderr=subprocess.DEVNULL)

# ---------------------------------------------------------------- logo prep
logo = cv2.imread(LOGO, cv2.IMREAD_COLOR).astype(np.float32) / 255.0
lum = logo.max(axis=2)
alpha = np.clip((lum - 0.04) / 0.12, 0, 1)
# crop to the letters so the logo centres on them, not on the image's empty margins
ys, xs = np.nonzero(alpha > 0.02)
logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
alpha = alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
PAD = 140
logo = cv2.copyMakeBorder(logo, PAD, PAD, PAD, PAD, cv2.BORDER_CONSTANT, value=0)
alpha = cv2.copyMakeBorder(alpha, PAD, PAD, PAD, PAD, cv2.BORDER_CONSTANT, value=0)
lh, lw = alpha.shape
# soft inner light only: blurred colour, masked back to the letters (no halo outside)
inner = cv2.GaussianBlur(logo * alpha[..., None], (0, 0), 14) * alpha[..., None]
yy, xx = np.mgrid[0:lh, 0:lw].astype(np.float32)
diag = (xx * 0.8 + yy * 0.6)                       # coordinate along the sweep direction
inside = np.argwhere(alpha > 0.95)
sparkles = [(inside[i][1], inside[i][0], rng.uniform(0.5, 3.5), rng.uniform(14, 26))
            for i in rng.choice(len(inside), 14, replace=False)]


def logo_frame(T):
    """Return (rgb, alpha) of the styled logo at time T after LOGO_START."""
    rgb = logo.copy()
    # colour shimmer: slow travelling warm/bright wave across the letters
    wave = 0.5 + 0.5 * np.sin(diag / 90.0 - T * 3.2)
    rgb = rgb * (0.92 + 0.16 * wave[..., None])
    rgb[..., 2] += 0.05 * wave            # a touch more red/orange in the wave (BGR)
    # light sweep
    for s in SWEEPS:
        p = (T - s) / SWEEP_LEN
        if 0 <= p <= 1:
            pos = -200 + p * (lw * 0.8 + lh * 0.6 + 400)
            band = np.exp(-((diag - pos) / 55.0) ** 2) * math.sin(math.pi * p)
            rgb += band[..., None] * np.array([0.55, 0.85, 1.0], np.float32) * 0.9
    # sparkles: little four-point stars twinkling on the letters
    for (sx, sy, t0, size) in sparkles:
        ph = ((T - t0) % 1.6) / 0.35
        if 0 <= ph <= 1 and T > t0:
            k = math.sin(math.pi * ph)
            dx, dy = np.abs(xx - sx), np.abs(yy - sy)
            star = (np.exp(-(dx / size) ** 2 - (dy / 2.2) ** 2) +
                    np.exp(-(dy / size) ** 2 - (dx / 2.2) ** 2) +
                    np.exp(-((dx ** 2 + dy ** 2) / 30.0)))
            rgb += (star * k)[..., None] * np.array([0.8, 0.95, 1.0], np.float32)
    rgb = np.clip(rgb + inner * 0.22, 0, 1.6)
    return rgb, alpha


def swirl_k(t):
    return smoothstep(SWIRL_START, VIDEO_END, t) ** 1.6


def logo_scale(T):
    """A little big when it appears, shrinking fast in step with the swirl; 1.0 as the swirl closes."""
    k0 = swirl_k(LOGO_START)
    close = VIDEO_END - LOGO_START
    if T < close:
        p = (swirl_k(LOGO_START + T) - k0) / (1 - k0)
        return START_SCALE - (START_SCALE - 1) * p
    rest = DURATION - VIDEO_END
    d = T - close
    return (1 - SHRINK * d / rest) * (1 + 0.012 * math.sin(2 * math.pi * 0.7 * d))


# ---------------------------------------------------------------- swirl
cy, cx = H / 2, W / 2
gy, gx = np.mgrid[0:H, 0:W].astype(np.float32)
dx0, dy0 = gx - cx, gy - cy
r0 = np.sqrt(dx0 ** 2 + dy0 ** 2)
th0 = np.arctan2(dy0, dx0)
R = 0.55 * math.hypot(cx, cy)


def swirl(img, k):
    """Twist the image around the centre; k = 0..1. Stronger in the middle."""
    falloff = np.exp(-(r0 / R) ** 2)
    ang = th0 + k * 7.0 * falloff                    # up to ~7 rad twist at the centre
    rr = r0 * (1 + 0.6 * k * falloff)                # pull the texture inwards
    mx = (cx + rr * np.cos(ang)).astype(np.float32)
    my = (cy + rr * np.sin(ang)).astype(np.float32)
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# ---------------------------------------------------------------- render
enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-i", SRC, "-map", "0:v", "-map", "1:a?",
                        "-af", f"afade=t=out:st={DURATION - 0.45:.2f}:d=0.45",
                        "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "192k", "-shortest", OUT], stdin=subprocess.PIPE)

frame_bytes = W * H * 3
held = None
for i in range(N):
    t = i / FPS
    if t < FREEZE_AT or held is None:
        raw = dec.stdout.read(frame_bytes)
        if len(raw) < frame_bytes:
            break
        if t < FREEZE_AT:
            held = raw
    raw = held if t >= FREEZE_AT else raw
    if t >= VIDEO_END:
        base = np.zeros((H, W, 3), np.float32)
    else:
        img = np.frombuffer(raw, np.uint8).reshape(H, W, 3)
        k = swirl_k(t)
        if k > 0:
            img = swirl(img, k)
        base = img.astype(np.float32) / 255.0
        base *= 1 - smoothstep(FADE_START, VIDEO_END, t)
    if t >= LOGO_START:
        T = t - LOGO_START
        rgb, a = logo_frame(T)
        a = a * smoothstep(0, LOGO_FADE, T)
        s = logo_scale(T)
        th = max(2, int(LOGO_H * s * lh / (lh - 2 * PAD)))
        tw = max(2, int(th * lw / lh))
        rgb = cv2.resize(rgb, (tw, th), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
        a = cv2.resize(a, (tw, th), interpolation=cv2.INTER_LINEAR)
        x0, y0 = (W - tw) // 2, (H - th) // 2
        # clip to frame
        sx0, sy0 = max(0, -x0), max(0, -y0)
        dx1, dy1 = min(W, x0 + tw), min(H, y0 + th)
        region = base[max(0, y0):dy1, max(0, x0):dx1]
        la = a[sy0:sy0 + region.shape[0], sx0:sx0 + region.shape[1], None]
        lr = rgb[sy0:sy0 + region.shape[0], sx0:sx0 + region.shape[1]]
        region[:] = region * (1 - la) + lr * la
    enc.stdin.write((np.clip(base, 0, 1) * 255).astype(np.uint8).tobytes())

enc.stdin.close()
enc.wait()
dec.kill()          # stop decoding; frames after FREEZE_AT are not needed
dec.wait()
print("done:", OUT)
