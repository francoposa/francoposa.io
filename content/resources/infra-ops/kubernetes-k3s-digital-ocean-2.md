---
title: "Kubernetes with K3s, Ansible, and DigitalOcean Part 2"
slug: kubernetes-k3s-ansible-digital-ocean-2
summary: "Using DigitalOcean Servers as Ansible Dynamic Inventory"
date: 2022-07-30
lastmod: 2022-07-30
order_number: 2
---

**This document is a work in progress**

## 1. Ansible Inventory Basics

### Hosts, Host Groups, and Host Variables

#### Hosts

Ansible works by running playbook tasks against an "inventory" of hosts.

To Ansible, a host is pretty much anything with an IP address that runs a standard operating system:
a cloud or local VM, a bare metal server, a Docker container, etc.

Hosts are assigned to **host groups** and hosts have **host variables**.

#### Host Groups

Every host in an inventory belongs to at least two groups.

1. Every host belongs to the `all` group, except the implicit `localhost` used when no host is specified.
2. Every host also belongs to either:
    1. one or more groups assigned to it using static or dynamic inventory, or
    2. the `ungrouped` group for hosts

#### Host Variables

Host variables are attributes assigned to a host.
While host variables can be any arbitrarily nested key-value structure, there are specific variables which define how Ansible connects to and behaves when operating on hosts;
how to set up the connection, which user to run as on the host, which shell to use, etc.

The full list of these "behavioral inventory parameters" is [here](https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html#connecting-to-hosts-behavioral-inventory-parameters).
For now, we will only need two:
   * `ansible_host` - the resolvable DNS name or IP address of a host to connect to
   * `ansible_user` - the username to use when connecting to the host

### Declaring Static Inventory

...


You may have noticed warnings printed when running the droplet creation playbook:

```shell
[WARNING]: No inventory was parsed, only implicit localhost is available
[WARNING]: provided hosts list is empty, only localhost is available. Note that the implicit localhost does not match 'all'
```

These warnings hint at the two main aspects of using inventory with Ansible:

1. Providing inventory to the `ansible-playbook` command
2. Indicating in a playbook which hosts in the inventory to run the tasks against

Since we did neither in our first command, Ansible fell back to the default implicit "localhost".
The playbook to create a DigitalOcean droplet was just run on our local machine.

The simplest way to build Ansible inventory is by hardcoding the IPs or hosts into static files, as described in
However, as we are dynamically provisioning infrastructure with a cloud provider, we generally do not have a way to know the host IPs ahead of time.

This is a common use case for Ansible, which is supported with [dynamic inventory plugins](https://docs.ansible.com/ansible/latest/user_guide/intro_dynamic_inventory.html).
Essentially, plugins will interface with a cloud provider, local hypervisor stack, or other


etc TODO