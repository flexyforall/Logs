// Footer dot field, after Fourmula (fourmula.ai, read from its source):
// round dots across the full width of the card, 14 rows. Figures alternate
// with a "cloud" that's dense in the middle and ragged at the edge; every
// dot flips in two hard steps (steps(2)), in 20 shuffled groups, so the
// field crackles rather than fades. Near the cursor the dots shrink, down
// to a quarter at its centre, 200px out. Ours draws its figures — the
// logo's rays, a clock, a snowflake, a diamond — and draws itself in, the
// first time it's seen, clockwise from twelve like the dial's hand.
document.addEventListener("DOMContentLoaded", () => {
  const field = document.getElementById("dotsField");
  if (!field) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ROWS = 14;
  const DIM = 0.15;          // resting dot (Fourmula's)
  const FLIP = 1;            // one pass over the field (s)
  const GROUPS = 20;
  const HOLD = 1;            // a figure stays after its pass (s)
  const REACH = 200;         // cursor reach (px)
  const MIN_SCALE = 0.25;

  let cols, cx, cy, dots = [], figures = [];

  // Fourmula: 52 columns on desktop, 24 on tablet, 22 on a phone
  const pickCols = () => (innerWidth >= 992 ? 51 : innerWidth >= 768 ? 25 : 21);

  const makeFigures = () => {
    const shape = (fn) => {
      const s = new Set();
      fn((dx, dy) => s.add(`${Math.round(cx + dx)},${Math.round(cy + dy)}`));
      return s;
    };
    const rays = shape((p) => {
      for (let k = 0; k < 12; k++) {
        const t = (k / 12) * Math.PI * 2;
        for (let r = 3; r <= 6; r += 0.5) p(r * Math.sin(t), -r * Math.cos(t));
      }
    });
    const clock = shape((p) => {
      for (let a = 0; a < 360; a += 7) { const t = a * Math.PI / 180; p(6 * Math.sin(t), -6 * Math.cos(t)); }
      for (let r = 0; r <= 4; r++) p(0, -r);
      for (let r = 1; r <= 3; r++) p(r * 0.85, r * 0.55);
    });
    const snowflake = shape((p) => {
      for (let i = 2; i <= 6; i++) { p(0, -i); p(0, i); p(-i, 0); p(i, 0); }
      for (let j = 2; j <= 4; j++) { p(-j, -j); p(j, -j); p(-j, j); p(j, j); }
    });
    const diamond = shape((p) => {
      for (let dx = -6; dx <= 6; dx++) { const dy = 6 - Math.abs(dx); p(dx, dy); p(dx, -dy); }
    });
    return [rays, clock, snowflake, diamond];
  };

  const build = () => {
    cols = pickCols();
    cx = Math.floor(cols / 2); cy = Math.floor(ROWS / 2) - 0.5;
    field.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    field.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
    field.style.aspectRatio = `${cols} / ${ROWS}`;
    field.innerHTML = "";
    dots = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < cols; c++) {
        const el = document.createElement("div");
        el.className = "dot";
        field.appendChild(el);
        const dx = c - cx, dy = r - cy;
        dots.push({
          el, c, r, key: `${c},${r}`,
          turn: ((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360) / 360,
          dist: Math.hypot(dx, dy),
          from: 0, to: 0, at: Infinity, op: 0,
          scale: 1, drawn: ""
        });
      }
    }
    cy = Math.round(cy);
    figures = makeFigures();
  };

  // Every dot flips to level(d); the pass is cut into shuffled groups, as
  // Fourmula's is, or run clockwise for the draw-in.
  const flipTo = (level, now, clockwise = false) => {
    const order = clockwise ? null : dots.map(() => Math.floor(Math.random() * GROUPS));
    dots.forEach((d, i) => {
      d.from = d.op;
      d.to = level(d);
      const slot = clockwise ? d.turn : order[i] / GROUPS;
      d.at = now + slot * FLIP + Math.random() * (FLIP / GROUPS / 4);
    });
  };
  const cloud = (d) => {
    const core = Math.max(0, 1 - d.dist / 12);
    const v = 0.15 + core * 0.7 + (Math.random() - 0.5) * 0.35;
    return Math.min(1, Math.max(DIM, v));
  };

  const pointer = { x: -1e4, y: -1e4 };
  addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  document.addEventListener("pointerleave", () => { pointer.x = pointer.y = -1e4; });

  let last = 0, phase = null, nextAt = 0, figure = 0, centres = null;

  const measure = () => {
    centres = dots.map((d) => {
      const r = d.el.getBoundingClientRect();
      return [r.left + r.width / 2 + scrollX, r.top + r.height / 2 + scrollY];
    });
  };

  const tick = () => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - (last || now)); last = now;

    if (now >= nextAt) {
      if (phase === "figure") {
        phase = "cloud"; nextAt = now + FLIP;
        flipTo(cloud, now);
      } else {
        phase = "figure"; nextAt = now + FLIP + HOLD + FLIP;
        const set = figures[figure++ % figures.length];
        flipTo((d) => (set.has(d.key) ? 1 : DIM), now);
      }
    }

    if (!centres) measure();
    const k = 1 - Math.exp(-dt / 0.08); // ≈ Fourmula's 0.2s power2 ease
    dots.forEach((d, i) => {
      if (now >= d.at) {
        // steps(2): halfway at once, all the way after half the flip
        const half = FLIP / 2;
        d.op = now >= d.at + half ? d.to : (d.from + d.to) / 2;
        if (now >= d.at + half) d.at = Infinity;
      }
      const [x, y] = centres[i];
      const dist = Math.hypot(x - scrollX - pointer.x, y - scrollY - pointer.y);
      const target = Math.max(MIN_SCALE, 1 - (1 - MIN_SCALE) * Math.max(0, (REACH - dist) / REACH));
      d.scale += (target - d.scale) * k;

      const key = `${d.op.toFixed(2)}|${d.scale.toFixed(3)}`;
      if (key === d.drawn) return;
      d.drawn = key;
      d.el.style.opacity = d.op.toFixed(2);
      d.el.style.transform = d.scale < 0.999 ? `scale(${d.scale.toFixed(3)})` : "";
    });
  };

  build();

  if (reduce) {
    const set = figures[0];
    dots.forEach((d) => { d.el.style.opacity = set.has(d.key) ? 1 : DIM; });
    return;
  }

  let running = false, drawnIn = false;
  const start = () => {
    if (running) return;
    running = true;
    centres = null;
    if (!drawnIn) {
      drawnIn = true;
      const now = performance.now() / 1000;
      flipTo(cloud, now, true);
      phase = "cloud"; nextAt = now + FLIP * 1.4;
    }
    gsap.ticker.add(tick);
  };
  const stop = () => { running = false; gsap.ticker.remove(tick); };

  ScrollTrigger.addEventListener("refresh", () => (centres = null));
  ScrollTrigger.create({
    trigger: "[data-section-dot]",
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => (self.isActive ? start() : stop())
  });

  let rt;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      centres = null;
      if (pickCols() === cols) return;
      build();
      drawnIn = false;
      if (running) { stop(); start(); }
    }, 200);
  });
});
