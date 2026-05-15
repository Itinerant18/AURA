from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.routes import content_router

app = FastAPI(title="AURA Content Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "content-service"}


app.include_router(content_router, prefix="/api/content")
