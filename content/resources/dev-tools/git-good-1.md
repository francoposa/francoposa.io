---
title: "Git Good, Part 1: Initial Configuration and Creating Repositories"
slug: git-basics-1
summary: "Config, Init, and Commit"
date: 2023-10-02
order_number: 1
---

## 0. Prerequisites

* the `git` command-line tool installed on your machine
* an SSH keypair generated and registered to your local ssh daemon
* a GitHub account or other remote git server with the SSH public key registered

## 1. Initial Global Git Configuration

### Viewing Existing Configuration, If Any

The "global" Git config for a given user on a system is generally stored either in
`.gitconfig` or in `.config/git/config` under the user's home directory.

Run `% git config --global --list --show-origin` to show any existing git config you may have,
including the origin of the configuration, which is usually just the path to the relevant config file.

A scrollable paging program in your terminal will open to show the values; just press `q` to exit.  

```shell
file:/home/franco/.gitconfig    user.name=francoposa
file:/home/franco/.gitconfig    user.email=franco@francoposa.io
file:/home/franco/.gitconfig    init.defaultbranch=main
file:/home/franco/.gitconfig    push.autosetupremote=true
lines 1-4/4 (END)
```

If you do not have any existing git configuration, you may see:
```shell
fatal: unable to read config file '/home/franco/.gitconfig': No such file or directory
lines 1-1/1 (END)
```

Not to worry, we will be setting up our config next.

### Basic Global Git Configuration Values

Our first concern is to set the git user name and email, which are attached to all git "commits", or recorded changes.
Commonly, these are your full name or username and email associated with your account on GitHub or other remote git server.

```shell
% git config --global user.name francoposa
% git config --global user.email franco@francoposa.io
```

You may confirm these changes several different ways, including:
* another call to `git confit --global --list`
* manually viewing the global git config with `cat`, `less`, or your preferred text editor
* opening the global git config with the system default text editor with `git config --global --edit`

#### Bonus: Set Your Default Branch Name to `main`

While Git was never intended to have a single "default" branch, usage of Git has largely settled on
having one branch serve as the master record or source of truth for the state of the repository (or "repo").

This branch generally is used to spawn all other branches, and changes from new branches may go through
an approval process before being accepted and merged back into the main branch.

This branch was traditionally named the `master` branch, which has now fallen out of favor.
Most new Git repos now start with `main` as the default branch and many older Git repos have migrated as well.

```shell
% git config --global init.defaultbranch main
```

## 2. Initialize a Git Repository

Initialize a Git repository in an existing (preferably empty) directory:

```shell
[~/repos] % mkdir git-demo-repo
[~/repos] % cd git-demo-repo
[~/repos/git-demo-repo] % git init
Initialized empty Git repository in /home/franco/repos/git-demo-repo/.git/
```

or have Git create the directory for you:

```shell
[~/repos] % git init git-demo-repo
Initialized empty Git repository in /home/franco/repos/git-demo-repo/.git/
```

Git will initialize all of the files used to do its magic in the `.git` subdirectory:

```shell
[~/repos/git-demo-repo] % ls .git/
branches  config  description  HEAD  hooks  info  objects  refs
```

You can check out the local config settings for the repo:

```shell
[~/repos/git-demo-repo] % cat .git/config
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
```

And run `git config --list --show-origin` to see both the local Git config
and any global Git config not overwritten by the local options for the repo:

```shell
file:/home/franco/.gitconfig    user.name=francoposa
file:/home/franco/.gitconfig    user.email=franco@francoposa.io
file:/home/franco/.gitconfig    init.defaultbranch=main
file:/home/franco/.gitconfig    pull.rebase=true
file:/home/franco/.gitconfig    push.autosetupremote=true
file:.git/config        core.repositoryformatversion=0
file:.git/config        core.filemode=true
file:.git/config        core.bare=false
file:.git/config        core.logallrefupdates=true
lines 1-9/9 (END)
```
