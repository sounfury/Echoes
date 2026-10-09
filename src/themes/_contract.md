# Echoes 主题接口约定

**接口版本：`api: 1`**（与 `src/lib/themes/schema.ts` 中的 `CONTRACT_VERSION` 保持一致）

主题对接的是这份"接口约定"，而不是组件源码。主题**只能**使用下面列出的四类接口：

1. CSS 变量（`--c-*` / `--font-*` / `--radius-*` / `--shiki-*`）
2. 结构锚点 `data-ui="..."`（以及 `data-ui-variant`）
3. 状态属性 `data-theme` / `data-mode` / `data-schemes` / `data-page` / `data-state` / `data-category` / `aria-*`
4. 装饰位 `[data-ui="decor-back"]` / `[data-ui="decor-front"]`

**Tailwind 类名（`border-b-2`、`text-ink/80` …）、`id`、组件内部的其他 class 都属于内部实现，主题不允许依赖。**

## 版本规则

以下任何一种变化都必须把版本号 +1，并在文末“变更记录”里写明迁移方法：

- `data-ui` 值改名、删除，或者锚点的语义 / 层级关系发生变化
- `--c-*` 等约定变量改名、删除，或含义变化
- 状态属性的取值改变
- 装饰位的定位方式 / 层级改变

**新增** 锚点、变量、状态值属于向后兼容，不需要升版本（但要更新本文档）。

`theme.json` 的 `api` 与当前版本不一致时，**构建直接失败**（见 `src/lib/themes/registry.ts`）。

---

## 1. 层叠顺序（必读）

```css
@layer theme, base, components, utilities, skin;
```

- 顺序在 `<head>` 最前面以内联 `<style>` 声明，`global.css` 中也有同样声明。
- **主题 CSS 必须整体写在 `@layer skin { ... }` 里**。skin 排在 Tailwind `utilities` 之后，
  所以主题写普通选择器就能盖过工具类，不需要比拼优先级，也不需要 `!important`。
- 不要写不分层的 CSS：不分层样式会压过所有分层样式（包括 base 的兜底）。
- 不要在 skin 里用 `!important`：在层叠层中，`!important` 的优先级是反过来的，会造成难以排查的问题。
- `@font-face` 可以写在 `@layer skin` 外面（它不参与层叠），推荐写在文件顶部。

## 2. CSS 变量

base 层在 `:root` 上给出全部变量的兜底值（即默认外观，颜色取自 `site.config.yaml`）。
主题在 `@layer skin` 里覆盖：

```css
@layer skin {
  :root { --c-accent: #c8243a; }
  :root[data-mode="dark"] { --c-bg: #0d0a0b; }
}
```

> `--cfg-*` 是 `site.config.yaml` 注入的配置源变量，**不属于接口约定**，主题不要使用。

### 2.1 颜色 `--c-*`

| 变量 | 用途 | 默认（亮 / 暗） |
| --- | --- | --- |
| `--c-bg` | 页面背景 | `#f0f0f2` / `#0a0a0c` |
| `--c-bg-secondary` | 次级背景 | `#e8e8ea` / `#1E1E1E` |
| `--c-text` | 正文文字 | `#111` / `lab(84.92% 0 0)` |
| `--c-text-secondary` | 次级文字 | `#6B7280` / `#9CA3AF` |
| `--c-border` | 通用边框 | `#E5E7EB` / `#2D2D2D` |
| `--c-accent` | 强调色（链接、激活态、高亮） | `#6528F7` |
| `--c-on-accent` | 强调色 / 分类色上的文字 | `#fff` |
| `--c-ink` | 高对比前景（粗边框、反色块、分隔线基色，常配合透明度使用） | `#111` / `#fff` |
| `--c-on-ink` | ink 色块上的文字 | `#fff` / `#0a0a0c` |
| `--c-surface` | 浮层表面（播放器、歌词面板、主题菜单） | `#fff` / zinc-900 |
| `--c-popover` | 半透明弹层（标签墙） | `#fff` 90% / `#1a1a2e` 95% |
| `--c-field` | 输入框背景 | gray-100 / `#fff` 5% |
| `--c-shadow` | 硬阴影颜色 | `#000` / `#fff` |
| `--c-line` | 细分隔线 | gray-200 / `#fff` 10% |
| `--c-line-strong` | 强边框（输入框、tab、虚线） | gray-400 |
| `--c-line-muted` | 弹层边框 | gray-300 / `#fff` 10% |
| `--c-line-chip` | 标签按钮边框 | gray-300 / `#fff` 20% |
| `--c-divider` | 列表行分隔 | gray-100 / gray-800 50% |
| `--c-muted` | 弱化文字 / 占位符 | gray-500 |
| `--c-caret` | 打字机光标 | accent / `#fff` 80% |
| `--c-selection-bg` / `--c-selection-text` | 文字选中 | accent / `#fff` |
| `--c-scrollbar` | 滚动条滑块 | `#333` / accent |
| `--c-terminal` / `--c-warning` | 功能色 | 来自配置 |
| `--c-signal-green` / `--c-signal-red` / `--c-signal-orange` | 信号色（播放器频谱、错误提示） | `#39ff14` / `#F90000` / `#FF9900` |

