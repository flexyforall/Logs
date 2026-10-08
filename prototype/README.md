# Blot Bazar — clickable prototype

Plain HTML, CSS and JS, no build step. Open `index.html` in a browser.

- On a desktop the app sits in an iPhone frame (landscape, 852x393 points).
- On a phone held sideways it fills the screen.

## Flow

1. Tap to start (browsers only allow sound after a tap).
2. Splash video plays; "Пропустить" skips it.
3. Lobby (Figma: Blot / Lobby, node `1784:85`). The settings gear replays the splash.

## Layout

```
index.html                 screens: splash, lobby
css/app.css                device frame, screen switching, splash
css/lobby.css              lobby, positions and sizes taken from Figma
js/app.js                  frame scaling, splash playback, screen switching
assets/splash/             splash video (MP4 + WebM fallback) and logo
assets/lobby/figma/        lobby assets exported from Figma (WebP sized @3x)
assets/lobby/              the original uploaded lobby assets
assets/fonts/              Poppins 600 and 800 italic
```

`users-web.svg` and `clipboard-web.svg` are copies of the Figma exports with the
outermost filter removed: browsers draw that filter as a visible box, Figma does not.
The PLAY NOW button's decorative layer (`play-effects.webp`) is a Figma export of
its "effects" group, because the generated code placed those layers incorrectly.
