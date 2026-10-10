# Echoes 主题接口约定

**接口版本：`api: 2`**（与 `src/lib/themes/schema.ts` 中的 `CONTRACT_VERSION` 保持一致）

主题对接的是这份"接口约定"，而不是组件源码。主题**只能**使用下面列出的四类接口：

1. CSS 变量（`--c-*` / `--font-*` / `--radius-*` / `--shiki-*` / `--layout-*` / `--card-*` / `--worldline-*` / `--comments-*` / `--waline-*`）
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
- **主题 CSS 文件开头必须先写一遍完整的层叠顺序 `@layer theme, base, components, utilities, skin;`**（只是声明，不会改变顺序）。
  CSS 层的顺序由“第一次出现”决定，主题样式表在某些情况下（例如开发模式下 ClientRouter 换页）可能排到 `global.css` 前面，
  不写这一行的话 `skin` 会变成第一个、也就是优先级最低的层。缺少时契约校验会给出警告。
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
| `--c-signal-green` / `--c-signal-red` / `--c-signal-orange` | 信号色（播放器频谱、错误提示、提示块 warning / danger） | `#10B981` / `#F90000` / `#FF9900` |
| `--c-paper` | 文章页 `main` 的纸面底色 | `--c-bg` 与白 4:6 混合 / 同 `--c-bg` |
| `--c-contrast` | 与页面反差最大的纯色（快速搜索里常配合很低的透明度使用） | `#000` / `#fff` |
| `--c-info` | 提示块 info 色（可选，未设置时为 `#4f8ff7`） | 未设置 |
| `--c-search-panel` | 快速搜索面板底色 | `#fff` 92% / `rgb(13 13 18)` 92% |
| `--c-search-divider` | 快速搜索分隔线 / 条目悬停边框 | `#000` 8% / `#fff` 10% |
| `--c-search-placeholder` | 快速搜索输入框占位符 | `#000` 35% / `#fff` 30% |
| `--c-search-kbd` | 快速搜索按键提示边框 | `#000` 10% / `#fff` 15% |
| `--c-search-mark` | 快速搜索命中高亮底色 | accent 16% / 26% |

> 兼容：旧的 Tailwind 色名 `eva-*`（`text-eva-purple`、`bg-eva-paper` …）仍可用，已改为指向上面的变量，
> 属于组件内部实现，主题不要依赖，新代码请用语义色名（`text-accent`、`bg-paper` …）。

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

Markdown 代码块用 Shiki 多主题输出（`defaultColor: false`），每个 token 只带变量、不带写死的颜色：

| 变量（由 Shiki 写在 `.astro-code` 及其 `span` 上） | 来源 |
| --- | --- |
| `--shiki-light` / `--shiki-light-bg` | `github-light`（默认亮色外观） |
| `--shiki-dark` / `--shiki-dark-bg` | `dracula`（默认暗色外观） |
| `--shiki-vars` / `--shiki-vars-bg` | `css-variables` 主题，值是 `var(--shiki-token-*)` / `var(--shiki-foreground)` / `var(--shiki-background)` |

base 层按 `data-mode` 使用 light / dark。主题想要自己的配色时，设置下面这些变量，并在 skin 层把颜色切到 `--shiki-vars`：

`--shiki-foreground`、`--shiki-background`、`--shiki-token-constant`、`--shiki-token-string`、
`--shiki-token-comment`、`--shiki-token-keyword`、`--shiki-token-parameter`、`--shiki-token-function`、
`--shiki-token-string-expression`、`--shiki-token-punctuation`、`--shiki-token-link`。

```css
@layer skin {
  :root { --shiki-background: #fbf3ea; --shiki-token-keyword: #c8243a; /* … */ }
  .astro-code, .astro-code span { color: var(--shiki-vars); font-style: normal; }
  .astro-code { background-color: var(--shiki-vars-bg); }
}
```

（`.astro-code` 是 Astro / Shiki 的输出类名，在这里视为第三方稳定接口。）

### 2.5 布局 `--layout-*`（v2）

页面骨架是一个 grid：