分类色（`site.config.yaml` 的 `category.*.color`）以内联 `--item-color` 形式出现在条目上，属于内容数据，不由主题控制；
需要按分类定制时使用 `[data-category="tech"]`。

### 2.2 字体 `--font-*`

| 变量 | 默认 |
| --- | --- |
| `--font-sans` | `'Inter', system-ui, -apple-system, sans-serif` |
| `--font-serif` | `'Noto Serif SC', 'Georgia', serif` |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` |

自定义字体：在主题自己的 `theme.css` 中声明 `@font-face`（字体文件放在主题目录，用 `url(./fonts/xxx.woff2)` 引用，
Vite 会处理路径和哈希），再覆盖 `--font-*`。主题 CSS 只在主题激活时挂载，所以字体只会在该主题下载。

### 2.3 圆角 `--radius-*`

| 变量 | 用途 | 默认 |
| --- | --- | --- |
| `--radius-sm` | 小圆角（按钮、Logo、输入框、Waline） | `0.25rem` |

### 2.4 代码高亮 `--shiki-*`

Markdown 代码块使用 Shiki 的 `css-variables` 主题，颜色全部由变量决定：

`--shiki-foreground`、`--shiki-background`、`--shiki-token-constant`、`--shiki-token-string`、
`--shiki-token-comment`、`--shiki-token-keyword`、`--shiki-token-parameter`、`--shiki-token-function`、
`--shiki-token-string-expression`、`--shiki-token-punctuation`、`--shiki-token-link`。

（Astro 实际输出的是 `--astro-code-*`，base 层在 `.astro-code` 上做了桥接，主题只需设置 `--shiki-*`。）

### 2.5 第三方：Waline 评论

`[data-ui="comments"]` 上已把 Waline 的 `--waline-*` 变量映射到 `--c-*`，换主题会自动跟随。
需要更细的定制时可以写 `[data-ui="comments"] .wl-*`（Waline 官方类名，视为第三方稳定接口）。

## 3. 结构锚点 `data-ui`

| 锚点 | 位置 / 说明 |
| --- | --- |
| `header` | 顶部固定导航栏 |
| `brand` / `brand-logo` / `brand-title` / `brand-subtitle` | 站点标识（链接、Logo 方块、标题、打字机副标题） |
| `nav` | 桌面端导航链接容器 |
| `nav-link` | 导航链接（桌面 + 移动菜单）；当前页带 `data-state="active"` 与 `aria-current="page"` |
| `search-link` | 头部搜索图标 |
| `theme-switcher` | 主题切换区域（包含下面三个） |
| `theme-menu-toggle` | 打开主题菜单的按钮（`aria-expanded`） |
| `theme-menu` | 主题菜单（`data-state="open|closed"`） |
| `theme-option` | 菜单项（`data-theme-id`，选中项 `aria-checked="true"` + `data-state="active"`） |
| `mode-toggle` | 明暗切换按钮；主题只支持一种模式时 `disabled` + `data-state="locked"` |
| `menu-toggle` / `mobile-menu` | 移动端汉堡按钮 / 菜单（`data-state="open|closed"`） |
| `main` | 每个页面的主内容容器 |
| `page-header` / `page-kicker` / `page-title` | 页面标题区 / 小字眉题 / 大标题（首页、归档页） |
| `timeline` | 首页时间轴容器 |
| `timeline-item` | 时间轴条目（带 `data-category`） |
| `timeline-node` | 时间轴圆点 |
| `post-card` | 时间轴条目内的文章卡片链接 |
| `post-card-title` / `post-card-excerpt` | 卡片标题 / 摘要 |
| `post-date` | 卡片日期 |
| `category-badge` | 分类徽标（时间轴、归档） |
| `tag-list` / `tag` | 标签列表 / 单个标签（时间轴、文章页、归档、标签墙） |
| `timeline-footer` / `load-more` / `timeline-end` | 时间轴底部 / 加载更多按钮 / 结束标识 |
| `empty-state` | 列表为空时的提示 |
| `post` | 文章 `<article>`；`data-ui-variant="md|mdx"`，带 `data-category` |
| `post-header` / `post-stamp` / `post-title` / `post-meta` | 文章头部 / CONFIDENTIAL 印章 / 标题 / 元信息栅格 |
| `category-link` | 文章页分类链接 |
| `post-body` | 文章正文容器（Markdown 渲染结果在其中） |
| `toc` / `toc-link` | 目录 / 目录项（当前项 `data-state="active"` + `aria-current="location"`） |
| `comments` / `comments-title` | 评论区（`data-provider="waline"`，仅在配置开启时渲染） |
| `search` | 归档页搜索组件（标签墙展开时 `data-state="open"`） |
| `search-field` / `search-input` / `search-chip` | 搜索框外壳 / 输入框 / 已选标签 chip |
| `tag-wall` | 标签墙弹层 |
| `archive-tabs` / `archive-tab` | 分类 tab 栏 / tab（`role="tab"`，激活 `data-state="active"` + `aria-selected`，带 `data-category`） |
| `archive-list` / `archive-year` / `archive-year-label` | 归档列表 / 年份分组 / 年份水印 |
| `archive-item` | 归档行（带 `data-category`） |
| `player` | 全局播放器（`data-state="playing|paused|loading|error"`） |
| `player-cover` / `player-track` / `player-visualizer` / `player-toggle` | 封面 / 曲目信息 / 频谱 / 播放按钮 |
| `player-toast` / `player-error` | 手势提示 / 错误信息 |
| `lyrics-panel` / `lyrics-current` | 歌词面板（`data-state="open|closed"`）/ 当前歌词 |
| `decor-back` / `decor-front` | 装饰位，见第 5 节 |

> 尚未提供：`footer`（站点目前没有页脚）。将来新增页脚时会以 `data-ui="footer"` 提供，属于兼容性新增。

## 4. 状态属性

| 属性 | 所在元素 | 取值 |
| --- | --- | --- |
| `data-theme` | `<html>` | 当前主题 id |
| `data-mode` | `<html>` | `light` / `dark`（同时同步 `.dark` 类，供 Tailwind 使用；**主题请用 `data-mode`**） |
| `data-schemes` | `<html>` | 当前主题支持的模式，空格分隔，如 `light dark` |
| `data-page` | `<html>` | `home` / `archive` / `post` / `playground` / `other` |
| `data-state` | 各锚点 | `active` / `open` / `closed` / `locked` / `playing` / `paused` / `loading` / `error`（见锚点表） |
| `data-category` | 条目 | 分类 slug（`tech` / `review` / `life` …） |
| `aria-*` | 交互元素 | `aria-current`、`aria-checked`、`aria-selected`、`aria-expanded`、`[disabled]` |

## 5. 装饰位

```html
<div data-ui="decor-back"  aria-hidden="true"></div>  <!-- 内容之下，z-index: -10 -->
<div data-ui="decor-front" aria-hidden="true"></div>  <!-- 内容之上，z-index: 60 -->
```

- 两者都是 `position: fixed; inset: 0; pointer-events: none`，HTML 中始终为空。
- 纯 CSS 主题用 `::before` / `::after` / `background` 填充（例如默认主题的网格和侧边状态文字）。
- 带 `transition:persist`，ClientRouter 换页时节点保留，JS 效果不会被打断。
- 装饰必须 `pointer-events: none`（已由 base 保证），不得遮挡交互。

## 6. 主题 JS 效果（可选）`effects.ts`

```ts
import type { ThemeEffects } from '@/lib/themes/types'; // 项目里用相对路径：../../lib/themes/types
export default {
  mount(ctx) {
    // ctx: { root, decor: { back, front }, mode, reducedMotion, on(event, cb) }
    const canvas = document.createElement('canvas');
    ctx.decor.front.append(canvas);
    return () => canvas.remove();          // 必须返回清理函数
  },
} satisfies ThemeEffects;
```

规则（守死）：

1. **只能在 `decor-*` 装饰位里创建节点**，只做装饰，不准修改任何业务 DOM；`ctx.root` 只读。
2. **必须能被完整清理**：返回的清理函数要移除节点、监听器、定时器、rAF。卸载后若装饰位仍有残留，运行时会强制清空并在开发环境警告。
3. **必须遵守 `prefers-reduced-motion`**：`ctx.reducedMotion === true` 时不要做动画（可以什么都不做，或只画静态画面）。系统设置变化时运行时会自动重新挂载。
4. **懒加载**：通过 `import.meta.glob` 懒加载，只有激活该主题时才下载；首屏在浏览器空闲时挂载，不阻塞渲染。
5. 可订阅事件（cleanup 时自动解绑）：`'theme-change'`（同主题内切换明暗）、`'page-swap'`（换页完成）、`'visibility-change'`（`{ hidden }`）。

## 7. 运行时事件（给组件 / 第三方脚本）

`switchTheme()` / 切换明暗后会在 `document` 上派发：

```ts
document.addEventListener('echoes:theme-change', (e) => {
  const { theme, mode, previousTheme, previousMode } = e.detail;
});
```

JS 里需要颜色时，不要硬编码：用 `readThemeVar('--c-accent')`（即 `getComputedStyle`）读取，
并通过 `onThemeChange(cb)` 在主题变化时刷新（见 `src/lib/themes/client/runtime.ts`）。

## 8. 主题包结构

```
src/themes/<id>/
├── theme.json      必需
├── theme.css       必需，全部规则写在 @layer skin 中
├── assets/...      可选，CSS 中用 url(./assets/xxx) 引用，Vite 自动处理路径和哈希
├── fonts/...       可选
├── preview.png     可选
└── effects.ts      可选
```

```json
{
  "id": "megumin",             // 必须与目录名一致，小写字母/数字/连字符
  "name": "爆裂魔导 · 惠惠",
  "nameEn": "Explosion · Megumin",
  "api": 1,                    // 必须等于当前接口版本，否则构建失败
  "schemes": ["light"],        // ["light","dark"] 或只支持一种（强制该模式，明暗按钮被锁定）
  "extends": "default",        // 可选：先加载父主题 CSS，再加载本主题
  "preview": "./preview.png",  // 可选
  "meta": { "themeColor": "#c8243a" }  // 可选：<meta name="theme-color">
}
```

（JSON 中不能写注释，上面仅为说明。）

新增主题只需要新建目录，不需要改任何注册代码。构建时会：

- 用 zod 校验 `theme.json`，`api` 不一致直接报错；
- 把每个 `theme.css` 单独产出成带哈希的文件（不打进主样式包），按 `extends` 展开成有序 URL 列表；
- 扫描主题 CSS 中引用的 `[data-ui="..."]`，与源码中实际存在的锚点对比，未知锚点给出警告（`astro check` / `astro build` / `astro dev` 都会执行）。

开发时访问 `/dev/themes`（仅 `pnpm dev` 可用，不会进入生产构建）可以看到所有锚点在不同状态下的样子，并切换主题 / 模式。

---

## 变更记录

- **v1**（初版）：定义 `--c-*` / `--font-*` / `--radius-sm` / `--shiki-*` 变量、上表全部 `data-ui` 锚点、状态属性、两个装饰位、`effects.ts` 生命周期接口和 `echoes:theme-change` 事件。
