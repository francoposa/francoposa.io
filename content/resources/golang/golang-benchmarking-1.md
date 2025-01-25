---
title: "Golang Benchmarking, Part 1"
summary: "Basic CPU and Memory Benchmarking & Analysis with Go"
description: "Performance Benchmarks with Go's testing Package and Statistical Tests with benchstat"
tags:
  - Golang
  - Performance
  - Benchmarking
  - Shell-Scripting

slug: golang-benchmarking-1
date: 2025-01-25
draft: false
weight: 3
---

## Goals

We will:

1. Write & run a simple performance benchmark test with the Go testing package
2. Apply statistical tests between benchmark results with the `benchstat` tool

## 0. Prerequisites

### 0.1 Install `benchstat`

Install the `benchstat` tool into your `$GOPATH/bin`:
```shell
% go install golang.org/x/perf/cmd/benchstat@latest
```

Then check that `benchstat` is available in your `$PATH`:
```shell
% which benchstat
~/go/bin/benchstat
````

If the command is not found, then you may need to add the `$GOPATH/bin` directory to your `$PATH`:
```shell
% export PATH=$PATH:$GOPATH/bin
```

## 1. Write and Run a Simple Benchmark in Go

### 1.1. A Real-World Example

The example we will use here is simple - a single line in Grafana's Mimir codebase.

In a project spanning months, we had introduced enormous changes to a query request queuing algorithm
and spent much of our focus on the performance of the queue in the context of the larger system of microservices.

With such complex changes, it is inevitable that some minor issues make it past our test suites and code reviews.
We analyzed continuous profiles of the new code running in our dev environments
and looked for any performance hotspots that could be improved.

While this particular snippet was far from the worst offender, it looked like it could be easy to fix.
The code returns a list of strings with length 2, representing a path through a tree structure.

**Original**
```golang
    return append([]string{component}, tenant)
```

The apparent issue is that we create a new slice just to hold the first string,
then immediately create new slice with the `append` operations,
instead of just creating a single slice with the two strings:

**Potential Fix**
```golang
    return []string{component, tenant}
```
However, without a benchmark we could not tell or *if* or *how much* the potential fix could improve performance.

### 1.2. Write a Simple Benchmark

We start with our building blocks - the simplest possible representation of the code we want to benchmark.
Further complexity and changes to make it more representative of real-world usage can always come later.

Benchmark test names in Go must always start with `Benchmark` and take `b *testing.B` as their only argument.
Also note the use of `fmt.Sprintf("func=%s", testCase.name)` to name each scenario within the benchmark.
This is a [standardized `key=value` format](https://go.googlesource.com/proposal/+/master/design/14313-benchmark-format.md)
for differentiating Go benchmark scenarios, which allows the output to work with analysis tools like `benchstat`.

```golang
package benchmark_example

import (
	"fmt"
	"testing"
)

type queuePathFunc func(component, tenant string) []string

func baselineQueuePath(component, tenant string) []string {
	return append([]string{component}, tenant)
}

func noAppendQueuePath(component, tenant string) []string {
	return []string{component, tenant}
}

func BenchmarkQueuePath(b *testing.B) {
	var testCases = []struct {
		name     string
		pathFunc queuePathFunc
	}{
		{"baseline", baselineQueuePath},
		{"noAppend", noAppendQueuePath},
	}

	for _, testCase := range testCases {
		b.Run(fmt.Sprintf("func=%s", testCase.name), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_ = testCase.pathFunc("component", "tenant")
			}
		})
	}
}
```

### 1.3. Run the Benchmark & View Results

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
BenchmarkQueuePath/func=baseline-16    22597748    52.15 ns/op
BenchmarkQueuePath/func=noAppend-16    39801882    25.97 ns/op
PASS
ok      benchmark_example       2.304s
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
BenchmarkQueuePath/func=baseline-16    22136233    52.31 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=noAppend-16    41793476    26.22 ns/op    32 B/op    1 allocs/op
PASS
ok      benchmark_example       2.345s
```

This benchmark already shows us that the `noAppend` function is faster than the `baseline` using `append` -
around *twice* as fast with an average of ~26 ns/op vs. `baseline` at ~52 ns/op.
Further, as we suspected, the `baseline` function using `append` is making two memory allocations:
we can infer this is one allocation for each slice declared.

This is great news!
We have a simple change that can cut the CPU time spent in this hotspot in half.
However, not all benchmark results are this clear - often there is a much smaller difference
which requires a statistical test to determine if the difference is significant.
We have more we can do to increase our confidence that are results will carry over to the real world.

## 2. Control Benchmark Iterations

### 2.1. Understand Go's Benchmark `b.N`

Look at our benchmark output - why did the `noAppend` test run more than twice as many iterations as `baseline`?
The answer lies in `b.N`.

Recall our benchmark function:
```golang
b.Run(fmt.Sprintf("func=%s", testCase.name), func(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = testCase.pathFunc("component", "tenant")
	}
})
```

