"""
Synthesise a seamless music loop for each playable room (no samples, no licences).

    python3 tools/make_room_music.py      # writes assets/sounds/room-*.mp3

backroom   mysterious, tense: drone, tremolo strings, pizzicato ostinato, heartbeat, clock
cafe       cozy bossa nova: nylon guitar, upright bass, shaker, rim, Rhodes, vibraphone
courtyard  as simple as possible: plucked arpeggios, bass, a plain little melody
"""

import os
import subprocess
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sounds")
os.makedirs(OUT, exist_ok=True)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def t_of(seconds):
    return np.arange(int(seconds * SR)) / SR


def env(n, a=0.005, d=0.1, s=0.6, r=0.2):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([np.linspace(0, 1, a_n, False), np.linspace(1, s, d_n, False),
                        np.full(s_n, s), np.linspace(s, 0, r_n)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def pluck(freq, dur, rng, bright=0.5, decay=0.996):
    """Karplus-Strong plucked string."""
    n = int(dur * SR)
    p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p)
    buf = lowpass(buf, 1500 + 6000 * bright)
    out = np.empty(n)
    for i in range(n):
        v = buf[i % p]
        out[i] = v
        buf[i % p] = decay * 0.5 * (v + buf[(i + 1) % p])
    return out * (1 - np.exp(-np.arange(n) / SR * 600))


def fm_bell(freq, dur, ratio=3.5, index=2.0, decay=2.5):
    t = t_of(dur)
    mod = np.sin(2 * np.pi * freq * ratio * t) * index * np.exp(-t * decay * 1.5)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * decay) * (1 - np.exp(-t * 800))


def saw(freq, t, detune=0.0):
    ph = (freq * (1 + detune) * t) % 1.0
    return 2 * ph - 1


class Loop:
    def __init__(self, bpm, bars, seed):
        self.beat = 60 / bpm
        self.length = bars * 4 * self.beat
        self.n = int((self.length + 3.0) * SR)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)
        self.rng = np.random.default_rng(seed)

    def add(self, sig, start, pan=0.0, gain=1.0):
        i = int(start * SR)
        j = min(self.n, i + len(sig))
        if j <= i:
            return
        s = sig[: j - i] * gain
        self.L[i:j] += s * np.sqrt((1 - pan) / 2)
        self.R[i:j] += s * np.sqrt((1 + pan) / 2)

    def echo(self, delay, feedback, mix):
        d = int(delay * SR)
        for ch in (self.L, self.R):
            wet = np.zeros_like(ch)
            src = ch.copy()
            g = mix
            for k in range(1, 5):
                wet[d * k:] += src[: len(src) - d * k] * g
                g *= feedback
            ch += wet

    def save(self, name, gain_db=-3.0):
        n_loop = int(self.length * SR)
        L, R = self.L.copy(), self.R.copy()
        tail = self.n - n_loop
        L[:tail] += L[n_loop:]
        R[:tail] += R[n_loop:]
        x = np.stack([L[:n_loop], R[:n_loop]], 1)
        x = np.tanh(x / np.max(np.abs(x)) * 1.25)
        x = x / np.max(np.abs(x)) * 10 ** (gain_db / 20)
        pcm = (x * 32767).astype(np.int16)
        wav = os.path.join(OUT, name + ".wav")
        with wave.open(wav, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", "3",
                        os.path.join(OUT, name + ".mp3")], check=True)
        os.remove(wav)
        print("wrote", name, f"{self.length:.1f}s")


