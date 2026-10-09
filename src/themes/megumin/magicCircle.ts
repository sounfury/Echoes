/**
 * 右下角的爆裂魔法阵：放在 decor-back 里的分层 SVG。
 *
 * - 四层（符文环 / 刻度环 / 六芒星 / 内核八芒星）各是一个独立的 <svg>，转速和方向各不相同；
 *   旋转作用在 <svg> 元素本身（Web Animations），由合成器处理，不会每帧重绘矢量图
 * - 挂载时线条依次描出，符文与刻度淡入
 * - surge()：点击放出爆裂魔法时调用，法阵闪光并加速旋转一段后回落
 * - reducedMotion 时只画静态法阵
 */

const GOLD = '#d9a441';
const CRIMSON = '#c8243a';
const DEEP = '#7a0f1f';
const PAPER = '#f6eee4';

const CHANT =
    'DARKNESS BLACKER THAN BLACK ✦ DARKER THAN DARK ✦ I BESEECH THEE ✦ ' +
    'COMBINE WITH MY DEEP CRIMSON ✦ EXPLOSION ✦ ';

/** 极坐标（0° 在正上方，顺时针）→ viewBox 坐标，圆心 (200, 200) */
function polar(r: number, deg: number): string {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(200 + r * Math.cos(a)).toFixed(2)},${(200 + r * Math.sin(a)).toFixed(2)}`;
}

function ring(r: number, color: string, width: number): string {
    return `<circle cx="200" cy="200" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" pathLength="1" data-draw/>`;
}

function polygon(r: number, angles: number[], color: string, width: number): string {
    const points = angles.map((a) => polar(r, a)).join(' ');
    return `<polygon points="${points}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" pathLength="1" data-draw/>`;
}

function ticks(): string {
    let out = '';
    for (let i = 0; i < 72; i++) {
        const long = i % 6 === 0;
        const [x1, y1] = polar(long ? 151 : 158, i * 5).split(',');
        const [x2, y2] = polar(164, i * 5).split(',');
        out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${long ? 1 : 0.5}"/>`;
    }
    return `<g stroke="${GOLD}" data-fade>${out}</g>`;
}

function starNodes(): string {
    let out = '';
    for (let i = 0; i < 6; i++) {
        const [x, y] = polar(140, i * 60).split(',');
        out +=
            `<circle cx="${x}" cy="${y}" r="7.5" fill="${PAPER}" stroke="${GOLD}" stroke-width="1"/>` +
            `<circle cx="${x}" cy="${y}" r="2.2" fill="${CRIMSON}"/>`;
    }
    return `<g data-fade>${out}</g>`;
}

interface Layer {
    svg: string;
    /** 转一圈的毫秒数 */
    duration: number;
    reverse: boolean;
}

const LAYERS: Layer[] = [
    {
        // 符文环：沿半径 176 的圆排一圈咏唱（顺时针路径，字头朝外）
        svg:
            ring(196, GOLD, 1.2) +
            ring(191, GOLD, 0.5) +
            '<path id="mg-chant-path" d="M200,24 a176,176 0 1,1 0,352 a176,176 0 1,1 0,-352" fill="none"/>' +
            `<text font-family='"Megumin Display", serif' font-size="10.5" fill="${DEEP}" data-fade>` +
            `<textPath href="#mg-chant-path" textLength="1090" lengthAdjust="spacing">${CHANT}</textPath></text>` +
            ring(170, GOLD, 0.8),
        duration: 90_000,
        reverse: false,
    },
    {
        svg: ring(164, GOLD, 0.7) + ticks() + ring(146, CRIMSON, 0.9),
        duration: 140_000,
        reverse: true,
    },
    {
        svg:
            ring(140, DEEP, 0.6) +
            polygon(140, [0, 120, 240], CRIMSON, 1.3) +
            polygon(140, [60, 180, 300], CRIMSON, 1.3) +
            ring(70, GOLD, 0.9) +
            starNodes(),
        duration: 70_000,
        reverse: false,
    },
    {
        svg:
            polygon(56, [0, 90, 180, 270], GOLD, 0.9) +
            polygon(56, [45, 135, 225, 315], GOLD, 0.9) +
            ring(38, CRIMSON, 1) +
            ring(30, GOLD, 0.5) +
            `<circle cx="200" cy="200" r="5" fill="${CRIMSON}" data-fade/>`,
        duration: 40_000,
        reverse: true,
    },
];

