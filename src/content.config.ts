import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({
		base: './src/content/blog',
		pattern: '**/*.{md,mdx}',
		generateId: ({ entry }) => {
			// 保留原始文件名（含特殊字符如顿号），只去掉扩展名
			return entry.replace(/\.(md|mdx)$/, '');
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
