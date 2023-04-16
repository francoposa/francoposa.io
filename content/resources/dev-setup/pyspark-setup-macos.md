---
title: "Spark and PySpark Setup for MacOS"
slug: spark-pyspark-setup-macos
summary: "Optimized Spark and PySpark Environment Setup for MacOS"
date: 2020-10-25
order_number: 5
---

## Optimized PySpark Installation

This guide focuses on a specific method to install PySpark into your local development environment, which may or may not be suitable for your needs.
There are plenty of other installation guides for the more straightforward approach, which is to install PySpark separately into each Python virtual environment you use for local development.

The standard method of installing a full PySpark instance into each Python virtual environment has a few drawbacks:

1. The significant size of a PySpark installation is duplicated in several places on your machine
2. If your workflow includes frequent rebuilds of your Python virtual environment, repeatedly downloading and installing PySpark can be overly time-consuming

Instead, we can install a single global version of PySpark for each Spark version we use.
Using pip's "editable" install mode, the individual Python virtual environments can reference the global installation.
This eliminates both issues: PySpark is not duplicated into each environment, and there is no need to download and install PySpark each time a Python virtual environment is rebuilt.

These same optimizations can be applied to Docker builds as well.

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

The SDKMAN initalization snippet seems to work fine even if it is not at the end of `.zshrc`.
Without taking a closer at the contents of the init script, I assume the point is just to make sure that the JDKs/SDKs installed by SDKMAN remain ahead of all others in the `PATH`.
I prefer to keep `echo $PATH` as the last line of my `.zshrc`.

### SDKMAN Shell AutoCompletion

Optionally, install bash or zsh autocompletion as noted in the [docs](https://sdkman.io/usage#completion).
Using the autocomplete is currently the only way to list which SDKs you have installed locally - see GitHub issue [here](https://github.com/sdkman/sdkman-cli/issues/466).

## 2. Install OpenJDK with SDKMAN

### Install Java

The Scala binaries are [included with a Spark installation](https://stackoverflow.com/questions/27590474/how-can-spark-shell-work-without-installing-scala-beforehand), so we will not need to install Scala in addition to the JDK.

The Scala docs have a [version compatibility table](https://docs.scala-lang.org/overviews/jdk-compatibility/overview.html#version-compatibility-table) for Java and Scala versions.
This should not change very often, and generally you should not expect to have issues or need to upgrade if using an LTS version of Java - currently Java 8 and 11.

SDKMAN will use current LTS release of the AdoptOpenJDK distribution by default.

```shell
% sdk install java

Downloading: java 11.0.9.hs-adpt
...
```

#### Confirm your `java` and `javac` commands map to the SDKMAN-installed OpenJDK

```shell
% which java
/Users/franco/.sdkman/candidates/java/current/bin/java

% which javac
/Users/franco/.sdkman/candidates/java/current/bin/javac

% java --version
openjdk 11.0.9 2020-10-20
OpenJDK Runtime Environment AdoptOpenJDK (build 11.0.9+11)
OpenJDK 64-Bit Server VM AdoptOpenJDK (build 11.0.9+11, mixed mode)
```

## 3. Download and Install Spark from Apache.org

### Download Spark

The Spark website, [spark.apache.org](https://spark.apache.org/downloads) will have pre-built binaries for all the currently-supported versions of Spark.
Select and download the default (latest) version unless your Spark jobs need to be compatible with an earlier version.

### Install Spark

#### Unzip the Spark Tarball

The pre-built packages from the Spark website will give us a tarball with the version
in the name, such as `spark-3.0.1-bin-hadoop2.7.tgz`.

The tar archive can be unzipped by double-clicking in Finder or using the command line:

```shell
[~/Downloads]% tar --extract --file spark-3.0.1-bin-hadoop2.7.tgz
# or the equivalent:
[~/Downloads]% tar -xf spark-3.0.1-bin-hadoop2.7.tgz
```

This is will unpack everything into a folder with the same name, minus the `.tgz` extension.

#### Move Spark to the Install Location

Copy or move the unzipped folder to the desired Spark install location.
Including the version number in the install location allows us to maintain multiple Spark versions if desired.

```shell
[~/Downloads]% mv spark-3.0.1-bin-hadoop2.7 /usr/local/spark-3.0.1  # May require sudo
```

Symlink the versioned directory to a more convenient unversioned path.

```shell
% ln -s /usr/local/spark-3.0.1 /usr/local/spark  # May require sudo
```

#### Confirm your `spark-shell` and `pyspark` commands map to the Spark install location:

```shell
% export PATH=$PATH:/usr/local/spark/bin

% which pyspark
/usr/local/spark/bin/pyspark

% which spark-shell
/usr/local/spark/bin/spark-shell
```

If you want Spark to always be available globally, ensure `/usr/local/spark/bin` is added to your `PATH` in your `.zshrc`.

## 4. Make Global PySpark Available in Virtual Environments

Depending on your virtual environment setup, having PySpark available globally on your Mac will not necessarily make it available in a given virtual environment.
Instead, the global PySpark can be installed into a Python virtual environment as a [Pip editable dependency](https://pip.pypa.io/en/stable/reference/pip_install/#editable-installs).

```shell
% pip install -e /usr/local/spark/python
```

This will make the PySpark available in your virtual environment, but always referencing the code installed at `/usr/local/spark`.
If you update the version of Spark at `/usr/local/spark`, your virtual environment will use the updated version.

Alternatively, your virtual environment can reference a specific installed version instead of the symlink:

```shell
% pip install -e /usr/local/spark-3.0.1/python
```
