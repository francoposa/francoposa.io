---
title: "Kotlin Setup for MacOS"
slug: kotlin-setup-macos
summary: "Kotlin development environment setup with SDKMAN and Intellij IDEA for MacOS"
date: 2020-06-30
order_number: 4
---

## 1. Install SDKMAN

Following the [SDKMAN installation guide](https://sdkman.io/install):

```shell
% curl -s "https://get.sdkman.io" | bash
```

Then follow the prompt to initialize SDKMAN:

```shell
% source "$HOME/.sdkman/bin/sdkman-init.sh"
```

The initialization step will place the following snippet at the end of your `.zshrc`:

```shell
# THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="/Users/franco/.sdkman"
[[ -s "/Users/franco/.sdkman/bin/sdkman-init.sh" ]] && source "/Users/franco/.sdkman/bin/sdkman-init.sh"
```

I prefer to keep `echo $PATH` as the last line of my `.zshrc`.

The SDKMAN initalization snippet seems to work fine even if it is not at the end of `.zshrc`. Without taking a closer at the contents of the init script, I assume the point is just to make sure that the JDKs/SDKs installed by SDKMAN remain ahead of all others in the `PATH`.


## 2. Install OpenJDK and the Kotlin Runtime with SDKMAN

### Install Java

SDKMAN will use current LTS release of the AdoptOpenJDK distribution by default.

```shell
% sdk install java

Downloading: java 11.0.7.hs-adpt
...
```
#### Confirm your `java` and `javac` commands map to the SDKMAN-installed OpenJDK

```shell
% which java
/Users/franco/.sdkman/candidates/java/current/bin/java

% which javac
/Users/franco/.sdkman/candidates/java/current/bin/javac

% java --version
openjdk 11.0.7 2020-04-14
OpenJDK Runtime Environment AdoptOpenJDK (build 11.0.7+10)
OpenJDK 64-Bit Server VM AdoptOpenJDK (build 11.0.7+10, mixed mode)
```

### Install Kotlin

```shell
% sdk install kotlin

Downloading: kotlin 1.3.72
...
```

#### Confirm your `kotlin` and `kotlinc` commands map to the SDKMAN-installed Kotlin

```shell
% which kotlin
/Users/franco/.sdkman/candidates/kotlin/current/bin/kotlin

% which kotlinc
/Users/franco/.sdkman/candidates/kotlin/current/bin/kotlinc

% kotlin -version
Kotlin version 1.3.72-release-468 (JRE 13.0.2+8)
```


## 3. Install IntelliJ IDEA Communiity Edition with Homebrew

```shell
% brew cask install intellij-idea-ce
```

Launch IDEA the same way you would an other MacOS application, then step through the setup prompts with the default options.

Make sure the official IntelliJ Kotlin plugin is installed and up to date.


## 4. Create a Kotlin Hello World Program in IntelliJ IDEA

Follow the offical Kotlin [Getting Started with IntelliJ IDEA](https://kotlinlang.org/docs/tutorials/jvm-get-started.html) steps.

When you are in the `New Project` dialogue, you will want to select `Project SDK` as the JDK you have just installed through SDKMAN. Click the dropdown menu, then `Add JDK`, and it will show you the JDK options it has detected from your `PATH`, such as `~/.sdkman/candidates/java/11.0.7.hs-adpt`.

Choose the JDK you want to use and continue through the remainder of the steps from the offical Kotlin guide

You will notice from the `-classpath` of your program run that IDEA will use the Kotlin bundled with the offical IntelliJ Kotlin plugin, rather than what you installed with SDKMAN:

```shell
/Users/franco/.sdkman/candidates/java/11.0.7.hs-adpt/bin/java \
-javaagent:/Applications/IntelliJ IDEA CE.app/Contents/lib/idea_rt.jar=51645:/Applications/IntelliJ IDEA CE.app/Contents/bin \
-Dfile.encoding=UTF-8 \
-classpath /Users/franco/repos/hello-kotlin/out/production/hello-kotlin:/Users/franco/Library/Application Support/JetBrains/IdeaIC2020.1/plugins/Kotlin/kotlinc/lib/kotlin-stdlib.jar:/Users/franco/Library/Application Support/JetBrains/IdeaIC2020.1/plugins/Kotlin/kotlinc/lib/kotlin-reflect.jar:/Users/franco/Library/Application Support/JetBrains/IdeaIC2020.1/plugins/Kotlin/kotlinc/lib/kotlin-test.jar:/Users/franco/Library/Application Support/JetBrains/IdeaIC2020.1/plugins/Kotlin/kotlinc/lib/kotlin-stdlib-jdk7.jar:/Users/franco/Library/Application Support/JetBrains/IdeaIC2020.1/plugins/Kotlin/kotlinc/lib/kotlin-stdlib-jdk8.jar AppKt
```

Changing this configuration is probably not worth the hassle to start. Kotlin is maintained and distributed by IntelliJ, so as long as your SDKMAN version and the IDEA plugin are updated, there should be no meaningful difference between the Kotlin available from your command line and the Kotlin used by IDEA.