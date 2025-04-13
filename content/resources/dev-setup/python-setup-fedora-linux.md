---
title: "Python Setup for Linux with Pyenv"
slug: python-setup-linux
summary: "Simple and Flexible Python Version and Virtualenv Management"
description: "Linux Development Libraries, Pyenv, and Virtualenvwrapper"
date: 2025-04-13
weight: 1
---

## Goals

We will:

1. Install the compilers and libraries required to build Python from source on Linux.
2. Install Pyenv to manage and switch between multiple Python versions
3. Install Virtualenvwrapper as a Pyenv plugin to create and manage virtual environments
4. Try it Out!

## 0. Prerequisites

### 0.1 A Current Version of Linux

The development package names for Step 1 are valid on Fedora Linux, tested on Fedora Workstation 41 & 42.
For other distros, the equivalent names are easily found via a search of the package repositories.

All other steps are distribution-agnostic.

## 1. Install Compilers & Development Libraries

Our tool of choice for Python version installation & management is [Pyenv](https://github.com/pyenv/pyenv).
While not everyone will need to manage multiple Python versions or interpreter implementations,
Pyenv is the de facto standard for those that do, and has a host of advantages and conveniences.

Pyenv's primary *inconvenience* is that it does not utilize a repository of pre-built Python versions.
Each of the standard C-based Python versions must be built from source when it is installed.
For this, we need a C compiler like `gcc` and its standard library interface `glibc`,
as well as standard system libraries in C that Python will link to: `bzip2`, `readline`, `libcurl`, `openssl`, etc.

### 1.1 Option 1: Install With Fedora Package Groups

Fedora bundles these common dependencies into two package groups: `c-development` and `development-libs`.
Installing only `development-libs` will also pull in the libraries we need from `c-development` dependencies,
but we can explicitly list both in the installation command for a more informative `dnf` history:

```shell
% sudo dnf group install -y c-development development-libs
```

Finally, we can optionally install two more libraries:
`sqlite-devel` (SQLite bindings) and `tkinter` (some Python GUI framework).
Without them, the Python build will still succeed, but it will complain and spit out warning messages.

To set our minds at ease, we can install both before moving on:

```shell
% sudo dnf install -y sqlite-devel tk-devel
```

### 1.2 Option 2: Install Individual Fedora Packages

For those that prefer to keep the system as slim as possible,
we can skip the convenience of package groups and install only the required individual packages.

The absolute minimal package set to build Python without errors is `gcc`, `openssl-devel`, and `zlib-devel`.
The install will succeed, but it will have a lot of complaints about packages it cannot find and link to.
We can infer the extra packages it wants from the warnings at the end of the build output:
`bzip2-devel`, `libffi-devel`, `ncurses-devel`, `readline-devel`, `sqlite-devel`, `tk-devel`, and `xz-devel`.

So all in, to support a Python install built from source:

```shell
% sudo dnf install -y bzip2-devel gcc libffi-devel ncurses-devel openssl-devel readline-devel sqlite-devel tk-devel xz-devel zlib-devel
```

## 2. Install and Set Up Pyenv

### 2.1 Install Pyenv

We can use the official installer:

```shell
% curl -fsSL https://pyenv.run | bash
```

That's it - sort of.

### 2.2 Set Up Pyenv
The installer will spit out instructions about adding Pyenv initialization to the shell rc files.
We can do a slightly improved version :

```shell
# PYENV
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
export PYENV_VERSION=3.13.2
if command -v pyenv 1>/dev/null 2>&1; then
  eval "$(pyenv init -)"
  # eval "$(pyenv virtualenv-init -)" # PYENV-VIRTUALENV - not in use, in favor of pyenv-virtualenvwrapper
fi  # adds ~/.pyenv/shims to the beginning of PATH
```

The `PYENV_VERSION` variable sets our default Python version to use each time we initialize our shell environment.
The version is not installed yet - we will get there shortly.

Open a new terminal window or tab or source the shell files for the changes to take effect.

## 3. Install and Set Up Virtualenvwrapper as a Pyenv Plugin

### 3.1 Install Pyenv-Virtualenvwrapper

Following the [official instructions](https://github.com/pyenv/pyenv-virtualenvwrapper),
clone the management scripts into the Pyenv plugins directory:

```shell
% git clone https://github.com/pyenv/pyenv-virtualenvwrapper.git $(pyenv root)/plugins/pyenv-virtualenvwrapper
```

This step alone does not install Virtualenvwrapper - it only enables the `pyenv virtualenvwrapper` subcommand.
Each time we start working with a new Python version managed by Pyenv,
we need to run `pyenv virtualenvwrapper` to install and initialize it.
We can handle this is by adding command to our shell rc files, after the Pyenv init steps:

```shell
# PYENV-VIRTUALENVWRAPPER
# Initalize virtualenvwrapper so commands are available.
pyenv virtualenvwrapper
# This is the default, but prefer explicit over implicit.
export WORKON_HOME=$HOME/.virtualenvs
```

## 4. Try it Out!

### 4.1 Install Python versions

Install some versions of Python we want to work with:

```shell
% pyenv install 3.12.8
# ...
% pyenv install 3.13.2
# ...
% pyenv versions
  system
  3.12.8
* 3.13.2 (set by PYENV_VERSION environment variable)
```

### 4.2 Create a Virtual Environment With the Active Python Version
Virtualenvwrapper's `mkvirtualenv` ("make virtual environment") command
will use whichever Python version you have active:

```shell
% pyenv version
3.13.2 (set by PYENV_VERSION environment variable)
% mkvirtualenv temp3-13-2
# ...
(temp3-13-2) % which python
/Users/franco/.virtualenvs/temp3-13-2/bin/python
(temp3-13-2) %  python --version
Python 3.13.2
```

### 4.3 Create a Virtual Environment With a Different Python Version
We can also tell `virtualenvwrapper` which Python version a new virtualenv should be created with,
without needing to mess with Pyenv directly or worry about the current environment:

```shell
(temp3-13-2) % pyenv version
3.13.2 (set by PYENV_VERSION environment variable)
(temp3-13-2) % mkvirtualenv temp3-12-8 --python ~/.pyenv/versions/3.12.8/bin/python
# ...
(temp3-12-8) % which python
/Users/franco/.virtualenvs/temp3-12-8/bin/python
(temp3-12-8) % python --version
Python 3.12.8
```

### 4.4 List all Virtual Environments

```shell
(temp3-12-8) % lsvirtualenv -b  # -b for "brief", output takes up less space
temp3-12-8
temp3-13-2
```

### 4.5 Exit the Virtual Environment

```shell
(temp3-12-8) % deactivate
# now we are back to normal, outside the virtualenvs
% which python
~/.pyenv/shims/python
% python --version
Python 3.13.2
% pyenv versions
  system
  3.12.8
* 3.13.2 (set by PYENV_VERSION environment variable)
```

```shell
% lsvirtualenv -b  # -b for "brief", output takes up less space
temp3-12-8
temp3-13-2
```

### Clean Up
Wipe out any virtualenvs you no longer need:

```shell
% rmvirtualenv temp3-12-8 temp3-13-2
Removing temp3-12-8...
Removing temp3-13-2...
```

## Conclusion
With Pyenv configured and the standard C development libraries and tooling installed,
we now have the ability to compile from source & install any available CPython version.
The versions are completely independent, scoped to our home directory, and can be switched between easily.

With the addition of Virtualenvwrapper hooked up as a Pyenv plugin,
we also have a slick interface for managing all of our virtual environments,
each of which is isolated to its given Pyenv-managed Python version.

While Python development has no shortage of tooling troubles and idiosyncrasies,
this setup offers a tried and true and *mostly* pain-free basis from which to start.
