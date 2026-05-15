# 10 — Frontend Build Guide (`apps/web`)

**Goal:** Build the Next.js + React frontend that owns every user-facing surface — onboarding, dashboard, calendar, review queue, settings, billing.

**Source:**
- PRD §5 (User Flows)
- Architecture doc §2.1 (apps/web folder structure)

**Build cadence:** Frontend work runs in parallel with backend phases. An agent dedicated to frontend can ship vertical slices as each backend service stabilizes.

---

## Tech stack

- **Next.js 15+** with App Router
- **React 19**
- **TypeScript strict**
- **Tailwind CSS** + `class-variance-authority` for components
- **Radix UI primitives** + `shadcn/ui` style component library (copy in, not npm dep)
- **NextAuth v5** (or Auth.js) for session management — JWT comes from auth-service backend
- **Zustand** for global state (per Architecture doc §2.1)
- **React Query (TanStack Query)** for server state
- **React Hook Form + Zod** for forms
- **Axios** typed client (`src/lib/api-client.ts`) pointing at API Gateway
- **Sentry** for error reporting
- **PostHog** (optional) for product analytics

---

## Route map

```
(public)/
  /                          Landing page
  /pricing                   Plans + Stripe checkout entry
  /login
  /signup
  /forgot-password
  /reset-password

(onboarding)/
  /onboarding/welcome        Step 1 — confirm plan
  /onboarding/business       Step 2 — business profile
  /onboarding/menu           Step 3 — menu/service items
  /onboarding/social         Step 4 — connect social accounts
  /onboarding/competitors    Step 5 — review auto-discovered competitors
  /onboarding/finish         Step 6 — confirmation

(dashboard)/
  /dashboard                 Overview tiles
  /dashboard/audit           Latest audit report viewer
  /dashboard/audit/history   All past audits
  /dashboard/competitors     Competitor reports
  /dashboard/calendar        30-day calendar view
  /dashboard/calendar/[id]   Specific month
  /dashboard/analytics       Performance dashboard
  /dashboard/settings        Profile / brand / preferences
  /dashboard/settings/billing
  /dashboard/settings/social Manage connected accounts
  /dashboard/settings/team   (Growth+/Agency only)

(review)/
  /review                    Review queue
  /review/[postId]           Single post review

api/                         Server actions only — proxies to backend services
```

---

## Component inventory (per Architecture doc §2.1)

### `components/ui/` — base primitives
Button, Card, Modal, Drawer, Badge, Toast, Tooltip, Tabs, Accordion, Input, Textarea, Select, Checkbox, Switch, Skeleton, Avatar, Toaster.

### `components/audit/`
- `AuditScoreCard` — one per dimension, with traffic light + bar
- `AuditReportViewer` — PDF preview + scores tab + insights tab
- `OverallScoreRing` — circular meter for overall score
- `ActionItemList` — prioritized list of recommendations

### `components/competitor/`
- `CompetitorCard` — name + key metrics
- `ProsConsMatrix` — two-column structured view
- `OpportunityList`

### `components/calendar/`
- `CalendarGrid` — 30-day grid view
- `PostSlot` — one cell, shows status + small preview
- `CalendarFilters` — by platform, status, content type
- `SlotDetailDrawer` — opens post details

### `components/review/`
- `ReviewQueue` — list view with filters
- `PostPreview` — IG/FB-styled preview pane
- `ApprovalControls` — Approve / Reject / Modify buttons
- `ModificationDialog` — textarea + submit
- `BulkActionBar` — when multi-select active

### `components/publish/`
- `PublishStatusBadge` — pill component used throughout
- `ScheduledPostsList`

### `components/analytics/`
- `KpiTile` — single metric with delta
- `EngagementChart` — line/bar (use Recharts)
- `TopPostsList`
- `AuditComparison` — before/after diff grid

### `components/onboarding/`
- `OnboardingStepper` — top progress bar
- `SocialConnectButton` — one per platform with branded styling
- `MenuItemEditor` — repeating row editor

---

## State management

- **Server state:** React Query, with `staleTime: 30s` default. One hook per backend resource: `useAudit`, `useCalendar`, `useReviewQueue`, etc. (see Architecture doc §2.1)
- **Client state:** Zustand slices, one file per concern:
  - `auth-store.ts` — current user + tenant context
  - `ui-store.ts` — sidebar open, theme, modals
  - `review-store.ts` — selected post IDs for bulk actions, current filter
- **Form state:** React Hook Form, scoped to each form component

---

## Authentication flow

