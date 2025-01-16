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
date: 2025-01-16
draft: false
weight: 3
---

##### **this document is a work in progress**

## Goals

We will:

1. Write a simple benchmark test with the Go testing package
2. Run benchmarks and analyze CPU and Memory performance
3. Use the `benchstat` tool to apply statistical comparisons between benchmark results

## 1. Write and Run a Simple Benchmark in Go

### 1.1. A Real-World Example

The example we will use here is simple - a single line in Grafana's Mimir codebase.

In a project spanning months, we had introduced enormous changes to a query request queuing algorithm
and spent much of our focus on the performance of the queue in the context of the larger system of microservices.
As the end of the project neared, the system performed well under load tests
and we had proven out the correctness of our data structures and algorithms.

With such complex changes it is not just minor bugs we have to watch out for -
small mistakes often take the form of correct, but inefficient code.
Continuous profiles of the code running in our dev environments allowed us to find a few spots to improve.

While this particular snippet was far from the worst offender, it looked like it could be easy to fix.
The code returns a list of strings with length 2, representing a path through a tree structure.

**Original**
```golang
    return append([]string{component}, tenant)
```

The potential problem is that we are creating a new slice just to hold the first string,
then appending the second string to it, instead of just creating a slice with the two strings:

**Potential Fix**
```golang
    return []string{component, tenant}
```
However, without a benchmark we could not tell or *if* or *how much* the potential fix could improve performance.
It is possible that a compiler would optimize this away, only creating a single slice, or at least a single allocation.

Reading compiler's output is not the most common skill, and doing so still would not the answer the "how much" question,
so we opted to write a quick benchmark to measure the difference.


### 1.2. Write a Simple Benchmark

We start with our building blocks - the simplest possible representation of the code we want to benchmark.
Further complexity and changes to make it more representative of real-world usage can always come later.

Benchmark tests in Go must always start with `Benchmark` and take `b *testing.B` as their only argument.

```golang
package benchmark_example

import (
	"fmt"
	"testing"
)

type makeQueuePathFunc func(component, tenant string) []string

func baselineMakeQueuePath(component, tenant string) []string {
	return append([]string{component}, tenant)
}

func noAppendMakeQueuePath(component, tenant string) []string {
	return []string{component, tenant}
}

func BenchmarkMakeQueuePath(b *testing.B) {
	var testCases = []struct {
		name     string
		pathFunc makeQueuePathFunc
	}{
		{"baseline", baselineMakeQueuePath},
		{"noAppend", noAppendMakeQueuePath},
	}

	for _, testCase := range testCases {
		b.Run(fmt.Sprintf("func_%s", testCase.name), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_ = testCase.pathFunc("component", "tenant")
			}
		})
	}
}
```

### 1.3. Run a Simple Benchmark & Analyze Results

