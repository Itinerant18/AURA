# 12 — Infrastructure as Code (Terraform)

**Goal:** Every GCP resource declared in Terraform, deployable via CI, mirrored across staging and prod. Zero clicking in the GCP console after Phase 0 bootstrap.

**Prerequisite:** `02-gcp-bootstrap.md` (foundations exist in console).

**Owner:** AI agent for the modules; you review every plan output.

---

## Tooling

- **OpenTofu** or **Terraform** v1.7+ (pick OpenTofu for permissive license; behavior identical)
- **`tflint`** for linting
- **`checkov`** for security scanning
- **`tfsec`** for additional scans
- **Remote state:** GCS bucket from `02-gcp-bootstrap.md` Step 5
- **State locking:** GCS native locking (enabled when versioning + atomic uploads)

---

## Folder structure (under `infra/terraform/`)

```
infra/terraform/
  environments/
    staging/
      main.tf           — composes modules with staging-specific vars
      variables.tf
      terraform.tfvars  — staging values (committed; non-secret)
      backend.tf        — references gs://aura-tf-state-staging
    prod/
      ... mirror of staging
  modules/
    network/            — VPC, subnets, NAT, firewall, VPC connector
    cloud-sql/          — PostgreSQL instance + databases + users
    memorystore/        — Redis
    pubsub/             — topics + subscriptions
    storage/            — GCS buckets
    artifact-registry/  — Docker repos
    secret-access/      — IAM bindings for service-to-secret access
    cloud-run-service/  — reusable per-service module
    cloud-tasks/        — queues
    cloud-scheduler/    — cron jobs
    monitoring/         — alerts + dashboards
    dns/                — Cloud DNS zones + records
    cdn-lb/             — load balancer + CDN for frontend + API gateway
```

---

## State separation

Staging and prod have separate state files in separate buckets. Never share state.

State buckets:
- `gs://aura-tf-state-staging` (in `aura-staging` project)
- `gs://aura-tf-state-prod` (in `aura-prod` project)

---

## Module: `network`

Inputs: `project_id`, `region`, `name_prefix`
Outputs: `vpc_id`, `subnet_id`, `connector_name`, `nat_ip`

Resources:
- `google_compute_network` custom mode
- `google_compute_subnetwork` with PGA enabled
- `google_compute_router` + `google_compute_router_nat`
- `google_vpc_access_connector` for Cloud Run egress
- Firewall: deny-all default, allow internal, allow IAP SSH

---

## Module: `cloud-sql`

Inputs: tier, ha_enabled, project_id, region, network_id
Outputs: instance_connection_name, private_ip, database name

Resources:
- `google_sql_database_instance` with private IP, regional HA in prod
- `google_sql_database` "aura"
- `google_sql_user` "aura_app" with password from Secret Manager
- PITR enabled, daily backups
- Maintenance window: Sunday 04:00 IST

---

## Module: `memorystore`

Standard Redis 7. Inputs: tier, memory_size_gb, network_id, auth_enabled (true).

---

## Module: `pubsub`

