# AGENTS.md

# Project Overview
This repository builds modular Markdown documents into Word/PDF outputs and
ships a small Go web UI to generate and download those outputs.

# Tech Stack
- Document build: Pandoc
- PDF engine: XeLaTeX + Eisvogel template
- Web backend: Go 1.21+ (standard net/http)
- Web frontend: vanilla HTML/CSS/JS
- Config format: YAML

# Project Structure
- Root build scripts: `build.ps1`, `bin/build.sh`, `Makefile`
- Web backend (Go): `web/`
- Web static assets: `web/static/`
- Source docs: `src/`
- Client configs: `clients/`
- Templates: `templates/`
- Output artifacts: `build/` (generated)

# Build / Run Commands

## Document Build (Windows)
- Build Word (default): `./build.ps1`
- Build PDF: `./build.ps1 -Format pdf`
- Build for client: `./build.ps1 -Client <client>`
- Build a single doc: `./build.ps1 -Client <client> -Doc <doc>`
- List clients: `./build.ps1 -ListClients`
- List docs for client: `./build.ps1 -Client <client> -ListDocs`
- List modules: `./build.ps1 -ListModules`
- Check PDF deps: `./build.ps1 -CheckPdfDeps`
- Init default template: `./build.ps1 -InitTemplate`
- Install fonts: `./build.ps1 -InstallFonts`
- Clean output: `./build.ps1 -Clean`

## Document Build (Linux/macOS)
- Init scripts: `make init`
- Build Word (default): `make`
- Build PDF: `make format=pdf`
- Build for client: `make client=<client>`
- Build a single doc: `make client=<client> doc=<doc>`
- List clients: `make list-clients`
- List docs for client: `make list-docs client=<client>`
- List modules: `make list-modules`
- Check PDF deps: `make check-pdf-deps`
- Init default template: `make init-template`
- Clean output: `make clean`

## Web Server (Go)
- Build from source (inside `web/`): `go build -o doc-generator-web .`
- Run from repo root:
  - Linux/macOS: `./web/doc-generator-web`
  - Windows: `web\doc-generator-web.exe`
- Run from `web/`: `go run .`
- Docker build: `docker build -t doc-generator-web -f web/Dockerfile .`
- Docker run: `docker run -p 8080:8080 doc-generator-web`

## Web Static Dependencies
- Vendor copy: `npm install` (run in `web/static/`)
- Note: only `postinstall` exists; no bundler/test scripts.

## Deployment Validation
- Linux/macOS: `./validate-deployment.sh --verbose`
- Windows: `./validate-deployment.ps1 -Verbose`

# Tests / Lint / Format

## Tests
- No repo-specific test commands were found.
- If Go tests are added later, standard patterns are:
  - All tests: `go test ./...`
  - Single package: `go test ./web/...`
  - Single test: `go test ./web/... -run TestName`

## Linting
- No linter config found (no `golangci-lint`, ESLint, Prettier).
- Keep Go code gofmt-formatted.

## Formatting
- Go: `gofmt` (tabs; canonical import grouping).
- JS/CSS: no formatter configured; follow file-local style.

# Code Style Conventions (Observed)

## Go (web backend)
- Formatting: gofmt output; tabs; blank lines between logical blocks.
- Imports: standard library first, then local module imports.
- Naming:
  - Exported types/functions: `PascalCase`.
  - Unexported: `camelCase`.
  - Error codes: `ErrSomething` constants.
- Error handling:
  - Return early on error.
  - Wrap with `fmt.Errorf("...: %w", err)` when propagating.
  - HTTP handlers use `successResponse`/`errorResponse` helpers.
- JSON/YAML: explicit struct tags for API payloads and config parsing.
- Concurrency: `sync.WaitGroup` + `sync.Mutex` for fan-out tasks.

## Bash / PowerShell (build scripts)
- Bash scripts use `set -e` and named functions for sections.
- PowerShell sets `$ErrorActionPreference = "Stop"`.
- Keep shell changes minimal; avoid refactors unless required.

## JS (web/static)
- Vanilla JS with `const`/`let` and function declarations.
- Event wiring starts on `DOMContentLoaded`.
- UI state stored in top-level variables.

# Data and Config Conventions
- Client configs are YAML under `clients/<client>/`.
- Document modules live under `src/` and often use numeric prefixes.
- Output artifacts are written to `build/` (do not commit).
- PDF build requires Pandoc + XeLaTeX + Eisvogel + CJK fonts.

# CI / Automation Files
- GitHub Actions: `.github/workflows/build-web.yml`, `.github/workflows/build-docker.yml`
- GitLab CI: `.gitlab-ci.yml`

# Cursor / Copilot Rules
- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot rules found in `.github/copilot-instructions.md`.

# Boundaries
- Always do:
  - Keep generated files out of git (`build/`).
  - Preserve API response shapes and error codes.
  - Keep Go files gofmt-formatted.
- Ask first:
  - Adding new dependencies or build steps.
  - Changing Pandoc/PDF pipeline behavior.
  - Editing CI workflows.
- Never do:
  - Commit secrets or files under `build/`.
  - Remove failing checks by deleting tests.

# Agent Checklist
- Identify target area: docs build, Go backend, or web static.
- Locate the entry file before editing:
  - CLI: `build.ps1` or `bin/build.sh`
  - Web: `web/main.go` and `web/handler/api.go`
  - UI: `web/static/app.js`
- Keep changes small and aligned to existing patterns.
- If you add tests or linting, update this file with run commands.

# Quick Links (Files)
- `README.md`
- `web/README.md`
- `Makefile`
- `build.ps1`
- `bin/build.sh`
