from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from src.scoring.engagement import calculate_engagement_score
from src.scoring.profile import calculate_profile_score
from src.scoring.hashtag import calculate_hashtag_score
from src.scoring.content_mix import calculate_content_mix_score
from src.report.pdf_generator import generate_audit_pdf

audit_router = APIRouter()


class AuditRequest(BaseModel):
    tenant_id: str
    social_accounts: list[dict]
    business_profile: Optional[dict] = None


class AuditResponse(BaseModel):
    tenant_id: str
    scores: dict
    insights: dict
    status: str
    pdf_url: Optional[str] = None


@audit_router.post("/run", response_model=AuditResponse)
async def run_audit(request: AuditRequest):
    """Run a full social media audit for a tenant."""
    try:
        scores = {}
        all_posts = []

        for account in request.social_accounts:
            platform = account.get("platform", "unknown")
            posts = account.get("recent_posts", [])
            followers = account.get("followers_count", 0)
            all_posts.extend(posts)

            scores[f"{platform}_engagement"] = calculate_engagement_score(posts, followers)
            scores[f"{platform}_profile"] = calculate_profile_score(account)
            scores[f"{platform}_hashtag"] = calculate_hashtag_score(posts)
            scores[f"{platform}_content_mix"] = calculate_content_mix_score(posts)

        overall_scores = {
            "profileCompleteness": _avg_scores(scores, "profile"),
            "postingFrequency": _calculate_posting_frequency(all_posts),
            "engagementRate": _avg_scores(scores, "engagement"),
            "contentMix": _avg_scores(scores, "content_mix"),
            "hashtagStrategy": _avg_scores(scores, "hashtag"),
            "audienceGrowth": 50,  # Requires historical data
            "bestPerformingContent": _best_content_score(all_posts),
            "responseTime": 60,  # Placeholder - requires DM data
            "seoDiscoverability": _seo_score(request.business_profile),
        }
        overall_scores["overall"] = round(
            sum(v for k, v in overall_scores.items() if k != "overall") / 9
        )

        insights = {
            "topPosts": _get_top_posts(all_posts),
            "actionItems": _generate_action_items(overall_scores),
            "strengths": [k for k, v in overall_scores.items() if v >= 70 and k != "overall"],
            "weaknesses": [k for k, v in overall_scores.items() if v < 40 and k != "overall"],
        }

        return AuditResponse(
            tenant_id=request.tenant_id,
            scores=overall_scores,
            insights=insights,
            status="complete",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@audit_router.get("/{tenant_id}/latest")
async def get_latest_audit(tenant_id: str):
    """Get the latest audit report for a tenant (placeholder)."""
    return {"tenant_id": tenant_id, "message": "Fetch from database in production"}


def _avg_scores(scores: dict, key: str) -> int:
    vals = [v for k, v in scores.items() if key in k]
    return round(sum(vals) / len(vals)) if vals else 50


def _calculate_posting_frequency(posts: list) -> int:
    if not posts:
        return 20
    count = len(posts)
    if count >= 20:
        return 90
    if count >= 12:
        return 70
    if count >= 4:
        return 50
    return 30


def _best_content_score(posts: list) -> int:
    if not posts:
        return 30
    max_eng = max((p.get("engagement", 0) for p in posts), default=0)
    if max_eng > 500:
        return 90
    if max_eng > 100:
        return 70
    return 45


def _seo_score(profile: dict | None) -> int:
    if not profile:
        return 30
    score = 30
    if profile.get("usps"):
        score += 20
    if profile.get("category"):
        score += 15
    if profile.get("location"):
        score += 15
    if profile.get("target_audience"):
        score += 20
    return min(score, 100)


def _get_top_posts(posts: list) -> list:
    sorted_posts = sorted(posts, key=lambda p: p.get("engagement", 0), reverse=True)
    return [
        {"postId": p.get("id", ""), "engagement": p.get("engagement", 0), "type": p.get("type", "image")}
        for p in sorted_posts[:5]
    ]


def _generate_action_items(scores: dict) -> list:
    items = []
    if scores.get("profileCompleteness", 0) < 70:
        items.append({"priority": "high", "description": "Complete your social media profiles with bio, links, and contact info", "impact": "Improves discoverability by 30%"})
    if scores.get("postingFrequency", 0) < 50:
        items.append({"priority": "high", "description": "Increase posting frequency to at least 3x per week", "impact": "Boosts engagement and algorithm visibility"})
    if scores.get("engagementRate", 0) < 50:
        items.append({"priority": "medium", "description": "Use more interactive content (polls, questions, CTAs)", "impact": "Can double engagement rate"})
    if scores.get("hashtagStrategy", 0) < 50:
        items.append({"priority": "medium", "description": "Diversify hashtags with mix of high-volume and niche tags", "impact": "Expands reach to new audiences"})
    if scores.get("contentMix", 0) < 50:
        items.append({"priority": "low", "description": "Diversify content types - add carousels and reels", "impact": "Reels get 2x more reach on Instagram"})
    return items
