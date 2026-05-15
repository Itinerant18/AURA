# 09.01 — auth-service

**Language:** Node.js + Express
**Build order position:** #1 (everything depends on this)
**Module mapping:** PRD §4.1.2 (Social Media Account Linking), implicit in §5.1 Steps 1, 3

---

## Responsibilities

1. User authentication: email/password signup + login, Google OAuth login
2. JWT issuance (RS256), refresh tokens, session management
3. Social platform OAuth2 dance: Instagram (via Meta), Facebook, LinkedIn, Twitter/X, Google Business Profile, Google Sheets
4. Token encryption and storage in `social_accounts`
5. JWKS endpoint for other services to verify JWTs
6. Tenant context resolution: maps a user to their `tenantId` on every login

**Out of scope:** Reset flows beyond a basic email link, MFA, SSO (deferred).

---

## Public API (REST)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/signup` | Create tenant + first owner user |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/refresh` | Exchange refresh for access JWT |
| GET | `/auth/me` | Current user + tenant info |
| POST | `/auth/password/forgot` | Send reset link |
| POST | `/auth/password/reset` | Submit new password with token |
| GET | `/oauth/<platform>/start` | Begin OAuth flow, returns redirect URL |
| GET | `/oauth/<platform>/callback` | Handle provider redirect, store tokens |
| GET | `/.well-known/jwks.json` | Public JWKS for JWT verification |

`<platform>` ∈ `instagram`, `facebook`, `linkedin`, `twitter`, `google` (covers GBP + Sheets in one flow with combined scopes)

---

## JWT contract

Access JWT claims:
- `sub` — userId
- `tid` — tenantId
- `role` — `owner | reviewer | viewer`
- `plan` — `starter | growth | agency`
- `iat`, `exp` (15 min lifetime)
- `iss` — `aura-auth`
- `aud` — `aura-services`

Refresh token: opaque string, stored in `sessions` table, 30-day lifetime.

Signing: RS256 with key from `jwt-private-key` secret. Public key served via JWKS endpoint.

---

## OAuth flow (per platform)

1. Frontend hits `GET /oauth/instagram/start?return_to=<url>`
2. auth-service:
   - Generates random `state` (32 bytes hex), persists in `oauth_states` table (5-min TTL) keyed by state with `{ tenantId, userId, platform, returnTo }`
   - Returns `{ authorizeUrl }` pointing to platform's authorize endpoint, includes state
3. User completes consent on platform
4. Platform redirects to `/oauth/instagram/callback?code=…&state=…`
5. auth-service:
   - Validates state against `oauth_states`, deletes the row
   - Exchanges code for access/refresh tokens via the platform's token endpoint
   - Encrypts tokens with `db-encryption-key`, upserts into `social_accounts`
   - Triggers a one-time audit kickoff event (publishes `social.connected` internal event — also a topic; add to event bus map if you adopt this)
   - 302 redirects to `returnTo` with a success/error flag

---

## Models / DB tables touched

- `tenants` — create on signup
- `users` — create on signup, update on profile changes
- `sessions` — create on login, delete on logout, delete on refresh
- `oauth_states` — short-lived CSRF tokens
- `social_accounts` — created/updated on OAuth callback
- `audit_log` — significant actions (signup, login from new IP, role change)

---

## Events published

- `social.connected` (proposed addition to event bus map) — when a new social account is linked, with `{ tenantId, platform, platformUserId }`
  - Consumed by `audit-service` to trigger first audit run
  - Add this to `06-event-bus-pubsub-map.md` when you implement

---

## Events consumed

None in MVP. (Possible future: consume `subscription.canceled` from billing to revoke sessions.)

---

## Dependencies on other services

- None (this is the foundation)

---

## Dependencies in `packages/`

- `packages/db` — Prisma client
- `packages/utils` — encrypt, logger, errors, validator, tenantContext
- `packages/queue` — publish `social.connected` via outbox
- `packages/types` — User, Tenant, Session, OAuthTokenSet shapes

---

## External APIs

- Meta Graph API (Instagram + Facebook): `https://graph.facebook.com/v20.0/oauth/access_token`
- LinkedIn: `https://www.linkedin.com/oauth/v2/accessToken`
- Twitter/X: OAuth 2.0 PKCE flow at `https://api.twitter.com/2/oauth2/token`
- Google: standard OAuth 2.0 at `https://oauth2.googleapis.com/token`

For each provider, the agent should:
1. Look up the latest required scopes from the provider's current docs (do not assume — these change)
2. Implement a thin per-provider adapter at `src/oauth/<provider>.ts`
3. Token refresh logic: when an encrypted token in `social_accounts` is about to expire (within 1 hour of `token_expires_at`), refresh on next use

---

## Configuration

Env vars (Cloud Run):
- `DATABASE_URL`, `REDIS_URL`
- `FRONTEND_ORIGIN` — for CORS + cookie domain
- `OAUTH_CALLBACK_BASE` — e.g., `https://api.aura.app`
- `JWT_PRIVATE_KEY` (from secret), `JWT_PUBLIC_KEY` (from secret)
- `DB_ENCRYPTION_KEY` (from secret)
- `META_APP_ID`, `META_APP_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `TWITTER_BEARER_TOKEN` (from secrets)

---

## Security requirements

- Rate limit `/auth/login` and `/auth/password/forgot` to 5 attempts per IP per 15 minutes (Redis-backed)
- Passwords hashed with `argon2id` (m=64MB, t=3, p=4)
- All cookies: `HttpOnly`, `Secure`, `SameSite=Lax`
- CSRF protection on `/oauth/<platform>/callback` via state validation
- JWKS cached with `Cache-Control: max-age=3600`
- No PII in logs

---

## Testing

Unit:
- Argon2 hash + verify
- JWT sign + verify roundtrip
- State token generation + collision check
- OAuth code exchange (with mocked HTTP)

Integration:
- Full signup + login + refresh + logout cycle
- OAuth happy path for Meta (with sandboxed app credentials)
- Token refresh when nearly expired
- Concurrent login from same user

---

## Definition of done

- [ ] Skeleton checklist green (from `08-service-build-order.md`)
- [ ] All 10 routes implemented and tested
- [ ] OAuth works end-to-end for Meta in staging
- [ ] JWKS endpoint served and reachable from another service
- [ ] Argon2 password hashing in place
- [ ] Rate limits verified
- [ ] OpenAPI spec generated at `/openapi.json`
- [ ] Coverage > 80%
- [ ] Two test users (owner + reviewer) seedable via `pnpm db:seed`

---

## AI Agent Prompt Template

```
Build the auth-service per .planning/09-service-specs/01-auth-service.md.

Read first:
- .planning/09-service-specs/01-auth-service.md (this file)
- .planning/04-database-schema-and-prisma.md
- .planning/05-shared-packages.md
- .planning/07-secrets-and-config-strategy.md
- DOSC/AURA_PRD.md §4.1.2, §5.1

Skeleton first: ping me when the 8 skeleton checklist items are done. Don't start business logic until I approve.

Then implement all 10 routes, with tests, and ship a PR.

Confirm before starting:
- Should we use express + zod, or fastify + zod? (Recommend express for ecosystem)
- Should `/oauth/google/start` request combined Sheets + GBP scopes in one flow, or split? (Recommend combined for fewer user prompts)
- Cookie domain for cross-subdomain auth (e.g., app.aura.app + api.aura.app sharing): I plan `.aura.app` — confirm or push back
```
