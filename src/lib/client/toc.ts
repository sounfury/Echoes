type Cleanup = () => void;

type TocItem = {
    slug: string;
    heading: HTMLElement;
    link: HTMLAnchorElement;
};

const EMPTY_CLEANUP: Cleanup = () => {};
const HEADER_OFFSET = 120;

function getActiveSlugByScrollPosition(items: TocItem[]): string | null {
    if (!items.length) return null;
    const currentY = window.scrollY + HEADER_OFFSET;
    let activeSlug = items[0].slug;

    for (let i = 0; i < items.length; i++) {
        if (items[i].heading.getBoundingClientRect().top + window.scrollY <= currentY) {
            activeSlug = items[i].slug;
        } else {
            break;
        }
    }

    return activeSlug;
}

export function initToc(): Cleanup {
    const tocNav = document.getElementById('toc-nav');
    if (!tocNav) return EMPTY_CLEANUP;

    const tocLinks = Array.from(
        tocNav.querySelectorAll<HTMLAnchorElement>('.toc-link'),
    );
    if (!tocLinks.length) return EMPTY_CLEANUP;

    const tocItems: TocItem[] = tocLinks
        .map((link) => {
            const slug = link.dataset.headingSlug;
            if (!slug) return null;
            const heading = document.getElementById(slug);
            if (!heading) return null;
            return { slug, heading, link };
        })
        .filter((item): item is TocItem => item !== null);

    if (!tocItems.length) return EMPTY_CLEANUP;

    const toggle = document.querySelector<HTMLButtonElement>('[data-ui="toc-toggle"]');
    const setOpen = (open: boolean) => {
        tocNav.dataset.state = open ? 'open' : 'closed';
        toggle?.setAttribute('aria-expanded', String(open));
    };
    const onToggle = () => setOpen(toggle?.getAttribute('aria-expanded') !== 'true');
    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && tocNav.dataset.state === 'open') {
            setOpen(false);
            toggle?.focus();
        }
    };
    toggle?.addEventListener('click', onToggle);
    tocNav.addEventListener('keydown', onKeyDown);
    toggle?.addEventListener('keydown', onKeyDown);

    let currentActiveSlug: string | null = null;
    const setActive = (slug: string | null) => {
        if (slug === currentActiveSlug) return;
        currentActiveSlug = slug;
        tocItems.forEach(({ link, slug: itemSlug }) => {
            const isActive = itemSlug === slug;
            link.classList.toggle('active', isActive);
            // 主题接口约定：状态用 data-state / aria-*，主题不依赖 .active 类名
            if (isActive) {
                link.dataset.state = 'active';
                link.setAttribute('aria-current', 'location');
            } else {
                delete link.dataset.state;
                link.removeAttribute('aria-current');
            }
        });
    };

    const clickHandlers = new Map<HTMLAnchorElement, EventListener>();
    tocItems.forEach(({ slug, link }) => {
        const onClick: EventListener = (event) => {
            event.preventDefault();
            const target = document.getElementById(slug);
            if (!target) return;
            window.scrollTo({
                top: target.getBoundingClientRect().top + window.scrollY - 80,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
            });
            if (toggle && getComputedStyle(toggle).display !== 'none') {
                setOpen(false);
                toggle.focus();
            }
        };
        link.addEventListener('click', onClick);
        clickHandlers.set(link, onClick);
    });

    const updateActive = () => {
        setActive(getActiveSlugByScrollPosition(tocItems));
    };

    let observer: IntersectionObserver | null = null;
    let fallbackScrollHandler: (() => void) | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver(
            () => updateActive(),
            {
                rootMargin: '-120px 0px -65% 0px',
                threshold: [0, 0.1, 1],
            },
        );
        tocItems.forEach(({ heading }) => observer?.observe(heading));
    } else {
        let ticking = false;
        fallbackScrollHandler = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                updateActive();
                ticking = false;
            });
        };
        window.addEventListener('scroll', fallbackScrollHandler, { passive: true });
    }

    updateActive();

    return () => {
        toggle?.removeEventListener('click', onToggle);
        toggle?.removeEventListener('keydown', onKeyDown);
        tocNav.removeEventListener('keydown', onKeyDown);
        observer?.disconnect();
        if (fallbackScrollHandler) {
            window.removeEventListener('scroll', fallbackScrollHandler);
        }
        clickHandlers.forEach((handler, link) => {
            link.removeEventListener('click', handler);
        });
    };
}
