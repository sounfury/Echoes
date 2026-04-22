import readingTime from 'reading-time';

export function getReadingTime(content: string): number {
    const result = readingTime(content);
    return Math.ceil(result.minutes);
}

/**
 * 统计文章正文的可读字数，尽量排除常见 Markdown 标记对字数的干扰。
 */
export function getArticleWordCount(content: string): number {
    const plainText = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[[^\]]*]\([^)]+\)/g, '')
        .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
        .replace(/^>+\s?/gm, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[*_~>#|[\]()-]/g, ' ')
        .trim();

    const cjkChars = plainText.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
    const latinWords = plainText.match(/[a-zA-Z0-9]+(?:['-][a-zA-Z0-9]+)*/g)?.length ?? 0;

    return cjkChars + latinWords;
}

/** 从 Markdown body 中提取摘要（第一个非空非标题段落，截取前 maxLen 字符） */
export function getExcerpt(body: string, maxLen = 120): string {
    const lines = body
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
    const raw = lines[0]?.trim() ?? '';
    return raw.length > maxLen ? raw.slice(0, maxLen) + '…' : raw;
}

import { getSiteConfig } from './config';

export type Category = string;
export type CategoryMeta = {
    label: string;
    color: string;
};

/**
 * 从文章 id 路径中提取分类 (返回文件夹名，小写)
 * glob loader 生成的 id 格式: "tech/xxx" / "review/xxx" / "life/xxx"
 */
export function getCategoryFromId(id: string): string {
    const folder = id.split('/')[0]?.toLowerCase();
    return folder ?? 'default';
}

/**
 * 获取分类展示元数据（label + color）
 */
export function getCategoryMeta(category: string): CategoryMeta {
    const config = getSiteConfig();
    const catConfig = config.category[category.toLowerCase()];
    const fallbackColor = config.theme.colors.defaultCategory || config.theme.colors.accent;

    return {
        label: catConfig?.label ?? `[${category.toUpperCase()}]`,
        color: catConfig?.color ?? fallbackColor,
    };
}

/**
 * 获取分类颜色
 * 优先从 config.category[cat].color 获取，否则使用 theme.colors.defaultCategory 或 accent
 */
export function getCategoryColor(category: string): string {
    return getCategoryMeta(category).color;
}

/**
 * 获取分类显示标签 (e.g. "[TECH]")
 */
export function getCategoryLabel(category: string): string {
    return getCategoryMeta(category).label;
}

/**
 * 从文章 id 中提取可读标题
 * "tech/重构Obsidian发布流" -> "重构Obsidian发布流"
 */
export function getTitleFromId(id: string): string {
    const parts = id.split('/');
    return parts[parts.length - 1] ?? id;
}

/**
 * 格式化日期为 MM.DD
 */
export function formatDateShort(date: Date): string {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}.${d}`;
}

/**
 * 格式化日期为 YYYY.MM.DD
 */
export function formatDateFull(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}
