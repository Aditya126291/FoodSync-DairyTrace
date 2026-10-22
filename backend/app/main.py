"""FastAPI Application Entrypoint for DairyTrace (Team FoodSync — Tech4Food 2026)."""

import os
import sys
from contextlib import asynccontextmanager
from typing import Any
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal, engine, get_db, init_db
from app.models import Batch, ComplaintRecord
from app.routers import batches, complaints, inspections, public, quality, recall
from app.seed_data import seed_tech4food_scenario


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize SQLite/PostgreSQL schema on application startup."""
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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all domain routers under /api
app.include_router(batches.router, prefix="/api")
app.include_router(quality.router, prefix="/api")
app.include_router(recall.router, prefix="/api")
app.include_router(inspections.router, prefix="/api")
app.include_router(complaints.router, prefix="/api")
app.include_router(public.router, prefix="/api")


@app.post("/api/seed/tech4food", tags=["Demo Seed"])
def seed_pitch_scenario(db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Wipes the test database and seeds the official Tech4Food 2026 Pitch Deck Scenario
    (MILK-101, MILK-102, MILK-103, PAN-201, PAN-202, PAN-303, Retailers A, B, C).
    """
    return seed_tech4food_scenario(db_session=db)


@app.get("/api/health", tags=["System"])
def health_check() -> dict[str, str]:
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": "DairyTrace Smart Recall Engine",
        "team": "FoodSync",
    }
