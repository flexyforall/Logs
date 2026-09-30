// The hero, rebuilt from Figma's layers so it can move, after the app's own
// welcome animation: the phone's line changes in three steps, and the
// activity bubbles drift round the dial's band. The stage is drawn at the
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

  // --- the bubbles, placed by angle and radius round the band's centre
  const CX = 704.4, CY = 834.6;
  const orbit = bubbles.map((el) => {
    const dx = +el.dataset.x - CX, dy = +el.dataset.y - CY;
    return { el, a: Math.atan2(dx, -dy) * 180 / Math.PI, r: Math.hypot(dx, dy) };
  });
  const place = (drift) => {
    orbit.forEach((o) => {
      // wrap so a bubble that sinks below the card on the right comes back
      // up on the left
      let a = o.a + drift;
      a = ((a + 180) % 360 + 360) % 360 - 180;
      o.el.style.transform = `rotate(${a.toFixed(2)}deg) translateY(${-o.r}px)`;
    });
  };
  place(0);

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

  // three parts that add up: a slow endless drift, a lean at each step,
  // and the glide in as the page opens
  const drift = { base: 0, lean: 0, intro: -30 };
  gsap.ticker.add(() => place(drift.base + drift.lean + drift.intro));

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
    // the bubbles lean on a little with each step
    gsap.to(drift, { lean: "+=4", duration: 1.6, ease: "power2.inOut" });
  };

  (window.logsReady || Promise.resolve()).then(() => {
    // bubbles glide in along the band as the page opens
    gsap.to(drift, { intro: 0, duration: 2.4, ease: "expo.out" });
    gsap.to(drift, { base: 360, duration: 240, ease: "none", repeat: -1 });
    setInterval(swap, 3400);
  });
})();
