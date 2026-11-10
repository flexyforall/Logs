# Logs — animated landing (Awwwards build)

A static, hand-built port of the Figma file **Logs** (page "Work", frame "Desktop 1440px"),
animated end to end. Plain HTML, CSS and JS: no build step, no dependencies, no frameworks.

Desktop only for now: the layout is fixed at 1440px.

## Viewing it

Serve the folder over HTTP (the web fonts and SVG masks don't load from `file://` in every browser):

```
cd awwwards
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

```
index.html     markup, one section per Figma block
styles.css     layout, typography system, motion styles
anim.js        all motion and interaction, one IIFE per piece
assets/        images and icons exported from Figma
assets/fonts/  Inter and Inter Display (OFL), subset to Latin, woff2
```

## What's animated

| Section | Motion |
|---|---|
| Hero | short branded loader (the logo dial fills), dial wakes up, hand sweeps and pops the activity icons, phone rises, copy springs in. Pointer parallax afterwards. |
| Nav | appears after the hero. The real Logs mark is the page clock: its hand and warm sweep follow scroll, and the time reads 06:00 → 23:55 down the page. |
| Statement | icon cards fall with physics, bounce on hover, drop through the floor on scroll. |
| Breakdown | pinned card stack. Card 1 is a real **interactive timeline**: drag the hand (or use the keyboard) and the hours count, logged ticks light up and more activities appear, as in the app's "Gradient moving" spec. Card 2 scrolls the log feed, card 3 draws the Sheets lines with breathing squares, card 4 has a diagonal shimmer and a cursor light. Pixel icons assemble per card. |
| Choose your flow | title grows, cards grow then fly away in 3D. Voice card has a live dot-matrix voice meter, manual card types real entries, timer card counts up. |
| Less Noise | scroll story inside a sticky pin. |
| Footer | pixel grid morphs ring → plus → asterisk → diamond and leaves a trail under the cursor. |

Text everywhere springs in; card titles rise word by word from a mask.

## Accessibility and performance

- Respects `prefers-reduced-motion`: decorative loops stop, smooth scroll is off.
- Visible focus states. The timeline is a keyboard slider (arrows, PageUp/PageDown, Home/End) with `aria-valuetext`.
- The real cursor is never hidden.
- Images below the fold load lazily; hero images are high priority; the two first-screen fonts are preloaded.
- Loops run only while their section is on screen.

## Fonts

The design uses Nimbus Sans Novus D, which is commercial and not included. Inter / Inter Display
(SIL Open Font License) stand in, with tracking and line-heights retuned for them. To switch to the
real font, add its woff2 files to `assets/fonts/` and change `--font` and `--font-display` in `styles.css`.
