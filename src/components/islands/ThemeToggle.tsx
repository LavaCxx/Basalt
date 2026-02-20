import { createSignal, onMount, createEffect } from 'solid-js';
import { persistentAtom } from '@nanostores/persistent';
import { useStore } from '@nanostores/solid';

// Persistent store for theme preference
const themeStore = persistentAtom<'light' | 'dark' | 'system'>('theme', 'system');

// Get system preference
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Apply theme to document
function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  const html = document.documentElement;

  if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

export default function ThemeToggle() {
  const theme = useStore(themeStore);
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);

    // Apply initial theme
    const currentTheme = theme();
    const effectiveTheme = currentTheme === 'system' ? getSystemTheme() : currentTheme;
    applyTheme(effectiveTheme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (themeStore.get() === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  });

  // Apply theme when it changes
  createEffect(() => {
    if (!mounted()) return;

    const currentTheme = theme();
    const effectiveTheme = currentTheme === 'system' ? getSystemTheme() : currentTheme;
    applyTheme(effectiveTheme);
  });

  const cycleTheme = () => {
    const current = themeStore.get();
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    themeStore.set(next);
  };

  const getIcon = () => {
    const current = theme();
    if (current === 'system') return SystemIcon;
    if (current === 'dark') return MoonIcon;
    return SunIcon;
  };

  const getLabel = () => {
    const current = theme();
    if (current === 'system') return 'System theme';
    if (current === 'dark') return 'Dark theme';
    return 'Light theme';
  };

  return (
    <button
      onClick={cycleTheme}
      class="fixed bottom-4 right-4 p-3 rounded-full bg-background border border-border shadow-lg hover:border-text-muted transition-all z-50"
      aria-label={getLabel()}
      title={getLabel()}
    >
      <span class="block w-5 h-5 text-text-primary">
        {getIcon()}
      </span>
    </button>
  );
}

// Icon components
function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
