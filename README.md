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
------------------------

* * *

### [Infrastructure & Operations](https://francoposa.io/resources/infra-ops/)

*   #### [Zero to Production with Kubernetes, Part 1: Creating a DigitalOcean Server with Ansible](https://francoposa.io/resources/infra-ops/zero-to-production-with-kubernetes-1/)

*   #### [Zero to Production with Kubernetes, Part 2: Using DigitalOcean Servers as Ansible Dynamic Inventory](https://francoposa.io/resources/infra-ops/zero-to-production-with-kubernetes-2/)

*   #### [Zero to Production with Kubernetes, Part 3: Deploying a K3s Kubernetes Cluster with Ansible](https://francoposa.io/resources/infra-ops/kubernetes-k3s-ansible-digital-ocean-3/)


### [Dev Tools](https://francoposa.io/resources/dev-tools/)

*   #### [Git Good, Part 1: Configuration, Creating Repositories, and Committing Changes](https://francoposa.io/resources/dev-tools/git-basics-1/)


### [Golang](https://francoposa.io/resources/golang/)

*   #### [Golang Templates, Part 1: Concepts and Composition](https://francoposa.io/resources/golang/golang-templates-1/)
