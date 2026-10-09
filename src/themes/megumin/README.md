# 爆裂魔导 · 惠惠（megumin）

《为美好的世界献上祝福！》风格主题：羊皮纸底色 + 深红 / 漆黑配色，星空晚霞背景插画，纯 CSS 呼吸光，
背景带极淡的纸纤维噪点（`assets/paper-noise.svg`）和边缘暗角。

JS 效果（`effects.ts`，全部画在装饰位里，开启「减少动态效果」时只剩静止的法阵）：

- `magicCircle.ts`：右下角一座分层旋转的爆裂魔法阵。会量内容栏右侧的留白来摆放——
  文章页整座法阵收进右侧空白，放不下就缩成很淡的水印，不压正文；其他页面保持大尺寸
- `embers.ts`：二十多颗金色 / 深红余烬从底部缓缓上浮、明灭；标签页隐藏时暂停
- 点击页面会炸开一小团爆裂魔法火花，法阵闪光加速，余烬被吸向法阵中心

- 只支持亮色模式（`"schemes": ["light"]`），切到本主题时明暗按钮会被锁定。
- 不继承默认主题（没有 `extends`），完全独立地基于接口约定（`../_contract.md`，api 2）实现。

## 背景插画（可替换）

插画文件：`assets/art.webp`，在 `theme.css` 里以 `url(./assets/art.webp)` 引用，由 Vite 处理路径和哈希。

当前图片是一整张带背景的场景插画（惠惠持杖走在星空与火红晚霞下），因此按「背景画」来铺：

- 首页等页面在宽屏（≥64rem / 1024px）使用两栏：左侧 `clamp(320px, 38vw, 680px)` 宽的立绘栏（`[data-ui="aside"]`，sticky 满高，`cover`），金色斜角内框；窄屏改为约 40vh 的顶部横幅
- 文章页正文与导航按全屏居中，阅读区域上限 64rem；≥100rem / 1600px 时，左侧留白显示常驻立绘并向正文渐隐，右侧留白显示「魔导书索引」目录
- 文章页不足 100rem 时，立绘变为约 28vh 的顶部横幅，目录通过「文章目录」按钮展开；支持 Escape 收起，点击目录项跳转后自动收起

**替换方法**：把你的图片转成 webp 覆盖 `assets/art.webp` 即可（不需要改代码）。建议：

- 竖图（宽:高 ≈ 2:3），宽度 1000–1200px，体积 < 400KB（例如 `cwebp -q 82 -resize 1200 0 in.jpg -o art.webp`）
- 如果换成透明背景的立绘，把 `theme.css` 里 `[data-ui="aside"]` 背景的 `cover` 改为 `contain`

### 当前图片来源

- 站长（sounfury）提供的惠惠场景插画，原始出处 / 作者不详
- 处理：原图 2500×3800 JPG（3.9MB），缩放到 1200×1824 并转为 webp（q82，约 160KB）
- 角色「惠惠 / めぐみん」版权归《この素晴らしい世界に祝福を！》（暁なつめ / 三嶋くろね / KADOKAWA）所有。
  本图仅用于个人非商业博客；如能确认原作者，建议在此补充署名。

## 字体

`fonts/cinzel-decorative-700.woff2`：Cinzel Decorative Bold（Natanael Gama，SIL Open Font License 1.1），
只包含拉丁字母、数字和少量符号的子集（约 7KB）。在 `theme.css` 中通过 `@font-face` 声明，
只有挂载本主题时才会下载；中文仍回落到 Noto Serif SC。

## 结构与文案（接口约定 v2）

- 布局：通过 `--layout-*` 变量启用 `aside` 栏（见 `_contract.md` 2.5），不改任何组件源码
- 时间轴：`timeline::before` 画成金色锁链轴，`timeline-node` 是旋转的小法阵（`prefers-reduced-motion` 时静止）
- 文章正文：`post-body` 铺成一张「魔导书内页」（亮一档的纸 + 金色细线 + 四角角花），宽屏下文章页内容栏上限为 64rem，外侧留白 1.5rem、内页左右留白 2.25rem
- 卡片：`--card-*` 变量 + `corner-shape: bevel` 做成斜角金边羊皮纸卷轴；日期（`timeline-date`）移入卡片内作为日记落款
- 头部：半透明页眉与一道金色底线，宽屏时边缘与内容对齐；标题 / 导航用 Cinzel Decorative
- 文案（`theme.json` → `copy`）：副标题「吾乃红魔族第一的魔法师！」、首页「Explosion Log / 爆裂日记」、印章「EXPLOSION!」、评论标题
