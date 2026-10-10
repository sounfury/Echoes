import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const BLOG_CONTENT_DIR = path.resolve(process.cwd(), 'src/content/blog');
const OUTPUT_FILE_PATH = path.resolve(process.cwd(), 'public/data/media-links.json');
const CONTENT_FILE_PATTERN = /\.(md|mdx)$/i;

/**
 * 递归收集博客内容目录下的所有 Markdown 文件。
 */
async function collectMarkdownFiles(directoryPath) {
    const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
    const collectedFiles = [];

    for (const directoryEntry of directoryEntries) {
        const entryPath = path.join(directoryPath, directoryEntry.name);

        if (directoryEntry.isDirectory()) {
            const nestedFiles = await collectMarkdownFiles(entryPath);
            collectedFiles.push(...nestedFiles);
            continue;
        }

        if (CONTENT_FILE_PATTERN.test(directoryEntry.name)) {
            collectedFiles.push(entryPath);
        }
    }

    return collectedFiles;
}

/**
 * 按博客现有 collection 规则，把内容文件路径转换成文章 id。
 */
function getPostIdFromFilePath(filePath) {
    const relativePath = path.relative(BLOG_CONTENT_DIR, filePath).replace(/\\/g, '/');
    const pathSegments = relativePath.split('/');
    const fileName = pathSegments[pathSegments.length - 1]?.replace(/\.(md|mdx)$/i, '') ?? relativePath;

    if (pathSegments.length === 1) {
        return fileName;
    }

    return `${pathSegments[0]}/${fileName}`;
}

/**
 * 从文章 id 中提取展示标题，规则与博客页面保持一致。
 */
function getTitleFromPostId(postId) {
    const pathSegments = postId.split('/');
    return pathSegments[pathSegments.length - 1] ?? postId;
}

/**
 * 从 Markdown 源码中提取 YAML frontmatter；没有 frontmatter 时返回空对象。
 */
function parseFrontmatter(sourceText, filePath) {
    if (!sourceText.startsWith('---')) {
        return {};
    }

    const frontmatterMatch = sourceText.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!frontmatterMatch) {
        console.warn(`[media-links] 跳过 frontmatter 格式不合法的文件: ${filePath}`);
        return {};
    }

    try {
        return yaml.load(frontmatterMatch[1]) ?? {};
    } catch (error) {
        console.warn(`[media-links] 解析 frontmatter 失败: ${filePath}`, error);
        return {};
    }
}

/**
 * 把 frontmatter 中的日期值稳定转换成 ISO 字符串，便于跨项目消费。
 */
function toIsoString(dateValue) {
    if (!dateValue) {
        return null;
    }

    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
        return dateValue.toISOString();
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return parsedDate.toISOString();
}

/**
 * 把文章 id 转成公开访问路径，并对每一段做 URL 编码。
 */
function getPostPublicUrl(postId) {
    const encodedPostId = postId
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    return `/posts/${encodedPostId}`;
}

/**
 * 将 NeoDB 页面链接规范化成可跨项目比较的稳定 Key。
 */
function normalizeNeoDbUrlToKey(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
        return null;
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return null;
    }

    if (!parsedUrl.hostname.endsWith('neodb.social')) {
        return null;
    }

    const pathSegments = parsedUrl.pathname
        .replace(/\/+$/, '')
        .split('/')
        .filter(Boolean);

    if (pathSegments.length === 2 && ['book', 'movie', 'tv'].includes(pathSegments[0])) {
        return `${pathSegments[0]}:${pathSegments[1]}`;
    }

    if (pathSegments.length === 3 && pathSegments[0] === 'tv' && pathSegments[1] === 'season') {
        return `tv:season:${pathSegments[2]}`;
    }

    return null;
}

/**
 * 读取单篇文章的 frontmatter，并提取是否发布、关联对象与时间信息。
 */
async function readPostMeta(filePath) {
    const sourceText = await fs.readFile(filePath, 'utf8');
    const frontmatter = parseFrontmatter(sourceText, filePath);
    const postId = getPostIdFromFilePath(filePath);

    return {
        filePath,
        postId,
        title: getTitleFromPostId(postId),
        published: frontmatter.published !== false,
        mediaRefs: Array.isArray(frontmatter.mediaRefs) ? frontmatter.mediaRefs : [],
        createdAt: toIsoString(frontmatter.创建时间),
        updatedAt: toIsoString(frontmatter.更新时间),
    };
}

/**
 * 构建“媒体对象 -> 文章列表”的公开索引，并对重复关联做去重。
 */
function buildMediaLinksIndex(posts) {
    const items = {};

    for (const post of posts) {
        if (!post.published) {
            continue;
        }

        const uniqueMediaKeys = new Set();

        for (const mediaRef of post.mediaRefs) {
            const mediaKey = normalizeNeoDbUrlToKey(mediaRef);

            if (!mediaKey) {
                console.warn(`[media-links] 跳过无法识别的 NeoDB URL: ${mediaRef} (${post.filePath})`);
                continue;
            }

            uniqueMediaKeys.add(mediaKey);
        }

        for (const mediaKey of uniqueMediaKeys) {
            if (!items[mediaKey]) {
                items[mediaKey] = [];
            }

            items[mediaKey].push({
                title: post.title,
                url: getPostPublicUrl(post.postId),
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
            });
        }
    }

    for (const mediaKey of Object.keys(items)) {
        items[mediaKey].sort((leftPost, rightPost) => {
            const leftTimestamp = Date.parse(leftPost.createdAt ?? leftPost.updatedAt ?? '') || 0;
            const rightTimestamp = Date.parse(rightPost.createdAt ?? rightPost.updatedAt ?? '') || 0;

            if (rightTimestamp !== leftTimestamp) {
                return rightTimestamp - leftTimestamp;
            }

            return leftPost.title.localeCompare(rightPost.title, 'zh-CN');
        });
    }

    return {
        version: 1,
        generatedAt: new Date().toISOString(),
        items,
    };
}

/**
 * 将构建好的索引写入 public 目录，供书影音项目直接拉取。
 */
async function writeMediaLinksIndex(indexPayload) {
    await fs.mkdir(path.dirname(OUTPUT_FILE_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_FILE_PATH, `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8');
}

/**
 * 执行博客媒体索引生成流程，并输出概要信息供构建日志查看。
 */
async function main() {
    const markdownFiles = await collectMarkdownFiles(BLOG_CONTENT_DIR);
    const posts = await Promise.all(markdownFiles.map((filePath) => readPostMeta(filePath)));
    const mediaLinksIndex = buildMediaLinksIndex(posts);
    const mediaObjectCount = Object.keys(mediaLinksIndex.items).length;
    const articleLinkCount = Object.values(mediaLinksIndex.items).reduce(
        (totalCount, articles) => totalCount + articles.length,
        0,
    );

    await writeMediaLinksIndex(mediaLinksIndex);

    console.log(
        `[media-links] 已生成 ${mediaObjectCount} 个媒体对象、${articleLinkCount} 条文章关联 -> ${OUTPUT_FILE_PATH}`,
    );
}

await main();
