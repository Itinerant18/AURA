# 04 — Database Schema and Prisma

**Goal:** Establish the single source of truth for the AURA database — every table from Architecture doc §3.2 modeled in Prisma, with strict multi-tenant safety, indexes, and a migration baseline.

**Prerequisite:** `02-gcp-bootstrap.md` (Cloud SQL exists), `03-repo-and-monorepo-bootstrap.md` (`packages/db` skeleton exists).

**Owner:** AI agent; you review the schema and the migration.

**Time estimate:** 1 day.

---

## Step 1 — Verify what's already there

The repo already has `packages/db/schema.prisma`. Before any changes:
- [ ] Diff the existing schema against Architecture doc §3.2
- [ ] Document deltas in a comment in this file or in a `_schema-audit.md` note
- [ ] Get your approval before editing

---

## Step 2 — Tables in scope (from Architecture doc §3.2)

| Table | Status |
|---|---|
| `tenants` | required |
| `users` | required |
| `business_profiles` | required |
| `social_accounts` | required |
| `audit_reports` | required |
| `competitor_reports` | required |
| `content_calendars` | required |
| `content_posts` | required |
| `post_analytics` | required |

Plus the following operational tables not in the architecture doc but needed for MVP:

| Table | Purpose |
|---|---|
| `oauth_states` | Short-lived OAuth state tokens (CSRF protection during social connect) |
| `outbox_events` | Transactional outbox for Pub/Sub publishing (avoids dual-write inconsistency) |
| `processed_events` | Idempotency table — record event IDs already processed by each subscriber |
| `audit_log` | Cross-tenant action audit trail (admin operations, billing changes) |
| `webhook_events` | Inbound webhook events from Stripe, Meta (for replay/debugging) |
| `subscription_events` | Stripe subscription lifecycle events (created, canceled, payment_failed) |
| `review_actions` | Reviewer decisions per post (approve/reject/modify) with timestamp + reviewer_id |
| `publish_attempts` | One row per attempt to publish a post; tracks retries and platform errors |

---

## Step 3 — Multi-tenancy enforcement strategy

Two layers of defense:

### Layer A — ORM-level (Prisma middleware)
Every Prisma query gets a `where: { tenantId: ctx.tenantId }` injected by middleware. Implementation:

- A `tenantContext` AsyncLocalStorage value set by the JWT middleware on every request
- Prisma middleware reads it and rejects any query that touches a tenant-scoped table without setting `tenantId`
- Tables explicitly **not** tenant-scoped (e.g., `oauth_states` keyed by state token, `webhook_events` global): annotated as such

### Layer B — PostgreSQL Row-Level Security (RLS)
For MVP: **defined but not enforced** (i.e., write the RLS policies but keep `FORCE ROW LEVEL SECURITY` off until Phase 1.5). This is because RLS can mask Prisma migration issues during a fast build. We'll harden in Phase 1.5.

- Every tenant-scoped table gets an RLS policy: `tenant_id = current_setting('app.tenant_id')::uuid`
- The Postgres role `aura_app` will get `BYPASSRLS` privilege for MVP (revoked in Phase 1.5)
- A separate `aura_reader` role for analytics will *not* bypass RLS

---

## Step 4 — Indexing strategy

Mandatory indexes:
- Every `tenant_id` column → b-tree index
- Composite `(tenant_id, <hot column>)` for known query paths:
  - `audit_reports(tenant_id, generated_at DESC)`
  - `content_posts(tenant_id, calendar_date)`
  - `content_posts(tenant_id, status)`
  - `content_posts(scheduled_for) WHERE status = 'approved'` — partial index for publish scheduler
  - `post_analytics(post_id, recorded_at DESC)`
  - `social_accounts(tenant_id, platform)` — unique constraint already
