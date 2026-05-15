# 05 — Shared Packages

**Goal:** Define the four shared packages that every service depends on, so contracts and helpers are written once and reused everywhere. This prevents drift between services in a 12-service monorepo.

**Prerequisite:** `03-repo-and-monorepo-bootstrap.md`, `04-database-schema-and-prisma.md`.

**Owner:** AI agent; you review every public export.

**Time estimate:** 1 day.

---

## Package inventory

| Package | Language | Consumers | Status |
|---|---|---|---|
| `packages/db` | TS (Prisma) | Every Node service | Schema source of truth |
| `packages/types` | TS | Every Node service + `apps/web` | Cross-service type contracts |
| `packages/queue` | TS | Every Node service + Python services (via JSON Schema export) | Typed Pub/Sub events |
| `packages/utils` | TS | Every Node service + `apps/web` | Encryption, logging, tenant context, validators |

Python services don't import these directly. Instead, the CI pipeline (see `13-ci-cd-pipeline.md`) generates equivalent Pydantic models from the TS types so Python stays in sync.

---

## 1. `packages/db`

### Responsibilities
- Holds `schema.prisma`
- Holds all migrations under `migrations/`
- Exports a singleton `PrismaClient` instance
- Exports `withTenant(tenantId, callback)` helper for transactional tenant-scoped operations

### Public exports
- `prisma` — the singleton
- `prismaConnect()` / `prismaDisconnect()` — lifecycle hooks
- `withTenant<T>(tenantId: string, fn: (tx) => Promise<T>): Promise<T>` — runs `SET LOCAL app.tenant_id = $1` inside a transaction
- All Prisma-generated model types (re-exported under `Models`)

### Build
- Output: ESM + CJS dual build
- `db:generate` step runs before `build`

---

## 2. `packages/types`

### Responsibilities
- TypeScript interfaces that describe API request/response payloads, domain entities, and DTOs that cross service boundaries
- **No runtime code** — types only
- Mirrored to Pydantic models in Python services via CI codegen

### Files (already partially scaffolded in repo)
- `api.ts` — request/response shapes for every HTTP endpoint
- `audit.ts` — `AuditReport`, `AuditScores`, `AuditInsight`, `AuditDimension`
- `business.ts` — `BusinessProfile`, `MenuItem`, `BrandVoice`, `TargetAudience`
- `competitor.ts` — `CompetitorReport`, `CompetitorMetrics`, `ProsConsMatrix`
- `events.ts` — re-exports from `packages/queue/events`
- `post.ts` — `ContentPost`, `ContentPostStatus`, `PostAnalytics`
- `social.ts` — `SocialAccount`, `SocialPlatform`, `OAuthTokenSet`
- `strategy.ts` — `ContentCalendar`, `StrategyPlan`, `ContentPillar`, `KPI`
- `tenant.ts` — `Tenant`, `TenantPlan`, `TenantContext`
- `user.ts` — `User`, `UserRole`, `Session`

### Conventions
- All exports are `interface` or `type` (no `class`, no `enum` — use string literal unions)
- Discriminated unions for variants (e.g., post types: `image | carousel | reel | story`)
- Branded types for IDs: `type TenantId = string & { __brand: 'TenantId' }`
- No `any`, no `unknown` in exports — every shape is precise

---

## 3. `packages/queue`

### Responsibilities
- The 6 Pub/Sub event contracts from Architecture doc §1.2
- Typed publisher + subscriber wrappers around `@google-cloud/pubsub`
- Idempotency helper (writes to `processed_events` table before processing)
- Dead-letter queue routing

### Event contracts (`events.ts`)

```text
- AuditCompleted        — from audit-service        → strategy-service
- CompetitorReportReady — from competitor-service   → strategy-service
- StrategyGenerated     — from strategy-service     → content-service
- PostReady             — from content-service      → review-service
- PostApproved          — from review-service       → publish-service
- PostPublished         — from publish-service      → analytics-service
```

Each event payload includes at minimum:
- `eventId` (UUID, idempotency key)
- `eventType` (string literal)
- `tenantId`
- `occurredAt` (ISO 8601)
- `version` (semver string for the payload schema)
- `payload` (domain-specific fields)

### Publisher API
```text
publishEvent<T>(topic: TopicName, event: T): Promise<MessageId>
```
- Auto-wraps the event with `eventId`, `occurredAt`, `version`
- Writes to `outbox_events` table inside the caller's DB transaction; a separate worker (in publish-service or a dedicated relay) ships the row to Pub/Sub. This is the transactional outbox pattern.

