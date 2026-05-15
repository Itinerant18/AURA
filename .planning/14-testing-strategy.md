# 14 — Testing Strategy

**Goal:** A pragmatic testing pyramid for a 12-service monorepo built fast. Each test type has a clear purpose, scope, and target investment.

---

## The pyramid (target distribution)

```
              ┌──────────┐   ~5%
              │   e2e    │   end-to-end, real services
              └──────────┘
            ┌──────────────┐   ~15%
            │  integration │   service + DB + redis + pubsub emulator
            └──────────────┘
        ┌─────────────────────┐   ~30%
        │    component        │   route handler + DB
        └─────────────────────┘
   ┌───────────────────────────┐   ~50%
   │           unit            │   pure functions, adapters with mocks
   └───────────────────────────┘
```

Aim for **80% test code, 20% effort** on unit, and the inverse on e2e (each e2e test is expensive to write and slow to run).

---

## 1. Unit tests

**Scope:** A single function or class. No I/O. No real time.

**Tools:**
- Node: **Vitest** (jest-compatible, fast)
- Python: **pytest** + `pytest-mock`

**What to test:**
- Pure logic: scoring algorithms in audit-service, slot count math in strategy, completeness scoring in onboarding, retry backoff math in publish
- Adapters with mocked HTTP: every external API adapter
- Validators, formatters, parsers

**Coverage target:** 80% lines, 75% branches per service (Python AI/ML services can hit lower).

---

## 2. Component tests (service-level)

**Scope:** A single service's route handler with real Prisma against Postgres + real Pub/Sub emulator.

**Tools:**
- Node: Vitest + supertest + testcontainers (or rely on `docker compose -f infra/docker/test.yml`)
- Python: pytest + httpx test client + testcontainers
- Database: real Postgres in container; reset per test or per file via Prisma reset

**What to test:**
- Happy path for every route
- Validation errors return correct shape
- Tenant isolation: a request scoped to tenant A cannot read tenant B's data
- Idempotency: replaying a Pub/Sub event does not double-process

**Pattern:**
- Each service has `tests/component/<route>.test.ts`
- Setup creates a test tenant + user, gets a JWT
- Tear-down truncates tables (within the test transaction, so safe)

---

## 3. Integration tests (cross-service via events)

**Scope:** Two services + Pub/Sub emulator. Verify event contracts.

**Tools:** docker-compose for the full stack, Playwright API tests OR pytest with real HTTP clients.

**Examples:**
- audit-service publishes `audit.completed` → strategy-service receives it and updates `pending_strategy_runs`
- review-service approves a post → publish-service receives `post.approved` and creates a BullMQ job
- content-service consumes `strategy.generated` → enqueues N Cloud Tasks (use emulator) → each produces a content_post

**Coverage target:** at least one test per event in `06-event-bus-pubsub-map.md`.

---

## 4. E2E tests

**Scope:** Real browser, real backend, real database. Runs against staging URL.

**Tool:** **Playwright** (Node).

**Critical paths (must pass before any prod deploy):**
1. **Signup → Onboarding → Audit ready** — new tenant signs up, completes onboarding with sandboxed social account, audit completes and appears in UI
2. **Strategy → Calendar → Review queue** — strategy generated, calendar visible, post appears in review queue
3. **Approve → Publish** — reviewer approves a post, publish-service publishes to sandbox IG, status flips to Published
4. **Stripe checkout** — pick a plan, complete test-mode Stripe checkout, tenant becomes active
5. **Stripe webhook** — simulate payment_failed event, verify tenant enters grace period

Each E2E test runs against staging in CI on every merge to main and in CD before prod deploy.

---

## 5. Contract tests

**Scope:** API + event payload shapes must match what consumers expect.

**Tool:** **Pact** or simpler: schema diff against committed JSON Schema.

**What to test:**
- OpenAPI specs from each service are committed; diff in CI catches accidental shape changes
- Event payload Pydantic/Zod schemas are exported as JSON Schema; consumers depend on the schema, not the producer

This is a Phase 1.5 nice-to-have. For MVP, the `openapi-check` step in CI provides 70% of the value.

---

## 6. Load + performance tests

**Scope:** Confirm we hit PRD §6 SLAs.

