# 02 — GCP Bootstrap

**Goal:** Stand up a clean GCP foundation in both `aura-staging` and `aura-prod` projects: enabled APIs, service accounts, Terraform state bucket, Artifact Registry, and Secret Manager skeleton.

**Prerequisite:** `01-prerequisites-and-accounts.md` complete (both projects exist, billing active, you are Owner).

**Time estimate:** 4–6 hours.

**Owner:** You (with an AI agent shadowing on the CLI).

---

## Step 1 — Authenticate locally

- [ ] `gcloud auth login` (browser flow)
- [ ] `gcloud auth application-default login` (so Terraform and SDKs can use ADC)
- [ ] `gcloud config configurations create aura-staging` then `gcloud config set project aura-staging`
- [ ] Same for `aura-prod`
- [ ] Verify: `gcloud config configurations list` shows both

---

## Step 2 — Enable APIs (both projects)

Required APIs:
- `run.googleapis.com` — Cloud Run
- `sqladmin.googleapis.com` — Cloud SQL
- `pubsub.googleapis.com` — Pub/Sub
- `redis.googleapis.com` — Memorystore
- `secretmanager.googleapis.com` — Secret Manager
- `storage.googleapis.com` — Cloud Storage
- `cloudbuild.googleapis.com` — Cloud Build
- `artifactregistry.googleapis.com` — Docker images
- `bigquery.googleapis.com` — Analytics warehouse
- `dns.googleapis.com` — Cloud DNS
- `compute.googleapis.com` — VPC, load balancers
- `iam.googleapis.com` + `iamcredentials.googleapis.com` — service accounts + token generation
- `cloudresourcemanager.googleapis.com` — project metadata
- `serviceusage.googleapis.com`
- `places.googleapis.com` — competitor discovery
- `mybusinessbusinessinformation.googleapis.com` — GBP audit
- `sheets.googleapis.com` + `drive.googleapis.com` — Sheets export
- `monitoring.googleapis.com` + `logging.googleapis.com` + `cloudtrace.googleapis.com`

- [ ] All enabled in staging
- [ ] All enabled in prod

---

## Step 3 — Networking

For each project:
- [ ] Create custom VPC `aura-vpc` in asia-south1
- [ ] Subnet `aura-private` (e.g., `10.10.0.0/20`) with Private Google Access enabled
- [ ] Reserve a `/16` for VPC peering with Memorystore + Cloud SQL
- [ ] **VPC Connector** for Cloud Run → private services (`aura-vpc-connector`)
- [ ] Cloud NAT for outbound traffic (so Cloud Run egress has a stable IP for Meta API allow-listing if needed)
- [ ] Firewall rules:
  - Default deny all
  - Allow internal traffic within `aura-vpc`
  - Allow IAP SSH (`35.235.240.0/20`) for emergency console access

> Keep CIDR ranges identical in staging and prod to avoid Terraform divergence.

---

## Step 4 — Service accounts

Create one service account *per microservice*, plus a few shared SAs. Naming convention: `sa-<service>-<env>@<project>.iam.gserviceaccount.com`.

Per service:
- [ ] `sa-auth-svc`, `sa-onboarding-svc`, `sa-audit-svc`, `sa-competitor-svc`, `sa-strategy-svc`, `sa-content-svc`, `sa-review-svc`, `sa-publish-svc`, `sa-sheets-svc`, `sa-analytics-svc`, `sa-notification-svc`, `sa-billing-svc`

Shared:
- [ ] `sa-cloudbuild-deployer` — used by CI/CD to deploy Cloud Run revisions
- [ ] `sa-terraform-runner` — runs IaC in CI
- [ ] `sa-frontend-web` — for the Next.js app

Roles to assign (per service, minimum viable):
- `roles/run.invoker` — call other internal services
- `roles/pubsub.publisher` and `roles/pubsub.subscriber` (scoped to specific topics in Terraform)
- `roles/secretmanager.secretAccessor` — fetch secrets at boot
- `roles/cloudsql.client` — connect to Cloud SQL
- `roles/storage.objectUser` — scoped to the service's bucket prefix
- `roles/logging.logWriter` + `roles/monitoring.metricWriter`

> Do not grant `roles/editor` or `roles/owner` to any service SA. If you find yourself needing it, the role binding is wrong.

---

## Step 5 — Terraform state bucket

Per project:
- [ ] `gsutil mb -l asia-south1 -b on gs://aura-tf-state-<project>`
- [ ] Enable versioning: `gsutil versioning set on gs://aura-tf-state-<project>`
- [ ] Enable Object Lock or lifecycle rule: keep 50 versions, delete after 90 days
- [ ] Grant `sa-terraform-runner` the `roles/storage.objectAdmin` role on this bucket only

---

## Step 6 — Artifact Registry

- [ ] Create Docker repo `aura-images` in asia-south1 for each project
- [ ] Grant `sa-cloudbuild-deployer` the `roles/artifactregistry.writer` role
- [ ] Grant each Cloud Run service SA `roles/artifactregistry.reader`

---

## Step 7 — Secret Manager skeleton

