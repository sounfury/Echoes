/**
 * 世界线变动：切换主题时的转场演出。
 *
 * 画面（CSS，见 global.css 的 worldline-* 关键帧）：用 View Transition 拿到新旧两个主题的页面快照，
 * 旧世界变暗、抖动，新世界以横向撕裂的条带一闪一闪地渗进来，最后一位数字锁定时白光一闪，落到新世界。
 * 读数（本文件）：屏幕中央一排辉光管数字，从旧主题的变动率开始乱跳，从左到右逐位锁定到新主题的数值，
 * 然后逐字打出这条世界线的说明，停留片刻后淡出。数值和说明来自 theme.json 的 worldline 字段。
 *
 * 降级：不支持 View Transition 时只有读数（页面直接替换）；系统开启减弱动效时读数直接显示最终状态。
 * 本模块由 runtime.ts 动态 import，只在第一次切换主题时下载。
 */

export interface WorldlineShift {
    /** 旧主题的变动率（没有时与 to 相同） */
    from: string;
    /** 新主题的变动率，如 "1.048596" */
    to: string;
    /** 这条世界线的说明 */
    line?: string;
    /** 本次会话里已经看过这条世界线：播短版，不打说明 */
    brief: boolean;
}

/** total：画面演出时长（与 CSS 的 --worldline-duration 同步）；stay：演出结束后读数停留多久 */
const PLAN = {
    full: { total: 2800, stay: 1900 },
    brief: { total: 1300, stay: 800 },
} as const;
/**
 * 时间点（占 total 的比例）：开始乱跳 / 第一位锁定 / 最后一位锁定。
 * 关键帧里白光一闪在 82%，紧跟最后一位锁定，改这里要同步改 global.css。
 */
const AT = { roll: 0.1, lock: 0.55, lockEnd: 0.8, type: 0.87 };
/** 乱跳时每隔多久换一次数字 */
const ROLL_MS = 48;
const TYPE_CHAR_MS = 36;
const LEAVE_MS = 500;
const FONT_TIMEOUT_MS = 600;

type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void>; skipTransition(): void };
type ViewTransitionDocument = Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => ViewTransitionLike;
};

let skipActive: (() => void) | null = null;
let destroyActive: (() => void) | null = null;

/** 把正在播的演出直接跳到结尾（主题替换照常完成，读数显示最终数值） */
export function skipWorldlineShift(): void {
    skipActive?.();
}

/** 辉光管字体只在这里用到，开演前确保它已就绪，避免数字先用等宽字体闪一下 */
function fontReady(): Promise<unknown> {
    if (!document.fonts?.load) return Promise.resolve();
    return Promise.race([
        document.fonts.load('400 1em "Nixie One"', '0123456789.').catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
    ]);
}

/** 提前下载辉光管字体（打开主题菜单时由 runtime 调用） */
export function warmWorldline(): Promise<unknown> {
    return fontReady();
}

/**
 * 播放世界线变动。update 负责替换主题，保证恰好被调用一次；
 * 返回的 Promise 在画面演出结束（页面可以交互）时 resolve，读数之后自行停留、淡出。
 */
