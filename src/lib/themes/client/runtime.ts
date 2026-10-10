/**
 * 主题运行时（浏览器端）：切换主题 / 模式、持久化、ClientRouter 换页时搬运主题。
 *
 * 首屏防闪烁由 BaseLayout <head> 里的同步内联脚本完成（document.write 阻塞渲染的 <link>），
 * 本模块只负责之后的交互。
 */
import type { StoredThemeState, ThemeChangeDetail, ThemeManifestItem, ThemeMode } from '../types';
import type { WorldlineShift } from './worldline';
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

/**
 * 可替换文案：把带 data-copy 的锚点文本换成主题文案；主题没有对应文案时恢复 data-ui-default。
 * 查找顺序：copy["<anchor>@<page>"] → copy["<anchor>"] → data-ui-default。
 * 首屏由 BaseLayout 内联脚本（同样的逻辑）在绘制前完成，这里负责切换主题和 ClientRouter 新文档。
 */
export function applyCopy(doc: Document, theme: string): void {
    const copy = getThemeItem(theme)?.copy ?? {};
    const page = doc.documentElement.dataset.page ?? '';
    doc.querySelectorAll<HTMLElement>('[data-copy]').forEach((el) => {
        const key = el.dataset.ui ?? '';
        const value = copy[`${key}@${page}`] ?? copy[key] ?? el.dataset.uiDefault;
        if (value == null) return;
        if (el.textContent !== value) el.textContent = value;
        if (el.dataset.text !== undefined) el.dataset.text = value;
    });
}

const WORLDLINE_SEEN_KEY = 'echoes:worldlines-seen';

