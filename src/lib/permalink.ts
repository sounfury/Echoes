/**
 * 文章永久链接：/posts/<8 位短哈希>/
 *
 * 哈希只取自 frontmatter 的「创建时间」，所以改标题、改文件名、换分类都不会改变链接。
 * 创建时间在 content.config.ts 里统一按 UTC 解释，哈希结果与构建机时区无关。
 * 旧的 /posts/<分类>/<文件名>/ 链接由 pages/posts/[...slug].astro 生成跳转页兜底。
 *
 * 仅在构建期（Astro 服务端）使用。
 */
import { createHash } from 'node:crypto';
import type { CollectionEntry } from 'astro:content';

type BlogPost = CollectionEntry<'blog'>;

const HASH_LENGTH = 8;

/** 新链接的路径格式，供 sitemap 过滤旧跳转页使用 */
export const PERMALINK_PATTERN = new RegExp(`^/posts/[0-9a-f]{${HASH_LENGTH}}/?$`);

const warnedIds = new Set<string>();

function shortHash(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, HASH_LENGTH);
}

function permalinkKey(post: BlogPost): string {
    const createdAt = post.data.创建时间;
    if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
        return createdAt.toISOString();
    }

    // 没有创建时间：退回到 id（改文件名会改变链接），提示补上
    if (!warnedIds.has(post.id)) {
        warnedIds.add(post.id);
        console.warn(`[permalink] "${post.id}" 缺少「创建时间」，链接将随文件名变化，建议补上。`);
    }
    return `id:${post.id}`;
}

/** 文章的永久短哈希，例如 "a3f9c21e" */
export function getPostPermalink(post: BlogPost): string {
    return shortHash(permalinkKey(post));
}

/** 文章的站内链接，例如 "/posts/a3f9c21e/" */
export function getPostUrl(post: BlogPost): string {
    return `/posts/${getPostPermalink(post)}/`;
}

/** 构建期检查：两篇文章的「创建时间」完全相同会得到同一链接，直接报错让作者修正 */
export function assertUniquePermalinks(posts: BlogPost[]): void {
    const seen = new Map<string, string>();
    for (const post of posts) {
        const permalink = getPostPermalink(post);
        const other = seen.get(permalink);
        if (other) {
            throw new Error(
                `[permalink] "${other}" 与 "${post.id}" 的「创建时间」相同，生成了同一个链接 /posts/${permalink}/。` +
                    '请把其中一篇的创建时间改动一秒。',
            );
        }
        seen.set(permalink, post.id);
    }
}
