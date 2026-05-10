SINGLETON = folio
COMMANDS  =
SERVER_PORT = 3000

ifndef GOAMD64
	GOAMD64 = v2
endif

GOBIN    = go
UPXBIN   = upx
GOARCH  = $(shell uname -m | tr [A-Z] [a-z])
ifeq ($(GOARCH), amd64)
	GOARGS = GOEXPERIMENT=greenteagc GOAMD64=$(GOAMD64)
else
	GOARGS = GOEXPERIMENT=greenteagc
endif
RELEASE  = "-s -w"
GOBUILD  = $(GOARGS) $(GOBIN) build -ldflags=$(RELEASE)
BINFILES = $(SINGLETON) $(COMMANDS)


.PHONY: all build clean upx upxx dev $(BINFILES)

all: $(BINFILES)
	@echo "✅ Build success."

$(SINGLETON):
	@echo "Compile $@ ..."
	cd web && npx vite build
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
	@echo "   - Frontend: http://localhost:5173"
	@echo "   - Backend:  http://localhost:$(SERVER_PORT)"
	@echo "   - HMR:      Enabled"
	cd web && npx vite &
	go run main.go

clean:
	rm -rf web/dist $(BINFILES:%=./bin/%)
	@echo "✅ Clean complete."

upx: all
	$(UPXBIN) $(BINFILES:%=./bin/%)

upxx: all
	$(UPXBIN) --ultra-brute $(BINFILES:%=./bin/%)