### Subscriber API
```text
subscribeEvent<T>(topic: TopicName, subscription: SubscriptionName, handler: (event: T) => Promise<void>)
```
- Auto-handles idempotency: checks `processed_events` before calling handler, inserts row after success
- Auto-acks on success, nacks on thrown exception
- Routes permanent failures to `aura.deadletter` after N retries (default 5)

### Pub/Sub emulator support
- In local dev, helpers detect `PUBSUB_EMULATOR_HOST` and connect there
- No code differences between local and prod

---

## 4. `packages/utils`

### Responsibilities
- `encrypt.ts` — AES-256-GCM, key from Secret Manager, format `v1:<nonce>:<ciphertext>`
- `logger.ts` — structured JSON logger (pino). Auto-includes `tenantId`, `traceId`, `service` from context. Output goes to stdout for Cloud Logging.
- `tenantContext.ts` — AsyncLocalStorage wrapper. `runWithTenant(ctx, fn)`, `getTenantContext()`, `requireTenantContext()`
- `validator.ts` — Zod schemas for common shapes (`email`, `uuid`, `url`, `phone`, `socialPlatform`)
- `errors.ts` — `AuraError` base, plus `AuthError`, `ValidationError`, `TenantIsolationError`, `ExternalServiceError`, `RateLimitError`
- `http.ts` — small Express middleware kit: error handler, async wrapper, request logger
- `secrets.ts` — `getSecret(name): Promise<string>` with in-memory caching (TTL 1 hour)
- `trace.ts` — propagates W3C `traceparent` header across HTTP + Pub/Sub
- `feature-flags.ts` — basic env-var feature flag reader (we are not adding a flag SaaS for MVP)

### Conventions
- Every utility is independently testable
- Zero dependencies on other AURA packages (utils is a leaf)
- Strict null checks; no `null` returns where `Result<T, E>` makes more sense

---

## Python parity (codegen)

In `scripts/codegen-pydantic/` (created in CI/CD phase), a small Node script reads `packages/types/*.ts` and emits Python Pydantic v2 classes into `packages/types-py/`. Python services depend on `packages/types-py` as a local source dependency (via uv workspace).

Run order:
1. Edit `packages/types/foo.ts`
2. CI runs `pnpm types:gen-py`
3. Output reviewed in PR diff
4. Python services pick up new models on next deploy

For MVP simplicity, codegen is **CI-only** — never auto-runs locally. This makes the TS source authoritative and prevents accidental Python edits that drift.

---

## Definition of done

- [ ] All four packages build with `pnpm build`
- [ ] `packages/db` exports `prisma`, `withTenant`, model types
- [ ] `packages/types` exports every contract listed in Section 2 with no `any`
- [ ] `packages/queue` events.ts declares all 6 events with full payload types
- [ ] `packages/queue` publisher writes to `outbox_events`; a `relayOutbox()` helper exists for the relay worker
- [ ] `packages/utils` covers encrypt, logger, tenantContext, validator, errors, secrets, trace, http
- [ ] Every package has unit tests (target: >80% coverage in utils, 100% on encrypt/tenantContext)
- [ ] Pydantic codegen script exists and produces valid Python from the current TS types
- [ ] Documentation: each package has a `README.md` with quickstart + public API

---

## AI Agent Prompt Template

```
You are implementing the AURA shared packages.

CONTEXT:
- Read .planning/05-shared-packages.md
- Read .planning/04-database-schema-and-prisma.md
- Read DOSC/AURA_Architecture_CodeStructure.md §1.2 (events) and §2.3 (packages)
- Existing skeleton in packages/db, packages/types, packages/queue, packages/utils — audit before editing

DELIVERABLES:
1. Audit existing packages; report what's present vs. needed
2. Wait for my approval
3. Implement each package per the guide's "Responsibilities" + "Public exports"
4. Unit tests for every utility (Vitest)
5. Pydantic codegen script (Node, outputs to packages/types-py/)
6. README.md per package
7. Single PR titled "feat(shared): types, events, db, utils"

CONSTRAINTS:
- No `any` or `unknown` in public exports
- All public APIs documented with JSDoc
- packages/utils has zero deps on other AURA packages
- packages/queue's outbox helper must work inside a Prisma transaction passed in by the caller
- encrypt.ts format is locked to "v1:<base64-nonce>:<base64-ciphertext>" for forward-compat

ASK BEFORE PROCEEDING:
- Pino vs. Winston vs. plain console for the logger? (Recommend pino)
- Zod vs. Valibot for validator? (Recommend Zod for ecosystem)
- Pydantic v1 or v2 codegen target? (Recommend v2)
```
