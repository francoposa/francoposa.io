---
title: "Kubernetes with K3s, Ansible, and DigitalOcean Intro"
slug: kubernetes-k3s-ansible-digital-ocean-0
summary: "Goals, Tool Selection, and Setup"
date: 2021-07-27
lastmod: 2022-02-05
order_number: 1
---

**This document is a work in progress**

## Goals

### 1. Ship Software!

We want to give ourselves the ability to take an app from running on our computer to running on a public cloud server.

Further, we want this deployment process to be simple, automated, repeatable, and not to involve significant customization.
That is, the process, tools, and configuration used to deploy one application should be easily transferable to a second, third, or hundredth application.

Specifically, we will deploy a backend HTTP service - a simple echo server - to a
Kubernetes cluster running on a cloud VM, reachable over public internet via a domain name.

### 2. Learn Kubernetes Concepts and Associated Tooling

We are not going to become Kubernetes experts by reading a few guides, nor do we aim to.
As stated above, the number one goal is to ship software.

We will:

* Install a single-node Kubernetes cluster onto a cloud VM
* Install Kubernetes components to manage SSL/TLS certificates
* Deploy a stateless HTTP service to the Kubernetes cluster
* Configure the Kubernetes ingress provider to route traffic to the service

### 3. Learn Infrastructure & Operations Concepts and Associated Tooling

Though we will not go super deep on these topics (because we are focused on shipping software),
we will gain some basic exposure to:

* Infrastructure and Operations automation with Ansible
* Linux/cloud server user management
* Docker builds, Dockerfiles, and Docker/container repositories
* Version-controlled Kubernetes deployment packaging with Helm
* Domain and DNS configuration

<!---
Practices and Preferences:
* Automation of Manual Processes
* Infrastructure as Code
* Declarative over Imperative
Tools: Ansible, Helm, K3s, and DigitalOcean
-->


## Tool Selection

### [DigitalOcean](https://www.digitalocean.com/)
* Simple, powerful cloud computing products and interfaces
* Second-to-none [documentation](https://docs.digitalocean.com),
[tutorials](https://www.digitalocean.com/community/tutorials), and other resources


### [Ansible](https://docs.ansible.com/ansible/latest/)
* Automation of infrastructure provisioning and operations.
* Cross-platform abstractions of operations such as OS configuration, package installation, user and access management, file editing, etc.
* Combined imperative and declarative approach
* Powerful and flexible
  * Power and flexibility come with associated tradeoffs.
  In the case of Ansible, there can be many, many ways to do the same thing
  * We will make an effort to use approaches that are cross-platform and require minimal customization and configuration


### [K3s](https://rancher.com/docs/k3s/latest/en/)
* Lightweight Kubernetes distribution for resource-constrained environments, such as our small DigitalOcean VMs
* Installer/launcher script handles the complexity of initial installation, configuration, and startup
* Batteries included - packaged with tools and utilities for Kubernetes functions such as network ingress and load balancing.
  * These components are essential for proper operation but tough to absorb for a newcomer to Kubernetes and networking in general.
* Compatible with standard kubernetes tooling, including `kubectl`

### [Helm](https://helm.sh/docs/)
* Application packaging and deployment management for Kubernetes
* Declares Kubernetes applications in code with templated, composable Helm Charts
* Packages Kubernetes applications to share publicly or within an organization
* Atomically deploys, upgrades, and deletes multi-component Kubernetes applications with a declarative CLI
