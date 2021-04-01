IMAGE_NAME=segmed-assignment-dunglp:v1

default: build run

.PHONY: build
build:
	docker build -t $(IMAGE_NAME) .

.PHONY: run
run: 
	docker run --name segmed-assignment-dunglp -d -p 8080:80 $(IMAGE_NAME) 