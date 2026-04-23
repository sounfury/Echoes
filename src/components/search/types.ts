export type QuickSearchGroup = 'posts' | 'pages';

export type QuickSearchPostItem = {
    type: 'post';
    id: string;
    title: string;
    href: string;
    date: string;
    timestamp: number;
    category: string;
    categoryLabel: string;
    tags: string[];
    excerpt: string;
    searchText: string;
    pinyinFull?: string;
    pinyinInitials?: string;
};

export type QuickSearchPageItem = {
    type: 'page';
    id: string;
    title: string;
    href: string;
    description?: string;
    external?: boolean;
    searchText: string;
    pinyinFull?: string;
    pinyinInitials?: string;
};

export type QuickSearchItem = QuickSearchPostItem | QuickSearchPageItem;
