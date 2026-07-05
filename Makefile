.PHONY: help install prepare dev build zip sprites assets test test-watch typecheck lint lint-fix check package clean

PNPM ?= pnpm

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\nTargets:\n"} \
		/^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies (pnpm)
	$(PNPM) install

prepare: ## Generate WXT types and prepare the project
	$(PNPM) exec wxt prepare

dev: ## Run dev server with hot reload (keep this running while you code)
	$(PNPM) assets
	$(PNPM) dev

assets: ## Download bundled ONNX runtime + local speech model (offline)
	$(PNPM) assets

build: ## Production build (Chrome)
	$(PNPM) build

zip: build ## Build and package Chrome extension zip
	$(PNPM) zip

sprites: ## Process cat sprites (transparent backgrounds + optimize)
	python3 scripts/process-sprites.py

test: ## Run unit tests once
	$(PNPM) test

test-watch: ## Run unit tests in watch mode
	$(PNPM) test:watch

typecheck: ## TypeScript check
	$(PNPM) typecheck

lint: ## ESLint
	$(PNPM) lint

lint-fix: ## ESLint with auto-fix
	$(PNPM) lint:fix

check: typecheck lint test build ## CI-style check: typecheck, lint, test, build

package: zip ## Build and zip for Chrome Web Store

clean: ## Remove build output
	rm -rf .output