```html
<body>
  …header（fixed）…
  <div data-ui="shell">                 <!-- display:grid -->
    <aside data-ui="aside"></aside>     <!-- 默认为空、隐藏，纯装饰位（aria-hidden） -->
    <div data-ui="content">             <!-- 页面内容 -->
      <main data-ui="main">…</main>
    </div>
  </div>
</body>
```

| 变量 | 作用于 | 默认 |
| --- | --- | --- |
| `--layout-columns` | `shell` 的 `grid-template-columns` | `minmax(0, 1fr)` |
| `--layout-areas` | `shell` 的 `grid-template-areas`（区域名只能用 `aside` / `content`） | `"content"` |
| `--layout-aside-display` | `aside` 的 `display` | `none` |
| `--layout-max-w` | `main` 最大宽度；目录 `toc` 也按它定位 | `56rem` |
| `--layout-gutter` | `main` / `header-inner` 左右内边距 | `1rem` |
| `--layout-header-max-w` | 头部内容 `header-inner` 最大宽度 | `var(--layout-max-w)` |

例：左侧 38% 立绘栏、右侧内容

```css
@media (min-width: 64rem) {
  :root {
    --layout-columns: 38vw minmax(0, 1fr);
    --layout-areas: "aside content";
    --layout-aside-display: block;
  }
  [data-ui="aside"] { position: sticky; top: 0; height: 100vh; background: url(./assets/art.webp) center / cover; }
}
```

`aside` 里没有任何内容，主题用 `background` / `::before` / `::after` 填充；它在文档流里，能真正占据宽度
（`decor-*` 是 fixed 叠层，不占位置）。时间轴的线与节点直接用 `timeline` / `timeline-node` 锚点改造
（例如 `[data-ui="timeline"]::before` 画轴线、`border-color: transparent` 隐藏默认线）。

### 2.6 文章卡片 `--card-*`（v2）

`post-card`（时间轴卡片链接）在 base 层消费以下变量，主题改变量即可得到"卡片化"外观，
内边距会以等量负外边距抵消，因此文字位置不变、悬停底色不会贴边：

| 变量 | 默认 |
| --- | --- |
| `--card-pad-x` / `--card-pad-y` | `0px` |
| `--card-radius` | `0px` |
| `--card-bg` / `--card-bg-hover` | `transparent` / 同 `--card-bg` |
| `--card-shadow` / `--card-shadow-hover` | `none` / 同 `--card-shadow` |
| `--card-lift` | 悬停位移（`translate` 值），默认 `none`；`prefers-reduced-motion` 时强制无位移 |

### 2.7 世界线变动 `--worldline-*`

切换主题时的转场（`src/lib/themes/client/worldline.ts`，画面关键帧在 `global.css`）。`theme.json` 声明了
`worldline` 的主题在被切换到时播放：

1. 旧世界的页面变暗、抖动，屏幕中央一排辉光管数字（旧主题的变动率）通电亮起；
2. 数字乱跳，新世界的页面以横向撕裂的条带一闪一闪地渗进来；
3. 数字从左到右逐位锁定到新主题的变动率，最后一位锁定时白光一闪，落到新世界；
4. 数字下面逐字打出 `line`，页面轻微虚化，停留片刻后读数淡出。

```json
"worldline": { "divergence": "1.048596", "line": "在这个世界线，站长是位极简主义者" }
```

| 变量 | 用途 | 默认 |
| --- | --- | --- |
| `--worldline-core` | 辉光管数字的灯丝色（字本身的颜色） | `#f2560d` |
| `--worldline-glow` | 数字的光晕色，也用于背后很淡的光晕和扫描线 | `#ff7a1a` |
| `--worldline-rest` | 读数停留期间页面的虚化滤镜（`filter` 值；保持 `brightness() saturate() blur()` 的写法，结尾才能平滑过渡） | `brightness(0.96) saturate(0.7) blur(5px)` |

