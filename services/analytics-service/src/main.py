from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.routes import analytics_router

app = FastAPI(title="AURA Analytics Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics-service"}


app.include_router(analytics_router, prefix="/api/analytics")
