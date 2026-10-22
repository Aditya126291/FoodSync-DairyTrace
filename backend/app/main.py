"""FastAPI Application Entrypoint for DairyTrace (Team FoodSync — Tech4Food 2026)."""

import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.complaints import router as complaints_router
from app.complaints.agent import configured_model, llm_is_configured
from app.database import engine, init_db
from app.routers import auth, batches, inspections, public, quality, recall
from app.security import assert_production_ready


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize SQLite/PostgreSQL schema on application startup."""
    assert_production_ready()
    init_db()
    yield
    engine.dispose()


app = FastAPI(
    title="DairyTrace API — Smart Food Traceability & Recall",
    description=(
        "QR-enabled milk-to-paneer genealogy, evidence-linked quality records, "
        "AI Complaint Copilot with forensic report parsing, "
        "and millisecond BFS Graph Recall Engine with FSSAI FoSCoS dossier export."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS middleware for Vite frontend (http://localhost:5173) and local dev tools
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    ).split(",") if o.strip()],
    allow_credentials=False,  # Bearer-token auth; no cookies are used
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all domain routers under /api
app.include_router(batches.router, prefix="/api")
app.include_router(quality.router, prefix="/api")
app.include_router(recall.router, prefix="/api")
app.include_router(inspections.router, prefix="/api")
app.include_router(complaints_router.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(public.router, prefix="/api")


@app.get("/api/health", tags=["System"])
def health_check() -> dict[str, str | None]:
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": "DairyTrace Smart Recall Engine",
        "team": "FoodSync",
        "ai_mode": "groq" if llm_is_configured() else "rule-based",
        "ai_model": configured_model() if llm_is_configured() else None,
    }
