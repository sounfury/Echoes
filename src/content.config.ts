import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
		创建时间: z.coerce.date().optional(),
		更新时间: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		music: z
			.object({
				server: z.enum(['netease']).default('netease'),
				type: z.enum(['playlist', 'song']).default('playlist'),
				id: z.string(),
			})
			.optional(),
		published: z.boolean().default(true),
	}),
});

export const collections = { blog };
