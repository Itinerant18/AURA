from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from src.generators.caption import generate_caption
from src.generators.hashtags import generate_hashtags
from src.generators.image_prompt import generate_image_prompt
from src.generators.video_script import generate_video_script

content_router = APIRouter()


class PostGenerationRequest(BaseModel):
    tenant_id: str
    calendar_slot: dict
    business_profile: dict
    brand_voice: str = "friendly"


class BulkGenerationRequest(BaseModel):
    tenant_id: str
    calendar_slots: list[dict]
    business_profile: dict
    brand_voice: str = "friendly"


@content_router.post("/generate")
async def generate_post(request: PostGenerationRequest):
    """Generate content for a single calendar slot."""
    try:
        slot = request.calendar_slot
        content_type = slot.get("contentType", "image")

        caption = await generate_caption(
            topic=slot.get("topic", ""),
            hook=slot.get("hook", ""),
            platform=slot.get("platform", "instagram"),
            brand_voice=request.brand_voice,
            business_profile=request.business_profile,
        )

        hashtags = await generate_hashtags(
            topic=slot.get("topic", ""),
            platform=slot.get("platform", "instagram"),
            business_profile=request.business_profile,
            existing=slot.get("hashtags", []),
        )

        image_prompt = None
        video_script = None

        if content_type in ["image", "carousel"]:
            image_prompt = await generate_image_prompt(
                topic=slot.get("topic", ""),
                business_profile=request.business_profile,
                content_type=content_type,
            )
        elif content_type in ["reel", "story"]:
            video_script = await generate_video_script(
                topic=slot.get("topic", ""),
                platform=slot.get("platform", "instagram"),
                business_profile=request.business_profile,
            )

        return {
            "success": True,
            "data": {
                "caption": caption,
                "hashtags": hashtags,
                "imagePrompt": image_prompt,
                "videoScript": video_script,
                "contentType": content_type,
                "platform": slot.get("platform"),
                "calendarDate": slot.get("date"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@content_router.post("/generate/bulk")
async def generate_bulk(request: BulkGenerationRequest):
    """Generate content for multiple calendar slots."""
    results = []
    for slot in request.calendar_slots:
        try:
            single_req = PostGenerationRequest(
                tenant_id=request.tenant_id,
                calendar_slot=slot,
                business_profile=request.business_profile,
                brand_voice=request.brand_voice,
            )
            result = await generate_post(single_req)
            results.append(result.get("data") if isinstance(result, dict) else result)
        except Exception as e:
            results.append({"error": str(e), "slot": slot})

    return {"success": True, "data": results, "meta": {"total": len(results)}}


@content_router.post("/regenerate")
async def regenerate_post(request: PostGenerationRequest):
    """Regenerate content based on reviewer feedback."""
    return await generate_post(request)
