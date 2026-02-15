import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { ArchiveAppProps, ArchivePost } from './types';

type ArchiveFilters = {
    category: string;
    tags: string[];
};

function readFiltersFromSearch(search: string): ArchiveFilters {
    const params = new URLSearchParams(search);
    const category = params.get('category')?.toLowerCase() ?? 'all';
    const tags = [...new Set(params.getAll('tag').map((tag) => tag.toLowerCase()).filter(Boolean))];

    return {
        category,
        tags,
    };
}

// ─── Main Component ───────────────────────────────────────────────────

export default function ArchiveApp({
    posts,
    categories,
    tags: allTags,
    totalCount,
    initialCategory = 'all',
    initialTag,
}: ArchiveAppProps) {
    const [activeCategory, setActiveCategory] = useState(() => {
        if (typeof window !== 'undefined') {
            return readFiltersFromSearch(window.location.search).category;
        }
        return initialCategory;
    });
    const [activeTags, setActiveTags] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            return readFiltersFromSearch(window.location.search).tags;
        }
        return initialTag ? [initialTag.toLowerCase()] : [];
    });
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showTagWall, setShowTagWall] = useState(false);

    const searchRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // 从 URL 参数同步筛选状态（直接导航 / 浏览器前进后退）
    useEffect(() => {
        function syncFromUrl() {
            const { category, tags } = readFiltersFromSearch(window.location.search);
            setActiveCategory(category);
            setActiveTags(tags);
        }

        syncFromUrl();
        window.addEventListener('popstate', syncFromUrl);
        window.addEventListener('pageshow', syncFromUrl);

        return () => {
            window.removeEventListener('popstate', syncFromUrl);
            window.removeEventListener('pageshow', syncFromUrl);
        };
    }, []);

    // 将筛选状态回写到 URL，保证刷新 / 分享 / 回退一致
    useEffect(() => {
        const normalizedCategory = activeCategory.toLowerCase();
        const normalizedTags = [...new Set(activeTags.map((tag) => tag.toLowerCase()).filter(Boolean))];
        const url = new URL(window.location.href);
        const params = url.searchParams;

        params.delete('category');
        params.delete('tag');

        if (normalizedCategory !== 'all') {
            params.set('category', normalizedCategory);
        }
        normalizedTags.forEach((tag) => params.append('tag', tag));

        const nextSearch = params.toString();
        const currentSearch = window.location.search.replace(/^\?/, '');
        if (nextSearch === currentSearch) {
            return;
        }

        const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
        window.history.replaceState(window.history.state, '', nextUrl);
    }, [activeCategory, activeTags]);

    // 点击外部关闭 tag wall
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowTagWall(false);
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    // ─── 过滤逻辑 ─────────────────────────────────────────────────

    const filteredPosts = useMemo(() => {
        return posts.filter((post) => {
            const catMatch = activeCategory === 'all' || post.category === activeCategory;
            const tagMatch =
                activeTags.length === 0 ||
                activeTags.every((t) => post.tagsNormalized.includes(t));
            const kwMatch =
                !searchKeyword ||
                post.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                post.tags.some((t) => t.toLowerCase().includes(searchKeyword.toLowerCase()));
            return catMatch && tagMatch && kwMatch;
        });
    }, [posts, activeCategory, activeTags, searchKeyword]);

    // 按年份分组
    const yearGroups = useMemo(() => {
        const map = new Map<number, ArchivePost[]>();
        filteredPosts.forEach((p) => {
            if (!map.has(p.year)) map.set(p.year, []);
            map.get(p.year)!.push(p);
        });
        return [...map.entries()].sort((a, b) => b[0] - a[0]);
    }, [filteredPosts]);

    // ─── Tag Chip 操作 ────────────────────────────────────────────

    const addTag = useCallback(
        (tag: string) => {
            const t = tag.toLowerCase();
            if (activeTags.includes(t)) return;
            setActiveTags((prev) => [...prev, t]);
            setSearchKeyword('');
            if (searchRef.current) searchRef.current.value = '';
            setShowTagWall(false);
        },
        [activeTags],
    );

    const removeTag = useCallback((tag: string) => {
        setActiveTags((prev) => prev.filter((t) => t !== tag.toLowerCase()));
    }, []);

    // ─── 搜索输入 ─────────────────────────────────────────────────

    const handleSearchInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            if (value.endsWith('#') || value === '#') {
                setShowTagWall(true);
            } else if (value === '') {
                setShowTagWall(false);
            }
            setSearchKeyword(value.replace(/#/g, '').trim());
        },
        [],
    );

    const handleSearchFocus = useCallback(() => {
        if (!searchRef.current?.value || searchRef.current.value === '#') {
            setShowTagWall(true);
        }
    }, []);

    const handleSearchKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Backspace' && searchRef.current?.value === '') {
                const last = activeTags[activeTags.length - 1];
                if (last) removeTag(last);
            }
        },
        [activeTags, removeTag],
    );

    // ─── Render ───────────────────────────────────────────────────

    return (
        <main className="pt-24 pb-20 max-w-4xl mx-auto px-4 min-h-screen">
            {/* ── Header & Search ── */}
            <header className="mb-10 border-b-2 border-eva-ink dark:border-white pb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-serif font-black mb-2 tracking-tight">
                            ARCHIVE_DB
                        </h1>
                        <p className="font-mono text-xs opacity-60 tracking-widest">
                            ACCESS_LEVEL: PUBLIC // TOTAL_RECORDS: {totalCount}
                        </p>
                    </div>

                    {/* Search */}
                    <div className="w-full md:w-[280px] relative" ref={wrapperRef}>
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 border border-gray-400 focus-within:border-[var(--c-accent)] px-2 py-2 rounded-sm transition-colors cursor-text group">
                            <svg
                                className="w-4 h-4 opacity-50 group-focus-within:text-[var(--c-accent)] shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>

                            {/* Chips */}
                            <div className="flex gap-1 flex-wrap">
                                {activeTags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="bg-eva-ink text-white dark:bg-white dark:text-eva-dark text-[10px] font-mono px-1 py-0.5 whitespace-nowrap flex items-center gap-1 cursor-pointer"
                                        onClick={() => removeTag(tag)}
                                    >
                                        TAG:{tag.toUpperCase()}
                                        <span className="opacity-60 hover:opacity-100">×</span>
                                    </span>
                                ))}
                            </div>

                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search... (# for tags)"
                                className="bg-transparent outline-none w-full font-mono text-xs placeholder-gray-500"
                                autoComplete="off"
                                onChange={handleSearchInput}
                                onFocus={handleSearchFocus}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                        <div className="text-[9px] font-mono opacity-40 mt-1 text-right">
                            SUPPORT: TAG + KEYWORD LOGIC
                        </div>

                        {/* Tag Wall */}
                        {showTagWall && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white/90 dark:bg-[#1a1a2e]/95 backdrop-blur-md border border-gray-300 dark:border-white/10 rounded-sm shadow-lg z-50 max-h-48 overflow-y-auto animate-fadeIn">
                                <div className="p-3">
                                    <div className="text-[9px] font-mono opacity-40 uppercase tracking-wider mb-2">
                                        Available Tags
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {allTags.map(({ tag, count }) => (
                                            <button
                                                key={tag}
                                                className="text-[10px] font-mono px-1.5 py-0.5 border border-gray-300 dark:border-white/20 hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-colors cursor-pointer"
                                                onClick={() => addTag(tag)}
                                            >
                                                #{tag}
                                                <span className="opacity-40 ml-0.5">{count}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Category Tabs ── */}
            <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar border-b border-gray-200 dark:border-white/10 pb-4">
                <button
                    className={`archive-tab flex items-center gap-2 border px-4 py-1.5 font-mono text-xs transition-all whitespace-nowrap cursor-pointer ${activeCategory === 'all'
                        ? 'active border-gray-400 text-gray-500'
                        : 'border-gray-400 text-gray-500 hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]'
                        }`}
                    onClick={() => setActiveCategory('all')}
                >
                    <span>ALL_ARTICLE</span>
                    <span className="opacity-60 text-[10px]">[{totalCount}]</span>
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat.slug}
                        className={`archive-tab flex items-center gap-2 border px-4 py-1.5 font-mono text-xs transition-all whitespace-nowrap group cursor-pointer ${activeCategory === cat.slug
                            ? 'active border-gray-400 text-gray-500'
                            : 'border-gray-400 text-gray-500'
                            }`}
                        style={{ '--tab-color': cat.color } as React.CSSProperties}
                        onClick={() => setActiveCategory(cat.slug)}
                    >
                        <div className="w-2 h-2 bg-gray-400 rounded-none transition-colors group-hover:bg-[var(--tab-color)]" />
                        <span>{cat.label}</span>
                        <span className="opacity-60 text-[10px]">[{cat.count}]</span>
                    </button>
                ))}
            </div>

            {/* ── Post List ── */}
            {yearGroups.length > 0 ? (
                <div className="space-y-10">
                    {yearGroups.map(([year, groupPosts]) => (
                        <div key={year} className="relative">
                            {/* 年份水印 */}
                            <h3 className="text-6xl font-black text-eva-ink/10 dark:text-white/10 absolute -z-10 select-none transform -translate-y-6 font-mono tracking-tighter pointer-events-none">
                                {year}
                            </h3>

                            <div className="relative z-0 pl-2">
                                {/* 表头 */}
                                <div className="hidden md:flex py-2 border-b border-eva-ink/10 dark:border-white/10 text-xs font-mono opacity-40 uppercase tracking-wider">
                                    <div className="w-20">Date</div>
                                    <div className="w-24">Type</div>
                                    <div className="flex-1">Subject</div>
                                    <div className="w-48 text-right">Tags</div>
                                </div>

                                <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                    {groupPosts.map((post) => (
                                        <PostRow key={post.slug} post={post} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 opacity-50 font-mono text-sm">
                    NO MATCHING RECORDS FOUND
                </div>
            )}
        </main>
    );
}

// ─── PostRow Sub-component ────────────────────────────────────────────

function PostRow({ post }: { post: ArchivePost }) {
    return (
        <a
            href={`/posts/${post.slug}`}
            className="archive-item group flex flex-col md:flex-row md:items-center py-3 cursor-pointer transition-all px-2 -mx-2 relative overflow-hidden no-underline"
            style={{ '--item-color': post.categoryColor } as React.CSSProperties}
        >
            {/* 悬停左侧高亮线 */}
            <div
                className="absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: post.categoryColor }}
            />

            {/* 日期 */}
            <div className="w-20 font-mono text-xs opacity-50 group-hover:opacity-100 group-hover:text-[var(--item-color)] transition-colors">
                {post.date}
            </div>

            {/* 分类标签 */}
            <div className="w-24 hidden md:block">
                <span
                    className="text-[10px] font-mono border px-1.5 py-0.5"
                    style={{ borderColor: post.categoryColor, color: post.categoryColor }}
                >
                    {post.categoryLabel}
                </span>
            </div>

            {/* 标题 */}
            <div className="flex-1 min-w-0">
                <span className="font-serif font-bold text-lg md:text-base group-hover:opacity-100 group-hover:text-[var(--item-color)] transition-colors truncate block">
                    {post.title}
                </span>
            </div>

            {/* Tags */}
            <div className="w-full md:w-48 mt-2 md:mt-0 flex gap-2 md:justify-end overflow-hidden shrink-0">
                {post.tags.map((tag) => (
                    <span
                        key={tag}
                        className="text-[10px] font-mono opacity-40 group-hover:opacity-100 group-hover:text-[var(--item-color)] uppercase whitespace-nowrap transition-colors"
                    >
                        #{tag}
                    </span>
                ))}
            </div>
        </a>
    );
}