- Foreign keys: index every FK column (Prisma doesn't auto-index FKs in PG)
- `users(email)` — already unique
- `webhook_events(provider, external_event_id)` — unique, for idempotency

JSONB indexes (GIN):
- `business_profiles.menu_items` — searchable for content engine
- `audit_reports.scores` — frequent dashboard reads

---

## Step 5 — Soft deletes

For MVP, no soft deletes. Hard deletes only. Two exceptions:
- `content_posts.status = 'rejected'` — keep the row, marked rejected
- Cancellation: tenant rows get `is_active = false` but are not deleted

---

## Step 6 — Token encryption

OAuth tokens (`social_accounts.access_token`, `refresh_token`) are stored encrypted with AES-256-GCM. The cipher is implemented in `packages/utils/encrypt.ts`. The DB stores the ciphertext as TEXT. The encryption key is fetched from Secret Manager at service boot (`db-encryption-key` secret) and never logged.

- [ ] `encrypt.ts` exposes `encrypt(plaintext: string): string` and `decrypt(ciphertext: string): string`
- [ ] Output format: `v1:<base64-nonce>:<base64-ciphertext>` so we can rotate keys later
- [ ] Unit tests cover round-trip + tampered ciphertext rejection

---

## Step 7 — Migrations

- [ ] Single baseline migration named `000_init` containing all tables, indexes, RLS policies
- [ ] All later migrations are forward-only (no destructive drops without an explicit ADR)
- [ ] Migrations run via `prisma migrate deploy` in CI before deployment
- [ ] Staging migrates first; prod is gated by a manual approval

---

## Step 8 — Seed data (local + staging)

`packages/db/seed.ts` populates:
- 3 demo tenants (Starter / Growth / Agency tier examples)
- 1 user per tenant (`owner@demo-<tier>.aura.dev`)
- A pre-filled business profile for one tenant ("Brewhaus Cafe" from PRD §3.1)
- Mock OAuth-linked social_accounts (with fake encrypted tokens) so audit/content services can be tested without real social logins

Seed runs:
- Always in local dev
- Optionally in staging (`pnpm db:seed:staging`)
- **Never** in prod

---

## Step 9 — Backup + recovery

- [ ] Cloud SQL automated daily backups (already configured in `02-gcp-bootstrap.md`)
- [ ] Point-in-time recovery enabled
- [ ] Document the restore drill in `17-launch-runbook.md`
- [ ] Quarterly drill: restore latest backup to a throwaway instance, verify integrity

---

## Definition of done

- [ ] `packages/db/schema.prisma` matches Architecture doc §3.2 plus operational tables in Step 2
- [ ] `prisma migrate dev` succeeds locally against the Docker Compose Postgres
- [ ] `prisma migrate deploy` succeeds against staging Cloud SQL
- [ ] Prisma client generation works: `pnpm db:generate`
- [ ] Tenant-context middleware exists in `packages/utils` and is referenced by at least one service
- [ ] Seed script populates 3 tenants successfully
- [ ] RLS policies defined (but `FORCE` disabled for MVP)

---

## AI Agent Prompt Template

```
You are implementing the AURA database schema.

CONTEXT:
- Read .planning/04-database-schema-and-prisma.md
- Read DOSC/AURA_Architecture_CodeStructure.md §3 (every table definition)
- The repo already has packages/db/schema.prisma — diff against the architecture doc first

DELIVERABLES:
1. Audit existing schema.prisma vs the architecture doc; report deltas
2. Wait for my approval on the proposed changes
3. Write the consolidated schema.prisma covering all 9 core tables + 8 operational tables listed in guide Step 2
4. Generate a single baseline migration: prisma migrate dev --name init
5. Implement packages/utils/encrypt.ts (AES-256-GCM, format v1:<nonce>:<ciphertext>)
6. Implement packages/utils/tenantContext.ts (AsyncLocalStorage holding {tenantId, userId, role})
7. Write Prisma middleware that auto-injects tenantId WHERE clauses and rejects unscoped queries on tenant tables
8. Write packages/db/seed.ts populating 3 demo tenants
9. Open a PR titled "feat(db): full schema + multi-tenant safety"

CONSTRAINTS:
- All UUID PKs use gen_random_uuid()
- All timestamps are TIMESTAMPTZ
- All tenant-scoped tables have idx_<table>_tenant index
- No DELETE cascades except tenants → users (per architecture doc)
- RLS policies defined for all tenant tables but FORCE ROW LEVEL SECURITY remains OFF

QUESTIONS TO RAISE BEFORE STARTING:
- Are there enum types you want (e.g., post status) in Prisma rather than VARCHAR?
- Any tables you'd like me to add that aren't in the architecture doc or this guide?
- Confirm encryption key rotation strategy: support multiple key versions (v1, v2) in encrypt.ts from day 1?
```
