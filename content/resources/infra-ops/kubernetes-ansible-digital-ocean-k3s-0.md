---
title: "Deploying K3s with Ansible on DigitalOcean, Part 0"
summary: "Goals and Tool Selection"
description: "Software Infrastructure and Operations with DigitalOcean Droplets, Ansible, and K3s"
slug: kubernetes-ansible-digital-ocean-k3s-0
aliases:
  - /resources/infra-ops/kubernetes-k3s-ansible-digital-ocean-0/
  - /resources/infra-ops/zero-to-production-with-kubernetes-0/
date: 2021-07-27
weight: 1
---

## Purpose

As software engineers, the early months and years of our careers are often highly focused just on writing _working_ code.
Then, as soon as we have our heads above water, we immediately seek (or are asked to) to write clearer code,
more impactful code, more performant code, and to solve increasingly complex technical or end-user problems.

All of this coding and technical education and growth is often confined within the application boundary -
a mobile app, a web frontend, a backend CRUD server, or a data pipeline.
We rarely learn in any depth - if at all - how to deploy and operate our software in production.

This gap in experience and knowledge limits our ability to take advantage of one of the most unique aspects
and greatest joys of software engineering, which is that a single person or a very small team can create,
deploy, and operate a nontrivial application or entire system of software.

Let's get to it.

## Goals

This series of guides seeks to a strike a balance between learning and getting shit done.
These two options are naturally in tension, and then balance chosen by the guides may not be for everyone.
Feel free to skip over explanations when you are in the mood to just get shit done,
or to deep dive into the resources and documentation when you are hungry to learn more.

With that said, we will:

### 1. Ship Software!

We want to give ourselves the ability to take an app from running on our local machine to running on a public cloud server.

Further, we want this deployment process to be simple, automated, repeatable, and not to involve significant customization.
That is, the process, tools, and configuration used to deploy one application should be easily transferable to a second, third, or hundredth application.

Specifically, we will deploy a backend HTTP service - a simple echo server - to a
Kubernetes cluster running on a cloud VM, reachable over public internet via a domain name.

### 2. Learn Kubernetes Concepts and Associated Tooling

We are not going to become Kubernetes experts by reading a few guides, nor do we aim to.
As stated above, the number one goal is to ship software.

We will:

* Install a single-node Kubernetes cluster onto a cloud server
* Install Kubernetes components to manage SSL/TLS certificates
* Deploy a stateless HTTP service to the Kubernetes cluster
* Configure the Kubernetes ingress provider to route traffic to the service

### 3. Learn Infrastructure & Operations Concepts and Associated Tooling

Though we will not go super deep on these topics (because we are focused on shipping software),
we will gain some basic exposure to:

* Infrastructure and operations automation with Ansible
* Linux cloud server configuration
* Docker builds, Dockerfiles, and container repositories
* Kubernetes deployment packaging with Helm
* Domain and DNS configuration


[//]: # (Practices and Preferences:)

[//]: # (* Automation of Manual Processes)

[//]: # (* Infrastructure as Code)

[//]: # (* Declarative over Imperative)

[//]: # (Tools: Ansible, Helm, K3s, and DigitalOcean)


## Tool Selection

Here again, we will try to strike a balance.
The tension in software tooling is often between a perceived "simplicity" or "user-friendliness"
vs. the tool being "advanced" or "feature-rich".

The tools below are chosen to allow us to get off the ground easily without needing to peek behind the curtain too much.
At the same time, they are powerful enough to allow us to push into much more advanced territory if we desire.

Moreover, software tools are just vessels for overarching concepts and practices which can be applied universally.
At this stage of our learning, it is far more important to understand concepts than to become a master of a particular tool.
Thousands of software tools will come and go, and at the end of it we will still be managing servers,
abstracting the concepts of compute, storage, and networking, and packaging, deploying and monitoring software on those servers.

### [DigitalOcean](https://digitalocean.com/)
* Simple, affordable cloud computing products and interfaces
  * in particular, the DigitalOcean "Droplet" cloud server comes with a public IPv4 address by default
* Integrations with common Infrastructure-as-Code tools: Ansible, Terraform, Pulumi, Crossplane, etc.

### [Ansible](https://docs.ansible.com/ansible/latest/)
* Automation of infrastructure provisioning and operations.
* Cross-platform abstractions of operations such as OS configuration, package installation, user and access management, file editing, etc.
* Combined imperative and declarative approach
* Powerful and flexible
  * Power and flexibility come with associated tradeoffs.
    In the case of Ansible, there can be many ways to do the same thing
  * We will make an effort to use approaches that are cross-platform and require minimal customization and configuration


### [K3s](https://rancher.com/docs/k3s/latest/en/)
* Lightweight Kubernetes distribution for resource-constrained environments, such as our small DigitalOcean VMs
* Installer/launcher script handles the complexity of initial installation, configuration, and startup
* Batteries included - packaged with tools and utilities for Kubernetes functions such as network ingress and load balancing.
  * These components are essential for proper operation but tough to absorb for a newcomer to Kubernetes and networking in general.
* Compatible with standard kubernetes tooling, including `kubectl`

[//]: # (### [Helm]&#40;https://helm.sh/docs/&#41;)

[//]: # (* Application packaging and deployment management for Kubernetes)

[//]: # (* Declares Kubernetes applications in code with templated, composable Helm Charts)

[//]: # (* Packages Kubernetes applications to share publicly or within an organization)

[//]: # (* Atomically deploys, upgrades, and deletes multi-component Kubernetes applications with a declarative CLI)
