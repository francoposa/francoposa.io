---
title: "Delivering Software with Kubernetes, Part 1"
summary: "Deploying a Stateless HTTP Service to Kubernetes"
description: "Kubernetes CLI Tooling and Manifests for Namespaces, Deployments, Pods, and Services"
slug: kubernetes-software-deployment-1
aliases:
  - /resources/infra-ops/zero-to-production-with-kubernetes-4/
date: 2024-01-20
weight: 4
---

## Goals

We will:

1. Create a [Namespace](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
for our resources on the Kubernetes cluster
2. Create a [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
with multiple replicas of a simple HTTP server container
3. Verify the Deployment and make requests to the HTTP server Pods
4. Create a [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
to route traffic through a single interface to all HTTP server Pods

[//]: # (We will leave converting the `kubectl` deployment method to an Ansible playbook as an exercise for the reader.)

[//]: # (The Ansible core [k8s]&#40;https://docs.ansible.com/ansible/latest/collections/kubernetes/core/k8s_module.html&#41;)

[//]: # (module is a very straightforward mapping of the `kubectl` CLI.)

## 0. Prerequisites

### 0.1 A Kubernetes Cluster

This guide is not dependent on where and how our Kubernetes cluster is deployed.
Ensure the kubeconfig file is accessible on our local machine to be used by the `kubectl` CLI.

### 0.2 Install the `kubectl` Command-Line Tooling

Install `kubectl` with the official Kubernetes guide [here](https://kubernetes.io/docs/tasks/tools/#kubectl).

Additionally, many Kubernetes users also rely on [`kubectx` and `kubens`](https://github.com/ahmetb/kubectx),
which provide an easy way to switch which "contexts" (clusters) and "namespaces"
without typing out the command-line arguments to `kubectl` every time.

Verify cluster access and status via `kubectl` with either of the following commands:

```shell
% kubectl cluster-info
Kubernetes control plane is running at https://165.232.155.5:6443
CoreDNS is running at https://165.232.155.5:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
Metrics-server is running at https://165.232.155.5:6443/api/v1/namespaces/kube-system/services/https:metrics-server:https/proxy

% kubectl get nodes
NAME              STATUS   ROLES                  AGE   VERSION
k3s-demo-master   Ready    control-plane,master   16d   v1.26.4+k3s1
% kubectl cluster-info
Kubernetes control plane is running at https://165.232.155.5:6443
```

### 0.3 An HTTP Server Container

For the HTTP service, we will use the [`traefik/whoami`](https://hub.docker.com/r/traefik/whoami) image,
though any container will suffice as long as it exposes an HTTP server on a port.

For an example of how to create and containerize a simple echo server for Kubernetes,
see [Containerizing a Golang Application with Dockerfile and Makefile](/resources/golang/golang-containerizing-dockerfile-makefile/).

The `docker.io/traefik/whoami` container uses port `80` by default, while the
`ghcr.io/francoposa/echo-server-go/echo-server` container uses port `8080` -
be sure to reference the correct port(s) for the container when declaring the Deployment.

[//]: # (### 0.3 Install the `helm` Command-Line Interface)

[//]: # ()
[//]: # (Install `helm` with the official instructions [here]&#40;https://helm.sh/docs/intro/install/&#41;.)

[//]: # ()
[//]: # (The `helm` command will utilize the same kubeconfig as is configured for our `kubectl` CLI,)

[//]: # (and respects the context and namespace configuration applied by `kubectx` and `kubens`.)

## 1. Create a Namespace

Kubernetes namespaces are a lightweight way isolate resources within a single cluster.
By default, namespaces serve as little more than a conceptual boundary drawn between related resources.

Because namespaces serve as a sort of container for other Kubernetes resources,
they are a bit unique and are often managed "out of band" of the other resources -
namespace must be created before any resources can be deployed to them,
and namespaces must not be deleted unless we intend to delete every resource within the namespace.

#### 1.1 Declare the Namespace

Declare the namespace in a manifest file: 

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/traefik/whoami/manifests/namespace.yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: whoami
```

#### 1.2 Apply the Namespace

Use `kubectl apply`  create the namespace on the cluster:

```shell
% kubectl apply -f kubernetes/traefik/whoami/manifests/namespace.yaml
namespace/whoami created
```

#### 1.3 View Namespaces

Whenever we want to list Kubernetes resources, we start with a `kubectl get [resource type]`:

```shell
% kubectl get namespace  # or the short version, `kubectl get ns`
NAME              STATUS   AGE
kube-system       Active   39d
kube-public       Active   39d
kube-node-lease   Active   39d
default           Active   39d
whoami            Active    5m
```

Note that the kubectl output will not tell us which is the current active namespace.
For that we would need:

```shell
% kubectl config view | grep namespace
    namespace: default
```

or use `kubens`, which will highlight the current active namespace:

```shell
% kubens
kube-system
kube-public
kube-node-lease
default  # this would be highlighted in our terminal
whoami
```

#### 1.4 Switch Namespaces

Similarly here we can use `kubectl`:

```shell
kubectl config set-context --current --namespace=whoami
```

Or again the more convenient `kubens`:

```shell
% kubens whoami
Context "default" modified.
Active namespace is "whoami".
```

### 2. Create a Deployment

A Kubernetes Deployment is the most common and straightforward way to deploy a stateless service to a cluster.

The Deployment resource defines the desired state of the Pods (sets of containers) as well as the number of Pod replicas,
and provide the interfaces to roll out, scale up or down, and roll back the state of the Pods.

To start, we basically just need to know the container image we want to run,
which port(s) the container exposes, and how many replicas of the container to run -
everything else is just some standard metadata.

#### 2.1 Declare the Deployment

Declare the Deployment in a manifest file:

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/traefik/whoami/manifests/whoami.yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whoami
  namespace: whoami
spec:
  replicas: 3
  selector:
    matchLabels:
      app: whoami
  template:
    metadata:
      labels:
        app: whoami
    spec:
      containers:
        - name: whoami
          image: docker.io/traefik/whoami
          ports:
            - name: web
              # see the container image documentation for which port is exposed
              containerPort: 80
```

Take note of some parameters of the Deployment manifest:

* `namespace: whoami`: specifying a namespace will prevent the deployment from being applied to any other namespace;
omit the `namespace` key if we want to be able to deploy to any namespace
* `spec.selector.matchLabels`: used by the Deployment and its ReplicaSet to select which pods to spin up and down during
rollouts or scaling events - these should uniquely match at least one of the pod's `spec.template.metadata.labels` values
* `spec.replicas`: the number of copies of the Pods to be deployed; this is maintained in the background by
a ReplicaSet which in turn is created and maintained by the Deployment
* `spec.containers`: the set of containers which make up a Pod - we only use a single container here
* `spec.containers.image`: most clusters set DockerHub as the default container registry,
so just `traefik/whoami` would work, but we prefer fully-qualified names - stick with `docker.io/traefik/whoami`
* `service.containers.ports`: the Service we will define can route traffic to a port by the port name,
so the container's port can change without having to update the Service definition separately

#### 2.2 Apply the Deployment

Use `kubectl apply` with the `-n/--namespace` option to create the Deployment on the cluster:

```shell
% kubectl -n whoami apply -f kubernetes/traefik/whoami/manifests/whoami.yaml
deployment.apps/whoami created
```

or use `kubens` to switch namespace before applying:

```shell
% kubens whoami
Context "default" modified.
Active namespace is "whoami".
% kubectl apply -f kubernetes/traefik/whoami/manifests/whoami.yaml
deployment.apps/whoami created
```

### 3. Verify the Deployment and Send Requests to the HTTP Server

This is the fun part!

#### 3.1 View the Created Resources

As mentioned before, we generally start with `kubectl get [resource type]`.
The `get` is the most basic way to list resources, just showing the name and some basic status info
without taking up too much space in the terminal.
If at any point we need more detailed information, we can use `kubectl describe` for a more complete view of the resource.

Use `kubectl get` to see the Deployment:

```shell
% kubectl get deployment
NAME     READY   UP-TO-DATE   AVAILABLE   AGE
whoami   3/3     3            3           112m
```

and the Pods created by the deployment:

```shell
% kubectl get pod
NAME                      READY   STATUS    RESTARTS   AGE
whoami-7669c49d8c-t55fr   1/1     Running   0          113m
whoami-7669c49d8c-ww8nl   1/1     Running   0          113m
whoami-7669c49d8c-gqp8h   1/1     Running   0          113m
```

#### 3.2 View the Logs

The `kubectl logs` command works on Pods, so there is no need to specify the resource type.
Just like the Linux `tail` command, we can use the `-f/--follow ` option to keep the stream open until we `Ctrl-C` to quit.

Note that the `logs` command takes a pod _name_ - one of those ugly autogenerated hashes
which would need to be parsed out from the `kubectl get pod` output.
Further, when supplying the pod name, the `logs` command will only allow us to follow the logs for one pod:

```shell
% kubectl logs -f whoami-7669c49d8c-gqp8h
2024/02/02 02:39:44 Starting up on port 80
# Ctrl-C to exit the stream
```

There are two different solutions for this, depending on our needs.

We can specify the Deployment instead of the Pod and `logs` will select _one_ of the containers to view the logs:

```shell
% kubectl logs deployment/whoami
Found 3 pods, using pod/whoami-7669c49d8c-t55fr
2024/02/02 02:39:44 Starting up on port 80
```

Or we can use the labels (a.k.a selectors) we created on the Deployment.
By specifying the `-l/--selector` flag, we can get all the pods matching the selector:

```shell
% kubectl logs -l='app=whoami'
2024/02/02 02:39:44 Starting up on port 80
2024/02/02 02:39:44 Starting up on port 80
2024/02/02 02:39:44 Starting up on port 80
```

#### 3.3 Port-Forward to a Pod and Send HTTP Requests

We have waited all this time to actually interact with our HTTP server!

Unfortunately, the `kubectl port-forward` command only can only talk to a single pod
and does not allow us to utilize the label selectors hack available for tailing logs,
but we can still select pods by the Deployment name in order to avoid using the pod names.

Recall that we named our container port `web`, so we do not have to remember _which_ port number it is.
We will forward it to our local port 8080:

```shell
% kubectl port-forward deployment/whoami 8080:web
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
# Ctrl-C to exit
```

In another terminal window, use `curl` to talk to the `whoami` server through the forwarded port:

```shell
% curl -i localhost:8080
HTTP/1.1 200 OK
Date: Fri, 02 Feb 2024 05:00:52 GMT
Content-Length: 206
Content-Type: text/plain; charset=utf-8

Hostname: whoami-7669c49d8c-t55fr
IP: 127.0.0.1
IP: ::1
IP: 10.42.0.53
IP: fe80::f436:29ff:fef8:bbda
RemoteAddr: 127.0.0.1:35420
GET / HTTP/1.1
Host: localhost:8080
User-Agent: curl/8.5.0
Accept: */*
```

#### 3.4 Take a Moment to Celebrate!

But not too long - we have one final improvement to make.

### 4. Create a Service

#### Limitations of Pods

When managing Kubernetes, we really do not want to have to think too much about Pods.

Pods are a low-level abstraction for sets of containers that can be scaled up and down,
and they are relatively inconvenient to interact with and manage manually.
Recall that we did not directly create the Pods themselves when we deployed our HTTP server,
we created a _Deployment_ which in turn created a _ReplicaSet_ to manage the Pods.
Pods have ugly autogenerated names, they are destroyed and recreated often,
and have a whole host of other limitations related to the fact that they are _ephemeral_ resources.

#### The Service Resource

A  Service resource solves for the networking limitations of Pods.
Our present concerns are:
1. the internal DNS address assigned to a Pod cannot be relied upon,
as the address is derived from the Pod name which only lasts as long as the Pod itself
2. Pods themselves do not provide a mechanism to route or balance traffic to their other replicas

Essentially, how do we automatically route traffic to the `whoami` server without caring what the Pod names are,
or whether we have one, twenty or a thousand replicas of the Pod?

For this, we need a Kubernetes Service resource, which defines parameters for basic service discovery and routing.

The Service provides a single endpoint for clients to interface with any server Pods matching the label selectors,
handling the responsibility of keeping track of constantly-changing Pod IP addresses,
which Pods are starting, ready, or terminating, and load-balancing the traffic between the Pods.

#### 4.1 Declare the Service

Append the Service to the manifest file containing the Deployment:

```yaml
# github.com/francoposa/learn-infra-ops/blob/main/kubernetes/traefik/whoami/manifests/whoami.yaml
---
# [...Deployment definition...]
---
apiVersion: v1
kind: Service
metadata:
  name: whoami
  namespace: whoami
spec:
  ports:
    - name: web
      port: 80
      targetPort: web
  selector:
    app: whoami
```

#### 4.2 Apply the Service

```shell
% kubectl apply -f kubernetes/traefik/whoami/manifests/whoami.yaml
deployment.apps/whoami unchanged
service/whoami created
```

#### 4.3 View the Service

The `service` resource type can also be abbreviated as `svc` in the `kubectl` CLI.

```shell
% kubectl describe svc whoami
Name:              whoami
Namespace:         whoami
Labels:            <none>
Annotations:       <none>
Selector:          app=whoami
Type:              ClusterIP
IP Family Policy:  SingleStack
IP Families:       IPv4
IP:                10.43.39.147
IPs:               10.43.39.147
Port:              web  80/TCP
TargetPort:        web/TCP
Endpoints:         10.42.0.53:80,10.42.0.54:80,10.42.0.55:80
Session Affinity:  None
Events:            <none>
```

Take note of some attributes of the Service resource:

* `Selector: app=whoami`: the Service will route traffic to any Pods with labels matching this selector
* `Port: web 80/TCP`: components can access the Service through the Service's port named `web`, which has defaulted to port `80`
* `TargetPort: web/TCP`: the Service will route traffic to whichever port on the Pod is named `web`,
avoiding the need to know (and update) which exact port number the Pod has exposed

#### 4.4 Port-Forward to a Pod

This time around it is a bit less exciting.

We can now port-forward using the selector `svc/whoami`, but the traffic will still not actually
go through the service endpoint or be load-balanced between multiple Pods.
This is not a limitation of the Service, but rather of the `port-forward` utility,
which is a rather rudimentary debugging tool only meant to interact directly with pods.
Just like when we used the `deployment/whoami` selector to port-forward, it will select one pod and stick with it for the session.

```shell
% kubectl port-forward svc/whoami 8080:web
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
# Ctrl-C to exit
```

We _could_ demonstrate the functionality of the Service by spinning up a client Pod
to make requests to our server Pods from within the cluster, in which case the traffic
would be routed and load-balanced via the Service endpoint.
However, this would be a bit tedious and trivial and it is not what we are _really_ here to accomplish.

In the next guide, we will take on the most complex but rewarding part of the journey to production:
exposing our HTTP server to the public internet, complete with a domain name and TLS encryption.

## Conclusion

We now have a containerized HTTP server running with multiple replicas in our Kubernetes cluster,
with a service discovery, routing, and load balancing shim in front of the replicas,
all isolated into a single namespace dedicated only this single application.

As always, we have defined of these resources - the Kubernetes Namespace, Deployment, and Service -
in version-controlled files, enabling us to duplicate the same infrastructure state across as many clusters as we want,
or repeat the same infrastructure state in a single cluster after tearing it down and spinning it back up.
