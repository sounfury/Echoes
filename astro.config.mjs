// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.sounfury.top',
	integrations: [mdx(), sitemap(), react()],
	vite: {
		plugins: [tailwindcss()],
		server: {
			allowedHosts: ['alist.sounfury.top'],
		},
	},
	markdown: {
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'dracula',
			},
		},
	},
});
