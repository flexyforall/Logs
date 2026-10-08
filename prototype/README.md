# Blot Bazar — clickable prototype

Plain HTML, CSS and JS, no build step. Open `index.html` in a browser.

- On a desktop the app sits in an iPhone frame (landscape, 852x393 points).
- On a phone held sideways it fills the screen.

## Flow

1. The splash plays straight away. Browsers block sound until the first tap, so it
   starts muted when needed and the sound comes on at the first tap. "Skip" jumps ahead.
2. Lobby (Figma: Blot / Lobby, node `1784:85`) with an entrance animation, background
   music, sounds timed to the animation and tap sounds. The settings gear replays the splash.
   The round button outside the phone frame turns sound on and off.

Sounds are synthesised by `tools/make_sounds.py` (no samples): run it to regenerate
`assets/sounds/`, or drop in real files with the same names.

## Layout

```
index.html                 screens: splash, lobby
css/app.css                device frame, screen switching, splash
css/lobby.css              lobby, positions and sizes taken from Figma
js/app.js                  frame scaling, splash playback, screen switching
js/sounds.js               lobby music, entrance and tap sounds, mute toggle
assets/splash/             splash video (MP4 + WebM fallback) and logo
assets/lobby/figma/        lobby assets exported from Figma (WebP sized @3x)
assets/lobby/              the original uploaded lobby assets
assets/fonts/              Poppins 600 and 800 italic
assets/sounds/             lobby music loop and UI sounds (MP3)
tools/make_sounds.py       synthesises assets/sounds/
```

`users-web.svg` and `clipboard-web.svg` are copies of the Figma exports with the
outermost filter removed: browsers draw that filter as a visible box, Figma does not.
The PLAY NOW button's decorative layer (`play-effects.webp`) is a Figma export of
its "effects" group, because the generated code placed those layers incorrectly.
