/**
 * 主题 JS 效果的挂载 / 卸载（浏览器端）。
 * 规则（见 src/themes/_contract.md 第 5 节）：
 *   - 只能在 [data-ui="decor-back"] / [data-ui="decor-front"] 里放东西
 *   - mount 必须返回清理函数，卸载后装饰位必须恢复为空
 *   - 必须遵守 prefers-reduced-motion（ctx.reducedMotion）
 *   - 懒加载，不影响首屏
 */
import type { ThemeEffects, ThemeEffectsContext, ThemeEventName, ThemeMode } from '../types';

const loaders = import.meta.glob<{ default: ThemeEffects }>('/src/themes/*/effects.ts');

type Listener = (detail: unknown) => void;

interface ActiveEffects {
    theme: string;
    cleanups: Array<() => void>;
    listeners: Map<ThemeEventName, Set<Listener>>;
}

let active: ActiveEffects | null = null;
let generation = 0;

function getDecor(): { back: HTMLElement; front: HTMLElement } | null {
    const back = document.querySelector<HTMLElement>('[data-ui="decor-back"]');
    const front = document.querySelector<HTMLElement>('[data-ui="decor-front"]');
    return back && front ? { back, front } : null;
}

export function prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export async function mountEffects(themeId: string, mode: ThemeMode): Promise<void> {
    const item = window.__THEMES__?.[themeId];
    if (!item?.hasEffects) return;
    const token = ++generation;

    const modules = await Promise.all(
        item.chain
            .map((id) => loaders[`/src/themes/${id}/effects.ts`])
            .filter((loader): loader is NonNullable<typeof loader> => Boolean(loader))
            .map((loader) => loader()),
    );
    // 加载期间又切换了主题：放弃本次挂载
    if (token !== generation) return;

    const decor = getDecor();
    if (!decor) return;

    const state: ActiveEffects = { theme: themeId, cleanups: [], listeners: new Map() };
    const ctx: ThemeEffectsContext = {
        root: document.documentElement,
        decor,
        mode,
        reducedMotion: prefersReducedMotion(),
        on(event, cb) {
            if (!state.listeners.has(event)) state.listeners.set(event, new Set());
            state.listeners.get(event)!.add(cb as Listener);
        },
    };
    active = state;

    for (const mod of modules) {
        let cleanup: void | (() => void) = undefined;
        try {
            cleanup = await mod.default.mount(ctx);
        } catch (err) {
            console.error(`[themes] effects of "${themeId}" failed to mount`, err);
        }
        if (token !== generation) {
            // mount 期间被卸载：unmountEffects 已经跑完，这次的清理函数没人会调用，在这里补上
            if (typeof cleanup === 'function') runCleanup(cleanup, themeId);
            return;
        }
        if (typeof cleanup === 'function') state.cleanups.push(cleanup);
    }
}

function runCleanup(cleanup: () => void, themeId: string) {
    try {
        cleanup();
    } catch (err) {
        console.error(`[themes] effects cleanup of "${themeId}" failed`, err);
    }
}

export async function unmountEffects(): Promise<void> {
    generation++;
    const current = active;
    active = null;
    if (current) {
        for (const cleanup of current.cleanups.reverse()) runCleanup(cleanup, current.theme);
        current.listeners.clear();
    }
    // 兜底：保证装饰位恢复为空
    const decor = getDecor();
    if (decor) {
        for (const slot of [decor.back, decor.front]) {
            if (slot.childElementCount > 0) {
                if (import.meta.env.DEV && current) {
                    console.warn(`[themes] effects of "${current.theme}" left nodes in decor slots; removed them.`);
                }
                slot.replaceChildren();
            }
        }
    }
}

/** 向当前挂载的效果派发事件 */
export function emitEffectsEvent(event: ThemeEventName, detail?: unknown): void {
    active?.listeners.get(event)?.forEach((cb) => {
        try {
            cb(detail);
        } catch (err) {
            console.error(`[themes] effects listener "${event}" failed`, err);
        }
    });
}

export function getActiveEffectsTheme(): string | null {
    return active?.theme ?? null;
}
