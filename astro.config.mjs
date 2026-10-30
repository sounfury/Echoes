// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import robotsTxt from 'astro-robots-txt';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import rehypeSplitParagraphs from './src/lib/rehypeSplitParagraphs';
import { createCssVariablesTheme } from './src/lib/shikiCssVariablesTheme.mjs';
import themeContract from './integrations/themeContract';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.sounfury.top',
	integrations: [
		themeContract(),
		mdx(),
		// 旧文章链接 /posts/<分类>/<文件名>/ 只是跳转页，不进 sitemap（永久链接见 src/lib/permalink.ts）
		sitemap({ filter: (page) => !/^\/posts\/[^/]+\/[^/]+\/?$/.test(new URL(page).pathname) }),
		react(),
		robotsTxt(),
	],
	vite: {
		plugins: [tailwindcss()],
		server: {
			allowedHosts: ['alist.sounfury.top'],
		},
	},
	markdown: {
		rehypePlugins: [rehypeSplitParagraphs],
		shikiConfig: {
			/*
			 * 代码高亮颜色交给 CSS（主题接口约定 2.4）：defaultColor: false 让每个 token 只输出变量
			 *   --shiki-light / --shiki-dark：github-light / dracula，默认外观（global.css 按 data-mode 选用）
			 *   --shiki-vars：css-variables 主题，颜色来自 --shiki-token-*，主题可切换为自己的配色
			 */
			themes: {
				light: 'github-light',
				dark: 'dracula',
				vars: createCssVariablesTheme({ variablePrefix: '--shiki-' }),
			},
			defaultColor: false,
		},
	},
});
