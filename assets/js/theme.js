// This script runs in the head to apply the theme before the page is painted.

const THEME_STORAGE_KEY = 'theme';

function getPreferredTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme, persist = false, animate = false) {
  if (animate) {
    document.documentElement.classList.add('transition');
    window.setTimeout(() => {
      document.documentElement.classList.remove('transition');
    }, 500);
  }

  document.documentElement.setAttribute('data-theme', theme);
  if (persist) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme, true, true);
}

function updateThemeToggle(button) {
  const darkModeEnabled = document.documentElement.getAttribute('data-theme') === 'dark';
  button.setAttribute('aria-label', darkModeEnabled ? 'Switch to light mode' : 'Switch to dark mode');
  button.setAttribute('aria-pressed', String(darkModeEnabled));
}

setTheme(getPreferredTheme());
