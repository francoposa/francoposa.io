---
title: "Kubernetes with K3s and DigitalOcean Intro"
slug: kubernetes-k3s-digital-ocean-0
summary: "Goals, Tool Selection"
date: 2021-07-27
lastmod: 2021-07-27
order_number: 1
---

Goals: Learning Kubernetes Infrastructure and Operations
1. Ship Software!
Specifically, deploy a backend HTTP service to a Kubernetes cluster running on a cloud VM, reachable over public internet via a domain name.

2. Learn Kubernetes Concepts and Associated Tooling
3. Learn Infrastructure & Operations Concepts and Associated Tooling

Practices and Preferences:
* Automation of Manual Processes
* Infrastructure as Code
* Declarative over Imperative

Tools: Ansible, Helm, K3s, and DigitalOcean

[Ansible](https://docs.ansible.com/ansible/latest/)
* Automates everything you could want to do in infrastructure and operations.
* Combination imperative & declarative approach
* Power & Flexibility introduces complexity  - many, many ways to do the same thing

[DigitalOcean](https://www.digitalocean.com/)
* Offers simple yet powerful cloud computing products and interfaces
* Second-to-none [documentation](https://docs.digitalocean.com), [tutorials](https://www.digitalocean.com/community/tutorials), and other resources

[K3s](https://rancher.com/docs/k3s/latest/en/)
* Lightweight Kubernetes distribution for resource-constrained environments like our small DigitalOcean droplets
* Launcher script handles the complexity of initial, installation, configuration, and startup
* Batteries included - packaged with tools and utilities for Kubernetes functions such as DNS, network ingress, and load balancing.
These components are essential for proper operation but tough to absorb for a newcomer to Kubernetes and networking in general.

