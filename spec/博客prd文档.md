# 产品需求文档 (PRD) - Echoes Blog (V3.0 Final)

| **文档信息** |                                         |
| ------------ | --------------------------------------- |
| **项目名称** | Sync-Stream (Obsidian 驱动静态博客重写) |
| **版本号**   | V3.1 (Quick Search Update)              |
| **状态**     | **已评审 / 待开发**                     |
| **最后更新** | 2026-04-23                              |
| **优先级**   | P0 (核心) / P1 (重要) / P2 (次要)       |

------

## 1. 产品概述 (Overview)

### 1.1 产品背景

当前博客维护成本高、发布流程割裂（需从 Obsidian 手动迁移），导致内容更新停滞。此外，现有博客缺乏个人审美特色，无法满足用户对“极简主义/轻二次元”风格的追求。

博客名称：Echoes

### 1.2 产品目标

构建一个 **“自动化、风格化、高性能”** 的个人数字花园。

1. **自动化**：Obsidian 写完即发，无需人工介入运维。
2. **风格化**：通过独创的“时间轴流”与“动态背景”，提供沉浸式阅读体验。
3. **高密度检索**：通过重构的归档页，支持复杂的复合条件筛选。

------

## 2. 功能需求详述 (Functional Requirements)

### 2.1 全局导航与布局 (Global Navigation)

- **F-NAV-01 导航栏布局**
  - **位置**：顶部固定 (Sticky Top)，向下滚动时背景通过高斯模糊 (Backdrop Blur) 处理。
  - **左侧**：站点 Logo / 名称 (Text: `SYNC-STREAM`，EVA 风格字体)。
  - **右侧**：功能菜单。
    - `Timeline` (首页)
    - `Archive` (归档)
    - `Universe` (外链：个人主页)
    - **主题切换开关** (Sun/Moon Icon)。
    - **搜索入口**：放置在导航栏最右侧，表现为一个“放大镜”图标或极简搜索框。
- **F-NAV-02 黑白主题切换 (Theming)**
  - **默认状态**：根据用户系统设置 (System Preference) 自动决定，首次访问后记录用户选择。
  - **交互**：点击开关，平滑过渡切换全站配色（无需刷新）。
    - *Day Mode*：纸张白背景，高对比度黑字。
    - *Night Mode*：深空灰背景，荧光色（绿/紫/红）点缀，降低屏幕亮度刺激。
- **F-NAV-03 移动端适配 (Mobile Layout)**
  - 当屏幕宽度 < 768px 时，导航栏右侧菜单收纳为“汉堡菜单 (Hamburger Menu)”。
  - 点击汉堡菜单，从右侧滑出全屏遮罩层显示导航项。
- **F-NAV-04 全局快速搜索 / Command Palette**
  - **定位**：导航栏搜索入口提供 **Quick Search** 能力，用于“快速召回 / 快速跳转”；其职责与 Archive 页的高级检索系统明确区分。
  - **唤起方式**：
    - 点击导航栏最右侧搜索图标。
    - 支持快捷键 `⌘K / Ctrl+K` 呼出。
    - 支持 `Esc` 关闭。
  - **表现形式**：
    - Desktop：居中悬浮 Command Palette / Spotlight 式模态框，带遮罩、毛玻璃或极简边框。
    - Mobile：优先采用全屏抽屉或全屏弹层，保证输入与点击区域充足。
  - **搜索范围**：
    - 文章标题（最高优先级）。
    - 文章标签（仅作为辅助召回条件，不支持标签组合筛选）。
    - 页面级导航项（如 `Timeline`、`Archive`、`Universe`）。
    - 可选补充文章摘要 / description，用于弱匹配。
  - **结果呈现**：
    - 建议按 `Posts` / `Pages` 分组展示。
    - 每条结果展示最少必要信息：标题 + 日期 / 分类 / 标签等轻量元数据。
    - 支持关键词高亮、上下键切换、Enter 打开目标。
    - 初始状态可展示最近文章或常用入口，避免空白面板。
  - **能力边界（核心约束）**：
    - **不支持** Tag Chip、标签墙、`#` 触发筛选、复合逻辑等 Archive 专属能力。
    - **不承担** 全量结果浏览与高密度信息探索。
    - 当用户需要更复杂检索时，面板底部应提供“前往 Archive 高级搜索”的二级入口。
  - **体验目标**：
    - 让用户在任意页面中以最低心智负担快速找到文章或页面。
    - 与 Archive 页形成“快速直达”与“深度检索”的双层结构，避免功能重复。

