// The hero, rebuilt from Figma's layers so it can move, after the app's own
// welcome animation: the phone's line changes in three steps, and the
// activity bubbles gather along the dial's band. The stage is drawn at the
// design's 1408x780 and scaled to the card.
(() => {
  const stage = document.querySelector("[data-hero-stage]");
  if (!stage) return;
  const card = stage.closest(".s_h_m_content");
  const words = stage.querySelector("[data-hero-words]");
  const bubbles = [...stage.querySelectorAll("[data-hero-bubble]")];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- fit: the design's width to the card's, the phone kept in view on a
  // phone (Webflow crops the tablet hero the same way, never under 65rem)
  const PHONE_X = 673; // the phone's centre in the design frame
  const fit = () => {
    const w = card.clientWidth;
    let scale, shift = 0;
    if (w < 480) {
      scale = 0.64;
      shift = 704 - PHONE_X;
    } else {
      scale = Math.max(w, 1040) / 1408;
    }
    stage.style.setProperty("--hero-scale", scale.toFixed(4));
    stage.style.setProperty("--hero-shift", `${shift}px`);
  };
  fit();
  addEventListener("resize", fit);

  // --- the bubbles ride the middle of the grey band (radius 501-611 in
  // the design), placed by angle round its centre, 0deg at twelve. Their
  // design angles are where they come to rest; they never leave the arc.
  const CX = 704.4, CY = 834.6, R = 556;
  const orbit = bubbles.map((el) => {
    const dx = +el.dataset.x - CX, dy = +el.dataset.y - CY;
    return { el, rest: Math.atan2(dx, -dy) * 180 / Math.PI, a: 0, s: 0, name: el.querySelector("img").src.match(/icon-(\w+)/)[1] };
  });
  const byName = Object.fromEntries(orbit.map((o) => [o.name, o]));
  const sway = { a: 0 };
  const place = () => {
    orbit.forEach((o) => {
      const a = o.a + sway.a;
      o.el.style.transform = `rotate(${a.toFixed(2)}deg) translateY(${-R}px) rotate(${(-a * 0.35).toFixed(2)}deg) scale(${o.s.toFixed(3)})`;
      o.el.style.opacity = Math.min(1, o.s * 1.4).toFixed(2);
    });
  };
  orbit.forEach((o) => { o.a = o.rest; o.s = reduce ? 1 : 0; });
  place();

  // --- the phone's line: three steps, each rising in out of a blur
  const LINES = [
    ["Log your time", "in seconds"],
    ["See where your", "time goes"],
    ["Make every", "second count"]
  ];
  const setLine = ([a, b]) => {
    words.innerHTML = `<span>${a}</span><span>${b}</span>`;
  };

  if (reduce) return;

  // In order: one bubble, then three that arrive apart and slide
  // together until they touch, then two more that do the same, then the
  // last. They hold, sway a little along the arc, and leave together.
  const GROUPS = [["dev"], ["headphones", "paw", "house"], ["car", "phone"], ["gamecontroller"]];
  gsap.ticker.add(place);
  const cycle = () => {
    const tl = gsap.timeline({ onComplete: cycle });
    orbit.forEach((o) => { o.s = 0; o.a = o.rest; });
    GROUPS.forEach((names, g) => {
      const at = g * 1.1;
      const group = names.map((n) => byName[n]).filter(Boolean);
      const mid = group.reduce((t, o) => t + o.rest, 0) / group.length;
      group.forEach((o, i) => {
        // arrive spread out from the group's centre, then close up
        const apart = group.length > 1 ? (o.rest - mid) * 2.2 + mid : o.rest - 6;
        tl.fromTo(o, { a: apart, s: 0 }, { s: 1, duration: 0.7, ease: "back.out(1.8)" }, at + i * 0.18);
        tl.to(o, { a: o.rest, duration: 1.1, ease: "expo.inOut" }, at + 0.35 + i * 0.18);
      });
      // the bump as they meet
      if (group.length > 1) {
        tl.to(group, { s: 1.08, duration: 0.14, ease: "power2.out", yoyo: true, repeat: 1 }, at + 1.25);
      }
    });
    tl.to(sway, { a: 3, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: 3 }, 4.8)
      .to(orbit, { s: 0, duration: 0.6, ease: "power2.in", stagger: 0.07 }, 14.6);
  };

  let step = 0;
  // Each split is reverted before the next: a new SplitText on the same
  // element first restores the HTML the last one saved, which would undo
  // setLine.
  const swap = () => {
    step = (step + 1) % LINES.length;
    const out = SplitText.create(words, { type: "chars" });
    gsap.timeline()
      .to(out.chars, { yPercent: -60, opacity: 0, filter: "blur(8px)", duration: 0.45, ease: "power2.in", stagger: 0.012 })
      .add(() => {
        out.revert();
        setLine(LINES[step]);
        const inn = SplitText.create(words, { type: "chars" });
        gsap.from(inn.chars, {
          yPercent: 80, opacity: 0, filter: "blur(10px)", duration: 0.8, ease: "expo.out", stagger: 0.018,
          onComplete: () => inn.revert()
        });
      });
  };

  (window.logsReady || Promise.resolve()).then(() => {
    cycle();
    setInterval(swap, 3400);
  });
})();
