---
title: "Kubernetes with K3s, Ansible, and DigitalOcean Part 2"
slug: kubernetes-k3s-ansible-digital-ocean-2
summary: "Using DigitalOcean Servers as Ansible Dynamic Inventory"
date: 2022-07-30
lastmod: 2022-08-07
order_number: 3
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

The simplest way to build Ansible inventory is by hardcoding the hosts, groups, and variables into static files.
While we will ultimately move on to using dynamic inventory, we can take a look at how we would represent our inventory in a static file first.

#### Declaring Static Host Groups

When we created our VM with the DigitalOcean Ansible module in Part 1, we assigned three tags with the intention of using them later as the Ansible host groups:
* `demo-k8s-master`: the master node of our kubernetes cluster, as there are certain k8s operations that will only be run on the master node
* `demo-k8s`: all nodes of our kubernetes cluster; for now this does not matter much as we are spinning up a single node cluster
* `demo`: the DigitalOcean dynamic inventory does not let us use the DigitalOcean "project" as a host group, so we can additionally add the project name as a tag if desired

#### Assigning Static Host Variables

The VM we created in Part 1 was assigned a random public IPv4 address from DigitalOcean's public IP space.
As we did not do any extra steps such as assigning a static reserved IP or domain name, this random IP address will be what we use to connect to the host.

#### DigitalOcean Static Inventory Example

*./cloud-infra/ansible/inventory/sources/digitalocean-static.yaml:*

```yaml
---
demo:  # host group
   hosts:
      # host alias or name, the same as the Droplet name in DigitalOcean
      debian-s-1vcpu-2gb-sfo3-01:
         # key-value pairs nested below the host are host variables
         ansible_host: 143.198.67.106
         # admin user created on first Droplet startup via user-data script
         # use root if you skipped the user setup via cloud-init step
         ansible_user: infra_ops
k3s-demo:  # another host group
   hosts:
      # repeat host name with empty map to inherit existing host variables
      debian-s-1vcpu-2gb-sfo3-01: {}
k3s-demo-master:  # another host group
   hosts:
      # repeat host name with empty map to inherit existing host variables
      debian-s-1vcpu-2gb-sfo3-01: {}
```


...
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