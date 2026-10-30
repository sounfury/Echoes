/**
 * RSS 订阅：/rss.xml（全文输出）
 *
 * 正文用 Astro Container API 渲染成 HTML。Obsidian callout 是在浏览器里转换的，
 * 所以阅读器里会显示成普通引用块；代码高亮的颜色走 CSS 变量，阅读器里没有配色。
 */
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getCollection, render } from 'astro:content';
import { getSiteConfig } from '../lib/config';
import { getPostUrl } from '../lib/permalink';
import { getExcerpt, getTitleFromId } from '../lib/utils';

/**
 * 「创建时间」写的是作者所在时区的墙上时间，但在 content.config.ts 里统一按 UTC 解析（保证链接哈希稳定）。
 * RSS 需要真实时刻，这里按 site.timezone 换算回去。
 */
function wallClockToInstant(date: Date, timeZone: string): Date {
    const inZone = new Date(date.toLocaleString('en-US', { timeZone }));
    const inUtc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    return new Date(date.getTime() - (inZone.getTime() - inUtc.getTime()));
}

export async function GET(context: APIContext) {
    const config = getSiteConfig();
    const posts = (await getCollection('blog', ({ data }) => data.published)).sort(
        (a, b) => (b.data.创建时间?.valueOf() ?? 0) - (a.data.创建时间?.valueOf() ?? 0),
    );

    const container = await AstroContainer.create();
    const items = await Promise.all(
        posts.map(async (post) => {
            const { Content } = await render(post);
            const content = await container.renderToString(Content);
            return {
                title: getTitleFromId(post.id),
                link: getPostUrl(post),
                pubDate: post.data.创建时间 && wallClockToInstant(post.data.创建时间, config.site.timezone),
                description: getExcerpt(post.body ?? ''),
                content,
                categories: post.data.tags,
                customData: `<dc:creator><![CDATA[${config.site.author}]]></dc:creator>`,
            };
        }),
    );

    return rss({
        title: config.site.title,
        description: config.site.description,
        site: context.site ?? config.site.url,
        items,
        xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
        customData: '<language>zh-CN</language>',
    });
}
