# 20 — Phase Roadmap (8 Weeks)

**Goal:** A week-by-week, day-by-day plan for the aggressive 8-week MVP build. Use as the master schedule. Update dates and tracked progress weekly.

---

## Conventions

- Dates: ISO format (`2026-05-15`)
- "AGENT" means an AI coding agent of your choice
- "YOU" means architect/PM tasks not delegable
- Days are weekdays unless noted; weekends are buffer
- Each day has 1–3 deliverables max — don't pack more

---

## Week 0 — Prep (start date: _________)

| Day | YOU | AGENT |
|---|---|---|
| Mon | Submit Meta app review, start Stripe India onboarding, register domain | — |
| Tue | Create GCP staging + prod projects, billing setup, install local tools | — |
| Wed | Run through `02-gcp-bootstrap.md` Steps 1–7 (foundation, SAs, secrets skeleton) | — |
| Thu | Run through `02-gcp-bootstrap.md` Steps 8–12 (SQL, Redis, GCS, Pub/Sub, monitoring) | — |
| Fri | Provision base Terraform modules: `network`, `cloud-sql`, `memorystore`, `storage`, `pubsub` (apply staging) | Drives Terraform per `12-infrastructure-terraform.md` |

**End-of-week gate:** Phase 0 checklist in `19-phase-gate-checklists.md` fully checked.

---

## Week 1 — Foundation

| Day | YOU | AGENT |
|---|---|---|
| Mon | Review `04-database-schema-and-prisma.md`; brief agent | Implements DB schema + Prisma + tenant middleware |
| Tue | Review schema PR; brief agent on shared packages | Implements `packages/types`, `packages/queue`, `packages/utils` |
| Wed | Review shared packages PR; brief agent on event bus | Wires Pub/Sub publisher + subscriber + outbox; emulator e2e test |
| Thu | Review event bus PR; brief auth-service agent (skeleton only) | Builds auth-service skeleton, ping for review |
| Fri | Review auth-service skeleton; brief for full implementation | Implements auth-service routes 1–5 (signup/login/refresh/logout/me) |

**Parallel track (frontend agent):** scaffolds `apps/web` shell, public site routes, login/signup pages with mocked backend.

**End-of-week gate:** Phase 1 checklist.

---

## Week 2 — Onboarding + Sheets

| Day | YOU | AGENT (backend) | AGENT (frontend) |
|---|---|---|---|
| Mon | Review auth-service final PR; brief onboarding-service | OAuth routes (5–10) finalized; Phase 1 complete | — |
| Tue | Review onboarding skeleton; brief sheets-service | Onboarding-service business profile + completeness scoring | Onboarding flow wireframes + first 3 steps |
| Wed | Review onboarding business logic; check sheets-service skeleton | Sheets-service Google OAuth + sheet creation | Onboarding steps 4–6 + social-connect UI |
| Thu | Review sheets-service PR | Onboarding-service file upload + competitor mgmt | Settings page shell + Social Connections |
| Fri | Approve onboarding + sheets; soak in staging | End-to-end test: signup → onboarding finish → audit kickoff event fires | First E2E Playwright test |

**End-of-week gate:** Phase 2 checklist.

---

## Week 3 — Intelligence (audit + competitor in parallel)

| Day | YOU | AGENT A (audit) | AGENT B (competitor) |
|---|---|---|---|
| Mon | Brief both agents; review skeleton outputs end of day | audit-service skeleton + Meta API adapter | competitor-service skeleton + Places API adapter |
| Tue | Approve skeletons | Implement scorers 1–3 (profile, posting, engagement) | Discovery flow + scraping |
| Wed | Spot-check progress | Scorers 4–6 (content mix, hashtag, growth) | Gemini Pro analysis chain |
| Thu | Brief frontend agent on audit + competitor UIs | Scorers 7–9 (top posts, response, SEO) | Pros/cons matrix + persistence |
| Fri | Soak: trigger full audit + competitor flow in staging | PDF rendering + `audit.completed` event | `competitor.report.ready` event + tests |

**Parallel track (frontend agent):** audit report viewer + competitor list/detail pages.

**End-of-week gate:** Phase 3 checklist.

---

## Week 4 — Generation (strategy + content)

| Day | YOU | AGENT (strategy/content) | AGENT (frontend) |
|---|---|---|---|
| Mon | Brief strategy-service agent | strategy-service skeleton + pending_strategy_runs join | Calendar grid UI |
| Tue | Review strategy generation | LangChain pipeline + Gemini Pro prompts | Strategy summary panel |
| Wed | First strategy generates end-to-end in staging | strategy.generated event + frontend wiring | Post slot detail drawer |
| Thu | Brief content-service agent | content-service skeleton + Cloud Tasks fan-out | — |
| Fri | Review content gen | caption + hashtag + image gen pipeline | E2E extends to: strategy + posts visible |

