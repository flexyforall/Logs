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
css/dial.css            the dial section
css/motion.css          text reveals, logo, loader, assistant bar, footer dots
js/site.js              Webflow's own scripts, in the order Webflow ran them
js/loader.js            the loader (home page)
js/hero.js              the hero: phone lines, orbiting activity bubbles
js/features.js          the four feature cards
js/flow.js              the three "Choose your flow" cards
js/widget.js            the live widget on the dial section's phone
js/text.js              text reveals
js/logo.js              the live logo mark
js/dots.js              the footer dot field
js/assistant.js         the assistant bar
js/vendor/              GSAP 3.15 + plugins, Lenis, jQuery, webflow.js
assets/                 fonts, images, icons, logos — see assets/README.md
tools/                  optional checks, not needed to run the site
```

## Where it came from

The layout and copy are the Webflow site as published; the dial section and
everything under "Motion" below were added here. The pages
keep Webflow's markup, class names and inline `<style>` embeds. The inline
`<script>` blocks moved into `js/site.js` in document order; the legal pages
ran a subset of them, and each block returns early when its section is missing.
Changes to Webflow's markup:

- **`data-wf-domain` dropped from `<html>`.** webflow.js shows the "Made in
  Webflow" badge whenever that names a `*.webflow.io` host other than the one
  serving the page.
- **Logo `<img>`s replaced with inline SVG**, so `logo.js` can reach the ticks.
- **`data-reveal` hooks** in place of Webflow's `data-split-*`.
- **The loader's markup** at the top of the home page's `<body>`.

## Motion

What moves, and where:

| Where | What | File |
| --- | --- | --- |
| first visit | the loader, see below | `loader.js` |
| everywhere | Lenis smooth scroll, driving ScrollTrigger | `site.js` |
| hero | the phone's line changes in three steps; the activity bubbles gather along the band | `hero.js` |
| nav | hides on scroll down, returns on scroll up | `site.js` |
| logos | the mark is a live clock, see below | `logo.js` |
| headings, copy | text reveals, see below | `text.js` |
| Make every second count | icons pop in; on the way out they fly up with the scroll; hovered, they tremble | `site.js`, `features.js` |
| features | the four cards stack; each shrinks to 0.85-0.95 as the next covers it | `site.js` |
| feature cards | each card's art moves, see below | `features.js` |
| Choose your flow | cards slide in; the row can be dragged with inertia (not below 479px) | `site.js` |
| flow cards | each card plays its own scene, see below | `flow.js` |
| **dial** | the Figma storyboard, pinned and scrubbed; see below | `site.js` |
| every page, bottom | the assistant bar, see below | `assistant.js` |
| footer | the dot field, see below | `dots.js` |
| footer links | letters roll up on hover | `site.js` |

The references these follow are in Figma, `Animations` (2317:16838), with a
note on each saying what to take from it.

**Loader** (after Nudot). On black, "LO" and "GS" blur into focus either side
of a tile that eases through five branding mockups: the logo set into four
photographed mockups from Figma (2325:18720), a hoodie, a wooden sign, a
bucket hat and a box, and debossed paper. The hoodie's and hat's old prints
are retouched out. Each one slowly pushes
in and the next sharpens out of a blur over it. Behind the tile the dial's hand
sweeps a full day, a dot-matrix counter runs 00.00 → 24.00h and
Tap. / Talk. / Time. take turns. Then the letters part to the edges and a
window opens from the centre, as one of the site's rounded cards. It plays on
every load, and waits for the page (at most 4.5s). `tools/mockups/mockups.html`
composites the scenes: the photos are in `tools/mockups/src/` (the hat's old
print retouched out), and the logo is set in with a four-corner perspective
transform. `node tools/mockups/render.mjs` renders them to
`assets/images/loader/`.

**Text** (after Oimachi). `data-reveal` on an element picks the motion:
`chars`, for headings, rises a character at a time from behind its line,
sharpening out of a blur; `lines` does the same per line, for short copy;
`words` lights a paragraph word by word, scrubbed with the scroll.
`data-reveal-wait` holds it until the loader has gone (the hero).

**Logo** (after Omosa). The mark is inline SVG. In the nav pill only the mark
shows; on hover the pill widens and "logs" slides in. Its 24 ticks are shaded like a
spinner, two arms fading from a bright head, and its hand leaves an orange trail
over the ticks behind it, as in the Figma mark. The hand turns once from the top
of the page to the bottom and does an extra lap on hover.

**Assistant bar** (after Hobbes). A dark-glass pill pinned to the bottom of
every page: the logo ticking in the corner and a placeholder that types the
questions people ask. It answers from what the site and privacy policy already
say. It's a fixed set of answers matched on keywords, with no AI behind it; to
change them, edit `ANSWERS` in `assistant.js`. Download opens the "Scan with
your phone" card from the Figma hero hover. It steps aside while the footer is
on screen. **`APP_STORE_URL` in `assistant.js` still needs the real listing**,
and the QR code from Figma (`assets/images/qr-app-store.svg`) encodes App Store
Connect's sign-in page, a placeholder, so it needs replacing too.

**Hero** (after the app's welcome animation). Figma's hero layers are
rebuilt as a stage (`assets/images/hero/`), so parts of it can move: the
phone's line changes in three steps, each rising in out of a blur. The
activity bubbles arrive along the middle of the band, in order: one, then
three that close up until they touch, then two more that do the same, then the
last. From then on they stream clockwise along the arc without a break. The
loop is only the visible arc, so one sinking out at the bottom right comes
straight back in at the bottom left. The phone screen is Figma's export
with its baked-in line removed, so the text can change.

**Feature cards.** Each card's art is rebuilt from Figma
(`assets/images/features/`) and runs while it's on screen:
- **Visual breakdown:** the needle browses the day and the dot-matrix total
  follows it. With a mouse, the needle follows the pointer.
- **Habits awareness:** the day's logs drift up one after another.
- **Google Sheets sync:** the sheet starts empty; pulses run in along the
  lines and charge it, then it glows, drains and starts again.
- **Custom activities:** a light wanders over the icons as if a cursor were
  there. With a mouse, it's your cursor.

**Dial section widget.** A live copy of the home-screen widget sits exactly
over the one in the phone photo. The needle sweeps the arc, lighting the ticks
behind it, while the dot-matrix total counts to 3.50h. Then "+" is tapped, a
"+30 min · Reading" toast appears, the total steps on to 4.00h, and the day
empties for the next loop.

**Flow cards.** Each is rebuilt from Figma (2292:12302,
`assets/images/flow/`):
- **AI voice logging:** the "Listening…" pill's dot waveform plays back like
  a voice message while the card is hovered (on touch, while it's in view).
- **Precision manual entry:** the phone rises into the card. A log is typed
  into the empty field (the screenshot's own text was retouched out), the tick
  is pressed, and a "Logged" toast drops in.
- **One tap live timer:** a live entry counts up with its dot pulsing, then
  stop is tapped, the tick lands, the entry saves, and the next one starts.

**Footer dots** (after Fourmula, from its source). Round dots across the
footer's content column, where Webflow had them. Figures (the logo's rays, a clock, a snowflake, a diamond)
alternate with a cloud that's dense in the middle, every dot flipping in two
hard steps in shuffled groups. The first time the field is seen, it draws
itself in clockwise from twelve. Near the cursor the dots shrink, down to a
quarter, 200px out.

Everything honours `prefers-reduced-motion`: no loader and no pin, text in
place, the footer holding one figure.

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
4. **The phone comes up** and the title moves up to make room. The
   storyboard's dial hands over to Webflow's own ring (ticks only, no rim,
   70.25rem), which turns slowly, once every two minutes. This is Webflow's
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
