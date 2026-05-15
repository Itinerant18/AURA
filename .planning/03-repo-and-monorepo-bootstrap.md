# 03 — Repo and Monorepo Bootstrap

**Goal:** Initialize the Turborepo + pnpm workspace, lock dependency versions, and produce the skeleton folder structure described in Architecture doc §2.

**Prerequisite:** `02-gcp-bootstrap.md` complete.

**Time estimate:** ~6 hours (mostly waiting on installs and getting the first green CI run).

**Owner:** AI agent driving, you reviewing every commit.

> Note: parts of the monorepo scaffold already exist in this repo from the initial commit (`packages/db`, `packages/queue`, `packages/types`, `packages/utils`, `services/*/` placeholders). Treat this guide as the *acceptance bar* — confirm what's already there, fill gaps, and replace placeholder content where it doesn't match the spec below.

---

## Step 1 — Confirm the existing skeleton

Run a scan and confirm:

- [ ] `pnpm-workspace.yaml` exists at root and lists `apps/*`, `services/*`, `packages/*`
- [ ] `package.json` at root declares `"packageManager": "pnpm@<latest 9.x>"`
- [ ] `.env.example` exists at root and documents every env var that any service reads
- [ ] `.gitignore` covers `node_modules`, `.next`, `dist`, `__pycache__`, `.venv`, `.turbo`, `*.log`, `.env*` (but not `.env.example`)
- [ ] Existing packages compile: `pnpm install && pnpm -r build`

If any of the above fails, fix before moving on.

---

## Step 2 — Add `turbo.json` if missing

The architecture doc says Turborepo is the orchestrator. Required pipelines:

- `build` — depends on upstream packages' `build`
- `dev` — persistent, no cache
- `lint`
- `typecheck`
- `test` — outputs coverage
- `db:generate` — Prisma client generation, scoped to `packages/db`
- `db:migrate:dev` — local-only
- `docker:build` — per service, outputs to Artifact Registry

The exact `turbo.json` is content the AI agent will write — this guide just specifies *what* it needs to cover.

- [ ] `turbo.json` covers all pipelines above
- [ ] `pnpm turbo run build` succeeds across the empty skeleton

---

## Step 3 — Lock language versions

- [ ] `.nvmrc` at root → `20`
- [ ] `.python-version` at root → `3.12`
- [ ] All `package.json` files declare `"engines": { "node": ">=20" }`
- [ ] All Python services have `pyproject.toml` or `requirements.txt` pinning `python_requires = ">=3.12"`

---

## Step 4 — Standardize per-service structure

### Node.js services (auth, onboarding, review, publish, sheets, notification, billing)

Each service folder must contain:
- `package.json` — declares `start`, `dev`, `build`, `test`, `lint`
- `tsconfig.json` — extends a shared root `tsconfig.base.json`
- `src/index.ts` — Express app entry
- `src/routes/` — route handlers
- `src/middleware/` — JWT verify, tenant context, rate limit, error handler
- `src/services/` — business logic
- `src/models/` — Prisma-level data access (thin wrappers)
- `src/events/` — Pub/Sub publishers + subscribers
- `Dockerfile` — multi-stage build, distroless final image
- `.dockerignore`

### Python services (audit, competitor, strategy, content, analytics)

Each service folder must contain:
- `pyproject.toml` (managed by `uv`)
- `src/<service>/__init__.py`
- `src/<service>/main.py` — FastAPI app
- `src/<service>/routes/` — endpoint routers
- `src/<service>/dependencies/` — JWT, tenant context, DB session
- `src/<service>/events/` — Pub/Sub publishers + subscribers
- `src/<service>/<domain>/` — domain modules (e.g., `scoring/`, `chains/`, `generators/`)
- `tests/` with `conftest.py`
- `Dockerfile` — multi-stage, slim Python base, non-root user
- `.dockerignore`

---

## Step 5 — Shared packages

These already exist in the repo. Confirm or build out:

| Package | Purpose |
|---|---|
| `packages/db` | Prisma schema + generated client. Single source of truth for DB shape. |
| `packages/types` | Shared TypeScript types used across Node services and Next.js |
| `packages/queue` | Typed Pub/Sub event contracts + publisher/subscriber helpers |
| `packages/utils` | `encrypt.ts` (AES-256-GCM), `logger.ts` (structured JSON), `validator.ts`, `tenantContext.ts` |

For Python services, types are duplicated (Pydantic models). Build a small script (later, in `13-ci-cd-pipeline.md`) that codegens Pydantic models from the TypeScript types as a CI step.