export async function playWorldlineShift(shift: WorldlineShift, update: () => void | Promise<void>): Promise<void> {
    destroyActive?.();

    const doc = document as ViewTransitionDocument;
    const html = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let motion: 'glitch' | 'plain' | 'none' =
        reduced ? 'none' : typeof doc.startViewTransition === 'function' ? 'glitch' : 'plain';
    const variant = shift.brief ? 'brief' : 'full';
    const plan = PLAN[variant];

    // ── 读数 DOM ──
    const root = document.createElement('div');
    root.dataset.ui = 'worldline-shift';
    root.dataset.state = 'hidden';
    root.dataset.variant = variant;
    root.setAttribute('aria-hidden', 'true');

    const label = document.createElement('div');
    label.dataset.ui = 'worldline-label';
    label.textContent = '世界线变动率';

    const digits = document.createElement('div');
    digits.dataset.ui = 'worldline-digits';
    const target = Array.from(shift.to);
    const source = Array.from(shift.from.length === shift.to.length ? shift.from : shift.to);
    /** 只有数字位参与乱跳，小数点原样显示 */
    const cells: Array<{ el: HTMLElement; to: string }> = [];
    target.forEach((ch, i) => {
        const el = document.createElement('span');
        if (/\d/.test(ch)) {
            el.dataset.digit = '';
            el.textContent = /\d/.test(source[i]) ? source[i] : ch;
            cells.push({ el, to: ch });
        } else {
            el.textContent = ch;
        }
        digits.appendChild(el);
    });
    root.append(label, digits);

    // 说明分成"已打出"和"未打出（占位、不可见）"两段，打字过程中整块宽度不变
    const lineChars = shift.brief || !shift.line ? [] : Array.from(shift.line);
    let typed: HTMLElement | null = null;
    let rest: HTMLElement | null = null;
    if (lineChars.length) {
        const line = document.createElement('div');
        line.dataset.ui = 'worldline-line';
        typed = document.createElement('span');
        rest = document.createElement('span');
        rest.style.visibility = 'hidden';
        rest.textContent = lineChars.join('');
        line.append(typed, rest);
        root.appendChild(line);
    }

    // ── 时间轴 ──
    const rollStart = plan.total * AT.roll;
    const lockAt = (i: number) =>
        plan.total * (AT.lock + ((AT.lockEnd - AT.lock) * i) / Math.max(cells.length - 1, 1));
    const lastLock = lockAt(cells.length - 1);
    const typeStart = plan.total * AT.type;
    const showEnd = Math.max(plan.total, typeStart + lineChars.length * TYPE_CHAR_MS);
    const leaveAt = showEnd + plan.stay;

    let raf = 0;
    let destroyed = false;
    let rollTick = -1;
    let shownChars = -1;
    let elapsed = 0;
    /** 跳过 / 静态模式时把时钟拨快的量 */
    let skew = 0;
    let leaveTimer = 0;

    const render = (e: number) => {
        const phase = e < rollStart ? 'igniting' : e < lastLock ? 'rolling' : 'locked';
        if (digits.dataset.state !== phase) digits.dataset.state = phase;

        const tick = e >= rollStart ? Math.floor(e / ROLL_MS) : -1;
        const reroll = tick !== rollTick;
        rollTick = tick;
        cells.forEach((cell, i) => {
            if (e >= lockAt(i)) {
                if (cell.el.dataset.state !== 'locked') {
                    cell.el.dataset.state = 'locked';
                    cell.el.textContent = cell.to;
                    cell.el.style.opacity = '';
                }
            } else if (tick >= 0 && reroll) {
                // 辉光管换数字时亮度不稳：每次乱跳随机暗一点
                cell.el.dataset.state = 'rolling';
                cell.el.textContent = String(Math.floor(Math.random() * 10));
                cell.el.style.opacity = (0.5 + Math.random() * 0.5).toFixed(2);
            }
        });

        if (typed && rest) {
            const count = Math.min(lineChars.length, Math.max(0, Math.floor((e - typeStart) / TYPE_CHAR_MS)));
            if (count !== shownChars) {
                shownChars = count;
                typed.textContent = lineChars.slice(0, count).join('');
                rest.textContent = lineChars.slice(count).join('');
            }
        }
    };

    const clearGlitch = () => {
        delete html.dataset.worldlineShift;
        html.style.removeProperty('--worldline-duration');
    };

    const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        cancelAnimationFrame(raf);
        clearTimeout(leaveTimer);
        root.remove();
        if (destroyActive === destroy) destroyActive = null;
        if (skipActive === skip) skipActive = null;
    };

    const leave = () => {
        root.dataset.state = 'leaving';
        leaveTimer = window.setTimeout(destroy, LEAVE_MS + 50);
    };

    let vt: ViewTransitionLike | null = null;
    const skip = () => {
        vt?.skipTransition();
        if (elapsed < showEnd) skew += showEnd - elapsed;
    };

    // ── 开演 ──
    await fontReady();
    html.appendChild(root);
    destroyActive = destroy;
    root.dataset.motion = motion;

    let updated = false;
    const swap = async () => {
        if (updated) return;
        updated = true;
        try {
            await update();
        } finally {
            // 读数只出现在"新画面"里：在这里才显示，旧快照里没有它
            root.dataset.state = 'active';
        }
    };

    if (motion === 'glitch') {
        html.dataset.worldlineShift = variant;
        html.style.setProperty('--worldline-duration', `${plan.total}ms`);
        try {
            vt = doc.startViewTransition!(swap);
            await vt.ready;
        } catch (err) {
            // 转场没建立起来（被打断等）：退回只有读数的版本
            console.warn('[themes] worldline transition unavailable', err);
            vt = null;
            motion = 'plain';
            root.dataset.motion = motion;
            clearGlitch();
        }
    }
    await swap();

    if (motion === 'none') skew = showEnd;
    skipActive = skip;
    const t0 = performance.now();
    const frame = (now: number) => {
        if (destroyed) return;
        elapsed = now - t0 + skew;
        render(elapsed);
        if (elapsed >= leaveAt) return leave();
        raf = requestAnimationFrame(frame);
    };
    render(skew);
    raf = requestAnimationFrame(frame);

    if (vt) {
        // 演出期间点一下 / 按任意键可以跳过
        const opts = { capture: true } as const;
        document.addEventListener('pointerdown', skip, opts);
        document.addEventListener('keydown', skip, opts);
        await vt.finished.catch(() => {});
        document.removeEventListener('pointerdown', skip, opts);
        document.removeEventListener('keydown', skip, opts);
        clearGlitch();
    }
}
