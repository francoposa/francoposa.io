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

