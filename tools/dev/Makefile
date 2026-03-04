BINARY  := browseros-dev
SOURCES := $(shell find . -name '*.go') go.mod go.sum

$(BINARY): $(SOURCES)
	@echo "[build] Compiling $(BINARY)..."
	@go build -o $@ .

.PHONY: clean
clean:
	@rm -f $(BINARY)
