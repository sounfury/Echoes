# 爆裂魔导 · 惠惠（megumin）

《为美好的世界献上祝福！》风格主题：羊皮纸底色 + 深红 / 漆黑配色，纯 CSS 法阵与呼吸光，
点击页面会炸开一小团爆裂魔法火花（`effects.ts`，开启「减少动态效果」时自动关闭）。

- 只支持亮色模式（`"schemes": ["light"]`），切到本主题时明暗按钮会被锁定。
- 不继承默认主题（没有 `extends`），完全独立地基于接口约定（`../_contract.md`，api 1）实现。

## 角色立绘（可替换）

立绘文件：`assets/art.webp`，在 `theme.css` 里以 `url(./assets/art.webp)` 引用，由 Vite 处理路径和哈希。

**替换方法**：把你自己的图片转成 webp，覆盖 `assets/art.webp` 即可（不需要改任何代码）。建议：

- 透明背景的全身 / 半身立绘，角色朝左或居中，竖图（宽:高 ≈ 3:5）
- 宽度 800–1000px，体积 < 300KB（例如 `cwebp -q 80 in.png -o art.webp`）
- 立绘固定在视口右下角；宽屏（≥1280px）完整显示，窄屏 / 文章页会自动变淡

### 当前图片来源与署名

- 作品：「Megumin Render」 by **chiyochans**（DeviantArt，2017）
- 来源页面：<https://www.deviantart.com/chiyochans/art/Megumin-Render-662303446>
- 处理：取页面公开预览图（1000×1553 透明 PNG），裁掉透明边后转为 webp（约 100KB）；图中保留作者水印
- 角色「惠惠 / めぐみん」版权归《この素晴らしい世界に祝福を！》（暁なつめ / 三嶋くろね / KADOKAWA）所有。
  本图仅用于个人非商业博客；如需商用或作者有异议，请替换为自有 / 已授权图片。

## 字体

`fonts/cinzel-decorative-700.woff2`：Cinzel Decorative Bold（Natanael Gama，SIL Open Font License 1.1），
只包含拉丁字母、数字和少量符号的子集（约 7KB）。在 `theme.css` 中通过 `@font-face` 声明，
只有挂载本主题时才会下载；中文仍回落到 Noto Serif SC。
