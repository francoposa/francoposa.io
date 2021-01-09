---
title: "Spark and PySpark Setup for MacOS"
slug: spark-pyspark-setup-macos
summary: "Spark and PySpark Environment Setup for MacOS"
date: 2020-10-25
lastmod: 2020-10-25
order_number: 6
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


## 2. Install OpenJDK with SDKMAN

### Install Java

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

The Scala binaries are [included with a Spark installation](https://stackoverflow.com/
questions/27590474/how-can-spark-shell-work-without-installing-scala-beforehand),
so we will not need to install Scala in addition to the JDK.

## 3. Download and Install Spark from Apache.org

### Download Spark

The Spark website, [spark.apache.org](https://spark.apache.org/downloads) will have pre-built
binaries for all the currently-supported versions of Spark. Select and download the default
(latest) version unless your Spark jobs need to be compatible with an earlier version.

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

Copy or move the unzipped folder to the desired Spark instal location, such as `/usr/local/spark`.

```shell
% mv spark-3.0.1-bin-hadoop2.7 /usr/local/spark  # May require sudo
```

Finally, make your Spark install location available in your `PATH` by specifying
it in your `.zshrc`:

```shell
export PATH=$PATH:/usr/local/spark/bin
```

#### Confirm your `spark-shell` and `pyspark` commands map to the Spark install location:

```shell
% which pyspark
/usr/local/spark/bin/pyspark

% which spark-shell
/usr/local/spark/bin/spark-shell
```

## 4. Make Global PySpark Available in Virtual Environments

Depending on your virtual environment setup, having PySpark available globally on your Mac will not necessarily make it available in a given virtual environment. Thankfully, we can still utilize the global PySpark install
into our environment by treating it as  [Pip "editable" dependency](https://pip.pypa.io/en/stable/reference/pip_install/#editable-installs).

```shell
% pip install -e /usr/local/spark/python
```

This will make the PySpark available in your virtual environment, but always using the code installed at
`/usr/local/spark`.

If you update the version of Spark at `/usr/local/spark`, your virtual environment will use the updated version.