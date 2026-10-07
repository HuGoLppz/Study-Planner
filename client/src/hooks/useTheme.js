import { useEffect } from 'react';

const STORAGE_KEY = 'sp-theme';

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'system';
  } catch {
    return 'system';
  }
}

// Aplica el tema elegido (system | light | dark) en <html data-theme> y sigue al sistema si toca.
export function useTheme(preference) {
  useEffect(() => {
    const choice = preference ?? readStored();
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Sin almacenamiento: el tema se aplica igualmente en esta sesión.
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = choice === 'dark' || (choice === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (choice !== 'system') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
}
