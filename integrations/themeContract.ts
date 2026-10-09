/**
 * Astro 集成：主题接口约定的开发期护栏
 *
 * 1. 构建 / dev / astro check 启动时扫描主题 CSS 中引用的 [data-ui="xxx"]，
 *    与源码中实际存在的 data-ui 值对比，未知锚点给出警告；
 *    同时提示：源码里有但 _contract.md 没写的锚点、主题 CSS 依赖了类名、缺少 @layer skin。
 * 2. 校验 _contract.md 里的版本号与 CONTRACT_VERSION 一致，theme.json 的 api 不一致直接报错。
 * 3. 仅在 `astro dev` 下注入 /dev/themes 主题调试页（生产构建不包含）。
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import { CONTRACT_VERSION } from '../src/lib/themes/schema';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const THEMES_DIR = path.join(SRC, 'themes');
const CONTRACT_DOC = path.join(THEMES_DIR, '_contract.md');
const SOURCE_EXT = /\.(astro|tsx|ts|jsx|js)$/;
/** 允许主题使用的第三方 / 基础类名（不属于 Tailwind 内部实现） */
const ALLOWED_CLASS_PREFIXES = ['wl-', 'astro-code'];

function walk(dir: string, filter: (file: string) => boolean, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'content') continue;
            walk(full, filter, out);
        } else if (filter(full)) {
            out.push(full);
        }
    }
    return out;
}

