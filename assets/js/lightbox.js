// Opens the overview figures in an in-page viewer instead of the browser's bare image page.
// Each figure stays a normal link to the image file, so it still works without JavaScript and
// Ctrl/Cmd/Shift-click still opens the image in a new tab or window.
(function () {
  'use strict';

  var links = document.querySelectorAll('.figure-block a[href]');
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  var dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.innerHTML =
    '<button type="button" class="lightbox-close" aria-label="닫기">' +
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
        '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>' +
    '</button>' +
    '<figure class="lightbox-figure">' +
      '<img class="lightbox-img" alt="">' +
      '<figcaption class="lightbox-caption"></figcaption>' +
    '</figure>';
  document.body.appendChild(dialog);

  var image = dialog.querySelector('.lightbox-img');
  var caption = dialog.querySelector('.lightbox-caption');
  var closeButton = dialog.querySelector('.lightbox-close');
  var closeTimer;

  function open(link) {
    var thumb = link.querySelector('img');
    var figcaption = link.closest('figure') && link.closest('figure').querySelector('figcaption');

    image.src = link.href;
    image.alt = thumb ? thumb.alt : '';
    if (thumb && thumb.getAttribute('width')) {
      image.width = thumb.getAttribute('width');
      image.height = thumb.getAttribute('height');
    }
    caption.textContent = figcaption ? figcaption.textContent : '';
    caption.hidden = !figcaption;
    dialog.setAttribute('aria-label', figcaption ? figcaption.textContent : (thumb ? thumb.alt : ''));

    clearTimeout(closeTimer);
    document.documentElement.classList.add('lightbox-open');
    dialog.showModal();
    closeButton.focus();
    // Start the fade-in on the next frame so the transition runs from the closed state.
    requestAnimationFrame(function () { dialog.classList.add('is-visible'); });
  }

  function close() {
    if (!dialog.open) return;
    dialog.classList.remove('is-visible');
    var delay = reduceMotion && reduceMotion.matches ? 0 : 200;
    closeTimer = setTimeout(function () { dialog.close(); }, delay);
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(link);
    });
  });

  closeButton.addEventListener('click', close);

  // A click on the dimmed area (the dialog itself, outside the card) closes the viewer.
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) close();
  });

  // Esc: run the same fade-out instead of the dialog's instant close.
  dialog.addEventListener('cancel', function (event) {
    event.preventDefault();
    close();
  });

  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('lightbox-open');
    image.removeAttribute('src');
  });
})();
