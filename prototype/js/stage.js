// Stage select: carousel of rooms. Tapping an open room brings it to the centre and
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

  function layout() {
    // centre of each card relative to the selected one
    var x = [];
    x[selected] = CX;
    for (var i = selected - 1; i >= 0; i--) x[i] = x[i + 1] - ((i + 1 === selected ? SW : W) / 2 + GAP + W / 2);
    for (var j = selected + 1; j < cards.length; j++) x[j] = x[j - 1] + ((j - 1 === selected ? SW : W) / 2 + GAP + W / 2);
    cards.forEach(function (c, k) {
      var sel = k === selected, w = sel ? SW : W, h = sel ? SH : H;
      c.classList.toggle('is-selected', sel);
      c.style.left = (x[k] - w / 2) + 'px';
      c.style.top = (CY - h / 2) + 'px';
    });
    costEl.textContent = fmt(STAGES[selected].cost);
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
    selected = i;
    layout();
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

  layout();
})();
