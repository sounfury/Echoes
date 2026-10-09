/**
 * 惠惠主题 JS 效果：
 * - decor-back 右下角画一座分层旋转的爆裂魔法阵（见 ./magicCircle.ts）
 * - 点击页面任意位置，在 decor-front 的 canvas 里炸开一小团「爆裂魔法」火花，同时法阵闪光加速
 *
 * 遵守接口约定（../_contract.md 第 6 节）：
 * - 只在装饰位里放节点（decor-back 的法阵、decor-front 的 canvas），不碰任何业务 DOM
 *   （点击只是被动监听，不拦截、不阻止默认行为）
 * - 返回的清理函数会移除法阵、canvas、监听器、rAF
 * - prefers-reduced-motion 时只画静态法阵，没有火花
 * - 只有粒子存活时才跑 rAF，空闲时零开销
 */
import type { ThemeEffects } from '../../lib/themes/types';
import { mountMagicCircle } from './magicCircle';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    hue: number;
}

const COLORS = [350, 8, 20, 38]; // 深红 → 橙 → 金
const MAX_PARTICLES = 240;

const effects: ThemeEffects = {
    mount(ctx) {
        const circle = mountMagicCircle(ctx.decor.back, ctx.reducedMotion);
        if (ctx.reducedMotion) return circle.destroy;

        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
        ctx.decor.front.append(canvas);
        const g = canvas.getContext('2d');
        if (!g) {
            canvas.remove();
            return circle.destroy;
        }

        let particles: Particle[] = [];
        let raf = 0;
        let last = 0;
        let dpr = 1;

        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(window.innerWidth * dpr);
            canvas.height = Math.round(window.innerHeight * dpr);
        };
        resize();

        const frame = (now: number) => {
            const dt = Math.min((now - last) / 16.67, 3);
            last = now;
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(0, 0, canvas.width, canvas.height);
            g.globalCompositeOperation = 'lighter';

            particles = particles.filter((p) => (p.life += dt) < p.maxLife);
            for (const p of particles) {
                p.vx *= 0.94;
                p.vy = p.vy * 0.94 + 0.05 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                const t = 1 - p.life / p.maxLife;
                g.fillStyle = `hsla(${p.hue}, 90%, ${50 + 20 * t}%, ${t})`;
                g.beginPath();
                g.arc(p.x, p.y, p.size * (0.4 + t), 0, Math.PI * 2);
                g.fill();
            }

            if (particles.length) {
                raf = requestAnimationFrame(frame);
            } else {
                raf = 0;
                g.clearRect(0, 0, canvas.width, canvas.height);
            }
        };

        const burst = (x: number, y: number) => {
            const count = 36;
            for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
                const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
                const speed = 2 + Math.random() * 5;
                particles.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 1,
                    life: 0,
                    maxLife: 28 + Math.random() * 26,
                    size: 1.2 + Math.random() * 2.4,
                    hue: COLORS[Math.floor(Math.random() * COLORS.length)],
                });
            }
            if (!raf) {
                last = performance.now();
                raf = requestAnimationFrame(frame);
            }
        };

        const onPointerDown = (e: PointerEvent) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            burst(e.clientX, e.clientY);
            circle.surge();
        };

        window.addEventListener('pointerdown', onPointerDown, { passive: true });
        window.addEventListener('resize', resize, { passive: true });
        ctx.on<{ hidden: boolean }>('visibility-change', ({ hidden }) => {
            if (hidden) particles = [];
            circle.setPaused(hidden);
        });

        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('resize', resize);
            if (raf) cancelAnimationFrame(raf);
            particles = [];
            canvas.remove();
            circle.destroy();
        };
    },
};

export default effects;
