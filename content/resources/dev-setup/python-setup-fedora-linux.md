---
title: "Python Setup for Fedora Linux with Pyenv"
slug: python-setup-fedora-linux
summary: "Simple and Flexible Python Version and Virtualenv Management"
description: "Fedora Development Libraries, Pyenv, and VirtualenvWrapper"
date: 2025-04-14
weight: 1
---

## Goals

We will:

1. Install the compilers and libraries required to build Python from source on Fedora.
2. Install Pyenv to manage and switch between multiple Python versions
3. Install VirtualenvWrapper as a Pyenv plugin to create and manage virtual environments
4. Try it Out!

## 0. Prerequisites

### 0.1 A Current Version of Fedora (or other) Linux

These steps have been tested on Fedora 41 & 42, though Steps 2 & 3 are valid for any Linux distribution -
you would just need to figure out the equivalent package names and package manager commands.

## 1. Install C Compilers & Development Libraries to Build Python from Source
Our tool of choice for Python version installation & management is [Pyenv](https://github.com/pyenv/pyenv).
While not everyone will need to manage multiple Python versions or interpreter implementations,
Pyenv is the de facto standard for those that do, and has a host of advantages and conveniences.

Pyenv's primary *inconvenience* is that each Python version - or at least the standard CPython versions -
must be built from source for our machine architecture when it is installed.
In order to build Python from source, we need a C compiler like `gcc` and its standard library interface `glibc`,
as well as standard system libraries in C that Python will link to: `bzip2`, `readline`, `libcurl`, `openssl`, etc.

Fedora's software repository managers have conveniently bundled these common dependencies
into two package groups: `c-development` and `development-libs`.
Installing only `development-libs` will also pull in the libraries we need from `c-development` dependencies,
but I prefer to explicitly list both in the installation command for a more informative `dnf` history:

```shell
sudo dnf group install -y c-development development-libs
```

Finally, we can optionally install two more libraries -
without `sqlite-devel` (SQLite bindings) and `tkinter` (some Python GUI framework),
the Python build will still succeed, but it will complain and spit out warning messages.

To set our minds at ease, we can install both before moving on:

```shell
sudo dnf install -y sqlite-devel tk-devel
```

