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

With that in mind, follow the [Create Droplet Quickstart](https://docs.digitalocean.com/products/droplets/quickstart/).
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


## 2. Configure Server User Access with Ansible

