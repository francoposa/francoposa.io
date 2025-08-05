---
title: "Containerizing a Golang Application"
summary: "Packaging a Golang Application for Containerized Deployment"
description: "Build, Run, and Push with Docker and Make"
tags:
  - Golang
  - Containers
  - Docker
  - Make
  - Git

slug: golang-containerizing-dockerfile-makefile
date: 2024-01-17
weight: 4
---

**Note: this document is a work in progress.**

## Goals
We will:
1. Write a simple HTTP server in Go
2. Create an optimized two-stage Docker build
3. Use a Makefile to simplify our build  and run commands

## 0. Prequisites

### 0.1 Install Docker or Podman
On Linux, Docker can be installed as just the suite of CLI tools referred to as "Docker Engine" -
steps for each Linux distro are in the [official docs](https://docs.docker.com/engine/install/).
Do not skip the [post-install steps](https://docs.docker.com/engine/install/linux-postinstall/).

On Mac and Windows, Docker Engine is only available through a full [Docker Desktop](https://docs.docker.com/desktop/) install.
Unfortunately, Docker Desktop is only free for personal and small business use and does not have an open source license.

[Podman](https://podman.io/docs/installation) was created in response to these license restrictions,
and both the CLI tools and desktop application are open source under the Apache 2.0 license.
Podman is fully compatible as a Docker replacement - `docker` CLI commands can be used with Podman as normal.
Podman Desktop has some additional steps to

## 1. Write a Simple Go Application

Our application will be a simple echo server with two endpoints:
* `/`: the root path returns a plain-text request body echo
* `/health`: for Docker and Kubernetes health & readiness checks

We must declare a `go.mod`:

```text
module github.com/francoposa/echo-server-go

go 1.24
```

The application code is simple and all contained in `main.go`:
```golang
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", Health)
	mux.HandleFunc("/", Echo)

	err := http.ListenAndServe("0.0.0.0:8080", mux)
	log.Fatal(err)
}

func Health(w http.ResponseWriter, r *http.Request) {
	body, err := json.Marshal(map[string]string{"status": "ok"})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	_, err = w.Write(body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func Echo(w http.ResponseWriter, r *http.Request) {
	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	_, err = w.Write(requestBody)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}
```

### 1.1 Build and Run the Application Locally

We can build and run this locally first to test it before containerizing.

Build and run:
```shell
[~/repos/echo-server-go] % go run github.com/francoposa/echo-server-go
```

In another terminal window, talk to the server on port 8080:
```shell
[~/repos/echo-server-go] % curl localhost:8080/health
{"status":"ok"}%                                                                                                                        [~/repos/echo-server-go-example] % curl localhost:8080 -d "hello, world"
[~/repos/echo-server-go] % curl localhost:8080 -d "hello, world"
hello, world%
```

With the application running and responding to requests, we are ready to containerize.

## 2. Create an Optimized Docker Build
Without getting too deep in the weeds, we can utilize some straightforward techniques
to optimize our Docker build times and final container size.

### Optimization 1: Separate Build and Run Stages
Our two stages will:
1. Install all required dependencies and compile the application
2. Mount and run only the compiled binary (along with any static assets)

While our example only has a Go installation as a build dependency,
more complicated applications may utilize large compiler toolchains
or require compile-time linking against OS libraries such as `openssl,` `protoc`, etc.
Stripping these out of the final image not only reduces the size
but also reduces the attack surface area for security vulnerabilities.

The separation of stages also helps with our second optimization.

### Optimization 2: Order Build Instructions from Least to Most Cacheable
Or: "run commands in ascending order of how often their inputs change".

Docker will cache the result of each instruction and skip it if nothing has changed since the previous build.
On the other hand, if the inputs to a build instruction change,
both that instruction *and every instruction after it* must be re-run.

We want to organize the order of our build instructions to ensure the most costly steps
can be skipped and read from the cache as often as possible.

### 2.1 Create the Build Stage

#### 2.1.1 Start With a Base Build Image.

See https://hub.docker.com/_/golang for all available image tags.

The `golang:latest` Docker image is always the latest debian base image with the latest stable Go version -
at time of writing `latest` is equivalent to `1.24.4-bookworm` where bookworm is the Debian 12 code name.

Pinning a specific version like `1.24.4-bookworm` will introduce fewer changes (and cache misses)
than less-specific tags like `1.24-bookworm`, `1`. or `latest`, but eventually require manual updating.

```Dockerfile
# Begin builder stage.
# Tag golang:version is the latest Debian builder image from Docker Hub.
# Prefer to use full-qualified name with `docker.io` prefix
# rather than relying on implicit default container registry settings.
FROM docker.io/golang:latest AS builder
```

#### 2.1.2 Mount Source Code and Assets Required for Build

Make an attempt to mount only the needed directories and files -
as applications get larger, copying over all the files into the container can take significant time.

As mentioned, we want to make an attempt to mount the files in descending order of how often they change.
With something like this simple echo server,
we might assume we will update the Go version and dependencies in `go.mod`
more often than we update the application code itself.
More actively-developed applications may make the opposite assumption

```Dockerfile
# Create the directory.
RUN mkdir /build
# Mount only the needed files.
COPY ./main.go /build
COPY go.mod /build
# Change directory into build dir.
WORKDIR /build
```

#### 2.1.3 Build Application and Specify Output Directory

```Dockerfile
# Build Go binary.
RUN go build -v -o dist/echo-server  ./
# End builder stage.
```

### 2.2 Create the Final Container Image Stage

#### 2.2.1 Mount Application to Final Stage

```Dockerfile
# final container stage
FROM docker.io/debian:12-slim

# Container labels must be in the final stage;
# any labels attached to intermediate/builder containers are discarded along with image.
#
# There are many opencontainer labels but "where is this code from" is the most important.
LABEL org.opencontainers.image.source="https://github.com/francoposa/echo-server-go"

# Copy only necessary files - in this case just the built binary.
COPY --from=builder /build/dist/echo-server /bin/echo-server
```

#### 2.2.2 Create Non-Root User to Run Application

```Dockerfile
# Create a non-root user to run the application
RUN groupadd appuser \
  && useradd --gid appuser --shell /bin/bash --create-home appuser

# Change ownership of the relevant files to the non-root application user.
# For a simple application like this, only the binary itself is needed.
# More complex setups may need permissions to config files, log files, etc.
RUN chown appuser /bin/echo-server

# Switch to the non-root user before completing the build,
USER appuser
```

#### 2.2.3 Set the Run Command for the Container

```Dockerfile
# EXPOSE no longer has any actual functionality,
# but serves as documentation for exposed ports.
EXPOSE 8080
CMD ["echo-server"]
```

## 3. Build and Run the Container Image

## 4. Encapsulate Build and Run Commands with a Makefile

```Makefile
# git version --dirty tag ensures we don't override an image tag built from a clean state
# with an image tag built from a "dirty" state with uncommitted changes.
# we should be able to use git to see the repo in the exact state the container was built from.
GIT_VERSION ?= $(shell git describe --abbrev=8 --tags --always --dirty)
IMAGE_PREFIX ?= ghcr.io/francoposa/echo-server-go/echo-server
SERVICE_NAME ?= echo-server

.PHONY: clean
clean:
	rm -rf dist/

.PHONY: local.build
local.build: clean
	go build -o dist/echo-server ./src/cmd/server

.PHONY: local.test
local.test:
	go test -v ./...

.PHONY: local.run
local.run:
	go run ./src/cmd/server/main.go

.PHONY: docker.build
docker.build:
	# image gets tagged as latest by default
	docker build -t $(IMAGE_PREFIX)/$(SERVICE_NAME) -f ./Dockerfile .
	# tag with git version as well
	docker tag $(IMAGE_PREFIX)/$(SERVICE_NAME) $(IMAGE_PREFIX)/$(SERVICE_NAME):$(GIT_VERSION)

.PHONY: docker.run
docker.run:  # defaults to latest tag
	docker run -p 8080:8080 $(IMAGE_PREFIX)/$(SERVICE_NAME)

.PHONY: docker.push
docker.push: docker.build
	docker push $(IMAGE_PREFIX)/$(SERVICE_NAME):$(GIT_VERSION)
	docker push $(IMAGE_PREFIX)/$(SERVICE_NAME):latest
```