- [ ] `packages/db/schema.prisma` exists and matches Architecture doc §3.2 table definitions
- [ ] `packages/types/` exports every interface that crosses a service boundary
- [ ] `packages/queue/events.ts` declares the 6 event payloads from Architecture doc §1.2
- [ ] `packages/utils/encrypt.ts` implements AES-256-GCM with key fetched from Secret Manager at runtime

---

## Step 6 — Frontend skeleton (`apps/web`)

Next.js 15+ with App Router.

- [ ] `apps/web/package.json` includes: `next`, `react`, `tailwindcss`, `next-auth` (or `@auth/nextjs`), `zustand`, `axios`, `react-hook-form`, `zod`
- [ ] Route groups created: `(dashboard)`, `(onboarding)`, `(review)`, `(public)`
- [ ] `src/lib/api-client.ts` — typed Axios client pointing at API Gateway
- [ ] `src/lib/auth.ts` — NextAuth config (email/password + Google OAuth)
- [ ] `src/components/ui/` — placeholder Button, Card, Modal, Badge
- [ ] `tailwind.config.ts` — design tokens (colors, spacing, typography) defined per brand
- [ ] Dockerfile builds a standalone Next.js server

---

## Step 7 — Local dev orchestration

- [ ] `infra/docker/docker-compose.yml` brings up: Postgres 16, Redis 7, the GCP Pub/Sub emulator, MinIO (S3-compatible substitute for GCS), and every service
- [ ] Single command: `pnpm dev:local` boots the full stack
- [ ] `.env.local.example` at root documents every var the local stack needs

---

## Step 8 — Root scripts

- [ ] `pnpm install` — installs all workspace deps + bootstraps Python venvs via `uv`
- [ ] `pnpm dev` — turbo dev for everything
- [ ] `pnpm build` — turbo build for everything
- [ ] `pnpm test` — turbo test
- [ ] `pnpm lint` — eslint (TS) + ruff (Python)
- [ ] `pnpm typecheck`
- [ ] `pnpm db:generate` — Prisma generate
- [ ] `pnpm db:migrate:dev` — Prisma migrate against local Postgres
- [ ] `pnpm dev:local` — boots Docker compose stack

---

## Step 9 — Git hooks

Use `husky` + `lint-staged`:
- [ ] Pre-commit: format staged files (prettier/ruff), lint
- [ ] Pre-push: typecheck + run affected tests via `turbo run test --filter='...[origin/main]'`
- [ ] Commit message convention: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)

---

## Step 10 — Initial CI green run

Even before any business logic, the repo must produce a green CI pipeline:
- [ ] GitHub Actions workflow `.github/workflows/test.yml` runs on PR
- [ ] Pipeline: install → lint → typecheck → test → build
- [ ] Passes on a no-op PR (e.g., a docs-only change)

This is the moment to stop and verify. If CI is red on an empty repo, every later phase is going to be painful.

---

## Definition of done

- [ ] `pnpm install` from a clean clone succeeds in <3 minutes
- [ ] `pnpm build` produces all 12 service Docker images locally
- [ ] `pnpm dev:local` brings up the full stack; every service responds 200 on `/health`
- [ ] CI green on a no-op PR
- [ ] Branch protection on `main`: require green CI, require 1 review (your review counts for solo)
- [ ] Tagged release `v0.0.1` on `main` marking "skeleton ready"

---

## AI Agent Prompt Template

```
You are bootstrapping the AURA monorepo skeleton.

CONTEXT:
- Read .planning/03-repo-and-monorepo-bootstrap.md fully
- Read DOSC/AURA_Architecture_CodeStructure.md §2 for the canonical folder structure
- The repo already has partial scaffolding — check git status and what exists in packages/ and services/ before creating new files
- Do NOT delete existing files without confirming with me first
- Do NOT implement business logic in this phase — only scaffolding, build wiring, and health-check stubs

DELIVERABLES (in this order):
1. Audit existing structure; produce a diff between what exists and what guide §3 requires
2. Propose fixes/additions; wait for my approval
3. Implement the fixes
4. Make `pnpm install` and `pnpm build` succeed
5. Make `pnpm dev:local` boot the full Docker stack with /health responses on all services
6. Open a PR titled "chore: monorepo skeleton bootstrap"

CONSTRAINTS:
- pnpm 9.x, Node 20 LTS, Python 3.12
- TypeScript strict mode everywhere
- No `any` types
- Distroless Docker images for final stages
- Every service must have /health and /ready endpoints returning 200 with JSON

STOP CONDITIONS — ask me before proceeding if:
- Any existing file would need to be overwritten with materially different content
- A package name in package.json would need to change
- You'd need to install a runtime dep >50 MB
```