/** 本次会话里已经播过完整世界线演出的主题 */
function seenWorldlines(): string[] {
    try {
        const parsed = JSON.parse(sessionStorage.getItem(WORLDLINE_SEEN_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function markWorldlineSeen(id: string) {
    try {
        const seen = seenWorldlines();
        if (!seen.includes(id)) sessionStorage.setItem(WORLDLINE_SEEN_KEY, JSON.stringify([...seen, id]));
    } catch {
        /* 隐私模式等情况下忽略 */
    }
}

/** 从 fromId 切到 toId 的世界线变动；新主题没有声明 worldline 时不播 */
function worldlineShift(fromId: string, toId: string): WorldlineShift | undefined {
    const to = getThemeItem(toId)?.worldline;
    if (!to) return undefined;
    return {
        from: getThemeItem(fromId)?.worldline?.divergence ?? to.divergence,
        to: to.divergence,
        line: to.line,
        brief: seenWorldlines().includes(toId),
    };
}

/** 页脚常驻的当前世界线变动率（[data-ui="worldline"]）；首屏由 BaseLayout 内联脚本填好 */
export function applyWorldline(doc: Document, theme: string): void {
    const worldline = getThemeItem(theme)?.worldline;
    doc.querySelectorAll<HTMLElement>('[data-ui="worldline"]').forEach((el) => {
        el.hidden = !worldline;
        el.textContent = worldline ? `世界线变动率 ${worldline.divergence}` : '';
        if (worldline?.line) el.title = worldline.line;
        else el.removeAttribute('title');
    });
}

function themeLinks(): HTMLLinkElement[] {
    return Array.from(document.querySelectorAll<HTMLLinkElement>(THEME_LINK_SELECTOR));
}

/** 已发起预加载、还没启用的样式表（href → link），避免重复下载 */
const preloaded = new Map<string, Promise<HTMLLinkElement>>();

/** 预加载样式表：media="not all" 时会下载但不生效，onload 后再启用 */
function preloadLink(href: string): Promise<HTMLLinkElement> {
    const cached = preloaded.get(href);
    if (cached) return cached;
    const pending = new Promise<HTMLLinkElement>((resolve) => {
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
    preloaded.set(href, pending);
    return pending;
}

/** 样式表里引用的图片 / 字体（url(...)），解析成绝对地址 */
function collectAssetUrls(link: HTMLLinkElement): string[] {
    const urls = new Set<string>();
    const walk = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
            const nested = (rule as CSSGroupingRule).cssRules;
            if (nested?.length) {
                walk(nested);
                continue;
            }
            for (const m of rule.cssText.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
                if (!m[1].startsWith('data:') && !m[1].startsWith('#')) urls.add(new URL(m[1], link.href).href);
            }
        }
    };
    try {
        if (link.sheet) walk(link.sheet.cssRules);
    } catch {
        /* 跨域样式表读不到规则：只预加载 CSS 本身 */
    }
    return [...urls];
}

const warmedAssets = new Set<string>();

function warmAsset(url: string) {
    if (warmedAssets.has(url)) return;
    warmedAssets.add(url);
    if (/\.(woff2?|ttf|otf)(\?|$)/i.test(url)) {
        void fetch(url).catch(() => {});
    } else {
        new Image().src = url;
    }
}

/**
 * 提前把其他主题需要的东西下载好（打开主题菜单时调用）：theme.css、里面引用的图片和字体、
 * 世界线变动的模块与数字字体。这样点击后立刻开演，落定时立绘等图片也已就位。
 * 开启了省流量模式时不预加载。
 */
export function preloadThemes(): void {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const current = getCurrentTheme().theme;
    const active = new Set(themeLinks().filter((l) => !l.media).map((l) => l.getAttribute('href')));
    let needsWorldline = false;
    for (const id of listThemeIds()) {
        const item = getThemeItem(id);
        if (!item || id === current) continue;
        needsWorldline ||= !!item.worldline;
        for (const href of item.css) {
            if (active.has(href)) continue;
            void preloadLink(href).then((link) => collectAssetUrls(link).forEach(warmAsset));
        }
    }
    if (needsWorldline) {
        void import('./worldline')
            .then((m) => {
                worldlineModule ??= m;
                return m.warmWorldline();
            })
            .catch(() => {});
    }
}

type WorldlineModule = typeof import('./worldline');
let worldlineModule: WorldlineModule | null = null;

/**
 * 执行主题替换并播放转场。
 * 切换主题且新主题声明了 worldline 时播放"世界线变动"（见 worldline.ts）；
 * 其余情况（切明暗、主题没有世界线）用 View Transition 的交叉淡化，不支持或开启减弱动效时直接替换。
 */
async function runTransition(update: () => void | Promise<void>, worldline?: WorldlineShift): Promise<void> {
    let ran = false;
    const once = () => {
        if (ran) return;
        ran = true;
        return update();
    };
    if (worldline && !document.hidden) {
        try {
            worldlineModule ??= await import('./worldline');
            await worldlineModule.playWorldlineShift(worldline, once);
        } catch (err) {
            console.warn('[themes] worldline shift failed', err);
        }
        if (ran) return;
    }
    const doc = document as Document & {
        startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition === 'function' && !prefersReducedMotion() && !document.hidden) {
        await doc.startViewTransition(once).finished.catch(() => {});
    }
    await once();
}

/** 样式表真正生效（已解析出 sheet）后 resolve；挪动过的 <link> 会重新加载，要等它 */
function whenApplied(link: HTMLLinkElement): Promise<void> {
    if (link.sheet) return Promise.resolve();
    return new Promise((resolve) => {
        const done = () => {
            clearTimeout(timer);
            link.removeEventListener('load', done);
            link.removeEventListener('error', done);
            resolve();
        };
        const timer = setTimeout(done, 4000);
        link.addEventListener('load', done);
        link.addEventListener('error', done);
    });
}

function dispatchChange(detail: ThemeChangeDetail) {
    document.dispatchEvent(new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, { detail }));
}

let switching: Promise<void> = Promise.resolve();

/**
 * 切换主题（以及可选的模式）。先把新样式表加载完，再在 View Transition 里一次性替换，避免空白期。
 */
export function switchTheme(id: string, mode?: ThemeMode): Promise<void> {
    // 上一次转场还在播时直接跳到结尾，连续切换不用等
    worldlineModule?.skipWorldlineShift();
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

    const worldline = worldlineShift(prev.theme, themeId);
    const oldLinks = themeLinks();
    // 已经生效的 CSS（父主题等）直接复用，其余等预加载完成（打开菜单时可能已经下好）
    const keep = new Map(oldLinks.filter((l) => !l.media).map((l) => [l.getAttribute('href'), l]));
    const nextLinks = await Promise.all(
        next.css.map((href) => keep.get(href) ?? preloadLink(href)),
    );
    // 这些 link 即将启用或移除，不再算"预加载中"
    preloaded.clear();

    await runTransition(() => {
        oldLinks.filter((l) => !nextLinks.includes(l)).forEach((l) => l.remove());
        nextLinks.forEach((l) => l.removeAttribute('media'));
        // 子主题必须在父主题之后。顺序已经正确时不要动节点：
        // 挪动 <link> 会让浏览器重新加载它，加载完之前页面处于没有主题样式的状态
        const ordered = themeLinks().every((l, i) => l === nextLinks[i]);
        if (!ordered) nextLinks.forEach((l) => document.head.appendChild(l));
        applyAttrs(document.documentElement, themeId, mode);
        applyThemeColor(document, themeId);
        applyCopy(document, themeId);
        applyWorldline(document, themeId);
        return Promise.all(nextLinks.map(whenApplied)).then(() => {});
    }, worldline);
    if (worldline) markWorldlineSeen(themeId);

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

    worldlineModule?.skipWorldlineShift();
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
        applyCopy(newDoc, theme);
        applyWorldline(newDoc, theme);
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
