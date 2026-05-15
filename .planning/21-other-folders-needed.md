# 21 — Other Folders Needed (Non-Code Inventory)

**Goal:** Beyond `.planning/`, list every folder that should exist in the repo root (or near it), what goes in it, who creates it, and when. This complements the code folder structure in Architecture doc §2.

---

## At-a-glance map

```
aura/                                ← monorepo root
├── .planning/                       ← THIS folder — implementation plan (created by me, used by you)
├── DOSC/                            ← Source docs: PRD, architecture (already exists)
├── docs/                            ← Generated/maintained dev documentation (AGENTS create as we build)
├── apps/                            ← Deployable apps (already exists; only `web/` for MVP)
├── services/                        ← 12 microservices (already exists; placeholders in repo)
├── packages/                        ← Shared TS packages (already exists)
├── infra/                           ← IaC (Terraform, docker-compose, k8s-Phase-2)
├── scripts/                         ← Helper scripts (DB seed, codegen, ops one-offs)
├── .github/                         ← GitHub Actions workflows + issue templates
├── .vscode/                         ← Recommended editor settings + extensions
├── tests/                           ← Top-level cross-service E2E + load tests
├── tools/                           ← Developer-facing CLI tools (e.g., admin scripts)
├── design/                          ← Design assets (Figma exports, logos, brand kit)
├── legal/                           ← Privacy policy, ToS, DPA templates (Markdown source)
├── pnpm-workspace.yaml              ← Already exists
├── package.json                     ← Already exists
├── turbo.json                       ← Created in Phase 0 by repo bootstrap
├── .env.example                     ← Already exists; kept up-to-date
├── .gitignore                       ← Already exists
├── .nvmrc / .python-version         ← Lock language versions
├── README.md                        ← Top-level repo README (create in Phase 0)
└── CLAUDE.md (optional)             ← Coding conventions for Claude Code agent
```

---

## Folder-by-folder

### `.planning/` (this folder)
- **What:** Step-by-step implementation guides
- **Who creates:** Already created
- **Who maintains:** You + AI agents update as plans evolve
- **Lifecycle:** Frozen content after MVP launch; kept as historical reference. New Phase 1.5+ plans go into a sibling folder like `.planning-phase-1.5/`

### `DOSC/`
- **What:** Authoritative source documents (PRD, Architecture, future ADRs)
- **Status:** Already exists with the two source files
- **Lifecycle:** Edits only via formal change process (you approve every change). Treat as a contract.

### `docs/`
- **What:** Long-form developer documentation built up *during* implementation
- **Sub-folders to create (by AI agents, as we build):**
  - `docs/architecture/` — Mermaid diagrams of event flow, deployment topology
  - `docs/runbooks/` — Operational runbooks (see `15-observability-and-logging.md`)
  - `docs/decisions/` — Architecture Decision Records (ADRs) numbered 0001+
  - `docs/api/` — Generated OpenAPI specs aggregated
  - `docs/operations/ci-cd.md` — How the pipeline works
  - `docs/operations/secrets-rotation.md` — How to rotate each secret
- **Who creates:** AI agents during each phase
- **Lifecycle:** Living. Out-of-date docs are worse than no docs — update or delete.

### `apps/`
- **What:** Deployable client applications
- **Sub-folders for MVP:** `apps/web/` only
- **Future:** `apps/admin/` (admin tool), `apps/mobile/` (Phase 2)
- **Status:** Already exists in repo

### `services/`
- **What:** 12 microservices
- **Status:** Skeletons partially exist; each service spec in `09-service-specs/` is the build target

### `packages/`
- **What:** Shared TypeScript packages
- **Sub-folders:** `db`, `types`, `queue`, `utils` (all already exist)
- **Future addition:** `packages/types-py/` — generated Pydantic models for Python services (see `05-shared-packages.md`)

