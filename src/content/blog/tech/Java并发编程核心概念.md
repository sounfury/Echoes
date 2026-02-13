---
创建时间: 2026-01-15 09:00:00
更新时间: 2026-01-18 14:20:00
tags:
  - Java
  - 并发
published: true
---

# Java并发编程核心概念

从 synchronized 到 ReentrantLock，梳理 Java 并发编程中的锁机制与线程安全模式。

## 为什么要学并发

在多核时代，并发编程不再是可选技能。理解 Java 内存模型和线程安全机制是后端开发的基本功。

## 锁的演进

Java 的锁机制经历了从 `synchronized` 到 `java.util.concurrent` 的演进过程，每一步都是性能与安全性的权衡。