- `divergence` 必须是 1 位整数 + 6 位小数；`line` 可省略，最长 60 字。子主题没有声明时沿用父主题的。
- 同一会话（同一标签页）里再次切到同一主题时播短版（约 1.3 秒，不打说明）；切明暗、切到没有 `worldline` 的主题只做交叉淡化。
- 画面部分依赖 View Transition：不支持时页面直接替换，只播读数；系统开启减弱动效时读数直接显示最终数值，不乱跳、不抖动。
- 演出期间点击或按键可以跳过。
- 读数是运行时创建的 `worldline-shift`（全屏、无底板，`data-state="hidden|active|leaving"`、`data-motion="glitch|plain|none"`、
  `data-variant="full|brief"`），挂在 `<html>` 下；`worldline-digits` 带 `data-state="igniting|rolling|locked"`，
  数字位带 `data-digit`，`data-state="rolling|locked"`。数字字体是 Nixie One（只含数字和小数点）。
- 演出期间 `<html>` 带 `data-worldline-shift="full|brief"`，主题可以据此改写 `::view-transition-*(root)` 的动画。
- 当前主题的变动率常驻在页脚的 `worldline` 锚点里（`title` 是 `line`）。

### 2.8 第三方：Waline 评论

评论区组件是 `src/components/post/CommentSection.astro`（Waline，`serverURL` 等来自 `site.config.yaml` 的 `comment`）。

- `[data-ui="comments"]` 上把 Waline 的 `--waline-*` 变量全部映射到 `--c-*`，切换主题 / 明暗时只是变量变化，
  **不会重新挂载 Waline**，已输入的内容不丢。主题在 skin 层对同一个锚点覆盖 `--waline-*` 即可整体换色。
- 更细的定制写 `[data-ui="comments"] .wl-*`（Waline 官方类名：`.wl-panel` / `.wl-header` / `.wl-editor` /
  `.wl-btn` / `.wl-btn.primary` / `.wl-card-item` / `.wl-card` / `.wl-meta-head` / `.wl-sort` / `.wl-empty` / `.wl-power` …，
  视为第三方稳定接口）。
- Waline 自带样式放在 `@layer components.waline` 子层，组件自己的样式在 `components` 层，所以 skin 层的规则总能覆盖两者。
- 额外的钩子变量：

| 变量 | 用途 | 默认 |
| --- | --- | --- |
| `--comments-label` | 评论区顶部分隔线中间的字样（字符串，用于 `content`） | `"COMMENTS"` |
| `--comments-error-color` | 评论提示条错误态颜色 | `#c0392b` |

- 明暗：Waline 的 `dark` 选项指向 `html.dark`（运行时会同步 `.dark` 类），但实际颜色以 `[data-ui="comments"]` 上的变量为准。

## 3. 结构锚点 `data-ui`