### 2.2 首页：时间轴流 (Home - Timeline)

- **F-HOME-01 垂直时间轴展示**

  - 页面不再使用传统网格卡片，而是采用一条贯穿页面的垂直线条。
  - **节点设计**：左侧显示日期（`MM.DD`），右侧显示文章标题与摘要。
  - **视觉区分**：不同分类的文章，在时间轴上的节点图标不同（如：`< />` 代表技术，`📖` 代表书评）。

### 2.3 归档与检索系统 (Archive & Search)

- **F-ARCH-01 归档页布局 (High Density)**
  - **设计隐喻**：“机密档案库” (The Database)。
  - **顶部区域**：展示 3 个粗略大分类 Tab（信息看板风格）：
    - `[TECH]`：技术/编程
    - `[REVIEW]`：书/影/音/游
    - `[LIFE]`：随笔/生活
  - **列表区域**：高密度文本列表。仅展示 `Date` + `Title` + `Tags`。按年份 -> 月份折叠或分组。
- **F-ARCH-02 复合搜索系统 (Advanced Search)**
  - **入口**：位于归档页顶部（Tab 下方）。
  - **边界定义**：该系统是 **Archive 专属的深度检索能力**，承担分类浏览、标签探索、复合逻辑筛选与高密度结果浏览；**不与全局导航中的快速搜索入口复用同一套交互壳层**。
  - **输入交互**：
    - 支持输入关键词进行全文/标题模糊匹配。
    - **核心需求**：支持 **“复合逻辑”**，即 `Tag:Java` + `Tag:并发` + `Keyword:锁` = 展示同时满足这三个条件的文章。
    - 纯粹的 Autoselect 最大的问题是“不可见（缺乏探索性）”，用户不知道有哪些标签可以搜。你可以将“标签墙”整合进搜索框的下拉状态中：
      - **触发时机：** 当用户聚焦（Focus）搜索框，或者主动输入特定的触发符（如 `#`）时，向下弹出一个带有毛玻璃效果或极简边框的下拉面板。
      - **面板内容：** 这个面板就是你的“标签墙”。可以按热度或首字母对标签进行分组展示。用户不仅可以通过鼠标点击选择，还能直接看到所有可用的 Tag。
  - **即时反馈**：输入时列表实时过滤，无刷新。

### 2.4 文章详情页 (Post Reader)

- **F-POST-01 阅读体验**

  - **排版**：单栏居中，限制最大行宽（约 65 字符），确保眼动舒适。
  - **字体**：标题使用宋体/明朝体，正文使用无衬线体。

- **F-POST-02 头部元数据 (Dossier Header)**

  - 文章顶部需展示：发布时间、预估阅读时长、所属标签、当前播放音乐（如有）。
  - 视觉风格参考“档案文件”头部，使用等宽字体和分割线。

- **F-POST-03 智能目录系统 (Smart TOC)**
  位置：

    - Desktop: 正文容器右侧悬浮 (Sticky, Top 20%)，与正文保持 4rem 间距。

    - Mobile: 隐藏，收纳至顶部导航栏或底部抽屉。
      逻辑：

    - 默认仅渲染 H2。

    - 长文 (>3k字) 且结构简单时自动开启 H3。忽略 H4+。

      视觉体验：

    - 字体：JetBrains Mono (等宽)。

    - 状态：默认低透明度 (40% Opacity) 灰色；

    - 激活：当前阅读章节高亮为主题色 (EVA Purple)，左侧显示指示线 (Border-Left)。

    - **默认状态**：隐形，只显示当前正在阅读章节的标题（高亮）。

      **交互**：鼠标移入目录区域时，显示所有标题（动画浮现）。

      **布局**：使用 `fixed` 定位，绝对不影响文章在屏幕正中央的完美居中。

      隐喻：设计为“数据流读取器”样式，不干扰沉浸式阅读。

