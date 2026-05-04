SINGLETON = folio
COMMANDS  = seed
SERVER_PORT = 3000

ifndef GOAMD64
	GOAMD64 = v2
endif

GOBIN    = go
UPXBIN   = upx
#GOOS    = $(shell uname -s | tr [A-Z] [a-z])
GOARCH  = $(shell uname -m | tr [A-Z] [a-z])
ifeq ($(GOARCH), amd64)
	GOARGS = GOEXPERIMENT=greenteagc GOAMD64=$(GOAMD64) CGO_ENABLED=1
else
	GOARGS = GOEXPERIMENT=greenteagc CGO_ENABLED=1
endif
RELEASE  = "-s -w"
GOBUILD  = $(GOARGS) $(GOBIN) build -ldflags=$(RELEASE)
BINFILES = $(SINGLETON) $(COMMANDS)


.PHONY: all build clean upx upxx dev $(BINFILES)

all: clean build

$(SINGLETON):
	@echo "Compile $@ ..."
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 $(GOBUILD) -o ./bin/$@.darwin-arm64 ./
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) -o ./bin/$@.darwin-amd64 ./
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD) -o ./bin/$@.linux-arm64 ./
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) -o ./bin/$@.linux-amd64 ./
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) -o ./bin/$@.windows-amd64 ./

$(COMMANDS):
	@echo "Compile $@ ..."
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 $(GOBUILD) -o ./bin/$@.darwin-arm64 ./cmd/$@
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) -o ./bin/$@.darwin-amd64 ./cmd/$@
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD) -o ./bin/$@.linux-arm64 ./cmd/$@
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) -o ./bin/$@.linux-amd64 ./cmd/$@
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) -o ./bin/$@.windows-amd64 ./cmd/$@

frontend:
	@echo "Build frontend..."
	@./build-frontend.sh

build: frontend $(BINFILES)
	@echo "Build success."

dev: frontend
	@echo "Start development server..."
	@which air > /dev/null || go install github.com/air-verse/air@latest
# lsof -i tcp:$(SERVER_PORT) | xargs kill -9
	air -c .air.toml

clean:
	rm -f $(BINFILES:%=./bin/%)
	@echo "Remove old files."

upx: clean build
	$(UPXBIN) $(BINFILES:%=./bin/%)

upxx: clean build
	$(UPXBIN) --ultra-brute $(BINFILES:%=./bin/%)
