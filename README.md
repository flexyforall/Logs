# Logs

Landing page for Logs, the time tracker. A static copy of
[logs-flexy.webflow.io](https://logs-flexy.webflow.io/) plus the dial section
from the Figma storyboard. Plain HTML, CSS and JS: no build step, no install.

## Viewing it

Double-click `index.html`. Everything it needs is in the repo, so it works
offline and from disk.

## Layout

```
index.html              the landing page
privacy-policy.html     the two legal pages, as on Webflow
terms-of-service.html
css/webflow.css         Webflow's stylesheet, as published (paths made local)
css/dial.css            the dial section, the one part not from Webflow
js/site.js              every script the pages run, in the order Webflow ran them
js/vendor/              GSAP 3.15 + plugins, Lenis, jQuery, webflow.js
assets/                 fonts, images, icons, logos — see assets/README.md
tools/                  optional checks, not needed to run the site
```

## Where it came from

Everything but the dial section is the Webflow site as published. The pages
keep Webflow's markup, class names and inline `<style>` embeds. The inline
`<script>` blocks moved into `js/site.js` in document order; the legal pages
ran a subset of them, and each block returns early when its section is missing.
The only change to the markup is dropping `data-wf-domain` from `<html>`:
webflow.js shows the "Made in Webflow" badge whenever that names a
`*.webflow.io` host other than the one serving the page.

What moves, and where (all in `js/site.js`):

| Where | What |
| --- | --- |
| everywhere | Lenis smooth scroll, driving ScrollTrigger |
| nav | hides on scroll down, returns on scroll up |
| hero, flow | titles and descriptions rise in line by line (SplitText) |
| Make every second count | title fades up, icons pop in; on the way out the icons fly up with the scroll |
| features | the four cards stack; each shrinks to 0.85-0.95 as the next covers it |
| Choose your flow | cards slide in; the row can be dragged with inertia (not below 479px) |
| **dial** | the Figma storyboard, pinned and scrubbed; see below |
| footer | 51x15 dot field cycling snowflake, diamond, circle, cross every 4.5s |
| footer links | letters roll up on hover |

## The dial section

Figma `Desktop 2.0` (2292:9481), storyboard frames `2292:15522` → `15602` →
`15590` → `15530`. It takes the place of Webflow's "Track time with elegance"
section, whose layout is the storyboard's last frame, so that frame reuses
Webflow's `s_app_*` classes and phone image unchanged. Every earlier frame is
built as an offset from it.

The section pins for 3.5 screens and one scrubbed timeline plays through:

1. **Light card.** The hand sweeps and "You've been busy all day. So why do you
   have nothing to show for it?" lights word by word.
2. **Half dark.** The line turns over to "It doesn't have to be this way. Meet
   Logs.", white, lit the same way.
3. **Dark.** The dial opens from 872 to 1212px and "Less Noise. More Progress."
   arrives in the middle.
4. **The phone comes up** and the title moves up to make room. This is Webflow's
   layout.

One dial turns clockwise through all four frames. The wedge, the rim and the
hand carry the same rotation in every Figma frame (158deg, 0, 60deg), so they
turn as one group. Unrotated, the hand points at 336deg. The tick ring is the
Figma export. The rest is CSS, because Figma draws it with gradients too:

- **the wedge:** a conic gradient, transparent at 128deg up to 25% white at
  336deg, measured off the export;
- **the rim:** a 3.33px ring, white at the hand and fading anticlockwise;
- **the hand:** white out to the rim, then an orange tail.

With `prefers-reduced-motion` there is no pin: the section shows its last frame.