# ---------------------------------------------------------------- Backroom
def backroom():
    m = Loop(bpm=76, bars=8, seed=11)
    B = m.beat
    chords = [  # D minor world: i - VI - iv - V(b9)
        [50, 57, 62, 64, 65], [46, 53, 58, 62, 64], [43, 50, 55, 58, 64], [45, 52, 57, 61, 70]]
    ostinato = [38, 45, 41, 40]                     # D A F E, eighths
    total = m.length + 3.0
    t = t_of(total)
    # low drone with a slow breathing filter
    drone = (np.sin(2 * np.pi * midi(26) * t) + 0.6 * np.sin(2 * np.pi * midi(33) * t) +
             0.3 * saw(midi(26), t, 0.002))
    drone = lowpass(drone, 260) * (0.7 + 0.3 * np.sin(2 * np.pi * t / (m.length / 2)))
    m.add(drone, 0, gain=0.13)
    for bar in range(8):
        bt = bar * 4 * B
        ch = chords[(bar // 2) % 4]
        # tremolo strings: detuned saws, low-passed, 12 Hz tremolo, swelling
        d = 8 * B + 0.6 if bar % 2 == 0 else 0
        if d:
            tt = t_of(d)
            pad = sum(saw(midi(n), tt, dt) for n in ch for dt in (-0.003, 0.003))
            pad = lowpass(pad, 1400) * (0.65 + 0.35 * np.sin(2 * np.pi * 12 * tt)) * env(len(tt), 1.2, 0.5, 0.8, 1.4)
            m.add(pad / len(ch), bt, pan=0.2, gain=0.38)
        # pizzicato ostinato
        for k in range(8):
            note = ostinato[k % 4] if (bar // 2) % 4 != 1 else [34, 41, 38, 41][k % 4]
            m.add(pluck(midi(note + 12), 0.35, m.rng, bright=0.2, decay=0.985), bt + k * B / 2, pan=-0.3,
                  gain=0.32 if k % 2 == 0 else 0.22)
        # heartbeat on beat 1 (lub-dub)
        for off, g in ((0, 0.55), (0.28, 0.35)):
            tt = t_of(0.4)
            kick = np.sin(2 * np.pi * np.cumsum(45 + 35 * np.exp(-tt * 25)) / SR) * np.exp(-tt * 10)
            m.add(lowpass(kick, 300), bt + off, gain=g)
        # clock tick on every beat
        for k in range(4):
            tt = t_of(0.05)
            tick = highpass(m.rng.standard_normal(len(tt)), 3500) * np.exp(-tt * 180)
            m.add(tick, bt + k * B, pan=0.5 if k % 2 else -0.5, gain=0.05)
    # sparse music-box notes, echoed
    for bar, beat, note in ((1, 2, 74), (1, 3, 77), (3, 1.5, 76), (5, 2, 74), (5, 3, 72), (7, 0.5, 73)):
        m.add(fm_bell(midi(note), 2.5, ratio=3.01, index=1.2, decay=1.6), (bar * 4 + beat) * B, pan=0.4, gain=0.26)
    # rising tension in the last bar
    tt = t_of(4 * B)
    rise = m.rng.standard_normal(len(tt))
    rise = highpass(lowpass(rise, 3000), 600) * (tt / tt[-1]) ** 2
    m.add(rise, 7 * 4 * B, gain=0.06)
    m.echo(0.45, 0.4, 0.22)
    m.save("room-backroom", -3)


# ---------------------------------------------------------------- Café
def cafe():
    m = Loop(bpm=100, bars=8, seed=21)
    B = m.beat
    chords = [  # F major warmth: Fmaj7 - Dm9 - Gm9 - C9
        ([53, 57, 60, 64], 41), ([50, 53, 57, 60, 64], 38), ([55, 58, 62, 65, 69], 43), ([48, 52, 55, 58, 62], 36)]
    guitar_hits = [0, 1.5, 2.5, 3.5]                 # bossa comping inside each bar
    for bar in range(8):
        bt = bar * 4 * B
        voicing, root = chords[(bar // 2) % 4]
        # nylon guitar: rolled chords
        for hit in guitar_hits:
            for k, n in enumerate(voicing[:4]):
                m.add(pluck(midi(n), 1.2, m.rng, bright=0.35, decay=0.995), bt + hit * B + k * 0.012,
                      pan=-0.25, gain=0.16)
        # bass: root on 1, fifth on 3 (anticipated)
        for pos, iv in ((0, 0), (1.5, 7), (2, 7), (3.5, 0)):
            m.add(pluck(midi(root + iv), 0.7, m.rng, bright=0.05, decay=0.992), bt + pos * B, gain=0.62)
        # shaker 16ths and rim clicks
        for k in range(16):
            tt = t_of(0.08)
            sh = highpass(m.rng.standard_normal(len(tt)), 5000) * np.exp(-tt * 60)
            m.add(sh, bt + k * B / 4, pan=0.35, gain=0.035 if k % 2 else 0.05)
        for pos in (0, 0.75, 1.5, 2.5, 3.25):
            tt = t_of(0.06)
            rim = np.sin(2 * np.pi * 1700 * tt) * np.exp(-tt * 90) + highpass(m.rng.standard_normal(len(tt)), 2500) * np.exp(-tt * 200) * 0.5
            m.add(rim, bt + pos * B, pan=-0.1, gain=0.06)
        # warm Rhodes pad
        tt = t_of(4 * B)
        rh = sum(np.sin(2 * np.pi * midi(n + 12) * tt) for n in voicing) * env(len(tt), 0.3, 0.6, 0.6, 0.6)
        m.add(lowpass(rh / len(voicing), 2200), bt, pan=0.2, gain=0.09)
    # vibraphone melody
    mel = [(0, 72, 1), (1, 74, 0.5), (1.5, 76, 1.5), (4, 77, 1), (5, 76, 0.5), (5.5, 74, 2),
           (8, 74, 1), (9, 72, 0.5), (9.5, 70, 1.5), (12, 72, 3)]
    for half in (0, 16):
        for beat, note, length in mel:
            v = fm_bell(midi(note), length * B + 0.8, ratio=4.0, index=0.6, decay=1.8)
            v *= 1 + 0.25 * np.sin(2 * np.pi * 5 * np.arange(len(v)) / SR)
            m.add(v, (half + beat) * B, pan=0.3, gain=0.13)
    m.echo(0.3, 0.3, 0.12)
    m.save("room-cafe", -3)


# ---------------------------------------------------------------- Courtyard
def courtyard():
    m = Loop(bpm=104, bars=8, seed=31)
    B = m.beat
    prog = [([60, 64, 67], 48), ([55, 59, 62], 43), ([57, 60, 64], 45), ([53, 57, 60], 41)]  # C G Am F
    for bar in range(8):
        bt = bar * 4 * B
        triad, root = prog[bar % 4]
        # simple arpeggio in eighths
        pattern = [triad[0], triad[1], triad[2], triad[1]] * 2
        for k, n in enumerate(pattern):
            m.add(pluck(midi(n), 0.9, m.rng, bright=0.45, decay=0.994), bt + k * B / 2, pan=-0.2, gain=0.2)
        m.add(pluck(midi(root), 1.4, m.rng, bright=0.1, decay=0.993), bt, gain=0.65)
        m.add(pluck(midi(root + 7), 1.0, m.rng, bright=0.1, decay=0.993), bt + 2 * B, gain=0.5)
    # a plain whistled tune
    tune = [(0, 76, 1), (1, 74, 1), (2, 72, 2), (4, 74, 1), (5, 76, 1), (6, 76, 2),
            (8, 77, 1), (9, 76, 1), (10, 74, 2), (12, 72, 3)]
    for half in (0, 16):
        for beat, note, length in tune:
            tt = t_of(length * B)
            vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * tt) * np.clip(tt * 4, 0, 1)
            w = np.sin(2 * np.pi * np.cumsum(midi(note) * vib) / SR) * env(len(tt), 0.04, 0.1, 0.8, 0.1)
            m.add(w, (half + beat) * B, pan=0.15, gain=0.12)
    m.save("room-courtyard", -3)


backroom()
cafe()
courtyard()