| 锚点 | 位置 / 说明 |
| --- | --- |
| `header` | 顶部固定导航栏 |
| `header-inner` | 导航栏内容容器（宽度由 `--layout-header-max-w` 决定） |
| `brand` / `brand-logo` / `brand-title` / `brand-subtitle` | 站点标识（链接、Logo 方块、标题、打字机副标题） |
| `nav` | 桌面端导航链接容器 |
| `nav-link` | 导航链接（桌面 + 移动菜单）；当前页带 `data-state="active"` 与 `aria-current="page"` |
| `search-trigger` | 头部搜索按钮（桌面打开快速搜索，移动端跳归档页） |
| `theme-switcher` | 主题切换区域（包含下面三个） |
| `theme-menu-toggle` | 打开主题菜单的按钮（`aria-expanded`） |
| `theme-menu` | 主题菜单（`data-state="open|closed"`） |
| `theme-option` | 菜单项（`data-theme-id`，选中项 `aria-checked="true"` + `data-state="active"`） |
| `mode-toggle` | 明暗切换按钮；主题只支持一种模式时 `disabled` + `data-state="locked"` |
| `menu-toggle` / `mobile-menu` | 移动端汉堡按钮 / 菜单（`data-state="open|closed"`） |
| `shell` / `aside` / `content` | 页面骨架 grid / 侧栏装饰位（默认隐藏）/ 内容栏，见 2.5 |
| `main` | 每个页面的主内容容器（在 `content` 内，宽度 `--layout-max-w`） |
| `page-header` / `page-kicker` / `page-title` | 页面标题区 / 小字眉题 / 大标题（首页、归档页） |
| `timeline` | 首页时间轴容器 |
| `timeline-item` | 时间轴条目（带 `data-category`） |
| `timeline-node` | 时间轴圆点 |
| `post-card` | 时间轴条目内的文章卡片链接 |
| `post-card-title` / `post-card-excerpt` | 卡片标题 / 摘要 |
| `card-body` | 卡片文字内容容器（在封面之上） |
| `card-cover` / `card-cover-scrim` | 卡片封面（文章有封面图时才有；默认悬停时从右向左划入，铺满卡片）/ 封面上的渐隐遮罩 |
| `timeline-date` / `post-date` | 桌面端日期容器（默认绝对定位在时间轴左侧，`< md` 隐藏）/ 日期文字 |
| `card-date` | 卡片内的日期（默认只在 `< md` 显示；想把日期统一放进卡片时隐藏 `timeline-date`、显示它） |
| `category-badge` | 分类徽标（时间轴、归档） |
| `tag-list` / `tag` | 标签列表 / 单个标签（时间轴、文章页、归档、标签墙） |
| `timeline-footer` / `load-more` / `timeline-end` | 时间轴底部 / 加载更多按钮 / 结束标识 |
| `empty-state` | 列表为空时的提示 |
| `post` | 文章 `<article>`；`data-ui-variant="md|mdx"`，带 `data-category` |
| `post-header` / `post-stamp` / `post-title` / `post-meta` | 文章头部 / CONFIDENTIAL 印章 / 标题 / 元信息栅格 |
| `post-cover` / `post-cover-image` / `post-cover-caption` | 文章封面 `<figure>`（有封面图时）/ 图片 / 角标（默认 `EXHIBIT`） |
| `post-meta-item` / `post-meta-label` | 元信息单项（`data-field="category|created|updated|reading|soundtrack|tags"`）/ 单项小标题 |
| `post-wordcount` | 阅读时间 + 字数（`READ_TIME` 项的值） |
| `post-soundtrack` | 文章配乐（`music` 字段存在时，点击用全局播放器播放） |
| `category-link` | 文章页分类链接 |
| `post-body` | 文章正文容器（Markdown 渲染结果在其中） |
| `toc` / `toc-link` | 目录 / 目录项（当前项 `data-state="active"` + `aria-current="location"`）；目录带 `data-state="open|closed"`，主题启用折叠模式时按此控制显隐，常驻目录可忽略此状态 |
| `toc-toggle` | 目录折叠按钮，`aria-controls` 指向目录、`aria-expanded="true|false"` 与目录状态同步；默认隐藏，主题可按断点启用 |
| `comments` | 评论区 `<section>`（`data-provider="waline"`，仅在配置开启时渲染），见 2.8 |
| `comments-header` / `comments-title` / `comments-hint` | 评论区标题区 / 标题 / 说明文字 |
| `comments-body` | Waline 挂载容器（内部为 Waline 的 `.wl-*` 结构） |
| `comments-toast` | 评论操作提示条（`data-state="visible|hidden"`，`data-type="success|error"`；首次提示时才创建） |
| `quick-search` | 快速搜索弹窗（`Ctrl/⌘ K` 或点 `search-trigger`；打开时 `data-state="open"`） |
| `quick-search-backdrop` / `quick-search-panel` | 遮罩 / 面板 |
| `quick-search-input` / `quick-search-list` / `quick-search-empty` / `quick-search-footer` | 输入框 / 结果列表 / 无结果 / 底部快捷键提示 |
| `quick-search-group` / `quick-search-item` / `quick-search-mark` | 结果分组标题 / 结果项（键盘选中 `data-state="active"`）/ 命中高亮 |
| `search` | 归档页搜索组件（标签墙展开时 `data-state="open"`） |
| `search-field` / `search-input` / `search-chip` | 搜索框外壳 / 输入框 / 已选标签 chip |
| `tag-wall` | 标签墙弹层 |
| `archive-tabs` / `archive-tab` | 分类 tab 栏 / tab（`role="tab"`，激活 `data-state="active"` + `aria-selected`，带 `data-category`） |
| `archive-list` / `archive-year` / `archive-year-label` | 归档列表 / 年份分组 / 年份水印 |
| `archive-item` | 归档行（带 `data-category`） |
| `player` | 全局播放器（`data-state="playing|paused|loading|error"`） |
| `player-cover` / `player-track` / `player-visualizer` / `player-toggle` | 封面 / 曲目信息 / 频谱 / 播放按钮 |
| `player-controls` / `player-volume` | 移动端展开的控制条 / 音量按钮 |
| `player-title` / `player-artist` | 曲名 / 歌手（桌面端，在 `player-track` 内；文字过长时滚动） |
| `player-error` | 错误信息 |
| `lyrics-panel` / `lyrics-current` / `lyrics-next` / `lyrics-status` | 歌词面板（`data-state="open|closed"`）/ 当前歌词 / 下一句 / 加载提示（SYNCING…） |
| `footer` / `footer-link` | 页脚（版权 / 备案）/ 页脚链接 |
| `worldline` | 页脚里常驻的当前世界线变动率（主题没有声明 `worldline` 时隐藏），见 2.7 |
| `worldline-shift` | 切换主题时的世界线变动读数（运行时创建，全屏无底板，带 `data-state`），见 2.7 |
| `worldline-label` / `worldline-digits` / `worldline-line` | 读数的小标题 / 一排数字 / 说明文字 |
| `decor-back` / `decor-front` | 装饰位，见第 5 节 |

