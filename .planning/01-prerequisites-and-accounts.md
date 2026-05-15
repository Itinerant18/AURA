# 01 — Prerequisites and Accounts

**Goal:** Before any AI agent writes a line of code, every account, API key, and tool listed below must be ready. You (the architect/PM) own this checklist — agents cannot complete most of these.

**Time estimate:** 1 day, mostly waiting on approvals.

---

## 1. Cloud + Infrastructure

### Google Cloud Platform
- [ ] GCP account with billing enabled (Indian credit card or USD card)
- [ ] Two projects created: `aura-staging` and `aura-prod`
- [ ] Owner role on both projects assigned to you
- [ ] Default region set to **asia-south1** (Mumbai)
- [ ] Billing budget alerts configured at 50% / 80% / 100% of monthly cap (suggest Rs. 50,000/mo cap during build)
- [ ] APIs enabled (do this in `02-gcp-bootstrap.md`): Cloud Run, Cloud SQL, Pub/Sub, Memorystore, Secret Manager, Cloud Storage, Cloud Build, Artifact Registry, BigQuery, Cloud DNS, Cloud CDN

### Domain + DNS
- [ ] Domain registered (e.g., `aura.app`, `getaura.in`, or whatever)
- [ ] DNS pointed to Cloud DNS or kept at registrar with NS delegated
- [ ] Subdomains planned: `app.<domain>`, `api.<domain>`, `staging.<domain>`, `docs.<domain>`

### Source Control
- [ ] GitHub organization created (e.g., `aura-platform`)
- [ ] Private monorepo created: `aura-platform/aura`
- [ ] Branch protection rules on `main`: require PR review, require CI green
- [ ] GitHub Actions enabled
- [ ] Personal access token (classic, with `repo` and `workflow` scopes) for local CLI use

---

## 2. AI / ML APIs

### Google Gemini
- [ ] Google AI Studio account
- [ ] API key for **Gemini 1.5 Flash** (audit, captions, hashtags)
- [ ] API key for **Gemini 1.5 Pro** (strategy, competitor analysis)
- [ ] Quota requested: 60 RPM minimum for both models (default is 15 RPM)
- [ ] Billing enabled on the GCP project tied to AI Studio

### Image Generation
- [ ] Stability AI account + API key (Stable Image Core or Ultra)
- [ ] OpenAI account + API key with DALL-E 3 access enabled (for Growth/Agency tiers)
- [ ] Both keys tested with a curl request before saving

---

## 3. Social Platform Developer Accounts

### Meta (Instagram + Facebook)
- [ ] Meta for Developers account
- [ ] App created in **Business** mode (not Consumer)
- [ ] App ID + App Secret saved
- [ ] Products added: **Instagram Graph API**, **Facebook Login**, **Pages API**
- [ ] App review submitted for these permissions:
  - `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`
  - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_read_user_content`
  - `business_management`
- [ ] OAuth redirect URIs whitelisted: `https://app.<domain>/api/oauth/meta/callback`, `https://staging.<domain>/api/oauth/meta/callback`, and `http://localhost:3000/api/oauth/meta/callback` for dev
- [ ] Test Instagram Business + Facebook Page available (your own or a test fixture)

> **Meta app review takes 5–14 days.** Submit this on Day 0. Without it, you can build with a sandbox app but cannot launch.

### LinkedIn (read-only for MVP)
- [ ] LinkedIn Developer account
- [ ] App created with **Sign In with LinkedIn using OpenID Connect** + **Marketing Developer Platform** access requested
- [ ] App ID + Secret saved
- [ ] Same OAuth redirect URI pattern as Meta

### Twitter/X (read-only for MVP)
- [ ] X Developer account (Basic tier — $100/mo at time of writing)
- [ ] App created with read scope
- [ ] Bearer token + OAuth 1.0a or 2.0 client ID/secret saved

### Google Business Profile + Google Places
- [ ] GCP project has **My Business Business Information API** enabled
- [ ] **Places API** enabled (for competitor auto-discovery)
- [ ] OAuth 2.0 client ID created for the web app
- [ ] OAuth redirect URIs whitelisted (same pattern as above)

### Google Sheets
- [ ] **Google Sheets API** enabled on the GCP project
- [ ] **Google Drive API** enabled (Sheets requires Drive scopes)
- [ ] OAuth 2.0 client (can reuse the one from Google Business above)
- [ ] OR a service account if you prefer server-side write to a Sheet *you* own per tenant (not recommended; OAuth-per-tenant is cleaner)

---

## 4. Payments

