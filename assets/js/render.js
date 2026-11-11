// Renders the publication / patent lists and the overview summary from data.js.
// Each render function only runs when its target element exists on the page.
(function () {
  'use strict';

  var DATA = window.HCDRC_DATA || {};
  var PUBS = DATA.publications || [];
  var PATENTS = DATA.patents || [];

  var PUB_TYPES = { conference: 'Conference', journal: 'Journal' };


  // Site root derived from this script's own URL (…/assets/js/render.js), so generated links
  // work both on GitHub Pages and when the HTML files are opened directly from disk.
  var SCRIPT = document.currentScript && document.currentScript.src;
  var ROOT = SCRIPT ? SCRIPT.replace(/assets\/js\/render\.js(\?.*)?$/, '') : '/';
  var PUB_PAGE = ROOT + 'publications/index.html';
  var PATENT_PAGE = ROOT + 'patents/index.html';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function list(names) {
    return (names || []).map(esc).join(', ');
  }

  function count(items, pred) {
    return items.filter(pred).length;
  }

  function emptyState(text) {
    return '<p class="empty-state">' + esc(text) + '</p>';
  }

  // "1 publication" / "19 publications"
  function countLabel(n, unit) {
    return n + ' ' + (n === 1 ? unit[0] : unit[1]);
  }

  // Groups items (already sorted newest first) under a heading per key.
  // unit: [singular, plural] noun shown next to each group's count.
  function grouped(items, keyOf, renderItem, unit) {
    var html = '';
    var current;
    items.forEach(function (item, i) {
      var key = keyOf(item);
      if (i === 0 || key !== current) {
        if (i > 0) html += '</ol>';
        var n = count(items, function (x) { return keyOf(x) === key; });
        html += '<h2 class="year-heading" id="y' + esc(key) + '">' + esc(key) +
          ' <span class="count">' + countLabel(n, unit) + '</span></h2><ol class="bibliography">';
        current = key;
      }
      html += renderItem(item);
    });
    return html + '</ol>';
  }

  function people(label, names) {
    return names && names.length ? '<span class="people-label">' + label + '</span> ' + list(names) : '';
  }

  /* ---------------------------------------------------------- Publications */

  function credits(professors, students) {
    var profLabel = professors && professors.length > 1 ? 'Professors' : 'Professor';
    var studentLabel = students && students.length > 1 ? 'Students' : 'Student';
    var parts = [people(profLabel, professors), people(studentLabel, students)].filter(Boolean);
    return parts.length ? '<div class="meta">' + parts.join(' <span class="sep">·</span> ') + '</div>' : '';
  }

  function publicationItem(p) {
    return '<li>' +
      '<span class="tag">' + esc(PUB_TYPES[p.type] || p.type) + '</span>' +
      (p.type === 'journal' && p.sci ? '<span class="tag tag-soft">' + esc(p.sci) + '</span>' : '') +
      (p.jcrTop10 ? '<span class="tag tag-strong">JCR Top 10%</span>' : '') +
      '<span class="title">' + esc(p.title) + '</span>' +
      '<div class="periodical">' + esc(p.venue) + (p.year ? ' ' + esc(p.year) : '') + '</div>' +
      credits(p.faculty, p.students) +
      '</li>';
  }

  function renderPublications(el) {
    if (!PUBS.length) {
      el.innerHTML = emptyState('No publications yet.');
      return;
    }
    el.innerHTML = grouped(PUBS, function (p) { return p.year || 'Unknown'; }, publicationItem, ['publication', 'publications']);
  }

  /* --------------------------------------------------------------- Patents */

  function patentItem(p) {
    var dates = [];
    if (p.filed) dates.push('Filed ' + esc(p.filed));
    if (p.registered) dates.push('Registered ' + esc(p.registered));
    // 3극 특허: show the furthest stage reached (registration implies filing).
    var triadic = p.triadicRegistered ? '<span class="tag tag-strong">Triadic Registered</span>'
      : (p.triadicFiled ? '<span class="tag tag-soft">Triadic Filed</span>' : '');
    return '<li>' +
      '<span class="tag">' + esc(p.country) + '</span>' + triadic +
      '<span class="title">' + esc(p.title) + '</span>' +
      (dates.length ? '<div class="periodical">' + dates.join(' · ') + '</div>' : '') +
      credits(p.professors, p.students) +
      '</li>';
  }

  function patentSection(id, heading, items, unit) {
    if (!items.length) return '';
    return '<h2 class="year-heading" id="' + id + '">' + esc(heading) +
      ' <span class="count">' + countLabel(items.length, unit) + '</span></h2>' +
      '<ol class="bibliography">' + items.map(patentItem).join('') + '</ol>';
  }

  function renderPatents(el) {
    if (!PATENTS.length) {
      el.innerHTML = emptyState('No patents yet.');
      return;
    }
    // data.js lists registered patents first (newest registration first), then applications.
    el.innerHTML =
      patentSection('registered', 'Registered Patents',
        PATENTS.filter(function (p) { return p.status === 'registered'; }), ['patent', 'patents']) +
      patentSection('applications', 'Patent Applications',
        PATENTS.filter(function (p) { return p.status !== 'registered'; }), ['application', 'applications']);
  }

  /* -------------------------------------------------------------- Overview */

  function breakdown(items, field, labels) {
    var counts = {};
    var order = [];
    items.forEach(function (x) {
      var k = x[field];
      if (!(k in counts)) { counts[k] = 0; order.push(k); }
      counts[k] += 1;
    });
    return order.map(function (k) { return (labels && labels[k] || k) + ' ' + counts[k]; }).join(' · ');
  }

  function stat(href, number, label, sub) {
    return '<a class="stat" href="' + href + '">' +
      '<span class="stat-num">' + number + '</span>' +
      '<span class="stat-label">' + esc(label) + '</span>' +
      '<span class="stat-sub">' + esc(sub || '—') + '</span>' +
      '</a>';
  }

  function renderStats(el) {
    el.innerHTML =
      stat(PUB_PAGE, PUBS.length, 'Publications', breakdown(PUBS, 'type', PUB_TYPES)) +
      stat(PATENT_PAGE, PATENTS.length, 'Patents', breakdown(PATENTS, 'status', { registered: 'Registered', filed: 'Filed' }));
  }

  /* ------------------------------------------------------------------ Init */

  var targets = {
    'publication-list': renderPublications,
    'patent-list': renderPatents,
    'output-stats': renderStats
  };

  Object.keys(targets).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) targets[id](el);
  });

  // Re-apply the URL hash after rendering so links such as /publications/#y2025 land on the right heading.
  if (window.location.hash) {
    var target = document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView();
  }
})();
