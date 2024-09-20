---
title: "Git Good, Part 1: Configuration, Creating Repositories, and Committing Changes"
slug: git-basics-1
summary: "Git Config, Init, Add, and Commit"
date: 2023-10-02
weight: 1
---

## 0. Prerequisites

### 0.1 Install Git

Most machines will already have `git` installed, but the Git official book provides [install instructions](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) as well.

## 1. Initialize Global Git Configuration

### View Existing Global Git Configuration

The "global" Git config for a given user on a system is generally stored either in
`.gitconfig` or in `.config/git/config` under the user's home directory.

Run `git config --global --list --show-origin` to show any existing Git config we may have,
including the origin of the configuration, which is usually just the path to the relevant config file.

A scrollable paging program in your terminal will open to show the config:

```shell
[~/repos/git-demo-repo] % git config --global --list --show-origin  # press q to exit the viewer

file:/home/franco/.gitconfig    user.name=francoposa
file:/home/franco/.gitconfig    user.email=franco@francoposa.io
file:/home/franco/.gitconfig    init.defaultbranch=main
file:/home/franco/.gitconfig    pull.rebase=true
file:/home/franco/.gitconfig    push.autosetupremote=true
lines 1-4/4 (END)
```

If we do not have any existing git configuration, we may see:
```shell
fatal: unable to read config file '/home/franco/.gitconfig': No such file or directory
lines 1-1/1 (END)
```

The configuration file will be created when we set the first config options.

### Set Basic Global Git Configuration Options

Our first concern is to set the git user name and email, which are attached to all git "commits", or recorded changes.
Commonly, these are your full name or username and email associated with your account on GitHub or other remote git server.

```shell
% git config --global user.name francoposa
% git config --global user.email franco@francoposa.io
```

The changes will be saved in the global Git config file.

We can confirm these changes several different ways, including:
* another call to `git confit --global --list`
* manually viewing the global Git config file with `cat`, `less`, or your preferred text editor
* opening the global Git config file with the system default text editor with `git config --global --edit`

**Bonus: Set the Default Branch Name to `main`**

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

or have Git create the directory:

```shell
[~/repos] % git init git-demo-repo
Initialized empty Git repository in /home/franco/repos/git-demo-repo/.git/
```

Git maintains all the data essential to its operations in the `.git` subdirectory:

```shell
[~/repos/git-demo-repo] % ls .git/
branches  config  description  HEAD  hooks  info  objects  refs
```

Deleting or altering a `.git` directory which does not have a remote copy or backup
can result in the loss of all metadata and history of the repository.

### View Repository Git Configuration

The `.git/config` file holds the local config settings for the repo:

```shell
[~/repos/git-demo-repo] % cat .git/config
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
```

Run `git config --list --show-origin` - note the `--global` flag is not used this time.
This shows the Git config in effect for the current repository, a merging of the global with the local config.

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

Local Git config options will override the global options when using Git within the configured repository.
If a project requires different configuration than your global defaults,
we can override that option just for the current repository:

```shell
[~/repos/git-demo-repo] % git config pull.rebase false  # no --global flag
```

## Commit to a Git Repository

At this point, the Git repo should be empty (except for the `.git` directory).

Check Git status to confirm:

```shell
[~/repos/git-demo-repo] % git status
On branch main

No commits yet

nothing to commit (create/copy files and use "git add" to track)
```

Changes to a Git repository can be discarded without any record of their existence until they are _committed_.
Each _commit_ in a Git history is simply a record of what is different from the state of the repository at the previous commit.
These commits are also relatively interchangeably referred to as changesets, deltas, or patches.

### Create the First Changes

It is standard for a repo to have a markdown file in the root directory titled `README.md`,
containing information that pertains to the project, as whole.
The README generally starts with the repo or project name as the first line,
formatted as a title or h1 header with a preceding `#`

Create this file in your editor:

```markdown
# git-demo-repo
```

Check your Git status again:

```shell
[~/repos/git-demo-repo] % git status
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	README.md

nothing added to commit but untracked files present (use "git add" to track)
```

Now Git is aware that something is in the repository, but it is not yet actively tracking changes to it.
We can add any amount of changes to the README, and still all Git will know is that there is some untracked file named `README.md` sitting there.
If we delete the file, the changes will be gone forever.

We can change this by adding the file to Git's index, then checking the status again:

```shell
[~/repos/git-demo-repo] % git add README.md
[~/repos/git-demo-repo] % git status
On branch main

No commits yet

Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md
```

Now we have not committed our change yet, but Git is tracking the changes to the file.
Changes and files that have been added but not yet committed are said to be **staged** changes.

Change the file, say we decide we want to use are more proper project name instead of the hyphenated, lowercase repo name.
Remove the text `git-demo-repo` and replace it with `Git Demo Repository`.

Check Git status again:
```shell
[~/repos/git-demo-repo] % git status
On branch main

No commits yet

Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   README.md
```

So nothing has been committed, but Git is tracking `README.md`, and it are aware that
something has changed since the README was last added or staged.

Use Git's diff command to review what has changed:

```shell
[~/repos/git-demo-repo] % git diff  # press q to exit the viewer

diff --git a/README.md b/README.md
index 5676235..8f8bd34 100644
--- a/README.md
+++ b/README.md
@@ -1 +1 @@
-# git-demo-repo
+# Git Demo Repository
lines 1-7/7 (END)
```

With color-coded output and the +/- signs prefixing each line,
Git shows us the difference between the staged changes and the unstaged changes.

If we stage the latest changes, Git no longer outputs a diff:

```shell
[~/repos/git-demo-repo] % git add README.md
[~/repos/git-demo-repo] % git status
On branch main

No commits yet

Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md

[~/repos/git-demo-repo] % git diff  # press q to exit the viewer

byte 0/0 (END)
```

If we have nothing further to change, we are ready to submit this changeset to the Git history

### Record the First Commit

#### Git Commit

The primary requirement for a Git commit is that it has a commit message.
While this can be overridden, it is not recommended.

The easiest way to provide a commit message is via the Git commit command's `--message/-m` option:

```shell
[~/repos/git-demo-repo] % git commit -m "initial commit"
[main (root-commit) e1fd443] initial commit
 1 file changed, 1 insertion(+)
 create mode 100644 README.md
```

When a commit messages is not provided via the `--message/-m` option,
Git will prompt for a message by opening the system default terminal text editor.
For most Linux and Mac users, this is likely to be the notoriously-non-beginner-friendly
Vi or Vim editors - so you may want to learn the very basics of Vim in short order.

### View the Change Log

#### Git Log

```shell
[~/repos/git-demo-repo] % git log  # press q to exit the viewer

commit e1fd443f48ac0f4729fdf6cc931fb941bdda0bf8 (HEAD -> main)
Author: francoposa <franco@francoposa.io>
Date:   Tue Nov 21 17:20:01 2023 -0600

    initial commit
lines 1-5/5 (END)
```

Voilà!
