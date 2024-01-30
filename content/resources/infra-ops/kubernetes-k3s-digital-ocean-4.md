---
title: "Zero to Production with Kubernetes, Part 4: Deploying a Service to Kubernetes"
summary: "Deploying Software with Kubernetes Manifests, Helm Charts, and Ansible"
slug: kubernetes-k3s-ansible-digital-ocean-4
date: 2024-01-20
order_number: 5
---

**This document is a work in progress**

## Goals

We will:

1. Prepare Kubernetes manifests in the standard YAML format for an HTTP service deployment
2. Deploy, monitor, update, and delete the HTTP service using the `kubectl` CLI
3. Convert the Kubernetes YAML manifests into a Helm chart
4. Deploy, monitor, update, rollback, and delete the HTTP service with the `helm` CLI

For this guide, we will leave converting either the Kubernetes or Helm deployment methods
to Ansible playbooks as an exercise for the reader.
The Ansible core [k8s](https://docs.ansible.com/ansible/latest/collections/kubernetes/core/k8s_module.html)
and [helm](https://docs.ansible.com/ansible/latest/collections/kubernetes/core/helm_module.html)
modules are both very straightforward mappings of the `kubectl` and `helm` CLIs.

## 0. Prerequisites

### 0.1 A Kubernetes Cluster

Unlike other installments in this series, this guide is not dependent on where and how our Kubernetes cluster is deployed.
Ensure the kubeconfig file is accessible on our local machine to be used by the `kubectl` and `helm` CLIs.

### 0.2 Install the `kubectl` Command-Line Tooling

Install `kubectl` with the official Kubernetes guide [here](https://kubernetes.io/docs/tasks/tools/#kubectl).

Additionally, many Kubernetes users also rely on [`kubectx` and `kubens`](https://github.com/ahmetb/kubectx),
which provide an easy way to switch which "contexts" (clusters) and "namespaces"
without typing out the command-line arguments to `kubectl` every time.

Verify cluster access and status via `kubectl` with either of the following commands:

```shell
% kubectl cluster-info
Kubernetes control plane is running at https://137.184.2.102:6443
CoreDNS is running at https://137.184.2.102:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
Metrics-server is running at https://137.184.2.102:6443/api/v1/namespaces/kube-system/services/https:metrics-server:https/proxy

% kubectl get nodes
NAME              STATUS   ROLES                  AGE   VERSION
k3s-demo-master   Ready    control-plane,master   16d   v1.26.4+k3s1
% kubectl cluster-info
Kubernetes control plane is running at https://137.184.2.102:6443
```

### 0.3 Install the `helm` Command-Line Interface

Install `helm` with the official instructions [here](https://helm.sh/docs/intro/install/).

The `helm` command will utilize the same kubeconfig as is configured for our `kubectl` CLI,
and respects the context and namespace configuration applied by `kubectx` and `kubens`.

## 1. Declare an HTTP Service Deployment with Kubernetes Manifests

We will declare a [Namespace](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/),
a [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/), and
a [Service](https://kubernetes.io/docs/concepts/services-networking/service/).

For the HTTP service, we will be using the [`traefik/whoami`](https://hub.docker.com/r/traefik/whoami) image.

### 1.1 Declaring a Namespace

Kubernetes namespaces are a lightweight way isolate resources within a single cluster.
By default, namespaces serve as little more than a conceptual boundary drawn between related resources.

Because namespaces serve as a sort of container for other Kubernetes resources,
they are a bit unique and are often managed "out of band" of the other resources -
namespace must be created before any resources can be deployed to them,
and namespaces must not be deleted unless we intend to delete every resource within the namespace.

Declare the namespace in a manifest file: 

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/traefik/whoami/manifests/namespace.yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: whoami
```

### 1.2 Declaring a Deployment

A Kubernetes Deployment is the most common and straightforward way to deploy a stateless service to a cluster.

To start, we basically just need to know the container image we want to run,
which port(s) the container exposes, and how many replicas of the container to run -
everything else is just some standard metadata.

Declare the Deployment in a manifest file:

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/traefik/whoami/manifests/whoami.yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whoami
  # omit the `namespace` key if we want to be able to deploy to any namespace
  namespace: whoami
spec:
  replicas: 3
  selector:
    matchLabels:
      # `matchLabels` is how the Deployment and its ReplicaSet select which
      # pods to spin up and down during rollouts or scaling events -
      # these should uniquely match at least one of the pod's template metadata labels
      app: whoami
  template:
    metadata:
      labels:
        app: whoami
    spec:
      containers:
        - name: whoami
          # most clusters have DockerHub as default container registry, so
          # just `traefik/whoami` would work, but we prefer fully-qualified names
          image: docker.io/traefik/whoami
          ports:
            # the Service will route traffic to the port by port name, so the container's
            # port can change without having to update the Service definition
            - name: web
              # see the container image documentation for which port is exposed
              containerPort: 80
```


[//]: # (...)

[//]: # (#### Create a Namespace)

[//]: # (and use `kubectl apply`  create the namespace on the cluster:)

[//]: # ()
[//]: # (```shell)

[//]: # (% kubectl apply -f kubernetes/traefik/whoami/manifests/namespace.yaml )

[//]: # (namespace/whoami created)

[//]: # (```)

[//]: # ()
[//]: # (#### View Namespaces)

[//]: # ()
[//]: # (Whenever we want to list Kubernetes resources, we start with a `kubectl get [resource type]`:)

[//]: # ()
[//]: # (```shell)

[//]: # (% kubectl get namespace  # or the short version, `kubectl get ns`)

[//]: # (NAME              STATUS   AGE)

[//]: # (kube-system       Active   39d)

[//]: # (kube-public       Active   39d)

[//]: # (kube-node-lease   Active   39d)

[//]: # (default           Active   39d)

[//]: # (whoami            Active    5m)

[//]: # (```)

[//]: # ()
[//]: # (Note that the kubectl output will not tell us which is the current active namespace.)

[//]: # (For that we would need:)

[//]: # ()
[//]: # (```shell)

[//]: # (% kubectl config view | grep namespace)

[//]: # (    namespace: default)

[//]: # (```)

[//]: # ()
[//]: # (or `kubens`, which will highlight the current active namespace:)

[//]: # ()
[//]: # (```shell)

[//]: # (% kubens)

[//]: # (kube-system)

[//]: # (kube-public)

[//]: # (kube-node-lease)

[//]: # (default  # this would be highlighted in our terminal)

[//]: # (whoami)

[//]: # (```)

[//]: # ()
[//]: # (#### Switch Namespaces)

[//]: # ()
[//]: # (Similarly here we can use `kubectl`:)

[//]: # ()
[//]: # (```shell)

[//]: # (kubectl config set-context --current --namespace=whoami)

[//]: # (```)

[//]: # ()
[//]: # (Or again the more convenient `kubens`:)

[//]: # ()
[//]: # (```shell)

[//]: # (% kubens whoami)

[//]: # (Context "default" modified.)

[//]: # (Active namespace is "whoami".)

[//]: # (```)