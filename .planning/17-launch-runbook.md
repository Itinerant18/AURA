# 17 — Launch Runbook

**Goal:** A concrete sequence to go from "staging green" to "first paying customer." Treat as an executable checklist on launch day.

---

## T-2 weeks: Production readiness review

### Infrastructure
- [ ] Prod GCP project fully provisioned per `02-gcp-bootstrap.md`
- [ ] All 12 services deployed to prod via Terraform
- [ ] DNS records propagated; SSL certs issued
- [ ] Cloud Armor (WAF) considered — skip MVP, add Phase 1.5
- [ ] Backups verified: trigger one manual backup, then restore to a sandbox SQL instance, confirm data integrity

### Apps
- [ ] All E2E tests green against staging
- [ ] Manual smoke test of the full happy path by you, end to end, on staging
- [ ] Performance baseline captured: p50/p95 of every endpoint under no load

### Operations
- [ ] On-call rotation set (just you for first 30 days; that's fine)
- [ ] Alert routing tested: trigger each alert at least once
- [ ] Runbooks exist for the 7 most likely incidents

### Compliance & legal
- [ ] Privacy policy live at `/privacy`
- [ ] Terms of service live at `/terms`
- [ ] Cookie consent banner live
- [ ] Pricing page live at `/pricing`
- [ ] Refund policy live at `/refunds`

### Third-party gates
- [ ] Meta app review **approved** (not just submitted)
- [ ] Stripe India onboarding approved, live keys available
- [ ] Sending domain warmed (send 50 internal emails to ensure no spam-flagging)
- [ ] Google Sheets API + Drive API quotas reviewed

---

## T-1 week: Soft launch (internal users)

- [ ] Three internal "real" users sign up with their own businesses (you + two friends)
- [ ] Each completes onboarding end-to-end
- [ ] Each receives an audit, competitor report, strategy, calendar, posts
- [ ] Each approves at least 3 posts
- [ ] Each verifies posts land on Instagram + Facebook
- [ ] Each cancels and resubscribes through Stripe to test billing lifecycle

Document every issue in a `_launch-issues.md` file. Fix all P1/P2 before T-1 day.

---

## T-1 day: Final checks

### Database
- [ ] All migrations applied; `prisma migrate status` clean on prod
- [ ] Index on `content_posts(scheduled_for) WHERE status = 'approved'` confirmed (this is the hot path for publish-service)

### Secrets
- [ ] All secrets present in prod Secret Manager
- [ ] All services can fetch their secrets (verify via boot logs)
- [ ] Stripe **live** webhook secret configured (not test-mode)

### Monitoring
- [ ] All dashboards loading prod data
- [ ] PagerDuty / phone alerts going to your phone
- [ ] Slack alert channels receiving non-prod-blocking warnings

### Communications
- [ ] Launch announcement drafted (LinkedIn, email list, Slack/Discord communities)
- [ ] Support inbox ready: `support@<domain>` forwarding to your inbox
- [ ] Status page (Statuspage / Better Stack) live at `status.<domain>`

---

## T-0 (launch day)

### Hour 0
- [ ] Flip DNS to point apex domain (`<domain>` + `app.<domain>` + `api.<domain>`) to prod LB
- [ ] Verify health endpoints externally: `curl https://app.<domain>/health` returns 200
- [ ] Verify signup flow as a brand-new user from a fresh device
- [ ] Verify Stripe checkout completes for INR with UPI
- [ ] Verify Stripe webhook arrives and tenant becomes active
- [ ] Verify Meta OAuth completes for a real Instagram Business account
- [ ] Publish launch announcement

### Hour 0–24
- [ ] You camp on dashboards for first 24 hours
- [ ] Reply to every support email within 1 hour
- [ ] Watch error rate dashboard; investigate every uptick
- [ ] Watch Cloud SQL CPU + Pub/Sub backlog

### End of Day 1
- [ ] Daily metrics snapshot: signups, completed onboardings, audits started, posts generated, posts published
- [ ] Issue triage: any P1s logged?

---

## Common launch-day failure modes (and how to handle)

### "Meta API returning 190 for all OAuth flows"
- App in "Development Mode" instead of "Live Mode" — flip in Meta dashboard
- Or App Review approval lapsed — re-submit

### "Cloud Run service flapping (scaling to 0 then back)"
- Min instances probably set to 0 in prod TF — set to 1 for hot services (auth, api gateway, billing webhook)
- Cost: ~Rs. 2000/month per service kept hot; worth it for launch

### "Audit PDFs not generating"
- WeasyPrint missing system fonts in container — check Dockerfile installs `fonts-dejavu`
- Or GCS bucket not writable — check service account binding

### "Stripe webhooks 401 (signature invalid)"
- You're using test webhook secret with live keys (or vice versa)
- Webhook endpoint URL different from what you registered in Stripe

### "Pub/Sub subscriptions piling up"
- Consumer service either down or returning non-2xx from `/_pubsub/...` endpoint
- Check Cloud Run logs for 5xx and fix the handler
- Drain DLQ manually with a one-shot script

### "Customer's Instagram won't link"
- They have a personal Instagram account, not Business/Creator — onboarding UI must guide them to convert (Instagram Settings → Switch to Business)

---

## Rollback procedure

If something is catastrophically broken:

1. Cloud Run: instant revert. `gcloud run services update-traffic <svc> --to-revisions=<old-sha>=100`
2. Database: **never** auto-rollback migrations. If schema is the cause, write a forward fix migration. Restore from PITR is the last resort.
3. DNS: revert apex domain to a "we're back soon" static page hosted on Cloud Storage (template in `docs/maintenance-page.html`)

---

## Post-launch cadence

| When | What |
|---|---|
| Daily | Glance at platform overview dashboard, on-call inbox |
| Weekly | Triage Sentry top issues, customer feedback, cost trend |
| Monthly | Audit performance metrics vs. SLOs, review cost-per-tenant, plan Phase 1.5 items |
| Quarterly | Restore drill, security review, dependency major-version upgrades |

---

## Definition of done

- [ ] T-2, T-1, T-1day, T-0 checklists complete
- [ ] Three internal users have completed full flows
- [ ] First external paying customer onboarded successfully
- [ ] No P1 incidents in first 7 days
- [ ] All P2 incidents resolved within 48 hours

---

## AI Agent Prompt Template (used the morning of launch)

```
You are the on-call assistant for AURA's launch day.

Read .planning/17-launch-runbook.md.

YOUR JOB:
1. Run the T-0 Hour 0 checks one by one using gcloud, curl, and reading Cloud Run logs
2. Report PASS/FAIL on each item with evidence
3. If any FAIL: do NOT auto-fix unless I tell you. Surface the issue with details and a proposed fix
4. After all checks pass, watch the platform overview dashboard for the first 60 minutes; alert me immediately if any of these happen:
   - Error rate > 0.5%
   - Any Cloud Run service instance count = 0 for > 2 min
   - Pub/Sub backlog > 100 messages
   - Cloud SQL CPU > 70%
   - Any Sentry event with severity=error

Be terse. I'm watching too.
```