Resources for each of the 8 topics in `06-event-bus-pubsub-map.md` plus all subscriptions. Subscription module accepts:
- topic_name
- subscription_name
- push_endpoint (URL of the consumer Cloud Run service `/_pubsub/...` route)
- service_account_email (the Cloud Run service's SA, for OIDC token signing)
- max_delivery_attempts (default 5)
- dead_letter_topic_name

---

## Module: `storage`

Three buckets per env: `aura-public-<env>`, `aura-private-<env>`, `aura-uploads-<env>`. Public bucket has public read + uniform bucket-level access disabled (need ACLs); private + uploads have ULBLA enabled.

---

## Module: `cloud-run-service` (the heavy one)

This is the workhorse. Inputs:
- `service_name`
- `image` — GAR image URL
- `region`
- `service_account_email`
- `vpc_connector`
- `env_vars` — map of non-secret env vars
- `secret_env_vars` — map of `ENV_VAR_NAME → secret_id` (resolved via `--update-secrets`)
- `min_instances`, `max_instances`
- `cpu`, `memory`
- `ingress` — `internal-and-cloud-load-balancing` or `all` (for the public-facing API gateway only)
- `allow_unauthenticated` — true only for webhook receivers (Stripe, Meta) and API gateway
- `concurrency` — default 80

Resources:
- `google_cloud_run_v2_service`
- IAM binding for invoker (Pub/Sub SA when this is a subscription target)

Per-service Terraform files compose this module:

```
modules/cloud-run-service/main.tf — the module
environments/staging/services/auth.tf — instance
environments/staging/services/audit.tf — instance
... etc for 12 services
```

---

## Module: `cloud-tasks`

Queues:
- `content-generation-queue` (max dispatches 10/s, max retries 3)
- `analytics-poll-queue` (low rate; 1 dispatch/s)

---

## Module: `cloud-scheduler`

Cron jobs:
- `audit-monthly-batch` — 1st of month, 02:00 IST → POST to audit-service `/internal/audit/run-batch`
- `digest-morning` — daily 09:00 IST → POST to notification-service `/internal/send-digests` (type=morning)
- `digest-evening` — daily 18:00 IST → notification-service (type=evening)
- `outbox-relay` — every 30 seconds → publish-service `/internal/relay-outbox`
- `publish-sweep-overdue` — every 5 minutes → publish-service `/internal/sweep-overdue`
- `token-expiry-check` — daily 02:00 IST → auth-service `/internal/check-token-expiries`

All use OIDC auth to authenticate to private Cloud Run services.

---

## Module: `dns`

- One Cloud DNS zone per environment
- A/AAAA records for `app`, `api`, `docs`, `staging.app`, `staging.api`
- TXT for SPF + DMARC
- DKIM records as CNAMEs pointing at Resend

---

## Module: `cdn-lb`

- HTTPS load balancer with managed SSL cert
- Backend bucket for static assets
- Backend service for Cloud Run API gateway
- Cloud CDN enabled on the static backend
- Custom URL map: `app.aura.app` → Next.js Cloud Run; `api.aura.app` → API gateway Cloud Run

---

## Module: `monitoring`

Per the baseline in `02-gcp-bootstrap.md` Step 12, plus:
- One dashboard per service with: requests/sec, p95 latency, error rate, instance count
- One DB dashboard: CPU, memory, connections, slow queries
- One Pub/Sub dashboard: oldest unacked age, ack rate, DLQ count
- SLO definitions: 99.5% successful audits over 28-day window, etc.

---

## Plan + apply workflow

1. Developer creates a PR with Terraform changes
2. CI runs `tflint`, `checkov`, `tfsec`
3. CI runs `terraform plan` against **staging** state → posts plan as PR comment
4. Reviewer approves
5. Merge to main → CD pipeline applies to staging automatically
6. Manual gate in CD: a separate "promote to prod" GitHub Action runs `terraform plan` against prod state → requires manual approval → applies to prod

---

## Naming conventions

- Resource names: `aura-<env>-<resource>-<purpose>` — e.g., `aura-prod-sql-main`, `aura-staging-pubsub-audit-completed`
- Labels (every resource): `env=<staging|prod>`, `service=<name>`, `managed_by=terraform`, `owner=platform`

---

## Drift detection

A weekly GitHub Action runs `terraform plan` against both environments. Any drift → opens a GitHub issue tagged `infra-drift`. You investigate; either reconcile by importing, or revert the manual change.

---

## Definition of done

- [ ] All 8 modules implemented
- [ ] Both `environments/staging/` and `environments/prod/` apply successfully
- [ ] `terraform plan` shows no drift after fresh apply
- [ ] Tests: `terraform validate` clean, `tflint` clean, `checkov` no high/critical findings
- [ ] CD pipeline auto-applies to staging on merge
- [ ] Prod apply requires manual approval
- [ ] All 12 services deployed via Terraform (not by hand)

---

## AI Agent Prompt Template

```
You are implementing AURA's Terraform IaC.

CONTEXT:
- Read .planning/12-infrastructure-terraform.md
- Read .planning/02-gcp-bootstrap.md (the foundations Terraform will assume exist)
- Read .planning/07-secrets-and-config-strategy.md (the secret-access matrix)
- Read .planning/06-event-bus-pubsub-map.md (the topics + subs to create)

Start with the foundational modules: network, cloud-sql, memorystore, storage, pubsub. Apply to staging FIRST and verify before touching prod.

DELIVERABLES IN ORDER:
1. Module skeleton + variables for `network` → apply to staging → confirm with me
2. Same for cloud-sql, memorystore, storage, pubsub, artifact-registry
3. Then cloud-run-service module + one service (start with auth-service) as a test
4. Then all 12 services
5. Then cloud-tasks, cloud-scheduler, monitoring, dns, cdn-lb

CONSTRAINTS:
- No `count` or `for_each` that creates cross-module loops — keep modules focused
- All variables typed (no `any`)
- Use `terraform_data` for one-off scripted setup, never `null_resource` with provisioner blocks
- `tflint` and `checkov` clean
- Every resource has the required labels

ASK FIRST:
- OpenTofu vs. Terraform? (Recommend OpenTofu; identical syntax, permissive license)
- For Cloud Run min_instances on staging, can it be 0 (cold starts ok)? (Recommend YES — saves ~$50/mo on staging)
- Should we use Cloud Deploy for canary releases in Phase 1.5? (Recommend: not for MVP; basic blue/green via Cloud Run revisions is enough)
```
