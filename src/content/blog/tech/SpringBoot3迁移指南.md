---
创建时间: 2025-10-30 08:00:00
更新时间: 2025-11-02 10:15:00
tags:
  - Spring
  - 后端
published: true
---

# Spring Boot 3 迁移指南

从 Spring Boot 2.x 迁移到 3.x 的踩坑记录，包含 Jakarta 命名空间变更、安全配置重构等要点。

## 命名空间大迁移

最大的变化是从 `javax.*` 到 `jakarta.*`，这不仅仅是包名替换那么简单。

## 安全配置重构

Spring Security 在 6.0 中彻底重构了配置方式，告别了继承式配置。
