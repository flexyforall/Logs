// The assistant bar. After Hobbes: a pinned input at the bottom of every
// page that answers questions about the product, with the call to action
// beside it. Ours is the dark glass of the "Listening…" pill from the flow
// cards, with the logo ticking in it. It answers from what the site and the
// privacy policy already say — a fixed set of answers, no AI behind it — and
// Download opens the "Scan with your phone" card from the Figma hero hover.
(() => {
  // TODO: the App Store listing. The Figma QR code points at App Store
  // Connect's sign-in page, a placeholder; swap both when the listing is live.
  const APP_STORE_URL = "#download";
  const PRIVACY = "privacy-policy.html";

  const ANSWERS = [
    {
      q: "What is Logs?",
      keys: /what is|what's logs|about|explain|how does logs/,
      a: "Logs is a simple time tracker. Log any activity by tapping, speaking, or timing it — and see your whole day on one clear dial."
    },
    {
      q: "How does voice logging work?",
      keys: /voice|speak|talk|dictat|\bsay\b|\bai\b/,
      a: "Just talk: dictate your entire afternoon in one breath. AI voice logging is one of three ways in — the others are manual entry and a live timer."
    },
    {
      q: "Can I log time I forgot?",
      keys: /forgot|past|earlier|yesterday|manual|history|historical|add later/,
      a: "Yes. Precision manual entry logs historical activity and custom tasks in two taps."
    },
    {
      q: "Is there a timer?",
      keys: /timer|stopwatch|live|start|stop/,
      a: "One tap starts a real-time stopwatch as you work. Tap stop when you're done."
    },
    {
      q: "Does it sync to Google Sheets?",
      keys: /sheet|google|drive|export|spreadsheet|sync|excel/,
      a: "Yes — Logs syncs your entries to one private spreadsheet it creates in your Google Drive."
    },
    {
      q: "Is my data private?",
      keys: /privacy|private|data|secure|security|sell|ads|delete|safe/,
      a: `Logs doesn't sell your data, doesn't show ads, and uses your logs only to run the app. You can delete your account and everything in it from inside the app at any time. <a href="${PRIVACY}">Privacy Policy</a>`
    },
    {
      q: "What can I track?",
      keys: /track|what can|activit|work|hobb|study|categor|custom/,
      a: "Anything that fills your day — work, hobbies or study. Make custom activities for whatever you do."
    },
    {
      q: "How do I sign in?",
      keys: /sign|log ?in|account|apple id|email/,
      a: "With Sign in with Apple. Choose Hide My Email and Logs only ever sees a private relay address."
    },
    {
      q: "Where do I get it?",
      keys: /get|download|install|app store|iphone|ios|price|cost|free|buy/,
      a: `Logs is on the App Store — tap <b>Download</b> or scan the code with your phone.`
    }
  ];
  const FALLBACK = "I only know about Logs — how it tracks time, syncs and keeps your data private. Try one of these:";

  const ICON_SEND = '<svg viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_APPLE = '<svg viewBox="0 0 16 19" fill="currentColor"><path d="M13.3 10.1c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.6-3.8ZM10.9 3c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4Z"/></svg>';

  // the logo's rays, small, for the orb
  const orb = () => {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2, s = Math.sin(a), c = -Math.cos(a);
      return `<line x1="${12 + s * 5}" y1="${12 + c * 5}" x2="${12 + s * 10}" y2="${12 + c * 10}" data-i="${i}"/>`;
    }).join("");
    return `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round">${ticks}<line class="assist_orb_hand" x1="12" y1="12" x2="12" y2="4.5" stroke="#ff6600"/></svg>`;
  };

  const el = document.createElement("div");
  el.className = "assist";
  el.innerHTML = `
    <div class="assist_panel" role="dialog" aria-label="Ask Logs">
      <div class="assist_head"><span>Ask Logs</span><button class="assist_close" type="button" aria-label="Close">×</button></div>
      <div class="assist_log" aria-live="polite"></div>
      <div class="assist_chips"></div>
    </div>
    <div class="assist_qr" role="dialog" aria-label="Download Logs">
      <p>Scan with your phone</p>
      <img src="assets/images/qr-app-store.svg" alt="QR code for Logs on the App Store" width="188" height="188"/>
    </div>
    <form class="assist_bar">
      <span class="assist_orb" aria-hidden="true">${orb()}</span>
      <label class="assist_field"><span class="u-sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Ask a question about Logs</span>
        <input class="assist_input" type="text" autocomplete="off" enterkeyhint="send"/></label>
      <button class="assist_send" type="submit" aria-label="Ask">${ICON_SEND}</button>
      <a class="assist_download" href="${APP_STORE_URL}">${ICON_APPLE}<span>Download</span></a>
    </form>`;
  document.body.appendChild(el);

  const panel = el.querySelector(".assist_panel");
  const log = el.querySelector(".assist_log");
  const chips = el.querySelector(".assist_chips");
  const form = el.querySelector(".assist_bar");
  const input = el.querySelector(".assist_input");
  const qr = el.querySelector(".assist_qr");
  const download = el.querySelector(".assist_download");
  const orbTicks = [...el.querySelectorAll(".assist_orb line[data-i]")];
  const orbHand = el.querySelector(".assist_orb_hand");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover)").matches;

  // --- panel ---------------------------------------------------------------
  let open = false, greeted = false;
  const setOpen = (on) => {
    if (on === open) return;
    open = on;
    setQr(false);
    gsap.killTweensOf(panel);
    if (on) {
      gsap.fromTo(panel, { autoAlpha: 0, y: 16, scale: 0.97, filter: "blur(6px)" },
        { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: reduce ? 0 : 0.45, ease: "expo.out", transformOrigin: "50% 100%" });
      if (!greeted) {
        greeted = true;
        say("Hi — I'm here to help you get to know Logs. Ask me anything, or pick a question.");
        showChips(ANSWERS.slice(0, 5));
      }
    } else {
      gsap.to(panel, { autoAlpha: 0, y: 12, duration: reduce ? 0 : 0.25, ease: "power2.in" });
    }
  };
  el.querySelector(".assist_close").addEventListener("click", () => setOpen(false));
  input.addEventListener("focus", () => setOpen(true));
  document.addEventListener("pointerdown", (e) => {
    if (!el.contains(e.target)) { setOpen(false); setQr(false); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { setOpen(false); setQr(false); input.blur(); }
  });

  const bubble = (who, html) => {
    const m = document.createElement("div");
    m.className = `assist_msg is-${who}`;
    m.innerHTML = html;
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  };
  // replies come in word by word, like the site's text
  const say = (html) => {
    const m = bubble("bot", '<span class="assist_typing"><i></i><i></i><i></i></span>');
    setTimeout(() => {
      m.innerHTML = html;
      if (reduce) return;
      const words = SplitText.create(m, { type: "words" }).words;
      gsap.from(words, { opacity: 0, filter: "blur(6px)", y: 4, duration: 0.5, ease: "power2.out", stagger: 0.03 });
      log.scrollTop = log.scrollHeight;
    }, reduce ? 0 : 650);
  };
  const showChips = (list) => {
    chips.innerHTML = "";
    list.forEach((item) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "assist_chip";
      b.textContent = item.q;
      b.addEventListener("click", () => ask(item.q, item));
      chips.appendChild(b);
    });
    if (!reduce) gsap.from(chips.children, { opacity: 0, y: 8, duration: 0.4, stagger: 0.04, ease: "power2.out" });
  };
  const asked = new Set();
  const ask = (text, known) => {
    setOpen(true);
    bubble("user", text.replace(/</g, "&lt;"));
    const hit = known || ANSWERS.find((x) => x.keys.test(text.toLowerCase()));
    if (hit) {
      asked.add(hit);
      say(hit.a);
      showChips(ANSWERS.filter((x) => !asked.has(x)).slice(0, 4));
    } else {
      say(FALLBACK);
      showChips(ANSWERS.filter((x) => !asked.has(x)).slice(0, 4));
    }
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    input.value = "";
    ask(text);
  });

  // --- download: the QR card on a pointer device, the store link on a phone
  let qrOpen = false;
  function setQr(on) {
    if (on === qrOpen) return;
    qrOpen = on;
    gsap.killTweensOf(qr);
    gsap[on ? "fromTo" : "to"](qr, ...(on
      ? [{ autoAlpha: 0, y: 12, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.6)", transformOrigin: "85% 100%" }]
      : [{ autoAlpha: 0, y: 8, duration: 0.2 }]));
  }
  if (canHover) {
    download.addEventListener("mouseenter", () => { setOpen(false); setQr(true); });
    el.addEventListener("mouseleave", () => setQr(false));
    download.addEventListener("click", (e) => { if (APP_STORE_URL.startsWith("#")) e.preventDefault(); });
  }

  // --- the placeholder types the questions people ask -------------------
  const prompts = ANSWERS.map((x) => x.q);
  let pi = 0;
  const typeLoop = async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (;;) {
      const text = prompts[pi++ % prompts.length];
      for (let i = 1; i <= text.length; i++) {
        if (document.activeElement !== input) input.placeholder = text.slice(0, i);
        await wait(38);
      }
      await wait(1800);
      for (let i = text.length; i >= 0; i--) {
        if (document.activeElement !== input) input.placeholder = text.slice(0, i);
        await wait(16);
      }
      await wait(250);
    }
  };
  input.placeholder = "Ask about Logs…";
  input.addEventListener("focus", () => (input.placeholder = "Ask about Logs…"));
  if (!reduce) typeLoop();

  // --- the orb ticks like the logo while the page moves
  let spin = 0;
  const paintOrb = () => {
    const a = spin % 360;
    orbHand.setAttribute("transform", `rotate(${a} 12 12)`);
    orbTicks.forEach((t, i) => {
      const behind = (a - i * 30 + 720) % 360;
      t.setAttribute("stroke", behind < 90 ? `rgba(255,102,0,${(1 - behind / 90) * 0.9 + 0.1})` : `rgba(255,255,255,${0.25 + 0.5 * ((behind % 180) / 180)})`);
    });
  };
  paintOrb();
  if (!reduce) {
    let lastY = scrollY;
    addEventListener("scroll", () => { spin += (scrollY - lastY) * 0.4; lastY = scrollY; }, { passive: true });
    gsap.ticker.add(() => { spin += 0.25; paintOrb(); });
  }

  // --- in and out: after the loader; off the stage while the footer shows
  gsap.set(el, { yPercent: 160, autoAlpha: 0 });
  const bar = { hidden: true };
  const place = (hide) => {
    if (hide === bar.hidden) return;
    bar.hidden = hide;
    if (hide) { setOpen(false); setQr(false); }
    gsap.to(el, { yPercent: hide ? 160 : 0, autoAlpha: hide ? 0 : 1, duration: reduce ? 0 : 0.7, ease: hide ? "power3.in" : "expo.out" });
  };
  (window.logsReady || Promise.resolve()).then(() => {
    setTimeout(() => {
      const footer = document.querySelector("[data-section-dot]");
      let overFooter = false;
      if (footer) {
        new IntersectionObserver(([e]) => { overFooter = e.isIntersecting; place(overFooter); }, { threshold: 0.2 }).observe(footer);
      }
      place(overFooter);
    }, reduce ? 0 : 900);
  });
})();
