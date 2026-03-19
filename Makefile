SINGLETON = folio
COMMANDS  = mirror sync account


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
	$(GOBUILD) -o ./bin/$@ ./

$(COMMANDS):
	@echo "Compile $@ ..."
	$(GOBUILD) -o ./bin/$@ ./cmd/$@

frontend:
	@echo "Build frontend..."
	@./build-frontend.sh

build: frontend $(BINFILES)
	@echo "Build success."

dev: frontend
	@echo "Start development server..."
	@which air > /dev/null || go install github.com/air-verse/air@latest
	air -c .air.toml

clean:
	rm -f $(BINFILES:%=./bin/%)
	@echo "Remove old files."

upx: clean build
	$(UPXBIN) $(BINFILES:%=./bin/%)

upxx: clean build
	$(UPXBIN) --ultra-brute $(BINFILES:%=./bin/%)
