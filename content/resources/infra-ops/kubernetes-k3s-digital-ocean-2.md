---
title: "Kubernetes with K3s, Ansible, and DigitalOcean Part 2"
slug: kubernetes-k3s-ansible-digital-ocean-2
summary: "Using DigitalOcean Servers as Ansible Dynamic Inventory"
date: 2022-07-30
lastmod: 2023-02-05
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
    2. the `ungrouped` group for hosts not explicitly assigned any other group

#### Host Variables

Host variables are attributes assigned to a host.
While host variables can be any arbitrarily nested key-value structure, there are specific variables which define how Ansible connects to and behaves when operating on hosts;
how to set up the connection, which user to run as on the host, which shell to use, etc.

The full list of these "behavioral inventory parameters" is [here](https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html#connecting-to-hosts-behavioral-inventory-parameters).
For now, we will only need two:
   * `ansible_host` - the resolvable DNS name or IP address of a host to connect to
   * `ansible_user` - the username to use when connecting to the host

## 2. Declaring Static Inventory

The simplest way to build Ansible inventory is by hardcoding the hosts, groups, and variables into static files.
While we will ultimately move on to using dynamic inventory, we can first take a look at how we would represent our inventory in a static configuration.

#### Declaring Static Host Groups

When we created our VM with the DigitalOcean Ansible module in [Part 1](/resources/infra-ops/kubernetes-k3s-ansible-digital-ocean-1/), we assigned three tags with the intention of using them later as the Ansible host groups.
Our single host is in all three groups we created: `k3s-demo-master` for the master node, `k3s demo`, used for all nodes in the cluster, and `demo` for all resources in the "demo" project of the DigitalOcean account.

#### Assigning Static Host Variables

* `ansible_host` - the public IPv4 address assigned to the VM on creation from DigitalOcean's public IP space.
* `ansible_user` - the `USERNAME` from the [Cloud Init script from Part 1](/resources/infra-ops/kubernetes-k3s-ansible-digital-ocean-1/#cloud-init-and-user-data).
  * use DigitalOcean's default `root` user if you skipped the user setup via cloud-init step

#### DigitalOcean Static Inventory

A bare-bones static inventory definition to assign our host to three host groups would look like below:

```yaml
---
demo:  # host group
   hosts:
      # host alias or name, the same as the Droplet name in DigitalOcean
      debian-s-1vcpu-2gb-sfo3-01:
         # key-value pairs nested below the host are host variables
         ansible_host: 143.198.76.8
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

We can see that even with just a single host, the static configuration can be tedious.
Hosts must be re-declared in each group they belong to, and any changes to the host alias or host variables may have to be duplicated across several sections.

Further, as we are dynamically provisioning infrastructure with a cloud provider, we generally do not have a way to know the host IPs ahead of time.

## 3. Using Dynamic Inventory Plugins

Ansible supports [dynamic inventory plugins](https://docs.ansible.com/ansible/latest/user_guide/intro_dynamic_inventory.html), which interface with a cloud provider, local hypervisor stack, or other host-management solutions in order to map the current state of your hosts into Ansible's inventory format.

The [DigitalOcean inventory plugin](https://docs.ansible.com/ansible/latest/collections/community/digitalocean/digitalocean_inventory.html#ansible-collections-community-digitalocean-digitalocean-inventory) comes bundled with a full Ansible installation, or can be installed with `ansible-galaxy`.

We can use a simplified version of the plugin config example in the DigitalOcean inventory plugin docs:

*./cloud-infra/ansible/inventory/sources/digitalocean.yaml:*

```yaml
---
plugin: community.digitalocean.digitalocean
api_token: "{{ lookup('ansible.builtin.env', 'DO_API_TOKEN') }}"
attributes:
# which fields provided by the inventory plugin do we want to use
   - name
   - tags
   - networks
keyed_groups:
# which attributes do we want to use to map hosts into groups
# the default var_prefix for this plugin is `do_`
# so the `tags` attribute becomes `do_tags`
   - key: do_tags
leading_separator: no  # no leading underscore in front of host group name
compose:
# compose uses Jinja expressions to process attributes into Ansible variables
# we need to parse the `networks` attribute, which is prefixed to be `do_networks`
# into a resolvable `ansible_host` variable.
   ansible_host: do_networks.v4 | selectattr('type','eq','public')
      | map(attribute='ip_address') | first
```

We can check the dynamic inventory output with a graph view of just the hosts:

```shell
% ansible-inventory -i ./cloud-infra/ansible/inventory/sources --graph  # add --vars to see all host variables
```

```shell
@all:
  |--@demo:
  |  |--debian-s-1vcpu-2gb-sfo3-01
  |--@k3s-demo:
  |  |--debian-s-1vcpu-2gb-sfo3-01
  |--@k3s-demo-master:
  |  |--debian-s-1vcpu-2gb-sfo3-01
  |--@ungrouped:
```

or a full view in the same format as a static inventory file:

```shell
% ansible-inventory -i ./cloud-infra/ansible/inventory/sources --list --yaml
```

```yaml
all:
  children:
    demo:
      hosts:
        debian-s-1vcpu-2gb-sfo3-01:
          ansible_host: 143.198.76.8
          # ...
    k3s-demo:
      hosts:
        debian-s-1vcpu-2gb-sfo3-01: {}
    k3s-demo-master:
      hosts:
        debian-s-1vcpu-2gb-sfo3-01: {}
    ungrouped: {}
```

We can ignore the `[WARNING]: Invalid characters were found in group names`.
Ansible prefers the host groups to be valid Python identifiers (no hyphens), but it will not affect anything.
The Ansible team [received significant pushback](https://github.com/ansible/ansible/issues/56930) on this change, and have stated that this warning will never turn into an error.

## 4. Assigning Host Group Variables to Dynamic Inventory

Ansible provides plenty of guidance on how to [manage multiple inventory sources](https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html#using-multiple-inventory-sources).
For further details on more complex configurations follow the links in that section titled _Variable precedence: Where should I put a variable?_ and _How variables are merged_.

For now, we just want to do something simple: apply the `USERNAME` we put in the [Cloud Init script from Part 1](/resources/infra-ops/kubernetes-k3s-ansible-digital-ocean-1/#cloud-init-and-user-data) as the `ansible_user` across all hosts.
This will prevent us from having to re-declare the `ansible_user` or any other common host variables in every playbook.

We can add the following to `[inventory directory]/group_vars/all.yaml`, or `demo.yaml`, or whichever host group we want to target.

```yaml
---
ansible_user: infra_ops
```

Now if we run `ansible-inventory -i ./cloud-infra/ansible/inventory/sources --list --yaml` again, you will see the `ansible_user` variable applied to the host.

```yaml
all:
   children:
      demo:
         hosts:
            debian-s-1vcpu-2gb-sfo3-01:
               ansible_host: 143.198.52.107
               ansible_user: infra_ops
               do_name: debian-s-1vcpu-2gb-sfo3-01
...
```

## 5. Running an Ansible Playbook with Dynamic Inventory

```shell
% export DO_API_TOKEN=dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

% ansible-playbook \
  --inventory ./cloud-infra/ansible/inventory/sources \
  ./cloud-infra/ansible/inventory/mgmt/digitalocean-demo-shell-example.yaml
```

*./cloud-infra/ansible/inventory/mgmt/digitalocean-demo-shell-example.yaml:*

```yaml
---
- hosts: k3s-demo-master
  tasks:
     - name: cat hostname
       shell: |
          cat /etc/hostname
       register: cat_hostname

     - name: show cat hostname output
       ansible.builtin.debug:
          msg: |
             {{ cat_hostname.stdout_lines }}
```
