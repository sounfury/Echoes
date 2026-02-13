import { atom } from 'nanostores';

export type ThemeMode = 'light' | 'dark' | 'system';

export const $themeMode = atom<ThemeMode>('system');
export const $resolvedTheme = atom<'light' | 'dark'>('light');

export function setThemeMode(mode: ThemeMode) {
    $themeMode.set(mode);
    if (typeof window !== 'undefined') {
        localStorage.setItem('theme-mode', mode);
    }
}

export function initTheme() {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem('theme-mode') as ThemeMode | null;
    const mode = stored ?? 'system';
    $themeMode.set(mode);

    const resolved = mode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : mode;

    $resolvedTheme.set(resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
}
