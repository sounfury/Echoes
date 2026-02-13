import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import readingTime from 'reading-time';

/**
 * 合并 Tailwind 类名，自动解决冲突
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * 计算文章阅读时间（分钟）
 */
export function getReadingTime(content: string): number {
    const result = readingTime(content);
    return Math.ceil(result.minutes);
}

/**
 * 根据字符串生成简单 hash，用于封面图映射
 */
export function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * 获取自动封面路径
 */
export function getAutoCover(filename: string, coverPath: string, total: number): string {
    const index = simpleHash(filename) % total;
    return `${coverPath}${index}.webp`;
}
