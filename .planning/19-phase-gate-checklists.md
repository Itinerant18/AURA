# 19 — Phase Gate Checklists

**Goal:** A Definition of Done for every phase. You are the phase gate — agents don't move forward until you check every box.

Treat each list as an executable contract. If a box is unchecked, the phase is not done, even if the calendar disagrees.

---

## Phase 0 — Prep (Week 0)

Scope: accounts, keys, GCP project, repo bootstrap.

- [ ] All accounts and API keys from `01-prerequisites-and-accounts.md` are live
- [ ] GCP staging + prod projects exist, billing active, asia-south1 default
- [ ] All APIs enabled per `02-gcp-bootstrap.md`
- [ ] All service accounts created
- [ ] Both Terraform state buckets exist with versioning
- [ ] Artifact Registry created in both projects
- [ ] Secret Manager skeleton exists (empty secrets defined)
- [ ] Cloud SQL instances created (staging + prod), private IP only
- [ ] Memorystore Redis created in both
- [ ] All Cloud Storage buckets created
- [ ] All 8 Pub/Sub topics created
- [ ] Monorepo skeleton green: `pnpm install`, `pnpm build`, `pnpm dev:local` all work
- [ ] CI green on a no-op PR
- [ ] Meta app review submitted (acknowledge approval will come later)
- [ ] Stripe India onboarding submitted

**Sign-off:** Date you check this: _________

---

## Phase 1 — Foundation (Week 1)

Scope: shared packages + data layer + event bus + auth-service.

### Data layer
- [ ] `packages/db/schema.prisma` matches Architecture doc §3.2 plus operational tables
- [ ] Single baseline migration `000_init` applies clean to staging Cloud SQL
- [ ] Prisma client generates and is consumed by at least one service
- [ ] Seed script populates 3 demo tenants

### Shared packages
- [ ] `packages/types` exports all cross-service contracts
- [ ] `packages/queue` events typed; publisher writes to outbox
- [ ] `packages/utils` covers encrypt, logger, tenantContext, validator, errors, secrets, trace, http
- [ ] Unit tests for utils > 80% coverage

### Event bus
- [ ] All 6 pipeline topics + DLQ + audit-log created in staging via Terraform
- [ ] Push subscriptions verify OIDC tokens
- [ ] Outbox relay running on a 30s Cloud Scheduler tick
- [ ] One end-to-end emulator test: publish `audit.completed` → strategy-service stub receives

### auth-service
- [ ] All 10 routes implemented + tested per `09-service-specs/01-auth-service.md`
- [ ] JWKS endpoint reachable
- [ ] Argon2id passwords
- [ ] OAuth flow for Meta works end-to-end in staging (with sandbox app)
- [ ] Coverage > 80%

### Frontend (parallel)
- [ ] `apps/web` shell exists
- [ ] `/login`, `/signup` routes wired to auth-service
- [ ] Lighthouse score on `/` ≥ 80

**Sign-off:** Date: _________

---

## Phase 2 — Onboarding + Sheets (Week 2)

### onboarding-service
- [ ] All 11 routes implemented per `09-service-specs/02-onboarding-service.md`
- [ ] Completeness scoring formula documented in code
- [ ] `onboarding.completed` event reaches an audit-service stub
- [ ] File upload via signed URL works
- [ ] Coverage > 80%

### sheets-service
- [ ] All 3 public routes implemented per `09-service-specs/09-sheets-service.md`
- [ ] Google OAuth + token refresh works
- [ ] Test: spreadsheet created in a test Google account, 30 rows written
- [ ] Coverage > 80%

### Frontend
- [ ] Onboarding flow steps 1–6 wired
- [ ] Settings → Social Connections page wired
- [ ] One full E2E test: signup → onboarding finish → audit kickoff

**Sign-off:** Date: _________

---

## Phase 3 — Intelligence layer (Weeks 2–3, parallel)

### audit-service
- [ ] All 4 public + 3 internal routes implemented per `09-service-specs/03-audit-service.md`
- [ ] All 9 dimension scorers tested
- [ ] PDF renders cleanly with branding
- [ ] Full audit completes in staging for a test tenant in <30 min
- [ ] `audit.completed` published correctly
- [ ] Coverage > 75%

### competitor-service
- [ ] Discovery works for cafe, salon, gym categories
- [ ] Analysis completes for 5 competitors in <5 min
- [ ] `competitor.report.ready` published once per batch
- [ ] Web scraping respects robots.txt and UA
- [ ] Coverage > 70%

### Frontend
- [ ] Audit report viewer page wired (with PDF preview)
- [ ] Competitor list + report view wired
- [ ] E2E test extends to show audit appearing in UI after onboarding

**Sign-off:** Date: _________

---

## Phase 4 — Generation layer (Weeks 3–4)

### strategy-service
- [ ] `pending_strategy_runs` join table works — both events required before generation
- [ ] Calendar contains exact slot count per plan tier
- [ ] All slots have unique topic-hooks (no duplicates)
- [ ] `strategy.generated` published once per calendar
- [ ] Coverage > 70%

