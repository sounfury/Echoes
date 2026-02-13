---
创建时间: 2026-02-10 14:30:00
更新时间: 2026-02-13 09:15:00
tags:
  - NextJS
  - DevOps
  - Vercel
published: true
---


自从三年前开始使用 Obsidian 作为主力知识库以来，内容发布的割裂感一直是我最大的痛点。每次写完文章，都需要手动复制到 Hugo 目录，处理图片路径，然后 Push 到 GitHub。

这个过程繁琐且容易出错，导致我逐渐失去了更新博客的动力。为了解决这个问题，我决定基于 Vercel 和 Next.js 重构整套发布系统。

## 系统架构设计

核心思路非常简单：**Obsidian Vault 即数据库**。

我们不需要复杂的 CMS，只需要一个能够解析 Markdown Frontmatter 并将其转化为静态页面的渲染引擎。这里我选择了 Next.js 的 SSG (Static Site Generation) 模式。

整体架构如下：

1. **数据源层** — Obsidian Vault，通过 Git Submodule 链接
2. **解析层** — Content Collections 解析 Markdown + Frontmatter
3. **渲染层** — Astro SSG 生成静态 HTML
4. **部署层** — Vercel 自动部署，边缘 CDN 加速

## 核心代码实现

为了处理 Obsidian 特有的 `[[WikiLink]]`，我们需要编写一个自定义的 Remark 插件：

```javascript
export function remarkObsidian() {
  return (tree) => {
    visit(tree, 'text', (node) => {
      const wikiLinkRegex = /\[\[(.*?)\]\]/g;
      // Transform wiki links to standard markdown links
      node.value = node.value.replace(wikiLinkRegex, (_, link) => {
        return `[${link}](/posts/${slugify(link)})`;
      });
    });
  };
}
```

## 自动化部署流程

配合 GitHub Actions，实现了从 Push 到部署的全自动化：

```yaml
name: Deploy Blog
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm build
      - uses: amondnet/vercel-action@v25
```

经过这番改造，现在我只需要在 Obsidian 中按下 `Ctrl+P` 唤起 Git 插件，一切就会自动完成。这才是真正的数字花园——只需要耕耘，不需要关心灌溉系统的管道铺设。
