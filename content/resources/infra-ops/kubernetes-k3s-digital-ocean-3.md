---
title: "Kubernetes with K3s, Ansible, and DigitalOcean Part 3"
slug: kubernetes-k3s-ansible-digital-ocean-3
summary: "Deploying a K3s Kubernetes Cluster to a DigitalOcean Server"
date: 2023-04-16
order_number: 4
---

**This document is a work in progress**

## 1. Prepare K3s Configuration

K3s can be configured with command-line arguments, environment variables, and a [config file](https://docs.k3s.io/installation/configuration#configuration-file).
In keeping with a config-as-code/GitOps approach, we prefer to keep K3s config in a version-controlled file.
Config files which support comments (as YAML does) also make it easier to maintain documentation on why any particular options were chosen.

[K3s documentation for the server configuration](https://docs.k3s.io/cli/server) covers all server options in detail.
We will not have to change much as the defaults are well-selected, particularly for single-node clusters.

*./cloud-infra/ansible/k3s/config.yaml:*

```yaml
---
# override k3s default with standard kubeconfig location expected by kubectl
write-kubeconfig: /home/infra_ops/.kube/config
# override default 0600 mode on kubeconfig so non-root-users can read
write-kubeconfig-mode: "0644"
# node-name must be unique per node if you have multiple hosts in the cluster
# node-name defaults to the hostname; we override here to always be 'default',
# so the Ansible playbook can find-and-replace 'default' with the desired name
node-name: default
# set placeholder IPs so Ansible playbook can find-and-replace with node's public IP
# if left unset, these values will also be unset, 0.0.0.0, or 127.0.0.1,
# which makes it difficult to communicate with the cluster from outside the host
tls-san: "x.x.x.x"
node-external-ip: "x.x.x.x"
bind-address: "x.x.x.x"
```

## 2. Mount Config and Install K3s with Ansible

```shell
% export DO_API_TOKEN=dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

% ansible-playbook \
  --inventory ./cloud-infra/ansible/inventory/sources \
  ./cloud-infra/ansible/k3s/install.yaml
```

*./cloud-infra/ansible/k3s/install.yaml:*

```yaml
---
- hosts: k3s-demo-master
  become: yes
  tasks:
    - name: create k3s config directory if it does not exist
      ansible.builtin.file:
        path: /etc/rancher/k3s
        state: directory

    - name: create kube config directory if it does not exist
      ansible.builtin.file:
        path: /home/infra_ops/.kube
        state: directory

    - name: create k3s config file
      ansible.builtin.copy:
        src: ./config.yaml
        dest: /etc/rancher/k3s/config.yaml

    - name: replace k3s config 'default' values with k3s cluster name
      ansible.builtin.replace:
        path: /etc/rancher/k3s/config.yaml
        regexp: "default"
        replace: "k3s-demo-master"

    - name: replace k3s config 'x.x.x.x' values with host IP address
      ansible.builtin.replace:
        path: /etc/rancher/k3s/config.yaml
        regexp: "x.x.x.x"
        replace: "{{ hostvars[inventory_hostname].ansible_host }}"

    - name: install k3s
      ansible.builtin.shell: |
        curl -sfL https://get.k3s.io | sh -s - --config /etc/rancher/k3s/config.yaml
```
