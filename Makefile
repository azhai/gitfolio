SINGLETON = folio
COMMANDS  =
SERVER_PORT = 9000

ifndef GOAMD64
	GOAMD64 = v2
endif
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


.PHONY: one all build dev clean upx upxx $(BINFILES)

one:
	@echo "Compile $(SINGLETON) ..."
	cd web && npx vite build
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 $(GOBUILD) -o ./bin/$(SINGLETON) ./

all: clean one build

build: $(BINFILES)
	@echo "✅ Build success."

$(SINGLETON):
	@echo "Compile $@ ..."
	cd web && npx vite build --minify --mode production
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

dev:
	@echo ""
	@echo "💡 Tips:"
	@echo "   - Visit:  http://127.0.0.1:$(SERVER_PORT)"
	@echo "   - HMR:    Disabled"
	@echo "📦 Building frontend..."
	cd web && npx vite build
	@echo "🚀 Starting backend..."
	go run *.go

clean:
	rm -rf web/dist $(BINFILES:%=./bin/%)
	@echo "✅ Clean complete."

upx: all
	$(UPXBIN) $(BINFILES:%=./bin/%)

upxx: all
	$(UPXBIN) --ultra-brute $(BINFILES:%=./bin/%)
