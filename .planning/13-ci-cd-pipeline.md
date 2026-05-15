# 13 — CI/CD Pipeline

**Goal:** Every PR runs lint + typecheck + tests + build. Every merge to `main` deploys staging. Prod deploys behind manual approval.

**Source:** Architecture doc §2.4 (`.github/workflows/`).

---

## GitHub Actions workflows

### `.github/workflows/test.yml` — on every PR

Triggers: `pull_request`, `push` to non-main branches.

Jobs (in parallel where possible):

| Job | Steps |
|---|---|
| `lint-node` | install pnpm, install deps, `pnpm lint` |
| `lint-python` | install uv, install deps, `ruff check`, `ruff format --check` |
| `typecheck` | `pnpm typecheck` |
| `test-node` | turbo test for Node packages, upload coverage |
| `test-python` | pytest for each Python service, upload coverage |
| `build-images` | docker build each service (no push), cache layers |
| `terraform-check` | `terraform validate`, `tflint`, `checkov`, `terraform plan` against staging state, post plan as PR comment |
| `prisma-check` | `prisma format`, `prisma validate`, ensure no uncommitted migrations |
| `openapi-check` | run each Node service briefly, fetch `/openapi.json`, diff against committed spec, fail if drift |
| `types-codegen-check` | run TS→Pydantic codegen, fail if generated output differs from committed |

Required to pass before merge.

---

### `.github/workflows/deploy-staging.yml` — on merge to main

Triggers: `push` to `main`.

Jobs (sequential):

1. **build-and-push** — build each service Docker image, tag with `git-sha`, push to GAR
2. **db-migrate** — run `prisma migrate deploy` against staging Cloud SQL
3. **terraform-apply** — apply staging Terraform with new image tags
4. **smoke-test** — run a small e2e suite against `staging.aura.app` (signup, audit kickoff, queue check)
5. **notify** — Slack post: ✅ staging deployed, sha `<short>`, services updated

Permissions:
- Uses `sa-cloudbuild-deployer` SA via Workload Identity Federation (no long-lived JSON keys)

---

### `.github/workflows/deploy-prod.yml` — manual

Triggers: `workflow_dispatch` (manual button) **or** tag push `v*.*.*`.

Jobs:
1. **require-approval** — environment `prod` with required reviewers (you)
2. **promote-images** — re-tag staging-tested images to `prod-<sha>` in GAR
3. **db-migrate-prod** — `prisma migrate deploy` against prod
4. **terraform-apply-prod** — apply prod TF with new image tags
5. **canary** — route 10% traffic to new revision for 10 min, watch error rate
6. **promote** — route 100% if error rate stayed below 0.5%
7. **rollback-on-fail** — auto-revert to previous revision if canary fails

---

### `.github/workflows/drift-detect.yml` — weekly

Sunday 03:00 IST. Runs `terraform plan` against staging + prod, opens an issue if drift detected.

---

### `.github/workflows/dependency-audit.yml` — daily

- `pnpm audit`
- `uv pip-audit` per Python service
- `gh dependabot` updates auto-merged for patch versions if CI passes; PRs for minors/majors

---

### `.github/workflows/lighthouse-budget.yml` — on PR if `apps/web` changed

Runs Lighthouse CI against a staging preview. Fails if scores below the budget in `10-frontend-build-guide.md`.

---

## Caching

- **pnpm:** `actions/cache@v4` keyed on `pnpm-lock.yaml` hash
- **uv:** cache keyed on `uv.lock` hash
- **Docker buildx:** layer cache stored in GAR via `--cache-to=type=registry`
- **Turborepo remote cache:** GCS-backed (one bucket: `gs://aura-turbo-cache`) so cache survives runner ephemera

---

## Secrets in CI

GitHub Actions secrets (organization level, scoped to the repo):
- `GCP_WORKLOAD_IDENTITY_PROVIDER` — for federated auth, no long-lived keys
- `GCP_SERVICE_ACCOUNT_STAGING` and `GCP_SERVICE_ACCOUNT_PROD`
- `SENTRY_AUTH_TOKEN` — for source map upload
- `SLACK_WEBHOOK_DEPLOY_NOTIFY`

