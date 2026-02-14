/** Astro 端序列化后的文章条目 */
export interface ArchivePost {
    slug: string;
    title: string;
    category: string;
    categoryLabel: string;
    categoryColor: string;
    date: string;
    year: number;
    tags: string[];
}

/** 分类元数据 */
export interface CategoryMeta {
    slug: string;
    label: string;
    color: string;
    count: number;
}

/** 标签频次 */
export interface TagEntry {
    tag: string;
    count: number;
}

/** ArchiveApp 组件的 props */
export interface ArchiveAppProps {
    posts: ArchivePost[];
    categories: CategoryMeta[];
    tags: TagEntry[];
    totalCount: number;
    initialCategory?: string;
    initialTag?: string;
}
