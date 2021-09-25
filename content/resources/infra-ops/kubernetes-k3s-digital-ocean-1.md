---
title: "Kubernetes with K3s and DigitalOcean Part 1"
slug: kubernetes-k3s-digital-ocean-1
summary: "Install Things"
date: 2021-07-27
lastmod: 2021-07-27
order_number: 2
---

**This document is a work in progress**

## 1. Create a DigitalOcean Server

As the documentation states:

> DigitalOcean Droplets are Linux-based virtual machines (VMs) that run on
> top of virtualized hardware. Each Droplet you create is a new server
> you can use, either standalone or as part of a larger, cloud-based
> infrastructure.

Follow the [Create Droplet Quickstart](https://docs.digitalocean.com/products/droplets/quickstart/).
The size of the droplet does not matter much for this tutorial;
the $5 droplet option is plenty for any testing or learning scenario,
and k3s is intended to run in resource-constrained environments.

Be sure to select an SSH key for the droplet.
Ansible and similar tools use SSH keys by default.
SSH passwords are generally considered less secure than SSH keys,
and we will disable SSH password login on our servers as part of the
recommended initial configuration process.

**Note:** Creating a droplet can be automated with Ansible,
the DigitalOcean CLI, or any number of related tools,
but the DigitalOcean web interface is dead simple to use,
so it's an ideal way to get us up and running without much hassle.


## 2. Specify Ansible Host Inventory

We need to specify our Ansible "inventory" -
the hosts or groups of hosts to run Ansible tasks against.
See the [Ansible docs on specifying inventory](https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html) for more.

We will specify two different entries for the same host:
one for the initial server setup done with the root user,
and another for all subsequent tasks, using a new user
created and configured for our purposes.

Create the Ansible inventory file where it can be easily referenced from the command line.

```yaml
---
# ./hosts.yaml
---
all:
  children:
    master_roots:
      hosts:
        demo_master_root:
          ansible_host: 143.244.209.125
          ansible_user: root
          ansible_ssh_private_key_file: ~/.ssh/id_rsa_infra_ops
    masters:
      hosts:
        demo_master:
          ansible_host: 143.244.209.125
          ansible_user: infraops
          ansible_ssh_private_key_file: ~/.ssh/id_rsa_infra_ops
```

The IP address is just the IP of your DigitalOcean Droplet.
The IP I have used here is actually a [Floating IP](https://docs.digitalocean.com/products/networking/floating-ips/)
that I re-use so I do not have to always change my hosts file for a new droplet.

## 3. Configure Server User Access with Ansible

1. Create a separate user with SSH access for our Infra Ops automation and administration purposes
    * Grant the user passwordless sudo, required for Ansible automation of any step requiring sudo privileges
2. Configure the host for a secure SSH setup on the host:
    * Disable SSH password login for users with empty/blank passwords
    * Disable SSH password login for all users
    * Disable all SSH login for the root user

```yaml
---
# ./initial-host-setup.yaml
---
# References

# Digital Ocean recommended droplet setup script:
# - https://docs.digitalocean.com/droplets/tutorials/recommended-setup
# Digital Ocean tutorial on installing kubernetes with Ansible:
#  - https://www.digitalocean.com/community/tutorials/how-to-create-a-kubernetes-cluster-using-kubeadm-on-debian-9
# Ansible Galaxy (Community) recipe for securing ssh:
# - https://github.com/vitalk/ansible-secure-ssh
---
- hosts: master_roots
  become: 'yes'
  tasks:
    - name: create the 'infraops' user
      user:
        state: present
        name: infraops
        password_lock: 'yes'
        groups: sudo
        append: 'yes'
        createhome: 'yes'
        shell: /bin/bash

    - name: add authorized keys for the infraops user
      authorized_key: 'user=infraops key="{{item}}"'
      with_file:
        '{{ hostvars[inventory_hostname].ansible_ssh_private_key_file }}.pub'

    - name: allow infraops user to have passwordless sudo
      lineinfile:
        dest: /etc/sudoers
        line: 'infraops ALL=(ALL) NOPASSWD: ALL'
        validate: visudo -cf %s

    - name: disable empty password login for all users
      lineinfile:
        dest: /etc/ssh/sshd_config
        regexp: '^#?PermitEmptyPasswords'
        line: PermitEmptyPasswords no
      notify: restart sshd

    - name: disable password login for all users
      lineinfile:
        dest: /etc/ssh/sshd_config
        regexp: '^(#\s*)?PasswordAuthentication '
        line: PasswordAuthentication no
      notify: restart sshd

    - name: Disable remote root user login
      lineinfile:
        dest: /etc/ssh/sshd_config
        regexp: '^#?PermitRootLogin'
        line: 'PermitRootLogin no'
      notify: restart sshd

  handlers:
    - name: restart sshd
      service:
        name: sshd
        state: restarted
```