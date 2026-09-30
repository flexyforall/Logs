# Assets

Drop everything exported from Figma in here. One folder per asset type.

| Folder | What goes in it | Preferred format |
| --- | --- | --- |
| `images/` | Photos, illustrations, background images, hero art | `.webp` (or `.jpg`/`.png` if transparency/quality needs it) |
| `icons/` | UI icons, small glyphs, arrows, social icons | `.svg` |
| `logos/` | Brand marks, wordmarks, favicon source | `.svg` (plus a 512px `.png` fallback) |
| `fonts/` | Custom/licensed typefaces used in the design | `.woff2` (add `.woff` only if you need old-browser support) |
| `videos/` | Background loops, product demos | `.mp4` (H.264) + `.webm` |
| `exports/` | Full-page Figma screenshots / reference PNGs of each screen | `.png` |

## Naming

Use lowercase kebab-case, no spaces:

```
hero-background.webp
icon-arrow-right.svg
logo-logs-dark.svg
about-page-desktop.png
```

For images that need multiple densities, suffix with the scale:

```
team-photo@1x.webp
team-photo@2x.webp
```

## Export settings from Figma

- **Icons / logos** → SVG, "Include id attribute" off, outline strokes on
- **Photos** → WebP or JPG at 2x, quality ~80
- **Screens for reference** (`exports/`) → PNG at 1x, one file per page/breakpoint

## Size limits

GitHub rejects single files over 100 MB and warns above 50 MB. Keep individual
assets under ~5 MB where possible — compress large photos before uploading. If a
video is bigger than that, tell me and we'll host it externally instead of
committing it.

## What's here now

Everything except `images/dial-ticks.png` came off Webflow's CDN with the site.
The names are Webflow's with the upload hash stripped. Files that shared a name
there were given one that says what they are (`logo-nav.svg`,
`logo-footer.svg`, `favicon-32.png`, `webclip-180.png`…). The `-p-500` …
`-p-3200` siblings of each photo are Webflow's responsive sizes. The pages list
them in `srcset`, so keep them together.

| File | Where | Source |
| --- | --- | --- |
| `fonts/nimbus-sans-novus_*.woff2`, `nimbussannovd-sembol.woff2` | everywhere (400/500/600) | Webflow |
| `images/hero/` | the hero stage: phone, hand, band, dial, bubbles | Figma `2292:9485`, `2292:10057` |
| `images/loader/` | the loader's branding mockups | drawn in `tools/mockups` |
| `images/features/` | the feature cards' art | Figma `2292:10629`, `15105`, `15129`, `15324` |
| `icons/dog.svg`, `gamecontroller-fill.svg`, `window-dev-edit.svg` | Make every second count | Webflow |
| `images/ai-voice-logging*`, `precision-manual-entry*`, `one-tap-live-timer.avif` | Choose your flow | Webflow |
| `images/track-time-with-elegance.avif` | the phone in the dial section's last frame | Webflow |
| `images/dial-ticks.png` | the dial's tick ring | Figma `2292:15596` (Ellipse 2), 2424px |
| `images/bg.svg`, `icons/dots.svg` | referenced by the Webflow stylesheet | Webflow |

Webflow's `circle.avif` (the slowly spinning ring in its "Track time with
elegance" section) is gone with that section. The dial draws its own ring.
