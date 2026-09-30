// The four feature cards, animated. Each card's art is drawn at Figma's
// 686x576 and scaled to the card; each runs only while it's on screen.
//
//   breakdown   the needle browses the day, the dot-matrix total follows;
//               with a pointer, the needle follows it — an interactive
//               timeline, as the card says
//   habits      the day's logs drift up the card, one after another
//   sheets      pulses run in along the lines and charge the sheet
//   activities  a light wanders over the icons as if a cursor were there;
//               with a pointer, it's your cursor
(() => {
  const stages = [...document.querySelectorAll("[data-feat]")];
  if (!stages.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- fit each stage to its card
  const fit = () => stages.forEach((s) => {
    s.style.setProperty("--feat-scale", (s.parentElement.clientWidth / 686).toFixed(4));
  });
  fit();
  addEventListener("resize", fit);

  // --- run a card's loop only while it's visible
  const whileVisible = (el, on, off) => {
    new IntersectionObserver(([e]) => (e.isIntersecting ? on() : off()), { rootMargin: "80px" }).observe(el);
  };

  const byName = Object.fromEntries(stages.map((s) => [s.dataset.feat, s]));

  // ======================================================== 1. breakdown
  (() => {
    const s = byName.breakdown;
    if (!s) return;
    const needle = s.querySelector("[data-fb-needle]");
    const digits = s.querySelector("[data-fb-digits]");

    // 5x7 dot-matrix glyphs, after the app's pixel numerals
    const G = {
      0: "01110100011001110101110011000101110", 1: "00100011000010000100001000010001110",
      2: "01110100010000100010001000100011111", 3: "11111000100010000010000011000101110",
      4: "00010001100101010010111110001000010", 5: "11111100001111000001000011000101110",
      6: "00110010001000011110100011000101110", 7: "11111000010001000100010000100001000",
      8: "01110100011000101110100011000101110", 9: "01110100011000101111000010001001100"
    };
    const glyph = (cls) => {
      const g = document.createElement("span");
      g.className = "fb_glyph " + cls;
      return g;
    };
    const slots = [glyph(""), glyph("is-dot"), glyph("is-dim"), glyph("is-dim")];
    slots[0].innerHTML = slots[2].innerHTML = slots[3].innerHTML = "<i></i>".repeat(35);
    slots[1].innerHTML = "<i></i>".repeat(7);
    slots[1].children[6].classList.add("on");
    digits.append(...slots);
    const show = (hours) => {
      const t = Math.min(9.99, hours).toFixed(2);
      [t[0], t[2], t[3]].forEach((d, k) => {
        const bits = G[d], cells = slots[k === 0 ? 0 : k + 1].children;
        for (let i = 0; i < 35; i++) cells[i].classList.toggle("on", bits[i] === "1");
      });
    };

    // the arc spans -90deg..+90deg; the needle stands at an angle for a
    // number of hours, 0h at the far left and 12h at the far right
    const toAngle = (h) => -90 + (h / 12) * 180;
    const state = { h: 0 };
    const paint = () => {
      needle.style.setProperty("--needle", `${toAngle(state.h).toFixed(2)}deg`);
      show(state.h);
    };
    paint();
    if (reduce) { state.h = 5.2; paint(); return; }

    // browse: sweep up to the day's total, then step between a few days
    const DAYS = [5.2, 7.45, 3.1, 8.6, 5.2];
    const tl = gsap.timeline({ paused: true, repeat: -1, onUpdate: paint });
    tl.fromTo(state, { h: 0 }, { h: DAYS[0], duration: 2.2, ease: "power3.out" });
    DAYS.slice(1).forEach((h) => tl.to(state, { h, duration: 1.4, ease: "power3.inOut" }, "+=1.6"));
    tl.to({}, { duration: 1.6 });

    let hovering = false;
    whileVisible(s, () => !hovering && tl.play(), () => tl.pause());
    const card = s.closest(".s_features_card") || s;
    card.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      hovering = true;
      tl.pause();
      const r = s.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      gsap.to(state, { h: 1 + t * 10, duration: 0.5, ease: "power3.out", overwrite: true, onUpdate: paint });
    });
    card.addEventListener("pointerleave", () => {
      if (!hovering) return;
      hovering = false;
      gsap.to(state, { h: DAYS[0], duration: 0.9, ease: "power3.inOut", overwrite: true, onUpdate: paint,
        onComplete: () => tl.play(0) });
    });
  })();

  // ========================================================== 2. habits
  (() => {
    const s = byName.habits;
    if (!s) return;
    const list = s.querySelector("[data-fh-list]");
    if (reduce) return;
    // each step: the top log lifts out of view and goes to the back of the
    // queue, the rest rise by its height
    const GAP = 13.75;
    const step = () => {
      const first = list.firstElementChild;
      const h = first.offsetHeight + GAP;
      gsap.to(list, {
        y: -h, duration: 1.1, ease: "power3.inOut",
        onComplete: () => { list.appendChild(first); gsap.set(list, { y: 0 }); }
      });
      gsap.fromTo(list.children[4] || first, { opacity: 0, y: 30, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, ease: "power3.out" });
    };
    let timer = null;
    whileVisible(s, () => { if (!timer) timer = setInterval(step, 2200); }, () => { clearInterval(timer); timer = null; });
  })();

  // ========================================================== 3. sheets
  (() => {
    const s = byName.sheets;
    if (!s) return;
    const level = s.querySelector("[data-fs-level]");
    const tile = s.querySelector("[data-fs-tile]");
    const pulses = [...s.querySelectorAll(".fs_pulse")];
    const FULL = 99.73; // the sheet's width, 14.775 → 114.506
    if (reduce) { level.setAttribute("width", FULL); return; }

    pulses.forEach((p) => {
      const len = p.getTotalLength();
      p.dataset.len = len;
      p.style.strokeDasharray = `70 ${len + 70}`;
      p.style.strokeDashoffset = 70;
    });
    const charge = { v: 0 };
    const paint = () => level.setAttribute("width", (charge.v * FULL).toFixed(2));
    paint();

    // eight charges fill it; each is a pulse from a random line and side
    const CHARGES = 8;
    const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.6 });
    for (let i = 0; i < CHARGES; i++) {
      const at = i * 0.42;
      const p = pulses[(i * 5 + 3) % pulses.length];
      const len = +p.dataset.len;
      tl.fromTo(p, { strokeDashoffset: 70, opacity: 1 },
        { strokeDashoffset: -len, duration: 0.8, ease: "power1.in" }, at)
        .set(p, { opacity: 0 }, at + 0.8)
        .to(charge, { v: (i + 1) / CHARGES, duration: 0.35, ease: "power2.out", onUpdate: paint }, at + 0.72)
        .fromTo(tile, { scale: 1 }, { scale: 1.035, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.out" }, at + 0.72);
    }
    // full: a glow, a hold, then it drains for the next round
    const done = CHARGES * 0.42 + 0.5;
    tl.to(tile, { boxShadow: "0 0 70px rgba(17,188,92,.55)", duration: 0.4, ease: "power2.out" }, done)
      .to(tile, { boxShadow: "0 0 39.4px rgba(242,175,117,.5)", duration: 0.8 }, done + 1.4)
      .to(charge, { v: 0, duration: 0.8, ease: "power2.inOut", onUpdate: paint }, done + 1.6);

    whileVisible(s, () => tl.play(), () => tl.pause());
  })();

  // ====================================================== 4. activities
  (() => {
    const s = byName.activities;
    if (!s) return;
    const lit = s.querySelector("[data-fa-lit]");
    const light = { x: 343, y: 288 };
    const paint = () => {
      lit.style.setProperty("--lx", `${light.x.toFixed(1)}px`);
      lit.style.setProperty("--ly", `${light.y.toFixed(1)}px`);
    };
    paint();
    if (reduce) return;

    // an unhurried wander, a Lissajous figure over the grid
    let t = Math.random() * 100, pointer = null, running = false;
    const target = { x: 343, y: 288 };
    const tick = () => {
      t += gsap.ticker.deltaRatio() / 60;
      if (pointer) { target.x = pointer.x; target.y = pointer.y; }
      else {
        target.x = 343 + 270 * Math.sin(t * 0.37) * Math.cos(t * 0.11);
        target.y = 288 + 210 * Math.sin(t * 0.53 + 1.3);
      }
      const k = pointer ? 0.18 : 0.05;
      light.x += (target.x - light.x) * k;
      light.y += (target.y - light.y) * k;
      paint();
    };
    whileVisible(s,
      () => { if (!running) { running = true; gsap.ticker.add(tick); } },
      () => { running = false; gsap.ticker.remove(tick); });
    const card = s.closest(".s_features_card") || s;
    card.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = s.getBoundingClientRect(), k = 686 / r.width;
      pointer = { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
    });
    card.addEventListener("pointerleave", () => (pointer = null));
  })();
})();

// The icon tiles round "Make every second count" tremble a little while
// hovered: a soft wobble about their own tilt, easing in and settling back.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!matchMedia("(hover: hover)").matches) return;
  document.querySelectorAll("[data-icon]").forEach((el) => {
    let base = null, wobble = null;
    el.addEventListener("mouseenter", () => {
      if (base === null) base = gsap.getProperty(el, "rotation");
      if (wobble) wobble.kill();
      wobble = gsap.timeline({ repeat: -1 })
        .to(el, { rotation: base + 4, x: 1.5, duration: 0.14, ease: "sine.inOut" })
        .to(el, { rotation: base - 4, x: -1.5, duration: 0.28, ease: "sine.inOut" })
        .to(el, { rotation: base, x: 0, duration: 0.14, ease: "sine.inOut" });
      // grow into the tremble rather than start at full strength
      gsap.fromTo(wobble, { timeScale: 0.3 }, { timeScale: 1, duration: 0.5, ease: "power2.out" });
    });
    el.addEventListener("mouseleave", () => {
      if (wobble) wobble.kill();
      wobble = null;
      gsap.to(el, { rotation: base, x: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    });
  });
})();
