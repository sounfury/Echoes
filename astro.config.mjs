// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import robotsTxt from 'astro-robots-txt';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import rehypeSplitParagraphs from './src/lib/rehypeSplitParagraphs';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.sounfury.top',
	integrations: [mdx(), sitemap(), react(), robotsTxt()],
	vite: {
		plugins: [tailwindcss()],
		server: {
			allowedHosts: ['alist.sounfury.top'],
		},
	},
	markdown: {
		rehypePlugins: [rehypeSplitParagraphs],
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'dracula',
			},
		},
	},
});
