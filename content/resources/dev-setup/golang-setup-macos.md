---
layout: resource-post
title: "Golang Setup for MacOS"
slug: golang-setup-macos
summary: "A beginner's Golang development environment setup for MacOS"
date: 2020-01-24
lastmod: 2020-10-18
order_number: 2
---

## 1. Install Go with Homebrew

```shell
% brew install go
```

Add the following to your `.zshrc`:

```shell
# GOLANG
# assuming brew install, should be no need to add the Go install location to PATH
# brew installs to /usr/local/bin, which should also already be in PATH on MacOS

# This is the default, but prefer explicit over implicit
export GOPATH=$HOME/go

# Make your binary executables available anywhere on the machine 
export PATH=$PATH:$GOPATH/bin
```

## 2. Create your Workspace
This does not have to be in your home folder, just make sure it matches what you put in GOPATH

```shell
% mkdir ~/go
% mkdir ~/go/bin
% mkdir ~/go/pkg
% mkdir ~/go/src
```

## 3. Hello Golang

```shell
% mkdir ~/go/src/hello
% cd ~/go/src/hello
```
Create `hello.go` in your preferred editor:

```go
package main

import "fmt"

func main() {
    fmt.Print("Hello, World\n")
}
```

**Run it**

```shell
% go run hello.go
```

**Build it**

This creates an executable in the same directory:

```shell
% go build hello.go
```

**Run the binary**

```shell
% ./hello
Hello, World
```

**Install the binary**

This makes the executable available anywhere on your system:

```shell
% go install hello
```

**Change directory to somewhere else**

```shell
% cd ~/Downloads
```

**Verify your binary is runnable from somewhere else**

```shell
% hello
Hello, World
```

### Troubleshooting
If you get `zsh: command not found: hello` when trying to run your installed binary, there is likely an issue with your path. The `% go install` command places the binary in `$GOPATH/bin`, so check that `$GOPATH/bin` is in your `PATH` as described in the Installation step.