Go benchmarks are run via the standard `go test` command,
with [specific CLI flags](https://pkg.go.dev/cmd/go#hdr-Testing_flags) used to control benchmark behavior.

At the most basic, we just need the `-bench` flag:
```text
-bench regexp
    Run only those benchmarks matching a regular expression.
    By default, no benchmarks are run.
    To run all benchmarks, use '-bench .' or '-bench=.'.
...
```

Flags for `go test` are also recognized when with the prefix `test`, where `-bench` becomes `-test.bench`.
The `test` prefix is _required_ when running a pre-compiled test binary,
so it is easiest to get in the habit of always using the prefix.

From the root directory of our package, we run `go test -test.bench=.`:
```shell
[~/repos/benchmark-example] % go test -test.bench=.
goos: linux
goarch: amd64
pkg: benchmark_example
cpu: AMD Ryzen 7 PRO 6860Z with Radeon Graphics
BenchmarkMakeQueuePath/func_baseline-16    15183444    67.30 ns/op
BenchmarkMakeQueuePath/func_noAppend-16    42104808    29.80 ns/op
PASS
ok      benchmark_example       2.393s
```

The output of the benchmark shows us our test names, the number of times each test was run,
the average time taken for each test in nanoseconds, and the total time taken.

In this case, we are also interested in the memory allocations of each test scenario.
We can add this information to the benchmark output with the `-benchmem` flag:
```text
-benchmem
    Print memory allocation statistics for benchmarks.
    Allocations made in C or using C.malloc are not counted.
```

This time, we run `go test -test.bench=. -test.benchmem`:
```shell
[~/repos/benchmark-example] % go test -test.bench=. -test.benchmem
goos: linux
goarch: amd64
pkg: benchmark_example
cpu: AMD Ryzen 7 PRO 6860Z with Radeon Graphics
BenchmarkMakeQueuePath/func_baseline-16    15659572    67.82 ns/op    48 B/op    2 allocs/op
BenchmarkMakeQueuePath/func_noAppend-16    38129188    30.20 ns/op    32 B/op    1 allocs/op
PASS
ok      benchmark_example       2.332s
```

This benchmark already shows us that the `noAppend` function is faster than the `baseline` using `append` -
just over *twice* as fast with an average of ~30 ns/op vs. `baseline` at ~68 ns/op.
Further, as we suspected, the `baseline` function using `append` is making two memory allocations:
we can infer this is one allocation for each slice declared.
Turns out the compiler is not *that* smart.

This is great news!
We have a simple change that can cut the CPU time spent in this hotspot in half.
However, we still have more we can do to gain more information from the benchmarks
and increase our confidence that are results will carry over to the real world.

## 2. Improve the Benchmark Run Configuration: Controlling the Benchmark Iterations

### 2.1. Understand Go's Benchmark `b.N`

Look at our benchmark output - why did the `noAppend` test run more than twice as many iterations as `baseline`?
The answer lies in `b.N`.

Recall our benchmark function:
```golang
b.Run(fmt.Sprintf("func_%s", testCase.name), func(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = testCase.pathFunc("component", "tenant")
	}
})
```

The Go [benchmarking docs](https://pkg.go.dev/testing#hdr-Benchmarks) give us a vague answer:

> The benchmark function must run the target code b.N times.
> It is called multiple times with b.N adjusted until the benchmark function lasts long enough to be timed reliably.

This is all well and good, but "timed reliably" does not tell us much.
It notably does *not* indicate that the number of iterations is chosen
to give us a defensible comparison between our benchmark scenarios.

Benchmark outputs are not always as clear as one option running twice as fast as another.
Recall your introductory statistics classes if you ever took them, or paid attention:
when the difference between the averages of two datasets is small,
we can gain more confidence in the **statistical significance** of the difference by collecting more data points.

### 2.2. Control Benchmark Iterations with `-benchtime`

We could just delete the usage of `b.N` from our code and hardcode the number of iterations into the test,
but it is far more convenient for us and any other engineers we work with to avoid this.

Instead we can control this behavior with the [`-benchtime` flag](https://pkg.go.dev/cmd/go#hdr-Testing_flags),
and each user can easily change the number of iterations to suit their needs
or just omit the option to explicitly control iterations altogether.

```text
-benchtime t
    Run enough iterations of each benchmark to take t, specified
    as a time.Duration (for example, -benchtime 1h30s).
    The default is 1 second (1s).
    The special syntax Nx means to run the benchmark N times
    (for example, -benchtime 100x).
```

With an emphasis collecting more datapoints to increase our confidence in the results,
we can choose a number iterations greater than the ~40 million that Go has chosen for us
in pursuit of its goal that "the benchmark function lasts long enough to be timed reliably".

Since our benchmark is small and fast, it does not hurt to overshoot on iterations - why not a nice round 64 million?
```shell
[~/repos/benchmark-example] % go test -test.bench=. -test.benchtime=64000000x -test.benchmem
goos: linux
goarch: amd64
pkg: benchmark_example
cpu: AMD Ryzen 7 PRO 6860Z with Radeon Graphics
BenchmarkMakeQueuePath/func_baseline-16    64000000    66.19 ns/op    48 B/op    2 allocs/op
BenchmarkMakeQueuePath/func_noAppend-16    64000000    32.33 ns/op    32 B/op    1 allocs/op
PASS
ok      benchmark_example       6.311s
```
