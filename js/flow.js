// The "Choose your flow" cards, rebuilt from Figma (2292:12302) so they
// can move. Each is drawn at 560x640 and scaled to cover its card.
//
//   voice   the "Listening…" pill's dot waveform plays back like a voice
//           message while the card is hovered (on touch, while in view)
//   manual  the phone rises into the card; a log is typed into the empty
//           field and sent with the tick
//   timer   a live log counts up, the dot pulsing; then stop is tapped,
//           the tick lands and the entry is saved, and it starts again
(() => {
  const stages = [...document.querySelectorAll("[data-flow]")];
  if (!stages.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover)").matches;

  const fit = () => stages.forEach((s) => {
    const card = s.parentElement;
    s.style.setProperty("--flow-scale", Math.max(card.clientWidth / 560, card.clientHeight / 640).toFixed(4));
  });
  fit();
  addEventListener("resize", fit);

  const whileVisible = (el, on, off) =>
    new IntersectionObserver(([e]) => (e.isIntersecting ? on() : off()), { threshold: 0.35 }).observe(el);
  const byName = Object.fromEntries(stages.map((s) => [s.dataset.flow, s]));

  // ============================================================ voice
  (() => {
    const s = byName.voice;
    if (!s) return;
    const wave = s.querySelector("[data-fv-wave]");
    const dots = s.querySelector(".fv_ellipsis").children;
    const COLS = 40, ROWS = 9, MID = 4;
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = document.createElement("i");
      wave.appendChild(i);
      cells.push({ i, r, c, op: -1 });
    }
    // a still waveform, like the recording in the design
    const rest = Array.from({ length: COLS }, (_, c) =>
      Math.max(0, 1.2 + 1.6 * Math.sin(c * 0.9) * Math.sin(c * 0.23 + 1) + (c % 7 === 3 ? 1.6 : 0)));
    const amp = rest.slice();
    let head = -1; // the playhead, in columns; -1 when not playing
    const paint = () => {
      cells.forEach((d) => {
        const on = Math.abs(d.r - MID) <= amp[d.c];
        const played = head < 0 || d.c <= head;
        const op = on ? (played ? 1 : 0.55) : 0.15;
        if (op !== d.op) { d.op = op; d.i.style.opacity = op; }
      });
    };
    paint();
    if (reduce) return;

    // one loop: while playing, the columns follow a voice; after, they
    // ease back to the still waveform and the loop stops itself
    let t = 0, playing = false, running = false;
    const tick = () => {
      t += gsap.ticker.deltaRatio() / 60;
      head = playing ? (t * 12) % (COLS + 8) : -1;
      let still = true;
      for (let c = 0; c < COLS; c++) {
        let target = rest[c];
        if (playing) {
          // syllables that swell and fade, stronger near the playhead
          const syll = Math.max(0, Math.sin(t * 7 + c * 0.55) * Math.sin(t * 2.3 + c * 0.17));
          const near = Math.max(0, 1 - Math.abs(c - head) / 10);
          target = Math.min(4, 0.6 + syll * 2.6 + near * 1.8 * Math.abs(Math.sin(t * 11 + c)));
        }
        amp[c] += (target - amp[c]) * 0.3;
        if (Math.abs(target - amp[c]) > 0.02) still = false;
      }
      [...dots].forEach((d, k) => (d.style.opacity = !playing || Math.floor(t * 3) % 4 > k ? 1 : 0.2));
      paint();
      if (!playing && still) { running = false; gsap.ticker.remove(tick); }
    };
    const play = () => {
      playing = true;
      if (!running) { running = true; gsap.ticker.add(tick); }
    };
    const stop = () => { playing = false; };
    const card = s.closest(".s_flow_card") || s;
    if (canHover) {
      card.addEventListener("pointerenter", play);
      card.addEventListener("pointerleave", stop);
    } else {
      whileVisible(s, play, stop);
    }
  })();

  // =========================================================== manual
  (() => {
    const s = byName.manual;
    if (!s) return;
    const phone = s.querySelector("[data-fm-phone]");
    const text = s.querySelector("[data-fm-text]");
    const send = s.querySelector("[data-fm-send]");
    const toast = s.querySelector("[data-fm-toast]");
    const LOGS = ["Created marketing document", "Reviewed Q3 budget", "Call with design team"];
    if (reduce) { text.textContent = LOGS[0]; return; }

    gsap.set(phone, { y: 460 });
    let n = 0, risen = false, tl = null;
    const round = () => {
      const msg = LOGS[n++ % LOGS.length];
      const typed = { k: 0 };
      tl = gsap.timeline({ onComplete: () => (tl = gsap.delayedCall(1.2, round)) });
      tl.to(typed, {
        k: msg.length, duration: msg.length * 0.07, ease: "none",
        onUpdate: () => (text.textContent = msg.slice(0, Math.round(typed.k)))
      }, 0.5)
        // tap the tick
        .to(send, { scale: 0.86, duration: 0.12, ease: "power2.in" }, "+=0.5")
        .to(send, { scale: 1, duration: 0.4, ease: "back.out(3)" })
        // sent: the line lifts away, the toast drops in
        .to(text, { y: -14, opacity: 0, duration: 0.35, ease: "power2.in" }, "<-0.1")
        .add(() => { text.textContent = ""; gsap.set(text, { y: 0, opacity: 1 }); })
        .fromTo(toast, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.8)" }, "<")
        .to(toast, { y: -16, opacity: 0, duration: 0.35, ease: "power2.in" }, "+=1.4");
    };
    whileVisible(s, () => {
      if (!risen) {
        risen = true;
        gsap.to(phone, { y: 0, duration: 1.4, ease: "expo.out", onComplete: round });
      } else if (tl) tl.resume();
    }, () => tl && tl.pause());
  })();

  // ============================================================ timer
  (() => {
    const s = byName.timer;
    if (!s) return;
    const log = s.querySelector("[data-ft-log]");
    const time = s.querySelector("[data-ft-time]");
    const title = s.querySelector("[data-ft-title]");
    const btn = s.querySelector("[data-ft-btn]");
    const stopIcon = btn.querySelector(".ft_stop");
    const check = btn.querySelector(".ft_check");
    const photo = s.querySelector("[data-ft-photo]");
    const TASKS = ["Deep work session", "Design review", "Writing the brief"];
    const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
    if (reduce) { time.textContent = "02:55"; return; }

    // the photo drifts, slowly, as if the work goes on behind it
    gsap.to(photo, { scale: 1.08, xPercent: -2, duration: 14, ease: "sine.inOut", yoyo: true, repeat: -1 });

    let n = 0;
    const clock = { s: 0 };
    const tl = gsap.timeline({ paused: true, repeat: -1 });
    tl.add(() => {
      title.textContent = TASKS[n++ % TASKS.length];
      log.classList.remove("is-done");
      gsap.set(stopIcon, { opacity: 1, scale: 1 });
      gsap.set(check, { opacity: 0, scale: 0.5 });
    })
      .fromTo(log, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "expo.out" })
      // it runs: real seconds, a little quickened so the minutes show
      .fromTo(clock, { s: 0 }, { s: 175, duration: 5, ease: "none", onUpdate: () => (time.textContent = fmt(clock.s)) })
      // tap stop
      .to(btn, { scale: 0.86, duration: 0.12, ease: "power2.in" })
      .to(btn, { scale: 1, duration: 0.45, ease: "back.out(3)" })
      .to(stopIcon, { opacity: 0, scale: 0.5, duration: 0.2 }, "<")
      .to(check, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, "<0.1")
      .add(() => { log.classList.add("is-done"); time.textContent = `Saved · ${fmt(clock.s)}`; }, "<")
      .to(log, { y: -24, opacity: 0, duration: 0.5, ease: "power2.in" }, "+=1.6");
    whileVisible(s, () => tl.play(), () => tl.pause());
  })();
})();
