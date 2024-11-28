---
title: "Delivering Software with Kubernetes, Part 2"
summary: "Exposing a Service to the Public Internet"
description: "Domains, DNS Records, TLS Certificates, and Kubernetes Ingresses"
slug: kubernetes-software-deployment-2
aliases:
  - /resources/infra-ops/zero-to-production-with-kubernetes-5/
date: 2024-02-18
weight: 5
---

##### **this document is a work in progress**

## Goals

We will:

1. Create DNS records to point a domain name to our Kubernetes cluster's public IP address
2. Create Kubernetes Ingress rules to route requests to our domain through to our backend HTTP Service
3. Deploy [cert-manager](https://cert-manager.io/docs/) to our cluster to automate TLS certificates for our domain

## 0. Prerequisites

### 0.1. A Kubernetes Cluster with a LoadBalancer on the Server's Public IP Address

We will be building on the same demo cluster used in previous guides in this section:
a single-node [K3s](https://docs.k3s.io/) cluster deployed on a small cloud server with a public IP address.

While it is not required to use exact same setup for this installment, K3s is strongly recommended
as it bundles and configures some essential components for exposing our services to the public.
If you are running a different Kubernetes distribution, you may need to adjust configuration accordingly.

Regardless, we should understand how K3s' default configuration has enabled public traffic to our cluster.
By default, K3s runs a Traefik Proxy instance as a LoadBalancer service
bound to the public IP address of the server node on host ports 80 (HTTP) and 443 (HTTPS).

Services can be listed with `kubectl get service` or the abbreviation `svc` -
look for those with type `LoadBalancer` with an external IP.

```shell
% kubectl --namespace kube-system get svc
NAME             TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)                      AGE
kube-dns         ClusterIP      10.43.0.10     <none>          53/UDP,53/TCP,9153/TCP       6h7m
metrics-server   ClusterIP      10.43.16.167   <none>          443/TCP                      6h7m
traefik          LoadBalancer   10.43.91.219   165.232.155.5   80:30753/TCP,443:31662/TCP   6h7m
```

Other Kubernetes distributions may not include a load balancer at all,
as they presume you will be running the cluster on a private network,
with traffic routed from the public internet by a separate external load balancer.

With our single-node setup, we do not need to configure an external load balancer.
We can simply point our DNS records at the single public IP of the node.

### 0.2. An HTTP Application Deployed With a Kubernetes Service Resource

In [Part 1](/resources/infra-ops/kubernetes-software-deployment-1/) we deployed the
[`traefik/whoami`](https://hub.docker.com/r/traefik/whoami) echo server image
with its corresponding Kubernetes resources (Namespace, Deployment,  and Service).

Standard Kubernetes Ingress routing rules can only route traffic to Services.

### 0.3. A Public Domain Name

I have found [Porkbun](https://porkbun.com/) to be my preferred domain registrar, with good pricing,
a simple interface, and support for plenty of TLDs, (the part after the dot, as in `.com`, `.net`, `.io`, etc.),
Other registrars such as Domain.com, NameCheap, Bluehost, and Cloudflare work perfectly fine as well.

Cooler-sounding, shorter, or correctly-spelled domain names are often already taken,
but for our own education and demonstration purposes, the domain name and TLD should not matter much.
Unless we are launching a legitimate website or application with this domain,
we can stick with getting a domain with one of the cheaper, lesser-known TLDs
such as `.cc` or `.xyz` - many are under $10/year.

I was lucky enough to snag the relatively coherent domain `backtalk.dev` to use for this series,
as a nod to the common usage of echo servers to demonstrate Kubernetes deployments.

## 1. Create a DNS Record from the Domain to the Kubernetes Cluster

We only need the simplest kind of DNS record - an [A record](https://www.cloudflare.com/learning/dns/dns-records/dns-a-record/).
The A record simply serves to point a domain name to an IPv4 address.

### 1.1. Create the DNS `A` Record with the Domain Registrar

Each domain registrar will offer a slightly different interface for entering the DNS record,
but the A record should simply point the root domain (`backtalk.dev`) to the desired IP address (`165.232.155.5`).

When using K3s in the cloud, the IP address is simply the public IP address of the cloud server,
as the `metallb` load balancer component bundled with K3s binds to the host IP address by default.
There are many other valid but slightly more complicated setups we could use as well -
reserving a static IP to avoid using the random one assigned to a new VM or provisioning a cloud load balancer,
but we prefer to keep it simple for now.

### 1.2. Verify the DNS Record with `dig`

DNS record updates can take some time to propagate throughout the internet and DNS servers make heavy use of caching,
so do not be surprised if it takes tens of minutes or even hours to see a record update reflected.

DNS records can be checked with the command-line tool `dig`, which is generally included in any:

```shell
% dig +short backtalk.dev
165.232.155.5
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
backtalk.dev.		600	IN	A	165.232.155.5

;; Query time: 113 msec
;; SERVER: 192.168.0.1#53(192.168.0.1) (UDP)
;; WHEN: Sun Jun 16 15:02:09 PDT 2024
;; MSG SIZE  rcvd: 57
```

### 1.3. Verify the DNS Record Reaches the Kubernetes Cluster

We can use `curl` to make an HTTP request to the domain.
As we have not set up any ingress routing for the cluster,
we only expect to see the default `404` status response provided by an [Ingress Controller](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/).
In a K3s cluster, this is plaintext response from the bundled `traefik` component which serves as the Ingress.

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

By default, modern web browsers will not allow us to access the domain until it has a proper TLS certificate.
More on this later - for now, we will use `curl` without HTTPS to make requests to our domain.

## 2. Create an Ingress

### Kubernetes Ingress Concepts

Kubernetes Ingress concepts are generally just official names for the functionality of a reverse proxy.

The Kubernetes Ingress resource itself is simply a routing rule configuration
to define how the proxy routes external (typically HTTP) traffic to the Service backends.

An Ingress Controller has two responsibilities:
1. serve as a reverse proxy, with all the standard reverse proxy capabilities
2. monitor the cluster for changes in Ingress resources and other configuration
and update its own proxy configuration and routing rules accordingly

The Ingress Class resource is just an annotation or label to refer to an Ingress Controller.



[//]: # (Though some reverse proxies offer functionality beyond the official Ingress Controller specification,)

[//]: # (we will avoid using any of those options in this guide.)

Ingress controllers can be listed with `kubectl get ingressclass` and further inspected with `kubectl describe`.
Annotations in the `describe` output will indicate if an ingress controller is the default for the cluster.

```shell
% kubectl --namespace kube-system get ingressclass
NAME      CONTROLLER                      PARAMETERS   AGE
traefik   traefik.io/ingress-controller   <none>       6h8m
```

```shell
% kubectl --namespace kube-system describe ingressclass traefik
Name:         traefik
Labels:       app.kubernetes.io/instance=traefik-kube-system
              app.kubernetes.io/managed-by=Helm
              app.kubernetes.io/name=traefik
              helm.sh/chart=traefik-27.0.201_up27.0.2
Annotations:  ingressclass.kubernetes.io/is-default-class: true
              meta.helm.sh/release-name: traefik
              meta.helm.sh/release-namespace: kube-system
Controller:   traefik.io/ingress-controller
Events:       <none>
```

K3s uses Traefik Proxy as its default Ingress Controller, but other setups may use NGINX or other popular proxy options.
Adjust references to the ingress class in the Kubernetes manifests as needed, replacing `traefik` with `nginx` or otherwise.

### 2.1. Declare the Ingress

Declare the ingress in a manifest file:

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/traefik/whoami/manifests/ingress.yaml
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whoami
  namespace: whoami
spec:
  # default ingress class will be used if ingressClassName is not specified
  ingressClassName: traefik
  rules:
    - host: backtalk.dev
      http:
        paths:
          - path: /whoami
            pathType: Prefix
            backend:
              service:
                name: whoami
                port:
                  name: web
```

### 2.2. Apply the Ingress

Use `kubectl apply` to create the ingress on the cluster:

```shell
% kubectl -n whoami apply -f kubernetes/traefik/whoami/manifests/ingress.yaml
ingress.networking.k8s.io/whoami created
```

### 2.3. Verify the Ingress and Send Requests to the HTTP Server

The Ingress rule we created matches on the host `backtalk.dev` and path `whoami`.
Again we can use `curl` without HTTPS, but now our requests can reach all the way to the app running in the pods.

```shell
% curl -i backtalk.dev/whoami
HTTP/1.1 200 OK
Content-Length: 408
Content-Type: text/plain; charset=utf-8
Date: Wed, 27 Nov 2024 05:50:07 GMT

Hostname: whoami-56bf46959b-nbp7t
IP: 127.0.0.1
IP: ::1
IP: 10.42.0.25
IP: fe80::60cd:22ff:fe42:754c
RemoteAddr: 10.42.0.14:51774
GET /whoami HTTP/1.1
Host: backtalk.dev
User-Agent: curl/8.9.1
Accept: */*
Accept-Encoding: gzip
X-Forwarded-For: 10.42.0.1
X-Forwarded-Host: backtalk.dev
X-Forwarded-Port: 80
X-Forwarded-Proto: http
X-Forwarded-Server: traefik-d7c9c5778-5pbmq
X-Real-Ip: 10.42.0.1
```

We can also verify that any other route besides `/whoami` will return a `404` status as before.

```shell
% curl backtalk.dev
404 page not found
% curl backtalk.dev/whoareyou
404 page not found
```

With our Ingress rules in place, traffic is now routed through the ingress proxy to our Service and on to the Pods.
Only one step remains to making our application accessible to the general public - enabling HTTPS.

## 3. Automate TLS Certificates from Let's Encrypt with `cert-manager`

TLS certificates are one of the primary ways that computers communicating across a network verify each other's identity.
These certificates provide the `S` for `Secure` in `HTTPS` and help prevent a wide array of security exploits,
from malicious servers from imitating your bank or healthcare provider to man-in-the-middle attacks which can eavesdrop
and even to alter the traffic between your devices and the web services they communicate with.

Since modern browsers and many HTTP clients do not allow access to non-HTTPS websites by default,
we need to generate TLS certificates from a trusted authority if we want anyone to use the sites and services we host.
Historically, certificate creation and renewal was a manual process for sysadmins and while it is relatively simple,
various factors made it easy to forget or lose track of which certificates need renewed when and for which domains.

Thankfully with the rise of the nonprofit Let's Encrypt [Certificate Authority](https://en.wikipedia.org/wiki/Certificate_authority),
and more recently, the cloud-native [`cert-manager`](https://cert-manager.io/docs/), this process can be complete automated.

### 3.1. Install `cert-manager`

Install the latest cert-manager release:

```shell
% kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

or install a specific version:

```shell
% kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.1/cert-manager.yaml
```

Components will be installed into the `cert-manager` namespace.

### 3.2. Declare the Staging Cluster Issuer

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

### 3.3. Apply the Staging Cluster Issuer

```shell
% kubectl -n cert-manager apply -f kubernetes/cert-manager/manifests/cluster-issuer-staging.yaml

clusterissuer.cert-manager.io/cluster-issuer created
```

### 3.4. Verify the Staging Cluster Issuer

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

[//]: # (Unfortunately we cannot verify access through this TLS certificate just yet - )

[//]: # (we need a Kubernetes Ingress to put all the pieces together.)

[//]: # (Essentially, the `cert-manager` process will make a request to the Let's Encrypt servers,)

[//]: # (saying that it wants to be issued a certificate for our domain, `backtalk.dev`.)

[//]: # ([Traefik]&#40;https://doc.traefik.io/traefik/&#41; is a cloud-native proxy and edge router.)

[//]: # (In addition to an extensive set of integrations and plugins, Traefik implements the Kubernetes Ingress Controller API)

[//]: # (as well as to provide traffic routing for a cluster.)



[//]: # (### 1.3 View TLS Certificate Data)

[//]: # ()
[//]: # (The default certificate returned by the `traefik` ingress proxy is a "self-signed" certificate,)

[//]: # (which serves as temporary placeholder until we can get TLS certificate from a known Certificate Authority &#40;CA&#41;.)

[//]: # ()
[//]: # (Depending on the browser's security settings we may be blocked completely or have to read warnings before continuing,)

[//]: # (but we can use the browser itself or some output from `curl` to confirm the status of the TLS certificate.)

[//]: # ()
[//]: # (#### View in Browser)

[//]: # ()
[//]: # (Attempting to access `https://backtalk.dev` from Firefox will show "Did Not Connect: Potential Security Issue".)

[//]: # (Click "Advanced" to show more information:)

[//]: # ()
[//]: # (> backtalk.dev uses an invalid security certificate.)

[//]: # (>)

[//]: # (> The certificate is not trusted because it is self-signed.)

[//]: # (>)

[//]: # (> Error code: MOZILLA_PKIX_ERROR_SELF_SIGNED_CERT)

[//]: # (>)

[//]: # (> View Certificate)

[//]: # ()
[//]: # (Click "View Certificate" to see the certificate and its metadata:)

[//]: # ()
[//]: # (> Subject: TRAEFIK DEFAULT CERT)

[//]: # (>)

[//]: # (> Issuer: TRAEFIK DEFAULT CERT)

[//]: # (>)

[//]: # (> ...)

[//]: # (>)

[//]: # (> Certificate Authority: No)

[//]: # ()
[//]: # (Similarly, accessing `https://backtalk.dev` via Chrome will show "Your connection is not private".)

[//]: # (Clicking the `NET:ERR_CERT_AUTHORITY_INVALID` error message below will reveal the TLS certificate,)

[//]: # (though Chrome does not bother to parse and show us the complete metadata.)

[//]: # ()
[//]: # (#### View with `curl`)

[//]: # ()
[//]: # (While `curl` is not designed for parsing and showing TLS certificates, we can use it for a quick check.)

[//]: # (With the `--verbose` flag, `curl` will log each step of its connection and request process,)

[//]: # (including when it fails validate the certificate for an HTTPS address:)

[//]: # ()
[//]: # (```shell)

[//]: # ( % curl -i --verbose https://backtalk.dev)

[//]: # (```)

[//]: # ()
[//]: # (```console)

[//]: # (* Host backtalk.dev:443 was resolved.)

[//]: # (* IPv6: &#40;none&#41;)

[//]: # (* IPv4: 165.232.155.5)

[//]: # (*   Trying 165.232.155.5:443...)

[//]: # (* Connected to backtalk.dev &#40;165.232.155.5&#41; port 443)

[//]: # (* ALPN: curl offers h2,http/1.1)

[//]: # (* TLSv1.3 &#40;OUT&#41;, TLS handshake, Client hello &#40;1&#41;:)

[//]: # (*  CAfile: /etc/pki/tls/certs/ca-bundle.crt)

[//]: # (*  CApath: none)

[//]: # (* TLSv1.3 &#40;IN&#41;, TLS handshake, Server hello &#40;2&#41;:)

[//]: # (* TLSv1.3 &#40;IN&#41;, TLS handshake, Encrypted Extensions &#40;8&#41;:)

[//]: # (* TLSv1.3 &#40;IN&#41;, TLS handshake, Certificate &#40;11&#41;:)

[//]: # (* TLSv1.3 &#40;OUT&#41;, TLS alert, unknown CA &#40;560&#41;:)

[//]: # (* SSL certificate problem: self-signed certificate)

[//]: # (* closing connection #0)

[//]: # (curl: &#40;60&#41; SSL certificate problem: self-signed certificate)

[//]: # (More details here: https://curl.se/docs/sslcerts.html)

[//]: # ()
[//]: # (curl failed to verify the legitimacy of the server and therefore could not)

[//]: # (establish a secure connection to it. To learn more about this situation and)

[//]: # (how to fix it, please visit the webpage mentioned above.)

[//]: # (```)

[//]: # ()

[//]: # (### 0.3 Install the `helm` Command-Line Tooling)

[//]: # ()
[//]: # (Install `helm` with the official Helm guide [here]&#40;https://helm.sh/docs/intro/install/&#41;.)

[//]: # ()
[//]: # (The `helm` command will utilize the same kubeconfig as is configured for our `kubectl` CLI,)

[//]: # (and respects the context and namespace configuration applied by `kubectx` and `kubens`.)