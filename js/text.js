// Text reveals, after Oimachi: headings rise into place a character at a
// time from behind their line, sharpening out of a blur; long copy lights up
// word by word as it is scrolled through, the way the dial section reads.
//
//   data-reveal="chars"   headings — per character, once, on entering view
//   data-reveal="lines"   short copy — per line, same motion, lighter
//   data-reveal="words"   paragraphs — per word, scrubbed with the scroll
//   data-reveal-wait      hold until the loader has gone (the hero)
document.addEventListener("DOMContentLoaded", () => {
  const els = gsap.utils.toArray("[data-reveal]");
  if (!els.length) return;

  const show = (el) => gsap.set(el, { visibility: "visible" });
  const ready = window.logsReady || Promise.resolve();

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.forEach(show);
    return;
  }

  document.fonts.ready.then(() => {
    els.forEach((el) => {
      const mode = el.dataset.reveal;

      if (mode === "words") {
        SplitText.create(el, {
          type: "words",
          wordsClass: "rv-word",
          autoSplit: true,
          onSplit: (self) =>
            gsap.fromTo(self.words, { opacity: 0.14 }, {
              opacity: 1,
              ease: "none",
              stagger: 0.1,
              scrollTrigger: { trigger: el, start: "top 88%", end: "bottom 50%", scrub: 0.6 }
            })
        });
        return;
      }

      const chars = mode === "chars";
      const play = (self) => {
        const targets = chars ? self.chars : self.lines;
        show(el);
        const tween = gsap.from(targets, {
          yPercent: chars ? 115 : 105,
          rotate: chars ? 7 : 2,
          opacity: 0,
          filter: "blur(10px)",
          transformOrigin: "0% 100%",
          duration: chars ? 1.15 : 1,
          ease: "expo.out",
          stagger: chars ? { each: 0.016, from: "start" } : 0.09,
          paused: true,
          clearProps: "filter"
        });
        if (el.hasAttribute("data-reveal-wait")) {
          ready.then(() => tween.play());
        } else {
          ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: () => tween.play() });
        }
        return tween;
      };

      SplitText.create(el, {
        type: chars ? "lines,words,chars" : "lines",
        mask: "lines",
        linesClass: "rv-line",
        wordsClass: "rv-word",
        charsClass: "rv-char",
        autoSplit: true,
        onSplit: play
      });
    });
  });
});
