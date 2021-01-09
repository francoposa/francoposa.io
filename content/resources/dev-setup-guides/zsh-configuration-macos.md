---
title: "Zsh Configuration for MacOS"
slug: zsh-configuration-macos
summary: "Configuration for Zsh supporting development in Python, Golang, and Kotlin on MacOS"
date: 2020-07-08
lastmod: 2020-11-24
order_number: 9
---

```shell
# Show current directory in command prompt, truncating where it can
# https://stackoverflow.com/questions/25090295/how-to-you-configure-the-command-prompt-in-linux-to-show-current-directory
export PS1="[%~]%% "

# ZSH AUTOCOMPLETE
autoload -Uz compinit && compinit -u

# NVM & NPM - commented out when not in use as this initialization step is slow on my poor little Macbook Air
# export NVM_DIR="$HOME/.nvm"
# [ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"  # This loads nvm
# [ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] && . "/usr/local/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion

# PYENV
export PYENV_VERSION=3.8.6
if command -v pyenv 1>/dev/null 2>&1; then
  eval "$(pyenv init -)"
  # eval "$(pyenv virtualenv-init -)" # PYENV-VIRTUALENV - not using currently, in favor of pyenv-virtualenvwrapper
fi  # adds ~/.pyenv/shims to the beginning of PATH

# # PYENV-VIRTUALENVWRAPPER
# # Initalize virtualenvwrapper so commands are available
pyenv virtualenvwrapper
# # This is the default, but prefer explicit over implicit
# export WORKON_HOME=$HOME/.virtualenvs

# POETRY
# This gets put in ~/.profile by the installer, but moved it here
export PATH=$PATH:$HOME/.poetry/bin

# RUST-CARGO
# This gets put in ~/.profile by the installer, but moved it here
export PATH="$HOME/.cargo/bin:$PATH"

# This is the default, but prefer explicit over implicit
export GOPATH=$HOME/go

# Make your binary executables available anywhere on the machine 
export PATH=$PATH:$GOPATH/bin

# Added automatically by sdkman
# Seems to work fine even if it is not at the end of .zshrc, I assume it just doesn't want the PATH
# getting pre-empted by something else that would put another SDK ahead of the sdkman ones
#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="/Users/franco/.sdkman"
[[ -s "/Users/franco/.sdkman/bin/sdkman-init.sh" ]] && source "/Users/franco/.sdkman/bin/sdkman-init.sh"

export PATH=$PATH:/usr/local/spark/bin

neofetch

echo $PATH

```
