// Blot Bazar prototype: device scaling, splash, screen switching.
(function () {
  var device = document.querySelector('[data-device]');
  var video = document.querySelector('[data-splash-video]');
  var start = document.querySelector('[data-splash-start]');
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

  function show(id) {
    document.querySelectorAll('[data-screen-id]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-screen-id') === id);
    });
  }

  // Browsers only allow sound after a tap, so the splash starts on the first tap.
  function playSplash() {
    show('splash');
    start.classList.add('is-hidden');
    video.currentTime = 0;
    video.muted = false;
    var p = video.play();
    if (p && p.catch) {
      p.catch(function () { video.muted = true; video.play(); });
    }
    setTimeout(function () { skip.classList.add('is-visible'); }, 1200);
  }

  function toLobby() {
    video.pause();
    skip.classList.remove('is-visible');
    show('lobby');
  }

  start.addEventListener('click', playSplash);
  skip.addEventListener('click', toLobby);
  video.addEventListener('ended', toLobby);
  // Prototype shortcut: the settings gear replays the splash.
  document.querySelector('[data-settings]').addEventListener('click', playSplash);
})();
