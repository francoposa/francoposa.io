# [francoposa.io](https://francoposa.io)

**Editing Hugo site & content**

From root directory:

```shell
hugo server --buildDrafts --disableFastRender
```

**Editing Tailwind CSS**

In root directory of whichever theme is being edited:

```shell
npx tailwindcss -i ./static/css/style.css -o ./static/css/style.tailwind.css --watch
```

Changes are picked up by the hugo server process running,
but it may take a few hard refreshes for the browser to display them.

## Content Preview

[Resources](https://francoposa.io/resources/)
---------------------------------------------

* * *

### [Infrastructure & Operations](https://francoposa.io/resources/infra-ops/)

*   #### [Deploying K3s with Ansible on DigitalOcean, Part 1](https://francoposa.io/resources/infra-ops/kubernetes-ansible-digital-ocean-k3s-1/)

    Creating a DigitalOcean Server with Ansible

*   #### [Deploying K3s with Ansible on DigitalOcean, Part 2](https://francoposa.io/resources/infra-ops/kubernetes-ansible-digital-ocean-k3s-2/)

    Using DigitalOcean Servers as Ansible Dynamic Inventory

*   #### [Deploying K3s with Ansible on DigitalOcean, Part 3](https://francoposa.io/resources/infra-ops/kubernetes-ansible-digital-ocean-k3s-3/)

    Deploying a K3s Kubernetes Cluster with Ansible

*   #### [Delivering Software with Kubernetes, Part 1](https://francoposa.io/resources/infra-ops/kubernetes-software-deployment-1/)

    Deploying a Stateless HTTP Service to Kubernetes

*   #### [Delivering Software with Kubernetes, Part 2](https://francoposa.io/resources/infra-ops/kubernetes-software-deployment-2/)

    Exposing a Service to the Public Internet


### [Golang](https://francoposa.io/resources/golang/)

*   #### [Containerizing a Golang Application with Dockerfile and Makefile](https://francoposa.io/resources/golang/golang-containerizing-dockerfile-makefile/)

    Packaging a Golang Application for Containerized Deployment

*   #### [Golang Templates, Part 1: Concepts and Composition](https://francoposa.io/resources/golang/golang-templates-1/)

    Understanding Golang Template Nesting and Hierarchy With Simple Text Templates

### [Rust](https://francoposa.io/resources/rust/)

*   #### [Create a Vector of Owned Strings from &str Collection in Rust](https://francoposa.io/resources/rust/rust-string-vec-from-str-refs/)

    Concise One-Liners for `Vec<String>` from `[&str, n]`

### [Web Development](https://francoposa.io/resources/web-development/)

*   #### [Modern TypeScript Project Setup with NPM, Part 1](https://francoposa.io/resources/web-development/typescript-npm-setup-part-1/)

    Write, Run, and Compile Node.js with TypeScript

*   #### [Modern TypeScript Project Setup with NPM, Part 2](https://francoposa.io/resources/web-development/typescript-npm-setup-part-2/)

    Lint and Format TypeScript with JavaScript Standard Style

* * *