- **F-POST-04 评论系统 (Comments) [P2]**

  - **位置**：文章正文底部。
  - **实现**：接入第三方评论服务（如 Giscus, Waline）。
  - **功能**：支持 GitHub 账号登录评论，支持 Markdown 语法。
  - **默认状态**：折叠或懒加载，点击“查看评论”后加载，节省流量。

### 2.5 媒体播放系统 (Global Media)

- **F-MED-01 全局播放器**
  - **位置**：屏幕右下角或左下角悬浮胶囊。
  - **功能**：播放/暂停控制，显示动态波形。
  - **持久化**：页面跳转时（如从首页点进文章），播放器**不中断、不刷新**（依赖 View Transitions 技术）。
- **F-MED-02 播放逻辑**
  - 若文章 Frontmatter 指定了 `music` 链接，进入文章时自动切歌。
  - 若文章未指定，保持当前播放列表或静音。
  
#### 2.5.1 音乐播放器组件设计（实现版）

- **实现结论**：播放器已从 `meting-js/aplayer` 黑盒接入，改为 `Meting API + 原生 Audio`，避免切页时内部 DOM 索引失配导致的 `classList` 报错。
- **组件拆分**：
  - UI 组件：`src/components/player/GlobalPlayer.tsx`
  - 播放桥接层：`src/lib/client/playerBridge.ts`
  - 全局状态：`src/stores/player.ts`
  - 配置解析：`src/lib/config.ts`
  - 全局挂载：`src/layouts/BaseLayout.astro`
- **配置协议**（`src/config/site.config.yaml`）：
  - `bgm.enabled: boolean`：是否启用全局播放器。
  - `bgm.playlistApi: string`：推荐配置，直接填写歌单接口，例如：`https://api.injahow.cn/meting/?type=playlist&id=17763697831`。
  - `bgm.defaultPlaylist: string[]`：兼容旧配置，允许填写网易歌单 URL 或纯歌单 ID，会在配置层转换为 `playlistApi`。
- **Meting API 返回契约**（播放器实际依赖字段）：
  - `name`：歌曲名
  - `artist`：歌手
  - `url`：音频流地址
  - `pic`：封面地址
  - `lrc`：歌词地址或歌词文本
- **状态管理（Nanostores）**：
  - `$playerStatus`: `idle | loading | ready | error`
  - `$isPlaying`: 播放状态
  - `$currentTrack`: 当前曲目信息
  - `$playList`: 当前歌单
  - `$lyricsOpen`: 歌词面板开关
- **生命周期策略**：
  - `BaseLayout` 挂载全局播放器，`transition:persist` 保持壳层节点跨页面复用。
  - `playerBridge` 维护单例 `Audio` 引擎，页面切换只解绑监听，不销毁音频实例。
  - 切歌时按索引更新 `Audio.src`，歌词按 `timeupdate` 同步。
- **异常与降级**：
  - 歌单接口失败：进入 `error` 状态并显示错误文案。
  - 歌词为空或拉取失败：显示 `NO LYRICS FOUND` / `LRC ERROR`，不影响播放。
  - 浏览器自动播放策略阻止：保持暂停状态，等待用户交互触发播放。
- **与内容系统关系**：
  - `src/content.config.ts` 已预留 `music` 字段 schema。
  - 当前阶段仅完成字段预留，不启用“文章进入自动切歌”行为。

### 2.6 运维与通知 (Ops & Notification)

- **F-OPS-01 自动化发布流**
  - 监听 GitHub 仓库 `dev` 分支的 Push 事件。
  - 自动触发构建流水线 (Build Pipeline)。
- **F-OPS-02 发布成功通知**
  - **触发时机**：**仅在**构建成功并完成部署（Deployment Success）后触发。构建失败不发送或发送报警。
  - **通道**：Bark (iOS Push)。
  - **内容格式**：
    - 标题：`Sync-Stream Deployed ✅`
    - 正文：如果一次上线一篇，正文显示`[最新文章标题] 已上线。耗时: 45s`。
    - 如果一次上线了多篇文章，正文：`成功上线文章x篇。耗时：56s`

