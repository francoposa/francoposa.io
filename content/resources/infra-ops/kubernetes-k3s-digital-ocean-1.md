---
title: "Kubernetes with K3s, Ansible, and DigitalOcean Part 1"
slug: kubernetes-k3s-ansible-digital-ocean-1
summary: "Creating DigitalOcean Server Inventory with Ansible"
date: 2021-07-27
lastmod: 2022-06-17
order_number: 2
---

**This document is a work in progress**

## 0. Prerequisites

### Register SSH Keys to Your DigitalOcean Account

[Generate an SSH keypair](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/create-with-openssh/) and
[upload the SSH public key to DigitalOcean](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/to-account/).

Note that many newer distro images have deprecated RSA key access in favor of the more modern Edwards-curve signature algorithms.

MD5 fingerprints of the SSH public keys will be used by the DigitalOcean API to identify the SSH keys in your account.
Fingerprints can be generated with `ssh-keygen -l -E md5 -f [public key file]` as described [here](https://superuser.com/questions/421997/what-is-a-ssh-key-fingerprint-and-how-is-it-generated).

### Create a DigitalOcean API Token

[Create a Personal Access Token](https://docs.digitalocean.com/reference/api/create-personal-access-token/).
Give the token the `write` scope in order to be able to create, update, and delete cloud resources in your account.

### Install Ansible

In a Python virtual environment, install the latest version of Ansible 5.
Additionally, install [`yamllint`](https://yamllint.readthedocs.io/en/stable/) to validate all the YAML we will be working with for both Ansible and Kubernetes.

For `pip` users, `requirements.txt`:

```text
ansible==5.*
yamllint=1.*
```

For `poetry` users, `pyproject.toml`:

```
[tool.poetry]
authors = ["francoposa <franco@francoposa.io>"]
description = ""
name = "learn-infra-ops"
version = "0.1.0a0"

[tool.poetry.dependencies]
python = "^3.8"
ansible = "5.*"

[tool.poetry.dev-dependencies]
yamllint = "1.*"

[build-system]
build-backend = "poetry.masonry.api"
requires = ["poetry>=0.12"]
```

Without deploying Ansible to run on a server, the distinction between the standard dependencies and "dev" dependencies is not particularly important.
In general, we keep static analysis and testing tools in `dev-dependencies` when using Poetry.

### Install the Ansible Community DigitalOcean Collection

The DigitalOcean Ansible collection wraps the DigitalOcean API to provide a cloud infrastructure automation experience consistent with standard Ansible usage.

A full Ansible installation pulls in the DigitalOcean collection as part of Ansible Galaxy.

To check which version is installed:

```shell
% ansible-galaxy collection list
```

or

```shell
% ansible-galaxy collection list | grep digitalocean
```

To upgrade the collection to the latest version:

```shell
% ansible-galaxy collection install community.digitalocean --upgrade
```

To install a particular version of the collection:

```shell
% ansible-galaxy collection install community.digitalocean:==1.15.0
```

## 1. Create a DigitalOcean Server with Ansible

> DigitalOcean Droplets are Linux-based virtual machines (VMs) that run on
> top of virtualized hardware. Each Droplet you create is a new server
> you can use, either standalone or as part of a larger, cloud-based
> infrastructure.

We can create a DigitalOcean server with the Ansible [`community.digitalocean.digital_ocean_droplet`](https://docs.ansible.com/ansible/latest/collections/community/digitalocean/digital_ocean_droplet_module.html) module.

```yaml
# ./cloud-infra/ansible/inventory/mgmt/digitalocean-demo-create.yaml
---
- hosts: localhost
  tasks:
    - name: create a new droplet in project "demo"
      community.digitalocean.digital_ocean_droplet:
        state: active
        name: debian-s-1vcpu-2gb-sfo3-01
        unique_name: true
        project: demo
        tags:
          - demo
          - k3s-demo
          - k3s-demo-master
        image: debian-11-x64
        size: s-1vcpu-2gb
        region: sfo3
        ssh_keys:
          - "59:01:94:df:80:a9:97:3e:78:00:85:66:05:06:c7:42"
        user_data: "{{ lookup('ansible.builtin.file', '../../../cloud-init.sh') }}"
        oauth_token: "{{ lookup('ansible.builtin.env', 'DO_API_TOKEN') }}"

```

* `oauth_token`: set the `DO_API_TOKEN` environment variable before running this playbook
* `state: active`: we want our droplet to be created and powered on
  * take note of how this field interacts with `unique_name` and `name`
* `unique_name: true`: makes this playbook idempotent
  * running this playbook multiple times will not create more than one droplet as long the `name` field matches an existing droplet
  * if the droplet exists but is powered off, running this playbook will ensure it is powered on, due to the `state: active` configuration
* `tags`: DigitalOcean resource tags will be used for creating Ansible host groups with the DigitalOcean Ansible collection's dynamic inventory plugin
* `image`, `size`, and `region`: [slugs.do-api.dev](https://slugs.do-api.dev/) is an unofficial (sometimes outdated) list of API slugs for available Droplet sizes, Linux distro images, and regions.
Current slugs are also available directly from the DigitalOcean CLI:
  * `doctl compute size list`
  * `doctl compute image list-distribution`
  * `doctl compute region list`
* `ssh_keys`: md5 fingerprints of the SSH keys which can access the Droplet
* `user_data`: User Data script for Cloud-Init-compatible distros - see below for details

### Cloud Init and User Data
[Cloud Init](https://cloudinit.readthedocs.io/en/latest/index.html) is a standardized approach to configuring cloud compute instances.
On first boot, the configuration can set up user accounts, apply networking rules, install packages and much more.

To keep things simple and familiar, we only utilize [User-Data script format](https://cloudinit.readthedocs.io/en/latest/index.html),
which allows Cloud Init to run arbitrary shell scripts during the VM initialization.
Sticking to the shell script format allows us to run and test locally if needed without knowing anything else about Cloud Init.

I use the following script, adapted from both DigitalOcean's [Recommended Droplet Setup](https://docs.digitalocean.com/tutorials/recommended-droplet-setup/) guide,
and a community [Ansible Secure SSH collection](https://github.com/vitalk/ansible-secure-ssh):

```shell
#!/usr/bin/env bash
set -euo pipefail

USERNAME=infra_ops # Customize the sudo non-root username here

# Create user
if [ -f "/etc/debian_version" ]; then
  # Debian-based distros use the `sudo` group
  useradd --create-home --shell "/bin/bash" --groups sudo "${USERNAME}"
fi
if [ -f "/etc/redhat-release" ]; then
  # RHEL-based distros use the `wheel` group
  useradd --create-home --shell "/bin/bash" --groups wheel "${USERNAME}"
fi

# Create SSH directory for sudo non-root user and move keys over
# authorized keys will already be present for root user
# as specified in the DigitalOcean droplet create options
home_directory="$(eval echo ~${USERNAME})"
mkdir --parents "${home_directory}/.ssh"
cp /root/.ssh/authorized_keys "${home_directory}/.ssh"
chmod 0700 "${home_directory}/.ssh"
chmod 0600 "${home_directory}/.ssh/authorized_keys"
chown --recursive "${USERNAME}":"${USERNAME}" "${home_directory}/.ssh"

# Allow user to have passwordless sudo
printf "\n%s ALL=(ALL) NOPASSWD: ALL" "${USERNAME}" >> /etc/sudoers

# Disable SSH login with empty password for all users
# Should be obviated by the next step, but still prefer to have both
sed --in-place 's/^PermitEmptyPasswords.*/PermitEmptyPasswords no/g' /etc/ssh/sshd_config

# Disable SSH login with password for all users
sed --in-place 's/^PasswordAuthentication.*/PasswordAuthentication no/g' /etc/ssh/sshd_config

# Disable root SSH login
sed --in-place 's/^PermitRootLogin.*/PermitRootLogin no/g' /etc/ssh/sshd_config


if sshd -t -q; then systemctl restart sshd; fi
```

etc TODO