Application secrets (Gemini, Stripe, etc.) never appear in CI — those live in Secret Manager and Cloud Run resolves them at runtime.

---

## Database migrations in CD

Migrations run **before** Cloud Run revisions deploy. Order:

1. Build new images (immutable)
2. Run `prisma migrate deploy` — adds new tables/columns
3. Deploy new revisions, route traffic gradually
4. If rollback needed: redeploy old image (which expects the old schema, but the new schema is a superset — additive migrations are safe)

**Rule:** every migration is additive-only until the deploy is green. Destructive migrations (drop column, rename) happen in a separate PR a deployment later, once code no longer references the old shape. This is the "expand → contract" migration pattern.

---

## Image build standards

Multi-stage Dockerfiles for every service:

Node:
1. `node:20-alpine` builder, install deps, build
2. Copy dist + node_modules into a `gcr.io/distroless/nodejs20-debian12` final stage
3. Run as non-root UID 1000
4. Healthcheck via `HEALTHCHECK` instruction or rely on Cloud Run probes

Python:
1. `python:3.12-slim` builder with build essentials
2. `pip install` into a venv
3. Copy venv into `gcr.io/distroless/python3-debian12` or `python:3.12-slim` final stage
4. Non-root user

Image size targets: <200 MB compressed for Node, <300 MB for Python.

---

## Deployment safety

- **Health probes:** every service responds 200 on `/health` (process up) and `/ready` (deps reachable). Cloud Run uses `/ready` for routing.
- **Graceful shutdown:** SIGTERM handler with 30-second drain (finish in-flight requests, drain Pub/Sub subscriptions)
- **Min revisions retention:** Cloud Run keeps 3 revisions so rollback is instant
- **Tagged revisions:** every deploy tags the revision with git-sha so we can route traffic precisely

---

## PR labels + automation

- `safe-to-merge` — auto-set when CI green + 1 approval; merge automatically
- `migration` — required label if `packages/db/migrations/` changed; adds a "manual DB review" check
- `infra` — required label if Terraform changed; routes plan to Slack `#infra-changes`
- `breaking-event-change` — required label if a Pub/Sub event payload's shape changed without bumping `version`

---

## Definition of done

- [ ] PR workflow green on a no-op change in <5 min
- [ ] Merge to main deploys staging in <10 min end-to-end
- [ ] Prod deploy requires manual approval and runs canary
- [ ] Lighthouse budget enforced for `apps/web`
- [ ] Drift detection cron runs weekly and creates an issue when it finds drift
- [ ] No long-lived GCP service account keys anywhere (Workload Identity Federation only)

---

## AI Agent Prompt Template

```
You are wiring AURA's CI/CD.

CONTEXT:
- Read .planning/13-ci-cd-pipeline.md
- Read .planning/12-infrastructure-terraform.md (CD applies it)
- Read .planning/04-database-schema-and-prisma.md (migrations run in CD)

DELIVERABLES IN ORDER:
1. test.yml — must pass against current main on first run
2. deploy-staging.yml — deploy a no-op change end-to-end successfully
3. deploy-prod.yml — set up the environment + approval gate
4. drift-detect.yml + dependency-audit.yml + lighthouse-budget.yml
5. Workload Identity Federation setup (gcloud commands for me to run)
6. Document the full pipeline in docs/operations/ci-cd.md

CONSTRAINTS:
- Workload Identity Federation, no JSON keys
- All workflows have explicit timeout (no unbounded jobs)
- All actions pinned to commit SHA (not version tag) for supply-chain safety
- Concurrency groups prevent overlapping prod deploys

ASK FIRST:
- Should we use GitHub-hosted runners or self-hosted GCE runners? (Recommend GitHub-hosted for MVP — simplicity wins)
- Should canary traffic be 10% or 5% for the first 10 min in prod? (Recommend 10% — easier to spot regression in low traffic)
- For the `prisma migrate deploy` step, do you want a separate manual "approve migration" gate? (Recommend YES for prod, NO for staging)
```
