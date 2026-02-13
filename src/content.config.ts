import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const CategoryEnum = z.enum(['Tech', 'Review', 'Life']);

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		tags: z.array(z.string()).default([]),
		category: CategoryEnum,
		cover: z.string().optional(),
		music: z.string().optional(),
		published: z.boolean().default(true),
	}),
});

export type Category = z.infer<typeof CategoryEnum>;
export const collections = { blog };
