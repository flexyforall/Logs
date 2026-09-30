// The home-screen widget on the phone in the dial section's last frame,
// brought to life over the photo's own: the day fills in — the needle
// sweeps the arc, lighting the ticks behind it, while the dot-matrix total
// counts up to 3.50h — then "+" is tapped, half an hour of reading is
// logged, and the total steps on to 4.00h. It loops while it's in view.
(() => {
  const root = document.querySelector("[data-dw]");
  if (!root) return;
  const box = root.firstElementChild;
  const needle = root.querySelector("[data-dw-needle]");
  const lit = root.querySelector("[data-dw-lit]");
  const digits = root.querySelector("[data-dw-digits]");
  const plus = root.querySelector("[data-dw-plus]");
  const toast = root.querySelector("[data-dw-toast]");

  const fit = () => box.style.setProperty("--dw-scale", (root.clientWidth / 1262).toFixed(4));
  fit();
  addEventListener("resize", fit);
  new ResizeObserver(fit).observe(root);

  // 5x7 dot-matrix numerals, the app's pixel font
  const G = {
    0: "01110100011001110101110011000101110", 1: "00100011000010000100001000010001110",
    2: "01110100010000100010001000100011111", 3: "11111000100010000010000011000101110",
    4: "00010001100101010010111110001000010", 5: "11111100001111000001000011000101110",
    6: "00110010001000011110100011000101110", 7: "11111000010001000100010000100001000",
    8: "01110100011000101110100011000101110", 9: "01110100011000101111000010001001100"
  };
  const glyph = (cls, n) => {
    const g = document.createElement("span");
    g.className = "fb_glyph " + cls;
    g.innerHTML = "<i></i>".repeat(n);
    return g;
  };
  const slots = [glyph("", 35), glyph("is-dot", 7), glyph("is-dim", 35), glyph("is-dim", 35)];
  slots[1].children[6].classList.add("on");
  digits.append(...slots);

  // the arc runs from -100deg (off the left edge) to 0 at the top, where 3.50h stands
  const angle = (h) => -100 + (h / 3.5) * 100;
  const day = { h: 3.5 };
  const paint = () => {
    const t = Math.min(9.99, day.h).toFixed(2);
    [t[0], t[2], t[3]].forEach((d, k) => {
      const cells = slots[k === 0 ? 0 : k + 1].children;
      for (let i = 0; i < 35; i++) cells[i].classList.toggle("on", G[d][i] === "1");
    });
    const a = angle(day.h);
    needle.style.setProperty("--needle", `${a.toFixed(2)}deg`);
    lit.style.setProperty("--sweep", `${(a + 100).toFixed(2)}deg`);
  };
  paint();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.4 });
  tl.fromTo(day, { h: 0 }, { h: 3.5, duration: 2.6, ease: "power2.inOut", onUpdate: paint }, 0.3)
    // tap "+": a press, a toast, the half hour added
    .to(plus, { scale: 0.86, duration: 0.14, ease: "power2.in" }, "+=1")
    .to(plus, { scale: 1, duration: 0.5, ease: "back.out(3)" })
    .fromTo(toast, { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)" }, "<")
    .to(day, { h: 4, duration: 0.9, ease: "power3.out", onUpdate: paint }, "<0.15")
    .to(toast, { opacity: 0, y: -10, duration: 0.35 }, "+=1.2")
    .to(day, { h: 0, duration: 1.2, ease: "power2.inOut", onUpdate: paint }, "+=1");

  new IntersectionObserver(([e]) => (e.isIntersecting ? tl.play() : tl.pause()), { threshold: 0.4 }).observe(root);
})();
