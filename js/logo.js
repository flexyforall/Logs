// The logo mark as a live clock (after Omosa's logo). Its 24 ticks are
// shaded like a spinner — two arms, each fading from a bright head — and
// its hand leaves an orange trail over the ticks behind it, as in the Figma
// mark. Both turn with the page: one full turn from top to bottom, and a
// quick extra lap on hover.
(() => {
  const marks = [...document.querySelectorAll("[data-logo]")];
  if (!marks.length) return;

  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const ORANGE = hex("#ff6600");
  // head → tail of an arm; the dark pill in the nav, the light card below
  const TONES = {
    nav: [hex("#ffffff"), hex("#322b36")],
    footer: [hex("#322b36"), hex("#f6f5f5")]
  };
  const TRAIL = 90; // degrees of orange behind the hand, as in the export

  const clocks = marks.map((svg) => {
    const ticks = [...svg.querySelectorAll(".logo_tick")];
    const hand = svg.querySelector(".logo_hand");
    // centre = middle of the ticks' joint box; each tick's angle from there
    const boxes = ticks.map((t) => t.getBBox());
    const x0 = Math.min(...boxes.map((b) => b.x)), x1 = Math.max(...boxes.map((b) => b.x + b.width));
    const y0 = Math.min(...boxes.map((b) => b.y)), y1 = Math.max(...boxes.map((b) => b.y + b.height));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const angles = boxes.map((b) => {
      const a = Math.atan2(b.x + b.width / 2 - cx, cy - (b.y + b.height / 2)) * 180 / Math.PI;
      return (a + 360) % 360;
    });
    const tones = TONES[svg.classList.contains("logo_mark--footer") ? "footer" : "nav"];
    return { svg, ticks, hand, cx, cy, angles, tones, lap: 0, shown: -1 };
  });

  const paint = (c, angle) => {
    c.hand.setAttribute("transform", `rotate(${angle.toFixed(2)} ${c.cx} ${c.cy})`);
    c.ticks.forEach((t, i) => {
      // how far behind the hand this tick is, going back anticlockwise
      const behind = (angle - c.angles[i] + 720) % 360;
      let col = mix(c.tones[0], c.tones[1], (behind % 180) / 180);
      if (behind < TRAIL) col = mix(col, ORANGE, (1 - behind / TRAIL) * 0.95);
      t.setAttribute("fill", rgb(col));
    });
  };

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  clocks.forEach((c) => paint(c, 0));
  if (reduce) return;

  let target = 0, current = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? (scrollY / max) * 360 : 0;
  };
  addEventListener("scroll", readScroll, { passive: true });
  readScroll();

  clocks.forEach((c) => {
    const trigger = c.svg.closest("a") || c.svg;
    trigger.addEventListener("mouseenter", () => {
      gsap.to(c, { lap: "+=360", duration: 1.1, ease: "power3.inOut" });
    });
  });

  gsap.ticker.add(() => {
    current += (target - current) * 0.12;
    clocks.forEach((c) => {
      const angle = current + c.lap;
      if (Math.abs(angle - c.shown) < 0.05) return;
      c.shown = angle;
      paint(c, angle);
    });
  });
})();
