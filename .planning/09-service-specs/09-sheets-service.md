# 09.09 — sheets-service

**Language:** Node.js + Express
**Build order:** #3 (parallel with onboarding); listens later for strategy events
**Module mapping:** PRD §4.4.2 (calendar export), §4.7 (analytics export)

---

## Responsibilities

1. Maintain the per-tenant Google Sheets export
2. On `strategy.generated`: create or update the tenant's calendar sheet
3. On `post.published`: append publish info to the calendar sheet + analytics tab
4. Periodic refresh: nightly sync of any post status changes

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| GET | `/sheets/calendar/url` | Returns the URL to the tenant's current calendar sheet |
| POST | `/sheets/calendar/sync` | Force re-sync of the calendar (admin / debug) |
| POST | `/sheets/disconnect` | Revoke Google Sheets access + unlink |

Internal:
| POST | `/_pubsub/strategy-generated` | Create/update the sheet |
| POST | `/_pubsub/post-published` | Append publish data |

---

## Sheet structure

One Google Spreadsheet per tenant. Named: `AURA — <Business Name> — Content Calendar`.

Two tabs:

### Tab 1: `Calendar`
| Date | Platform | Content Type | Topic | Caption | Hashtags | Status | Scheduled For | Published At | Permalink | Reviewer | Notes |

One row per `content_posts` row. Row ID stored in a hidden column to enable upserts.

### Tab 2: `Analytics`
| Date | Platform | Post ID | Impressions | Reach | Likes | Comments | Shares | Saves | Clicks | ER % | Captured At |

Populated by analytics-service indirectly: when analytics writes `post_analytics`, an internal call to sheets-service appends a row. (Or sheets-service polls — but push from analytics is cleaner.)

---

## OAuth + access

- Sheets-service uses the tenant's Google OAuth token (acquired during onboarding via auth-service)
- Token has `https://www.googleapis.com/auth/spreadsheets` and `drive.file` scopes
- Sheet is created in the tenant's Drive, owned by them — AURA never owns the file
- If tenant revokes access, we log + notify (cannot recreate without their re-consent)

---

## Idempotency

The Sheets API doesn't naturally upsert by row. Strategy:
- On `strategy.generated`: write all 30 rows, replace existing tab contents (atomic via `batchUpdate`)
- On `post.published`: find the row by post ID (hidden column), update specific cells
- If the row doesn't exist, append

Maintain a small in-memory cache of `postId → rowNumber` per sheet to avoid repeated lookups (1-hour TTL in Redis).

---

## Quotas

Google Sheets API: 60 reads/min/user, 60 writes/min/user. For a tenant with 60 posts: write the whole calendar in 2 batchUpdate calls (well under). Analytics appends: ~60 publishes/month / 30 days = 2/day per tenant. No concern.

If we ever do hit a quota, return 503 and rely on Pub/Sub retry.

---

## Events consumed

- `strategy.generated`
- `post.published`

---

## Events published

None. (We could publish `sheets.synced` for visibility but it's not required.)

---

## DB tables touched

- `content_calendars` — read + update `sheets_id` after creation
- `content_posts` — read
- `post_analytics` — read
- `social_accounts` — read for Google OAuth token (platform='google')

---

## Configuration

- `DATABASE_URL`, `JWT_PUBLIC_KEY`
- `DB_ENCRYPTION_KEY`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (for token refresh)

---

## Testing

Unit:
- Row-to-cells mapping
- batchUpdate request construction

Integration:
- End-to-end: spin up a test Google account, create a sheet, write 30 rows, append 1 publish row, verify cells
- Token refresh works

---

## Definition of done

- [ ] Skeleton green
- [ ] Calendar sheet created on `strategy.generated`
- [ ] Publish events update the sheet within 60 seconds
- [ ] Sheet URL accessible from the dashboard
- [ ] Token refresh handles 401 from Google
- [ ] Coverage > 80%

---

## AI Agent Prompt Template

```
Build sheets-service per .planning/09-service-specs/09-sheets-service.md.

Read first:
- This spec
- DOSC/AURA_PRD.md §4.4.2 + §4.7
- .planning/09-service-specs/01-auth-service.md (you receive the Google OAuth token from the social_accounts row created there)

Skeleton first; then implement.

Confirm:
- Should we create the sheet immediately on `social.connected` for Google, or wait for first `strategy.generated`? (Recommend wait for strategy — avoids empty sheets)
- For analytics, push (analytics-service calls our internal endpoint) or pull (we poll post_analytics)? (Recommend push — analytics-service already knows when new data arrives)
```
