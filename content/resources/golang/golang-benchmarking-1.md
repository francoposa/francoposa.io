---
title: "Golang Benchmarking, Part 1"
summary: "Basic CPU and Memory Benchmarking with Go"
description: "Performance Benchmarks with Go's testing Package and Statistical Analysis with benchstat"
tags:
  - Golang
  - Performance
  - Benchmarking
  - Shell Scripting

slug: golang-benchmarking-1
date: 2025-01-03
draft: true
weight: 3
---

## Goals

We will:

1. Write a simple benchmark test with the Go testing package
2. Run benchmarks and analyze CPU and Memory performance
3. Use the `benchstat` tool to apply statistical comparisons between benchmark results

## 1. Write and Run a Simple Benchmark in Go

### 1.1. A Real-World Example

The example we will use here is an isolated version of a codepath in Grafana's Mimir project.
After significant changes to one of Mimir's components,
we used profiles to look for possible performance hotspots in the new code.

While this particular snippet was far from the worst offender, it looked like it could be easy to fix.
The code returns a list of strings with length 2, representing a path through a tree structure.

**Original**
```go
    return append([]string{component}, tenant)
```

The potential problem is that we are creating a new slice just to hold the first string,
then appending the second string to it, instead of just creating a slice with the two strings:

**Potential Fix**
```go
    return []string{component, tenant}
```
However, without a benchmark we could not tell or *if* or *how much* the potential fix could improve performance.
It is possible that a compiler would optimize this away, only creating a single slice, or at least a single allocation.

Reading compiler's output is not the most common skill, and doing so still would not the answer the "how much" question,
so we opted to write a quick benchmark to measure the difference.