**End-of-week gate:** Phase 4 checklist (start it; may slip to early Week 5).

---

## Week 5 — Review + Publish

| Day | YOU | AGENT (review) | AGENT (publish) |
|---|---|---|---|
| Mon | Finalize content-service (cost caps, regen flow) | — | — |
| Tue | Brief review-service agent | review-service skeleton + BullMQ queue | publish-service skeleton + scheduler |
| Wed | Review approve/modify/reject flows | Tier-gated authorization + bulk approve | IG publisher (sandbox publish works) |
| Thu | Brief frontend agent on review queue | Modification round-trip with content-service | FB publisher + retry logic |
| Fri | First end-to-end happy path: signup → onboarding → audit → strategy → content → review → publish on sandbox | post.approved event + outbox relay deployed | publish.failed handling + token refresh |

**End-of-week gate:** Phase 5 checklist.

---

## Week 6 — Supporting + polish

| Day | YOU | AGENT A | AGENT B | AGENT C |
|---|---|---|---|---|
| Mon | Brief all three agents | analytics-service skeleton + 3-snapshot polling | notification-service skeleton + email templates | billing-service skeleton + Stripe products |
| Tue | Spot-check | Dashboard endpoint + audit comparison | Templates for 8 notification types | Stripe checkout flow |
| Wed | Verify Stripe live mode INR transaction | Top posts + sheets push integration | Remaining 6 templates + digest cron | Webhook handler + idempotency |
| Thu | Frontend polish day | Tests + coverage push | Preferences + unsubscribe | canUseFeature endpoint + plan limits |
| Fri | Mobile-responsive QA across all pages | — | Email QA across Gmail/Outlook/Apple | One real INR transaction in live mode |

**End-of-week gate:** Phase 6 checklist.

---

## Week 7 — Hardening + soak

| Day | YOU | AGENT |
|---|---|---|
| Mon | Brief multi-tenant test agent; brief perf test agent | Multi-tenancy test suite + cross-tenant leak attempts |
| Tue | Review tenant test results | k6 load tests; performance baseline captured |
| Wed | Internal user 1 (you) does full real-tenant flow on staging | Fix any P1/P2 surfaced |
| Thu | Internal users 2 + 3 do full flow on staging | Fix any P1/P2 |
| Fri | Run `16-security-checklist.md` end-to-end | Remediate any HIGH/CRITICAL findings |

**Weekend:** Documentation polish, runbooks finalized, status page set up.

**End-of-week gate:** Phase 7 checklist.

---

## Week 8 — Launch

| Day | YOU | AGENT |
|---|---|---|
| Mon | T-2 final readiness review | Smoke tests, alert force-triggers, prod TF apply dry-run |
| Tue | Prod deploy via CD (manual approval gate) | Watches deployment, reports issues |
| Wed | T-1 final checks | Final E2E sweep |
| Thu | Soft launch to 5 hand-picked beta customers | Reactive support |
| Fri (T-0) | Public launch, announcement, support coverage | On-call assistant per `17-launch-runbook.md` |

**Weekend:** Camp on dashboards. Be available.

**Week 9+:** Daily / weekly cadence per `17-launch-runbook.md` post-launch section.

---

## Buffer strategy

8 weeks is aggressive. Expected slips:
- Phase 3 (intelligence) — Meta API quirks, audit PDF tuning often take longer than expected
- Phase 5 (publish) — every Instagram publish edge case (caption length, image format) surfaces during real publishes

If you slip by ≤3 days on any phase: absorb in the next phase by working a weekend or two.

If you slip by >3 days: stop and re-plan. Better to cut scope (move something to "Phase 1.5") than to ship broken.

**Cuts you can take if needed (in order of pain):**
1. Defer LinkedIn/Twitter audit dimensions → IG/FB only
2. Defer image gen quality tiers → Stability Core for all plans
3. Defer Agency tier polish → ship Starter + Growth only, Agency in week 10
4. Defer billing-service to Phase 1.5 → manual Stripe invoicing for first 10 customers (uncomfortable but doable)
5. Defer analytics-service → ship without analytics dashboard, add in Phase 1.5

Do **not** cut:
- Multi-tenancy testing
- Stripe webhook idempotency
- OAuth token encryption
- Audit + strategy + content + review + publish pipeline

These are the platform's core; cutting any of them defeats the MVP.

---

## Tracking progress

Recommended:
- Linear / GitHub Projects board with one issue per phase-gate checklist item
- Weekly Friday review: read `19-phase-gate-checklists.md` and update what's done
- A `.planning/_progress-log.md` file you append to weekly with one paragraph per week summarizing what shipped + what slipped + what changed

---

## Definition of done

- [ ] Week 8 closes with public launch announcement live
- [ ] First paying customer onboarded successfully
- [ ] First post published from AURA to a real Instagram account
- [ ] No open P1 incidents
