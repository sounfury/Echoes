type Cleanup = () => void;

const EMPTY_CLEANUP: Cleanup = () => {};
const END_OF_TRANSMISSIONS_TEXT = '[ END OF TRANSMISSIONS ]';
const TIMELINE_STATE_KEY = 'echoes:timeline:state';

type TimelineState = {
    path: string;
    visibleCount: number;
    autoLoadedOnce: boolean;
};

function renderEndIndicator(footer: HTMLElement) {
    footer.textContent = '';
    const endLabel = document.createElement('span');
    endLabel.className = 'text-sm font-mono opacity-50 uppercase tracking-wider';
    endLabel.textContent = END_OF_TRANSMISSIONS_TEXT;
    footer.append(endLabel);
}

function renderLoadMoreButton(footer: HTMLElement) {
    footer.textContent = '';
    const button = document.createElement('button');
    button.id = 'load-more-btn';
    button.className = 'text-sm font-mono opacity-50 hover:text-eva-purple hover:opacity-100 transition-all uppercase tracking-wider cursor-pointer';
    button.textContent = '[ Load More Data ]';
    footer.append(button);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function readTimelineState(pathname: string): TimelineState | null {
    try {
        const raw = sessionStorage.getItem(TIMELINE_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<TimelineState>;
        if (parsed.path !== pathname) return null;
        if (typeof parsed.visibleCount !== 'number' || Number.isNaN(parsed.visibleCount)) {
            return null;
        }
        return {
            path: pathname,
            visibleCount: Math.floor(parsed.visibleCount),
            autoLoadedOnce: Boolean(parsed.autoLoadedOnce),
        };
    } catch {
        return null;
    }
}

function writeTimelineState(state: TimelineState) {
    try {
        sessionStorage.setItem(TIMELINE_STATE_KEY, JSON.stringify(state));
    } catch {
        // ignore storage write failures (private mode / quota)
    }
}

export function initTimeline(): Cleanup {
    const container = document.getElementById('timeline-container');
    const sentinel = document.getElementById('scroll-sentinel');
    const footer = document.getElementById('timeline-footer');

    if (!container) return EMPTY_CLEANUP;

    const timelineEntries = Array.from(
        container.querySelectorAll<HTMLElement>('.timeline-entry'),
    );
    const domTotal = timelineEntries.length;
    const pageSizeRaw = Number.parseInt(container.dataset.pageSize ?? '5', 10);
    const totalRaw = Number.parseInt(container.dataset.total ?? `${domTotal}`, 10);
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 5;
    const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : domTotal;
    const initialVisible = Math.min(pageSize, total);
    const currentPath = window.location.pathname;

    let visibleCount = initialVisible;
    let autoLoadedOnce = false;
    let observer: IntersectionObserver | null = null;

    const persistState = () => {
        writeTimelineState({
            path: currentPath,
            visibleCount,
            autoLoadedOnce,
        });
    };

    const updateFooter = () => {
        if (!footer) return;
        if (visibleCount >= total) {
            renderEndIndicator(footer);
            return;
        }
        if (!footer.querySelector('#load-more-btn')) {
            renderLoadMoreButton(footer);
        }
    };

    const applyVisibleCount = (nextVisibleCount: number, animateNewlyShown: boolean) => {
        const clampedVisible = clamp(nextVisibleCount, 0, total);
        const previousVisible = visibleCount;

        timelineEntries.forEach((entry, index) => {
            const shouldShow = index < clampedVisible;
            if (shouldShow) {
                const wasHidden = entry.classList.contains('hidden');
                entry.classList.remove('hidden');

                if (animateNewlyShown && wasHidden) {
                    entry.style.opacity = '0';
                    entry.style.transform = 'translateY(20px)';
                    entry.style.transition = 'none';
                    window.setTimeout(() => {
                        entry.style.transition = 'all 0.4s ease-out';
                        entry.style.opacity = '1';
                        entry.style.transform = 'translateY(0)';
                    }, Math.max(0, index - previousVisible) * 80);
                }
            } else {
                entry.classList.add('hidden');
                entry.style.opacity = '';
                entry.style.transform = '';
                entry.style.transition = '';
            }
        });

        visibleCount = clampedVisible;
        updateFooter();
        persistState();
    };

    const loadMore = () => {
        if (visibleCount >= total) {
            updateFooter();
            persistState();
            return;
        }

        const nextVisibleCount = Math.min(visibleCount + pageSize, total);
        applyVisibleCount(nextVisibleCount, true);
    };

    const onFooterClick = (event: Event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest<HTMLElement>('#load-more-btn');
        if (!button || !footer?.contains(button)) return;
        loadMore();
    };
    footer?.addEventListener('click', onFooterClick);

    const restoredState = readTimelineState(currentPath);
    if (restoredState) {
        visibleCount = clamp(restoredState.visibleCount, initialVisible, total);
        autoLoadedOnce = restoredState.autoLoadedOnce;
    }
    applyVisibleCount(visibleCount, false);

    if (!autoLoadedOnce && sentinel && typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    if (visibleCount >= total || autoLoadedOnce) return;

                    autoLoadedOnce = true;
                    loadMore();
                    observer?.disconnect();
                    observer = null;
                    persistState();
                });
            },
            { rootMargin: '200px' },
        );
        observer.observe(sentinel);
    }

    return () => {
        footer?.removeEventListener('click', onFooterClick);
        observer?.disconnect();
        persistState();
    };
}
