import { atom, computed } from 'nanostores';
import type { ThemeMode } from '../lib/themes/types';
import {
    getCurrentTheme,
    initThemeRuntime,
    onThemeChange,
    switchTheme as runtimeSwitchTheme,
    toggleMode,
} from '../lib/themes/client/runtime';

export type { ThemeMode };

export const $themeMode = atom<ThemeMode>('light');
export const $themeId = atom<string>('default');

export const $isDark = computed($themeMode, theme => theme === 'dark');

let subscribed = false;

/**
 * 初始化主题 — 在 页面加载 / View Transitions swap 后调用
 * 首屏防闪烁由 BaseLayout 内联脚本完成；这里同步 store，并初始化主题运行时
 * （运行时负责在 astro:before-swap 把主题 <link>、data-theme/data-mode、.dark 搬到新文档）
 */
export function initTheme() {
    if (typeof window === 'undefined') return;

    const { theme, mode } = getCurrentTheme();
    $themeId.set(theme);
    $themeMode.set(mode);

    initThemeRuntime();
    if (!subscribed) {
        subscribed = true;
        onThemeChange(({ theme: nextTheme, mode: nextMode }) => {
            $themeId.set(nextTheme);
            $themeMode.set(nextMode);
        });
    }
}

/**
 * 切换明暗模式（当前主题只支持一种模式时无效）
 */
export function toggleTheme() {
    return toggleMode();
}

/**
 * 切换主题包
 */
export function switchTheme(id: string, mode?: ThemeMode) {
    return runtimeSwitchTheme(id, mode);
}
