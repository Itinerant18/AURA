from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.routes import audit_router

app = FastAPI(title="AURA Audit Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "audit-service"}


app.include_router(audit_router, prefix="/api/audit")
