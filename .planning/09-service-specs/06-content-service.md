# 09.06 — content-service

**Language:** Python + FastAPI
**Build order:** #7
**Module mapping:** PRD §4.5

---

## Responsibilities

1. Consume `strategy.generated` → kick off per-slot content generation
2. For each slot, generate caption + hashtags + image prompt + image
3. Persist completed post to `content_posts` (status flips draft → pending_review)
4. Publish `post.ready` per completed post
5. Support regeneration when reviewer requests modifications (separate endpoint)

---

## Generation pipeline per slot

```
1. Load content_post row (draft) + business_profile + strategy summary
2. Generate CAPTION via Gemini Flash:
     prompts/caption_system.txt
     output: { caption, cta, primary_keywords }
3. Generate HASHTAGS via Gemini Flash:
     prompts/hashtag_system.txt
     output: { high_volume: [3], medium: [5], niche: [4] }  (12 total max)
4. Generate IMAGE PROMPT via Gemini Flash:
     prompts/image_prompt_system.txt
     output: { prompt, negative_prompt, style, aspect_ratio }
5. Generate IMAGE:
     - If plan = starter → Stability AI Stable Image Core
     - If plan = growth/agency → Stability AI Stable Image Ultra OR DALL-E 3 (configurable, A/B test)
6. Upload image to gs://aura-public-<env>/posts/<tenantId>/<postId>.jpg
7. UPDATE content_posts SET caption, hashtags, image_url, image_prompt, status='pending_review'
8. INSERT outbox_events for post.ready
```

Target: **< 30 seconds per post** (PRD §6).

---

## Concurrency model

`strategy.generated` arrives → service must generate 20–60 posts. Approaches:

- Naive: process the entire batch in the subscription handler. Risk: Pub/Sub ack timeout.
- **Recommended:** subscription handler enqueues per-post jobs into a Cloud Tasks queue (`content-generation-queue`); a worker endpoint `/internal/generate-post` consumes from the queue, one post per invocation. Each invocation: short, idempotent, retries via Cloud Tasks.

Cloud Tasks rate limit (configurable): 10 dispatches/sec. With 60 posts → 6 seconds to enqueue + ~30 sec each → 1–2 minutes total wall clock for 60 posts.

---

## Public API

| Method | Path | Purpose |
|---|---|---|
| GET | `/content/posts/:id` | Read post (with signed image URL) |
| POST | `/content/posts/:id/regenerate` | Force regenerate caption/image (uses reviewer notes if provided) |

Internal:
| POST | `/_pubsub/strategy-generated` | Subscription handler — enqueue per-post tasks |
| POST | `/internal/generate-post` | Cloud Tasks worker — generates one post |

---

## Regeneration flow

When review-service receives a "modify" decision, it calls:
```
POST /content/posts/:id/regenerate
Body: { reviewerNotes: "Make it more friendly, mention 20% off" }
```

content-service:
1. Loads original prompts + adds reviewer feedback as a "modification note" appended to caption prompt
2. Generates fresh caption + hashtags (keep same image unless reviewer notes mention image)
3. If notes mention image (regex: "image", "photo", "visual", "picture"), also regenerate image
4. UPDATE content_posts, status='pending_review' again
5. Publishes new `post.ready` event

This is documented in `09-service-specs/07-review-service.md` from the calling side.

---

## Prompts

All in `src/prompts/` as plain text, versioned:
- `caption_system.txt` — brand voice + platform-specific length + emoji rules + cta requirement
- `hashtag_system.txt` — explicit volume mix instruction; output JSON
- `image_prompt_system.txt` — descriptive, focused on subject + composition + lighting + brand style; avoid celebrities/brands by name

---

## Image generation rules

- Aspect ratios: IG square 1:1, IG portrait 4:5, IG story 9:16, FB feed 1.91:1
- Resolution: 1080×1080 minimum
- Format: JPG 85% quality
- Negative prompt always includes: "text overlay, watermark, logos, low quality, distorted faces"
- Brand color injection: business_profile has optional `brand_colors`; if set, inject into image prompt as "color palette using #HEX #HEX"
- Safety: Stability AI's safety filter on, DALL-E safety on; if blocked, retry with sanitized prompt; second failure → fall back to a category-stock placeholder + flag in admin log

---

## Cost guardrails

Image generation is the biggest cost. Per-tenant monthly cap:
- Starter: 20 images
- Growth: 60 images
- Agency: 100 images (soft cap; alert at 80)

Enforce in code at the start of `/internal/generate-post`. If over cap, set `status='quota_exceeded'` and notification-service alerts the owner.

---

## Events published

- `post.ready` — per individual post

---

## Events consumed

- `strategy.generated` — fan-out to per-post tasks

---

## DB tables touched

- `content_posts` — primary
- `business_profiles`, `content_calendars` — read

---

## Configuration

- `DATABASE_URL`, `JWT_PUBLIC_KEY`
- `GEMINI_FLASH_API_KEY`, `STABILITY_API_KEY`, `OPENAI_API_KEY`
- `GCS_BUCKET_PUBLIC`
- `CLOUD_TASKS_QUEUE_PATH` (e.g., `projects/aura-prod/locations/asia-south1/queues/content-generation-queue`)
- `PUBSUB_TOPIC_POST_READY`

---

## Testing

Unit:
- Caption Pydantic validation against malformed Gemini output
- Cost cap enforcement
- Aspect ratio mapping by platform + content type

Integration:
- Full single-post generation in staging with sandboxed Gemini key
- Regeneration with reviewer notes produces a measurably different caption
- 20-post batch completes via Cloud Tasks within 5 minutes

---

## Definition of done

- [ ] Skeleton green
- [ ] Per-post generation completes in <30 sec on Gemini Flash
- [ ] 20-post batch completes within 5 min
- [ ] Regeneration honors reviewer notes
- [ ] `post.ready` published per post
- [ ] Cost caps enforced
- [ ] Coverage > 70%

---

## AI Agent Prompt Template

```
Build content-service per .planning/09-service-specs/06-content-service.md.

Read first:
- This spec
- DOSC/AURA_PRD.md §4.5
- .planning/09-service-specs/05-strategy-service.md (you consume its output)
- .planning/09-service-specs/07-review-service.md (it calls your regenerate endpoint)

Skeleton first; then implement.

Confirm:
- Cloud Tasks vs. dedicated worker pool? (Recommend Cloud Tasks — managed retries, fits Cloud Run)
- Stability AI Core vs. Ultra for Starter — should we cap quality more aggressively? (Recommend Core for all tiers MVP; gate Ultra behind Growth+)
- For image failures, should we fall back to a category-stock placeholder, or leave the post without an image and prompt the reviewer to upload? (Recommend stock placeholder + flag — keeps the review queue moving)
```
