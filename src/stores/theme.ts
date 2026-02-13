import { atom, computed } from 'nanostores';

export type ThemeMode = 'light' | 'dark';

export const $themeMode = atom<ThemeMode>('light');

export const $isDark = computed($themeMode, theme => theme === 'dark');

/**
 * 初始化主题 — 在 页面加载 / View Transitions swap 后调用
 * 内联脚本已防 FOUC，这里同步 store 并注册 View Transitions 钩子
 */
export function initTheme() {
    if (typeof window === 'undefined') return;

    const mode: ThemeMode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    $themeMode.set(mode);

    // View Transitions: 在新文档 swap 前同步 dark class
    document.addEventListener('astro:before-swap', (e: any) => {
        const stored = localStorage.getItem('theme-mode') as ThemeMode | null;
        const isDark = stored ? stored === 'dark' : document.documentElement.classList.contains('dark');
        e.newDocument.documentElement.classList.toggle('dark', isDark);
    }, { once: true });
}

/**
 * 切换主题
 */
export function toggleTheme() {
    const current = $themeMode.get();
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark';

    $themeMode.set(next);
    applyTheme(next);

    if (typeof window !== 'undefined') {
        localStorage.setItem('theme-mode', next);
    }
}

function applyTheme(mode: ThemeMode) {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.toggle('dark', mode === 'dark');
}
