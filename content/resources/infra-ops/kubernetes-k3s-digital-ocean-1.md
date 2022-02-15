---
title: "Kubernetes with K3s, Ansible, and DigitalOcean Part 1"
slug: kubernetes-k3s-ansible-digital-ocean-1
summary: "Creating DigitalOcean Server Inventory with Ansible"
date: 2021-07-27
lastmod: 2022-02-12
order_number: 2
---

**This document is a work in progress**

## 0. Prerequisites

### Register SSH Keys to Your DigitalOcean Account

[Generate an SSH keypair](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/create-with-openssh/) and
[upload the SSH public key to DigitalOcean](https://docs.digitalocean.com/products/droplets/how-to/add-ssh-keys/to-account/).

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
        name: debian-s-1vcpu-1gb-sfo3-01
        unique_name: true
        project: demo
        tags:
          - demo
        image: debian-11-x64
        size: s-1vcpu-1gb
        region: sfo3
        ssh_keys:
          - "51:fa:98:d5:a9:1b:6e:95:cb:c9:df:24:01:53:aa:48"  # id_rsa_infra_ops
        user_data: "{{ lookup('ansible.builtin.file', '../../../cloud-init.sh') }}"
        oauth_token: "{{ lookup('ansible.builtin.env', 'DO_API_TOKEN') }}"

```

Take note of a few important fields:

* `oauth_token`: set the `DO_API_TOKEN` environment variable before running this playbook
* `state: active`: we want our droplet to be created and powered on
  * take note of how this field interacts with `unique_name` and `name`
* `unique_name: true`: makes this playbook idempotent
  * running this playbook multiple times will not create more than one droplet as long the `name` field matches an existing droplet
  * if the droplet exists but is powered off, running this playbook will ensure it is powered on, due to the `state: active` configuration
* etc TODO


[//]: # (Follow the [Create Droplet Quickstart]&#40;https://docs.digitalocean.com/products/droplets/quickstart/&#41;.)

[//]: # (The size of the droplet does not matter much for this tutorial;)

[//]: # (the $5 droplet option is plenty for any testing or learning scenario,)

[//]: # (and k3s is intended to run in resource-constrained environments.)

[//]: # ()
[//]: # (Be sure to select an SSH key for the droplet.)

[//]: # (Ansible and similar tools use SSH keys by default.)

[//]: # (SSH passwords are generally considered less secure than SSH keys,)

[//]: # (and we will disable SSH password login on our servers as part of the)

[//]: # (recommended initial configuration process.)

[//]: # ()
[//]: # (**Note:** Creating a droplet can be automated with Ansible,)

[//]: # (the DigitalOcean CLI, or any number of related tools,)

[//]: # (but the DigitalOcean web interface is dead simple to use,)

[//]: # (so it's an ideal way to get us up and running without much hassle.)

[//]: # ()
[//]: # ()
[//]: # (## 2. Specify Ansible Host Inventory)

[//]: # ()
[//]: # (We need to specify our Ansible "inventory" -)

[//]: # (the hosts or groups of hosts to run Ansible tasks against.)

[//]: # (See the [Ansible docs on specifying inventory]&#40;https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html&#41; for more.)

[//]: # ()
[//]: # (We will specify two different entries for the same host:)

[//]: # (one for the initial server setup done with the root user,)

[//]: # (and another for all subsequent tasks, using a new user)

[//]: # (created and configured for our purposes.)

[//]: # ()
[//]: # (Create the Ansible inventory file where it can be easily referenced from the command line.)

[//]: # ()
[//]: # (```yaml)