/** 源码（不含主题包与调试页）里实际存在的 data-ui 值 */
export function collectSourceAnchors(): Map<string, string[]> {
    const anchors = new Map<string, string[]>();
    const add = (value: string, file: string) => {
        const files = anchors.get(value) ?? [];
        const rel = path.relative(ROOT, file);
        if (!files.includes(rel)) files.push(rel);
        anchors.set(value, files);
    };
    const files = walk(
        SRC,
        (f) => SOURCE_EXT.test(f) && !f.startsWith(THEMES_DIR) && !f.startsWith(path.join(SRC, 'dev')),
    );
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf-8');
        for (const m of text.matchAll(/data-ui=["']([a-z0-9-]+)["']/g)) add(m[1], file);
        for (const m of text.matchAll(/data-ui=\{([^}]*)\}/g)) {
            for (const s of m[1].matchAll(/["'`]([a-z0-9-]+)["'`]/g)) add(s[1], file);
        }
        for (const m of text.matchAll(/dataset\.ui\s*=\s*["']([a-z0-9-]+)["']/g)) add(m[1], file);
        for (const m of text.matchAll(/setAttribute\(\s*["']data-ui["']\s*,\s*["']([a-z0-9-]+)["']/g)) add(m[1], file);
    }
    return anchors;
}

/** _contract.md 第 3 节里写明的锚点 */
function collectDocumentedAnchors(doc: string): Set<string> {
    const start = doc.indexOf('## 3.');
    const end = doc.indexOf('## 4.', start);
    const section = start >= 0 ? doc.slice(start, end > start ? end : undefined) : '';
    const out = new Set<string>();
    for (const line of section.split('\n')) {
        if (!line.startsWith('|')) continue;
        const firstCell = line.split('|')[1] ?? '';
        for (const m of firstCell.matchAll(/`([a-z0-9-]+)`/g)) out.add(m[1]);
    }
    return out;
}

function stripCss(css: string): string {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/url\([^)]*\)/g, 'url()');
}

export interface ContractReport {
    errors: string[];
    warnings: string[];
}

export function checkThemeContract(): ContractReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ── 版本号 ──
    const doc = fs.existsSync(CONTRACT_DOC) ? fs.readFileSync(CONTRACT_DOC, 'utf-8') : '';
    const docVersion = doc.match(/接口版本：`api:\s*(\d+)`/)?.[1];
    if (!doc) {
        errors.push('缺少 src/themes/_contract.md');
    } else if (Number(docVersion) !== CONTRACT_VERSION) {
        errors.push(
            `_contract.md 声明的接口版本是 ${docVersion ?? '(未找到)'}，但 CONTRACT_VERSION = ${CONTRACT_VERSION}，请保持一致`,
        );
    }

    const sourceAnchors = collectSourceAnchors();
    const documented = collectDocumentedAnchors(doc);

    for (const anchor of sourceAnchors.keys()) {
        if (doc && !documented.has(anchor)) {
            warnings.push(
                `源码中的 data-ui="${anchor}" 未写入 _contract.md（${sourceAnchors.get(anchor)!.join(', ')}）`,
            );
        }
    }
    for (const anchor of documented) {
        if (!sourceAnchors.has(anchor)) {
            warnings.push(`_contract.md 列出了 data-ui="${anchor}"，但源码中已不存在（改名/删除需提升接口版本）`);
        }
    }

    // ── 各主题 ──
    const themeDirs = fs.existsSync(THEMES_DIR)
        ? fs.readdirSync(THEMES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
        : [];
    for (const dir of themeDirs) {
        const id = dir.name;
        const jsonPath = path.join(THEMES_DIR, id, 'theme.json');
        const cssPath = path.join(THEMES_DIR, id, 'theme.css');
        if (!fs.existsSync(jsonPath)) {
            warnings.push(`src/themes/${id}/ 缺少 theme.json，已被忽略`);
            continue;
        }
        try {
            const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            if (meta.api !== CONTRACT_VERSION) {
                errors.push(
                    `主题 "${id}" 的 theme.json 声明 api=${meta.api}，当前接口约定版本是 ${CONTRACT_VERSION}`,
                );
            }
        } catch (err) {
            errors.push(`src/themes/${id}/theme.json 不是合法 JSON：${(err as Error).message}`);
        }
        if (!fs.existsSync(cssPath)) continue;

        const css = stripCss(fs.readFileSync(cssPath, 'utf-8'));
        const rel = `src/themes/${id}/theme.css`;
        if (!/@layer\s+skin\b/.test(css)) {
            warnings.push(`${rel} 没有使用 @layer skin { ... }，主题样式可能无法正确覆盖`);
        }

        const unknown = new Set<string>();
        for (const m of css.matchAll(/\[\s*data-ui\s*[~|^$*]?=\s*["']?([a-z0-9-]+)["']?\s*\]/g)) {
            if (!sourceAnchors.has(m[1])) unknown.add(m[1]);
        }
        for (const anchor of unknown) {
            warnings.push(`${rel} 引用了未知锚点 [data-ui="${anchor}"]（源码中不存在，可能拼写错误或已改名）`);
        }

        const classes = new Set<string>();
        for (const m of css.matchAll(/([^{};]+)\{/g)) {
            const selector = m[1].trim();
            if (selector.startsWith('@') || /^(from|to|\d+%)/.test(selector)) continue;
            // 评论区内部是第三方（Waline）组件，允许使用其官方类名
            if (/data-ui\s*=\s*["']?comments/.test(selector)) continue;
            for (const c of selector.matchAll(/(?:^|[\s>+~,(])?\.(-?[_a-zA-Z][\w-]*)/g)) {
                if (!ALLOWED_CLASS_PREFIXES.some((p) => c[1].startsWith(p))) classes.add(c[1]);
            }
        }
        for (const c of classes) {
            warnings.push(`${rel} 使用了类名选择器 .${c}：类名属于内部实现，主题应改用 data-ui / 状态属性`);
        }
    }

    return { errors, warnings };
}

function report(logger: AstroIntegrationLogger, { errors, warnings }: ContractReport, failOnError: boolean) {
    for (const w of warnings) logger.warn(w);
    if (errors.length) {
        const message = errors.map((e) => `  - ${e}`).join('\n');
        if (failOnError) throw new Error(`[theme-contract] 主题接口约定校验失败：\n${message}`);
        for (const e of errors) logger.error(e);
    }
    if (!errors.length && !warnings.length) logger.info(`主题接口约定 v${CONTRACT_VERSION} 校验通过`);
}

export default function themeContract(): AstroIntegration {
    return {
        name: 'echoes:theme-contract',
        hooks: {
            'astro:config:setup': ({ command, injectRoute, logger }) => {
                report(logger, checkThemeContract(), command === 'build');
                if (command === 'dev') {
                    injectRoute({
                        pattern: '/dev/themes',
                        entrypoint: './src/dev/ThemesPlayground.astro',
                    });
                }
            },
            'astro:server:setup': ({ server, logger }) => {
                let timer: ReturnType<typeof setTimeout> | undefined;
                const recheck = (file: string) => {
                    if (!file.startsWith(SRC) || !/\.(css|astro|tsx|ts|json|md)$/.test(file)) return;
                    clearTimeout(timer);
                    timer = setTimeout(() => report(logger, checkThemeContract(), false), 300);
                };
                server.watcher.on('change', recheck);
                server.watcher.on('add', recheck);
            },
        },
    };
}
