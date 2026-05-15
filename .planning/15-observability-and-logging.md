# 15 — Observability and Logging

**Goal:** Every running service emits structured logs, useful metrics, and distributed traces, so production debugging takes minutes, not days.

---

## The three pillars

1. **Logs** — structured JSON to stdout, ingested by Cloud Logging
2. **Metrics** — RED (Rate, Errors, Duration) per service via Cloud Monitoring
3. **Traces** — OpenTelemetry → Cloud Trace, propagated across HTTP + Pub/Sub

---

## Logging

### Format (mandatory)
Every log line is a single JSON object:
```text
{
  "ts": "2026-05-15T14:32:01.123Z",
  "level": "info",
  "service": "audit-service",
  "version": "<git-sha>",
  "env": "prod",
  "msg": "audit started",
  "tenantId": "...",
  "traceId": "...",
  "spanId": "...",
  "requestId": "...",
  "userId": "...",
  "duration_ms": 1234,
  "...": "..."
}
```

Implemented in `packages/utils/logger.ts` (pino) and a Python equivalent (`structlog`).

### Levels
- `error` — something broke that needs attention
- `warn` — degraded behavior, fallback used, retry occurred
- `info` — significant lifecycle events (request received, event published, job scheduled)
- `debug` — verbose; OFF in production by default

Set via `LOG_LEVEL` env var.

### Never log
- Passwords, password hashes, API keys
- OAuth access/refresh tokens (encrypted or plaintext)
- Stripe payment details
- Full request bodies that may contain PII (log only the keys, not values)
- Full response bodies from Gemini (token budget; log first 500 chars if needed for debugging)

### Always include
- `tenantId` for any tenant-scoped operation
- `traceId` propagated from the request
- `service` (auto-injected)
- `duration_ms` for any external call or DB query > 100ms

