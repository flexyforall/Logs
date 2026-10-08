// Blot Bazar prototype: device scaling, splash, screen switching.
(function () {
  var device = document.querySelector('[data-device]');
  var video = document.querySelector('[data-splash-video]');
  var skip = document.querySelector('[data-splash-skip]');

  // Scale the iPhone frame down to fit the window (never up).
  function fit() {
    var margin = 32;
    var s = Math.min(1,
      (window.innerWidth - margin) / device.offsetWidth,
      (window.innerHeight - margin) / device.offsetHeight);
    device.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  var lobby = document.querySelector('[data-screen-id="lobby"]');

  function show(id) {
    document.querySelectorAll('[data-screen-id]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-screen-id') === id);
    });
    // Restart the lobby's entrance animation every time it opens.
    document.dispatchEvent(new CustomEvent('screen:show', { detail: id }));
    if (id === 'lobby') {
      lobby.classList.remove('lb-enter');
      void lobby.offsetWidth;
      lobby.classList.add('lb-enter');
    }
  }

  // The splash starts from the "Tap to play" screen, so sound is allowed. If unmuted
  // playback is still refused it plays muted and the sound comes on at the next tap.
  function playSplash() {
    show('splash');
    video.currentTime = 0;
    var soundOff = function () { return window.BlotSound && window.BlotSound.muted(); };
    video.muted = !!soundOff();
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () {
        video.muted = true;
        video.play();
        document.addEventListener('pointerdown', function unmute() {
          video.muted = !!soundOff();
          document.removeEventListener('pointerdown', unmute);
        });
      });
    }
    skip.classList.remove('is-visible');
    setTimeout(function () { skip.classList.add('is-visible'); }, 1200);
  }

  function toLobby() {
    video.pause();
    skip.classList.remove('is-visible');
    show('lobby');
  }

  // One chip balance for the whole app (lobby and stage select show the same number).
  var balance = 25000;
  function renderBalance() {
    var t = balance.toLocaleString('en-US');
    document.querySelectorAll('[data-balance]').forEach(function (el) { el.textContent = t; el.setAttribute('data-text', t); });
  }
  renderBalance();
  window.BlotWallet = {
    get: function () { return balance; },
    set: function (v) { balance = v; renderBalance(); }
  };

  window.BlotNav = { show: show };

  // Start screen: the tap is the user gesture that lets the splash play with sound.
  document.querySelector('[data-start]').addEventListener('click', playSplash);

  skip.addEventListener('click', toLobby);
  video.addEventListener('ended', toLobby);
  // Prototype shortcut: the settings gear replays the splash.
  document.querySelector('[data-settings]').addEventListener('click', playSplash);

  show('start');
})();