Create empty secrets (you'll fill the values in `07-secrets-and-config-strategy.md`). Naming: `<env>-<purpose>`.

Required for MVP:
- [ ] `gemini-flash-api-key`
- [ ] `gemini-pro-api-key`
- [ ] `stability-api-key`
- [ ] `openai-api-key`
- [ ] `meta-app-id` + `meta-app-secret`
- [ ] `linkedin-client-id` + `linkedin-client-secret`
- [ ] `twitter-bearer-token`
- [ ] `google-oauth-client-id` + `google-oauth-client-secret`
- [ ] `stripe-secret-key` + `stripe-webhook-secret`
- [ ] `resend-api-key` (or `sendgrid-api-key`)
- [ ] `db-encryption-key` — 32-byte random for AES-256-GCM token encryption
- [ ] `jwt-signing-key` — RS256 keypair (separate secret each for public and private)
- [ ] `db-app-password` — Cloud SQL app role password

Each service SA gets `secretmanager.secretAccessor` only on the specific secrets it needs (see service specs in `09-service-specs/`).

---

## Step 8 — Cloud SQL (PostgreSQL 16)

For each project:
- [ ] Create instance `aura-pg-<env>`
  - PostgreSQL 16
  - Region: asia-south1
  - HA: regional (zonal for staging is fine; **regional for prod**)
  - Machine type: `db-custom-2-7680` for staging (2 vCPU, 7.5 GB); `db-custom-4-15360` for prod
  - Storage: 50 GB SSD, auto-increase enabled
  - Private IP enabled, peered with `aura-vpc`
  - Public IP **disabled**
  - Backups: daily at 02:00 IST, retain 7 days
  - Point-in-time recovery enabled
  - Maintenance window: Sundays 04:00 IST
- [ ] Create database `aura`
- [ ] Create user `aura_app` with password from `db-app-password` secret
- [ ] Verify connection from a Cloud Run test instance or via Cloud SQL Auth Proxy

> Do not run Prisma migrations yet. Schema build comes in `04-database-schema-and-prisma.md`.

---

## Step 9 — Memorystore (Redis 7)

Per project:
- [ ] Instance `aura-redis-<env>`
  - Tier: Basic (staging) / Standard (prod, for HA)
  - 1 GB capacity for MVP
  - VPC: `aura-vpc`
  - Auth enabled (saves auth string to Secret Manager as `redis-auth-string`)
  - TLS enabled

---

## Step 10 — Cloud Storage buckets

Per project:
- [ ] `aura-public-<env>` — public CDN bucket for generated images that are linked into Instagram/Facebook posts
  - Public read enabled
  - Lifecycle: delete versions after 90 days
- [ ] `aura-private-<env>` — private bucket for PDFs (audit reports), competitor scraping snapshots
  - Private only; access via signed URLs
- [ ] `aura-uploads-<env>` — temporary user uploads (menu photos during onboarding)
  - Lifecycle: delete after 7 days unless promoted

---

## Step 11 — Pub/Sub topics

Create the 6 topics from architecture doc §1.2:
- [ ] `audit.completed`
- [ ] `competitor.report.ready`
- [ ] `strategy.generated`
- [ ] `post.ready`
- [ ] `post.approved`
- [ ] `post.published`

Plus operational topics:
- [ ] `aura.deadletter` — DLQ for all subscriptions
- [ ] `aura.audit-log` — internal audit trail of cross-tenant actions

Subscriptions will be created per consumer service in `06-event-bus-pubsub-map.md`.

---

## Step 12 — Monitoring + Alerting baseline

- [ ] Default Cloud Monitoring workspace linked to both projects
- [ ] Notification channel: your email + a webhook to Slack/Discord
- [ ] Baseline alerts:
  - Cloud SQL CPU > 80% for 5 min
  - Cloud Run 5xx error rate > 1% for 5 min
  - Pub/Sub oldest unacked message age > 5 min
  - Cloud Run instance count = 0 for a critical service for >10 min after deploy
  - Cost forecast > 100% of monthly budget

---

## Definition of done

- [ ] Both projects pass `gcloud asset search-all-resources --scope=projects/<project>` with no `default` networks
- [ ] All 12 service accounts exist
- [ ] All required APIs enabled
- [ ] Cloud SQL instances reachable from a test VM in `aura-vpc`
- [ ] Redis instances reachable from a test VM
- [ ] All buckets created
- [ ] All 8 Pub/Sub topics created
- [ ] Empty Secret Manager skeleton in place

When green, move to `03-repo-and-monorepo-bootstrap.md`.

---

## AI Agent Prompt Template

Use this when handing the bootstrap to any agent:

```
You are setting up GCP infrastructure scaffolding for AURA.

CONTEXT:
- Read .planning/02-gcp-bootstrap.md fully before starting
- Read DOSC/AURA_Architecture_CodeStructure.md §1 for the layer architecture
- I have two projects: aura-staging and aura-prod, region asia-south1
- I am authenticated as Owner on both

GOAL:
Complete Steps 2 through 7 of the bootstrap guide using gcloud CLI commands. Do NOT use Terraform yet — that comes later. We are creating the prerequisites Terraform will assume exist.

CONSTRAINTS:
- No public IPs on databases
- Service accounts must not have roles/editor or roles/owner
- All resources tagged with labels: env=<staging|prod>, owner=platform, project=aura
- Output a markdown report at .planning/_bootstrap-run-<timestamp>.md listing every resource created and its ID

QUESTIONS BEFORE STARTING:
- Confirm my email is logged in via `gcloud auth list`
- Confirm both projects are visible via `gcloud projects list`
- If anything is missing, stop and ask me — do not proceed
```