### `infra/`
- **What:** Infrastructure as Code + local dev orchestration
- **Sub-folders (AI agents create during Phase 0/1):**
  - `infra/terraform/` — per `12-infrastructure-terraform.md`
  - `infra/docker/` — `docker-compose.yml` for full local stack
  - `infra/k8s/` — placeholder for Phase 2 migration (don't build for MVP)
- **Who creates:** Phase 0 agent creates the structure; Terraform module agent fills in modules

### `scripts/`
- **What:** Helper scripts that aren't part of any service
- **Examples:**
  - `scripts/setup-local-env.sh` — generates `.env.local` with random crypto values
  - `scripts/seed-staging.sh` — runs `prisma db seed` against staging
  - `scripts/codegen-pydantic/` — TS → Pydantic codegen for Python services
  - `scripts/pubsub-bootstrap.sh` — creates topics + subs in Pub/Sub emulator
  - `scripts/db-restore-drill.sh` — for quarterly backup verification
- **Who creates:** AI agents as the need arises
- **Conventions:** Every script has a `--help` flag and prints what it will do before doing it

### `.github/`
- **What:** GitHub-specific config
- **Sub-folders:**
  - `.github/workflows/` — Actions (per `13-ci-cd-pipeline.md`)
  - `.github/ISSUE_TEMPLATE/` — Templates for bug, feature, security
  - `.github/PULL_REQUEST_TEMPLATE.md` — PR template with checklist
  - `.github/CODEOWNERS` — even with one human owner, codify which folders need explicit approval
  - `.github/dependabot.yml` — dependency update config
- **Who creates:** Phase 0 agent

### `.vscode/` (optional but recommended)
- **What:** Editor config so every contributor (you + agents working in editors) sees the same setup
- **Files:**
  - `extensions.json` — recommended: Prisma, Tailwind, ESLint, Vitest, Pylance, ruff
  - `settings.json` — format on save, no auto-import for forbidden patterns
- **Who creates:** Optional, you in Phase 0

### `tests/` (top-level)
- **What:** Cross-service E2E + load tests that don't belong to any single service
- **Sub-folders:**
  - `tests/e2e/` — Playwright tests run in CI against staging
  - `tests/load/` — k6 scripts
  - `tests/multi-tenant/` — the multi-tenancy isolation suite (see `14-testing-strategy.md` §9)
- **Who creates:** Test-focused AI agent in Phase 7

### `tools/`
- **What:** Developer-facing CLI utilities used during operations
- **Examples:**
  - `tools/aura-admin/` — internal admin CLI: list tenants, freeze a tenant, force re-audit
  - `tools/cost-report/` — generate weekly cost-per-tenant breakdown from BigQuery
- **Who creates:** As needs surface during/after launch
- **MVP:** Likely empty; populated post-launch

### `design/`
- **What:** Design source files and exported assets
- **Sub-folders:**
  - `design/brand/` — logo (SVG + PNG variants), color palette, typography spec
  - `design/figma/` — links + exports
  - `design/og-images/` — Open Graph images for marketing pages
  - `design/email-templates/` — MJML source files for transactional emails (lives here, compiled into notification-service at build time)
- **Who creates:** You (design content); AI agent for MJML compilation script

### `legal/`
- **What:** Markdown source for legal documents that appear in the product
- **Files:**
  - `legal/privacy-policy.md`
  - `legal/terms-of-service.md`
  - `legal/refund-policy.md`
  - `legal/dpa-template.md`
  - `legal/cookie-policy.md`
  - `legal/sub-processors.md` — required by GDPR Art. 28
- **Who creates:** You (use a template like Termly or hire a lawyer briefly). AI can draft from templates but **you must review**.
- **Lifecycle:** A Next.js page renders each via MDX. Changes require version bumps and a notification to existing customers per GDPR.

---

## Top-level files inventory

| File | Status | Purpose |
|---|---|---|
| `README.md` | Create in Phase 0 | One-page intro: "What is AURA, how do I get started" |
| `CONTRIBUTING.md` | Phase 0 | Coding conventions, commit format, PR workflow |
| `SECURITY.md` | Phase 0 | How to report vulnerabilities (`security@<domain>`) |
| `LICENSE` | Phase 0 | Source-available or proprietary; pick one |
| `pnpm-workspace.yaml` | Exists | Already in repo |
| `package.json` | Exists | Already in repo |
| `turbo.json` | Create in Phase 0 | Turborepo pipeline |
| `.env.example` | Exists | Document every env var |
| `.gitignore` | Exists | Cover all dist/cache/secret patterns |
| `.nvmrc` | Phase 0 | Pin Node version |
| `.python-version` | Phase 0 | Pin Python version |
| `tsconfig.base.json` | Phase 0 | Shared TS config extended by all packages |
| `.editorconfig` | Phase 0 | Cross-editor whitespace consistency |
| `CLAUDE.md` (optional) | Anytime | Claude-specific agent conventions; the `/init` skill auto-creates |

---

## Folders that should NOT exist

Watch out — agents sometimes create these without prompting:

- `dist/` — should be gitignored (build output)
- `node_modules/` — gitignored
- `.next/` — gitignored
- `__pycache__/` — gitignored
- `.venv/` — gitignored
- `coverage/` — gitignored (output of test runs)
- `*.log` — gitignored
- `.env`, `.env.local`, `.env.production` — gitignored (only `.env.example` is committed)
- Any directory with secrets

Run `git status --ignored` periodically to confirm none accidentally tracked.

---

## Creation timeline summary

| When | Folders to ensure exist |
|---|---|
| Phase 0 | `.github/`, `infra/`, `scripts/`, `docs/` (empty), top-level files |
| Phase 1 | `packages/types-py/` (when codegen lands), `tests/` (placeholder) |
| Phase 3+ | `docs/architecture/`, `docs/decisions/` |
| Phase 5–6 | `design/email-templates/`, `legal/` |
| Phase 7 | `tests/e2e/`, `tests/load/`, `tests/multi-tenant/`, `docs/runbooks/` |
| Post-launch | `tools/aura-admin/`, `tools/cost-report/` |

---

## AI Agent Prompt Template (use to bootstrap missing folders)

