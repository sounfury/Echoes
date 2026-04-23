import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchQuickItems } from '../../lib/search';
import type { QuickSearchItem } from './types';

type QuickSearchProps = {
    items: QuickSearchItem[];
};

const OPEN_EVENT = 'echoes:quick-search-open';

export default function QuickSearch({ items }: QuickSearchProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const recentPosts = useMemo(
        () => items.filter((item) => item.type === 'post').slice(0, 5),
        [items],
    );
    const shortcutPages = useMemo(
        () => items.filter((item) => item.type === 'page').slice(0, 3),
        [items],
    );

    const results = useMemo(() => {
        if (!query.trim()) return [];
        return searchQuickItems(items, query, 8);
    }, [items, query]);

    const displayItems = query.trim()
        ? results
        : [...recentPosts, ...shortcutPages].slice(0, 8);

    const close = useCallback(() => {
        setOpen(false);
        setQuery('');
        setSelectedIndex(0);
    }, []);

    const grouped = useMemo(() => {
        return {
            posts: displayItems.filter((item) => item.type === 'post'),
            pages: displayItems.filter((item) => item.type === 'page'),
        };
    }, [displayItems]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query, open]);

    useEffect(() => {
        const onOpen = () => {
            setOpen(true);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            const isMobile = window.matchMedia('(max-width: 767px)').matches;
            const isMetaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
            if (isMetaK) {
                if (isMobile) {
                    window.location.href = '/archive';
                    return;
                }

                event.preventDefault();
                setOpen(true);
                return;
            }

            if (event.key === 'Escape') {
                close();
                return;
            }

            if (!open || displayItems.length === 0) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % displayItems.length);
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + displayItems.length) % displayItems.length);
            }

            if (event.key === 'Enter') {
                const selected = displayItems[selectedIndex];
                if (!selected) return;
                event.preventDefault();
                openItem(selected, close);
            }
        };

        window.addEventListener(OPEN_EVENT, onOpen as EventListener);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener(OPEN_EVENT, onOpen as EventListener);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open, displayItems, selectedIndex, close]);

    useEffect(() => {
        if (!open) {
            setQuery('');
            return;
        }

        const timer = window.setTimeout(() => {
            inputRef.current?.focus();
        }, 10);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.clearTimeout(timer);
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    useEffect(() => {
        const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
        active?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[90]" aria-hidden={!open}>
            <button
                className="absolute inset-0 bg-black/30 backdrop-blur-sm cursor-default"
                aria-label="Close quick search"
                onClick={close}
            />

            <div className="absolute inset-x-3 top-[10vh] mx-auto w-auto max-w-2xl rounded-xl border border-black/10 bg-white/92 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0d0d12]/92 md:top-24">
                <div className="border-b border-black/8 px-4 py-3 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <svg className="h-4 w-4 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search posts, tags, or pages..."
                            className="w-full bg-transparent text-sm outline-none placeholder:text-black/35 dark:placeholder:text-white/30"
                        />
                        <span className="hidden rounded border border-black/10 px-2 py-0.5 font-mono text-[10px] opacity-50 dark:border-white/15 md:inline-block">
                            ESC
                        </span>
                    </div>
                </div>

                <div ref={listRef} className="max-h-[65vh] overflow-y-auto p-3">
                    {!query.trim() && <SectionLabel label="Recent" />}

                    {query.trim() && displayItems.length === 0 ? (
                        <div className="px-3 py-10 text-center">
                            <div className="font-mono text-sm opacity-60">NO MATCHING RESULTS</div>
                            <a href="/archive" className="mt-4 inline-flex text-xs font-mono text-[var(--c-accent)] no-underline hover:opacity-80">
                                Go to Archive for advanced search →
                            </a>
                        </div>
                    ) : (
                        <>
                            {grouped.posts.length > 0 && (
                                <GroupedList
                                    title={query.trim() ? 'Posts' : 'Recent Posts'}
                                    items={grouped.posts}
                                    selectedIndex={selectedIndex}
                                    allItems={displayItems}
                                    query={query}
                                    onSelect={(item) => openItem(item, close)}
                                    setSelectedIndex={setSelectedIndex}
                                />
                            )}
                            {grouped.pages.length > 0 && (
                                <GroupedList
                                    title="Pages"
                                    items={grouped.pages}
                                    selectedIndex={selectedIndex}
                                    allItems={displayItems}
                                    query={query}
                                    onSelect={(item) => openItem(item, close)}
                                    setSelectedIndex={setSelectedIndex}
                                />
                            )}
                        </>
                    )}
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-black/8 px-4 py-2 text-[10px] font-mono opacity-55 dark:border-white/10">
                    <span>↑ ↓ navigate</span>
                    <span>Enter open</span>
                    <a href="/archive" className="text-[var(--c-accent)] no-underline hover:opacity-80">Archive advanced search</a>
                </div>
            </div>
        </div>
    );
}

function SectionLabel({ label }: { label: string }) {
    return <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] opacity-35">{label}</div>;
}

function GroupedList({
    title,
    items,
    selectedIndex,
    allItems,
    query,
    onSelect,
    setSelectedIndex,
}: {
    title: string;
    items: QuickSearchItem[];
    selectedIndex: number;
    allItems: QuickSearchItem[];
    query: string;
    onSelect: (item: QuickSearchItem) => void;
    setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
}) {
    return (
        <div className="mb-3 last:mb-0">
            <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] opacity-35">{title}</div>
            <div className="space-y-1">
                {items.map((item) => {
                    const globalIndex = allItems.findIndex((entry) => entry.id === item.id);
                    const active = globalIndex === selectedIndex;
                    return (
                        <button
                            key={item.id}
                            data-index={globalIndex}
                            className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${active
                                ? 'border-[var(--c-accent)] bg-[color:rgba(101,40,247,0.08)]'
                                : 'border-transparent hover:border-black/8 hover:bg-black/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.03]'
                                }`}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            onClick={() => onSelect(item)}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                    <HighlightText text={item.title} query={query} />
                                </div>
                                <div className="mt-1 truncate text-xs opacity-55">
                                    {item.type === 'post' ? (
                                        <>
                                            <span>{item.date}</span>
                                            <span> · {item.categoryLabel} · </span>
                                            <HighlightText
                                                text={item.tags.slice(0, 2).join(' / ') || 'UNTAGGED'}
                                                query={query}
                                            />
                                        </>
                                    ) : (
                                        <HighlightText text={item.description ?? item.href} query={query} />
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0 text-[10px] font-mono opacity-35">
                                {item.type === 'post' ? 'POST' : item.external ? 'LINK' : 'PAGE'}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function HighlightText({ text, query }: { text: string; query: string }) {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return <>{text}</>;
    }

    const lowerText = text.toLowerCase();
    const matchIndex = lowerText.indexOf(normalizedQuery);

    if (matchIndex === -1) {
        return <>{text}</>;
    }

    const before = text.slice(0, matchIndex);
    const match = text.slice(matchIndex, matchIndex + normalizedQuery.length);
    const after = text.slice(matchIndex + normalizedQuery.length);

    return (
        <>
            {before}
            <mark className="bg-[color:rgba(101,40,247,0.16)] px-0.5 text-inherit dark:bg-[color:rgba(101,40,247,0.26)]">
                {match}
            </mark>
            {after}
        </>
    );
}

function openItem(item: QuickSearchItem, onDone?: () => void) {
    onDone?.();

    if (item.type === 'page' && item.external) {
        window.open(item.href, '_blank', 'noopener,noreferrer');
        return;
    }

    window.location.href = item.href;
}
