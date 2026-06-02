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
		创建时间: z.preprocess(normalizeOptionalValue, z.coerce.date().optional()),
		更新时间: z.preprocess(normalizeOptionalValue, z.coerce.date().optional()),
		tags: z.preprocess(normalizeArrayValue, z.array(z.string()).default([])),
		mediaRefs: z.preprocess(normalizeArrayValue, z.array(z.string().url()).default([])),
		music: z.preprocess(normalizeOptionalValue, z.string().url().optional()),
		published: z.preprocess(normalizePublished, z.boolean()),
	}),
});

export const collections = { blog };