------

## 3. 非功能性需求 (Non-functional Requirements)

### 3.1 移动端适配 (Mobile Responsiveness)

- **R-MOB-01**：时间轴在手机端（< 480px）需自动简化，隐藏左侧日期列，将日期移动到标题上方，改为单列流式布局。
- **R-MOB-02**：归档页的高密度列表在手机端需增加行高（44px+），确保手指触控友好。
- **R-MOB-03**：背景切换特效在低性能手机上需自动降级（禁用模糊或动态切换），防止掉帧。

### 3.2 性能指标 (Performance)

- **R-PERF-01**：Google Lighthouse 性能评分 > 95。
- **R-PERF-02**：首屏最大内容绘制 (LCP) < 1.2秒。
- **R-PERF-03**：图片需自动转换为 WebP 格式并实现懒加载。

### 3.3 视觉规范 (Design System)

- **风格定义**：Digital Monolith (数字巨石) + EVA 终端风格。
- **色彩**：
  - Primary: 纸张白 / 墨水黑。
  - Accent: 初号机紫 (`#6528F7`)、警告红、终端绿。
- **字体**：`Noto Serif SC` (标题), `Inter` (正文), `JetBrains Mono` (代码/元数据)。

### 3.4 多主题适配

+ 支持多主题适配（极简主义-二次元）P2需求，暂时不做

------

## 4. 需求优先级划分 (Prioritization)

基于 **2月12日 - 3月4日** 的开发窗口：

### 🔴 P0: 核心生存线 (Must Have - 2.20 前完成)

- **[系统]** Astro + Tailwind 项目骨架搭建。
- **[系统]** Obsidian 内容同步与解析 (Content Collections)。
- **[UI]** 首页垂直时间轴布局（静态）。
- **[UI]** 归档页基础列表展示（3大分类 Tab）。
- **[UI]** 文章详情页基础排版。
- **[运维]** GitHub Actions 自动部署 + Bark 发布成功通知。
- **[UI]** 移动端基础适配（不乱码、不溢出）。

### 🟡 P1: 体验差异化 (Should Have - 2.28 前完成)

- **[交互]** 首页滚动触发背景切换特效。
- **[检索]** 归档页的复合搜索功能（标签+关键词）。
- **[检索]** 全局 Quick Search / Command Palette（标题、页面直达、快捷键唤起）。
- **[交互]** 开启 View Transitions 实现无刷新跳转。
- **[媒体]** 全局持久化音乐播放器。
- **[UI]** 黑白主题切换逻辑。
- **[资源]** 自动化封面映射系统（根据 Hash 自动配图）。

### 🟢 P2: 锦上添花 (Nice to Have - 3.04 或实习后)

- **[互动]** 接入第三方评论系统。
- **[特效]** 图片灯箱 (Lightbox)。
- **[SEO]** Sitemap 与 RSS 生成。
- **[数据]** 归档页增加“文章年度热力图”。

## 5.验收要求

+ 文章一定以内容为主，不要喧哗夺主

## 6. 附录：数据字段定义 (Data Schema)

**文章元数据 (Frontmatter):**
文章名就是文件名
格式
```yml
创建时间: 2025-11-18 23:02:02
更新时间: 2026-02-13 17:18:49
tags: string[]       # 标签 (用于归档页筛选)
published: boolean   # true/false
```
样例:
```yml
tags:
创建时间: 2025-11-18 23:02:02
更新时间: 2026-02-13 17:18:49
  - 八股
  - 后端
published: false
```
注意，src存在blog文件夹，文件夹内3个子文件夹，分别是tech, review, life，对应tech, review, life分类，而不是在元数据中指定分类





## 技术要点

推荐的依赖

```cmd
pnpm add nanostores @nanostores/react clsx tailwind-merge class-variance-authority js-yaml astro-seo reading-time shiki
pnpm add -D @rollup/plugin-yaml @astrojs/sitemap astro-robots-txt astro-pagefind
```