**Tool:** **k6**.

**Scenarios:**
- 100 concurrent audit kickoffs (target: all complete in <4h)
- 60 concurrent post publishes (target: all complete in <2 min)
- API gateway: 100 req/min/user with no degradation

Run **once** before launch (Phase 7). Re-run quarterly thereafter.

---

## 7. Visual regression (frontend)

**Scope:** Component library snapshots.

**Tool:** Playwright's built-in screenshot diffs OR Chromatic.

Run on every PR that touches `apps/web/components/`. 5% pixel diff tolerance default.

---

## 8. Security tests

- **SAST:** `semgrep` rules for Node + Python in CI
- **Dependency scanning:** `pnpm audit`, `uv pip-audit`, GitHub Dependabot
- **Container scanning:** GAR built-in vulnerability scanning
- **Secrets scanning:** `gitleaks` pre-commit and in CI
- **DAST:** OWASP ZAP scan against staging weekly (Phase 1.5 nice-to-have)

See also `16-security-checklist.md`.

---

## 9. Multi-tenancy tests (CRITICAL)

A dedicated test suite that **must pass** before any prod deploy:

For each tenant-scoped table:
1. Create two tenants, A and B
2. Insert data as A
3. Authenticate as B
4. Attempt to read A's data via every API that exposes it → must return 404 or empty
5. Attempt to write to A's IDs as B → must return 403
6. SQL inject attempt with A's tenant ID → must be rejected by the tenant middleware

This suite is the safety net against the worst-case bug in a multi-tenant SaaS.

---

## 10. Smoke tests in CD

After each staging deploy, a tiny suite runs:
- `/health` returns 200 on every service
- `/ready` returns 200 on every service
- A canary tenant in staging can complete a fake onboarding step
- One Pub/Sub event publishes successfully

Total time: < 60 seconds. Blocks the pipeline if it fails.

---

## Test data management

- Fixtures live in `tests/fixtures/` per service (golden JSON, sample images, fake OAuth tokens)
- Faker-style data: `faker-js`, `pytest-faker`
- No PII in any fixture
- A small Indian-SMB-style dataset (Bangalore cafe, Mumbai salon, Delhi gym) used across services for realistic testing

---

## CI integration

| Pipeline stage | Test types run | Time budget |
|---|---|---|
| PR — every push | unit, component, openapi-check, types-codegen | < 8 min |
| Merge to main | all of above + integration + smoke after staging deploy | < 15 min |
| Pre-prod | all of above + E2E + multi-tenancy | < 25 min |
| Nightly | load (smaller scale), security (full scan) | < 1 hour |
| Weekly | DAST against staging, drift detection | < 2 hours |

---

## Definition of done (per service)

- [ ] Coverage ≥ target (80% Node, 70% Python)
- [ ] Every public route has a happy-path component test
- [ ] Every event consumer has an idempotency test
- [ ] Every external API adapter has unit tests with mocked HTTP

## Definition of done (overall MVP)

- [ ] All 5 critical E2E paths pass against staging
- [ ] Multi-tenancy suite passes (cannot leak across tenants)
- [ ] Load test confirms PRD §6 SLAs
- [ ] One full security scan completed with all high/critical findings remediated
- [ ] CI test stage runs in <8 min on average

---

## AI Agent Prompt Template

```
You are improving test coverage for a specific service in AURA.

Tell me which service first.

Read:
- .planning/14-testing-strategy.md
- .planning/09-service-specs/<n>-<service>.md (especially the "Testing" section)

DELIVERABLES:
1. Coverage report for the current state of the service
2. Test plan: which gaps you'll fill, sorted by risk
3. Implement unit tests for highest-risk gaps first
4. Implement component tests for every public route
5. Implement one integration test that covers the service's primary event flow
6. PR titled "test(<service>): coverage push from X% to Y%"

CONSTRAINTS:
- No tests that depend on real external APIs (mock everything except DB and Pub/Sub emulator)
- No flaky tests — if a test ever fails non-deterministically, delete it and write a deterministic one
- Tests must run in <30s individually; longer tests should be split or moved to integration suite

ASK FIRST:
- Are there specific bugs you've hit in this service that I should write regression tests for first?
```
