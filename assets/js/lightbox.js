// Opens the overview figures in an in-page viewer instead of the browser's bare image page.
//   - Close: the X button, Esc, or a click outside the card.
//   - Zoom: mouse wheel / trackpad pinch anywhere in the viewer, two-finger pinch on touch screens,
//     double-click to toggle. The whole card (image and white background) zooms around the
//     center of the screen, wherever the pointer is. Drag to pan while zoomed.
//   - Move between figures: the arrow buttons, the Left/Right keys, or a horizontal swipe.
// Each figure stays a normal link to the image file, so it still works without JavaScript and
// Ctrl/Cmd/Shift-click still opens the image in a new tab or window.
(function () {
  'use strict';

  var links = Array.prototype.slice.call(document.querySelectorAll('.figure-block a[href]'));
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  var MIN_SCALE = 1;
  var MAX_SCALE = 6;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function icon(path) {
    return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
      '<path d="' + path + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  var dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.innerHTML =
    '<div class="lightbox-counter" aria-live="polite"></div>' +
    '<button type="button" class="lightbox-btn lightbox-close" aria-label="닫기">' + icon('M6 6l12 12M18 6L6 18') + '</button>' +
    '<button type="button" class="lightbox-btn lightbox-prev" aria-label="이전 그림">' + icon('M15 5l-7 7 7 7') + '</button>' +
    '<button type="button" class="lightbox-btn lightbox-next" aria-label="다음 그림">' + icon('M9 5l7 7-7 7') + '</button>' +
    '<div class="lightbox-zoom">' +
      '<figure class="lightbox-figure">' +
        '<img class="lightbox-img" alt="" draggable="false">' +
        '<figcaption class="lightbox-caption"></figcaption>' +
      '</figure>' +
    '</div>';
  document.body.appendChild(dialog);

  var zoomBox = dialog.querySelector('.lightbox-zoom');
  var image = dialog.querySelector('.lightbox-img');
  var caption = dialog.querySelector('.lightbox-caption');
  var counter = dialog.querySelector('.lightbox-counter');
  var closeButton = dialog.querySelector('.lightbox-close');
  var prevButton = dialog.querySelector('.lightbox-prev');
  var nextButton = dialog.querySelector('.lightbox-next');
  var multiple = links.length > 1;
  var index = 0;
  var closeTimer;

  prevButton.hidden = nextButton.hidden = counter.hidden = !multiple;

  /* ------------------------------------------------------------------ Zoom */

  // The card is scaled around its own center and shifted by (x, y). Zooming keeps whatever is
  // at the center of the screen in place, so the pointer position never matters.
  var view = { scale: 1, x: 0, y: 0 };

  function animationsOn() {
    return !(reduceMotion && reduceMotion.matches);
  }

  function applyView(animate) {
    zoomBox.style.transition = animate && animationsOn() ? 'transform 0.18s ease-out' : 'none';
    zoomBox.style.transform = 'translate(' + view.x + 'px, ' + view.y + 'px) scale(' + view.scale + ')';
    zoomBox.classList.toggle('is-zoomed', view.scale > 1);
  }

  // Card center (unzoomed layout position) relative to the screen center.
  function centerOffset() {
    return {
      x: zoomBox.offsetLeft + zoomBox.offsetWidth / 2 - dialog.clientWidth / 2,
      y: zoomBox.offsetTop + zoomBox.offsetHeight / 2 - dialog.clientHeight / 2
    };
  }

  // While the zoomed card fits on screen it stays centered; once it is larger than the screen
  // it can be panned, but always covers the screen (no empty gaps at the edges).
  function fit(offset, center, size, viewport) {
    var half = (size * view.scale - viewport) / 2;
    if (half <= 0) return 0;
    return Math.min(half - center, Math.max(-half - center, offset));
  }

  function clamp() {
    if (view.scale === MIN_SCALE) { view.x = view.y = 0; return; }
    var c = centerOffset();
    view.x = fit(view.x, c.x, zoomBox.offsetWidth, dialog.clientWidth);
    view.y = fit(view.y, c.y, zoomBox.offsetHeight, dialog.clientHeight);
  }

  function zoomTo(scale, animate) {
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    // Keep the point at the screen center fixed: its offset from the card center scales with the card.
    var c = centerOffset();
    var ratio = scale / view.scale;
    view.x = (view.x + c.x) * ratio - c.x;
    view.y = (view.y + c.y) * ratio - c.y;
    view.scale = scale;
    clamp();
    applyView(animate);
  }

  function resetView() {
    view = { scale: 1, x: 0, y: 0 };
    applyView(false);
  }

  dialog.addEventListener('wheel', function (event) {
    event.preventDefault();
    var delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
    // Trackpad pinches arrive as ctrl+wheel with small, frequent deltas: follow them directly.
    // Mouse wheels move in large notches: smooth each step with a short transition.
    var factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015));
    zoomTo(view.scale * factor, !event.ctrlKey);
  }, { passive: false });

  zoomBox.addEventListener('dblclick', function () {
    zoomTo(view.scale > 1 ? 1 : 2.5, true);
  });

  /* ------------------------------------------------- Drag, pinch and swipe */

  var pointers = {};
  var gesture = null;
  var suppressClick = false;

  function pointerList() {
    return Object.keys(pointers).map(function (id) { return pointers[id]; });
  }

  function startGesture() {
    var list = pointerList();
    if (list.length >= 2) {
      var a = list[0], b = list[1];
      gesture = { type: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: view.scale, moved: false };
    } else if (list.length === 1) {
      gesture = { type: 'drag', startX: list[0].x, startY: list[0].y, viewX: view.x, viewY: view.y, moved: false };
    } else {
      gesture = null;
    }
  }

  dialog.addEventListener('pointerdown', function (event) {
    if (event.target.closest('.lightbox-btn')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    startGesture();
  });

  dialog.addEventListener('pointermove', function (event) {
    if (!pointers[event.pointerId] || !gesture) return;
    pointers[event.pointerId] = { x: event.clientX, y: event.clientY };

    if (gesture.type === 'pinch') {
      var list = pointerList();
      var distance = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      zoomTo(gesture.scale * distance / gesture.distance, false);
      gesture.moved = true;
      return;
    }

    var dx = event.clientX - gesture.startX;
    var dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
    gesture.moved = true;
    if (view.scale > 1) {
      if (!dialog.hasPointerCapture(event.pointerId)) dialog.setPointerCapture(event.pointerId);
      view.x = gesture.viewX + dx;
      view.y = gesture.viewY + dy;
      clamp();
      applyView(false);
      zoomBox.classList.add('is-dragging');
    }
  });

  function endPointer(event) {
    if (!pointers[event.pointerId]) return;
    var finished = gesture;
    delete pointers[event.pointerId];
    zoomBox.classList.remove('is-dragging');

    if (finished && finished.moved) {
      suppressClick = true; // the click that follows a drag must not close the viewer
      setTimeout(function () { suppressClick = false; }, 0);
      // A horizontal swipe on the unzoomed card moves to the next or previous figure.
      if (finished.type === 'drag' && view.scale === 1 && event.type === 'pointerup') {
        var dx = event.clientX - finished.startX;
        var dy = event.clientY - finished.startY;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
      }
    }
    startGesture();
    // After a pinch ends, keep the remaining finger from counting as a swipe.
    if (gesture && finished && finished.type === 'pinch') gesture.moved = true;
  }

  dialog.addEventListener('pointerup', endPointer);
  dialog.addEventListener('pointercancel', endPointer);

  /* ------------------------------------------------------------ Navigation */

  function captionFor(link) {
    var figure = link.closest('figure');
    var figcaption = figure && figure.querySelector('figcaption');
    if (figcaption) return figcaption.textContent.trim();
    // Sub-project figures have no caption of their own; use the sub-project heading instead.
    var heading = link.closest('.subproject') && link.closest('.subproject').querySelector('h3');
    return heading ? heading.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function show(i) {
    index = (i + links.length) % links.length;
    var link = links[index];
    var thumb = link.querySelector('img');
    var text = captionFor(link);

    resetView();
    image.src = link.href;
    image.alt = thumb ? thumb.alt : '';
    if (thumb && thumb.getAttribute('width')) {
      image.width = thumb.getAttribute('width');
      image.height = thumb.getAttribute('height');
    }
    caption.textContent = text;
    caption.hidden = !text;
    counter.textContent = (index + 1) + ' / ' + links.length;
    dialog.setAttribute('aria-label', text || image.alt);
  }

  function open(i) {
    clearTimeout(closeTimer);
    show(i);
    document.documentElement.classList.add('lightbox-open');
    if (!dialog.open) dialog.showModal();
    closeButton.focus();
    // Start the fade-in on the next frame so the transition runs from the closed state.
    requestAnimationFrame(function () { dialog.classList.add('is-visible'); });
  }

  function close() {
    if (!dialog.open) return;
    dialog.classList.remove('is-visible');
    closeTimer = setTimeout(function () { dialog.close(); }, animationsOn() ? 200 : 0);
  }

  links.forEach(function (link, i) {
    link.addEventListener('click', function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(i);
    });
  });

  closeButton.addEventListener('click', close);
  prevButton.addEventListener('click', function () { show(index - 1); });
  nextButton.addEventListener('click', function () { show(index + 1); });

  dialog.addEventListener('keydown', function (event) {
    if (!multiple) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
  });

  // A click on the dimmed area (the dialog itself, outside the card) closes the viewer.
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog && !suppressClick) close();
  });

  // Esc: run the same fade-out instead of the dialog's instant close.
  dialog.addEventListener('cancel', function (event) {
    event.preventDefault();
    close();
  });

  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('lightbox-open');
    pointers = {};
    gesture = null;
    resetView();
    image.removeAttribute('src');
  });

  // A window resize changes the card's layout size, which can leave a zoomed view out of bounds.
  window.addEventListener('resize', function () {
    if (dialog.open) { clamp(); applyView(false); }
  });
})();
