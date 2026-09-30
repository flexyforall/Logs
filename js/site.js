document.addEventListener("DOMContentLoaded", () => {

  const init = () => {
    document.querySelectorAll("[data-roll]").forEach((out) => {
      if (out.dataset.rollInit) return;
      out.dataset.rollInit = "1";

      const target =
        out.closest("[data-trigger]") ||
        out.closest("a, button") ||
        out.parentElement;
      if (!target) return;

      const incoming = target.querySelector("[data-roll-in]");
      const splitOut = SplitText.create(out, { type: "chars", mask: "chars" });
      const splitIn  = incoming
        ? SplitText.create(incoming, { type: "chars", mask: "chars" })
        : null;

      if (splitIn) gsap.set(splitIn.chars, { yPercent: 100 });

      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: "power3.inOut", duration: 0.4 }
      });

      tl.to(splitOut.chars, {
        yPercent: -110,
        stagger: { each: 0.025, from: "start" }
      }, 0);

      if (splitIn) {
        tl.to(splitIn.chars, {
          yPercent: 0,
          stagger: { each: 0.025, from: "start" }
        }, 0);
      }

      target.addEventListener("mouseenter", () => tl.play());
      target.addEventListener("mouseleave", () => tl.reverse());
      target.addEventListener("focusin",  () => tl.play());
      target.addEventListener("focusout", () => tl.reverse());
    });
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    init();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.fonts.ready.then(() => {
    gsap.set("[data-split-title], [data-split-description], [data-fade-item]", { opacity: 1 });

    const mm = gsap.matchMedia();
    mm.add(
      {
        animate: "(prefers-reduced-motion: no-preference)",
        reduce:  "(prefers-reduced-motion: reduce)"
      },
      (ctx) => {
        const { reduce } = ctx.conditions;

        gsap.utils.toArray("[data-section-text]").forEach((section) => {
          const titleEl   = section.querySelector("[data-split-title]");
          const descEl    = section.querySelector("[data-split-description]");
          const fadeItems = section.querySelectorAll("[data-fade-item]"); 

          if (!titleEl && !descEl && !fadeItems.length) return;

          const tl = gsap.timeline({
            scrollTrigger: { trigger: section, start: "top 85%", once: true }
          });

        
          if (reduce) {
            if (titleEl)         tl.from(titleEl,   { autoAlpha: 0, duration: 0.4 });
            if (descEl)          tl.from(descEl,    { autoAlpha: 0, duration: 0.4 }, "-=0.2");
            if (fadeItems.length) tl.from(fadeItems, { autoAlpha: 0, duration: 0.4, stagger: 0.08 }, "-=0.2");
            return;
          }

          // — TITLE —
          if (titleEl) {
            const ts = SplitText.create(titleEl, {
              type: "lines",
              linesClass: "split-line-title"
            });
            tl.from(ts.lines, {
              yPercent: 100,
              autoAlpha: 0,
              duration: 0.8,
              ease: "power3.out",
              stagger: 0.12
            });
          }

          // — DESCRIPTION —
          if (descEl) {
            const ds = SplitText.create(descEl, { type: "lines" });
            tl.from(ds.lines, {
              yPercent: 100,
              autoAlpha: 0,
              duration: 0.8,
              ease: "power3.out",
              stagger: 0.12
            }, "-=0.3");
          }

          // — FADE ITEMS —
          if (fadeItems.length) {
            tl.from(fadeItems, {
              autoAlpha: 0,
              duration: 0.6,
              ease: "power2.out",
              stagger: 0.1
            }, "-=0.2");
          }
        });
      }
    );
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".nav");
  if (!nav) return;

  const showAnim = gsap.from(nav, {
    yPercent: -150,
    paused: true,
    duration: 0.8,
    ease: "power2.out"
  }).progress(1);

  ScrollTrigger.create({
    start: "top top",
    end: "max",
    onUpdate: (self) => {
      if (self.direction === 1) showAnim.reverse(); 
      else showAnim.play();                       
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {

  gsap.utils.toArray("[data-section]").forEach((section) => {
    const title = section.querySelector("[data-title-item]");
    const icons = section.querySelectorAll("[data-icon]");

    const enterTl = gsap.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: {
        trigger: section,
        start: "top 45%",
        toggleActions: "play none none none",
      }
    });

    enterTl.from(title, { autoAlpha: 0, y: 30, duration: 1.6 });
    enterTl.from(icons, {
      autoAlpha: 0,
      scale: 0,
      duration: 1,
      ease: "back.out(1.7)",
      stagger: 0.12
    }, "-=0.7");

    const exitTl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "bottom 75%",   
        end: "bottom top",     
        scrub: true,         

      }
    });


    exitTl.to(icons, {
      yPercent: -1000,        
      autoAlpha: 1,
      ease: "none",
      stagger: 0.05        
    });


    exitTl.to(title, {
      autoAlpha: 0,
      ease: "none"
    }, "<");                   
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const cards = gsap.utils.toArray('[data-item-features]');
  if (!cards.length) {
    console.warn('[features] карточки [data-item-features] не найдены');
    return;
  }

  const total = cards.length;
  const MIN_SCALE = 0.85;
  const MAX_SCALE = 0.95; 

  cards.forEach((card, index) => {
  
    const targetScale = total === 1
      ? MAX_SCALE
      : gsap.utils.mapRange(0, total - 1, MIN_SCALE, MAX_SCALE, index);

    gsap.to(card, {
      scale: targetScale,
      ease: "none",
      scrollTrigger: {
        trigger: card,
        start: "top 55%",
        end: "top 25%",
        scrub: 1,
        invalidateOnRefresh: true,
        //markers: true,
      }
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {

  const list = document.querySelector("[data-list-flow]");
  if (!list) return;

  const items = gsap.utils.toArray("[data-flow-item]", list);
  const wrap  = list.parentElement;

  gsap.from(items, {
    autoAlpha: 0,
    x: 40,
    duration: 1,
    ease: "power2.out",
    stagger: 0.12,
    scrollTrigger: {
      trigger: list,
      start: "top 70%",
      once: true
    }
  });

  const mm = gsap.matchMedia();

  mm.add("(min-width: 479px)", () => {
    const hasInertia = typeof InertiaPlugin !== "undefined";
    if (hasInertia) gsap.registerPlugin(InertiaPlugin);

    function getBounds() {
      const overflow = Math.max(0, list.scrollWidth - wrap.clientWidth);
      return { minX: -overflow, maxX: 0 };
    }

    const draggable = Draggable.create(list, {
      type: "x",
      bounds: getBounds(),
      inertia: hasInertia,
      edgeResistance: 0.85,
      dragClickables: true,
      onDragStart: () => list.classList.add("is-grabbing"),
      onDragEnd:   () => list.classList.remove("is-grabbing")
    })[0];

    const onDown = () => list.classList.add("is-grabbing");
    const onUp   = () => list.classList.remove("is-grabbing");
    list.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    const onResize = () => draggable.applyBounds(getBounds());
    window.addEventListener("resize", onResize);

    return () => {
      draggable.kill();
      list.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      list.classList.remove("is-grabbing");
    };
  });
});

  document.addEventListener("DOMContentLoaded", () => {
  gsap.registerPlugin(ScrollTrigger);
  const section = document.querySelector('[data-section-app]');
  if (!section) return;
  const title   = section.querySelector('[data-title-item]');
  const circle  = section.querySelector('[data-img-circle]');
  const app     = section.querySelector('[data-img-app]');
  const content = section.querySelector('[data-app-content]');

  gsap.set([title, app], { autoAlpha: 0 });
  gsap.set(circle, { autoAlpha: 0, transformOrigin: "50% 50%" });

  const spin = gsap.to(circle, {
    rotation: "+=360",
    duration: 120,
    ease: "none",
    repeat: -1,
    paused: true
  });

  const tl = gsap.timeline({
    defaults: { duration: 0.6, ease: "power2.out" },
    scrollTrigger: {
      trigger: section,
      start: "top 70%",
      toggleActions: "play none none none"
    }
  });

  tl.to(content, { "--grad-top": "#4D4B53", duration: 1, ease: "power1.inOut" })
    .to(title, { autoAlpha: 1}, "-=0.5")
    .to(circle, {
      autoAlpha: 1,
      duration: 0.8,
      ease: "power2.out",
      onComplete: () => spin.play()
    }, "-=0.5")
    .to(app, { autoAlpha: 1, y: 0 }, "-=0.3")
   
});

document.addEventListener("DOMContentLoaded", function () {
  gsap.registerPlugin(ScrollTrigger);

  var field = document.getElementById("dotsField");
  if (!field) return;

  var ROWS   = 15;
  var SPEED  = 4500;
  var IDLE_MIN = .06, IDLE_MAX = .26;
  var ON_MAX   = 1.0;
  var EASE_DUR = 1.8;
  var STAGGER  = 1.6;

  var dots = [], figures = [], idx = 0, map = {};

  function pickCols() {
    var w = window.innerWidth;
    var cols = w < 480 ? 21 : w < 768 ? 31 : w < 1100 ? 41 : 51;
    if (cols % 2 === 0) cols += 1;
    return cols;
  }
  function makeFigures(CX, CY) {
    function build(fn){ var s={}; fn(function(dx,dy){ s[(CX+dx)+","+(CY+dy)]=1; }); return s; }
    var snowflake = build(function (p) {
      for (var i=2;i<=6;i++){ p(0,-i); p(0,i); p(-i,0); p(i,0); }
      for (var j=2;j<=4;j++){ p(-j,-j); p(j,-j); p(-j,j); p(j,j); }
    });
    var diamond = build(function (p){ var R=6; for(var dx=-R;dx<=R;dx++){ var dy=R-Math.abs(dx); p(dx,dy); p(dx,-dy);} });
    var circle  = build(function (p){ var R=6; for(var a=0;a<360;a+=8){ var t=a*Math.PI/180; p(Math.round(R*Math.cos(t)),Math.round(R*Math.sin(t))); } });
    var cross   = build(function (p){ var R=6; for(var i=-R;i<=R;i++){ p(0,i); p(i,0);} });
    return [snowflake, diamond, circle, cross];
  }
  function show(set) {
    var now = performance.now() / 1000;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var target = set[d.key] ? 1 : 0;
      if (target !== d.target) {
        d.target = target;
        d.start  = now + Math.random() * STAGGER;
      }
    }
  }

  // ---------- рендер одного кадра (вынесен, чтобы рисовать и в цикле, и статично) ----------
  function render(now) {
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (now >= d.start && d.a !== d.target) {
        var step = (now - (d.last || now)) / EASE_DUR;
        if (d.a < d.target) d.a = Math.min(d.target, d.a + step);
        else                d.a = Math.max(d.target, d.a - step);
      }
      d.last = now;
      var wob  = 0.5 + 0.5 * Math.sin(now * d.spd + d.ph);
      var idle = IDLE_MIN + (IDLE_MAX - IDLE_MIN) * wob;
      var onv  = ON_MAX - (ON_MAX - idle) * (1 - wob) * (1 - d.a);
      var op   = idle + (onv - idle) * d.a;
      d.el.style.opacity = op.toFixed(3);
      d.el.style.transform = "scale(" + (1 + 0.25 * d.a).toFixed(3) + ")";
    }
  }

  var rafId = null, cycleId = null, running = false;

  function loop(ts) {
    render(ts / 1000);
    if (running) rafId = requestAnimationFrame(loop);
  }

  function startAnim() {
    if (running || !dots.length) return;
    running = true;
    var t = performance.now() / 1000;         
    for (var i = 0; i < dots.length; i++) dots[i].last = t;
    rafId = requestAnimationFrame(loop);
    cycleId = setInterval(function () {
      idx = (idx + 1) % figures.length;
      show(figures[idx]);
    }, SPEED);
  }

  function stopAnim() {
    running = false;
    if (rafId)   cancelAnimationFrame(rafId);
    if (cycleId) clearInterval(cycleId);
    rafId = cycleId = null;
  }

  function buildField() {
    var COLS = pickCols();
    var CX = (COLS - 1) / 2, CY = (ROWS - 1) / 2;
    field.style.gridTemplateColumns = "repeat(" + COLS + ", 1fr)";
    field.style.gridTemplateRows    = "repeat(" + ROWS + ", 1fr)";
    field.innerHTML = ""; map = {}; dots = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var el = document.createElement("div");
      el.className = "dot";
      field.appendChild(el);
      var key = c + "," + r;
      var d = {
        el: el, key: key,
        ph: Math.random() * Math.PI * 2,
        spd: 0.6 + Math.random() * 0.9,
        a: 0, target: 0, start: 0, last: 0
      };
      dots.push(d); map[key] = d;
    }
    figures = makeFigures(CX, CY);
    show(figures[idx % figures.length]);
    render(performance.now() / 1000);          
  }

  buildField();

  ScrollTrigger.create({
    trigger: "[data-section-dot]",
    start: "top bottom",   
    end: "bottom top",     
    onToggle: function (self) { self.isActive ? startAnim() : stopAnim(); }
  });

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var wasRunning = running;
      stopAnim();
      buildField();
      ScrollTrigger.refresh();           
      if (wasRunning) startAnim();        
    }, 200);
  });
});

  const currentYear = new Date().getFullYear();
  document.querySelectorAll(".current-year").forEach(el => {
    el.textContent = currentYear;
  });

 document.addEventListener("DOMContentLoaded", (event) => {
  gsap.registerPlugin(Flip,ScrollTrigger,SplitText,ScrambleTextPlugin)
 });

  const lenis = new Lenis({
    duration: 1.8,
    lerp: 0.05,
    smoothWheel: true,
    smoothTouch: false
  });
  
  window.lenis = lenis;
  
  //lenis.stop();

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

     $("[data-lenis-start]").on("click", function () {
  lenis.start();
});
  
$("[data-lenis-stop]").on("click", function () {
  lenis.stop();
});

   $("[data-lenis-toggle]").on("click", function () {
  $(this).toggleClass("stop-scroll");
  if ($(this).hasClass("stop-scroll")) {
    lenis.stop();
  } else {
    lenis.start();
  }
});

  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.addEventListener("refresh", () => lenis.resize());
  ScrollTrigger.refresh();
