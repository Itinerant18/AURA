**AURA**

**System Architecture, Code Structure & Database Design**

Engineering Reference \| Version 1.0 \| May 2026

  -----------------------------------------------------------------------
  *This document covers the complete system architecture diagram,
  monorepo code structure, microservice layout, and full PostgreSQL
  database ERD for the AURA AI Marketing Automation Platform.*

  -----------------------------------------------------------------------

**1. System Architecture**

AURA is built on an 8-layer architecture. Each layer has a single
responsibility. Data flows top-down through the layers; events flow
asynchronously via the Pub/Sub message queue between microservices.

  ------------------ -------------------------------------------------------
  **Layer**          **Components & Technology**

  **1. Client**      Web App (Next.js + React) · iOS App · Android App
                     (Phase 2) · Responsive PWA

  **2. API Gateway** Kong / AWS API Gateway · JWT validation · Rate limiting
                     (100 req/min/user) · Request routing · CORS whitelist

  **3.               12 independent services on Cloud Run · Node.js
  Microservices**    (Express) for API services · Python (FastAPI) for AI/ML
                     services · Horizontal auto-scaling

  **4. Message       Google Pub/Sub · At-least-once delivery · 7-day message
  Queue**            retention · Typed event contracts · Idempotent handlers

  **5. AI / ML**     Google Gemini 1.5 Flash (captions, hashtags, audit) ·
                     Gemini 1.5 Pro (strategy, competitor analysis) ·
                     LangChain orchestration · Stability AI / DALL-E (image
                     generation)

  **6. Data**        PostgreSQL 16 --- primary database (Cloud SQL) · Redis
                     7 --- cache + job queues · Google Cloud Storage ---
                     images, PDFs, videos · BigQuery --- analytics warehouse

  **7. External      Meta Graph API v20 (Instagram, Facebook) · LinkedIn API
  APIs**             v2 · Twitter/X API v2 · Google Sheets API · Google
                     Business Profile API · Stripe (billing)

  **8.               GCP Cloud Run (serverless containers) · Cloud SQL
  Infrastructure**   (managed PostgreSQL) · Memorystore (Redis) · Secret
                     Manager · Cloud CDN · Cloud Build CI/CD
  ------------------ -------------------------------------------------------

**1.1 Microservices Overview**

All 12 services are independently deployable on Cloud Run. They
communicate synchronously via REST for user-facing requests and
asynchronously via Pub/Sub for background processing pipelines.

**Core services (Node.js)**

+-------------+-------------+-------------+-------------+-------------+
| **auth**    | **o         | **review**  | **publish** | **sheets**  |
|             | nboarding** |             |             |             |
| JWT ·       |             | Human queue | Schedule ·  | Calendar    |
| OAuth2      | Profile ·   |             | Post        | sync        |
|             | Social link |             |             |             |
+-------------+-------------+-------------+-------------+-------------+

**AI pipeline services (Python / FastAPI)**

+-------------+-------------+-------------+-------------+-------------+
| **audit**   | **c         | *           | **content** | **          |
|             | ompetitor** | *strategy** |             | analytics** |
| Score ·     |             |             | AI post gen |             |
| Report      | Scrape ·    | 30-day plan |             | Metrics ·   |
|             | Analyse     |             |             | Report      |
+-------------+-------------+-------------+-------------+-------------+

**Supporting services (Node.js)**

+-----------------------------------+-----------------------------------+
| **notification**                  | **billing**                       |
|                                   |                                   |
| Email · Push alerts               | Stripe subscriptions              |
+-----------------------------------+-----------------------------------+

**1.2 Event Flow (Pub/Sub)**

The full content automation pipeline is event-driven. Each service
publishes an event when it completes its work, triggering the next
service automatically.

  ------------------------- -------------------- ------------------- ----------------------
  **Event Name**            **Published by**     **Consumed by**     **Trigger**

  audit.completed           audit-service        strategy-service    Audit report generated

  competitor.report.ready   competitor-service   strategy-service    Competitor analysis
                                                                     done

  strategy.generated        strategy-service     content-service     30-day plan ready

  post.ready                content-service      review-service      AI post created

  post.approved             review-service       publish-service     Human approved post

  post.published            publish-service      analytics-service   Post went live
  ------------------------- -------------------- ------------------- ----------------------

**1.3 Service Communication Patterns**

-   Synchronous REST: Frontend → API Gateway → any service (user-facing
    reads and writes)

