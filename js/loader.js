// The loader. After Nudot: on black, the name blurs into focus either side
// of a small tile showing the brand in the world — a sign, a poster, the
// app — then the letters part to the edges and a window opens from the
// centre onto the page. Ours spells "lo · gs" round a tile that eases
// through five branding mockups (assets/images/loader, composited in
// tools/mockups); behind it the dial's hand sweeps a full day while a
// dot-matrix counter runs 00.00 → 24.00h. The window opens as one of the
// site's rounded cards. It plays on every load.
//
// window.logsReady resolves as the window starts to open — js/text.js holds
// the hero title for it.
(() => {
  let resolveReady;
  window.logsReady = new Promise((r) => (resolveReady = r));

  const root = document.querySelector("[data-loader]");
  if (!root || getComputedStyle(root).display === "none") {
    if (root) root.remove();
    resolveReady();
    return;
  }

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const win = $("[data-loader-window]");
  const dial = $("[data-loader-dial]");
  const turn = $("[data-loader-turn]");
  const letters = $$("[data-loader-letter]");
  const media = $("[data-loader-media]");
  const frames = $$("[data-loader-frame]");
  const note = $("[data-loader-note]");
  const foot = $("[data-loader-foot]");
  const count = $("[data-loader-count]");
  const word = $("[data-loader-word]");

  // hold the page still underneath
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  scrollTo(0, 0);
  document.documentElement.style.overflow = "hidden";
  if (window.lenis) window.lenis.stop();

  // --- dot-matrix counter: 3x5 glyphs, the footer's pixels in miniature
  const GLYPHS = {
    0: "111101101101111", 1: "010110010010111", 2: "111001111100111",
    3: "111001111001111", 4: "101101111001001", 5: "111100111001111",
    6: "111100111101111", 7: "111001001010010", 8: "111101111101111",
    9: "111101111001111", ".": "000000000000010", h: "100100111101101"
  };
  const slots = [..."00.00h"].map((ch) => {
    const g = document.createElement("span");
    g.className = "loader_glyph" + (ch === "h" ? " is-unit" : "");
    g.innerHTML = "<i></i>".repeat(15);
    count.appendChild(g);
    return [...g.children];
  });
  const showCount = (hours) => {
    const txt = hours.toFixed(2).padStart(5, "0") + "h";
    [...txt].forEach((ch, i) => {
      const bits = GLYPHS[ch];
      slots[i].forEach((px, j) => px.classList.toggle("on", bits[j] === "1"));
    });
  };
  showCount(0);

  // --- the mockups: each holds, then eases into the next — a slow push
  // in, the next one sharpening out of a blur over it
  const HOLD = 0.72;
  gsap.set(frames, { autoAlpha: 0 });
  gsap.set(frames[0], { autoAlpha: 1 });
  const reel = gsap.timeline({ paused: true });
  frames.forEach((f, i) => {
    const img = f.querySelector("img");
    reel.fromTo(img, { scale: 1.12 }, { scale: 1, duration: HOLD + 0.5, ease: "power2.out" }, i * HOLD);
    if (i) {
      reel.fromTo(f, { autoAlpha: 0, filter: "blur(12px)" },
        { autoAlpha: 1, filter: "blur(0px)", duration: 0.45, ease: "power2.inOut" }, i * HOLD - 0.2);
      // once it's in, the one under it goes: stacked frames bled a light
      // rim through the tile's rounded corners
      reel.set(frames[i - 1], { autoAlpha: 0 }, i * HOLD + 0.25);
    }
  });
  const REEL = frames.length * HOLD;

  // --- words: Tap. / Talk. / Time.
  const WORDS = ["Tap.", "Talk.", "Time."];
  let w = 0;
  const cycle = gsap.timeline({ repeat: -1, delay: 0.9 });
  cycle.to(word, { opacity: 0, filter: "blur(8px)", y: -8, duration: 0.25, ease: "power2.in" })
    .add(() => { w = (w + 1) % WORDS.length; word.textContent = WORDS[w]; })
    .fromTo(word, { opacity: 0, filter: "blur(8px)", y: 8 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.35, ease: "power2.out" })
    .to({}, { duration: 0.5 });

  // --- the day: the hand sweeps a full turn, the counter runs to 24h.
  // Unrotated, the dial's hand points at 336deg, so +24 puts it at twelve.
  const day = { p: 0 };
  const paintDay = () => {
    gsap.set(turn, { rotation: 24 + day.p * 360 });
    showCount(day.p * 24);
  };
  paintDay();

  const loaded = new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r, { once: true })));
  const capped = Promise.race([loaded, new Promise((r) => setTimeout(r, 4500))]);

  const intro = gsap.timeline();
  intro
    .to(note, { opacity: 1, duration: 0.5 }, 0.1)
    .fromTo(letters, { opacity: 0, filter: "blur(10px)", y: 6, scale: 1.15 },
      { opacity: 1, filter: "blur(0px)", y: 0, scale: 1, duration: 0.55, ease: "power3.out", stagger: 0.3 }, 0.3)
    .fromTo(dial, { opacity: 0, scale: 0.88 }, { opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" }, 0.2)
    .fromTo(media, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, 0.35)
    .to(foot, { opacity: 1, duration: 0.5 }, 0.5)
    .add(() => reel.play(), 0.45)
    .to(day, { p: 1, duration: REEL, ease: "power1.inOut", onUpdate: paintDay }, 0.45);

  Promise.all([intro.then(), capped]).then(() => {
    cycle.pause();

    const out = gsap.timeline({
      onComplete: () => {
        root.remove();
        document.documentElement.style.overflow = "";
        if (window.lenis) window.lenis.start();
        ScrollTrigger.refresh();
      }
    });
    out
      .to(media, { scale: 1.08, duration: 0.25, ease: "power2.out" }, 0)
      .to(letters[0], { x: () => -(innerWidth / 2) + letters[0].offsetWidth, duration: 1.1, ease: "power4.inOut" }, 0.15)
      .to(letters[1], { x: () => innerWidth / 2 - letters[1].offsetWidth, duration: 1.1, ease: "power4.inOut" }, 0.15)
      .to(letters, { opacity: 0, filter: "blur(8px)", duration: 0.45 }, 0.9)
      .to(media, { scale: 0.4, opacity: 0, duration: 0.45, ease: "power2.in" }, 0.35)
      .to(dial, { scale: 1.35, opacity: 0, duration: 0.9, ease: "power3.in" }, 0.2)
      .to([note, foot], { opacity: 0, duration: 0.4 }, 0.2)
      // the window: a card's worth first, then the whole page
      .to(win, { width: "7vw", height: "4vw", duration: 0.2, ease: "power2.out" }, 0.75)
      .to(win, { width: "300vmax", height: "300vmax", borderRadius: "6rem", duration: 1.05, ease: "power4.inOut" }, 0.95)
      .add(() => resolveReady(), 1.1);
  });
})();
