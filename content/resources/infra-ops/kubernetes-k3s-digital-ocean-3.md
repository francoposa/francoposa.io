---
title: "Zero to Production with Kubernetes, Part 3: Deploying a K3s Kubernetes Cluster with Ansible"
summary: "K3s Installation, Configuration, and KubeConfig Management with Ansible"
slug: kubernetes-k3s-ansible-digital-ocean-3
aliases:
  - /resources/infra-ops/kubernetes-k3s-ansible-digital-ocean-3/
date: 2023-04-16
order_number: 4
---



## 1. Prepare K3s Configuration

K3s can be configured with command-line arguments, environment variables, and a [config file](https://docs.k3s.io/installation/configuration#configuration-file).

In keeping with a config-as-code/GitOps approach, we prefer to define configuration in version-controlled files.
In particular, config formats which support comments (YAML, TOML, etc.) allow us to maintain notes on *why* particular options have been chosen.

[K3s server configuration documentation](https://docs.k3s.io/cli/server) covers all server options in detail.
We will not have to change much, as the defaults are well-selected particularly for single-node clusters.

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/infrastructure/ansible/k3s/config.yaml
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
# if left unset, these values may be unset, 0.0.0.0, or 127.0.0.1,
# which makes it difficult to communicate with the cluster from outside the host
tls-san: "x.x.x.x"
node-external-ip: "x.x.x.x"
bind-address: "x.x.x.x"
```

## 2. Copy K3s Config to Droplet and Install K3s with Ansible

```shell
% export DO_API_TOKEN=dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

% ansible-playbook \
  --inventory ./infrastructure/ansible/inventory/sources \
  ./infrastructure/ansible/k3s/install.yaml
```

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/infrastructure/ansible/k3s/install.yaml
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
At this point, we should be able to ssh to the droplet and verify that the k3s cluster is initialized.

```shell
% ssh infra_ops@137.184.2.102

infra_ops@debian-s-1vcpu-2gb-sfo3-01:~$ kubectl get nodes
NAME              STATUS   ROLES                  AGE   VERSION
k3s-demo-master   Ready    control-plane,master   15d   v1.26.4+k3s1

infra_ops@debian-s-1vcpu-2gb-sfo3-01:~$ kubectl cluster-info
Kubernetes control plane is running at https://137.184.2.102:6443
```

## 2. Copy Kube Config from Droplet and Merge

The final step of this playbook performs a merge of kubeconfig files.
Merging the kubeconfigs for clusters with the same cluster or context name may result in one of the configs being clobbered.

In particular, the k3s cluster context will be named `default`.
This is not a property of the cluster, but rather just how it is named in the kubeconfig file.
If we already have a cluster context named `default` in our local kubeconfig, it would be overwritten by the new config copied from the droplet.

If this is not preferred, we have multiple viable options:
* change the cluster and context name for in the k3s cluster in the kubeconfig file
* change the order of kubeconfigs on merge to retain the desired config
* skip merging kubeconfigs altogether and switch between configs with the `KUBECONFIG` environment variable

As I am usually spinning up a fresh cluster after tearing down the last one, I use this playbook as-is, allowing the new `default` kubeconfig context to overwrite the old.

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/infrastructure/ansible/k3s/local-kube-config.yaml
---
- hosts: k3s-demo-master
  vars:
    local_k3s_demo_kube_config_path: ~/.kube/digitalocean-demo-k3s-demo.yaml
  tasks:
    - name: copy master kube config to local
      fetch:
        src: /etc/rancher/k3s/k3s.yaml
        dest: "{{ local_k3s_demo_kube_config_path }}"
        flat: true
    - name: debug host ip
      debug:
        var: hostvars[inventory_hostname].ansible_host
    - name: replace kube config localhost with master ip
      delegate_to: localhost
      replace:
        path: "{{ local_k3s_demo_kube_config_path }}"
        regexp: '127\.0\.0\.1'  # ansible only likes single quotes for this regex
        replace: "{{ hostvars[inventory_hostname].ansible_host }}"
    - name: merge kube configs
      delegate_to: localhost
      # https://stackoverflow.com/questions/46184125/how-to-merge-kubectl-config-file-with-kube-config
      # the KUBECONFIG order of files matters; if there are two clusters or users with
      # the same name, the merge will keep the one from the file listed first
      shell: |
          KUBECONFIG={{ local_k3s_demo_kube_config_path }}:~/.kube/config \
          kubectl config view --merge --flatten > ~/.kube/config_merged \
          && mv ~/.kube/config_merged ~/.kube/config \
          && rm {{ local_k3s_demo_kube_config_path }} \
          && chmod 600 ~/.kube/config

```
Now, we can manage our cluster with `kubectl` from our local machine:

```shell
% kubectl get nodes
NAME              STATUS   ROLES                  AGE   VERSION
k3s-demo-master   Ready    control-plane,master   16d   v1.26.4+k3s1
% kubectl cluster-info
Kubernetes control plane is running at https://137.184.2.102:6443
```
