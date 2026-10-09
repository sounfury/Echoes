/**
 * 构建期主题注册表：扫描 src/themes/*，无需任何手写注册代码。
 *
 * - theme.json   eager 导入并用 zod 校验（api 与 CONTRACT_VERSION 不一致直接构建失败）
 * - theme.css    以 ?url 导入：Vite 把每个主题的 CSS 单独产出成带哈希的文件，
 *                不会打进主样式包，运行时再按需挂载 <link>
 * - effects.ts   懒加载，只有激活主题时才会下载（见 ./client/effects.ts）
 *
 * 本模块只在服务端（Astro frontmatter）使用；浏览器端只读 window.__THEMES__。
 */
import { CONTRACT_VERSION, themeMetaSchema } from './schema';
import type { ThemeEntry, ThemeManifest, ThemeMeta } from './types';

const THEMES_ROOT = '/src/themes/';

const rawMetas = import.meta.glob<unknown>('/src/themes/*/theme.json', {
    eager: true,
    import: 'default',
});
const cssUrls = import.meta.glob<string>('/src/themes/*/theme.css', {
    eager: true,
    query: '?url',
    import: 'default',
});
const previewUrls = import.meta.glob<string>('/src/themes/*/*.{png,jpg,jpeg,webp,svg,avif}', {
    eager: true,
    query: '?url',
    import: 'default',
});
// 只用来判断是否存在 effects.ts；真正的懒加载在 client/effects.ts 中
const effectLoaders = import.meta.glob('/src/themes/*/effects.ts');

export const DEFAULT_THEME_ID = 'default';

function dirOf(path: string): string {
    return path.slice(THEMES_ROOT.length).split('/')[0];
}

function parseMetas(): Map<string, ThemeMeta> {
    const metas = new Map<string, ThemeMeta>();
    for (const [path, raw] of Object.entries(rawMetas)) {
        const dir = dirOf(path);
        const parsed = themeMetaSchema.safeParse(raw);
        if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
            throw new Error(`[themes] ${path} 校验失败: ${issues}`);
        }
        const meta = parsed.data as ThemeMeta;
        if (meta.id !== dir) {
            throw new Error(`[themes] ${path}: id "${meta.id}" 必须与目录名 "${dir}" 一致`);
        }
        if (meta.api !== CONTRACT_VERSION) {
            throw new Error(
                `[themes] 主题 "${meta.id}" 声明 api=${meta.api}，但当前接口约定版本是 ${CONTRACT_VERSION}。` +
                    '请按 src/themes/_contract.md 的变更记录升级主题后再修改 api。',
            );
        }
        if (!cssUrls[`${THEMES_ROOT}${dir}/theme.css`]) {
            throw new Error(`[themes] 主题 "${meta.id}" 缺少 theme.css`);
        }
        metas.set(meta.id, meta);
    }
    if (!metas.has(DEFAULT_THEME_ID)) {
        throw new Error(`[themes] 必须存在默认主题 src/themes/${DEFAULT_THEME_ID}/`);
    }
    return metas;
}

/** 按 extends 展开主题链：[最远祖先, ..., 自己] */
function resolveChain(id: string, metas: Map<string, ThemeMeta>, seen: string[] = []): ThemeMeta[] {
    if (seen.includes(id)) {
        throw new Error(`[themes] extends 出现循环: ${[...seen, id].join(' -> ')}`);
    }
    const meta = metas.get(id);
    if (!meta) {
        throw new Error(`[themes] 主题 "${seen[seen.length - 1]}" extends 了不存在的主题 "${id}"`);
    }
    const parents = meta.extends ? resolveChain(meta.extends, metas, [...seen, id]) : [];
    return [...parents, meta];
}

function buildRegistry(): ThemeEntry[] {
    const metas = parseMetas();
    const entries: ThemeEntry[] = [];
    for (const meta of metas.values()) {
        const chain = resolveChain(meta.id, metas);
        const previewUrl = meta.preview
            ? previewUrls[`${THEMES_ROOT}${meta.id}/${meta.preview.replace(/^\.\//, '')}`]
            : undefined;
        entries.push({
            ...meta,
            chain: chain.map((m) => m.id),
            css: chain.map((m) => cssUrls[`${THEMES_ROOT}${m.id}/theme.css`]),
            hasEffects: chain.some((m) => `${THEMES_ROOT}${m.id}/effects.ts` in effectLoaders),
            previewUrl,
        });
    }
    // 默认主题排第一，其余按 id 排序
    return entries.sort((a, b) =>
        a.id === DEFAULT_THEME_ID ? -1 : b.id === DEFAULT_THEME_ID ? 1 : a.id.localeCompare(b.id),
    );
}

export const themes: ThemeEntry[] = buildRegistry();

export function getTheme(id: string): ThemeEntry | undefined {
    return themes.find((t) => t.id === id);
}

/** 生成 window.__THEMES__，给首屏内联脚本使用 */
export function getThemeManifest(): ThemeManifest {
    return Object.fromEntries(
        themes.map((t) => [
            t.id,
            {
                css: t.css,
                chain: t.chain,
                schemes: t.schemes,
                themeColor: t.meta.themeColor,
                hasEffects: t.hasEffects,
            },
        ]),
    );
}