### Stripe
- [ ] Stripe account in business mode
- [ ] India: PAN + GSTIN + bank account verification submitted (Stripe India onboarding takes 3–7 days)
- [ ] Test mode + Live mode keys saved separately
- [ ] Products created in Stripe dashboard:
  - "AURA Starter" — Rs. 1,999/mo recurring
  - "AURA Growth" — Rs. 4,999/mo recurring
  - "AURA Agency" — Rs. 14,999/mo recurring
- [ ] Webhook endpoint URL planned: `https://api.<domain>/billing/webhooks/stripe`
- [ ] Webhook signing secret saved (will be issued once endpoint is live)

---

## 5. Email + Notifications

### Transactional email
Choose one:
- [ ] **Resend** (recommended for speed) — account + API key + verified sending domain
- [ ] SendGrid — account + API key + verified domain + dedicated IP if volume > 10k/day
- [ ] AWS SES — account + API key + production access request submitted (out of sandbox)

Required regardless of provider:
- [ ] SPF, DKIM, DMARC records added to your DNS
- [ ] Sender domain warmed up if using a fresh domain

---

## 6. Monitoring + Observability

- [ ] **Sentry** account + project for `aura-web`, `aura-services-node`, `aura-services-python`
- [ ] **Google Cloud Operations** (Logging + Monitoring) — enabled by default with GCP project; no separate signup
- [ ] **Better Stack / Datadog / Grafana Cloud** (optional for first 30 days; Cloud Monitoring is enough)
- [ ] **Uptime Robot** or **Better Stack** for external uptime checks on `app.<domain>` and `api.<domain>`

---

## 7. Local Development Tools (you + every AI agent's sandbox)

Install on your machine, and ensure every AI agent can shell out to these:

- [ ] **Node.js 20 LTS** (use `nvm` or `fnm`)
- [ ] **pnpm 9+** (Turborepo monorepo package manager)
- [ ] **Python 3.12** (use `pyenv` or `uv`)
- [ ] **uv** (Python package manager, fast)
- [ ] **Docker Desktop** with at least 8 GB RAM allocated
- [ ] **gcloud CLI** authenticated to both projects
- [ ] **terraform** v1.7+ or **opentofu** v1.7+
- [ ] **gh** (GitHub CLI) authenticated
- [ ] **psql** (PostgreSQL client)
- [ ] **redis-cli**
- [ ] **VS Code** or your IDE of choice (Cursor is itself an IDE)
- [ ] **Cursor**, **Claude Code**, **Verdent**, **Codex** logged in and ready

---

## 8. Internal accounts + tracking

- [ ] Notion / Linear / GitHub Projects board for tracking phase-gate progress
- [ ] Shared Google Drive for screenshots, audit-report PDFs samples, and contracts
- [ ] Password manager (1Password / Bitwarden) — **every key above goes here, not in plaintext**
- [ ] A shared Slack or Discord for team comms (even if "team" is just you + agents — you'll want a log)

---

## 9. Legal / compliance (block launch, not build)

These do not block the build, but they block charging customers. Start in parallel:

- [ ] Privacy Policy drafted (covers GDPR + India DPDP)
- [ ] Terms of Service drafted
- [ ] DPA (Data Processing Agreement) template ready for Agency tier
- [ ] Cookie consent banner planned (required if EU traffic)
- [ ] Company registration (private limited or LLP) — if you don't already have one for invoicing

---

## Definition of done for this guide

- [ ] Every account on this list exists and is logged into the password manager
- [ ] Every API key on this list has been tested with a single curl request
- [ ] Meta app review submitted (acknowledge that approval will arrive later)
- [ ] Stripe India onboarding submitted
- [ ] Local dev tools all installed and verifiable with `--version`

When this checklist is fully green, you can move to `02-gcp-bootstrap.md`.

---

## AI Agent Prompt Template (for the few items an agent can help with)

> **Note:** Most items on this list require *you* to sign up — agents cannot create your accounts. But agents can help with the GCP API enabling and project setup once your billing is active.

Example prompt to feed any agent once you have a fresh GCP project:

```
You have access to my GCP CLI authenticated as <my-email>. I have two projects: aura-staging and aura-prod, both in asia-south1.

Enable these APIs in BOTH projects, using gcloud commands. Report each enable result.

APIs: run, sqladmin, pubsub, redis, secretmanager, storage, cloudbuild, artifactregistry, bigquery, dns, compute, iam, cloudresourcemanager, places, mybusinessbusinessinformation, sheets, drive.

After enabling, create a Cloud Storage bucket named aura-tf-state-<project> in each project for Terraform remote state. Output the bucket URLs and confirm versioning is enabled on both.

Do not create any other resources yet.
```
