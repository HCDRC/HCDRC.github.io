// Runs in <head> so the color theme is applied before the page is painted.
// The theme always follows the operating-system setting (prefers-color-scheme)
// and updates live if that setting changes while the page is open.
(function () {
  var query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function apply() {
    document.documentElement.setAttribute('data-theme', query && query.matches ? 'dark' : 'light');
  }

  apply();
  if (query) {
    if (query.addEventListener) query.addEventListener('change', apply);
    else if (query.addListener) query.addListener(apply); // older Safari
  }
})();
