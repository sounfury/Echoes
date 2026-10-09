# 爆裂魔导 · 惠惠（megumin）

《为美好的世界献上祝福！》风格主题：羊皮纸底色 + 深红 / 漆黑配色，星空晚霞背景插画，纯 CSS 法阵与呼吸光，
点击页面会炸开一小团爆裂魔法火花（`effects.ts`，开启「减少动态效果」时自动关闭）。

- 只支持亮色模式（`"schemes": ["light"]`），切到本主题时明暗按钮会被锁定。
- 不继承默认主题（没有 `extends`），完全独立地基于接口约定（`../_contract.md`，api 1）实现。

## 背景插画（可替换）

插画文件：`assets/art.webp`，在 `theme.css` 里以 `url(./assets/art.webp)` 引用，由 Vite 处理路径和哈希。

当前图片是一整张带背景的场景插画（惠惠持杖走在星空与火红晚霞下），因此按「背景画」来铺：

- 宽屏（≥1280px）：固定在视口右侧的竖幅画框（`cover`，人物居中偏上），左缘渐隐融入页面，不压正文
- 窄屏（<1280px）：整屏 `cover` 铺满，上面叠一层羊皮纸色半透明渐变，保证正文可读

**替换方法**：把你的图片转成 webp 覆盖 `assets/art.webp` 即可（不需要改代码）。建议：

- 竖图（宽:高 ≈ 2:3），宽度 1000–1200px，体积 < 400KB（例如 `cwebp -q 82 -resize 1200 0 in.jpg -o art.webp`）
- 如果换成透明背景的立绘，需要把 `theme.css` 里 `decor-back::after` 的 `cover` 改为 `contain` 并去掉渐变遮罩

### 当前图片来源

- 站长（sounfury）提供的惠惠场景插画，原始出处 / 作者不详
- 处理：原图 2500×3800 JPG（3.9MB），缩放到 1200×1824 并转为 webp（q82，约 160KB）
- 角色「惠惠 / めぐみん」版权归《この素晴らしい世界に祝福を！》（暁なつめ / 三嶋くろね / KADOKAWA）所有。
  本图仅用于个人非商业博客；如能确认原作者，建议在此补充署名。

## 字体

`fonts/cinzel-decorative-700.woff2`：Cinzel Decorative Bold（Natanael Gama，SIL Open Font License 1.1），
只包含拉丁字母、数字和少量符号的子集（约 7KB）。在 `theme.css` 中通过 `@font-face` 声明，
只有挂载本主题时才会下载；中文仍回落到 Noto Serif SC。
