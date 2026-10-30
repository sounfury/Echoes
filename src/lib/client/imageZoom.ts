import mediumZoom, { type Zoom } from 'medium-zoom';

/** 可放大的图片：正文图片（被链接包住的除外，点击应跟随链接）+ 文章封面 */
const ZOOMABLE_SELECTOR = [
    '[data-ui="post-body"] img:not(a img)',
    '[data-ui="post-cover-image"]',
].join(', ');

let zoom: Zoom | null = null;

export function unmountImageZoom() {
    if (!zoom) return;
    zoom.close();
    zoom.detach();
    zoom = null;
}

export function mountImageZoom() {
    unmountImageZoom();

    const images = Array.from(document.querySelectorAll<HTMLImageElement>(ZOOMABLE_SELECTOR));
    if (images.length === 0) return;

    zoom = mediumZoom(images, {
        margin: 24,
        // 遮罩跟随主题：medium-zoom 把它写成内联样式，变量在切换主题 / 明暗时实时生效
        background: 'color-mix(in srgb, var(--c-bg) 94%, transparent)',
    });
}
