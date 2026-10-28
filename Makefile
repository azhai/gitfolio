SINGLETON = folio
COMMANDS  =
SERVER_PORT = 9000

ifndef GOAMD64
	GOAMD64 = v2
endif
GOOS    = $(shell uname | tr [A-Z] [a-z])
GOARCH  = $(shell uname -m | tr [A-Z] [a-z])
ifeq ($(GOARCH), amd64)
	GOARGS = GOAMD64=$(GOAMD64)
else
	GOARGS =
endif

GOBIN    = go
UPXBIN   = upx
RELEASE  = "-s -w"
GOBUILD  = $(GOARGS) $(GOBIN) build -ldflags=$(RELEASE)
BINFILES = $(SINGLETON) $(COMMANDS)

# No frontend build step: go:embed pulls web/{pages,assets,public} straight into
# the binary, so editing a file only needs a recompile.

.PHONY: one all front build dev clean upx upxx $(BINFILES)

one:
	@echo "Compile one ($(GOOS)/$(GOARCH)) ..."
ifneq ($(SINGLETON),)
		CGO_ENABLED=1 $(GOBUILD) -o ./bin/$(SINGLETON) ./
endif
	for one in $(COMMANDS); do \
		CGO_ENABLED=1 $(GOBUILD) -o ./bin/$$one ./cmd/$$one; \
	done

all: clean one build

front:
	@echo "ℹ️  No frontend build: web/{pages,assets,public} are embedded by go:embed."

build: $(BINFILES)
	@echo "✅ Build success."

$(SINGLETON):
	@echo "Compile $@ ..."
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GOBUILD) -o ./bin/$@.darwin-arm64 ./
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) -o ./bin/$@.darwin-amd64 ./
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD) -o ./bin/$@.linux-arm64 ./
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) -o ./bin/$@.linux-amd64 ./
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) -o ./bin/$@.windows-amd64 ./

$(COMMANDS):
	@echo "Compile $@ ..."
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GOBUILD) -o ./bin/$@.darwin-arm64 ./cmd/$@
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) -o ./bin/$@.darwin-amd64 ./cmd/$@
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD) -o ./bin/$@.linux-arm64 ./cmd/$@
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) -o ./bin/$@.linux-amd64 ./cmd/$@
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) -o ./bin/$@.windows-amd64 ./cmd/$@

dev:
	@echo ""
	@echo "💡 Tips:"
	@echo "   - Visit:  http://127.0.0.1:$(SERVER_PORT)"
	@echo "   - Assets: edit web/{pages,assets,public} and restart (go:embed, no copy step)"
	@echo "🚀 Starting backend..."
	go run ./

clean:
	rm -rf $(BINFILES:%=./bin/%)
	@echo "✅ Clean complete."

upx: all
	$(UPXBIN) $(BINFILES:%=./bin/%)

upxx: all
	$(UPXBIN) --ultra-brute $(BINFILES:%=./bin/%)
