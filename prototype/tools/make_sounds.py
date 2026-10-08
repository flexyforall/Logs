"""
Synthesise the prototype's lobby music and UI sounds (no samples, no licences).

    python3 tools/make_sounds.py        # writes assets/sounds/*.mp3

Music: a seamless 8-bar noir lounge loop (upright bass, electric piano, brushes,
vinyl crackle) at 96 BPM. UI: whoosh, pop, coin, riser, click, card slap, chime.
"""

import os
import subprocess
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sounds")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(5)


def t_of(seconds):
    return np.arange(int(seconds * SR)) / SR


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.2):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([np.linspace(0, 1, a_n, False), np.linspace(1, s, d_n, False),
                        np.full(s_n, s), np.linspace(s, 0, r_n)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def lowpass(x, cutoff):
    """One-pole low-pass (cheap, smooth)."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def save(name, x, gain_db=-1.0):
    x = np.asarray(x, np.float64)
    peak = np.max(np.abs(x)) or 1.0
    x = x / peak * 10 ** (gain_db / 20)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    wav = os.path.join(OUT, name + ".wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    mp3 = os.path.join(OUT, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", "3", mp3],
                   check=True)
    os.remove(wav)
    print("wrote", mp3, f"{len(pcm) / SR:.2f}s")


# ---------------------------------------------------------------- music
BPM = 96
BEAT = 60 / BPM
BARS = 8
LEN = BARS * 4 * BEAT                      # 20 s
TAIL = 2.0
n_total = int((LEN + TAIL) * SR)
L = np.zeros(n_total)
R = np.zeros(n_total)


def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    j = min(n_total, i + len(sig))
    if j <= i:
        return
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt((1 - pan) / 2)
    R[i:j] += s * np.sqrt((1 + pan) / 2)


def swing(beat_pos):
    """Swing the off-beat eighths."""
    whole, frac = divmod(beat_pos, 1.0)
    return (whole + (0.66 if abs(frac - 0.5) < 1e-6 else frac)) * BEAT


# ii-V-I-VI in C minor-ish colours, 2 bars each
CHORDS = [
    ("Dm9", [50, 53, 57, 60, 64], [38, 41, 45, 48]),
    ("G13", [43, 53, 59, 64, 69], [31, 35, 38, 41]),
    ("Cmaj9", [48, 52, 55, 59, 62], [36, 40, 43, 47]),
    ("A7b9", [45, 55, 61, 64, 70], [33, 37, 40, 43]),
]


def upright(freq, dur):
    t = t_of(dur)
    x = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) +
         0.12 * np.sin(6 * np.pi * freq * t))
    pluck = np.exp(-t * 5.5) * (1 - np.exp(-t * 400))
    thump = np.sin(2 * np.pi * freq * 0.5 * t) * np.exp(-t * 30) * 0.4
    return (x * pluck + thump) * 0.9


def rhodes(freqs, dur):
    t = t_of(dur)
    out = np.zeros_like(t)
    for f in freqs:
        mod = np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 9) * 1.4      # bell-ish tine attack
        out += np.sin(2 * np.pi * f * t + mod) * (0.6 + 0.4 * np.exp(-t * 2))
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)
    return out * env_adsr(len(t), 0.004, 0.4, 0.35, 0.35) * trem / len(freqs)


def brush_swish(dur):
    n = rng.standard_normal(int(dur * SR))
    n = highpass(lowpass(n, 6000), 1800)
    t = t_of(dur)
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return n * shape


def ride_tick(dur=0.18):
    n = highpass(rng.standard_normal(int(dur * SR)), 6500)
    t = t_of(dur)
    return n * np.exp(-t * 28)


def kick(dur=0.35):
    t = t_of(dur)
    f = 55 + 40 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


for bar in range(BARS):
    name, voicing, walk = CHORDS[(bar // 2) % 4]
    bar_t = bar * 4 * BEAT
    # walking bass: chord tones, last beat of the second bar leads to the next root
    for b in range(4):
        note = walk[b] if bar % 2 == 0 else walk[[0, 2, 1, 3][b]] + (1 if b == 3 else 0)
        add(upright(midi(note), BEAT * 0.95), bar_t + b * BEAT, pan=-0.1, gain=0.32)
    # piano comping: Charleston-ish hits on 1 and the "and" of 2
    for pos, length in ((0.0, 1.2), (1.5, 1.6)):
        add(rhodes([midi(n) for n in voicing], length * BEAT + 0.4), bar_t + swing(pos), pan=0.25, gain=0.62)
    # brushes: swish across each beat pair, ride pattern, feathered kick
    add(brush_swish(2 * BEAT), bar_t, pan=-0.3, gain=0.09)
    add(brush_swish(2 * BEAT), bar_t + 2 * BEAT, pan=0.3, gain=0.09)
    for pos in (0, 1, 1.5, 2, 3, 3.5):
        add(ride_tick(), bar_t + swing(pos), pan=0.4, gain=0.09 if pos % 1 else 0.13)
    for pos in (0, 2):
        add(kick(), bar_t + pos * BEAT, gain=0.08)

# a little melody fragment in bars 3-4 and 7-8 (muted-trumpet-ish soft square)
def lead(freq, dur):
    t = t_of(dur)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t * 3, 0, 1)
    ph = 2 * np.pi * np.cumsum(freq * vib) / SR
    x = np.sign(np.sin(ph)) * 0.3 + np.sin(ph)
    return lowpass(x, 1800) * env_adsr(len(t), 0.03, 0.1, 0.8, 0.12)


PHRASE = [(0, 74, 1.0), (1.5, 72, 0.5), (2, 69, 1.0), (3, 67, 0.75), (4, 69, 2.5)]
for start_bar in (2, 6):
    for pos, note, length in PHRASE:
        add(lead(midi(note), length * BEAT), start_bar * 4 * BEAT + swing(pos), pan=0.1, gain=0.2)

# vinyl crackle
crack = np.zeros(n_total)
idx = rng.integers(0, n_total, 900)
crack[idx] = rng.uniform(-1, 1, len(idx))
crack = highpass(crack, 2500) * 0.25 + highpass(rng.standard_normal(n_total), 4000) * 0.004
L += crack
R += crack

# fold the tail back onto the start for a seamless loop
n_loop = int(LEN * SR)
tail = n_total - n_loop
L[:tail] += L[n_loop:]
R[:tail] += R[n_loop:]
music = np.stack([L[:n_loop], R[:n_loop]], 1)
music = np.tanh(music / np.max(np.abs(music)) * 1.3)      # gentle glue
save("lobby-music", music, gain_db=-3)

# ---------------------------------------------------------------- UI sounds
def whoosh(dur=0.55):
    t = t_of(dur)
    n = rng.standard_normal(len(t))
    sweep = np.zeros_like(n)
    acc, a_prev = 0.0, 0.0
    cut = 300 + 3500 * np.sin(np.pi * t / dur) ** 2
    for i, v in enumerate(n):
        a = np.exp(-2 * np.pi * cut[i] / SR)
        acc = (1 - a) * v + a * acc
        sweep[i] = acc
    return sweep * np.sin(np.pi * t / dur) ** 1.5


def pop(dur=0.12, f0=900, f1=260):
    t = t_of(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 45)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * (1 - np.exp(-t * 2000))


def coin(dur=0.5):
    t = t_of(dur)
    x = np.zeros_like(t)
    for f, d, g in ((2093, 7, 1.0), (2637, 9, 0.7), (4186, 14, 0.35), (5274, 18, 0.2)):
        x += np.sin(2 * np.pi * f * t) * np.exp(-t * d) * g
    second = np.zeros_like(x)
    k = int(0.07 * SR)
    second[k:] = x[:-k] * 0.8
    return x + second


def riser(dur=1.3):
    t = t_of(dur)
    f = 300 * (2 ** (t / dur * 2))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.12
    air = highpass(rng.standard_normal(len(t)), 3000) * 0.15
    shape = (t / dur) ** 1.5 * np.clip((dur - t) * 25, 0, 1)
    sparkle = coin(0.6)
    out = (tone + air) * shape
    out = np.concatenate([out, np.zeros(len(sparkle))])
    out[int(dur * SR) - 200:int(dur * SR) - 200 + len(sparkle)] += sparkle * 0.5
    return out


def click(dur=0.06):
    t = t_of(dur)
    body = np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 120)
    tick = highpass(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * 0.6
    return body + tick


def card_slap(dur=0.4):
    t = t_of(dur)
    snap = lowpass(rng.standard_normal(len(t)), 3500) * np.exp(-t * 45)
    thump = np.sin(2 * np.pi * (90 + 120 * np.exp(-t * 40)) * t) * np.exp(-t * 14) * 0.9
    flick = highpass(rng.standard_normal(len(t)), 5000) * np.exp(-t * 90) * 0.4
    return snap + thump + flick


def chime(dur=1.4):
    t = t_of(dur)
    x = np.zeros_like(t)
    for k, (f, d) in enumerate(((1568, 3.5), (2349, 4.5), (3136, 6), (4699, 8))):
        start = int(k * 0.06 * SR)
        seg = np.sin(2 * np.pi * f * t[: len(t) - start]) * np.exp(-t[: len(t) - start] * d)
        x[start:] += seg * (0.9 ** k)
    return x * (1 - np.exp(-t * 300))


def play_now(dur=0.9):
    slap = card_slap()
    sh = chime(0.9) * 0.35
    out = np.zeros(int(dur * SR))
    out[: len(slap)] += slap
    k = int(0.05 * SR)
    out[k:k + len(sh)] += sh[: len(out) - k]
    return out


save("whoosh", whoosh(), -4)
save("pop", pop(), -6)
save("coin", coin(), -8)
save("riser", riser(), -8)
save("click", click(), -8)
save("play", play_now(), -2)
save("shimmer", chime(), -14)


# ---------------------------------------------------------------- "into battle" (stage Play button)
def reverb(x, seconds=2.2, mix=0.35):
    """Convolution with decaying noise: a big hall."""
    n_ir = int(seconds * SR)
    t = np.arange(n_ir) / SR
    ir = rng.standard_normal(n_ir) * np.exp(-t * 6.9 / seconds)
    ir = lowpass(ir, 5000)
    ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n_ir)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x) + n_ir]
    dry = np.pad(x, (0, n_ir))
    return dry * (1 - mix) + wet * mix * 3.0


def battle(dur=3.6):
    n = int(dur * SR)
    out = np.zeros(n)
    HIT = 1.55                                  # the big impact

    def put(sig, at, g=1.0):
        i = int(at * SR)
        j = min(n, i + len(sig))
        out[i:j] += sig[: j - i] * g

    # sword drawn: bright metallic partials sliding up, with a scrape
    t = t_of(1.1)
    shing = np.zeros_like(t)
    for f, d in ((2900, 2.4), (4100, 3.0), (5600, 3.8), (7300, 5.0)):
        shing += np.sin(2 * np.pi * np.cumsum(f * (1 + 0.05 * np.clip(t * 5, 0, 1))) / SR) * np.exp(-t * d)
    scrape = highpass(rng.standard_normal(len(t)), 4000) * np.exp(-((t - 0.09) / 0.08) ** 2)
    put((shing * 0.35 + scrape) * (1 - np.exp(-t * 300)), 0.0, 0.6)

    # taiko ensemble: several detuned drums per hit, accelerating into the impact
    def taiko(g, pitch=1.0):
        tt = t_of(1.2)
        x = np.zeros_like(tt)
        for k in range(3):
            f0 = (42 + 6 * k) * pitch
            x += np.sin(2 * np.pi * np.cumsum(f0 + 90 * np.exp(-tt * 16)) / SR) * np.exp(-tt * (3.2 + k))
        skin = lowpass(rng.standard_normal(len(tt)), 1100) * np.exp(-tt * 26) * 0.9
        return (x / 3 + skin) * g
    for at, g, p in ((0.32, 0.55, 1.0), (0.70, 0.6, 1.05), (0.98, 0.65, 1.0), (1.17, 0.7, 1.1),
                     (1.31, 0.75, 1.05), (1.41, 0.8, 1.15), (1.49, 0.85, 1.2)):
        put(taiko(g, p), at)
    put(taiko(1.3, 0.85), HIT)

    # sub boom on the impact
    tt = t_of(2.0)
    sub = np.sin(2 * np.pi * np.cumsum(30 + 40 * np.exp(-tt * 6)) / SR) * np.exp(-tt * 1.6) * (1 - np.exp(-tt * 200))
    put(sub, HIT, 0.9)

    # choir "aah": detuned saws through vowel formants, swelling into the hit and holding
    tt = t_of(2.4)
    notes = [midi(50), midi(57), midi(62), midi(65), midi(69)]   # D minor, wide
    voices = np.zeros_like(tt)
    for f in notes:
        for dt in (-0.006, 0.0, 0.006):
            vib = 1 + 0.004 * np.sin(2 * np.pi * (5 + 3 * dt * 100) * tt)
            ph = np.cumsum(f * (1 + dt) * vib) / SR
            voices += 2 * (ph % 1.0) - 1
    def band(x, lo, hi):
        return lowpass(highpass(x, lo), hi)
    aah = band(voices, 600, 1000) * 1.0 + band(voices, 1000, 1500) * 0.6 + band(voices, 2400, 3000) * 0.25
    swell = np.clip(tt / 1.2, 0, 1) ** 2 * np.exp(-np.clip(tt - 1.6, 0, None) * 1.4)
    put(aah * swell / (len(notes) * 3), HIT - 1.2, 1.6)

    # brass fanfare: D - A - D' rising, the last note landing on the impact
    def brass(freq, d, g):
        tt = t_of(d)
        x = sum(np.sign(np.sin(2 * np.pi * freq * m_ * (1 + dt) * tt)) * 0.45 + np.sin(2 * np.pi * freq * m_ * (1 + dt) * tt)
                for m_ in (1, 2) for dt in (-0.003, 0.003))
        x = lowpass(x, 3200)
        return x * np.clip(tt / 0.04, 0, 1) * np.exp(-np.clip(tt - d * 0.6, 0, None) * 4) * g
    put(brass(midi(50), 0.22, 0.18), HIT - 0.42)
    put(brass(midi(57), 0.22, 0.2), HIT - 0.21)
    put(brass(midi(62), 1.4, 0.3), HIT)
    put(brass(midi(57), 1.4, 0.18), HIT)

    # cymbal crash + rising whoosh into the impact
    tt = t_of(2.0)
    crash = highpass(rng.standard_normal(len(tt)), 5000) * np.exp(-tt * 1.8) * (1 - np.exp(-tt * 400))
    put(crash, HIT, 0.35)
    tt = t_of(1.25)
    rise = highpass(lowpass(rng.standard_normal(len(tt)), 3000), 300) * (tt / tt[-1]) ** 2.5
    put(rise, HIT - 1.25, 0.4)

    wet = reverb(out, 2.4, 0.38)
    fade = np.ones(len(wet))
    fade[-int(0.4 * SR):] = np.linspace(1, 0, int(0.4 * SR))
    return np.tanh(wet / np.max(np.abs(wet)) * 1.6) * fade


save("battle", battle(), -0.5)
