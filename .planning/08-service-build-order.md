# 08 — Service Build Order

**Goal:** Define the exact order to build the 12 microservices, the dependencies between them, and which services can be built in parallel by different AI agents.

**Prerequisite:** `04`, `05`, `06`, `07` all complete.

**Owner:** You orchestrating; agents implementing.

**Time estimate:** This document drives Phases 2–6 of the 8-week plan.

---

## Build order (the DAG)

```
auth-service ─┐
              ├─→ onboarding-service ─→ sheets-service ─┐
              │                                          │
              ├─→ audit-service ──┐                      │
              │                   │                      │
              ├─→ competitor-svc ─┤                      │
              │                   ▼                      │
              │             strategy-service ─→ content-service ─→ review-service ─→ publish-service
              │                                          │
              ├─→ billing-service                        │
              ├─→ notification-service ──────────────────┘
              └─→ analytics-service (last; depends on publish output)
```

> Edges = "must call into" or "consumes an event from". Notification-service consumes events from every pipeline stage; build it after the core pipeline so the right events exist.

---

## Phase-by-phase sequencing (mapped to the 8-week roadmap)

### Phase 1 (Week 1) — Foundation
1. **auth-service** — JWT issuance + verification, OAuth2 dance for social platforms, user/session models. Every other service depends on this.

### Phase 2 (Week 2) — Onboarding shell
2. **onboarding-service** — business profile CRUD, social account linking handoff (it calls auth-service to start the OAuth flow), reads audit/competitor status for the onboarding UI
3. **sheets-service** — calendar + analytics export. Started early because the Google OAuth scope overlaps with onboarding social-connect flow.

### Phase 3 (Weeks 2–3) — Intelligence layer
4. **audit-service** — fetch social data via Meta/LinkedIn/Twitter APIs, score 9 dimensions, generate PDF, publish `audit.completed`
5. **competitor-service** — discover via Places API + scrape, generate prose via Gemini Pro, publish `competitor.report.ready`

> 4 and 5 can be built **in parallel** by two agents — they share no code and consume nothing from each other.

### Phase 4 (Weeks 3–4) — Generation layer
6. **strategy-service** — consume `audit.completed` + `competitor.report.ready`, generate strategy + 30-day calendar via Gemini Pro + LangChain, publish `strategy.generated`
7. **content-service** — consume `strategy.generated`, generate caption + hashtags + image per slot, publish `post.ready` per post

### Phase 5 (Weeks 4–5) — Review and publish
8. **review-service** — consume `post.ready`, expose review queue API, handle approve/reject/modify (modify re-calls content-service), publish `post.approved`
9. **publish-service** — consume `post.approved`, schedule + execute IG and FB publishes, publish `post.published`

### Phase 6 (Weeks 5–6) — Supporting services
10. **analytics-service** — consume `post.published`, schedule polling of platform analytics endpoints, populate `post_analytics`
11. **notification-service** — consumes every pipeline event, sends emails for major milestones (audit ready, strategy ready, review pending, publish complete, publish failed)
12. **billing-service** — Stripe subscription lifecycle, webhook handler, plan enforcement middleware exposed for other services to call

---

## Parallelization opportunities

Across phases, multiple AI agents can run in parallel on these pairs:

- **Phase 3:** audit-service + competitor-service (different agents)
- **Phase 4:** while content-service is being built, the frontend agent can build the calendar UI (`apps/web/(dashboard)/calendar`)
- **Phase 5:** while review-service is being built, another agent can wire publish-service's Meta API client (which is a self-contained module)
- **Phase 6:** analytics + notification + billing can all run in parallel — they share only the shared packages

If you have 4 AI agents available, you can dispatch them simultaneously on these tracks.

---

## Skeleton checklist per service

Before any service starts business logic, the agent must produce this skeleton:

- [ ] Folder structure matches Architecture doc §2.2
- [ ] `package.json` (or `pyproject.toml`) declares deps
- [ ] Dockerfile builds, image runs, container exits 0 on missing config (good signal)
- [ ] `src/index.ts` (or `main.py`) starts an HTTP server on PORT (default 8080)
- [ ] `/health` returns 200 with `{ status: 'ok', service: '<name>', version: '<git-sha>' }`
- [ ] `/ready` returns 200 only when DB + Redis + Pub/Sub are reachable
- [ ] JWT middleware verifies tokens against auth-service's JWKS
- [ ] Tenant-context middleware injects `tenantId` into Prisma queries
- [ ] Structured logger from `packages/utils` is wired
- [ ] Sentry initialized
- [ ] OpenAPI spec at `/openapi.json` (Node services via `zod-to-openapi`; Python services via FastAPI built-in)

Once the skeleton is green, the agent can start on the service-specific spec from `09-service-specs/`.

---

## Cross-service contract review gate

After auth-service and onboarding-service are complete, **pause for a contract review**:
- All JWT claims are documented
- The tenant-context middleware in `packages/utils` works in both Node and is mirrored correctly in Python (audit-service is the first Python service — verify here)
- OAuth flow end-to-end works for at least Instagram

Do not start audit-service until this gate passes. It will save days of rework.

---

## Definition of done for this phase

- [ ] Every service has its skeleton checklist green
- [ ] Service order in this document is the documented build order in `19-phase-gate-checklists.md`
- [ ] Each service's owner (you-via-agent) is noted in a tracking doc

---

## AI Agent Prompt Template (for assigning a service to an agent)

```
You are building the <SERVICE-NAME> microservice for AURA.

CONTEXT:
- Read .planning/08-service-build-order.md to understand where this service fits
- Read .planning/09-service-specs/<n>-<service>.md for the full spec
- Read DOSC/AURA_PRD.md (the module this service implements)
- Read DOSC/AURA_Architecture_CodeStructure.md §2.2 for code structure conventions

DELIVERABLES:
1. Produce the skeleton checklist items (8 of them) in the service folder
2. STOP and ping me for review before implementing business logic
3. Implement the routes/handlers/events per the service spec
4. Write unit tests for every route handler
5. Write an integration test that exercises the happy path with the local Docker stack
6. Open a PR titled "feat(<service>): <one-line summary>"

PARALLEL WORK WARNING:
- This service may be built in parallel with <other-service>. They share packages/ and packages/types — pull from main and rebase frequently.
- Coordinate any changes to shared packages with me first.

CONSTRAINTS:
- Service contracts (events, public API) must match the spec exactly
- No untyped any/dict-of-anything in public APIs
- All Pub/Sub publishes go through the outbox helper
- All consumers must be idempotent
```