The Go [benchmarking docs](https://pkg.go.dev/testing#hdr-Benchmarks) give us a vague answer:

> The benchmark function must run the target code b.N times.
> It is called multiple times with b.N adjusted until the benchmark function lasts long enough to be timed reliably.

We have all sorts of reasons to want to control this number of iterations in our benchmark runs.
We can set a specific round number of iterations just to have a clean and consistent dataset,
reduce iterations to speed up the process for long and complex benchmarks,
or increasing the number of iterations to collect more data points and increase confidence in the results.

### 2.2. Control Benchmark Iterations with Test Flags

#### 2.2.1. The `-test.benchtime` Flag

We could just delete the usage of `b.N` from our code and hardcode the number of iterations into the test,
but it is far more convenient for us and any other engineers we work with to avoid this.

Instead we can control this behavior with the [`-benchtime` flag](https://pkg.go.dev/cmd/go#hdr-Testing_flags),
and each user can easily change the number of iterations to suit their needs.

```text
-benchtime t
    Run enough iterations of each benchmark to take t, specified
    as a time.Duration (for example, -benchtime 1h30s).
    The default is 1 second (1s).
    The special syntax Nx means to run the benchmark N times
    (for example, -benchtime 100x).
```

In our test runs up to this, point Go has chosen ~40 million iterations
in pursuit of its goal that "the benchmark function lasts long enough to be timed reliably".

With an emphasis collecting more datapoints to increase our confidence in the results, we should choose a larger number.
Since our benchmark is small and fast, it does not hurt to overshoot a bit iterations - why not a nice round 48 million?

Add the flag `-test.benchtime=48000000x` to our `go test` command:
```shell
[~/repos/benchmark-example] % go test \
  -test.bench=. \
  -test.benchtime=64000000x \
  -test.benchmem
goos: linux
goarch: amd64
pkg: benchmark_example
cpu: AMD Ryzen 7 PRO 6860Z with Radeon Graphics
BenchmarkQueuePath/func=baseline-16    48000000    52.13 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000    26.07 ns/op    32 B/op    1 allocs/op
PASS
ok      benchmark_example       3.759s
```

Now we have increased the iterations beyond what Go has chosen to ensure the scenarios are "timed reliably",
but Go still does not provide us with a way to make a statistical comparison between the two scenarios.

We will introduce the `benchstat` tool which is designed for that exact purpose, but first we must produce more data.
Like any statistical test, `benchstat` requires us to have several *samples* for each benchmark scenario,
where each sample is a full set of results from a single run of the benchmark suite.

To collect these samples, we just need to run the same suite multiple times and save the results to a file.

#### 2.2.2. The `-test.count` Flag and Saving Benchmark Results with `tee`

The `tee` command duplicates shell input to both standard output and a file.
In this case we can use `tee` to watch the progression of the benchmark runs in the terminal
at the same time that the results are written to a file for `benchstat` to analyze.
The `-a/--append` flag can also be used to ensure that each new run of `tee`
appends the new results to the file rather than overwriting any existing records.

The final piece is adding `-test.count` to give `benchstat` enough samples to work with:
```shell
[~/repos/benchmark-example] % go test \
  -test.bench=. \
  -test.benchtime=48000000x \
  -test.count=10 \
  -test.benchmem | tee -a benchmark-queue-path.txt
goos: linux
goarch: amd64
pkg: benchmark_example
cpu: AMD Ryzen 7 PRO 6860Z with Radeon Graphics
BenchmarkQueuePath/func=baseline-16    48000000       52.54 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       52.90 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       53.01 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       53.11 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       52.78 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       55.26 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       53.58 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       53.20 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       53.15 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=baseline-16    48000000       54.02 ns/op    48 B/op    2 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.61 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.60 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.39 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.30 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       27.16 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.97 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.59 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.43 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.19 ns/op    32 B/op    1 allocs/op
BenchmarkQueuePath/func=noAppend-16    48000000       26.68 ns/op    32 B/op    1 allocs/op
PASS
ok      benchmark_example       38.390s
```

## 3. Apply Statistical Tests with `benchstat`

By default, `benchstat` is set up to compare benchmark results with the same name across multiple files -
this case is tailored for comparing identical benchmark suite names across two different versions of a codebase.

In our case, we have a single version of the codebase, and we want to compare benchmark scenarios with different names.
The [documentation](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat#hdr-Configuring_comparisons)
for this is a bit hard to understand, but a working example will help.

We have the scenario names `BenchmarkQueuePath/func=baseline-16` and `BenchmarkQueuePath/func=noAppend-16`,
and we want to compare the samples for `func=baseline` to samples for `func=noAppend`.
Our use of the standard `key=value` format in the benchmark names will make possible with `benchstat`.
The `-col` option can take a list of keys across which to compare samples - in our case, the key is just `/func`.

This only works if our scenario names use the `key=value` format!

```shell
[~/repos/benchmark-example] % benchstat -col /func benchmark-queue-path.txt
goos: linux
goarch: amd64
pkg: benchmark_example
cpu: AMD Ryzen 7 PRO 6860Z with Radeon Graphics
             │  baseline   │              noAppend               │
             │   sec/op    │   sec/op     vs base                │
QueuePath-16   53.13n ± 2%   26.59n ± 1%  -49.94% (p=0.000 n=10)

             │  baseline  │              noAppend              │
             │    B/op    │    B/op     vs base                │
QueuePath-16   48.00 ± 0%   32.00 ± 0%  -33.33% (p=0.000 n=10)

             │  baseline  │              noAppend              │
             │ allocs/op  │ allocs/op   vs base                │
QueuePath-16   2.000 ± 0%   1.000 ± 0%  -50.00% (p=0.000 n=10)
```

This is, again, great news!
With p-values of `0.000` the statistical tests show that there is a statistically significant difference in performance.
The `noAppend` function is faster, uses less memory than the `baseline` function - by a long shot.

## 4. Conclusion

We now have a basic understanding of how write, run, and analyze benchmarks in Go.

Benchmarking is an often-overlooked part of engineering teams' development workflows,
done ad-hoc only when a large performance issue is suspected, or not at all.
However, like any other habit, a bit of discipline and repetition can make it a natural part of our workflow.
Proactive benchmarking can help us catch performance issues early, and even prevent them from ever reaching production.