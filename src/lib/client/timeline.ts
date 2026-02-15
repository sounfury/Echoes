type Cleanup = () => void;

const EMPTY_CLEANUP: Cleanup = () => {};
const END_OF_TRANSMISSIONS_TEXT = '[ END OF TRANSMISSIONS ]';

function renderEndIndicator(footer: HTMLElement) {
    footer.textContent = '';
    const endLabel = document.createElement('span');
    endLabel.className = 'text-sm font-mono opacity-50 uppercase tracking-wider';
    endLabel.textContent = END_OF_TRANSMISSIONS_TEXT;
    footer.append(endLabel);
}

export function initTimeline(): Cleanup {
    const container = document.getElementById('timeline-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const sentinel = document.getElementById('scroll-sentinel');
    const footer = document.getElementById('timeline-footer');

    if (!container) return EMPTY_CLEANUP;

    const pageSize = Number.parseInt(container.dataset.pageSize ?? '5', 10);
    const total = Number.parseInt(container.dataset.total ?? '0', 10);
    let visibleCount = Math.min(pageSize, total);
    let observer: IntersectionObserver | null = null;

    const loadMore = () => {
        const hiddenEntries = container.querySelectorAll('.timeline-entry.hidden');
        const toShow = Array.from(hiddenEntries).slice(0, pageSize);

        toShow.forEach((entry, index) => {
            entry.classList.remove('hidden');
            const element = entry as HTMLElement;
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            setTimeout(() => {
                element.style.transition = 'all 0.4s ease-out';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, index * 80);
        });

        visibleCount += toShow.length;
        if (visibleCount >= total && footer) {
            renderEndIndicator(footer);
        }
    };

    const onLoadMoreClick = () => loadMore();
    loadMoreBtn?.addEventListener('click', onLoadMoreClick);

    if (sentinel && typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && visibleCount < total) {
                        loadMore();
                    }
                });
            },
            { rootMargin: '200px' },
        );
        observer.observe(sentinel);
    }

    if (visibleCount >= total && footer) {
        renderEndIndicator(footer);
    }

    return () => {
        loadMoreBtn?.removeEventListener('click', onLoadMoreClick);
        observer?.disconnect();
    };
}
