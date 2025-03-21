---
title: "Delivering Software with Kubernetes, Part 2"
summary: "Exposing a Service to the Public Internet"
description: "Domains, DNS Records, TLS Certificates, and Kubernetes Ingresses"
tags:
  - Kubernetes
  - K3s
  - Networking
  - Traefik

slug: kubernetes-software-deployment-2
aliases:
  - /resources/infra-ops/zero-to-production-with-kubernetes-5/
date: 2024-02-18
weight: 5
---

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
Any HTTP application can be used, and the separate namespace is not required,
but there must a Service in front of the Pods controlled by the Deployent -
the standard Kubernetes Ingress routing rules can only route traffic to Services.

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
but the A record should simply point the root domain (`backtalk.dev`)
to the desired IP address (`165.232.155.5` in this example).

When using K3s in the cloud, the IP address is simply the public IP address of the cloud server.
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

Refer to [Appendix A](#appendix-a-verify-tls-certificate-data) to view and debug the TLS certificate data.

## 2. Create an Ingress

### Kubernetes Ingress Concepts

Kubernetes Ingress concepts are generally just official names for the functionality of a reverse proxy.

The Kubernetes Ingress resource itself is simply a routing rule configuration
to define how the proxy routes external (typically HTTP) traffic to the Service backends.

An Ingress Controller has two responsibilities:
1. serve as a reverse proxy, with all the standard reverse proxy routing capabilities
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

Declare the Ingress in a manifest file:

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

Use `kubectl apply` to create the Ingress on the cluster:

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

clusterissuer.cert-manager.io/cluster-issuer-staging created
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

### 3.5. Integrate the Staging Cluster Issuer with the Ingress

We need two additions to our Ingress resource.

First, we set a cluster issuer annotation to the exact name of our `ClusterIssuer`: `"cluster-issuer-staging"`.
This annotation is read by `cert-manager` in order to identify which ingress rules
require TLS certificates which issuer should be used to generate them.

Next, the `tls` section of the Ingress spec sets which domains in the Ingress rule require TLS.
Without `cert-manager`, the `secretName` would have to refer to a Kubernetes secret
that we had already created containing the TLS certificate for the required domain.
However, the automation provided by `cert-manager` scans the cluster for Ingress resources
with the correct annotations and sets up the secret containing the certificate for us.

Declare the updated Ingress resource in the same file:

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/traefik/whoami/manifests/ingress.yaml
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whoami
  namespace: whoami
  annotations:
    cert-manager.io/cluster-issuer: "cluster-issuer-staging"
spec:
  tls:
    - hosts:
        - backtalk.dev
      secretName: tls-backtalk-ingress-http-staging
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

### 3.6. Apply the Updated Ingress

Use `kubectl apply` to update the Ingress on the cluster:

```shell
% kubectl -n whoami apply -f kubernetes/traefik/whoami/manifests/ingress.yaml
ingress.networking.k8s.io/whoami updated
```

At this point, accessing `backtalk.dev` via HTTPS will still be disallowed by most browsers and clients,
but it will now return a Let's Encrypt staging certificate rather than the default self-signed certificate from Traefik.
We can view the staging certificate data via or browser or `curl`
as described in [Appendix A](#appendix-a-verify-tls-certificate-data).

Now we can move on to production!

### 3.7. Declare the Production Cluster Issuer

The production `ClusterIssuer` looks a lot like the staging one,
but it points to the Let's Encrypt production server URL
(and uses a different name for itself and its secret).

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/cert-manager/manifests/cluster-issuer.yaml
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: cluster-issuer
  namespace: cert-manager
spec:
  acme:
    email: franco@francoposa.io
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: cluster-issuer-account-key
    solvers:
      - http01:
          ingress:
            class: traefik
```

### 3.8. Apply the Production Cluster Issuer

```shell
% kubectl -n cert-manager apply -f kubernetes/cert-manager/manifests/cluster-issuer.yaml

clusterissuer.cert-manager.io/cluster-issuer created
```

### 3.9. Verify the Production Cluster Issuer

Use the same tools as before:

```shell
% kubectl get clusterissuer -o wide
NAME                     READY   STATUS                                                 AGE
cluster-issuer           True    The ACME account was registered with the ACME server    1m
cluster-issuer-staging   True    The ACME account was registered with the ACME server   60m
```

```shell
% kubectl -n cert-manager logs -f deployment/cert-manager
# ... logs are noisy but we should see some success messages
```

### 3.10. Integrate the Production Cluster Issuer with the Ingress

We only need to update the annotation referencing which `ClusterIssuer` to use
and the name of the secret to store the new production TLS certificate in.

Declare the updated Ingress resource in the same file -
staging values are commented out to show the changes:

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/traefik/whoami/manifests/ingress.yaml
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whoami
  namespace: whoami
  annotations:
    #    cert-manager.io/cluster-issuer: "cluster-issuer-staging"
    cert-manager.io/cluster-issuer: "cluster-issuer"
spec:
  tls:
    - hosts:
        - backtalk.dev
      #      secretName: tls-backtalk-ingress-http-staging
      secretName: tls-backtalk-ingress-http
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

### 3.11. Apply the Updated Ingress

Use `kubectl apply` to update the Ingress on the cluster:

```shell
% kubectl -n whoami apply -f kubernetes/traefik/whoami/manifests/ingress.yaml
ingress.networking.k8s.io/whoami updated
```

## 4. Access the Service From the Public Internet over HTTPS

HTTPS clients will now accept the production TLS certificate returned from our cluster by Traefik,
so we can access `https://backtalk.dev` via our browser or `curl`.

If any issues persist, refer to [Appendix A](#appendix-a-verify-tls-certificate-data) to view and debug the TLS certificate data.

## Conclusion

We now have an application in our Kubernetes cluster available over the public internet and accessible via HTTPS.
The automation of TLS certificate issuance and renewal removes a significant barrier
to deploying and delivering software services to our end users.

It is worth noting that the Ingress routing rule patterns we have used here to configure Traefik are very simple.
The Kubernetes Ingress specification is relatively limited compared to the full feature set
of typical reverse proxies, whether it is Traefik, NGINX, HAProxy, or proprietary cloud solutions.
More mature and complex software systems will almost certainly need to take advantage
the more powerful and convenient features of each reverse proxy option.
However, these configuration options which extend beyond the official Ingress spec
will not be directly portable between clusters utilizing different proxies as their Ingress Controller.
Like anything else in software engineering, we have to seek out a balance between
the portability of a limited spec-compliant feature set and using a specific technology to its full potential.

[//]: # (The Kubernetes Ingress patterns we have used here with Traefik Proxy are very simple,)

[//]: # (but offer an introduction to using a declarative rules for routing traffic from the public internet to our services.)

[//]: # (The common Ingress Controllers such as Traefik and NGINX also offer features)

[//]: # (which often go beyond the official Kubernetes specifications but can provide more power and convenience,)

[//]: # (such as auto-discovery of routable services and numerous plugin & middleware capabilities)

[//]: # (offering authentication, authorization, URL path rewriting, header filtering and transformation, and much more.)

## Appendix A: Verify TLS Certificate Data

There are various CLI tools which can view and analyze TLS certificates, often with complex and obscure invocations,
but we will focus just on some quick checks using tools we already know: `curl` and our browser.

Each tool will show slightly different output depending on where we are in our certificate provisioning process.

1. Out of the box, the Traefik Proxy in our K3s cluster will return a ["self-signed certificate"](https://en.wikipedia.org/wiki/Self-signed_certificate).
2. After setting up our automated certificate provisioning with Let's Encrypt's staging server,
we will have a certificate that has been signed by a Certificate Authority
    1. This certificate will _still_ not be accepted clients,
    as the staging server is not in their list of trusted "well known" CAs.
3. Finally, when we flip our configuration to the Let's Encrypt production server,
the browser and all of our other HTTPS clients will accept it.

### View TLS Certificate in Browser

Until we have the trusted certificate from the Let's Encrypt production server, we may be blocked completely
or have to read warnings before accessing our domain - this depends on the browser's security settings.

The interface will vary by browser, but Firefox makes it the easiest to see the actual certificates.
In Firefox, attempting to access `https://backtalk.dev` will show **Did Not Connect: Potential Security Issue**.
Click **Advanced** to show more information.

The error messages will vary depending on whether we received the default self-signed certificate
or the signed certificate from the Let's Encrypt staging servers.

**Self-signed certificate:**

> backtalk.dev uses an invalid security certificate.
>
> The certificate is not trusted because it is self-signed.
>
> Error code: MOZILLA_PKIX_ERROR_SELF_SIGNED_CERT

**Staging certificate:**

> Someone could be trying to impersonate the site and you should not continue.
>
> Websites prove their identity via certificates.### 3.6. Apply the Updated Ingress

Use `kubectl apply` to update the Ingress on the cluster:

```shell
% kubectl -n whoami apply -f kubernetes/traefik/whoami/manifests/ingress.yaml
ingress.networking.k8s.io/whoami updated
```
> Firefox does not trust backtalk.dev because its certificate issuer is unknown,
> the certificate is self-signed, or the server is not sending the correct intermediate certificates.
>
> Error code: SEC_ERROR_UNKNOWN_ISSUER

Click **View Certificate** to see the certificate and its metadata:
the certificate name, issuer name, any info about the issuing CA, and whether the CA is trusted.

**Self-signed certificate:**

> Subject: TRAEFIK DEFAULT CERT
>
> Issuer: TRAEFIK DEFAULT CERT
>
> Certificate Authority: No

**Staging certificate:**

> Subject: backtalk.dev
>
> Issuer: (STAGING) Let's Encrypt
>
> Certificate Authority: No (this will only say yes if it is a trusted CA)
>
> Authority Info (AIA)
>
> Location: http://stg-r11.i.lencr.org/
>
> Method: CA Issuers

For the **trusted production certificate**, the browser will just navigate to the site like normal.
Click the lock icon next the URL in the navigation bar and follow the menus to view the certificate if desired.

### View TLS Certificate Data with `curl`

While `curl` is not designed for parsing and showing TLS certificates, we can use it for a quick check.

With the `--verbose` flag, `curl` will log each step of its connection and request process,
including when it fails validate the certificate for an HTTPS address.

Like the browser, the verbose logs from `curl` depend on which certificate we have.

**Self-signed certificate:**

```shell
 % curl -i --verbose https://backtalk.dev

* Host backtalk.dev:443 was resolved.

# ...

curl: (60) SSL certificate problem: self-signed certificate

More details here: https://curl.se/docs/sslcerts.html

# ... etc.
```

**Staging certificate:**

```shell
% curl -i -v https://backtalk.dev
* Host backtalk.dev:443 was resolved.

# ...

curl: (60) SSL certificate problem: unable to get local issuer certificate
More details here: https://curl.se/docs/sslcerts.html

# ... etc.
```

**Trusted production certificate:**

```shell
% curl -i -v https://backtalk.dev
* Host backtalk.dev:443 was resolved.

# ...
* SSL connection using TLSv1.3 / TLS_AES_128_GCM_SHA256 / x25519 / RSASSA-PSS
* ALPN: server accepted h2
* Server certificate:
*  subject: CN=backtalk.dev
*  start date: Nov 28 05:56:04 2024 GMT
*  expire date: Feb 26 05:56:03 2025 GMT
*  subjectAltName: host "backtalk.dev" matched cert's "backtalk.dev"
*  issuer: C=US; O=Let's Encrypt; CN=R10
*  SSL certificate verify ok.

# ... etc.
```

[//]: # (### 0.3 Install the `helm` Command-Line Tooling)

[//]: # ()
[//]: # (Install `helm` with the official Helm guide [here]&#40;https://helm.sh/docs/intro/install/&#41;.)

[//]: # ()
[//]: # (The `helm` command will utilize the same kubeconfig as is configured for our `kubectl` CLI,)

[//]: # (and respects the context and namespace configuration applied by `kubectx` and `kubens`.)