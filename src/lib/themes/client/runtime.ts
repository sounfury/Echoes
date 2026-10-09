/**
 * 主题运行时（浏览器端）：切换主题 / 模式、持久化、ClientRouter 换页时搬运主题。
 *
 * 首屏防闪烁由 BaseLayout <head> 里的同步内联脚本完成（document.write 阻塞渲染的 <link>），
 * 本模块只负责之后的交互。
 */
import type { StoredThemeState, ThemeChangeDetail, ThemeManifestItem, ThemeMode } from '../types';
import { emitEffectsEvent, mountEffects, prefersReducedMotion, unmountEffects } from './effects';

export const THEME_STORAGE_KEY = 'echoes:theme';
const LEGACY_MODE_KEY = 'theme-mode';
/** switchTheme / setMode 完成后在 document 上派发，detail: ThemeChangeDetail */
export const THEME_CHANGE_EVENT = 'echoes:theme-change';

const THEME_LINK_SELECTOR = 'link[data-theme-css]';

function manifest() {
    return window.__THEMES__ ?? {};
}

function defaults() {
    return window.__THEME_DEFAULTS__ ?? { theme: 'default', mode: 'light' as ThemeMode };
}

export function listThemeIds(): string[] {
    return Object.keys(manifest());
}

export function getThemeItem(id: string): ThemeManifestItem | undefined {
    return manifest()[id];
}

export function readStoredTheme(): StoredThemeState {
    try {
        const parsed = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeStoredTheme(state: StoredThemeState) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(state));
        localStorage.removeItem(LEGACY_MODE_KEY);
    } catch {
        /* 隐私模式等情况下忽略 */
    }
}

/** 主题只支持一种模式时强制使用该模式 */
export function pickMode(schemes: ThemeMode[], preferred?: string | null): ThemeMode {
    return schemes.includes(preferred as ThemeMode) ? (preferred as ThemeMode) : schemes[0];
}

export function getCurrentTheme(): { theme: string; mode: ThemeMode } {
    const h = document.documentElement;
    return {
        theme: h.dataset.theme || defaults().theme,
        mode: h.dataset.mode === 'dark' ? 'dark' : 'light',
    };
}

/** 把主题状态写到某个 <html>（当前文档或 ClientRouter 的新文档） */
function applyAttrs(root: HTMLElement, theme: string, mode: ThemeMode) {
    const item = getThemeItem(theme);
    root.dataset.theme = theme;
    root.dataset.mode = mode;
    root.dataset.schemes = (item?.schemes ?? ['light', 'dark']).join(' ');
    root.classList.toggle('dark', mode === 'dark');
}

function applyThemeColor(doc: Document, theme: string) {
    const color = getThemeItem(theme)?.themeColor;
    const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta && color) meta.content = color;
}

function themeLinks(): HTMLLinkElement[] {
    return Array.from(document.querySelectorAll<HTMLLinkElement>(THEME_LINK_SELECTOR));
}

/** 预加载样式表：media="not all" 时会下载但不生效，onload 后再启用 */
function preloadLink(href: string): Promise<HTMLLinkElement> {
    return new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.media = 'not all';
        link.setAttribute('data-theme-css', '');
        link.onload = () => resolve(link);
        link.onerror = () => {
            console.error(`[themes] failed to load ${href}`);
            resolve(link);
        };
        document.head.appendChild(link);
    });
}

function runTransition(update: () => void): Promise<void> {
    const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition === 'function' && !prefersReducedMotion()) {
        return doc.startViewTransition(update).finished.catch(() => {});
    }
    update();
    return Promise.resolve();
}

function dispatchChange(detail: ThemeChangeDetail) {
    document.dispatchEvent(new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, { detail }));
}

let switching: Promise<void> = Promise.resolve();

/**
 * 切换主题（以及可选的模式）。先把新样式表加载完，再在 View Transition 里一次性替换，避免空白期。
 */
export function switchTheme(id: string, mode?: ThemeMode): Promise<void> {
    switching = switching.then(() => doSwitch(id, mode));
    return switching;
}

