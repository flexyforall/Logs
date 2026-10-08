# Blot Bazar — clickable prototype

Plain HTML, CSS and JS, no build step. Open `index.html` in a browser.

- On a desktop the app sits in an iPhone frame (landscape, 852x393 points).
- On a phone held sideways it fills the screen.

## Flow

1. A "Tap to play prototype" screen comes first: the tap lets the browser play sound,
   then the splash plays with it. "Skip" jumps ahead. In the splash the logo appears at
   115% as the whirlpool closes and quickly shrinks to its size in step with it.
2. Lobby (Figma: Blot / Lobby, node `1784:85`) with an entrance animation, background
   music, sounds timed to the animation and tap sounds. The settings gear replays the splash.
   The round button outside the phone frame turns sound on and off.
3. PLAY NOW opens the stage select (Figma node `1856:1589`): tap Courtyard or Café to
   bring it to the centre (the cost updates); Mansion and Arena are locked. The arrow
   goes back to the lobby. The tabs are not wired up yet.
   Each open room has its own music (Backroom tense, Café cozy, Courtyard simple),
   crossfading as you switch rooms; the lobby track returns when you go back.
   The big play button plays an "into battle" sting (sword, taiko, choir, brass) with
   the room music ducked under it.
4. Then the game table opens: the fireside salon from the "Prototype" scene. The room fades
   in and the four players take their seats one by one (double speed). Then you play Blot to
   301 as the bottom seat with GarikAv (top, Don Marco) as your partner; HasmikG (left) and Vazgen1972 (right)
   are bots. Each round (js/game.js):
   - the dealer shuffles and deals 3-2-3 clockwise; the dealer moves on every round;
   - bidding starts after the dealer: bids show as chips next to the players, on your turn a
     panel lets you pick a value (8-25) and a suit or NT, Kaput, Pass, and Contra / Sur when
     they apply; four passes mean a redeal;
   - combinations are announced before the first trick (only the stronger side's count);
   - eight tricks: the nameplate of the player to act lights up; on your turn the cards you may not
     play are darkened, tap a card to play it. The last trick shows top left;
   - the round is scored by the rules and a summary shows the points; the score top right
     adds up until a team reaches 301 ("Play again" starts a new game).
   The HUD follows Figma (Mansion Table Example, node `1886:1866`): nicknames with rank badge
   and level in bold on plates with thin white top/bottom lines (each shows as that player sits
   down), a bid chip next to each bidder (only the contract stays after the bidding), last trick
   top left, score top right, and 40px buttons along the bottom: chat and reactions on the left,
   info on the right; all 24px from the screen edges. Everything except the nicknames comes in
   once the first hand has been dealt. Chat sends a quick phrase, reactions an emoji. The
   design has no settings button any more; Escape goes back to the stage select (prototype
   shortcut). Info does nothing yet.
   Fireplace crackle and card flicks are synthesised with Web Audio; the room music carries on.
   For testing, `BlotGame.autoplay = true` lets the bots play your seat too.

## Game rules

`js/blot-rules.js` is the Blot rules engine from `Blot_Rules_EN.pdf`, as plain functions on
`window.BlotRules` (no UI yet): deck and 3-2-3 deal clockwise from the dealer, card strength
(trumps J 9 A 10 K Q 8 7, plain A 10 K Q J 9 8 7), legal moves (follow suit, trump in unless
the partner is winning, beat a led trump), trick winner, card points (152 per deal, +10 for
the last trick, 250 for kaput), combinations (terz, 50, 100, four of a kind, blot-rebot) and
which team's combinations count, bidding, contra / sur and the round score.
`node tools/test_rules.js` checks it against the examples in the rules.

Decisions where the rules are open:
- the game is played to 301;
- the bidding team made its bid when it took at least what it declared (the PDF's "x > y"
  reads as a typo);
- card points are converted to game points by dividing by 10 and rounding normally (85 -> 9);
- the lowest bid is 8, a new bid must be higher than the current one; after a kaput bid only
  kaput bids may follow;
  kaput can be declared only with a bid above 25 and is made only by taking every card.
- after a contra the bidding ends, except that the bidding side gets one answer (sur or pass);
- blot-rebot is counted for the team holding trump K and Q from the deal.

## Layout

```
index.html                 screens: start, splash, lobby, stage select, table
css/app.css                device frame, screen switching, splash
css/lobby.css              lobby, positions and sizes taken from Figma
css/stage.css              stage select, positions and sizes taken from Figma
css/table.css              game table (a single canvas)
js/app.js                  frame scaling, splash playback, screen switching
js/sounds.js               lobby music, entrance and tap sounds, mute toggle
js/stage.js                stage select carousel and navigation
js/blot-rules.js           Blot rules engine (no DOM)
js/game.js                 the game: rounds, bidding, tricks, bots, scoring
js/table.js                game table: seating, shuffle, deal, idle moves, table sounds
assets/splash/             splash video (MP4 + WebM fallback) and logo
assets/lobby/figma/        lobby assets exported from Figma (WebP sized @3x)
assets/lobby/              the original uploaded lobby assets
assets/play/figma/         stage select assets (stage art from the uploads, WebP @3x)
assets/play/               the original uploaded stage select assets
assets/table/ui/           table HUD: panel backgrounds (rendered from the uploaded SVGs,
                           which stay as the originals), last-trick cards, gear
assets/table/              salon art (2000x923: room with empty chairs, full scene),
                           seat video loops (WebM + MP4, 960x540) and their masks
assets/table/cards/        the deck: 52 uploaded cards cut out of their background (lossless
                           RGBA PNG, 1060x1484); play/ has the 32 Blot cards at 300x420 for the game
assets/fonts/              Poppins 600 and 800 italic
assets/sounds/             lobby music loop and UI sounds (MP3)
tools/make_sounds.py       synthesises the lobby music and UI sounds
tools/make_room_music.py   synthesises one music loop per room
tools/test_rules.js        checks the rules engine (node)
tools/cut_cards.py         cuts the cards out of their background and makes the play/ copies
```

`users-web.svg` and `clipboard-web.svg` are copies of the Figma exports with the
outermost filter removed: browsers draw that filter as a visible box, Figma does not.
`bg-composite.webp` is the background flattened at 3x: the uploaded `bg.png`, Figma's
blurred glow ellipse (sigma 50) and its colour-blended `#87B5F5` tint, computed in float
with light dithering. The Figma SVG glow clipped its blur at the file edge, which showed
as dark bands above and below the cards.
The PLAY NOW button's decorative layer (`play-effects.webp`) is a Figma export of
its "effects" group, because the generated code placed those layers incorrectly.

`chat-web.svg` and `info-web.svg` are the Figma icons with their filters removed (the clipped drop shadow and
inner shadow rendered as a light square in browsers); the shadow is done in CSS instead.

The uploaded cards sit on a light background of almost the same colour as the card, so
`tools/cut_cards.py` does not key by colour: the alpha is the exact card shape (a rounded
rectangle along the card's thin outline, corner radius 40.25px, anti-aliased by signed
distance), and the colour pixels stay exactly as uploaded. The card back is still drawn in
code (there is no back image yet).
