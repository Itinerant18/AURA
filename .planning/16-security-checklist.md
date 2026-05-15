# 16 — Security Checklist

**Goal:** Cover the OWASP Top 10 + multi-tenancy-specific risks + GDPR/India DPDP compliance basics, with a launch-blocker checklist and a Phase 1.5 hardening backlog.

---

## Launch-blocker checks

### 1. Authentication & session
- [ ] Passwords hashed with **argon2id** (m=64 MB, t=3, p=4); never SHA-256 or bcrypt for new code
- [ ] Login rate-limited: 5 attempts / 15 min / IP (Redis)
- [ ] Login rate-limited: 5 attempts / 15 min / account (separate key)
- [ ] Refresh tokens stored hashed in DB, comparison via constant-time
- [ ] Sessions invalidated on password change
- [ ] JWT lifetime ≤ 15 minutes; refresh ≤ 30 days
- [ ] JWTs signed RS256 (asymmetric); JWKS endpoint exposed
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to apex domain
- [ ] No localStorage for tokens (only HTTPOnly cookies)

### 2. Authorization & multi-tenancy
- [ ] Tenant-context middleware injects `tenantId` from JWT on every request
- [ ] Prisma middleware rejects queries on tenant-scoped tables without `tenantId` clause
- [ ] Every authorization check happens **server-side** — frontend never decides
- [ ] Role check: viewer cannot mutate, reviewer cannot manage billing, owner can do all within their tenant
- [ ] Multi-tenancy test suite passes (see `14-testing-strategy.md` §9)
- [ ] No tenant can fetch another tenant's social_accounts even by guessing UUIDs (404, not 403, to avoid enumeration)
- [ ] Cross-tenant references in API responses checked: e.g., a competitor_report belongs to the same tenant as the caller

### 3. Input validation
- [ ] Every endpoint validates body + query + path params with Zod / Pydantic before business logic
- [ ] File uploads checked: max size 10 MB, allowed MIME types only, magic-byte check (not just extension)
- [ ] URLs in user content validated and re-encoded (no `javascript:`)
- [ ] No SQL string concatenation anywhere — Prisma / SQLAlchemy parameterized queries only

### 4. Output encoding
- [ ] React auto-escapes HTML; no `dangerouslySetInnerHTML` except for the audit PDF preview iframe
- [ ] Backend never returns HTML when it should return JSON
- [ ] All user-supplied text shown in emails is HTML-escaped (MJML templates use `{{ var }}` interpolation that auto-escapes)

### 5. Transport
- [ ] HTTPS everywhere; HSTS header with `max-age=31536000; includeSubDomains; preload`
- [ ] TLS 1.2+; no TLS 1.0/1.1
- [ ] HTTP→HTTPS redirect at the load balancer
- [ ] Cloud SQL private IP only (no public IP)
- [ ] Redis TLS enabled
- [ ] Inter-service traffic stays in VPC (no public internet hops)

### 6. CSRF / SSRF / Open redirect
- [ ] OAuth state parameter validated on callback (CSRF on social connect)
- [ ] Stripe webhook signature verified
- [ ] Meta webhook signature verified (when we wire incoming webhooks in Phase 1.5)
- [ ] No user-controlled URLs proxied server-side without allow-list (SSRF prevention) — particularly relevant in competitor-service web scraper
- [ ] OAuth redirect_uri whitelisted, not user-controlled

### 7. Secrets
- [ ] All secrets in Secret Manager (see `07-secrets-and-config-strategy.md`)
- [ ] No `.env`, no `secrets.json`, no committed keys
- [ ] `gitleaks` runs in CI on every PR
- [ ] OAuth tokens encrypted at rest (AES-256-GCM)
- [ ] DB encryption key never logged
- [ ] Service accounts least-privilege (matrix in `07-secrets…`)

### 8. Dependencies
- [ ] `pnpm audit` clean (no high/critical)
- [ ] `uv pip-audit` clean (no high/critical)
- [ ] Dependabot enabled, auto-merge patches
- [ ] Container scanning enabled on Artifact Registry
- [ ] Pin all GitHub Action versions to commit SHAs
- [ ] Lockfile committed for every package

### 9. Logging & privacy
- [ ] No PII in logs (see `15-observability-and-logging.md` "Never log" list)
- [ ] No tokens in logs
- [ ] Frontend errors to Sentry have PII scrubbed
- [ ] User data export endpoint (`GET /me/export-data`) exists — required by GDPR/DPDP
- [ ] User data delete endpoint (`POST /me/delete-account`) exists — required by GDPR/DPDP; 30-day grace, then hard delete with audit log entry

