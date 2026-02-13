import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		创建时间: z.coerce.date().optional(),
		更新时间: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		published: z.boolean().default(true),
	}),
});

export const collections = { blog };
