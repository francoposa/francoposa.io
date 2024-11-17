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
3. Deploy [cert-manager](https://cert-manager.io/docs/) to our cluster to issue TLS certificates for our domain

We will leave converting the `kubectl` and `helm` deployment methods to Ansible playbooks as an exercise for the reader.
The Ansible core [k8s](https://docs.ansible.com/ansible/latest/collections/kubernetes/core/k8s_module.html)
and [helm](https://docs.ansible.com/ansible/latest/collections/kubernetes/core/helm_module.html)
modules are very straightforward mappings of the `kubectl` and `helm` CLIs.

## 0. Prerequisites

### 0.1 A Kubernetes Cluster with a Public IP Address

We will be building on the same demo cluster used in previous guides in this section:
a single-node K3s cluster deployed on a small cloud server with a public IP address.

While it is not required to use the same setup for this installment, K3s is strongly recommended
as it bundles and configures some essential components for exposing our services to the public:

#### 0.1.1 K3s Exposes a LoadBalancer on the Server's Public IP Address

By default, K3s runs a Traefik proxy instance as a LoadBalancer service
bound to the public IP address of the server node on host ports 80 (HTTP) and 443 (HTTPS).

Other Kubernetes distributions may not include a load balancer at all by default,
as they assume you will be running a larger cluster with a multiple nodes,
all on a private network hidden behind an external dedicated public load balancer.

We do not need to configure an external load balancer to distribute traffic across multiple nodes.
With our single-node setup, we can simply point our DNS records at the single public IP of the node.

Services can be listed with `kubectl` - look for those with type `LoadBalancer` with an external IP.

```shell
% kubectl --namespace kube-system get svc
NAME             TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)                      AGE
kube-dns         ClusterIP      10.43.0.10     <none>          53/UDP,53/TCP,9153/TCP       6h7m
metrics-server   ClusterIP      10.43.16.167   <none>          443/TCP                      6h7m
traefik          LoadBalancer   10.43.91.219   165.232.155.5   80:30753/TCP,443:31662/TCP   6h7m
```

#### 0.1.2 K3s Uses Traefik as its Default Ingress Controller.

Any software which implements the Kubernetes Ingress Controller specification
will be compatible with all standard Kubernetes Ingress configurations.

Though some ingress class providers offer functionality beyond the official spec,
we will avoid using any of those options in this guide.

K3s uses Traefik as its default ingress, but other setups may use Nginx or other popular options.
Adjust references in the Kubernetes manifests accordingly, replacing `traefik` with `nginx` or otherwise.

Ingress controllers can be listed with `kubectl` and inspected to check which is annotated as the default.

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

### 0.2 A Kubernetes Cluster with an HTTP Service Deployed

In [Part 1](/resources/infra-ops/kubernetes-software-deployment-1/) we deployed the
[`traefik/whoami`](https://hub.docker.com/r/traefik/whoami) echo server image
with its corresponding Kubernetes resources (Namespace, Deployment, and Service).

While it is not strictly necessary to have the Kubernetes resources (Namespace, Deployment, and Service)
defined exactly the same way as in Part 1, it will certainly make it easier to follow along.

### 0.3 A Public Domain Name

There are plenty of registrars which make purchasing and managing a domain name easy.
[Porkbun](https://porkbun.com/) in particular offers a great combination of simplicity, good pricing,
and support for many TLDs (the TLD or Top Level Domain is the part after the dot, as in `.com`, `.net`, `.io`, etc.),
but others such as Domain.com, NameCheap, and Cloudflare work perfectly fine as well.

Cooler-sounding, shorter, or correctly-spelled domain names are often already taken,
but for our own education and demonstration purposes, the domain name and TLD should not matter much.
Unless we are launching a legitimate website or application with this domain,
we can stick with getting a domain with one of the cheaper, lesser-known TLDs - many are under $10/year.

I was lucky enough to snag the relatively coherent domain `backtalk.dev` to use for this series,
as a nod to the common usage of echo servers to demonstrate Kubernetes deployments.

[//]: # (### 0.3 Install the `helm` Command-Line Tooling)

[//]: # ()
[//]: # (Install `helm` with the official Helm guide [here]&#40;https://helm.sh/docs/intro/install/&#41;.)

[//]: # ()
[//]: # (The `helm` command will utilize the same kubeconfig as is configured for our `kubectl` CLI,)

[//]: # (and respects the context and namespace configuration applied by `kubectx` and `kubens`.)

## 1. Create a DNS Record from the Domain to the Kubernetes Cluster

We only need the simplest kind of DNS record - an [A record](https://www.cloudflare.com/learning/dns/dns-records/dns-a-record/).
The A record simply serves to point a domain name to an IPv4 address.

### 1.1 Create the DNS `A` Record with the Domain Registrar

Each domain registrar will offer a slightly different interface for entering the DNS record,
but the A record should simply point the root domain (`backtalk.dev`) to the desired IP address (`165.232.155.5`).

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

### 1.3 View TLS Certificate Data

#### View in Browser

We have not yet assigned the cluster a TLS certificate from a trusted certificate authority,
so depending on the browser's security settings we may be blocked completely or have to read warnings before continuing.

Attempting to access `https://backtalk.dev` from Firefox will show "Did Not Connect: Potential Security Issue".
Click "Advanced" to show more information:

> backtalk.dev uses an invalid security certificate.
>
> The certificate is not trusted because it is self-signed.
>
> Error code: MOZILLA_PKIX_ERROR_SELF_SIGNED_CERT
>
> View Certificate

Click "View Certificate" to see the certificate and its metadata:

> Subject: TRAEFIK DEFAULT CERT
>
> Issuer: TRAEFIK DEFAULT CERT
>
> ...
>
> Certificate Authority: No

Similarly, accessing `https://backtalk.dev` via Chrome will show "Your connection is not private".
Clicking the `NET:ERR_CERT_AUTHORITY_INVALID` error message below will reveal the TLS certificate,
though Chrome does not bother to parse and show us the complete metadata.

#### View with `curl`

While `curl` is not designed for parsing and showing TLS certificates, we can use it for a quick check.
With the `--verbose` flag, `curl` will log each step of its connection and request process,
including when it fails validate the certificate for an HTTPS address:

```shell
 % curl -i --verbose https://backtalk.dev
```

```console
* Host backtalk.dev:443 was resolved.
* IPv6: (none)
* IPv4: 165.232.155.5
*   Trying 165.232.155.5:443...
* Connected to backtalk.dev (165.232.155.5) port 443
* ALPN: curl offers h2,http/1.1
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
*  CAfile: /etc/pki/tls/certs/ca-bundle.crt
*  CApath: none
* TLSv1.3 (IN), TLS handshake, Server hello (2):
* TLSv1.3 (IN), TLS handshake, Encrypted Extensions (8):
* TLSv1.3 (IN), TLS handshake, Certificate (11):
* TLSv1.3 (OUT), TLS alert, unknown CA (560):
* SSL certificate problem: self-signed certificate
* closing connection #0
curl: (60) SSL certificate problem: self-signed certificate
More details here: https://curl.se/docs/sslcerts.html

curl failed to verify the legitimacy of the server and therefore could not
establish a secure connection to it. To learn more about this situation and
how to fix it, please visit the webpage mentioned above.
```

## 2. Create an Ingress

The Kubernetes Ingress resource defines how the Ingress Controller routes external (typically HTTP) traffic
to the Service backends, with routing rules based on the hostname and URL path requested.

[//]: # (The Ingress definition and Ingress controller also handle)
... [TODO] ...

## 3. Automate TLS Certificates from Let's Encrypt with `cert-manager`

TLS certificates are one of the primary ways that computers communicating across a network verify each other's identity.
These certificates provide the `S` for `Secure` in `HTTPS` and help prevent a wide array of security exploits,
from malicious servers from imitating your bank or healthcare provider to man-in-the-middle attacks which can eavesdrop
and even to alter the traffic between your devices and the web services they communicate with.

Since modern browsers and many HTTP clients do not allow access to non-HTTPS websites by default,
we need to generate TLS certificates from a trusted authority if we want anyone to use the sites and services we host.
Historically, both certificate was a manual process for sysadmins and while it is a relatively simple process,
certificates can be valid for many months so it was easy to forget which ones need renewed when for which domains.

Thankfully with the rise of the nonprofit Let's Encrypt [Certificate Authority](https://en.wikipedia.org/wiki/Certificate_authority),
and more recently, the cloud-native [`cert-manager`](https://cert-manager.io/docs/), this process can be complete automated.

### 3.1 Install `cert-manager`

Install the latest cert-manager release:

```shell
% kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

or install a specific version:

```shell
% kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.1/cert-manager.yaml
```

Components will be installed into the `cert-manager` namespace.

### 3.2 Declare the Staging Cluster Issuer

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

### 3.3 Apply the Staging Cluster Issuer

```shell
% kubectl -n cert-manager apply -f kubernetes/cert-manager/manifests/cluster-issuer-staging.yaml

clusterissuer.cert-manager.io/cluster-issuer created
```

### 3.4 Verify the Staging Cluster Issuer

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
