// The loader. After Nudot: on black, the name blurs into focus either side
// of a small flickering tile, then the letters part to the edges and a
// window opens from the centre onto the page. Ours spells "lo · gs" round
// a tile that flicks through Logs screens, each stamped with the logo, and
// settles on the app icon; behind it the dial's hand sweeps a full day
// while a dot-matrix counter runs 00.00 → 24.00h. The window opens as one
// of the site's rounded cards.
//
// Shown once per browser session; add ?loader to the URL to see it again.
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
  try { sessionStorage.setItem("logs-loader", "1"); } catch (e) {}

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

  // --- the flicker: frames swap faster and faster, each with a jolt
  let current = 0, flicking = true, gap = 170;
  const show = (i) => {
    frames[current].classList.remove("is-on");
    current = i;
    frames[current].classList.add("is-on");
  };
  const glitch = () => {
    const top = Math.random() * 70, h = 8 + Math.random() * 22;
    media.style.setProperty("--slice", `inset(${top}% 0 ${Math.max(0, 100 - top - h)}% 0)`);
    media.style.setProperty("--jolt", `${(Math.random() - 0.5) * 14}px`);
    media.classList.add("is-glitch");
    setTimeout(() => media.classList.remove("is-glitch"), 70);
  };
  const flick = () => {
    if (!flicking) return;
    show(1 + (current % (frames.length - 1)));
    glitch();
    gap = Math.max(60, gap * 0.9);
    setTimeout(flick, gap);
  };

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
    .add(() => setTimeout(flick, gap), 0.7)
    .to(day, { p: 1, duration: 2.4, ease: "power1.inOut", onUpdate: paintDay }, 0.5);

  Promise.all([intro.then(), capped]).then(() => {
    // settle on the app icon — the logo itself
    flicking = false;
    show(0);
    glitch();
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