-   Async Pub/Sub: All multi-step pipeline operations (audit → strategy
    → content → review → publish)

-   Service-to-service: Internal REST calls on private VPC network (no
    TLS overhead internally)

-   Auth validation: Every request validated by auth-service via JWT
    middleware at API Gateway level

**2. Monorepo Code Structure**

  -----------------------------------------------------------------------
  *AURA uses a Turborepo monorepo with pnpm workspaces. All services, the
  frontend app, and shared packages live in one repository. This enables
  shared TypeScript types, coordinated CI/CD, and atomic commits across
  services.*

  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  aura/ ← monorepo root

  -----------------------------------------------------------------------

**2.1 Apps --- Deployable Applications**

+-----------------------------------------------------------------------+
| 📁 apps/ *--- deployable services*                                    |
|                                                                       |
| 📁 **web/** **Next.js** *--- React frontend*                          |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| 📁 app/ *--- Next.js app router (pages)*                              |
|                                                                       |
| 📁 (dashboard)/                                                       |
|                                                                       |
| 📁 (onboarding)/                                                      |
|                                                                       |
| 📁 (review)/                                                          |
|                                                                       |
| 📁 components/                                                        |
|                                                                       |
| 📁 audit/ *--- AuditScoreCard, ReportViewer*                          |
|                                                                       |
| 📁 calendar/ *--- CalendarGrid, PostSlot*                             |
|                                                                       |
| 📁 review/ *--- ReviewQueue, PostPreview*                             |
|                                                                       |
| 📁 publish/ *--- PublishConfirm, StatusBadge*                         |
|                                                                       |
| 📁 ui/ *--- Button, Card, Modal, Badge*                               |
|                                                                       |
| 📁 hooks/ *--- useAudit, useCalendar, useReview*                      |
|                                                                       |
| 📁 lib/                                                               |
|                                                                       |
| api-client.ts *--- Axios instance + typed API calls*                  |
|                                                                       |
| auth.ts *--- NextAuth config*                                         |
|                                                                       |
| utils.ts                                                              |
|                                                                       |
| 📁 store/ *--- Zustand global state slices*                           |
|                                                                       |
| next.config.ts                                                        |
|                                                                       |
| tailwind.config.ts                                                    |
|                                                                       |
| Dockerfile                                                            |
+-----------------------------------------------------------------------+

**2.2 Services --- Microservices**

+-----------------------------------------------------------------------+
| 📁 services/                                                          |
|                                                                       |
| 📁 **auth-service/** **Node.js** *--- JWT + OAuth2 + session*         |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| index.ts *--- Express app entry*                                      |
|                                                                       |
| 📁 routes/ *--- auth, oauth, refresh*                                 |
|                                                                       |
| 📁 middleware/ *--- jwtVerify, rateLimit*                             |
|                                                                       |
| 📁 models/ *--- user, session*                                        |
|                                                                       |
| Dockerfile                                                            |
|                                                                       |
| package.json                                                          |
|                                                                       |
| 📁 **audit-service/** **Python** *--- Social media scoring + report   |
| gen*                                                                  |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| main.py *--- FastAPI app*                                             |
|                                                                       |
| 📁 scoring/                                                           |
|                                                                       |
| engagement.py                                                         |
|                                                                       |
| profile.py                                                            |
|                                                                       |
| hashtag.py                                                            |
|                                                                       |
| content_mix.py                                                        |
|                                                                       |
| 📁 report/                                                            |
|                                                                       |
| pdf_generator.py                                                      |
|                                                                       |
| templates/                                                            |
|                                                                       |
| 📁 social/                                                            |
|                                                                       |
| meta_client.py                                                        |
|                                                                       |
| linkedin_client.py                                                    |
|                                                                       |
| twitter_client.py                                                     |
|                                                                       |
| Dockerfile                                                            |
|                                                                       |
| requirements.txt                                                      |
|                                                                       |
| 📁 **competitor-service/** **Python** *--- Web scraping + analysis*   |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| main.py                                                               |
|                                                                       |
| 📁 discovery/                                                         |
|                                                                       |
| google_places.py                                                      |
|                                                                       |
| social_scraper.py                                                     |
|                                                                       |
| 📁 analysis/                                                          |
|                                                                       |
| benchmarks.py                                                         |
|                                                                       |
| pros_cons.py                                                          |
|                                                                       |
| 📁 **strategy-service/** **Python** *--- LangChain + Gemini Pro*      |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| main.py                                                               |
|                                                                       |
| 📁 chains/ *--- LangChain chain definitions*                          |
|                                                                       |
| strategy_chain.py                                                     |
|                                                                       |
| calendar_chain.py                                                     |
|                                                                       |
| 📁 prompts/ *--- System prompt text files*                            |
|                                                                       |
| strategy_system.txt                                                   |
|                                                                       |
| calendar_system.txt                                                   |
|                                                                       |
| gemini_client.py                                                      |
|                                                                       |
| 📁 **content-service/** **Python** *--- Post + image generation*      |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| 📁 generators/                                                        |
|                                                                       |
| caption.py                                                            |
|                                                                       |
| hashtags.py                                                           |
|                                                                       |
| image_prompt.py                                                       |
|                                                                       |
| video_script.py                                                       |
|                                                                       |
| 📁 image/                                                             |
|                                                                       |
| stability_client.py                                                   |
|                                                                       |
| dalle_client.py                                                       |
|                                                                       |
| upscaler.py                                                           |
|                                                                       |
| 📁 **review-service/** **Node.js** *--- Human review workflow*        |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| index.ts                                                              |
|                                                                       |
| 📁 routes/ *--- queue, approve, reject, regen*                        |
|                                                                       |
| 📁 queue/ *--- BullMQ review queue*                                   |
|                                                                       |
| 📁 **publish-service/** **Node.js** *--- Scheduling + publishing*     |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| 📁 publishers/                                                        |
|                                                                       |
| instagram.ts                                                          |
|                                                                       |
| facebook.ts                                                           |
|                                                                       |
| linkedin.ts                                                           |
|                                                                       |
| twitter.ts                                                            |
|                                                                       |
| 📁 queue/                                                             |
|                                                                       |
| scheduler.ts *--- BullMQ scheduled jobs*                              |
|                                                                       |
| retry.ts                                                              |
|                                                                       |
| 📁 **sheets-service/** **Node.js** *--- Google Sheets sync*           |
|                                                                       |
| 📁 src/                                                               |
|                                                                       |
| sheets-client.ts                                                      |
|                                                                       |
| calendar-writer.ts                                                    |
|                                                                       |
| analytics-writer.ts                                                   |
|                                                                       |
| 📁 **analytics-service/** **Python** *--- Post performance tracking*  |
|                                                                       |
| 📁 **notification-service/** **Node.js** *--- Email + push*           |
|                                                                       |
| 📁 **billing-service/** **Node.js** *--- Stripe integration*          |
+-----------------------------------------------------------------------+

**2.3 Shared Packages**

+-----------------------------------------------------------------------+
| 📁 packages/ *--- shared code across services*                        |
|                                                                       |
| 📁 db/ *--- Prisma ORM schema + migrations*                           |
|                                                                       |
| schema.prisma *--- full DB schema*                                    |
|                                                                       |
| 📁 migrations/                                                        |
|                                                                       |
| 📁 types/ *--- shared TypeScript interfaces*                          |
|                                                                       |
| tenant.ts                                                             |
|                                                                       |
| post.ts                                                               |
|                                                                       |
| audit.ts                                                              |
|                                                                       |
| strategy.ts                                                           |
|                                                                       |
| 📁 queue/ *--- Pub/Sub event type definitions*                        |
|                                                                       |
| events.ts *--- typed event contracts*                                 |
|                                                                       |
| pubsub.ts *--- publisher/subscriber helpers*                          |
|                                                                       |
| 📁 utils/                                                             |
|                                                                       |
| encrypt.ts *--- AES-256-GCM token encryption*                         |
|                                                                       |
| logger.ts *--- structured JSON logging*                               |
|                                                                       |
| validator.ts                                                          |
+-----------------------------------------------------------------------+

**2.4 Infrastructure & CI/CD**

+-----------------------------------------------------------------------+
| 📁 infra/                                                             |
|                                                                       |
| 📁 **terraform/** **IaC** *--- GCP resource definitions*              |
|                                                                       |
| main.tf                                                               |
|                                                                       |
| cloud-run.tf *--- service deployments*                                |
|                                                                       |
| cloud-sql.tf *--- PostgreSQL instance*                                |
|                                                                       |
| pubsub.tf *--- topics + subscriptions*                                |
|                                                                       |
| storage.tf *--- GCS buckets*                                          |
|                                                                       |
| secrets.tf *--- Secret Manager resources*                             |
|                                                                       |
| 📁 k8s/ *--- Phase 2 --- GKE migration*                               |
|                                                                       |
| deployments.yaml                                                      |
|                                                                       |
| hpa.yaml *--- HorizontalPodAutoscaler*                                |
|                                                                       |
| services.yaml                                                         |
|                                                                       |
| 📁 docker/                                                            |
|                                                                       |
| docker-compose.yml *--- local dev --- all services*                   |
|                                                                       |
| 📁 **.github/workflows/** **CI/CD**                                   |
|                                                                       |
| test.yml *--- runs on every PR*                                       |
|                                                                       |
| deploy-staging.yml *--- runs on merge to main*                        |
|                                                                       |
| deploy-prod.yml *--- manual approval required*                        |
|                                                                       |
| turbo.json *--- Turborepo pipeline config*                            |
|                                                                       |
| pnpm-workspace.yaml                                                   |
|                                                                       |
| docker-compose.yml *--- top-level local dev shortcut*                 |
+-----------------------------------------------------------------------+

**3. Database Design (PostgreSQL ERD)**

  -----------------------------------------------------------------------
  *AURA uses PostgreSQL 16 as its primary database. Every table includes
  a tenant_id foreign key enforced at ORM level to ensure strict
  multi-tenant data isolation. All tables use UUID primary keys.*

  -----------------------------------------------------------------------

**3.1 Entity Relationship Summary**

  -------------------- ---------------------------- ---------------------------
  **Table**            **Description**              **Key Relations**

  tenants              Root multi-tenant entity --- Parent of all other tables
                       one per company              

  users                People who log in to AURA    belongs_to tenants
                       (owner, reviewer, viewer)    

  business_profiles    Business data: name,         one-to-one with tenants
                       category, menu, brand voice, 
                       USPs                         

  social_accounts      Linked social media accounts belongs_to tenants
                       with encrypted OAuth tokens  

  audit_reports        Monthly social media health  belongs_to tenants
                       scores (9 dimensions)        

  competitor_reports   Competitor analysis data --- belongs_to tenants
                       pros, cons, metrics          

  content_calendars    30-day strategy plan for a   belongs_to tenants
                       given month                  

  content_posts        Individual AI-generated post belongs_to
                       per calendar slot            content_calendars

  post_analytics       Engagement data per post     belongs_to content_posts
                       fetched from social          
                       platforms                    
  -------------------- ---------------------------- ---------------------------

**3.2 Full Table Schemas**

**tenants**

+-----------------------------------------------------------------------+
| CREATE TABLE tenants (                                                |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| name VARCHAR(255) NOT NULL,                                           |
|                                                                       |
| plan VARCHAR(50) DEFAULT \'starter\', \-- starter\|growth\|agency     |
|                                                                       |
| stripe_customer_id VARCHAR(255),                                      |
|                                                                       |
| is_active BOOLEAN DEFAULT TRUE,                                       |
|                                                                       |
| created_at TIMESTAMPTZ DEFAULT NOW(),                                 |
|                                                                       |
| updated_at TIMESTAMPTZ DEFAULT NOW()                                  |
|                                                                       |
| );                                                                    |
+-----------------------------------------------------------------------+

**users**

+-----------------------------------------------------------------------+
| CREATE TABLE users (                                                  |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,     |
|                                                                       |
| email VARCHAR(255) UNIQUE NOT NULL,                                   |
|                                                                       |
| role VARCHAR(50) DEFAULT \'owner\', \-- owner\|reviewer\|viewer       |
|                                                                       |
| password_hash VARCHAR(255),                                           |
|                                                                       |
| last_login_at TIMESTAMPTZ,                                            |
|                                                                       |
| created_at TIMESTAMPTZ DEFAULT NOW()                                  |
|                                                                       |
| );                                                                    |
|                                                                       |
| CREATE INDEX idx_users_tenant ON users(tenant_id);                    |
+-----------------------------------------------------------------------+

**business_profiles**

+-----------------------------------------------------------------------+
| CREATE TABLE business_profiles (                                      |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id),                |
|                                                                       |
| name VARCHAR(255) NOT NULL,                                           |
|                                                                       |
| category VARCHAR(100), \-- cafe\|salon\|gym\|retail\|\...             |
|                                                                       |
| location JSONB, \-- {city, state, country, lat, lng}                  |
|                                                                       |
| brand_voice VARCHAR(50), \-- professional\|friendly\|playful\|premium |
|                                                                       |
| target_audience JSONB, \-- {age_range, interests, demographics}       |
|                                                                       |
| usps TEXT\[\],                                                        |
|                                                                       |
| menu_items JSONB, \-- \[{name, price, description, image_url}\]       |
|                                                                       |
| upcoming_events JSONB,                                                |
|                                                                       |
| competitor_names TEXT\[\],                                            |
|                                                                       |
| updated_at TIMESTAMPTZ DEFAULT NOW()                                  |
|                                                                       |
| );                                                                    |
+-----------------------------------------------------------------------+

**social_accounts**

+-----------------------------------------------------------------------+
| CREATE TABLE social_accounts (                                        |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| tenant_id UUID NOT NULL REFERENCES tenants(id),                       |
|                                                                       |
| platform VARCHAR(50) NOT NULL, \--                                    |
| instagram\|facebook\|linkedin\|twitter                                |
|                                                                       |
| platform_user_id VARCHAR(255) NOT NULL,                               |
|                                                                       |
| access_token TEXT, \-- AES-256-GCM encrypted                          |
|                                                                       |
| refresh_token TEXT, \-- AES-256-GCM encrypted                         |
|                                                                       |
| token_expires_at TIMESTAMPTZ,                                         |
|                                                                       |
| account_name VARCHAR(255),                                            |
|                                                                       |
| followers_count INTEGER,                                              |
|                                                                       |
| is_active BOOLEAN DEFAULT TRUE,                                       |
|                                                                       |
| last_synced_at TIMESTAMPTZ,                                           |
|                                                                       |
| created_at TIMESTAMPTZ DEFAULT NOW(),                                 |
|                                                                       |
| UNIQUE(tenant_id, platform)                                           |
|                                                                       |
| );                                                                    |
+-----------------------------------------------------------------------+

**audit_reports**

+-----------------------------------------------------------------------+
| CREATE TABLE audit_reports (                                          |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| tenant_id UUID NOT NULL REFERENCES tenants(id),                       |
|                                                                       |
| generated_at TIMESTAMPTZ DEFAULT NOW(),                               |
|                                                                       |
| scores JSONB, \-- {profile: 82, posting: 65, engagement: 71, \...}    |
|                                                                       |
| insights JSONB, \-- {top_posts: \[\...\], action_items: \[\...\]}     |
|                                                                       |
| pdf_url TEXT, \-- GCS signed URL                                      |
|                                                                       |
| status VARCHAR(50) DEFAULT \'processing\', \--                        |
| processing\|complete\|failed                                          |
|                                                                       |
| period_start DATE,                                                    |
|                                                                       |
| period_end DATE                                                       |
|                                                                       |
| );                                                                    |
|                                                                       |
| CREATE INDEX idx_audit_tenant_date ON audit_reports(tenant_id,        |
| generated_at DESC);                                                   |
+-----------------------------------------------------------------------+

**competitor_reports**

+-----------------------------------------------------------------------+
| CREATE TABLE competitor_reports (                                     |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| tenant_id UUID NOT NULL REFERENCES tenants(id),                       |
|                                                                       |
| competitor_name VARCHAR(255) NOT NULL,                                |
|                                                                       |
| platform VARCHAR(50),                                                 |
|                                                                       |
| metrics JSONB, \-- {followers, er, post_freq, avg_engagement}         |
|                                                                       |
| pros_cons JSONB, \-- {pros: \[\...\], cons: \[\...\], opportunities:  |
| \[\...\]}                                                             |
|                                                                       |
| raw_posts JSONB, \-- sample of recent posts for analysis              |
|                                                                       |
| generated_at TIMESTAMPTZ DEFAULT NOW()                                |
|                                                                       |
| );                                                                    |
+-----------------------------------------------------------------------+

**content_calendars**

+-----------------------------------------------------------------------+
| CREATE TABLE content_calendars (                                      |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| tenant_id UUID NOT NULL REFERENCES tenants(id),                       |
|                                                                       |
| month_start DATE NOT NULL,                                            |
|                                                                       |
| strategy_summary JSONB, \-- {pillars, kpis, platform_strategies}      |
|                                                                       |
| sheets_id VARCHAR(255), \-- Google Sheet spreadsheet ID               |
|                                                                       |
| status VARCHAR(50) DEFAULT \'generating\',                            |
|                                                                       |
| created_at TIMESTAMPTZ DEFAULT NOW()                                  |
|                                                                       |
| );                                                                    |
+-----------------------------------------------------------------------+

**content_posts**

+-----------------------------------------------------------------------+
| CREATE TABLE content_posts (                                          |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| tenant_id UUID NOT NULL REFERENCES tenants(id),                       |
|                                                                       |
| calendar_id UUID NOT NULL REFERENCES content_calendars(id),           |
|                                                                       |
| calendar_date DATE NOT NULL,                                          |
|                                                                       |
| platform VARCHAR(50) NOT NULL,                                        |
|                                                                       |
| content_type VARCHAR(50), \-- image\|carousel\|reel\|story            |
|                                                                       |
| caption TEXT,                                                         |
|                                                                       |
| hashtags TEXT\[\],                                                    |
|                                                                       |
| image_url TEXT,                                                       |
|                                                                       |
| image_prompt TEXT,                                                    |
|                                                                       |
| status VARCHAR(50) DEFAULT \'draft\',                                 |
|                                                                       |
| \-- draft\|pending_review\|approved\|published\|rejected              |
|                                                                       |
| reviewer_notes TEXT,                                                  |
|                                                                       |
| scheduled_for TIMESTAMPTZ,                                            |
|                                                                       |
| published_at TIMESTAMPTZ,                                             |
|                                                                       |
| platform_post_id VARCHAR(255),                                        |
|                                                                       |
| created_at TIMESTAMPTZ DEFAULT NOW()                                  |
|                                                                       |
| );                                                                    |
|                                                                       |
| CREATE INDEX idx_posts_tenant_date ON content_posts(tenant_id,        |
| calendar_date);                                                       |
|                                                                       |
| CREATE INDEX idx_posts_status ON content_posts(tenant_id, status);    |
|                                                                       |
| CREATE INDEX idx_posts_scheduled ON content_posts(scheduled_for)      |
| WHERE status = \'approved\';                                          |
+-----------------------------------------------------------------------+

**post_analytics**

+-----------------------------------------------------------------------+
| CREATE TABLE post_analytics (                                         |
|                                                                       |
| id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        |
|                                                                       |
| post_id UUID NOT NULL REFERENCES content_posts(id),                   |
|                                                                       |
| impressions INTEGER DEFAULT 0,                                        |
|                                                                       |
| reach INTEGER DEFAULT 0,                                              |
|                                                                       |
| likes INTEGER DEFAULT 0,                                              |
|                                                                       |
| comments INTEGER DEFAULT 0,                                           |
|                                                                       |
| shares INTEGER DEFAULT 0,                                             |
|                                                                       |
| saves INTEGER DEFAULT 0,                                              |
|                                                                       |
| clicks INTEGER DEFAULT 0,                                             |
|                                                                       |
| recorded_at TIMESTAMPTZ DEFAULT NOW()                                 |
|                                                                       |
| );                                                                    |
|                                                                       |
| CREATE INDEX idx_analytics_post ON post_analytics(post_id,            |
| recorded_at DESC);                                                    |
+-----------------------------------------------------------------------+

**3.3 Relationship Diagram (Text)**

  --------------------- ------------- -------------------------------------
  **Relationship**      **Type**      **Description**

  tenants → users       one-to-many   A tenant (company) has many users
                                      with different roles

  tenants →             one-to-one    Each tenant has exactly one business
  business_profiles                   profile

  tenants →             one-to-many   A tenant connects multiple social
  social_accounts                     platforms

  tenants →             one-to-many   Monthly audits accumulate over time
  audit_reports                       per tenant

  tenants →             one-to-many   Multiple competitors tracked per
  competitor_reports                  tenant

  tenants →             one-to-many   One calendar per month per tenant
  content_calendars                   

  content_calendars →   one-to-many   A calendar contains 20-60 individual
  content_posts                       posts

  content_posts →       one-to-many   Analytics recorded multiple times per
  post_analytics                      post
  --------------------- ------------- -------------------------------------

**3.4 Multi-Tenancy Enforcement**

-   Every query at the ORM level (Prisma) includes a WHERE tenant_id =
    \$currentTenantId clause

-   Row-level security (RLS) in PostgreSQL as a second layer of defense

-   Middleware injects tenant_id from JWT claims before every database
    call

-   No cross-tenant data leakage is architecturally possible with this
    design

*--- End of Architecture & Code Structure Document ---*