const FILL = 'position:absolute;inset:0;width:100%;height:100%;';

export interface MagicCircle {
    surge(): void;
    setPaused(paused: boolean): void;
    destroy(): void;
}

export function mountMagicCircle(parent: HTMLElement, reducedMotion: boolean): MagicCircle {
    const root = document.createElement('div');
    root.style.cssText =
        '--mg-size:min(72vmin,680px);position:absolute;width:var(--mg-size);aspect-ratio:1;' +
        'right:calc(var(--mg-size) * -0.18);bottom:calc(var(--mg-size) * -0.18);opacity:0.55;';

    const coreGlow = document.createElement('div');
    coreGlow.style.cssText =
        'position:absolute;inset:36%;border-radius:50%;opacity:0.4;' +
        'background:radial-gradient(circle,rgb(255 214 150 / 0.9),rgb(200 36 58 / 0.45) 45%,transparent 70%);';
    root.append(coreGlow);

    const layers = LAYERS.map((layer) => {
        root.insertAdjacentHTML(
            'beforeend',
            `<svg viewBox="0 0 400 400" style="${FILL}overflow:visible;will-change:transform">${layer.svg}</svg>`,
        );
        return root.lastElementChild as SVGSVGElement;
    });

    const flash = document.createElement('div');
    flash.style.cssText =
        `${FILL}border-radius:50%;opacity:0;` +
        'background:radial-gradient(circle,rgb(255 200 120 / 0.6),rgb(200 36 58 / 0.3) 40%,transparent 68%);';
    root.append(flash);

    parent.append(root);

    if (reducedMotion) {
        return { surge() {}, setPaused() {}, destroy: () => root.remove() };
    }

    // ── 入场：由外向内依次描线，符文 / 刻度 / 节点淡入 ──
    layers.forEach((svg, layerIndex) => {
        svg.querySelectorAll<SVGElement>('[data-draw]').forEach((el, i) => {
            el.style.strokeDasharray = '1';
            el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
                duration: 1400,
                delay: layerIndex * 220 + i * 90,
                easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
                fill: 'backwards',
            });
        });
        svg.querySelectorAll<SVGElement>('[data-fade]').forEach((el) => {
            el.animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: 900,
                delay: 700 + layerIndex * 220,
                fill: 'backwards',
            });
        });
    });

    // ── 常驻：各层不同速度 / 方向旋转，内核呼吸 ──
    const loops: Animation[] = layers.map((svg, i) => {
        const { duration, reverse } = LAYERS[i];
        const anim = svg.animate([{ transform: 'rotate(0turn)' }, { transform: 'rotate(1turn)' }], {
            duration,
            iterations: Infinity,
            direction: reverse ? 'reverse' : 'normal',
        });
        anim.currentTime = Math.random() * duration;
        return anim;
    });
    const spins = [...loops];
    loops.push(
        coreGlow.animate([{ opacity: 0.3 }, { opacity: 0.75 }, { opacity: 0.3 }], {
            duration: 4800,
            iterations: Infinity,
            easing: 'ease-in-out',
        }),
    );

    // ── 咏唱：加速旋转后按帧衰减回原速 ──
    let boost = 0;
    let raf = 0;
    let last = 0;
    const decay = (now: number) => {
        const dt = Math.min((now - last) / 16.67, 3);
        last = now;
        boost *= Math.pow(0.94, dt);
        if (boost < 0.05) boost = 0;
        spins.forEach((a) => (a.playbackRate = 1 + boost));
        raf = boost ? requestAnimationFrame(decay) : 0;
    };

    return {
        surge() {
            boost = Math.min(boost + 18, 36);
            flash.animate([{ opacity: 0.9 }, { opacity: 0 }], {
                duration: 1100,
                easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
            });
            root.animate([{ scale: 1 }, { scale: 1.025 }, { scale: 1 }], {
                duration: 700,
                easing: 'ease-out',
            });
            if (!raf) {
                last = performance.now();
                raf = requestAnimationFrame(decay);
            }
        },
        setPaused(paused) {
            loops.forEach((a) => (paused ? a.pause() : a.play()));
        },
        destroy() {
            if (raf) cancelAnimationFrame(raf);
            root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
            root.remove();
        },
    };
}
