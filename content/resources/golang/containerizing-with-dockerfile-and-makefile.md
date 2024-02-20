---
title: "Containerizing a Golang Application with Dockerfile and Makefile"
slug: golang-containerizing-dockerfile-makefile
summary: "Packaging a Golang Application for Containerized Deployment"
date: 2024-01-17
order_number: 1
---

##### **this document is a work in progress**

## Repository Structure

```shell
[~/repos/echo-server-go] % tree --dirsfirst
.
├── src
│   └── cmd
│       └── server
│           └── main.go
├── Dockerfile
├── go.mod
├── LICENSE
├── Makefile
└── README.md
```

## Application Code

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

func EchoJSON(w http.ResponseWriter, r *http.Request) {
	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	body := map[string]interface{}{}
	body["method"] = r.Method
	body["protocol"] = r.Proto
	body["headers"] = r.Header
	body["remote_address"] = r.RemoteAddr
	body["body"] = string(requestBody)

	prettyJSONBody, err := json.MarshalIndent(body, "", "    ")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	_, err = w.Write(prettyJSONBody)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
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
