import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 将 Obsidian/frontmatter 中常见的空值统一视为缺失值，避免 null 或空字符串触发错误校验。
 */
function normalizeOptionalValue(value: unknown): unknown {
	if (value === null || value === '') {
		return undefined;
	}

	return value;
}

/** 不带时区的日期时间字符串，例如 "2023-09-08T18:44"、"2025-05-24 16:31:10" */
const NAIVE_DATETIME = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?$/;

/**
 * 日期字段：空值视为缺失；不带时区的字符串统一按 UTC 解释。
 * YAML 会把带秒的 "2025-05-24 16:31:10" 直接解析成 UTC 的 Date，而 "2023-09-08T18:44" 只是字符串，
 * 若交给 new Date() 会按构建机本地时区解析。两者统一成 UTC，日期显示和永久链接哈希才不受时区影响。
 */
function normalizeDateValue(value: unknown): unknown {
	const normalized = normalizeOptionalValue(value);
	if (typeof normalized !== 'string') {
		return normalized;
	}

	const match = NAIVE_DATETIME.exec(normalized.trim());
	if (!match) {
		return normalized;
	}

	const [, datePart, timePart = '00:00'] = match;
	return `${datePart}T${timePart}Z`;
}

/**
 * 解析文章发布状态；缺失、null 或空字符串时默认不发布。
 */
function normalizePublished(value: unknown): unknown {
	if (value === undefined || value === null || value === '') {
		return false;
	}

	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();

		if (normalized === 'true') {
			return true;
		}

		if (normalized === 'false') {
			return false;
		}
	}

	return value;
}

/**
 * 将可选数组字段的空值兜底为空数组，保持页面侧可以直接遍历。
 */
function normalizeArrayValue(value: unknown): unknown {
	if (value === undefined || value === null || value === '') {
		return [];
	}

	return value;
}

const blog = defineCollection({
	loader: glob({
		base: './src/content/blog',
		pattern: '**/*.{md,mdx}',
		generateId: ({ entry }) => {
			// 将路径分隔符统一（Windows下可能是反斜杠）
			const normalized = entry.replace(/\\/g, '/');
			const parts = normalized.split('/');
			const filename = parts[parts.length - 1];

			// 如果在根目录下 (length=1)，只有文件名
			if (parts.length === 1) {
				return filename.replace(/\.(md|mdx)$/, '');
			}

			// 忽略中间目录，只取 "一级目录/文件名" (e.g. "TECH/前端/基础.md" -> "TECH/基础")
			const category = parts[0];
			return `${category}/${filename.replace(/\.(md|mdx)$/, '')}`;
		},
	}),
	schema: z.object({
		创建时间: z.preprocess(normalizeDateValue, z.coerce.date().optional()),
		更新时间: z.preprocess(normalizeDateValue, z.coerce.date().optional()),
		tags: z.preprocess(normalizeArrayValue, z.array(z.string()).default([])),
		mediaRefs: z.preprocess(normalizeArrayValue, z.array(z.string().url()).default([])),
		music: z.preprocess(normalizeOptionalValue, z.string().url().optional()),
		封面图: z.preprocess(normalizeOptionalValue, z.string().url().optional()),
		published: z.preprocess(normalizePublished, z.boolean()),
	}),
});

export const collections = { blog };
