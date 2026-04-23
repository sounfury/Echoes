import type { QuickSearchItem, QuickSearchPageItem, QuickSearchPostItem } from '../components/search/types';

export function normalizeSearchText(value: string): string {
    return value.trim().toLowerCase();
}

export function scoreQuickSearchItem(item: QuickSearchItem, query: string): number {
    const q = normalizeSearchText(query);
    if (!q) return 0;

    if (item.type === 'page') {
        const title = item.title.toLowerCase();
        const desc = item.description?.toLowerCase() ?? '';
        const pinyinFull = item.pinyinFull ?? '';
        const pinyinInitials = item.pinyinInitials ?? '';
        if (title === q) return 160;
        if (title.startsWith(q)) return 130;
        if (title.includes(q)) return 110;
        if (pinyinFull.includes(q)) return 88;
        if (pinyinInitials.includes(q)) return 76;
        if (desc.includes(q)) return 70;
        return 0;
    }

    return scorePostItem(item, q);
}

function scorePostItem(item: QuickSearchPostItem, q: string): number {
    const title = item.title.toLowerCase();
    const category = item.category.toLowerCase();
    const excerpt = item.excerpt.toLowerCase();
    const tags = item.tags.map((tag) => tag.toLowerCase());
    const pinyinFull = item.pinyinFull ?? '';
    const pinyinInitials = item.pinyinInitials ?? '';

    let score = 0;

    if (title === q) score += 180;
    else if (title.startsWith(q)) score += 145;
    else if (title.includes(q)) score += 120;

    const exactTag = tags.some((tag) => tag === q);
    const partialTag = tags.some((tag) => tag.includes(q));
    if (exactTag) score += 95;
    else if (partialTag) score += 72;

    if (category.includes(q)) score += 44;
    if (pinyinFull.includes(q)) score += 62;
    if (pinyinInitials.includes(q)) score += 46;
    if (excerpt.includes(q)) score += 28;

    if (score > 0) {
        score += Math.max(0, Math.floor(item.timestamp / 1000000000000));
    }

    return score;
}

export function searchQuickItems(items: QuickSearchItem[], query: string, limit = 8): QuickSearchItem[] {
    const q = normalizeSearchText(query);
    if (!q) return [];

    return items
        .map((item) => ({ item, score: scoreQuickSearchItem(item, q) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.item);
}

export function buildStaticQuickSearchPages(): QuickSearchPageItem[] {
    return [
        {
            type: 'page',
            id: 'page-home',
            title: 'Timeline',
            href: '/',
            description: '首页时间轴',
            searchText: 'timeline 首页 时间轴 home',
            pinyinFull: 'shouyeshijianzhou',
            pinyinInitials: 'sysjz',
        },
        {
            type: 'page',
            id: 'page-archive',
            title: 'Archive',
            href: '/archive',
            description: '归档与高级搜索',
            searchText: 'archive 归档 搜索 database advanced search',
            pinyinFull: 'guidangyugaojisousuo',
            pinyinInitials: 'gdygjss',
        },
        {
            type: 'page',
            id: 'page-universe',
            title: 'Universe',
            href: 'https://github.com/sounfury',
            description: '外部个人主页入口',
            external: true,
            searchText: 'universe github 外链 主页',
            pinyinFull: 'waibugerenzhuyerukou',
            pinyinInitials: 'wbgzryk',
        },
    ];
}
