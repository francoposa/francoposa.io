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


## Goals
We will:
1. Write a simple Go application
2. Create a Dockerfile for a two-stage Docker build
3. Build and Run the Docker Image
4. Use a Makefile to simplify our build commands

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

go 1.21
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
	mux.HandleFunc("/json", EchoJSON)

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

And in another tab, talk to the server on port 8080:
```shell
[~/repos/echo-server-go] % curl localhost:8080/health
{"status":"ok"}%                                                                                                                        [~/repos/echo-server-go-example] % curl localhost:8080 -d "hello, world"
[~/repos/echo-server-go] % curl localhost:8080 -d "hello, world"
hello, world%
[~/repos/echo-server-go] % curl localhost:8080/json \
  -H 'content-type: application/json' \
  -d '{"hello, world"}'
{
    "body": "{\"hello, world\"}",
    "headers": {
        "Accept": [
            "*/*"
        ],
        "Content-Length": [
            "16"
        ],
        "Content-Type": [
            "application/json"
        ],
        "User-Agent": [
            "curl/8.11.1"
        ]
    },
    "host": "localhost:8080",
    "method": "POST",
    "protocol": "HTTP/1.1",
    "remote_address": "[::1]:53164",
    "url": "/json"
}%
```

## Dockerfile
```Dockerfile
# golang:version is the latest debian builder image
FROM golang:latest AS builder

# mount only the needed files
RUN mkdir /build
COPY ./src /build/src
COPY go.mod /build
WORKDIR /build

# build
RUN go build -v -o dist/echo-server  ./src/cmd/server

# end of builder stage

# final container stage
FROM debian:12.2

# labels must be in the final stage or else they will only be attached to the intermediate
# builder container which is not part of the final build and is usually discarded.
#
# there are many opencontainer labels but "where is this code from" is the most important
LABEL org.opencontainers.image.source = "https://github.com/francoposa/echo-server-go"

# copy only necessary files; in this case just the built binary
COPY --from=builder /build/dist/echo-server /bin/echo-server

# create a non-root user to run the application
RUN groupadd appuser \
  && useradd --gid appuser --shell /bin/bash --create-home appuser

# change ownership of the relevant files to the non-root application user
# for this a simple application, this is just the binary itself
# more complex setups may need permissions to config files, log files, etc.
RUN chown appuser /bin/echo-server

# switch to the non-root user before completing the build
USER appuser

# EXPOSE no longer has any actual functionality,
# but serves as documentation for exposed ports
EXPOSE 8080
CMD ["echo-server"]
```

## Makefile

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
