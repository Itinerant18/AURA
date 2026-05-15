# 00 — MVP Scope and Cuts

**Goal:** Define exactly what ships in Phase 1 (MVP) vs. what is explicitly deferred. This is the contract between you and your AI agents — anything not on the "IN" list does not get built in the 8-week window.

**Source documents:**
- PRD §8.1 (Minimum Viable Product — Phase 1)
- PRD §9.3 (Out of Scope)
- Architecture doc §1.1 (Microservices Overview)

---

## ✅ What is IN the MVP

### Modules
- **Module 1** — Client Onboarding & Business Database (PRD §4.1)
- **Module 2** — AI Social Media Audit (PRD §4.2)
- **Module 3** — Competitor Analysis (PRD §4.3)
- **Module 4** — 30-Day Strategy & Roadmap Generator (PRD §4.4)
- **Module 5** — AI Content Creation Engine (PRD §4.5)
- **Module 6** — Human Review Layer (PRD §4.6)
- **Module 7** — Analytics & Reporting (basic; PRD §4.7)

### Microservices (all 12 from architecture doc §1.1)
1. auth-service
2. onboarding-service
3. audit-service
4. competitor-service
5. strategy-service
6. content-service
7. review-service
8. publish-service
9. sheets-service
10. analytics-service
11. notification-service
12. billing-service

### Social Platforms — Publishing
- **Instagram (Business/Creator accounts only)** — full publish support
- **Facebook (Pages)** — full publish support
- **LinkedIn** — *read-only* (audit + competitor analysis only; no publishing in MVP)
- **Twitter/X** — *read-only* (audit + competitor analysis only; no publishing in MVP)
- **Google Business Profile** — read-only (audit only)

### AI Capabilities
- Caption + hashtag generation (Gemini 1.5 Flash)
- Strategy + 30-day calendar generation (Gemini 1.5 Pro)
- Competitor analysis prose (Gemini 1.5 Pro)
- Audit insights + action items (Gemini 1.5 Flash)
- AI image generation (Stability AI — basic tier per PRD §7 Starter plan)

### Subscription Tiers
- Starter (Rs. 1,999) — full flow
- Growth (Rs. 4,999) — full flow + advanced image gen
- Agency (Rs. 14,999) — feature-gated; multi-client management UI may be a stub for MVP

### Infrastructure
- GCP **asia-south1** (Mumbai) region
- Cloud Run for all 12 services
- Cloud SQL (PostgreSQL 16, regional HA — `db-custom-2-7680` for MVP)
- Memorystore Redis (Basic tier, 1 GB)
- Pub/Sub (6 event topics)
- Cloud Storage (1 bucket per environment: staging, prod)
- Secret Manager
- Cloud CDN in front of Next.js static assets
- BigQuery — analytics warehouse (export pipeline can be stubbed; only enable when first dashboard needs it)

---

## 🟡 What is REDUCED (built but minimal)

| Item | MVP scope | Full scope |
|---|---|---|
| Mobile apps | Responsive PWA only | Native iOS + Android (Phase 2) |
| Image generation | Stability AI basic | + DALL-E premium tier, 3D renders |
| Video generation | Not in MVP | Short-form video scripts + AI video (Phase 2) |
| Analytics | Basic dashboard (impressions, reach, ER) | White-label reports, custom KPIs |
| Notifications | Email only via SendGrid/SES | Email + Push + In-app + WhatsApp |
| Billing | Stripe checkout, monthly recurring | + Annual plans, mid-cycle proration, multi-currency |
| Human Review | Self-review for Starter, dedicated reviewer manual assignment for Growth/Agency | Full reviewer routing, SLAs, escalation |
| Agency multi-client UI | Single tenant per login (Agency tenants can switch via dropdown) | Full agency workspace with client management |
| RLS | ORM-level tenant_id enforcement | + PostgreSQL row-level security (Phase 1.5) |
| Multi-tenant isolation testing | Manual smoke tests | Automated cross-tenant leakage test suite |
| WCAG 2.1 AA | Best-effort (keyboard nav, contrast) | Full audit + remediation |

---

## ❌ What is EXPLICITLY OUT of MVP

From PRD §9.3 and our pace constraints:

1. Paid social media advertising management (Facebook Ads, Google Ads)
2. Influencer discovery and management
3. E-commerce integration (Shopify, WooCommerce)
4. Native video editing / generation
5. WhatsApp Business messaging automation
6. White-label reports for Agency tier (post-MVP)
7. SOC 2 Type II certification (roadmap item, not a launch blocker)
8. iOS / Android native apps
9. LinkedIn and Twitter/X **publishing** (read-only only in MVP)
10. Multi-language support (English-only at launch)
11. Custom reviewer roles / permissions matrix (only owner/reviewer/viewer in MVP)
12. GDPR / India DPDP **certification** — we are *compliant by design* but no formal audit before launch
13. API access for Agency tier customers

If a customer asks for any of the above during launch month, the answer is: **"Roadmap, Q3 2026."**

---

## Decision rules when scope is unclear

When an AI agent or you encounter ambiguity:

1. **Check the PRD first.** If the PRD specifies it as MVP, it's IN.
2. **Check this file.** If it's on the OUT list, it's OUT — even if the PRD seems to imply otherwise.
3. **If the PRD is silent and this file is silent:** default to "defer" and add to `22-deferred-items.md` (you'll create this living doc as gaps surface).

---

## Why these specific cuts

- **LinkedIn/Twitter publish cut:** Meta Graph API has 80% of the integration work; LinkedIn API v2 has separate OAuth flow + post-content review for business pages. Cutting buys ~5–7 days.
- **Native apps cut:** PWA covers 95% of the workflow. Native apps double the team workload.
- **BigQuery delayed:** Analytics dashboard for MVP reads directly from `post_analytics` table in Postgres. BigQuery only matters when we need cross-tenant aggregates or historical trends >90 days.
- **Agency multi-client UI minimal:** Few Agency-tier signups in first 90 days; we can ship a "good enough" tenant-switcher and iterate from real feedback.

---

## Definition of "MVP complete"

The MVP is complete when **all of the following** are true:

- [ ] A new customer can sign up at `aura.app/signup` (or your domain)
- [ ] They can complete the business profile form (PRD §4.1.1)
- [ ] They can connect Instagram Business + Facebook Page via OAuth
- [ ] An audit report is generated and visible within 4 hours
- [ ] A competitor report is generated and visible within 24 hours
- [ ] A 30-day strategy + calendar appears within 24 hours of competitor report
- [ ] The calendar is exported to a Google Sheet they own
- [ ] At least 20 posts are auto-generated with caption + hashtags + image
- [ ] The reviewer dashboard lets them approve/reject/modify any post
- [ ] An approved post lands on Instagram and Facebook within 2 minutes of its scheduled time
- [ ] Post analytics (impressions, reach, ER) appear in the analytics tab within 24 hours of publish
- [ ] Stripe charges Rs. 1,999 / Rs. 4,999 / Rs. 14,999 monthly on schedule
- [ ] Three internal test tenants have run the full flow end-to-end with no manual interventions

This is the bar. Use it during phase-gate reviews (see `19-phase-gate-checklists.md`).
