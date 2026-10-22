# FoodSync (DairyTrace) — Tech4Food 2026

**Theme:** TRACE: Smart Food Traceability & Recall  
**Team:** FoodSync (Aditya Kumar, Saloni Gupta, Vikash Kumar)  
**Tagline:** *Every Batch Has a History. Every Recall Needs a Trace.*

---

## 📖 Central Documentation & Multi-Agent Collaboration Hub

All agents and developers should refer to and update the single source of truth:

👉 **[PROJECT_DOCUMENTATION.md](file:///c:/Users/Aditya%20Kumar/OneDrive/Desktop/FoodSync/PROJECT_DOCUMENTATION.md)**

It contains:
- Multi-Agent Protocol & Operational Rules
- System Architecture & Transformation Graph
- Active Tracks for Backend, Frontend, QA, AI Copilot, and DevOps
- Shared Contracts & REST API Registry
- Cross-Agent Dependency & Handoff Matrix
- Chronological Activity Log (The Living Recording)

---

## 🚀 Quick Start

### Backend (FastAPI on Port 8000)
```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```
Interactive API docs: `http://localhost:8000/docs`

### Frontend (React + Vite on Port 5173)
```powershell
cd frontend
npm install
npm run dev
```
Dashboard: `http://localhost:5173`

### Run Test Suite
```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
```
