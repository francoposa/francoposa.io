---
title: "Zero to Production with Kubernetes, Part 1: Creating a DigitalOcean Server with Ansible"
summary: "Ansible, Ansible Collections, DigitalOcean Droplets, and Initial Server Configuration"
slug: zero-to-production-with-kubernetes-1
aliases:
  - /resources/infra-ops/kubernetes-k3s-ansible-digital-ocean-1/
date: 2021-07-27
order_number: 2
---

## Goals

We will:

1. Create a cloud server on DigitalOcean using an idempotent Ansible playbook
2. Assign labels to the server for later use with Ansible's host inventory management
3. Supply the server with an init script to secure the SSH access configuration
4. Confirm SSH access to the Server

## 0. Prerequisites

### 0.1 Register SSH Keys to Your DigitalOcean Account

First, we need to [generate an Ed25519 SSH keypair](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#generating-a-new-ssh-key) and
[upload the SSH public key to DigitalOcean](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/to-team/).

The SSH public key's MD5 fingerprint will be used to identify the SSH key to the DigitalOcean API.
The MD5 fingerprint for an SSH key can be viewed with `ssh-keygen -l -E md5 -f [public key file]` as described [here](https://superuser.com/questions/421997/what-is-a-ssh-key-fingerprint-and-how-is-it-generated).

### 0.2 Create a DigitalOcean API Token

[Create a Personal Access Token](https://docs.digitalocean.com/reference/api/create-personal-access-token/).
Give the token the `write` scope in order to be able to create, update, and delete cloud resources in your account.

### 0.3 Install Ansible

In a Python virtual environment, install the latest version of Ansible 5.
Additionally, install [`yamllint`](https://yamllint.readthedocs.io/en/stable/) to validate all the YAML we will be working with for both Ansible and Kubernetes.

For `pip` users, `requirements.txt`:

```text
ansible==9.*
yamllint=1.*
```

For `poetry` users, `pyproject.toml`:

```toml
[tool.poetry]
authors = ["francoposa <franco@francoposa.io>"]
description = ""
name = "learn-infra-ops"
version = "0.1.0a0"

[tool.poetry.dependencies]
python = "^3.10"
ansible = "9.*"

[tool.poetry.dev-dependencies]
yamllint = "1.*"

[build-system]
build-backend = "poetry.masonry.api"
requires = ["poetry>=0.12"]
```

Without deploying Ansible to run on a server, the distinction between the standard dependencies and "dev" dependencies is not particularly important.
In general, we keep static analysis and testing tools in `dev-dependencies` when using Poetry.

### 0.4 Install the Ansible Community DigitalOcean Collection

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
By default, the Ansible module waits for the server to be fully active before returning success.

```shell
% export DO_API_TOKEN=dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

% ansible-playbook ./infrastructure/ansible/inventory/mgmt/digitalocean-demo-create.yaml
```

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/infrastructure/ansible/inventory/mgmt/digitalocean-demo-create.yaml
---
- hosts: localhost
  tasks:
    - name: create k3s master node droplet in project "demo"
      community.digitalocean.digital_ocean_droplet:
        state: active
        name: debian-s-1vcpu-2gb-sfo3-01
        unique_name: true
        project: demo
        tags:
          - demo
          - k3s-demo
          - k3s-demo-master
        image: debian-12-x64
        size: s-1vcpu-2gb
        region: sfo3
        ssh_keys:
          # md5 fingerprint for our ed25519 ssh key
          - "59:01:94:df:80:a9:97:3e:78:00:85:66:05:06:c7:42"
        user_data: "{{ lookup('ansible.builtin.file', '../../../cloud-init.sh') }}"
        oauth_token: "{{ lookup('ansible.builtin.env', 'DO_API_TOKEN') }}"
      register: k3s_demo_master

    - name: show k3s master node droplet info
      ansible.builtin.debug:
        msg: |
          droplet first public ipv4 address: {{
            (
              k3s_demo_master.data.droplet.networks.v4
              | selectattr('type','eq','public')
              | map(attribute='ip_address')
              | first
            )
          }}
```

Take note of some parameters of the DigitalOcean Droplet Ansible module:

* `state: active`: create the droplet and power it on
  * take note of how this field interacts with `unique_name` and `name`
* `unique_name: true`: makes this playbook idempotent
  * running this playbook multiple times will not create more than one droplet as long the `name` field matches an existing droplet
  * if the droplet exists but is powered off, running this playbook will ensure it is powered on, due to the `state: active` configuration
* `tags`: DigitalOcean resource tags will be used for creating Ansible host groups
  * `demo`: the DigitalOcean dynamic inventory plugin does not let us use the DigitalOcean "project" as a host group, so we can add the project name as a tag if desired
  * `k3s-demo-master`: the master node of our cluster; certain k8s operations are only run on the master node
  * `k3s-demo`: all nodes of our cluster; for now we are only spinning up a single node cluster
* `image`, `size`, and `region`: see [slugs.do-api.dev](https://slugs.do-api.dev/) for an unofficial (sometimes outdated) list of API slugs for available Droplet sizes, Linux distro images, and regions.
Current slugs are also available directly from the DigitalOcean CLI:
  * `doctl compute size list`
  * `doctl compute image list-distribution`
  * `doctl compute region list`
* `ssh_keys`: md5 fingerprints of the SSH keys which can access the droplet
* `user_data`: User Data script for Cloud-Init-compatible distros - see below for details

### 1.1 Cloud Init and User Data
[Cloud Init](https://cloudinit.readthedocs.io/en/latest/index.html) is a standardized approach to configuring cloud compute instances.
On first boot, the configuration can set up user accounts, apply networking rules, install packages and much more.

To keep things simple and familiar, we only utilize [user data script format](https://cloudinit.readthedocs.io/en/latest/explanation/format.html#user-data-script),
which allows Cloud Init to run arbitrary shell scripts during the server initialization.
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

## 2. Confirm SSH Access to the Server

Ensure the SSH key which was registered to the droplet upon creation is registered with the SSH agent on our local machine:

```shell
% ssh-add ~/.ssh/id_ed25519_infra_ops
```

Test SSH access with the droplet IP address and the non-root user created with the Cloud Init User Data script.
The IP address is printed from the debug task in the playbook or visible in the DigitalOcean web UI.

```shell
% ssh infra_ops@137.184.94.4
Warning: Permanently added '137.184.94.4' (ED25519) to the list of known hosts.
infra_ops@debian-s-1vcpu-2gb-sfo3-01:~$
```

We can also check that the root user is denied access, even with the correct SSH key:
```shell
% ssh root@137.184.94.4
root@137.184.94.4: Permission denied (publickey).
```

By default, Ansible will use this local SSH agent configuration for access to the server inventory.

## Conclusion

We now have an idempotent Ansible playbook to initialize a DigitalOcean server with a public IP address,
or to ensure one that we previously created still exists and is turned on.

Our playbook uses the DigitalOcean Ansible Collection as a wrapper for the DigitalOcean API,
allowing to specify the region, size, and Linux distro for the server.
Tags or labels are assigned to the server so that we can later address the hots via its tags
rather than always checking up on which IP address our latest server instances have.

Finally, we have supplied a user data script to secure the server's SSH configuration,
disabling root user access and password-based access so only our SSH key and our newly
created non-root user can log in to administer the server.