.PHONY: help install prepare animations gif-convert animations-ship assets dev build zip icons locales test test-watch \
	typecheck lint lint-fix check package clean release-patch release-minor release-major

PNPM ?= pnpm

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##; printf "Usage: make <target>\n\nTargets:\n"} \
		/^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies (pnpm)
	$(PNPM) install

animations: ## Regenerate companion Lottie JSON (lottie-json/)
	$(PNPM) animations

gif-convert: ## Convert lottie-json/ to public/gif/ via Docker (dotlottie + gifski)
	$(PNPM) gif:convert

animations-ship: ## Regenerate Lottie JSON, then GIFs (animations + gif-convert)
	$(PNPM) animations:ship

assets: ## Prepare bundled assets (locales, animations)
	$(PNPM) assets

prepare: ## Generate WXT types and prepare the project
	$(PNPM) exec wxt prepare

dev: assets ## Run Chrome dev server (regenerates assets first)
	$(PNPM) exec wxt

build: assets ## Production build (regenerates assets first)
	$(PNPM) build

zip: assets ## Build and package Chrome extension zip (regenerates assets first)
	$(PNPM) zip

icons: ## Regenerate extension icons (public/icon/)
	python3 scripts/generate-icons.py

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
