// Lobby sound: background music, sounds timed to the entrance animation, tap sounds,
// and a mute toggle. Uses <audio> elements so it also works when opened from disk.
(function () {
  var BASE = 'assets/sounds/';
  var MUSIC_VOLUME = 0.32;

  var muted = false;
  try { muted = localStorage.getItem('blot-muted') === '1'; } catch (e) {}

  var music = new Audio(BASE + 'lobby-music.mp3');
  music.loop = true;
  music.volume = 0;
  music.preload = 'auto';

  var cache = {};
  function sfx(name, volume) {
    if (muted) return;
    var base = cache[name] || (cache[name] = new Audio(BASE + name + '.mp3'));
    var a = base.cloneNode();
    a.volume = volume == null ? 0.8 : volume;
    a.play().catch(function () {});
  }
  ['whoosh', 'pop', 'coin', 'riser', 'click', 'play', 'shimmer'].forEach(function (n) {
    cache[n] = new Audio(BASE + n + '.mp3');
    cache[n].preload = 'auto';
  });

  // ---- music with fades
  var fadeTimer;
  function fadeMusic(to, ms, then) {
    clearInterval(fadeTimer);
    var from = music.volume, steps = Math.max(1, Math.round(ms / 30)), i = 0;
    fadeTimer = setInterval(function () {
      i++;
      music.volume = Math.max(0, Math.min(1, from + (to - from) * i / steps));
      if (i >= steps) { clearInterval(fadeTimer); if (then) then(); }
    }, 30);
  }
  var wantMusic = false;
  function startMusic() {
    wantMusic = true;
    if (muted) return;
    music.play().then(function () { fadeMusic(MUSIC_VOLUME, 1200); }).catch(function () {
      // Blocked until the first tap: try again then.
      document.addEventListener('pointerdown', function retry() {
        document.removeEventListener('pointerdown', retry);
        if (wantMusic && !muted) startMusic();
      });
    });
  }
  function stopMusic() {
    wantMusic = false;
    fadeMusic(0, 400, function () { music.pause(); });
  }

  // ---- entrance cues, matched to the CSS animation delays in lobby.css
  var timers = [];
  var CUES = [
    [150, 'whoosh', 0.55], [250, 'pop', 0.35], [330, 'pop', 0.35], [410, 'pop', 0.35],
    [450, 'pop', 0.3], [530, 'coin', 0.3], [610, 'coin', 0.3], [550, 'riser', 0.35],
    [500, 'click', 0.18], [560, 'click', 0.18], [620, 'click', 0.18], [680, 'click', 0.18],
    [740, 'click', 0.18], [700, 'pop', 0.5]
  ];
  function playEntrance() {
    timers.forEach(clearTimeout);
    timers = CUES.map(function (c) { return setTimeout(function () { sfx(c[1], c[2]); }, c[0]); });
    // soft chime with every third light sweep on PLAY NOW (sweep: 1.4s, then every 2.4s)
    var n = 0;
    timers.push(setTimeout(function tick() {
      if (n++ % 3 === 0) sfx('shimmer', 0.25);
      timers.push(setTimeout(tick, 2400));
    }, 1400 + 2400 * 0.2));
  }
  function stopEntrance() { timers.forEach(clearTimeout); timers = []; }

  document.addEventListener('screen:show', function (e) {
    if (e.detail === 'lobby') { startMusic(); playEntrance(); }
    else if (e.detail === 'play') {
      stopEntrance();
      startMusic();
      sfx('whoosh', 0.5);
      [200, 260, 320, 380, 440].forEach(function (t) { timers.push(setTimeout(function () { sfx('pop', 0.22); }, t)); });
      timers.push(setTimeout(function () { sfx('pop', 0.5); }, 480));
    }
    else { stopMusic(); stopEntrance(); }
  });

  // ---- tap sounds
  document.addEventListener('click', function (e) {
    var el = e.target.closest('button');
    if (!el || !el.closest('.lobby, .stsel')) return;
    if (el.matches('[data-play], [data-stage-play]')) sfx('play', 0.9);
    else if (el.matches('.st-card:not(.is-locked):not(.is-selected)')) sfx('whoosh', 0.4);
    else if (el.matches('.st-card.is-selected')) return;
    else sfx('click', 0.5);
  });

  // ---- mute toggle
  var btn = document.querySelector('[data-sound-toggle]');
  function render() {
    btn.setAttribute('aria-pressed', String(!muted));
    btn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    btn.classList.toggle('is-muted', muted);
  }
  btn.addEventListener('click', function () {
    muted = !muted;
    try { localStorage.setItem('blot-muted', muted ? '1' : '0'); } catch (e) {}
    if (muted) { fadeMusic(0, 250, function () { music.pause(); }); }
    else if (wantMusic) { startMusic(); }
    document.querySelectorAll('video').forEach(function (v) { v.muted = muted; });
    render();
  });
  render();

  window.BlotSound = { muted: function () { return muted; } };
})();
