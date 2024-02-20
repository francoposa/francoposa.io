---
title: "Zero to Production with Kubernetes, Part 5: Exposing a Service to the Public Internet"
summary: "Domains, DNS Records, TLS Certificates, and Kubernetes Ingresses"
slug: zero-to-production-with-kubernetes-5
date: 2024-02-18
order_number: 6
---

##### **this document is a work in progress**

## Goals

We will:

1. Create DNS records to point a domain name to our Kubernetes cluster's public IP address
2. Deploy [cert-manager](https://cert-manager.io/docs/) to our cluster to issue TLS certificates for our domain
3. Create Kubernetes Ingress rules to route requests to our domain through to our backend HTTP Service

We will leave converting the `kubectl` and `helm` deployment methods to Ansible playbooks as an exercise for the reader.
The Ansible core [k8s](https://docs.ansible.com/ansible/latest/collections/kubernetes/core/k8s_module.html)
and [helm](https://docs.ansible.com/ansible/latest/collections/kubernetes/core/helm_module.html)
modules are very straightforward mappings of the `kubectl` and `helm` CLIs.

## 0. Prerequisites

### 0.1 A Kubernetes Cluster with an HTTP Service Deployed

We roughly need what was accomplished in [Part 4](/resources/infra-ops/zero-to-production-with-kubernetes-4/).
While it is not strictly necessary to have the Kubernetes resources (Namespace, Deployment, and Service)
defined exactly the same way as in Part 4, it will certainly make it easier to follow along.

### 0.2 A Public Domain Name

There are plenty of registrars which make purchasing and managing a domain name easy.
[Porkbun](https://porkbun.com/) in particular offers a great combination of simplicity, good pricing,
and support for many TLDs (the TLD or Top Level Domain is the part after the dot, as in `.com`, `.net`, `.io`, etc.),
but others such as Domain.com, NameCheap, and Cloudflare work perfectly fine as well.

Cooler-sounding, shorter, or correctly-spelled domain names are often already taken,
but for our own education and demonstration purposes, the domain name and TLD should not matter much.
Unless we are launching a legitimate website or application with this domain,
we can stick with getting a domain with one of the cheaper, lesser-known TLDs - many are under $10/year.

I was lucky enough to snag the relatively coherent domain `backtalk.dev` to use for this series,
as a nod to the common usage of echo servers image to demonstrate Kubernetes deployments.

### 0.3 Install the `helm` Command-Line Tooling

Install `helm` with the official Helm guide [here](https://helm.sh/docs/intro/install/).

The `helm` command will utilize the same kubeconfig as is configured for our `kubectl` CLI,
and respects the context and namespace configuration applied by `kubectx` and `kubens`.
