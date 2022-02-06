---
title: "Python Setup for MacOS Part 1: Pyenv + Virtualenvwrapper"
slug: python-setup-macos-1
summary: "Worry-free Python development environment setup for MacOS"
date: 2020-02-24
lastmod: 2020-02-24
order_number: 4
---

## Our Choice of Tools: Pyenv & VirtualenvWrapper

Installing multiple Python versions and managing Python virtual environments on a Mac is notoriously painful, and choosing the wrong tools for the job can lead to countless lost development hours. To make matters worse, many highly-ranked online guides suggest Python environment management strategies that are are outdated, inadequate, and will only lead to further frustration in your future.

After trying nearly every available option, I have found a combination of tools that provide control and simplicity:

 * **Pyenv**:  for installing & switching between different python versions
 * **VirtualenvWrapper**:  for creating & managing virtual environments

Hopefully by writing up this guide I can save someone else the hours I have lost to the Python ecosystem!

## 0. Do Not Install Anything! (Yet)

Save yourself the headaches.

Do not brew install python3, do not mess with Python 2 or Python 3 versions that ship with MacOS. Most importantly, do not try to install Virtualenvwrapper on its own. The standard Virtualenvwrapper does not play well with Pyenv, but for compatibility, Virtualenvwrapper has been implemented as a [Pyenv plugin](https://github.com/pyenv/pyenv/wiki/Plugins).

## 1. Install Pyenv-Virtualenvwrapper with Homebrew

```shell
% brew install pyenv-virtualenvwrapper
```

## 2. Set Up Pyenv

### Initialize Pyenv

```shell
% eval "$(pyenv init -)"
% echo $PATH
/Users/franco/.pyenv/shims:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

As long as `~/.pyenv/shims` sits at the beginning of your `PATH`, Python versions installed by Pyenv will take precedence over any others.

Add this to your `.zshrc` to ensure Pyenv is initialized on each new shell session:

```shell
if command -v pyenv 1>/dev/null 2>&1; then
  eval "$(pyenv init -)"
fi
```

Check out this [Stack Overflow post](https://stackoverflow.com/questions/592620/how-can-i-check-if-a-program-exists-from-a-bash-script) if you want to get in the weeds of what those shell commands mean.

### Install your Python versions

Install some versions of Python we want to work with:

```shell
% pyenv install 3.6.8
% pyenv install 3.8.0
% pyenv versions
* system (set by /Users/franco/.pyenv/version)
  3.6.8
  3.8.0
```

Now we have three versions available. Switch the version for this shell session and start it up to see the effect:

```shell
% pyenv shell 3.6.8
% python
Python 3.6.8 (default, Jan 21 2020, 21:10:14) 
...
>>>
```

### Set your global default Python version
To make sure you always start a shell session with your preferred default Python version, add this line to your `.zshrc`:

```shell
export PYENV_VERSION=3.8.0
```

Source your `.zshrc` or open a new terminal window to see the effects on your next shell session:

```shell
% pyenv versions
  system
  3.6.8
* 3.8.0 (set by PYENV_VERSION environment variable)
```

## 3. Set up Virtualenvwrapper

```shell
% pyenv virtualenvwrapper
```

The first time Virtualenvwrapper runs for each Python version, it will need to download a few pip packages.

In order to have access to the Virtualenvwrapper commands you will need to run this for each shell session. Add the line `pyenv virtualenvwrapper` to your `.zshrc`.

## 4. Try it Out

### Create a virtual environment with the current active Python version
Virtualenvwrapper's `mkvirtualenv` ("make virtual environment") command will use whichever Python version you have active, so it might help to check before usage:

```shell
% pyenv version
3.8.0 (set by PYENV_VERSION environment variable)
% mkvirtualenv temp380
...
(temp380) % which python
/Users/franco/.virtualenvs/temp380/bin/python
(temp380) %  python --version
Python 3.8.0
```

### Create a virtual environment with a different Python version
Virtualenvwrapper can also point to which Python version a new virtualenv should be created with, without needing to mess with Pyenv directly or worry about the current environment:

```shell
(temp380) % pyenv version
3.8.0 (set by PYENV_VERSION environment variable)
(temp380) % mkvirtualenv temp368 --python ~/.pyenv/versions/3.6.8/bin/python
...
(temp368) % which python
/Users/franco/.virtualenvs/temp368/bin/python
(temp368) % python --version
Python 3.6.8
```

### List all virtual environments

```shell
% lsvirtualenv -b  # -b for "brief", output takes up less space
temp368
temp380
```

### Clean Up
Wipe out any virtualenvs you no longer need:

```shell
%  rmvirtualenv temp368
```


## Final Notes:
 You may notice that in the Github repo that the [Pyenv-Virtualenvwrapper](https://github.com/pyenv/pyenv-virtualenvwrapper) plugin has not been updated since 2017. It still works perfectly, but it may be a good small project to fork and/or maintain so that it does not get lost to the sands of time.