// Lobby sound: background music, sounds timed to the entrance animation, tap sounds,
// and a mute toggle. Uses <audio> elements so it also works when opened from disk.
(function () {
  var BASE = 'assets/sounds/';
  var MUSIC_VOLUME = 0.32;
  var TABLE_VOLUME = 0.14;   // the room music stays on under the fireplace at the table

  var muted = false;
  try { muted = localStorage.getItem('blot-muted') === '1'; } catch (e) {}

  // One looping track per place; switching crossfades between them.
  var TRACKS = { lobby: 'lobby-music', backroom: 'room-backroom', cafe: 'room-cafe', courtyard: 'room-courtyard' };
  var players = {};
  Object.keys(TRACKS).forEach(function (k) {
    var a = new Audio(BASE + TRACKS[k] + '.mp3');
    a.loop = true;
    a.volume = 0;
    a.preload = k === 'lobby' ? 'auto' : 'metadata';
    players[k] = a;
  });
  var current = null;     // key of the track that should be playing

  var cache = {};
  function sfx(name, volume) {
    if (muted) return;
    var base = cache[name] || (cache[name] = new Audio(BASE + name + '.mp3'));
    var a = base.cloneNode();
    a.volume = volume == null ? 0.8 : volume;
    a.play().catch(function () {});
  }
  ['whoosh', 'pop', 'coin', 'riser', 'click', 'play', 'shimmer', 'battle'].forEach(function (n) {
    cache[n] = new Audio(BASE + n + '.mp3');
    cache[n].preload = 'auto';
  });

  // ---- music with crossfades
  var fades = {};
  function fade(a, to, ms, then) {
    var key = a.src;
    clearInterval(fades[key]);
    var from = a.volume, steps = Math.max(1, Math.round(ms / 30)), i = 0;
    fades[key] = setInterval(function () {
      i++;
      a.volume = Math.max(0, Math.min(1, from + (to - from) * i / steps));
      if (i >= steps) { clearInterval(fades[key]); if (then) then(); }
    }, 30);
  }
  function playTrack(key) {
    var prev = current;
    current = key;
    Object.keys(players).forEach(function (k) {
      if (k !== key && !players[k].paused) fade(players[k], 0, 900, function () { if (current !== k) players[k].pause(); });
    });
    if (muted || !key) return;
    var a = players[key];
    if (prev !== key && key !== 'lobby') a.currentTime = 0;
    a.play().then(function () { fade(a, musicVolume(), 1200); }).catch(function () {
      // Blocked until the first tap: try again then.
      document.addEventListener('pointerdown', function retry() {
        document.removeEventListener('pointerdown', retry);
        if (current === key && !muted) playTrack(key);
      });
    });
  }
  function stopMusic() { playTrack(null); }

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

  function musicVolume() {
    return document.querySelector('[data-screen-id="table"].is-active') ? TABLE_VOLUME : MUSIC_VOLUME;
  }

  function roomTrack() {
    var id = window.BlotStage && window.BlotStage.current();
    return TRACKS[id] ? id : 'lobby';
  }

  // the stage select plays the music of the selected room
  document.addEventListener('stage:select', function (e) {
    if (document.querySelector('[data-screen-id="play"].is-active')) playTrack(TRACKS[e.detail] ? e.detail : 'lobby');
  });

  document.addEventListener('screen:show', function (e) {
    if (e.detail === 'lobby') { playTrack('lobby'); playEntrance(); }
    else if (e.detail === 'play') {
      stopEntrance();
      playTrack(roomTrack());
      sfx('whoosh', 0.5);
      [200, 260, 320, 380, 440].forEach(function (t) { timers.push(setTimeout(function () { sfx('pop', 0.22); }, t)); });
      timers.push(setTimeout(function () { sfx('pop', 0.5); }, 480));
    }
    else if (e.detail === 'table') { stopEntrance(); if (current && players[current]) fade(players[current], musicVolume(), 1500); }
    else { stopMusic(); stopEntrance(); }
  });

  // "into battle": the room music ducks under it, then comes back
  function battle() {
    if (muted) return;
    sfx('battle', 1);
    var a = current && players[current];
    if (!a) return;
    fade(a, 0.06, 250, function () {
      setTimeout(function () { if (players[current] === a) fade(a, musicVolume(), 1500); }, 3200);
    });
  }

  // ---- tap sounds
  document.addEventListener('click', function (e) {
    var el = e.target.closest('button');
    if (!el || !el.closest('.lobby, .stsel, .table')) return;
    if (el.matches('[data-stage-play]')) { battle(); return; }
    if (el.matches('[data-play]')) sfx('play', 0.9);
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
    if (muted) { Object.keys(players).forEach(function (k) { fade(players[k], 0, 250, function () { players[k].pause(); }); }); }
    else if (current) { playTrack(current); }
    document.querySelectorAll('[data-splash-video]').forEach(function (v) { v.muted = muted; });
    document.dispatchEvent(new CustomEvent('sound:mute', { detail: muted }));
    render();
  });
  render();

  window.BlotSound = { muted: function () { return muted; } };
})();