[//]: # (---)

[//]: # (# ./hosts.yaml)

[//]: # (---)

[//]: # (all:)

[//]: # (  children:)

[//]: # (    master_roots:)

[//]: # (      hosts:)

[//]: # (        demo_master_root:)

[//]: # (          ansible_host: 143.244.209.125)

[//]: # (          ansible_user: root)

[//]: # (          ansible_ssh_private_key_file: ~/.ssh/id_rsa_infra_ops)

[//]: # (    masters:)

[//]: # (      hosts:)

[//]: # (        demo_master:)

[//]: # (          ansible_host: 143.244.209.125)

[//]: # (          ansible_user: infraops)

[//]: # (          ansible_ssh_private_key_file: ~/.ssh/id_rsa_infra_ops)

[//]: # (```)

[//]: # ()
[//]: # (The IP address is just the IP of your DigitalOcean Droplet.)

[//]: # (The IP I have used here is actually a [Floating IP]&#40;https://docs.digitalocean.com/products/networking/floating-ips/&#41;)

[//]: # (that I re-use so I do not have to always change my hosts file for a new droplet.)

[//]: # ()
[//]: # (## 3. Configure Server User Access with Ansible)

[//]: # ()
[//]: # (1. Create a separate user with SSH access for our Infra Ops automation and administration purposes)

[//]: # (    * Grant the user passwordless sudo, required for Ansible automation of any step requiring sudo privileges)

[//]: # (2. Configure the host for a secure SSH setup on the host:)

[//]: # (    * Disable SSH password login for users with empty/blank passwords)

[//]: # (    * Disable SSH password login for all users)

[//]: # (    * Disable all SSH login for the root user)

[//]: # ()
[//]: # (```yaml)

[//]: # (---)

[//]: # (# ./initial-host-setup.yaml)

[//]: # (---)

[//]: # (# References)

[//]: # ()
[//]: # (# Digital Ocean recommended droplet setup script:)

[//]: # (# - https://docs.digitalocean.com/droplets/tutorials/recommended-setup)

[//]: # (# Digital Ocean tutorial on installing kubernetes with Ansible:)

[//]: # (#  - https://www.digitalocean.com/community/tutorials/how-to-create-a-kubernetes-cluster-using-kubeadm-on-debian-9)

[//]: # (# Ansible Galaxy &#40;Community&#41; recipe for securing ssh:)

[//]: # (# - https://github.com/vitalk/ansible-secure-ssh)

[//]: # (---)

[//]: # (- hosts: master_roots)

[//]: # (  become: 'yes')

[//]: # (  tasks:)

[//]: # (    - name: create the 'infraops' user)

[//]: # (      user:)

[//]: # (        state: present)

[//]: # (        name: infraops)

[//]: # (        password_lock: 'yes')

[//]: # (        groups: sudo)

[//]: # (        append: 'yes')

[//]: # (        createhome: 'yes')

[//]: # (        shell: /bin/bash)

[//]: # ()
[//]: # (    - name: add authorized keys for the infraops user)

[//]: # (      authorized_key: 'user=infraops key="{{item}}"')

[//]: # (      with_file:)

[//]: # (        '{{ hostvars[inventory_hostname].ansible_ssh_private_key_file }}.pub')

[//]: # ()
[//]: # (    - name: allow infraops user to have passwordless sudo)

[//]: # (      lineinfile:)

[//]: # (        dest: /etc/sudoers)

[//]: # (        line: 'infraops ALL=&#40;ALL&#41; NOPASSWD: ALL')

[//]: # (        validate: visudo -cf %s)

[//]: # ()
[//]: # (    - name: disable empty password login for all users)

[//]: # (      lineinfile:)

[//]: # (        dest: /etc/ssh/sshd_config)

[//]: # (        regexp: '^#?PermitEmptyPasswords')

[//]: # (        line: PermitEmptyPasswords no)

[//]: # (      notify: restart sshd)

[//]: # ()
[//]: # (    - name: disable password login for all users)

[//]: # (      lineinfile:)

[//]: # (        dest: /etc/ssh/sshd_config)

[//]: # (        regexp: '^&#40;#\s*&#41;?PasswordAuthentication ')

[//]: # (        line: PasswordAuthentication no)

[//]: # (      notify: restart sshd)

[//]: # ()
[//]: # (    - name: Disable remote root user login)

[//]: # (      lineinfile:)

[//]: # (        dest: /etc/ssh/sshd_config)

[//]: # (        regexp: '^#?PermitRootLogin')

[//]: # (        line: 'PermitRootLogin no')

[//]: # (      notify: restart sshd)

[//]: # ()
[//]: # (  handlers:)

[//]: # (    - name: restart sshd)

[//]: # (      service:)

[//]: # (        name: sshd)

[//]: # (        state: restarted)

[//]: # (```)