1. User hits `/login` → submits credentials
2. NextAuth Credentials provider calls auth-service `POST /auth/login`
3. Auth-service returns `{ accessToken, refreshToken, user }`
4. NextAuth stores in encrypted JWT session cookie
5. `apiClient` Axios interceptor reads access token from session, attaches `Authorization: Bearer`
6. On 401: try refresh via auth-service; if refresh fails → kick to login

---

## API client (`src/lib/api-client.ts`)

Generated from each service's OpenAPI spec **at build time** via `openapi-typescript`. The agent should set up the codegen as a build step. Don't write API types by hand — they will drift.

---

## Design tokens

In `tailwind.config.ts`:
- Brand colors (placeholder until design lands; you should provide a palette)
- Spacing scale: 4px base (`tailwind` default)
- Type scale: 12 / 14 / 16 / 18 / 24 / 32 / 48
- Border radii: sm 4 / md 8 / lg 12 / xl 16
- Shadows: sm / md / lg with subtle, single-direction lift

Dark mode: optional for MVP but the agent should structure CSS variables so it can be added in one PR later.

---

## Performance budget

- LCP < 2.5s on 4G
- TTI < 4s
- JS bundle for /dashboard route: < 200 KB gzipped (initial)
- Server-side render the shell; client-render the heavy widgets (calendar grid, charts)
- Lazy-load PDF viewer (heavy)
- Lazy-load Recharts

---

## SEO + meta

- Public pages have proper meta tags + OG images
- Dashboard pages are `noindex,nofollow`
- Sitemap at `/sitemap.xml` for public pages

---

## Internationalization

English only at launch. Wrap all UI strings in a thin `t()` helper (even though it just returns the input for MVP) so we can add Hindi in Phase 2 without a refactor.

---

## Accessibility

- Use Radix primitives (a11y built in)
- All interactive elements keyboard-navigable
- Color contrast: minimum AA
- Reviewer queue must be operable with keyboard alone (approve = `A`, reject = `R`, modify = `M`)

---

## Frontend phases (parallel to backend)

| Phase | Frontend deliverable | Depends on |
|---|---|---|
| Phase 1 | Public site shell, login, signup pages (mocked backend) | auth-service skeleton |
| Phase 2 | Onboarding flow (steps 1–6), settings page shell | onboarding-service, auth-service |
| Phase 3 | Dashboard shell, audit report viewer, competitor view | audit-service, competitor-service |
| Phase 4 | Calendar view, strategy summary | strategy-service, content-service |
| Phase 5 | Review queue, bulk actions | review-service |
| Phase 6 | Analytics dashboard, billing settings, polish | analytics-service, billing-service |

---

## Testing

- **Unit:** Vitest for hooks and utility functions
- **Component:** Playwright Component Testing for `components/review/*` and `components/calendar/*`
- **E2E:** Playwright covering: signup → onboarding → dashboard → approve a post (full happy path)
- **Visual regression:** Chromatic or Percy for the design system primitives (optional MVP)

---

## Definition of done (Frontend MVP)

- [ ] Lighthouse: Performance ≥ 80, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90 (on `/`)
- [ ] All routes navigable end-to-end on a fresh tenant
- [ ] Mobile responsive (tested at 375 / 768 / 1280 widths)
- [ ] Sentry capturing errors in staging
- [ ] One full E2E test passing in CI

---

## AI Agent Prompt Template

```
You are building the AURA frontend (apps/web).

CONTEXT:
- Read .planning/10-frontend-build-guide.md
- Read DOSC/AURA_PRD.md §5 (user flows)
- Read DOSC/AURA_Architecture_CodeStructure.md §2.1

This is a multi-phase build. Tell me which phase you're starting (1–6) and confirm the backend dependencies are ready. Do not start a phase whose backend dependencies are stubs.

DELIVERABLES PER PHASE:
1. Wireframe the screens in markdown (text-based mockups) — get my approval
2. Implement using existing components + add new components only when needed
3. Wire up to backend via the typed api-client
4. Write E2E happy path test
5. Open PR

CONSTRAINTS:
- TypeScript strict; no `any`
- No state libraries beyond Zustand + React Query
- No CSS-in-JS; Tailwind + CSS variables only
- All API types generated from OpenAPI — never hand-written

ASK BEFORE PROCEEDING:
- Should I scaffold the whole route tree as placeholder pages first, or build screens to completion one at a time? (Recommend full scaffold first — gives navigation context)
- Brand palette: do you have HEX values for primary/secondary/accent, or should I use a neutral grayscale palette and we'll re-skin later? (Recommend neutral palette + 1 accent color until design lands)
```
