// Game table: the fireside salon from the "Prototype" scene. The four players take their seats
// one by one, then js/game.js runs the game through the `view` API below (deal, play a card,
// take a trick...). Opened by the Play button on the stage select.
// Everything is drawn on one canvas in scene coordinates of the 2000x923 art.
(function () {
  var A = 'assets/table/';
  var W = 2000, H = 923;
  var screen = document.querySelector('[data-screen-id="table"]');
  var cv = screen.querySelector('canvas'), ctx = cv.getContext('2d');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // fixed 2x backing store of the 852x393 screen; the device frame is scaled with CSS
  cv.width = 1704; cv.height = 786;

  // ---------- Seats (scene coordinates) ----------
  // Teams: bottom + top vs left + right.
  // parts: body pieces cut from the art that move on their own (rect + pivot), used until the seat's video loads.
  var SEATS = {
    bottom: { crop: [770, 725, 460, 198], pivot: [1000, 923], face: [1000, 860, 70],
              pile: [1000, 668], pileRot: 0, greet: 'bow',
              parts: { helm: { r: [925, 790, 150, 133], p: [1000, 905] }, hands: { r: [930, 735, 140, 62], p: [1000, 790] } },
              acts: ['lookAround', 'drum', 'stretch'],
              video: { src: ['knight.webm', 'knight.mp4'], rect: [680, 563, 640, 360] } },
    left:   { crop: [130, 355, 380, 360], pivot: [330, 640], face: [300, 445, 66],
              pile: [572, 525], pileRot: Math.PI / 2, greet: 'lean',
              parts: { head: { r: [200, 362, 195, 165], p: [355, 525] }, hands: { r: [410, 488, 80, 100], p: [400, 540] } },
              acts: ['tilt', 'tap', 'glance'],
              video: { src: ['laura.webm', 'laura.mp4'], rect: [0, 345, 676, 380] } },
    top:    { crop: [790, 15, 410, 290], pivot: [995, 300], face: [965, 100, 56],
              pile: [1000, 350], pileRot: Math.PI, greet: 'nod',
              parts: { head: { r: [935, 8, 130, 155], p: [995, 165] }, cigar: { r: [875, 120, 125, 100], p: [890, 215] }, claw: { r: [980, 250, 100, 58], p: [1030, 300] } },
              acts: ['puff', 'puff', 'claw'],
              video: { src: ['marco.webm', 'marco.mp4'], rect: [675, 0, 640, 360] } },
    right:  { crop: [1525, 325, 420, 410], pivot: [1720, 650], face: [1790, 452, 85],
              pile: [1428, 525], pileRot: -Math.PI / 2, greet: 'tip',
              parts: { hat: { r: [1690, 335, 205, 160], p: [1795, 445] }, hands: { r: [1540, 520, 100, 105], p: [1600, 600] } },
              acts: ['scratch', 'hat', 'scratch', 'lean'],
              video: { src: ['billy.webm', 'billy.mp4'], rect: [1289, 330, 711, 400] } }
  };
  var IDS = Object.keys(SEATS);
  var JOIN_ORDER = ['bottom', 'left', 'top', 'right'];
  var CIGAR_TIP = [957, 180], MOUTH = [990, 147], CYBER_EYE = [1010, 100];

  // Seat videos (short AI loops), drawn through a soft silhouette mask so they blend into the empty room.
  IDS.forEach(function (id) {
    var s = SEATS[id], v = document.createElement('video');
    v.muted = true; v.loop = false; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
    v.addEventListener('ended', function () { s.moving = false; try { v.currentTime = 0; } catch (e) {} });
    var webm = v.canPlayType('video/webm; codecs="vp9"');
    v.src = A + (webm ? s.video.src[0] : s.video.src[1]);
    v.addEventListener('canplay', function () { s.vidReady = true; }, { once: true });
    s.vid = v;
    s.vidCanvas = document.createElement('canvas');
    s.vidCanvas.width = s.video.rect[2]; s.vidCanvas.height = s.video.rect[3];
    s.vidMask = new Image(); s.vidMask.src = A + 'mask_' + id2name(id) + '.png';
  });
  function id2name(id) { return SEATS[id].video.src[0].split('.')[0]; }

  // ---------- Assets ----------
  var img = new Image(); img.src = A + 'scene.webp';    // characters are cut from this
  var room = new Image(); room.src = A + 'room.webp';   // the same room with empty chairs
  var cardBack, cardFaces = {};

  function feathered(r, core) {
    core = core == null ? .68 : core;
    var cw = r[2], ch = r[3];
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var g = c.getContext('2d');
    g.drawImage(img, r[0], r[1], cw, ch, 0, 0, cw, ch);
    g.globalCompositeOperation = 'destination-in';
    g.translate(cw / 2, ch / 2); g.scale(cw / 2, ch / 2);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, '#000'); gr.addColorStop(core, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(-1, -1, 2, 2);
    return c;
  }

  // ---------- Cards ----------
  // The deck: one transparent PNG per card in assets/table/cards/play/ (cut by tools/cut_cards.py),
  // 300x420, so a card is 78 x 109.2 scene units.
  var CW = 78, CH = 109.2, RES = 3, PAD = 10, CR = 3;   // CR: corner radius, as on the card art
  var RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var SUITS = [{ s: '♠', l: 'S' }, { s: '♥', l: 'H' }, { s: '♣', l: 'C' }, { s: '♦', l: 'D' }];
  var faceArt = {};
  SUITS.forEach(function (su) {
    RANKS.forEach(function (r) { var im = new Image(); im.src = A + 'cards/play/' + r + su.l + '.png'; faceArt[r + su.s] = im; });
  });
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function cardCanvas(paint) {
    var c = document.createElement('canvas');
    c.width = (CW + PAD * 2) * RES; c.height = (CH + PAD * 2) * RES;
    var g = c.getContext('2d'); g.scale(RES, RES); g.translate(PAD, PAD);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
    rr(g, 0, 0, CW, CH, CR); g.fillStyle = '#f6ecdc'; g.fill();
    g.shadowColor = 'transparent';
    g.save(); rr(g, 0, 0, CW, CH, CR); g.clip(); paint(g); g.restore();
    rr(g, 0, 0, CW, CH, CR); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = .5; g.stroke();
    return c;
  }
  // A face is the card art itself; its drop shadow follows the art's own rounded shape.
  function makeFace(rank, suit) {
    var c = document.createElement('canvas');
    c.width = (CW + PAD * 2) * RES; c.height = (CH + PAD * 2) * RES;
    var g = c.getContext('2d'); g.scale(RES, RES); g.translate(PAD, PAD);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
    g.imageSmoothingQuality = 'high';
    g.drawImage(faceArt[rank + suit.s], 0, 0, CW, CH);
    return c;
  }
  // Red back in the classic "rider" spirit: white border, fine red filigree field, central medallion.
  function makeBack() {
    return cardCanvas(function (g) {
      var m = 4.5, red = '#b5121f', x, y, i;
      g.fillStyle = red; rr(g, m, m, CW - m * 2, CH - m * 2, 2.5); g.fill();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(255,240,235,.75)'; g.lineWidth = .35;
      for (y = m + 3; y < CH; y += 6) for (x = m + 3; x < CW; x += 6) {
        g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3); g.stroke();
      }
      g.restore();
      g.strokeStyle = '#fdfbf6'; g.lineWidth = 1; rr(g, m + 2, m + 2, CW - m * 2 - 4, CH - m * 2 - 4, 2); g.stroke();
      g.save(); g.translate(CW / 2, CH / 2);
      g.fillStyle = red; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fdfbf6'; g.lineWidth = 1.1; g.stroke();
      for (i = 0; i < 12; i++) {
        g.rotate(Math.PI / 6);
        g.beginPath(); g.ellipse(0, -8, 2.2, 5, 0, 0, Math.PI * 2); g.lineWidth = .5; g.stroke();
      }
      g.beginPath(); g.arc(0, 0, 3, 0, Math.PI * 2); g.fillStyle = '#fdfbf6'; g.fill();
      g.restore();
      [[m + 9, m + 9], [CW - m - 9, m + 9], [m + 9, CH - m - 9], [CW - m - 9, CH - m - 9]].forEach(function (p) {
        g.beginPath(); g.arc(p[0], p[1], 4, 0, Math.PI * 2); g.strokeStyle = '#fdfbf6'; g.lineWidth = .7; g.stroke();
      });
    });
  }
  function Card(rank, suit) {
    this.rank = rank; this.suit = suit;
    this.x = 0; this.y = 0; this.rot = 0; this.sc = .7; this.flip = 0; this.alpha = 0; this.z = 0; this.lift = 0;
    this.dim = 0; this.base = 0;   // dim: darkened (not playable now); base: resting lift
  }
  Card.prototype.draw = function () {
    var im = this.flip > .5 ? cardFaces[this.rank + this.suit.s] : cardBack;
    var sx = Math.abs(Math.cos(this.flip * Math.PI)) || .001;
    ctx.save(); ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.translate(0, -this.lift);
    ctx.scale(this.sc * sx, this.sc);
    ctx.drawImage(im, -(CW / 2 + PAD), -(CH / 2 + PAD), CW + PAD * 2, CH + PAD * 2);
    if (this.dim > 0) { rr(ctx, -CW / 2, -CH / 2, CW, CH, 5); ctx.fillStyle = 'rgba(0,0,0,' + .5 * this.dim + ')'; ctx.fill(); }
    ctx.restore();
  };

  // ---------- Tweens ----------
  // Everything scripted (seating, shuffle, deal) runs at double speed.
  var SPEED = 2;
  var run = 0, tweens = [];
  var ease = {
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOut: function (p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    lin: function (p) { return p; }
  };
  function tween(o, to, dur, opt) {
    opt = opt || {};
    return new Promise(function (res) {
      tweens.push({ o: o, to: to, dur: dur * 1000, delay: (opt.delay || 0) * 1000, t: 0, e: opt.ease || ease.out, res: res, from: null, fn: opt.fn });
    });
  }
  function wait(s) { return tween({}, {}, s); }
  function anim(dur, fn) { return tween({}, {}, dur, { ease: ease.lin, fn: fn }); }
  function stepTweens(dt) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i]; tw.t += dt * SPEED;
      if (tw.t < tw.delay) continue;
      if (!tw.from) { tw.from = {}; for (var k in tw.to) tw.from[k] = tw.o[k]; }
      var p = Math.min(1, (tw.t - tw.delay) / (tw.dur || 1)), e = tw.e(p);
      for (var q in tw.to) tw.o[q] = tw.from[q] + (tw.to[q] - tw.from[q]) * e;
      if (tw.fn) tw.fn(p);
      if (p >= 1) { tweens.splice(i, 1); tw.res(); }
    }
  }

  // ---------- Sound: card flicks, seat chime, fireplace (synthesised, Web Audio) ----------
  var ac = null, master = null, fireOn = false;
  function isMuted() { return !!(window.BlotSound && window.BlotSound.muted()); }
  function audio() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = isMuted() ? 0 : 1; master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  document.addEventListener('sound:mute', function (e) { if (master) master.gain.value = e.detail ? 0 : 1; });
  function noiseBuf(sec, shape) {
    var b = ac.createBuffer(1, Math.max(1, ac.sampleRate * sec | 0), ac.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < d.length; i++) { var w = Math.random() * 2 - 1; d[i] = shape ? shape(w, i / d.length, last) : w; last = d[i]; }
    return b;
  }
  function flick(vol) {
    if (!ac) return;
    var s = ac.createBufferSource(); s.buffer = noiseBuf(.07, function (w, k) { return w * Math.pow(1 - k, 3); });
    var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 1200; f.Q.value = .9;
    var g = ac.createGain(); g.gain.value = vol == null ? .22 : vol;
    s.connect(f).connect(g).connect(master); s.start();
  }
  function chime() {
    if (!ac) return;
    var t = ac.currentTime;
    [659, 988].forEach(function (fr, i) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = fr;
      g.gain.setValueAtTime(0, t + i * .09); g.gain.linearRampToValueAtTime(.06, t + i * .09 + .02);
      g.gain.exponentialRampToValueAtTime(.0001, t + i * .09 + .9);
      o.connect(g).connect(master); o.start(t + i * .09); o.stop(t + i * .09 + 1);
    });
  }
  var fireGain = null;
  function startFire() {
    if (!ac) return;
    if (fireOn) { fireGain.gain.setTargetAtTime(1, ac.currentTime, .4); return; }
    fireOn = true;
    fireGain = ac.createGain(); fireGain.gain.value = 0; fireGain.connect(master);
    fireGain.gain.setTargetAtTime(1, ac.currentTime, .6);
    // low roar: looped brown noise through a low-pass
    var bed = ac.createBufferSource();
    bed.buffer = noiseBuf(4, function (w, k, last) { return (last + .02 * w) / 1.02; });
    bed.loop = true;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    var bg = ac.createGain(); bg.gain.value = 1.6;
    bed.connect(lp).connect(bg).connect(fireGain); bed.start();
    // crackles: short random pops, sometimes in little bursts
    function pop(t, big) {
      var s = ac.createBufferSource(); s.buffer = noiseBuf(big ? .03 : .008, function (w, k) { return w * Math.pow(1 - k, 4); });
      var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = big ? 900 + Math.random() * 1200 : 2000 + Math.random() * 4000; f.Q.value = 1.4;
      var g = ac.createGain(); g.gain.value = big ? .16 + Math.random() * .12 : .03 + Math.random() * .08;
      s.connect(f).connect(g).connect(fireGain); s.start(t);
    }
    (function loop() {
      if (active) {
        var t = ac.currentTime + .05, n = Math.random() < .25 ? 2 + (Math.random() * 4 | 0) : 1;
        for (var i = 0; i < n; i++) pop(t + i * (.015 + Math.random() * .04), Math.random() < .12);
      }
      setTimeout(loop, 70 + Math.random() * 380);
    })();
  }
  function stopFire() { if (fireGain) fireGain.gain.setTargetAtTime(0, ac.currentTime, .3); }

  // ---------- Scene state ----------
  var S = { black: 1, amb: .55, lamps: 0, table: .35 };
  var MOVE_EVERY = 15;   // seconds between one character's gesture and the next one's
  var moves = { on: false, next: 0, last: null };
  var cards = [], particles = [], clock = 0, nextSmoke = 2;
  var shade = document.createElement('canvas'); shade.width = W / 4; shade.height = Math.ceil(H / 4);
  var sh = shade.getContext('2d');

  function moveSomeone() {
    // Don Marco is not in the rotation: he smokes all the time (see smokeForever)
    var ids = IDS.filter(function (id) { var s = SEATS[id]; return id !== 'top' && s.idle && !s.moving && !s.busy && id !== moves.last; });
    if (!ids.length) return;
    var id = ids[Math.random() * ids.length | 0], s = SEATS[id];
    moves.last = id;
    if (s.vidReady) {
      s.moving = true;
      try { s.vid.currentTime = 0; s.vid.play().catch(function () { s.moving = false; }); } catch (e) { s.moving = false; }
    } else if (s.acts) {
      act(s, s.acts[Math.random() * s.acts.length | 0]);
    }
  }
  function resetPose(s) {
    s.rot = 0; s.sc = 1; s.dx = 0; s.dy = 0; s.busy = false; s.glow = 0;
    for (var k in s.parts) { var p = s.parts[k]; p.rot = 0; p.dx = 0; p.dy = 0; }
  }
  function resetState() {
    moves = { on: false, next: 0, last: null };
    IDS.forEach(function (id) {
      var s = SEATS[id];
      s.moving = false;
      try { s.vid.pause(); s.vid.currentTime = 0; } catch (e) {}
      s.light = 0; s.idle = false; s.ring = 0; s.next = 0;
      resetPose(s);
    });
    S.black = 1; S.amb = .55; S.lamps = 0; S.table = .35;
    cards = []; particles = []; hover = null; humanWait = null;
    screen.querySelectorAll('[data-plate]').forEach(function (el) { el.classList.remove('is-turn'); });
  }
  function sparkle(x, y, n) {
    n = reduced ? 8 : (n || 26);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
      particles.push({ k: 'spark', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .6 + Math.random() * .6, r: 1.5 + Math.random() * 2.5 });
    }
  }
  function smoke(x, y, n, big) {
    for (var i = 0; i < n; i++) particles.push({
      k: 'smoke', x: x + Math.random() * (big ? 16 : 8) - (big ? 8 : 4), y: y + (big ? Math.random() * 10 - 5 : 0), life: -i * (big ? .09 : .2), max: big ? 3.2 : 2.6,
      vx: big ? -30 - Math.random() * 40 : -6 + Math.random() * 16, vy: big ? -20 - Math.random() * 30 : -16 - Math.random() * 12,
      r: big ? 7 + Math.random() * 6 : 5 + Math.random() * 5, a: big ? .13 : .22
    });
  }

  // ---------- Choreography ----------
  function bell(p) { return Math.sin(Math.PI * p); }
  var GREET = {
    bow:  function (s, p) { var b = bell(p); s.sc = 1 - .035 * b; s.dy = -9 * b; s.parts.helm.rot = .06 * Math.sin(2 * Math.PI * p); },
    lean: function (s, p) { var b = bell(p); s.dx = 12 * b; s.parts.head.rot = -.12 * b; },
    nod:  function (s, p) { var b = bell(p); s.parts.head.dy = 7 * Math.sin(2 * Math.PI * p) * (1 - p) + 5 * b; s.sc = 1 + .012 * b; },
    tip:  function (s, p) { var b = bell(p); s.parts.hat.rot = -.18 * b; s.parts.hat.dx = 10 * b; s.parts.hat.dy = -8 * b; }
  };
  // Idle gestures of the cut-out fallback (when a seat video is not available).
  var ACTS = {
    puff: { d: 4.2, f: function (s, p) {                   // mafia: hand to mouth, ember glows, exhale
      var up = p < .2 ? p / .2 : p < .55 ? 1 : p < .7 ? 1 - (p - .55) / .15 : 0, e = ease.inOut(up), c = s.parts.cigar;
      c.dx = 9 * e; c.dy = -7 * e; c.rot = .05 * e;
      s.parts.head.rot = -.05 * e; s.parts.head.dy = -3 * e;
      s.glow = p > .2 && p < .55 ? Math.min(1, (p - .2) / .1) : Math.max(0, s.glow - .03);
      if (!s._ex && p > .6) { s._ex = true; smoke(MOUTH[0], MOUTH[1], 12, true); }
      if (p > .95) s._ex = false;
    } },
    claw: { d: 1.8, f: function (s, p) { s.parts.claw.dy = p < .8 ? -6 * Math.abs(Math.sin(p * Math.PI * 5)) : 0; } },
    scratch: { d: 2.2, f: function (s, p) {                // cowboy: hand up to the beard, rubs, back down
      var h = s.parts.hands, up = p < .2 ? p / .2 : p < .8 ? 1 : 1 - (p - .8) / .2, e = ease.inOut(up);
      h.dx = 8 * e; h.dy = -10 * e; h.rot = -.06 * e;
      if (p > .2 && p < .8) { h.dx += 3 * Math.sin(p * 70); h.dy += 2 * Math.cos(p * 70); }
      s.parts.hat.rot = .06 * e; s.parts.hat.dy = -3 * e; s.rot = -.012 * e;
    } },
    hat: { d: 1.6, f: function (s, p) { var b = bell(p), h = s.parts.hat; h.rot = .12 * b; h.dy = -6 * b; h.dx = -4 * b; } },
    lean: { d: 2.4, f: function (s, p) { var b = bell(p); s.dx = -10 * b; s.rot = -.025 * b; } },
    tilt: { d: 2.2, f: function (s, p) { var b = bell(p); s.parts.head.rot = .14 * b; s.parts.head.dx = 4 * b; } },
    glance: { d: 2.6, f: function (s, p) { var k = p < .5 ? bell(p * 2) : -bell((p - .5) * 2); s.parts.head.rot = .1 * k; } },
    tap: { d: 1.8, f: function (s, p) { s.parts.hands.dy = -5 * Math.max(0, Math.sin(p * Math.PI * 8)); } },
    lookAround: { d: 3, f: function (s, p) { var k = p < .5 ? bell(p * 2) : -bell((p - .5) * 2); s.parts.helm.rot = .16 * k; } },
    drum: { d: 1.6, f: function (s, p) { s.parts.hands.dy = -4 * Math.max(0, Math.sin(p * Math.PI * 10)); s.parts.hands.rot = .03 * Math.sin(p * Math.PI * 10); } },
    stretch: { d: 2.4, f: function (s, p) { var b = bell(p); s.sc = 1 + .03 * b; s.parts.helm.dy = -6 * b; } }
  };
  function act(s, name) {
    var a = ACTS[name]; s.busy = true;
    anim(a.d, function (p) { a.f(s, p); }).then(function () { resetPose(s); });
  }

  function join(id, my) {
    var s = SEATS[id];
    chime();
    var plate = screen.querySelector('[data-plate="' + id + '"]');
    if (plate) plate.classList.add('is-on');
    s.ring = 0; tween(s, { ring: 1 }, .9, { ease: ease.lin });
    tween(s, { light: 1 }, .55);
    sparkle(s.face[0], s.face[1]);
    s.sc = .95;
    return tween(s, { sc: 1.03 }, .22)
      .then(function () { return my === run && tween(s, { sc: 1 }, .18); })
      .then(function () {
        if (my !== run) return;
        if (id === 'top') smoke(CIGAR_TIP[0], CIGAR_TIP[1], 8);
        return anim(1.4, function (p) { if (!s.vidReady) GREET[s.greet](s, p); });
      })
      .then(function () {
        if (my !== run) return;
        resetPose(s); s.idle = true;
        if (id === 'top') smokeForever(s, my);
      });
  }

  // Don Marco never stops smoking: his video (a seamless 10 s loop of him drawing on the cigar)
  // plays on repeat; without the video the cut-out keeps puffing, with smoke and the glowing tip.
  function smokeForever(s, my) {
    if (my !== run || !active) return;
    if (s.vidReady) {
      s.moving = true; s.vid.loop = true;
      if (s.vid.paused) s.vid.play().catch(function () {});
      return;
    }
    if (!s.busy) act(s, 'puff');
    setTimeout(function () { smokeForever(s, my); }, 2600);
  }

  async function play() {
    var my = ++run;
    tweens.length = 0; resetState();
    function ok() { return my === run && active; }

    tween(S, { black: 0 }, 1.2);
    await wait(.6); if (!ok()) return;

    for (var j = 0; j < JOIN_ORDER.length; j++) {
      join(JOIN_ORDER[j], my);
      await wait(1.3); if (!ok()) return;
    }
    await wait(1.2); if (!ok()) return;

    // everyone is seated: the lamps come up over the table
    moves.on = true; moves.next = clock + 6;
    tween(S, { amb: .14, lamps: 1 }, 1.4);
    await wait(.9); if (!ok()) return;

    // from here the game controller (js/game.js) runs the deals, bidding and tricks
    if (window.BlotGame) window.BlotGame.start(view);
  }

  // ---------- View API for the game controller ----------
  // Everything is in scene coordinates. Each call returns when its animation is done.
  var SUIT_OF = { S: SUITS[0], H: SUITS[1], C: SUITS[2], D: SUITS[3] };
  var DECK_FROM = { top: [1005, 290, Math.PI], bottom: [1000, 760, 0], left: [470, 512, Math.PI / 2], right: [1530, 512, -Math.PI / 2] };
  // the trick is laid in the middle of the table, each card nudged towards whoever played it
  var TRICK_SPOT = { bottom: [1000, 548, -.04], top: [1000, 478, .04], left: [948, 513, -.12], right: [1052, 513, .12] };
  var byId = {}, humanWait = null, trickZ = 500;

  function pileAt(id, i, n) {
    var s = SEATS[id], o = (i - (n - 1) / 2) * 15, horiz = id === 'top' || id === 'bottom';
    return { x: s.pile[0] + (horiz ? o : 0), y: s.pile[1] + (horiz ? 0 : o), rot: s.pileRot + (i - (n - 1) / 2) * .03 };
  }
  function fanAt(i, n) {
    var a = (i - (n - 1) / 2) * .058, R0 = 1100;
    return { x: 1000 + Math.sin(a) * R0, y: 850 + R0 * (1 - Math.cos(a)), rot: a };
  }

  var view = {
    alive: function (tok) { return tok === run && active; },
    token: function () { return run; },
    wait: wait,

    // deck: engine cards in deck order; sequence: [{seat, card}] from BlotRules.deal
    deal: async function (tok, deck, sequence, dealer) {
      cards = []; byId = {}; hover = null; trickZ = 500;
      var from = DECK_FROM[dealer];
      deck.forEach(function (ec, i) {
        var c = new Card(ec.rank, SUIT_OF[ec.suit]);
        c.id = ec.id; byId[ec.id] = c;
        c.x = from[0]; c.y = from[1]; c.rot = from[2] + .2; c.z = i; c.sc = .75;
        cards.push(c);
      });
      await Promise.all(cards.map(function (c, i) {
        return tween(c, { x: 1000, y: 512 - i * .35, rot: from[2], alpha: 1, sc: 1 }, .6, { delay: .2, ease: ease.inOut });
      })); if (!view.alive(tok)) return;
      flick(.3);
      var stack = cards.slice();
      for (var rep = 0; rep < 2; rep++) {
        var L = stack.slice(0, 16), R = stack.slice(16);
        await Promise.all(stack.map(function (c, i) {
          return tween(c, { x: 1000 + (i < 16 ? -62 : 62), rot: from[2] + (i < 16 ? -.1 : .1) }, .28, { ease: ease.inOut });
        })); if (!view.alive(tok)) return;
        var mixed = [];
        for (var i = 0; i < 16; i++) { if (Math.random() < .5) mixed.push(L[i], R[i]); else mixed.push(R[i], L[i]); }
        stack = mixed;
        await Promise.all(stack.map(function (c, k) {
          c.z = k;
          return tween(c, { x: 1000, y: 512 - k * .35, rot: from[2] }, .16, { delay: k * .018, fn: function (p) { if (p === 1 && k % 3 === 0) flick(.12); } });
        })); if (!view.alive(tok)) return;
        await wait(.15); if (!view.alive(tok)) return;
      }
      var count = { bottom: 0, left: 0, top: 0, right: 0 }, zTop = 100;
      for (var q = 0; q < sequence.length; q++) {
        var st = sequence[q], c = byId[st.card.id], t = pileAt(st.seat, count[st.seat]++, 8);
        c.z = zTop++;
        flick();
        tween(c, { x: t.x, y: t.y, rot: t.rot }, .34);
        await wait(.075); if (!view.alive(tok)) return;
        if (sequence[q + 1] && sequence[q + 1].seat !== st.seat) { await wait(.12); if (!view.alive(tok)) return; }
      }
      await wait(.4);
    },
    // your hand: fanned at the bottom, face up, in the given order
    layoutHand: function (ids) {
      ids.forEach(function (id, i) {
        var c = byId[id], t = fanAt(i, ids.length), first = !c.mine;
        c.z = 300 + i; c.mine = true;
        tween(c, { x: t.x, y: t.y, rot: t.rot, sc: 1.7 }, first ? .5 : .3, { delay: first ? i * .04 : 0, ease: ease.inOut });
        if (c.flip < 1) tween(c, { flip: 1 }, .35, { delay: .45 + i * .06, ease: ease.inOut, fn: function (p) { if (p === 1) flick(.1); } });
      });
      return wait(.9);
    },
    // an opponent's face-down cards, re-spaced after a card leaves
    layoutPile: function (seat, ids) {
      ids.forEach(function (id, i) { var t = pileAt(seat, i, ids.length); tween(byId[id], { x: t.x, y: t.y, rot: t.rot }, .25); });
    },
    // wait for you to tap one of the legal cards; the others are darkened
    waitHuman: function (hand, legal, hint) {
      hand.forEach(function (id) {
        var c = byId[id], ok = legal.indexOf(id) >= 0;
        c.base = ok ? 18 : 0;
        tween(c, { dim: ok ? 0 : 1, lift: c.base }, .2);
      });
      return new Promise(function (res) { humanWait = { legal: legal, res: res, hand: hand, hint: hint }; });
    },
    playCard: function (seat, id) {
      var c = byId[id], t = TRICK_SPOT[seat];
      c.mine = false; c.base = 0; c.z = trickZ++;
      if (c === hover) hover = null;
      flick(.25);
      tween(c, { dim: 0, lift: 0 }, .15);
      tween(c, { flip: 1 }, .3, { ease: ease.inOut });
      return tween(c, { x: t[0], y: t[1], rot: t[2], sc: 1.15 }, .4, { ease: ease.out });
    },
    // the trick slides to the winner and is gone
    collect: async function (seat, ids) {
      var f = SEATS[seat].face;
      await Promise.all(ids.map(function (id, i) {
        return tween(byId[id], { x: f[0], y: f[1], sc: .5, alpha: 0 }, .45, { delay: i * .03, ease: ease.inOut });
      }));
      cards = cards.filter(function (c) { return ids.indexOf(c.id) < 0; });
    },
    clear: async function () {
      await Promise.all(cards.map(function (c) { return tween(c, { alpha: 0, sc: c.sc * .8 }, .3); }));
      cards = []; byId = {}; hover = null;
    },
    // whoever has to act gets their nameplate lit; null for nobody
    turn: function (seat) {
      screen.querySelectorAll('[data-plate]').forEach(function (el) { el.classList.toggle('is-turn', el.getAttribute('data-plate') === seat); });
    },
    say: function (seat, text, kind) { bubble(seat, text, kind); },
    chime: function () { chime(); },
    // the HUD (last trick, score, buttons) comes in once the first hand has been dealt
    showHud: function () {
      if (screen.classList.contains('tb-enter')) return;
      screen.classList.add('tb-enter');
    }
  };

  // tap on one of your legal cards plays it
  cv.addEventListener('click', function (e) {
    if (!humanWait) return;
    pick(e);
    if (hover && humanWait.legal.indexOf(hover.id) < 0) {
      // not playable now: shake it and say why
      var c = hover, x0 = c.x;
      anim(.3, function (p) { c.x = x0 + Math.sin(p * Math.PI * 6) * 10 * (1 - p); });
      bubble('bottom', humanWait.hint || 'Play a highlighted card', 'hint');
      return;
    }
    if (hover && humanWait.legal.indexOf(hover.id) >= 0) {
      var w = humanWait, id = hover.id;
      humanWait = null;
      w.hand.forEach(function (h) { var c = byId[h]; if (c) { c.base = 0; tween(c, { dim: 0 }, .2); } });
      w.res(id);
    }
  });

  // ---------- Own cards lift under the finger / pointer ----------
  var hover = null;
  function pick(e) {
    var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, hit = null;
    var byZ = cards.slice().sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < byZ.length; i++) {
      var c = byZ[i];
      if (!c.mine || c.flip < 1) continue;
      var dx = x - c.x, dy = y - c.y, ca = Math.cos(-c.rot), sa = Math.sin(-c.rot);
      var lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
      if (Math.abs(lx) < CW * c.sc / 2 && Math.abs(ly) < CH * c.sc / 2) { hit = c; break; }
    }
    if (hit !== hover) {
      if (hover) tween(hover, { lift: hover.base || 0 }, .15);
      if (hit) { tween(hit, { lift: 26 }, .15); flick(.06); }
      hover = hit; cv.style.cursor = hit ? 'pointer' : 'default';
    }
  }
  cv.addEventListener('pointermove', pick);
  cv.addEventListener('pointerdown', pick);

  // ---------- Render ----------
  var last = 0, active = false, raf = 0;
  function glow(x, y, r, col) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function drawSeat(s) {
    if (s.light <= 0) return;
    var px = s.pivot[0], py = s.pivot[1], sc = s.sc;
    if (s.idle) sc *= 1 + .005 * Math.sin(clock * 1.7 + px);
    if (s.vidReady && s.vidMask.complete && s.vidMask.naturalWidth) {
      var r = s.video.rect, vc = s.vidCanvas, g = vc.getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, vc.width, vc.height);
      g.drawImage(s.vid, 0, 0, vc.width, vc.height);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(s.vidMask, 0, 0, vc.width, vc.height);
      ctx.save(); ctx.globalAlpha = Math.min(1, s.light);
      ctx.drawImage(vc, r[0], r[1], r[2], r[3]); ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.light * 1.15);
    ctx.translate(px + s.dx, py + s.dy); ctx.rotate(s.rot); ctx.scale(sc, sc); ctx.translate(-px, -py);
    ctx.drawImage(s.sprite, s.crop[0], s.crop[1]);
    for (var k in s.parts) {
      var pt = s.parts[k];
      ctx.save();
      ctx.translate(pt.p[0] + pt.dx, pt.p[1] + pt.dy); ctx.rotate(pt.rot); ctx.translate(-pt.p[0], -pt.p[1]);
      ctx.drawImage(pt.sprite, pt.r[0], pt.r[1]);
      ctx.restore();
    }
    ctx.restore();
  }
  function pool(x, y, rx, ry, a) {
    sh.save(); sh.translate(x, y); sh.scale(rx, ry);
    var g = sh.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(.55, 'rgba(0,0,0,' + a * .75 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
    sh.fillStyle = g; sh.fillRect(-1, -1, 2, 2); sh.restore();
  }
  function frame(now) {
    if (!active) return;
    var dt = Math.min(50, now - (last || now)); last = now; clock += dt / 1000;
    stepTweens(dt);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (room.complete && room.naturalWidth) ctx.drawImage(room, 0, 0, W, H);
    IDS.forEach(function (id) { if (SEATS[id].sprite) drawSeat(SEATS[id]); });

    // Room light: a dark veil with warm pools cut out where players sit and over the table.
    sh.setTransform(1, 0, 0, 1, 0, 0);
    sh.globalCompositeOperation = 'source-over'; sh.clearRect(0, 0, shade.width, shade.height);
    sh.fillStyle = 'rgba(10,5,2,' + S.amb + ')'; sh.fillRect(0, 0, shade.width, shade.height);
    sh.setTransform(.25, 0, 0, .25, 0, 0);
    sh.globalCompositeOperation = 'destination-out';
    pool(1000, 525, 620, 330, S.table);
    pool(40, 260, 330, 330, .5 + .08 * Math.sin(clock * 9));
    IDS.forEach(function (id) {
      var s = SEATS[id];
      if (s.light > 0) pool(s.crop[0] + s.crop[2] / 2, s.crop[1] + s.crop[3] / 2, s.crop[2] * .8, s.crop[3] * .8, .9 * s.light);
    });
    ctx.drawImage(shade, 0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    var fl = .13 + .05 * Math.sin(clock * 9) + .03 * Math.sin(clock * 23);
    glow(30, 260, 300, 'rgba(255,140,40,' + fl + ')');
    glow(1890, 30, 260, 'rgba(255,200,120,' + .12 * S.lamps + ')');
    glow(1000, 525, 520, 'rgba(255,60,40,' + .05 * S.lamps + ')');
    IDS.forEach(function (id) {
      var s = SEATS[id];
      if (s.light > 0) glow(s.crop[0] + s.crop[2] / 2, s.crop[1] + s.crop[3] / 2, s.crop[3] * .7, 'rgba(255,190,110,' + .07 * s.light * (1 - S.lamps * .6) + ')');
      if (s.ring > 0 && s.ring < 1) {
        ctx.strokeStyle = 'rgba(241,212,154,' + .6 * (1 - s.ring) + ')'; ctx.lineWidth = 6 * (1 - s.ring);
        ctx.beginPath(); ctx.ellipse(s.face[0], s.face[1], 40 + 200 * s.ring, 30 + 150 * s.ring, 0, 0, Math.PI * 2); ctx.stroke();
      }
    });
    var top = SEATS.top;
    if (top.light > 0 && !top.vidReady) {
      var c = top.parts.cigar, h = top.parts.head;
      glow(CIGAR_TIP[0] + c.dx, CIGAR_TIP[1] + c.dy, 10 + 18 * top.glow, 'rgba(255,' + (120 + 40 * top.glow) + ',40,' + (.35 + .55 * top.glow + .08 * Math.sin(clock * 13)) + ')');
      glow(CYBER_EYE[0] + h.dx, CYBER_EYE[1] + h.dy, 16, 'rgba(255,190,60,' + (.25 + .2 * Math.sin(clock * 2.3)) * top.light + ')');
    }
    ctx.globalCompositeOperation = 'source-over';

    cards.sort(function (a, b) { return a.z - b.z; }).forEach(function (cd) { cd.draw(); });

    if (top.idle && !top.vidReady && clock > nextSmoke) {
      smoke(CIGAR_TIP[0] + top.parts.cigar.dx, CIGAR_TIP[1] + top.parts.cigar.dy, 3);
      nextSmoke = clock + 1.2 + Math.random();
    }
    var ds = dt / 1000;
    particles = particles.filter(function (p) { return (p.life += ds) < p.max; });
    particles.forEach(function (p) {
      if (p.life < 0) return;
      var k = p.life / p.max;
      if (p.k === 'spark') {
        p.x += p.vx * ds; p.y += p.vy * ds; p.vx *= .96; p.vy *= .96;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,214,130,' + (1 - k) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        p.x += (p.vx + Math.sin(clock * 2 + p.r) * 10) * ds; p.y += p.vy * ds; p.vx *= .99;
        var r = p.r * (1 + k * 4), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, 'rgba(225,220,212,' + p.a * (1 - k) + ')'); g.addColorStop(1, 'rgba(225,220,212,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
    });

    if (moves.on && clock > moves.next) { moveSomeone(); moves.next = clock + MOVE_EVERY; }
    if (S.black > 0) { ctx.fillStyle = 'rgba(0,0,0,' + S.black + ')'; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }

  // ---------- Boot: cut the sprites and paint the deck once the art has loaded ----------
  var art = [img, room].concat(Object.keys(faceArt).map(function (k) { return faceArt[k]; }));
  var booting = Promise.all(art.map(function (im) { return im.decode().catch(function () {}); })).then(function () {
    IDS.forEach(function (id) {
      var s = SEATS[id];
      s.sprite = feathered(s.crop);
      for (var k in s.parts) s.parts[k].sprite = feathered(s.parts[k].r, .5);
    });
    cardBack = makeBack();
    SUITS.forEach(function (su) { RANKS.forEach(function (r) { cardFaces[r + su.s] = makeFace(r, su); }); });
  });

  // The Play button is the user gesture that unlocks Web Audio for the table sounds.
  var playBtn = document.querySelector('[data-stage-play]');
  playBtn.addEventListener('click', function () {
    audio();
    IDS.forEach(function (id) { SEATS[id].vid.load(); });
    // let the "into battle" hit land, then cut to the table
    setTimeout(function () { window.BlotNav.show('table'); }, 700);
  });

  document.addEventListener('screen:show', function (e) {
    if (e.detail === 'table') {
      active = true; last = 0;
      resetState();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      audio(); startFire();
      booting.then(function () { if (active) play(); });
    } else if (active) {
      active = false; run++;
      screen.classList.remove('tb-enter'); closePops(null);
      screen.querySelectorAll('[data-plate]').forEach(function (el) { el.classList.remove('is-on'); });
      Object.keys(bubbles).forEach(function (k) { bubbles[k].textContent = ''; });
      if (window.BlotGame) window.BlotGame.stop();
      cancelAnimationFrame(raf);
      IDS.forEach(function (id) { try { SEATS[id].vid.pause(); } catch (err) {} });
      stopFire();
    }
  });

  // ---------- HUD ----------
  // The settings gear is gone from the design; Escape still goes back to the stage select (prototype shortcut).
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && active) window.BlotNav.show('play'); });

  // Score and last trick. A new game starts at 0 : 0 with the "?" slot; the game logic
  // (js/blot-rules.js) will call these as tricks are taken.
  function setScore(us, them) {
    [['us', us], ['them', them]].forEach(function (t) {
      screen.querySelectorAll('[data-score="' + t[0] + '"] > span').forEach(function (el) {
        el.innerHTML = '<b>' + t[1] + '</b><small>/' + window.BlotRules.GAME_TARGET + '</small>';
      });
    });
  }
  // cards: [{rank, suit}] (engine cards) or [] for none yet. Small copies of the card PNGs.
  function setLastTrick(cards) {
    var box = screen.querySelector('[data-trick-cards]');
    box.innerHTML = (cards || []).map(function (c) {
      return '<img class="tb-mini" src="' + A + 'cards/play/' + c.rank + c.suit + '.png" alt="' + c.rank + c.suit + '">';
    }).join('');
    box.hidden = !(cards && cards.length);
    screen.querySelector('[data-trick-empty]').hidden = !box.hidden;
  }
  setScore(0, 0); setLastTrick([]);
  window.BlotTable = { setScore: setScore, setLastTrick: setLastTrick };

  // Chat and reactions: each button opens its popover; a pick pops up above your seat.
  var say = screen.querySelector('[data-say]');
  var bubbles = {};
  ['bottom', 'left', 'top', 'right'].forEach(function (id) {
    var el = document.createElement('div');
    el.className = 'tb-bubble tb-bubble--' + id;
    say.appendChild(el); bubbles[id] = el;
  });
  function bubble(seat, text, kind) {
    var el = document.createElement('div');
    el.className = kind === 'emoji' ? 'tb-say_emoji' : 'tb-say_line' + (kind ? ' tb-say_line--' + kind : '');
    el.textContent = text;
    bubbles[seat].textContent = ''; bubbles[seat].appendChild(el);
  }
  var social = screen.querySelectorAll('[data-social]');
  function closePops(except) {
    social.forEach(function (b) {
      var k = b.getAttribute('data-social'), open = k === except;
      b.setAttribute('aria-expanded', String(open));
      screen.querySelector('[data-pop="' + k + '"]').hidden = !open;
    });
  }
  social.forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      closePops(b.getAttribute('aria-expanded') === 'true' ? null : b.getAttribute('data-social'));
    });
  });
  function pop(cls, text) { bubble('bottom', text, cls === 'tb-say_emoji' ? 'emoji' : null); }
  screen.querySelectorAll('[data-pop="chat"] button').forEach(function (b) {
    b.addEventListener('click', function () { closePops(null); pop('tb-say_line', b.textContent); });
  });
  screen.querySelectorAll('[data-pop="react"] button').forEach(function (b) {
    b.addEventListener('click', function () { closePops(null); pop('tb-say_emoji', b.textContent); });
  });
  screen.addEventListener('click', function (e) { if (!e.target.closest('.tb-bottom')) closePops(null); });
})();
