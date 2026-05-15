# 07 — Secrets and Config Strategy

**Goal:** A single, boring rule for where every secret and config value lives, so no key ever lands in a repo, no Cloud Run service starts without its secrets, and rotation is mechanical.

**Prerequisite:** `02-gcp-bootstrap.md` (Secret Manager skeleton exists).

**Owner:** You + AI agent.

**Time estimate:** ½ day.

---

## The rule

> **Secrets in Secret Manager. Config in environment variables. Nothing in the repo.**

- Anything sensitive (API keys, OAuth secrets, DB passwords, encryption keys, signing keys, webhook secrets): **Secret Manager**, mounted into Cloud Run as env vars at boot.
- Anything non-sensitive (region, log level, feature flags, rate limit thresholds): **env vars** baked into the Cloud Run service definition via Terraform.
- Anything in code: **non-existent secrets and non-secret defaults** — `.env.example` documents them with placeholders.

---

## Secret Manager inventory

(Mirrors `02-gcp-bootstrap.md` §7; restated here as the authoritative list.)

### AI / LLM
| Secret name | Used by | Rotation cadence |
|---|---|---|
| `gemini-flash-api-key` | audit, content (caption/hashtag) | 90 days |
| `gemini-pro-api-key` | strategy, competitor | 90 days |
| `stability-api-key` | content (image gen) | 90 days |
| `openai-api-key` | content (DALL-E fallback) | 90 days |

### Social platforms
| Secret name | Used by | Rotation cadence |
|---|---|---|
| `meta-app-id` | auth, audit, content, publish | On Meta dashboard rotation |
| `meta-app-secret` | auth, audit, content, publish | Quarterly |
| `linkedin-client-id` | auth, audit | Quarterly |
| `linkedin-client-secret` | auth, audit | Quarterly |
| `twitter-bearer-token` | audit, competitor | 90 days |
| `google-oauth-client-id` | auth, sheets | Quarterly |
| `google-oauth-client-secret` | auth, sheets | Quarterly |

### Payments
| Secret name | Used by | Rotation cadence |
|---|---|---|
| `stripe-secret-key` | billing | On compromise only |
| `stripe-webhook-secret` | billing | On Stripe rotation |

### Notifications
| Secret name | Used by | Rotation cadence |
|---|---|---|
| `resend-api-key` (or `sendgrid-api-key`) | notification | 90 days |

### Internal crypto
| Secret name | Used by | Rotation cadence |
|---|---|---|
| `db-encryption-key` | all services that read/write OAuth tokens | 12 months (with v1/v2 dual-decode window) |
| `jwt-private-key` | auth | 12 months (RS256) |
| `jwt-public-key` | every service (JWT verify) | 12 months |
| `db-app-password` | every service | 90 days |
| `redis-auth-string` | every service | 90 days |

> "Rotation cadence" is the **maximum** — rotate immediately on suspicion of compromise.

---

## Per-service secret access (least privilege)

The IAM bindings in Terraform grant each service's SA `secretmanager.secretAccessor` only on the specific secrets it needs. Reference matrix (used by `12-infrastructure-terraform.md`):

| Service | Secrets it can access |
|---|---|
| auth-service | `meta-app-*`, `linkedin-client-*`, `google-oauth-*`, `jwt-private-key`, `jwt-public-key`, `db-app-password`, `redis-auth-string`, `db-encryption-key` |
| onboarding-service | `db-app-password`, `redis-auth-string`, `jwt-public-key` |
| audit-service | `gemini-flash-api-key`, `meta-app-secret`, `linkedin-client-secret`, `twitter-bearer-token`, `db-app-password`, `db-encryption-key`, `jwt-public-key` |
| competitor-service | `gemini-pro-api-key`, `twitter-bearer-token`, `db-app-password`, `jwt-public-key` |
| strategy-service | `gemini-pro-api-key`, `db-app-password`, `jwt-public-key` |
| content-service | `gemini-flash-api-key`, `stability-api-key`, `openai-api-key`, `db-app-password`, `jwt-public-key` |
| review-service | `db-app-password`, `redis-auth-string`, `jwt-public-key`, `gemini-flash-api-key` (for regen) |
| publish-service | `meta-app-secret`, `db-app-password`, `db-encryption-key`, `redis-auth-string`, `jwt-public-key` |
| sheets-service | `google-oauth-*`, `db-app-password`, `db-encryption-key`, `jwt-public-key` |
| analytics-service | `meta-app-secret`, `db-app-password`, `db-encryption-key`, `jwt-public-key` |
| notification-service | `resend-api-key`, `db-app-password`, `jwt-public-key` |
| billing-service | `stripe-secret-key`, `stripe-webhook-secret`, `db-app-password`, `jwt-public-key` |

> If a service needs a secret not listed here, **update this file and the Terraform binding together** — never grant access outside this matrix.

---

## How services read secrets

Two modes:

### Mode A — Mounted as env vars (preferred)
In the Cloud Run service definition, secrets are referenced as `--update-secrets=ENV_VAR_NAME=secret-name:latest`. The service code reads `process.env.ENV_VAR_NAME` or `os.environ["ENV_VAR_NAME"]`. Cloud Run resolves the secret value at container start. No client SDK needed inside the service.

This is the default for **everything** except `db-encryption-key` and `jwt-private-key`.

