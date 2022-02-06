---
title: "Postgres Dev Setup for MacOS"
slug: postgres-setup-macos
summary: "PostgreSQL setup & default 'postgres' user configuration for MacOS"
date: 2020-03-29
lastmod: 2020-10-18
order_number: 6
---

## Why Install with `postgres` as the Default User?

Most MacOS Postgres install guides will recommend a standard `brew install` in order to get up and running, but this common setup method has a flaw: the first, default superuser created on the Postgres instance will be your MacOS username.

This differs from a standard install on Linux environments where the original superuser name is `postgres`, and this minor difference can have its costs.

Not only will configurations differ between your MacOS Postgres and your Linux servers or Docker containers, but most how-tos, Stack Overflow answers, and troubleshooting tips you find will operate under the assumption that `postgres` is the superuser on any Postgres instance. Further, this initial superuser is nearly impossible to rename or remove later on as it owns the system tables essential to Postgres' inner workers.

Fortunately, we can avoid this all with a slight modification to the common install approach.

## 0. Do Not Install Anything! (Yet)

The standard `brew install` approach will automatically run a `post_install` step that initializes the Postgres instance, naming the default user as your MacOS username.

See the `post_install` step in the source code for the Homebrew postgres formula [here](https://github.com/Homebrew/homebrew-core/blob/master/Formula/postgresql.rb).

## 1. Install Postgres with Homebrew

We will avoid automatically running the `post-install` step by installing with the `--build-bottle` option.

From the Homebrew man pages:

> `--build-bottle`: Prepares the formula for eventual bottling during installation, skipping any post-install steps.

It is not the sole intended purpose of the `--build-bottle` option to skip post-install steps, but it works well enough for our purposes.
This method builds Postgres from the source files, so it may take a few minutes.

```shell
% brew install --build-bottle postgres
```

Upon completion, Homebrew will print out:

```text
==> Not running post_install as we're building a bottle
You can run it manually using `brew postinstall postgresql`
```

This is exactly what we wanted - no `post_install` step was run.

However, Homebrew will also print out some inaccurate info that does not apply
when the  `post_install` steps are not run:

```
This formula has created a default database cluster with:
  initdb --locale=C -E UTF-8 /usr/local/var/postgres
For more details, read:
  https://www.postgresql.org/docs/13/app-initdb.html
```

The cluster has not actually been initialized yet - we will handle that manually in the next step, with help from the same `initdb` documentation link that Homebrew printed out.

## 2.  Initialize Postgres with `postgres` as the Default User

The solution is alluded to by the inaccurate Homebrew output above, as well as the [PostgreSQL wiki First Steps page](https://wiki.postgresql.org/wiki/First_steps)

`initdb` is the CLI for initializing a new Postgres instance, and it allows the user to set all instance parameters.

The only required parameter for `initdb` is the directory to initialize the database cluster into, provided by the `-D/--pgdata` flag. For a Homebrew install, this should be `/usr/local/var/postgres`.

The other parameter we will use is the username of initial superuser for the database cluster. From the docs:

>`-U username`
>`--username=username` selects the user name of the database superuser. This defaults to the name of the effective user running initdb.
>It is really not important what the superuser's name is, but one might choose to keep the customary name postgres, even if the operating system user's name is different.

Put it all together to initialize with our preferred superuser:

```shell
% initdb -D /usr/local/var/postgres -U postgres
...[initialization logs]
```

This replaces the initialization step that would normally be run (without the option to name the superuser) during `post_install`

See the [Troubleshooting](#troubleshooting) section for common issues that can arise at this step.

## 3. Start Postgres

You may start and stop Postgres with either the built-in [`pg_ctl` command](https://www.postgresql.org/docs/13/app-pg-ctl.html) or the [`brew services`](https://github.com/Homebrew/homebrew-services) process manager. The primary difference is that a Postgres process started with `pg_ctl` will die when you exit the terminal session, while `brew services` will keep Postgres running in the background. Keeping Postgres running is probably the desired behavior for most developers.

`pg_ctl` also requires the `-D/--pgdata` argument to know where the Postgres instance is located:

```shell
% pg_ctl -D /usr/local/var/postgres start
...[startup logs]
```

If you receive an error from `pg_ctl`, Postgres is likely already running.

`brew services` does not require specifying the directory:

```shell
% brew services start postgres
==> Successfully started `postgresql` (label: homebrew.mxcl.postgresql)
```


## 4. Login to the Postgres CLI

[`Psql`](https://www.postgresql.org/docs/13/app-psql.html) is the Postgres interactive terminal, used to query interactively as well as manage the cluster with meta-commands.

By default, `psql` will attempt to log in with the currently-active username, so we have to provide the `-U/--username` flag to log in as `postgres`:

```shell
% psql -U postgres
psql (13.0)
Type "help" for help.

postgres=#
```

Now we can see that `postgres` is the only user on the instance:

```shell
postgres=# \du 
                                   List of roles
 Role name |                         Attributes                         | Member of 
-----------+------------------------------------------------------------+-----------
 postgres  | Superuser, Create role, Create DB, Replication, Bypass RLS | {}
```

As well as the owner of the existing databases:
```shell
postgres=# \l
                                  List of databases
   Name    |  Owner   | Encoding |   Collate   |    Ctype    |   Access privileges   
-----------+----------+----------+-------------+-------------+-----------------------
 postgres  | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 | 
 template0 | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 | =c/postgres          +
           |          |          |             |             | postgres=CTc/postgres
 template1 | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 | =c/postgres          +
           |          |          |             |             | postgres=CTc/postgres
```

## 5. Create Your First Database

Postgres allows hyphenated database names but hyphenated names don't work with the CLI's autocomplete, so delimiting with underscores will make your life a bit easier.

```shell
postgres=# CREATE DATABASE test_0;
CREATE DATABASE
```

Connect & try the tab-completion available on the database names:

```shell
postgres=# \c f[press tab here to autocomplete database name]
postgres=# \c test_0
You are now connected to database "test_0" as user "postgres".
test_0=#
```

## 6. Exit & Stop Postgres

From the `psql` command line, `\quit`, `\q`, and `Ctrl-D` will all work to exit the interactive session.

If you want to stop the Postgres instance altogether, use `brew services` - `pg_ctl` has a `stop` command but it doesn't always stop all the background processes that Postgres runs.

```shell
% brew services stop postgres
Stopping `postgresql`... (might take a while)
==> Successfully stopped `postgresql` (label: homebrew.mxcl.postgresql)
```

## Troubleshooting

When  running `initdb`, you may receive an error like this:

```shell
initdb: error: directory "/usr/local/var/postgres" exists but is not empty
If you want to create a new database system, either remove or empty
the directory "/usr/local/var/postgres" or run initdb
with an argument other than "/usr/local/var/postgres".
```

If this happens, it's likely too late - Homebrew has initialized the instance with your MacOS username as the owner of everything. Confirm by listing the databases to see their owners:

```shell
% psql -d postgres -c "\l"
                          List of databases
   Name    | Owner  | Encoding | Collate | Ctype | Access privileges
-----------+--------+----------+---------+-------+-------------------
 postgres  | franco | UTF8     | C       | C     |
 template0 | franco | UTF8     | C       | C     | =c/franco        +
           |        |          |         |       | franco=CTc/franco
 template1 | franco | UTF8     | C       | C     | =c/franco        +
           |        |          |         |       | franco=CTc/franco
```

Assuming this is truly a fresh Postgres install and we don't have any old data in `/usr/local/var/postgres` that we want to keep, this can be "fixed" by deleting the whole instance.

**THIS WILL DELETE ALL OF YOUR POSTGRES DATA**

```shell
% rm -rf /usr/local/var/postgres
```

Now you can jump back to [Step 2](#2--initialize-postgres-with-postgres-as-the-default-user).