### Log sampling
Production: keep all `error` + `warn`, sample `info` at 100% for now (we're low volume). When volume grows, sample at 10% with rate-limited per-tenant carve-outs.

---

## Metrics

### Per-service RED metrics (auto-instrumented)
- `http_requests_total{service,route,method,status}`
- `http_request_duration_seconds{service,route,method}` (histogram, p50/p95/p99)
- `http_requests_in_flight{service}`

### Per-service event metrics
- `pubsub_messages_received_total{subscription}`
- `pubsub_message_processing_duration_seconds{subscription}`
- `pubsub_messages_acked_total{subscription,status=ok|nack|deadletter}`

### Domain metrics
- `audits_completed_total{tenant_plan}` — counter
- `audits_duration_seconds{tenant_plan}` — histogram
- `posts_generated_total{platform,content_type}` — counter
- `posts_published_total{platform,status=success|failed}` — counter
- `image_generation_duration_seconds{provider=stability|dalle}` — histogram
- `gemini_tokens_used_total{model,service}` — counter (for cost monitoring)
- `stripe_subscriptions_active{plan}` — gauge

### Implementation
- Node: `prom-client` exposed on `/metrics` (scraped by Cloud Monitoring via a sidecar / via OTel Collector)
- Python: `prometheus-client` similarly

Or skip Prometheus entirely and use **OpenTelemetry Metrics SDK → Cloud Monitoring exporter** directly. Recommended path: OTel SDK end-to-end.

---

## Tracing

### What gets traced
- Every HTTP request (auto-instrumented)
- Every outbound HTTP call (axios, httpx)
- Every Prisma query > 50ms
- Every Pub/Sub publish + consume
- Every Gemini / Stability / OpenAI call (as a span with `gen_ai.*` attributes)

### Tools
- **OpenTelemetry SDK** in every service
- Exporter: Cloud Trace
- Propagation: W3C `traceparent` header on HTTP; custom `traceparent` attribute on Pub/Sub messages

### Why this matters for AURA
The pipeline goes: onboarding → audit → competitor → strategy → content → review → publish → analytics. A single tenant's calendar generation touches 5+ services. Without traces, debugging "why is this tenant's strategy stuck?" is an archaeology dig. With traces, it's one click in Cloud Trace.

---

## Sentry

Frontend + every backend service has Sentry. Captures:
- Unhandled exceptions
- Promise rejections
- Frontend JS errors with sourcemaps

Tag every Sentry event with `tenantId` (via Sentry scope set by tenant middleware). On Sentry: alert if a new tenant ID appears in error context within 5 minutes of their signup (likely onboarding bug).

---

## Alerts (Cloud Monitoring)

Wired in Terraform. Minimum set:

| Alert | Condition | Severity |
|---|---|---|
| Service down | Cloud Run instance count = 0 for > 5 min | P1 |
| Error rate spike | `http_requests_total{status=5xx}` rate > 1% over 5 min | P1 |
| DB CPU | Cloud SQL CPU > 80% for 5 min | P2 |
| DB connections near limit | > 80% of max_connections | P2 |
| Slow queries | Postgres slow query > 1s sustained | P2 |
| Pub/Sub backlog | oldest unacked > 5 min | P1 |
| Dead-letter activity | message rate > 0 over 1 hour | P2 |
| Audit SLA breach | p95 audit duration > 4h | P2 |
| Publish failures | post.published failure rate > 5% | P1 |
| Gemini quota near | gemini_tokens_used > 80% of monthly budget | P3 |
| Stripe webhook failures | webhook handler 4xx/5xx > 1% | P1 |
| Budget overrun | Cloud Billing alert > 80% of cap | P2 |

Routing:
- P1 → PagerDuty / phone call (you, until team grows)
- P2 → Slack #alerts
- P3 → Slack #alerts-quiet

---

## Dashboards

Cloud Monitoring dashboards, one per service + a few cross-cutting:

1. **Platform overview** — total tenants, monthly audits, posts published, ER trend
2. **Service health** — RED metrics per service in a grid
3. **DB** — Cloud SQL CPU, memory, connections, slow queries
4. **Pub/Sub** — backlog per subscription, ack rates, DLQ count
5. **External APIs** — call rate + p95 + error rate per provider
6. **Cost** — daily spend, top SKUs, projection vs. budget
7. **Per-tenant deep dive** — filterable by tenant_id, used for support tickets

---

## On-call runbooks

In `docs/runbooks/` (created during build):
- `audit-stuck-for-tenant.md`
- `post-failed-to-publish.md`
- `stripe-webhook-failing.md`
- `meta-api-rate-limited.md`
- `db-cpu-spike.md`
- `pubsub-dlq-growing.md`
- `tenant-cannot-login.md`

Each follows the same structure: symptom, dashboards to check, common causes, mitigation steps, escalation.

---

## Cost observability

- BigQuery daily export of Cloud Billing → a `cost_by_service_daily` view
- A Looker Studio dashboard pinned to Slack daily
- Custom metric: `cost_per_tenant_inr` = total daily cost / active tenants — early signal if unit economics drift

---

## Frontend observability

- Sentry browser SDK with sourcemaps
- Web Vitals reported (LCP, FID, CLS) → Cloud Monitoring custom metrics or PostHog
- Heatmaps / session replay: **NOT** for MVP (privacy + cost). Add in Phase 2 if needed.

---

## Definition of done

- [ ] Every service emits structured JSON logs
- [ ] Every service exports OTel traces; a trace for "signup → audit complete" shows all services
- [ ] All metrics in the inventory above are reporting
- [ ] All alerts in the table above are configured and tested (force-trigger each at least once)
- [ ] All 7 dashboards exist and load
- [ ] Sentry receiving errors from staging
- [ ] All 7 runbooks exist (can be one-pager each at first)
- [ ] Cost dashboard receiving daily exports

---

## AI Agent Prompt Template

```
You are wiring observability for AURA.

CONTEXT:
- Read .planning/15-observability-and-logging.md
- Read .planning/05-shared-packages.md (the logger lives in packages/utils)

DELIVERABLES (in order):
1. Implement packages/utils/logger.ts (pino-based, with the schema in the guide)
2. Python equivalent: a shared utils module in each Python service (or a small packages/utils-py for Python)
3. Wire OTel SDK into every Node service via a single boot-time helper
4. Wire OTel into every Python service
5. Set up the OTel → Cloud Trace exporter
6. Add custom metrics for the domain events listed in the guide
7. Provision Cloud Monitoring dashboards via Terraform
8. Provision alerts via Terraform
9. Write the 7 runbooks as Markdown stubs

CONSTRAINTS:
- Never log secrets or PII
- traceparent propagates across HTTP AND Pub/Sub
- Logger auto-includes tenantId from AsyncLocalStorage if present
- Dashboards in Terraform — no manual clicks

ASK FIRST:
- For per-tenant log filtering, do we expose a "tenant view" page or rely on Cloud Logging filters? (Recommend Cloud Logging filters for MVP; build a tenant view in Phase 1.5)
- Cost dashboard via Looker Studio or just a BigQuery saved query + Slack bot? (Recommend BigQuery + Slack bot; faster to build)
```
