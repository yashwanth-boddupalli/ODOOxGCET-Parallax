import { useSyncExternalStore } from 'react';

// Light, dark, or follow the device. The choice is saved per browser; index.html applies it
// before the first paint (same storage key) so the page never flashes the wrong theme.
const STORAGE_KEY = 'stocksense-theme';
const CHOICES = ['light', 'dark', 'system'];
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

function readChoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CHOICES.includes(saved) ? saved : 'light';
  } catch {
    return 'light';
  }
}

let choice = readChoice();

function apply() {
  const dark = choice === 'dark' || (choice === 'system' && systemDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setTheme(next) {
  choice = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage blocked (private mode): the theme still applies, it just won't be remembered.
  }
  apply();
  listeners.forEach((notify) => notify());
}

// Follow the device while on "system", and keep other open tabs in step.
systemDark.addEventListener('change', () => choice === 'system' && apply());
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  choice = readChoice();
  apply();
  listeners.forEach((notify) => notify());
});
apply();

function subscribe(notify) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => choice);
  return { theme, setTheme };
}