### Mode B — Fetched at runtime via SDK (for key rotation)
`db-encryption-key` and `jwt-private-key` are fetched via the Secret Manager SDK at boot, cached for 1 hour, and re-fetched periodically. This lets us rotate keys without redeploy — the service picks up the new version within the hour.

Use `getSecret(name)` from `packages/utils/secrets.ts`.

---

## Non-secret configuration (env vars)

Set directly on each Cloud Run service in Terraform. Examples:

| Var | Example | Used by |
|---|---|---|
| `NODE_ENV` | `production` | all Node services |
| `LOG_LEVEL` | `info` | all |
| `REGION` | `asia-south1` | all |
| `DATABASE_URL` | `postgresql://aura_app@<priv-ip>:5432/aura` (password injected separately) | all that touch DB |
| `REDIS_URL` | `rediss://<priv-ip>:6378` | services that cache |
| `PUBSUB_TOPIC_AUDIT_COMPLETED` | `projects/aura-prod/topics/audit.completed` | publishers |
| `GCS_BUCKET_PUBLIC` | `aura-public-prod` | services that write images/PDFs |
| `GCS_BUCKET_PRIVATE` | `aura-private-prod` | services that write reports |
| `FRONTEND_ORIGIN` | `https://app.aura.app` | auth (cookie domain), notification (email links) |
| `OPTIMAL_POST_TIMES_IST` | JSON array of optimal hours per platform | publish-service |
| `RATE_LIMIT_DEFAULT_RPM` | `100` | auth-service rate limiter |

`.env.example` at the repo root lists every var any service reads, with example values (and `__SECRET__` placeholder for secret-backed vars). AI agents should treat `.env.example` as part of the spec — adding a new env var without updating it is a PR blocker.

---

## Local dev secrets

Local services read from `.env.local` (gitignored). This file is generated from `.env.example` by a helper script you run once per machine.

For secrets like Gemini API keys: you paste your dev API keys into `.env.local`. **Never** commit `.env.local`.

For internal crypto (DB encryption key, JWT keys): the helper script generates random local-only values on first run.

---

## Rotation procedures

### Rotating an external API key (e.g., Gemini)
1. Issue a new key from the provider's console
2. `gcloud secrets versions add gemini-flash-api-key --data-file=- <<<<"<new-key>"`
3. Cloud Run picks up new value on next instance start (because secrets are mounted as env vars). To force: `gcloud run services update <svc> --update-env-vars=ROTATION_TICK=$(date +%s)`
4. Verify health checks pass
5. Disable the old version after 24 hours: `gcloud secrets versions disable gemini-flash-api-key --version=N`

### Rotating `db-encryption-key` (special — must support dual-decode)
1. Add new version (v2) to Secret Manager
2. `encrypt.ts` reads both v1 and v2 keys at boot; uses v2 for *new* writes, supports both for *reads*
3. Background job re-encrypts all `social_accounts.access_token` and `refresh_token` rows with v2 over ~24 hours
4. After verification, disable v1

### Rotating JWT signing keys
1. Issue new keypair (RS256)
2. Auth-service serves a JWKS endpoint at `/.well-known/jwks.json` with both old and new public keys
3. New JWTs signed with new private key; old JWTs still verify against old public key
4. After 24 hours (longest JWT lifetime + buffer), remove old public key from JWKS

---

## Audit trail

Every secret access by a service is logged automatically by GCP Audit Logs. We do not need additional instrumentation. Quarterly review: anyone accessed a secret outside the expected service? Investigate.

---

## Definition of done

- [ ] All secrets in the inventory exist in both `aura-staging` and `aura-prod` Secret Manager
- [ ] Each service's SA has `secretmanager.secretAccessor` only on its allowed secrets (matrix above)
- [ ] `.env.example` documents every env var any service reads
- [ ] `packages/utils/secrets.ts` implements `getSecret(name)` with TTL caching
- [ ] Local dev helper script creates `.env.local` and random local crypto values
- [ ] A rotation drill: rotate `gemini-flash-api-key` in staging without service restart, verify content-service still calls Gemini successfully

---

## AI Agent Prompt Template

```
You are wiring secrets for AURA services.

CONTEXT:
- Read .planning/07-secrets-and-config-strategy.md
- Read .planning/02-gcp-bootstrap.md §7 (the secret inventory)
- Read .planning/05-shared-packages.md (getSecret helper spec)

DELIVERABLES:
1. Implement packages/utils/secrets.ts with getSecret(name) + 1-hour TTL cache
2. Update .env.example at repo root with EVERY env var listed in this guide
3. Write scripts/setup-local-env.sh that:
   - Copies .env.example → .env.local
   - Generates random AES-256 key for db-encryption-key
   - Generates RSA keypair for JWT signing
4. Write a Terraform module (in infra/terraform/modules/secret-access/) that takes a service name + list of allowed secrets and binds the IAM role
5. PR titled "feat(infra): secret access matrix + getSecret helper"

CONSTRAINTS:
- Never log a secret value (mask everything)
- getSecret retries on transient errors (max 3, exponential backoff)
- All secret names use kebab-case
- Service SA bindings strictly follow the matrix in this guide — do not grant extras

ASK FIRST:
- Should we add Vault as a fallback for the rare case Secret Manager is unreachable? (My recommendation: no, Secret Manager has 99.95% SLA and adding Vault doubles ops surface — but raise if you disagree)
```
