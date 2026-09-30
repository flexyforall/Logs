// Footer dot field. After Fourmula: dots don't fade, they snap — each one
// flips in two hard steps — and figures alternate with a "cloud" that's
// dense in the middle and ragged at the edge. Ours draws each figure
// clockwise from twelve, like the dial's hand, and the cursor (after The
// Start) swells the dots under it and leaves an orange trail that fades.
document.addEventListener("DOMContentLoaded", () => {
  const field = document.getElementById("dotsField");
  if (!field) return;
  const card = field.closest(".s_footer_content_wrap") || field;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ROWS = 15;
  const OFF = 0.12;          // resting dot
  const STEP = 0.07;         // each flip is two hard steps this far apart (s)
  const SWEEP = 0.9;         // one clockwise pass over the field (s)
  const HOLD = 2.4;          // a figure stays this long (s)
  const CLOUD = 1.1;         // the cloud between figures (s)
  const BRUSH = 130;         // cursor reach (px)
  const FADE = 0.9;          // trail half-life (s)
  const INK = [17, 17, 17], ORANGE = [255, 114, 52];

  let cols, cx, cy, dots = [], figures = [];

  const pickCols = () => {
    const w = innerWidth;
    return w < 480 ? 21 : w < 768 ? 31 : w < 1100 ? 41 : 51;
  };

  // Figures on the 15-row grid, centred. Ours: the logo's rays, a clock,
  // and two of the Webflow originals.
  const makeFigures = () => {
    const shape = (fn) => { const s = new Set(); fn((dx, dy) => s.add(`${Math.round(cx + dx)},${Math.round(cy + dy)}`)); return s; };
    const rays = shape((p) => {
      for (let k = 0; k < 12; k++) {
        const t = (k / 12) * Math.PI * 2;
        for (let r = 3; r <= 6.5; r += 0.5) p(r * Math.sin(t) * 1.15, -r * Math.cos(t));
      }
    });
    const clock = shape((p) => {
      for (let a = 0; a < 360; a += 6) { const t = a * Math.PI / 180; p(6.6 * Math.sin(t) * 1.15, -6.6 * Math.cos(t)); }
      for (let r = 0; r <= 4.5; r++) p(0, -r);            // minute hand to twelve
      for (let r = 0; r <= 3; r++) p(r * 0.8, r * 0.6);    // hour hand towards four
    });
    const snowflake = shape((p) => {
      for (let i = 2; i <= 6; i++) { p(0, -i); p(0, i); p(-i, 0); p(i, 0); }
      for (let j = 2; j <= 4; j++) { p(-j, -j); p(j, -j); p(-j, j); p(j, j); }
    });
    const diamond = shape((p) => {
      const R = 6; for (let dx = -R; dx <= R; dx++) { const dy = R - Math.abs(dx); p(dx, dy); p(dx, -dy); }
    });
    return [rays, clock, snowflake, diamond];
  };

  const build = () => {
    cols = pickCols();
    cx = (cols - 1) / 2; cy = (ROWS - 1) / 2;
    field.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    field.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
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
          // clockwise from twelve, 0..1
          turn: ((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360) / 360,
          dist: Math.hypot(dx / (cols / 2), dy / (ROWS / 2)),
          from: 0, to: 0, at: Infinity,   // a pending two-step flip
          op: 0, paint: 0, hover: 0, drawn: ""
        });
      }
    }
    figures = makeFigures();
  };

  // Schedule every dot to flip to `level(d)`, the pass ordered by `order(d)`.
  const flipTo = (level, order, now) => {
    dots.forEach((d) => {
      const to = level(d);
      if (Math.abs(to - d.to) < 0.01 && d.at === Infinity) return;
      d.from = d.op; d.to = to;
      d.at = now + order(d) * SWEEP + Math.random() * 0.12;
    });
  };
  const clockwise = (d) => d.turn;
  const scattered = () => Math.random();
  const cloud = (d) => {
    const core = Math.max(0, 1 - d.dist * 1.1);
    const v = 0.15 + core * 0.7 + (Math.random() - 0.5) * 0.35;
    return Math.round(Math.min(1, Math.max(OFF, v)) * 4) / 4; // quantised: crisp
  };

  // cursor, smoothed like The Start's brush (≈0.55s catch-up)
  const brush = { x: 0, y: 0, tx: 0, ty: 0, on: false, px: 0, py: 0 };
  card.addEventListener("pointerenter", (e) => {
    const r = field.getBoundingClientRect();
    brush.on = true;
    brush.x = brush.tx = brush.px = e.clientX - r.left;
    brush.y = brush.ty = brush.py = e.clientY - r.top;
  });
  card.addEventListener("pointermove", (e) => {
    const r = field.getBoundingClientRect();
    brush.tx = e.clientX - r.left; brush.ty = e.clientY - r.top;
  });
  card.addEventListener("pointerleave", () => { brush.on = false; });

  let last = 0, phase = null, nextAt = 0, figure = 0;

  const tick = (now) => {
    const dt = Math.min(0.05, now - (last || now)); last = now;

    // the cycle: figure → cloud → next figure
    if (now >= nextAt) {
      if (phase === "figure") {
        phase = "cloud"; nextAt = now + CLOUD + SWEEP;
        flipTo(cloud, scattered, now);
      } else {
        phase = "figure"; nextAt = now + SWEEP + HOLD;
        const set = figures[figure++ % figures.length];
        flipTo((d) => (set.has(d.key) ? 1 : OFF), clockwise, now);
      }
    }

    // brush: ease towards the pointer, paint along the way
    const rect = field.getBoundingClientRect();
    const cw = rect.width / cols, ch = rect.height / ROWS;
    const k = 1 - Math.exp(-dt / 0.14);
    brush.x += (brush.tx - brush.x) * k;
    brush.y += (brush.ty - brush.y) * k;
    const decay = Math.pow(0.5, dt / FADE);

    dots.forEach((d) => {
      if (now >= d.at) {
        // two hard steps: halfway, then there
        d.op = now >= d.at + STEP ? d.to : (d.from + d.to) / 2;
        if (now >= d.at + STEP) d.at = Infinity;
      }
      let hover = 0;
      if (brush.on) {
        const x = (d.c + 0.5) * cw, y = (d.r + 0.5) * ch;
        // distance to the segment the brush travelled this frame
        const vx = brush.x - brush.px, vy = brush.y - brush.py;
        const len = vx * vx + vy * vy;
        const t = len ? Math.max(0, Math.min(1, ((x - brush.px) * vx + (y - brush.py) * vy) / len)) : 0;
        const dist = Math.hypot(x - (brush.px + vx * t), y - (brush.py + vy * t));
        hover = Math.max(0, 1 - dist / BRUSH);
        hover *= hover;
      }
      d.paint = Math.max(d.paint * decay, hover);
      d.hover += (hover - d.hover) * 0.25;

      const op = Math.max(d.op, d.paint * 0.95);
      const scale = 1 + d.hover * 0.7;
      const col = d.paint > 0.02
        ? INK.map((v, i) => Math.round(v + (ORANGE[i] - v) * Math.min(1, d.paint * 1.3)))
        : INK;
      const key = `${op.toFixed(2)}|${scale.toFixed(2)}|${col}`;
      if (key === d.drawn) return;
      d.drawn = key;
      d.el.style.opacity = op.toFixed(2);
      d.el.style.transform = scale > 1.005 ? `scale(${scale.toFixed(2)})` : "";
      d.el.style.backgroundColor = `rgb(${col})`;
    });
    brush.px = brush.x; brush.py = brush.y;
  };

  build();

  if (reduce) {
    const set = figures[0];
    dots.forEach((d) => { d.el.style.opacity = set.has(d.key) ? 1 : OFF; });
    return;
  }

  let running = false, drawnIn = false;
  const loop = () => tick(performance.now() / 1000);
  const start = () => {
    if (running) return;
    running = true;
    if (!drawnIn) {
      // first sight: the field draws itself in, clockwise, as a cloud
      drawnIn = true;
      const now = performance.now() / 1000;
      flipTo(cloud, clockwise, now);
      phase = "cloud"; nextAt = now + SWEEP + 0.6;
    }
    gsap.ticker.add(loop);
  };
  const stop = () => { running = false; gsap.ticker.remove(loop); };

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
      if (pickCols() === cols) return;
      build();
      drawnIn = false;
      if (running) { stop(); start(); }
    }, 200);
  });
});