async function doSwitch(id: string, requestedMode?: ThemeMode) {
    const prev = getCurrentTheme();
    const themeId = getThemeItem(id) ? id : defaults().theme;
    const next = getThemeItem(themeId);
    if (!next) return;
    // 用户偏好的模式；主题只支持一种模式时会被强制，但偏好照样保存，换回双模式主题时恢复
    const preferred = requestedMode ?? readStoredTheme().mode ?? prev.mode;
    const mode = pickMode(next.schemes, preferred);

    if (themeId === prev.theme) {
        if (mode !== prev.mode) await setMode(mode);
        return;
    }

    const oldLinks = themeLinks();
    const keep = new Map(oldLinks.map((l) => [l.getAttribute('href'), l]));
    // 父主题等已挂载的 CSS 直接复用，其余并行预加载
    const nextLinks = await Promise.all(
        next.css.map((href) => keep.get(href) ?? preloadLink(href)),
    );

    await runTransition(() => {
        oldLinks.filter((l) => !nextLinks.includes(l)).forEach((l) => l.remove());
        // 按主题链顺序重新排列，保证子主题在父主题之后
        nextLinks.forEach((l) => {
            l.removeAttribute('media');
            document.head.appendChild(l);
        });
        applyAttrs(document.documentElement, themeId, mode);
        applyThemeColor(document, themeId);
    });

    writeStoredTheme({ theme: themeId, mode: preferred });
    dispatchChange({ theme: themeId, mode, previousTheme: prev.theme, previousMode: prev.mode });

    await unmountEffects();
    await mountEffects(themeId, mode);
}

/** 只切换明暗模式；当前主题不支持该模式时忽略 */
export async function setMode(mode: ThemeMode): Promise<void> {
    const prev = getCurrentTheme();
    const item = getThemeItem(prev.theme);
    if (!item || !item.schemes.includes(mode) || mode === prev.mode) return;

    await runTransition(() => applyAttrs(document.documentElement, prev.theme, mode));
    writeStoredTheme({ theme: prev.theme, mode });
    const detail: ThemeChangeDetail = { theme: prev.theme, mode, previousTheme: prev.theme, previousMode: prev.mode };
    dispatchChange(detail);
    emitEffectsEvent('theme-change', detail);
}

export function toggleMode(): Promise<void> {
    const { mode } = getCurrentTheme();
    return setMode(mode === 'dark' ? 'light' : 'dark');
}

/** 订阅主题变化，返回取消订阅函数 */
export function onThemeChange(cb: (detail: ThemeChangeDetail) => void): () => void {
    const handler = (e: Event) => cb((e as CustomEvent<ThemeChangeDetail>).detail);
    document.addEventListener(THEME_CHANGE_EVENT, handler);
    return () => document.removeEventListener(THEME_CHANGE_EVENT, handler);
}

/** JS 里需要颜色时用它读取接口变量（例如 readThemeVar('--c-accent')），并配合 onThemeChange 刷新 */
export function readThemeVar(name: string, el: Element = document.documentElement): string {
    return getComputedStyle(el).getPropertyValue(name).trim();
}

let initialized = false;

/**
 * 初始化一次（重复调用无副作用）：
 * - astro:before-swap：把当前主题的 <link> 与 html 上的 data-* / .dark 搬到新文档
 * - 挂载当前主题的 effects；reduced-motion 变化时重新挂载
 */
export function initThemeRuntime(): void {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;

    document.addEventListener('astro:before-swap', (e) => {
        const newDoc = (e as Event & { newDocument: Document }).newDocument;
        const { theme, mode } = getCurrentTheme();
        applyAttrs(newDoc.documentElement, theme, mode);
        applyThemeColor(newDoc, theme);
        // 新文档 head 里放入同 href 的 link，Astro 的 head 对比会保留现有节点，不会重新下载
        newDoc.head.querySelectorAll(THEME_LINK_SELECTOR).forEach((l) => l.remove());
        themeLinks().forEach((l) => newDoc.head.appendChild(newDoc.importNode(l, true)));
    });

    document.addEventListener('astro:after-swap', () => emitEffectsEvent('page-swap'));
    document.addEventListener('visibilitychange', () =>
        emitEffectsEvent('visibility-change', { hidden: document.hidden }),
    );

    // 多标签页同步
    window.addEventListener('storage', (e) => {
        if (e.key !== THEME_STORAGE_KEY) return;
        const s = readStoredTheme();
        if (s.theme) void switchTheme(s.theme, s.mode);
    });

    const remount = async () => {
        const { theme, mode } = getCurrentTheme();
        await unmountEffects();
        await mountEffects(theme, mode);
    };
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => void remount());

    const start = () => void remount();
    if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(start);
    } else {
        setTimeout(start, 200);
    }
}
