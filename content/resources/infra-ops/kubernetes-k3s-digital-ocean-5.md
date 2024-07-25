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

## 1. Create a DNS Record from the Domain to the Kubernetes Cluster

We only need the simplest kind of DNS record - an [A record](https://www.cloudflare.com/learning/dns/dns-records/dns-a-record/).
The A record simply serves to point a domain name to an IPv4 address.

### 1.1 Create the DNS `A` Record with the Domain Registrar

Each domain registrar will offer a slightly different interface for entering the DNS record,
but the A record should simply point the root domain (`backtalk.dev`) to the desired IP address (`137.184.2.102`).

When using K3s in the cloud, the IP address is simply the public IP address of the cloud server,
as the `metallb` load balancer component bundled with K3s binds to the host IP address by default.
There are many other valid but slightly more complicated setups we could use as well -
reserving a static IP to avoid using the random one assigned to a new VM or provisioning a cloud load balancer,
but we prefer to keep it simple for now.

### 1.2 Verify the DNS Record with `dig`

DNS record updates can take some time to propagate throughout the internet and DNS servers make heavy use of caching,
so do not be surprised if it takes tens of minutes or even hours to see a record update reflected.

DNS records can be checked with the command-line tool `dig`, which is generally included in any:

```shell
% dig +short backtalk.dev
137.184.2.102
```

Drop the `+short` to see more information:

```shell
% dig backtalk.dev

; <<>> DiG 9.18.27 <<>> backtalk.dev
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 14326
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
;; QUESTION SECTION:
;backtalk.dev.			IN	A

;; ANSWER SECTION:
backtalk.dev.		600	IN	A	137.184.2.102

;; Query time: 113 msec
;; SERVER: 192.168.0.1#53(192.168.0.1) (UDP)
;; WHEN: Sun Jun 16 15:02:09 PDT 2024
;; MSG SIZE  rcvd: 57
```

### 1.2 Verify the DNS Record Reaches the Kubernetes Cluster

We can use `curl` to make an HTTP request to the domain.
As we have not set up any ingress routing for the cluster,
we only expect to see the default `404` status response provided by an [Ingress Controller](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/).
In a K3s cluster, this is plaintext response from the bundled `traefik` component.

```shell
% curl backtalk.dev
404 page not found
```

```shell
% curl -i backtalk.dev
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
X-Content-Type-Options: nosniff
Date: Sun, 16 Jun 2024 23:50:08 GMT
Content-Length: 19

404 page not found
```

We use `curl` because a modern browser may not allow us to reach our domain just yet.
We have not yet assigned the cluster a TLS certificate from a trusted certificate authority,
so depending on the browser's security settings we may be blocked completely or have to read warnings before continuing.

## 2. Automate TLS Certificates from Let's Encrypt with `cert-manager`

TLS certificates are one of the primary ways that computers communicating across a network verify each other's identity.
These certificates provide the `S` for `Secure` in `HTTPS` and help prevent a wide array of security exploits,
from malicious servers from imitating your bank or healthcare provider to man-in-the-middle attacks which can eavesdrop
and even to alter the traffic between your devices and the web services they communicate with.

Since modern browsers and many HTTP clients do not allow access to non-HTTPS websites by default,
we need to generate TLS certificates from a trusted authority if we want anyone to use the sites and services we host.
Historically, both certificate was a manual process for sysadmins and while it is a relatively simple process,
certificates can be valid for many months so it was easy to forget which ones need renewed when for which domains.

Thankfully with the rise of the nonprofit `Let's Encrypt` [Certificate Authority](https://en.wikipedia.org/wiki/Certificate_authority),
and more recently the cloud-native [`cert-manager`](https://cert-manager.io/docs/), this process can be complete automated.

### 2.1 Install `cert-manager`

Check the [`cert-manager` release list](https://github.com/cert-manager/cert-manager/releases) for the latest version to install.

```shell
% kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.0/cert-manager.yaml
```

### 2.2 Declare the Staging Cluster Issuer

The `ClusterIssuer` is not a standard Kubernetes resource like Pods, Deployments, and StatefulSets.
If is a "Custom Resource Definition" (CRD) defined by `cert-manager` -
this definition was installed along with the `cert-manager` software itself, so our cluster will recognize it.

These resource configure `cert-manager` to request, store, serve, and renew TLS certificates for our domain.
The `ClusterIssuer` allows us to use the same certificates for the whole cluster,
while the similar `Issuer` resource restricts usage of the certificates to a single namespace.

We will first request a certificate from the Let's Encrypt _staging_ servers.
These staging certificates will not be accepted by a browser, but will allow us to safely verify the configuration.
If a certificate request is rejected by the production server, we may not be allowed to try again for some time.

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/cert-manager/manifests/cluster-issuer-staging.yaml
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: cluster-issuer-staging
  namespace: cert-manager
spec:
  acme:
    email: franco@francoposa.io
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: cluster-issuer-staging-account-key
    solvers:
      - http01:
          ingress:
            class: traefik
```

### 2.3 Apply the Staging Cluster Issuer

```shell
% kubectl -n cert-manager apply -f kubernetes/cert-manager/manifests/cluster-issuer-staging.yaml

clusterissuer.cert-manager.io/cluster-issuer created
```

### 2.4 Verify the Staging Cluster Issuer

```shell
% kubectl get clusterissuer -o wide
NAME                     READY   STATUS                                                 AGE
cluster-issuer-staging   True    The ACME account was registered with the ACME server   10m
```

We can also tail the logs of the `cert-manager` Pod for more information:

```shell
% kubectl -n cert-manager logs -f deployment/cert-manager
# ... logs are noisy but we should see some success messages
```

### 2.5 Verify the Let's Encrypt Staging Certificate



[//]: # (Essentially, the `cert-manager` process will make a request to the Let's Encrypt servers,)

[//]: # (saying that it wants to be issued a certificate for our domain, `backtalk.dev`.)

[//]: # ([Traefik]&#40;https://doc.traefik.io/traefik/&#41; is a cloud-native proxy and edge router.)

[//]: # (In addition to an extensive set of integrations and plugins, Traefik implements the Kubernetes Ingress Controller API)

[//]: # (as well as to provide traffic routing for a cluster.)
