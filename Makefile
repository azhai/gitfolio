SINGLETON = folio
COMMANDS  = seed
SERVER_PORT = 3000

ifndef GOAMD64
	GOAMD64 = v2
endif

GOBIN    = go
UPXBIN   = upx
GOARCH  = $(shell uname -m | tr [A-Z] [a-z])
ifeq ($(GOARCH), amd64)
	GOARGS = GOEXPERIMENT=greenteagc GOAMD64=$(GOAMD64) CGO_ENABLED=1
else
	GOARGS = GOEXPERIMENT=greenteagc CGO_ENABLED=1
endif
RELEASE  = "-s -w"
GOBUILD  = $(GOARGS) $(GOBIN) build -ldflags=$(RELEASE)
BINFILES = $(SINGLETON) $(COMMANDS)


.PHONY: all build clean upx upxx dev frontend-dev frontend-build frontend-clean frontend-install frontend-serve $(BINFILES)

all: frontend-build $(BINFILES)
	@echo "✅ Build success."

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
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GOBUILD) -o ./bin/$@.linux-arm64 ./
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) -o ./bin/$@.linux-amd64 ./cmd/$@
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) -o ./bin/$@.windows-amd64 ./cmd/$@

frontend-dev:
	@./build-frontend.sh dev

frontend-build:
	@./build-frontend.sh build

frontend-clean:
	@./build-frontend.sh clean

frontend-install:
	@./build-frontend.sh install

frontend-serve:
	@./build-frontend.sh serve

frontend: frontend-build

dev: frontend-dev
	@echo ""
	@echo "💡 Tips:"
	@echo "   - Frontend: http://localhost:5173"
	@echo "   - Backend:  http://localhost:$(SERVER_PORT)"
	@echo "   - HMR:      Enabled"

serve: frontend-build
	@echo ""
	@echo "🌐 Starting GitFolio Server..."
	@echo "   🌐 http://localhost:$(SERVER_PORT)"
	go run main.go

clean: frontend-clean
	rm -f $(BINFILES:%=./bin/%)
	@echo "✅ Clean complete."

upx: all
	$(UPXBIN) $(BINFILES:%=./bin/%)

upxx: all
	$(UPXBIN) --ultra-brute $(BINFILES:%=./bin/%)
