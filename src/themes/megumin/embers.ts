/**
 * 爆裂余烬：decor-back 里缓缓上浮、明灭的小火星（画在法阵之上、内容之下）。
 *
 * - 粒子数固定，熄灭或飘出屏幕后从底部重生
 * - 光晕是预渲染的小贴图，canvas 按 1x 像素绘制（柔光不需要高清），每帧只有几十次 drawImage
 * - attract(x, y)：放出爆裂魔法时，余烬被吸向法阵中心一小段时间，然后继续上浮
 */

interface Ember {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    phase: number;
    sprite: number;
}

const COUNT = 28;

export interface Embers {
    attract(x: number, y: number): void;
    setPaused(paused: boolean): void;
    destroy(): void;
}

/** 中心偏白、外圈带色的圆形光晕贴图 */
function sprite(color: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    if (g) {
        const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgb(255 236 190 / 1)');
        grad.addColorStop(0.22, color);
        grad.addColorStop(1, 'rgb(0 0 0 / 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 32, 32);
    }
    return c;
}

export function mountEmbers(parent: HTMLElement): Embers {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    parent.append(canvas);
    const g = canvas.getContext('2d');
    if (!g) {
        canvas.remove();
        return { attract() {}, setPaused() {}, destroy() {} };
    }

    // 金橙 / 深红 两种火星
    const sprites = [sprite('rgb(232 150 60 / 0.75)'), sprite('rgb(200 36 58 / 0.6)')];

    let w = 0;
    let h = 0;
    const resize = () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    };
    resize();

    const spawn = (e: Partial<Ember> = {}, initial = false): Ember => ({
        x: Math.random() * w,
        // 首次挂载时铺满整屏，之后都从底部下方升起
        y: initial ? Math.random() * h : h + 10 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.25 + Math.random() * 0.5),
        life: initial ? Math.random() * 300 : 0,
        maxLife: 420 + Math.random() * 480,
        size: 6 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
        sprite: Math.random() < 0.6 ? 0 : 1,
        ...e,
    });
    const embers: Ember[] = Array.from({ length: COUNT }, () => spawn({}, true));

    let pull = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
        const dt = Math.min((now - last) / 16.67, 3);
        last = now;
        g.clearRect(0, 0, w, h);
        pull = pull > 0.01 ? pull * Math.pow(0.97, dt) : 0;

        for (let i = 0; i < embers.length; i++) {
            const e = embers[i];
            e.life += dt;
            e.x += (e.vx + Math.sin(e.life * 0.02 + e.phase) * 0.25) * dt;
            e.y += e.vy * dt;
            if (pull) {
                e.x += (tx - e.x) * 0.025 * pull * dt;
                e.y += (ty - e.y) * 0.025 * pull * dt;
            }
            if (e.life >= e.maxLife || e.y < -20) {
                embers[i] = spawn();
                continue;
            }
            const t = e.life / e.maxLife;
            const fade = Math.min(t / 0.1, 1, (1 - t) / 0.3);
            const flicker = 0.7 + 0.3 * Math.sin(e.life * 0.15 + e.phase);
            g.globalAlpha = Math.max(fade, 0) * flicker * 0.85;
            const s = e.size * (pull ? 1 + pull * 0.4 : 1);
            g.drawImage(sprites[e.sprite], e.x - s / 2, e.y - s / 2, s, s);
        }
        g.globalAlpha = 1;
        raf = requestAnimationFrame(frame);
    };

    const start = () => {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    };
    const stop = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
    };

    window.addEventListener('resize', resize, { passive: true });
    start();

    return {
        attract(x, y) {
            tx = x;
            ty = y;
            pull = 1;
        },
        setPaused(paused) {
            if (paused) stop();
            else start();
        },
        destroy() {
            stop();
            window.removeEventListener('resize', resize);
            canvas.remove();
        },
    };
}
