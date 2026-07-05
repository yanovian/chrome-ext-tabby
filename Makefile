.PHONY: help install prepare assets dev build zip sprites locales test test-watch \
	typecheck lint lint-fix check package clean release-patch release-minor release-major

PNPM ?= pnpm

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>\n\nTargets:\n"} \
		/^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies (pnpm)
	$(PNPM) install

assets: ## Prepare bundled assets: ONNX runtime, speech model, and _locales
	$(PNPM) assets

prepare: ## Generate WXT types and prepare the project
	$(PNPM) exec wxt prepare

dev: ## Run Chrome dev server with hot reload
	$(PNPM) dev

build: ## Production build (Chrome)
	$(PNPM) build

zip: build ## Build and package Chrome extension zip
	$(PNPM) zip

sprites: ## Process cat sprites (transparent backgrounds + optimize)
	python3 scripts/process-sprites.py

locales: ## Regenerate Chrome Web Store locale files (public/_locales/)
	$(PNPM) locales

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

release-patch: check ## Bump patch version, tag vX.Y.Z, push (triggers GitHub release)
	$(PNPM) version patch -m "Release v%s"
	git push origin HEAD --follow-tags

release-minor: check ## Bump minor version, tag vX.Y.Z, push (triggers GitHub release)
	$(PNPM) version minor -m "Release v%s"
	git push origin HEAD --follow-tags

release-major: check ## Bump major version, tag vX.Y.Z, push (triggers GitHub release)
	$(PNPM) version major -m "Release v%s"
	git push origin HEAD --follow-tags