### 3.1 可替换文案 `copy`

`theme.json` 可以带 `copy` 字段替换部分界面文字（纯文本，不支持 HTML）：

```json
"copy": {
  "brand-subtitle": "吾乃红魔族第一的魔法师！",
  "page-title@home": "爆裂日记"
}
```

- 键是 `data-ui` 锚点名，可以加 `@<page>` 只在某个页面生效（`<page>` 取 `data-page` 的值），
  页面限定键优先于通用键。
- **只有下面这些锚点允许替换**（源码里带 `data-copy` 属性，并在 `data-ui-default` 里保存默认文字）：

| 锚点 | 默认文字（来源） |
| --- | --- |
| `brand-title` | `site.config.yaml` → `site.logoText` |
| `brand-subtitle` | `site.config.yaml` → `site.subtitle`（打字机效果打出的就是替换后的文字） |
| `page-kicker` | 首页 `System Status: Online` |
| `page-title` | 首页 `Transmissions`（归档页标题由 React 渲染，暂不支持替换） |
| `post-stamp` | 文章页 `CONFIDENTIAL` |
| `post-cover-caption` | 文章封面角标 `EXHIBIT` |
| `comments-title` | `评论` |
| `comments-hint` | `留下你的想法、补充、纠错，或者只是打个招呼。` |

- 未知键：契约校验给出警告，运行时忽略。
- 首屏无闪烁：`<head>` 内联脚本在解析阶段用 `MutationObserver` 于首次绘制前替换；切换主题、ClientRouter 换页时
  由运行时替换；切到没有 `copy` 的主题时恢复 `data-ui-default`。
- 想让新元素可替换：在源码里给它加 `data-copy data-ui-default="默认文字"`（需是纯文本元素，且不能是 React 水合的节点），并更新上表。

## 4. 状态属性