### content-service
- [ ] Per-post generation completes in <30s on Gemini Flash
- [ ] 20-post batch completes within 5 min via Cloud Tasks
- [ ] Regeneration honors reviewer notes
- [ ] Cost cap per plan enforced
- [ ] Coverage > 70%

### Frontend
- [ ] Calendar grid view wired (`/dashboard/calendar`)
- [ ] Strategy summary sidebar wired
- [ ] E2E test extends to: signup → onboarding → audit + competitor → strategy → posts in queue

**Sign-off:** Date: _________

---

## Phase 5 — Review + Publish (Weeks 4–5)

### review-service
- [ ] All 8 routes implemented; tier-gated authorization
- [ ] Modify flow round-trips with content-service successfully
- [ ] Bulk approve handles 100 posts in <2s
- [ ] `post.approved` published with correct `scheduled_for`
- [ ] Coverage > 80%

### publish-service
- [ ] IG Business publisher works end-to-end on sandbox
- [ ] FB Page publisher works end-to-end on sandbox
- [ ] Retry logic verified
- [ ] Token refresh exercised
- [ ] Outbox relay deployed
- [ ] LinkedIn + Twitter publishers stub with clear "not in MVP" status
- [ ] Coverage > 80%

### Frontend
- [ ] Review queue page (`/review`) wired with approve/reject/modify
- [ ] Bulk action bar wired
- [ ] Publish status visible per post in calendar view
- [ ] Keyboard shortcuts A/R/M work
- [ ] E2E test: full happy path through publish

**Sign-off:** Date: _________

---

## Phase 6 — Supporting services + polish (Weeks 5–6)

### analytics-service
- [ ] All 7 routes implemented
- [ ] 3 polling snapshots per published post
- [ ] Dashboard endpoint returns valid monthly summary
- [ ] Audit comparison endpoint works
- [ ] Coverage > 70%

### notification-service
- [ ] All 14 notification types covered
- [ ] Templates render across Gmail/Outlook/Apple Mail (manual QA)
- [ ] Digest emails fire on schedule
- [ ] In-app feed populated
- [ ] Unsubscribe works
- [ ] Coverage > 80%

### billing-service
- [ ] Full subscribe → cancel → resubscribe cycle works in Stripe test mode
- [ ] Plan limits enforced via `canUseFeature` in content + onboarding
- [ ] Grace period behavior verified
- [ ] Customer portal redirect works
- [ ] One real INR transaction in live mode
- [ ] Coverage > 85%

### Frontend
- [ ] Analytics dashboard wired
- [ ] Settings → Billing page wired with Stripe checkout
- [ ] Notifications bell + dropdown wired
- [ ] All routes mobile-responsive (375 / 768 / 1280)
- [ ] Lighthouse: Performance ≥ 80, A11y ≥ 95 on `/dashboard`

**Sign-off:** Date: _________

---

## Phase 7 — Hardening + Staging soak (Week 7)

### Testing
- [ ] All 5 critical E2E paths pass against staging
- [ ] Multi-tenancy test suite passes (no cross-tenant leakage)
- [ ] Load test: 100 concurrent audits, 60 concurrent publishes within SLA
- [ ] All P1/P2 bugs from soft launch closed

### Security
- [ ] Every launch-blocker item in `16-security-checklist.md` checked
- [ ] gitleaks, semgrep, dependency scans, container scans clean
- [ ] Manual security review by you

### Observability
- [ ] All dashboards live with prod data
- [ ] All alerts tested by force-triggering
- [ ] All 7 runbooks exist
- [ ] Sentry capturing in prod (no errors yet ideally)

### Infrastructure
- [ ] Prod TF apply clean, no drift
- [ ] Backup restore drill completed
- [ ] DNS + SSL certs valid for all subdomains

### Soft launch
- [ ] 3 internal users completed full flows end-to-end on prod

**Sign-off:** Date: _________

---

## Phase 8 — Launch (Week 8)

- [ ] T-1 week checklist from `17-launch-runbook.md` complete
- [ ] T-1 day checklist complete
- [ ] T-0 Hour 0 checks PASS
- [ ] Launch announcement published
- [ ] First external paying customer onboarded
- [ ] Hour 24: no P1 incidents
- [ ] Day 7: no P2 incidents unresolved
- [ ] Day 30: 10+ paying customers OR clear path to 100 in 90 days per PRD §8.2

**Sign-off:** Date: _________

---

## Anti-cheating clauses

- "Mostly done" is not done. Either the box is checked or the phase is not closed.
- "We'll come back to it" is the path to a stalled launch. Either fix now or formally defer in `22-deferred-items.md` (a file you maintain).
- Phase gates can fail. That's fine. Slip the schedule, don't ship the bug.

---

## Tracking these in your tool of choice

Copy this file into Notion / Linear / GitHub Projects as a checklist board, or just keep it as a Markdown file you tick through. The key is *one source of truth*, not *which tool*.
