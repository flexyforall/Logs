// Stage select: an endless carousel of rooms. Tapping an open room brings it to the centre and
// updates the cost; dimmed rooms are locked. PLAY NOW in the lobby opens this screen.
(function () {
  var A = 'assets/play/figma/';
  var STAGES = [
    { id: 'courtyard', name: 'Courtyard', cost: 2000 },
    { id: 'cafe', name: 'Café', cost: 10000 },
    { id: 'backroom', name: 'Backroom', cost: 20000 },
    { id: 'mansion', name: 'Mansion', cost: 50000, locked: true },
    { id: 'arena', name: 'Arena Challengers', cost: 100000, locked: true }
  ];
  // Figma geometry: cards 162x178 (selected 220x229), 56px apart, centred on y = 200.5
  var W = 162, H = 178, SW = 220, SH = 229, GAP = 56, CX = 426, CY = 200.5;
  var selected = 2;

  var screen = document.querySelector('[data-screen-id="play"]');
  var track = screen.querySelector('[data-stages]');
  var costEl = screen.querySelector('[data-stage-cost]');
  var playBtn = screen.querySelector('[data-stage-play]');
  var costLine = screen.querySelector('.st-cost');

  function fmt(n) { return n.toLocaleString('en-US'); }

  var cards = STAGES.map(function (st, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'st-card' + (st.locked ? ' is-locked' : '');
    b.setAttribute('aria-label', st.name + (st.locked ? ' (закрыто)' : ''));
    b.innerHTML =
      '<img class="st-card_art" src="' + A + 'stage-' + st.id + '.webp" alt="">' +
      '<span class="st-price">' +
        '<img class="st-price_tex" src="' + A + 'diamond.webp" alt="">' +
        '<span class="st-amount"><img src="assets/lobby/figma/chip.webp" alt=""><b>' + fmt(st.cost) + '</b></span>' +
      '</span>';
    b.addEventListener('click', function () { choose(i); });
    track.appendChild(b);
    return b;
  });

  // Endless carousel: every room sits at a circular offset d from the selected one
  // (-2..2 for five rooms), so there are always rooms on both sides.
  var N = STAGES.length, HALF = Math.floor(N / 2);
  function offset(k) { return ((k - selected + N + HALF) % N) - HALF; }
  function centerX(d) {
    if (!d) return CX;
    return CX + Math.sign(d) * (SW / 2 + GAP + W / 2 + (Math.abs(d) - 1) * (W + GAP));
  }
  function place(c, d, sel) {
    var w = sel ? SW : W, h = sel ? SH : H;
    c.style.left = (centerX(d) - w / 2) + 'px';
    c.style.top = (CY - h / 2) + 'px';
  }
  function layout(shift) {
    cards.forEach(function (c, k) {
      var d = offset(k), sel = d === 0;
      c.classList.toggle('is-selected', sel);
      // a room that wraps around to the other end comes in from beyond the edge
      // instead of sliding across the whole screen
      if (shift && Math.abs(d + shift) > HALF) {
        c.style.transition = 'none';
        place(c, d + shift, false);
        void c.offsetWidth;
        c.style.transition = '';
      }
      place(c, d, sel);
    });
    // the new price shows once the cost line has faded out
    clearTimeout(layout.t);
    if (costLine.classList.contains('is-swapping')) layout.t = setTimeout(function () { costEl.textContent = fmt(STAGES[selected].cost); }, 110);
    else costEl.textContent = fmt(STAGES[selected].cost);
  }

  function choose(i) {
    if (i === selected) return;
    var c = cards[i];
    if (STAGES[i].locked) {
      c.classList.remove('is-shaking');
      void c.offsetWidth;
      c.classList.add('is-shaking');
      return;
    }
    var shift = offset(i);   // how many places the carousel moves
    selected = i;
    // the play button and the cost hide while the cards move, then come back
    [playBtn, costLine].forEach(function (el) { el.classList.remove('is-swapping'); void el.offsetWidth; el.classList.add('is-swapping'); });
    layout(shift);
    document.dispatchEvent(new CustomEvent('stage:select', { detail: STAGES[i].id }));
    c.classList.remove('is-arriving');
    void c.offsetWidth;
    c.classList.add('is-arriving');
  }

  // tabs: visual state only for now
  screen.querySelectorAll('.st-tab').forEach(function (t) {
    t.addEventListener('click', function () {
      screen.querySelectorAll('.st-tab').forEach(function (o) {
        o.classList.toggle('is-active', o === t);
        o.setAttribute('aria-selected', String(o === t));
      });
    });
  });

  // navigation
  document.querySelector('[data-play]').addEventListener('click', function () { window.BlotNav.show('play'); });
  screen.querySelector('[data-back]').addEventListener('click', function () { window.BlotNav.show('lobby'); });

  document.addEventListener('screen:show', function (e) {
    if (e.detail !== 'play') return;
    screen.classList.remove('st-enter');
    void screen.offsetWidth;
    screen.classList.add('st-enter');
    cards.forEach(function (c, k) { c.style.animationDelay = (0.12 + k * 0.06) + 's'; });
  });

  window.BlotStage = { current: function () { return STAGES[selected].id; } };

  layout();
})();