| 属性 | 所在元素 | 取值 |
| --- | --- | --- |
| `data-theme` | `<html>` | 当前主题 id |
| `data-mode` | `<html>` | `light` / `dark`（同时同步 `.dark` 类，供 Tailwind 使用；**主题请用 `data-mode`**） |
| `data-schemes` | `<html>` | 当前主题支持的模式，空格分隔，如 `light dark` |
| `data-page` | `<html>` | `home` / `archive` / `post` / `playground` / `404` / `other`（取值清单见 `src/lib/themes/schema.ts` 的 `THEME_PAGES`；`404` 页没有头部、布局骨架，只有装饰位） |
| `data-state` | 各锚点 | `active` / `open` / `closed` / `locked` / `playing` / `paused` / `loading` / `error` / `visible` / `hidden`（见锚点表） |
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
  "api": 2,                    // 必须等于当前接口版本，否则构建失败
  "schemes": ["light"],        // ["light","dark"] 或只支持一种（强制该模式，明暗按钮被锁定）
  "extends": "default",        // 可选：先加载父主题 CSS，再加载本主题
  "preview": "./preview.png",  // 可选
  "meta": { "themeColor": "#c8243a" },  // 可选：<meta name="theme-color">
  "copy": { "brand-subtitle": "…" },     // 可选：可替换文案，见 3.1
  "worldline": { "divergence": "1.204014", "line": "…" }  // 可选：世界线变动演出，见 2.7
}
```

（JSON 中不能写注释，上面仅为说明。）

新增主题只需要新建目录，不需要改任何注册代码。构建时会：

- 用 zod 校验 `theme.json`，`api` 不一致直接报错；
- 把每个 `theme.css` 单独产出成带哈希的文件（不打进主样式包），按 `extends` 展开成有序 URL 列表；
- 检查 `copy` 的键是否属于可替换文案锚点，未知键给出警告；
- 扫描主题 CSS 中引用的 `[data-ui="..."]`，与源码中实际存在的锚点对比，未知锚点给出警告（`astro check` / `astro build` / `astro dev` 都会执行）。

开发时访问 `/dev/themes`（仅 `pnpm dev` 可用，不会进入生产构建）可以看到所有锚点在不同状态下的样子，并切换主题 / 模式。

---

## 变更记录

- **v1**（初版）：定义 `--c-*` / `--font-*` / `--radius-sm` / `--shiki-*` 变量、上表全部 `data-ui` 锚点、状态属性、两个装饰位、`effects.ts` 生命周期接口和 `echoes:theme-change` 事件。
- **v2**：布局纳入接口约定。
  - 新增页面骨架 `shell` / `aside` / `content`，`main` 现在位于 `content` 内（层级变化，因此升版本）；
    `main` / 头部的宽度与左右内边距改由 `--layout-max-w` / `--layout-gutter` / `--layout-header-max-w` 控制，
    不再是固定的 `max-w-4xl px-4`。新增 `header-inner` 锚点。
  - 新增 `--card-*` 卡片钩子（`post-card` 的内边距、底色、阴影、悬停位移）。
  - 新增 `theme.json` 的 `copy` 字段与可替换文案锚点（见 3.1）。
  - 迁移：把 `theme.json` 的 `api` 改成 `2`；若 v1 主题曾用负外边距 + 内边距给 `post-card` 做悬停底色，改用 `--card-*` 变量；
    若曾用 `font-size: 0` + `::after` 改写文字（如印章），改用 `copy`。
  - 合并 `dev` 分支（封面划入、文章封面、配乐、字数统计、纸面背景 / `article.scss`、快速搜索、播放器拖拽、Waline 评论区）时补充，
    由于 v2 尚未发布，直接并入 v2，不再升版本：
    - `search-link` 改名为 `search-trigger`（dev 把搜索图标改成了打开快速搜索的按钮）；删除 `player-toast`（dev 移除了手势提示）。
    - 代码高亮改为 Shiki 多主题（见 2.4）：默认是 github-light / dracula，主题要用 `--shiki-token-*` 配色需显式切到 `--shiki-vars`。
    - 新增锚点：`card-body` / `card-cover` / `card-cover-scrim` / `card-date`、`post-cover*`、`post-meta-item` / `post-meta-label`、
      `post-wordcount`、`post-soundtrack`、`comments-header` / `comments-hint` / `comments-body` / `comments-toast`、`quick-search*`、
      `player-controls` / `player-volume` / `player-title` / `player-artist`、`lyrics-next` / `lyrics-status`、`footer` / `footer-link`。
    - 新增变量：`--c-paper`、`--c-contrast`、`--c-info`、`--c-search-*`、`--comments-label`、`--comments-error-color`；
      `--c-signal-green` 默认值随 dev 改为 `#10B981`。新增可替换文案：`post-cover-caption`、`comments-hint`；`comments-title` 默认文字改为 `评论`。
    - 文章正文排版由 `src/styles/article.scss`（components 层）提供；默认主题不再自带 `post-body` 排版规则。
  - 新增世界线变动转场：`theme.json` 的 `worldline` 字段、`--worldline-*` 变量与 `worldline*` 锚点（见 2.7，原 2.7 Waline 顺延为 2.8），兼容变更，不升版本。
  - 新增 `data-page="404"`：404 页接入主题（加载主题 CSS、装饰位与 effects），兼容变更，不升版本。
