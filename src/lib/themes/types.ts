/**
 * 主题系统公共类型。主题包（src/themes/<id>/）只允许依赖本文件导出的类型。
 * 接口约定详见 src/themes/_contract.md
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeWorldline {
    /** 变动率，形如 "1.048596" */
    divergence: string;
    /** 这条世界线的说明 */
    line?: string;
}

/** theme.json 经 zod 校验后的结构 */
export interface ThemeMeta {
    id: string;
    name: string;
    nameEn?: string;
    /** 主题对接的接口约定版本，必须等于 CONTRACT_VERSION */
    api: number;
    /** 主题支持的模式；只有一种时强制使用该模式 */
    schemes: ThemeMode[];
    /** 父主题 id：先加载父主题 CSS，再加载本主题 */
    extends?: string;
    /** 预览图（相对主题目录），构建期解析为 URL */
    preview?: string;
    /** 主题文案（data-ui 锚点 → 文本），见 _contract.md「可替换文案」 */
    copy?: Record<string, string>;
    /** 世界线：变动率与一句说明，见 _contract.md 2.7 */
    worldline?: ThemeWorldline;
    meta: {
        themeColor?: string;
    };
}

/** 构建期解析完成的主题条目 */
export interface ThemeEntry extends ThemeMeta {
    /** 主题链 id：[...祖先, 自己] */
    chain: string[];
    /** 按 extends 展开后的 CSS URL：[...祖先, 自己] */
    css: string[];
    /** 主题链（含祖先）里是否存在 effects.ts */
    hasEffects: boolean;
    /** 预览图 URL（已由 Vite 处理） */
    previewUrl?: string;
}

/** 注入到首屏内联脚本的精简清单：window.__THEMES__ */
export interface ThemeManifestItem {
    css: string[];
    chain: string[];
    schemes: ThemeMode[];
    themeColor?: string;
    hasEffects: boolean;
    /** 按 extends 链合并后的文案 */
    copy?: Record<string, string>;
    /** 世界线（子主题未声明时沿用父主题的） */
    worldline?: ThemeWorldline;
}

export type ThemeManifest = Record<string, ThemeManifestItem>;

/** localStorage 'echoes:theme' 中保存的内容 */
export interface StoredThemeState {
    theme?: string;
    mode?: ThemeMode;
}

/** switchTheme 完成后在 document 上派发：CustomEvent<ThemeChangeDetail>('echoes:theme-change') */
export interface ThemeChangeDetail {
    theme: string;
    mode: ThemeMode;
    previousTheme: string;
    previousMode: ThemeMode;
}

export type ThemeEventName = 'theme-change' | 'page-swap' | 'visibility-change';

/** 传给主题 effects.mount() 的上下文 */
export interface ThemeEffectsContext {
    /** <html> 元素：只读取状态（data-mode/data-page 等），不要修改 */
    root: HTMLElement;
    /** 装饰位：效果只允许在这两个容器里创建节点 */
    decor: {
        back: HTMLElement;
        front: HTMLElement;
    };
    /** 当前模式 */
    mode: ThemeMode;
    /** 用户是否开启了“减少动态效果”（mount 时的值；变化时会触发重新挂载） */
    reducedMotion: boolean;
    /**
     * 订阅事件，cleanup 时自动解绑，无需手动移除：
     * - 'theme-change'：同一主题内切换明暗模式（detail: ThemeChangeDetail）
     * - 'page-swap'：Astro ClientRouter 换页完成（装饰位节点会被保留下来）
     * - 'visibility-change'：页面可见性变化（detail: { hidden: boolean }）
     */
    on<T = unknown>(event: ThemeEventName, cb: (detail: T) => void): void;
}

/** 主题 JS 效果的生命周期接口。mount 返回清理函数，切换主题时必须能把一切还原。 */
export interface ThemeEffects {
    mount(ctx: ThemeEffectsContext): void | (() => void) | Promise<void | (() => void)>;
}

declare global {
    interface Window {
        __THEMES__?: ThemeManifest;
        __THEME_DEFAULTS__?: { theme: string; mode: ThemeMode };
    }
}