### 10. Rate limiting & abuse
- [ ] API gateway rate limit: 100 req/min/user
- [ ] Stricter limits on signup (3/h/IP), password reset (3/h/email)
- [ ] Stripe webhook idempotency via `webhook_events` table
- [ ] Pub/Sub consumer idempotency via `processed_events` table
- [ ] Generation cost caps per tenant per month (in content-service)

### 11. Headers (frontend + API)
- [ ] `Content-Security-Policy` set (start strict; loosen with reports)
- [ ] `X-Frame-Options: DENY` (except the audit PDF embedded iframe page)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 12. Backup & recovery
- [ ] Cloud SQL daily backups verified by quarterly restore drill
- [ ] PITR enabled
- [ ] GCS bucket versioning on `aura-private-*` (for audit PDFs)
- [ ] Test restore documented in `17-launch-runbook.md`

### 13. Incident response
- [ ] Security inbox: `security@<domain>`
- [ ] Incident playbook in `docs/runbooks/security-incident.md` (created during build)
- [ ] Logs retained 90 days minimum (Cloud Logging default is 30; bump to 90)

---

## GDPR / India DPDP basics

- [ ] Privacy policy published and linked from footer
- [ ] Terms of service published
- [ ] Cookie consent banner (only loads non-essential cookies after consent)
- [ ] DPA available for B2B customers (Agency tier especially)
- [ ] Data export endpoint
- [ ] Data delete endpoint
- [ ] Sub-processor list published (lists Gemini, Stripe, Meta, etc.) — required by GDPR Art. 28
- [ ] Data residency: customer data lives in asia-south1; document this in privacy policy
- [ ] Children's data: ToS requires age ≥18 (we don't service minors)

---

## Phase 1.5 hardening (not launch-blockers, but track)

- [ ] PostgreSQL Row-Level Security `FORCE` enabled (revoke `BYPASSRLS` from app role)
- [ ] WAF (Cloud Armor) in front of the load balancer with OWASP rules
- [ ] DDoS protection enabled
- [ ] Bug bounty program (HackerOne or Intigriti)
- [ ] SOC 2 Type II readiness audit kickoff
- [ ] Penetration test by external firm
- [ ] Customer-managed encryption keys (CMEK) option for Agency tier
- [ ] MFA for AURA admin users
- [ ] OAuth scopes minimization review per quarter

---

## OWASP Top 10 (2021) coverage

| Risk | Where it's addressed in this checklist |
|---|---|
| A01 Broken Access Control | §2 |
| A02 Cryptographic Failures | §1, §7 |
| A03 Injection | §3 |
| A04 Insecure Design | This entire doc + threat-model session in Phase 1 |
| A05 Security Misconfiguration | §11, §12 |
| A06 Vulnerable Components | §8 |
| A07 ID & Auth Failures | §1 |
| A08 Software Integrity Failures | §8 (action pinning) |
| A09 Logging & Monitoring Failures | §9 |
| A10 SSRF | §6 |

---

## Definition of done

- [ ] Every launch-blocker item checked
- [ ] Multi-tenancy test suite passes (no leakage)
- [ ] `gitleaks` clean
- [ ] `semgrep` clean (no high findings)
- [ ] Dependency scans clean
- [ ] Container scans clean
- [ ] One full manual security review by you with this checklist open
- [ ] Privacy policy + ToS published

---

## AI Agent Prompt Template

```
You are running the AURA security review.

CONTEXT:
- Read .planning/16-security-checklist.md
- Read .planning/14-testing-strategy.md §9 (multi-tenancy tests)
- Read every service spec under .planning/09-service-specs/

DELIVERABLES:
1. Run an audit against the launch-blocker section
2. Produce a markdown report at .planning/_security-audit-<date>.md listing each item as PASS / FAIL / NOT TESTED
3. For each FAIL: a specific fix + the file/line to change
4. Open an issue per FAIL with severity tag
5. Implement fixes for HIGH/CRITICAL findings in a single PR

CONSTRAINTS:
- Don't grep for secrets in production logs; use git history scan with gitleaks
- Don't run DAST against production; use staging only
- Don't perform any actions that would lock out real users

ASK FIRST:
- Do you want me to perform an SQL-injection test against staging? (Y/N — recommend YES, contained to test tenants)
- Should I attempt the multi-tenant leakage tests live, or only static-analysis the code paths? (Recommend BOTH — static finds new gaps, dynamic confirms)
```
