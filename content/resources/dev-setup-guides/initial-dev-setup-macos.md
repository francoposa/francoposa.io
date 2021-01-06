---
title: "Initial Dev Setup for MacOS"
slug: initial-dev-setup-macos
summary: "General development environment setup for MacOS: Zsh, Homebrew, Sublime Text, and VS Code"
date: 2020-02-02
lastmod: 2020-10-18
order_number: 1
---
## The Very Basics
This guide is meant to walk through the most basic components of a dev environment setup on MacOs (Catalina and newer) - the steps you would perform before writing your first lines of code on a new or factory-reset machine.

For my purposes and preferences, these basic components are:

1. Configure zsh 
2. Set Terminal app preferences
3. Install Homebrew package manager
4. Install Sublime Text and Visual Studio Code

Configuration for specific programming languages and toolchains will be left for subsequent guides.

## 1. Configure Zsh

The following assumes you are using the MacOS built-in Terminal.app

### Set up Terminal.app to Use Zsh

1. Open the Terminal application
2. Open the Preferences pane using `Cmd +  ,` or by navigating to Terminal > Preferences in the menu bar
3. In the General tab, note that "Default login shell" is selected. On MacOS Catalina, the default shell has been updated to `/bin/zsh`. On previous MacOS versions, you can enter `/bin/zsh` in the "Command (complete path)" option to switch from the default (`/bin/bash`) to `zsh`
4. Use the Profiles tab to set any font, color, and cursor preferences you may have.

### Your First Entry Into `.zshrc`

Your zsh configuration will largely be managed in `.zshrc` file in your home directory. This file is executed as a shell script whenever you initiate a new zsh session.

The most basic use of your `.zshrc` and similar dotfiles is to set environment variables, but in time you will use it to initialize common tools and dependencies as well as execute any shell scripts or commands you find to be useful. 

To start, we are only going to have our `.zshrc` to do one thing: `echo $PATH`. As the system `PATH` is so crucial to command-line tooling, I prefer to be start every terminal session with a printout of the current `PATH`.

**Option 1: Command Line**

```shell
% echo "echo \$PATH" > ~/.zshrc
```

Note that the the `$` character needs to be escaped with a backslash so the actual string `echo $PATH` ends up in your dotfile, rather than the string `echo [whatever your PATH was when you ran this command]` which would not be particularly helpful.

**Option 2: A text editor**

Assuming you do not already have your preferred text editor installed, you can use the TextEdit app that ships with MacOS as the default editor for text files. The `open` command will attempt to open a file with whichever app is the default for that file's type.

```shell
% touch ~/.zshrc
% open ~/.zshrc
```

Add the line `echo $PATH` to the file and save.

### Test it Out

The `.zshrc` will be invoked when you open a new terminal session in a new Terminal tab (`Cmd + T`), a new window (`Cmd + N`), or by running the file using the `source` command.

You should see the contents of your `PATH` printed out. Compare the output to directly invoking `echo $PATH` from your terminal.

```shell
% source ~/.zshrc
/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
% echo $PATH
/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

## 2. Install Homebrew

Homebrew is the unofficial official package manager for MacOS, and will be your first stop for installing and managing a wide variety of development tools.

I always opt to `brew install` a package if possible rather than building from source or using a Mac disk image download. When it comes time to uninstall, upgrade, or manage dependencies, it's nice to be able to work with most of your dev tools using the same commands and working in the same directories.

Follow the instructions at [brew.sh](https://brew.sh) to install Homebrew. The installer will download and install the XCode Developer Command Line Tools if you do not already have the most up-to-date versions - this process can take quite awhile.

## 3. Install Sublime Text and Visual Studio Code with Homebrew

A general-purpose text editor is essential to your development environment. I use both Sublime Text and VS Code - Sublime for quick manipulation of scripts & text files, due to its quick startup, and VS Code for more involved development work where the VSCode plugins and tooling offer more functionality.

### Install Sublime Text editor & CLI

```shell
brew cask install sublime-text
```

The brew install sets up the `subl` launcher command for you, so go ahead and try it out: `subl ~/.zshrc`. Your zsh config will now be much easier to work with.

### Install Visual Studio Code editor & CLI

```shell
brew cask install visual-studio-code
```

Finally, test out  the VS Code launcher out as well: `code ~/.zshrc`.

VS Code is endlessly configurable for development in almost any progamming language and environment,
but there are a few basic settings and keybindings that can get you off to a solid start.

I have captured my basic VS Code setup in the [Visual Studio Code Settings and Configuration](/resources/dev-setup/visual-studio-code-configuration).

## Bonus: Install the Hack Font

Hack is by far my favorite monospaced font for text editors, and IDEs,
and installing it is the first step I take on any new dev computer.

Hack can be downloaded [here](https://sourcefoundry.org/hack/). Use Finder to unzip the .ttf files, open them, and click "Install Font"

Hack should then be available as an font option in Sublime, VS Code, and anywhere else you want a monospaced font.
