# DairyTrace: Multi-Agent Task Delegation Matrix

This document provides explicit task allocations, prompt templates, and acceptance criteria for each autonomous agent. All agents must refer to [PROJECT_SPECIFICATION.md](file:///c:/Users/Aditya%20Kumar/OneDrive/Desktop/FoodSync/PROJECT_SPECIFICATION.md) as the single source of architectural truth.

---

## 1. Multi-Agent Team Structure

| Agent Track | Model Assigned | Primary Responsibility | Target Directory |
| :--- | :--- | :--- | :--- |
| **Track 1: Core Architect** | `Opus 5.5` | Data models, DB, Graph Recall Engine, REST APIs, QR generation | `backend/` |
| **Track 2: Frontend UI/UX** | `Gemini 3.8 Flash` | React + Vite + Tailwind UI, Lineage Graph, Consumer Passport, Recall Center | `frontend/` |
| **Track 3: Compliance & QA** | `Gemini Argon` | Seed Dataset, FSSAI Notice Generator, Pytest verification suite, Demo script | `backend/tests/` & `data/` |

---

## 2. Agent 1: Lead Architect & Backend Core (`Opus 5.5`)

### Mission:
Implement the robust FastAPI backend, database schemas, and the recursive graph traversal algorithm that powers the Smart Recall Engine.

### Target Files:
* `backend/app/main.py`: FastAPI application setup with CORS middleware.
* `backend/app/database.py`: Async/Sync SQLAlchemy engine with SQLite (`dairytrace.db`) and PostgreSQL compatibility.
* `backend/app/models.py`: SQLAlchemy models for `Batch`, `BatchLink`, `QualityRecord`, `DistributionRecord`, and `RecallEvent`.
* `backend/app/schemas.py`: Pydantic V2 schemas for validation of incoming and outgoing payloads.
* `backend/app/services/recall_engine.py`: Forward and backward graph traversal logic computing the blast radius.
* `backend/app/services/qr_service.py`: Generates base64 / PNG QR codes encoding passport URLs.
* `backend/app/routers/`: Routers for `batches.py`, `quality.py`, `recall.py`, and `public.py`.
* `backend/requirements.txt`: Python dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `qrcode[pil]`, `pytest`).

### Copy-Paste Prompt for Opus 5.5:
```text
You are the Lead Backend Architect for DairyTrace (FoodSync), built for the Tech4Food 2026 Hackathon.
Your mission is to build the complete, production-grade FastAPI backend located in the `backend/` directory.

CRITICAL INSTRUCTIONS:
1. Read and strictly adhere to `PROJECT_SPECIFICATION.md` for all table schemas, field names, and REST API routes.
2. Implement the core Graph Recall Engine in `backend/app/services/recall_engine.py`:
   - Must perform forward BFS/DFS to find all child batches (paneer) made from a flagged input milk batch.
   - Must identify co-input batches (other milk batches blended in the same vat) and mark them for quarantine review.
   - Must query `DistributionRecord` to collect all compromised retail store destinations.
   - Must support backward lineage search given any finished batch ID.
3. Implement dynamic QR code generation in `backend/app/services/qr_service.py` using python-qrcode.
4. Set up clean CORS middleware allowing requests from `http://localhost:5173` (Vite frontend).
5. Ensure zero-friction startup with SQLite as default, but cleanly switchable to PostgreSQL.

Deliver clean, well-commented, fully typed Python code ready for execution.
```

### Acceptance Criteria:
- [x] `uvicorn app.main:app --reload` runs cleanly on port 8000 without warnings.
- [x] Swagger docs at `http://localhost:8000/docs` expose all specified endpoints.
- [x] Forward recall simulation on `MILK-101` returns `PAN-201`, `PAN-202`, `MILK-102` (co-input), and Retailers A, B, C.

---

## 3. Agent 2: Frontend & UI/UX Experience (`Gemini 3.8 Flash`)

### Mission:
Build a modern, high-speed, intuitive web dashboard using React, Vite, and Tailwind CSS. The UI must impress hackathon judges with a visual batch genealogy graph, a dramatic emergency recall trigger, and a sleek consumer passport.

### Target Files:
* `frontend/package.json` & `frontend/vite.config.js`: React + Vite setup.
* `frontend/tailwind.config.js` & `frontend/src/index.css`: Tailwind styling with clean dairy-inspired palette (Slate, Emerald, Amber, Rose).
* `frontend/src/components/Navbar.jsx`: Brand header with status indicators and quick-actions.
* `frontend/src/components/LineageGraph.jsx`: Interactive visual node tree showing Milk $\rightarrow$ Processing $\rightarrow$ Paneer $\rightarrow$ Retail.
* `frontend/src/components/RecallModal.jsx`: Emergency recall command interface displaying the real-time computed blast radius.
* `frontend/src/pages/DashboardPage.jsx`: Main view displaying batch inventories, status badges, and quick link creation.
* `frontend/src/pages/ConsumerPassportPage.jsx`: Mobile-responsive public view rendered when a customer scans a package QR code.
* `frontend/src/api.js`: Axios / Fetch client connecting to `http://localhost:8000/api`.

### Copy-Paste Prompt for Gemini 3.8 Flash:
```text
You are the Senior Frontend & UI/UX Engineer for DairyTrace (FoodSync) built for the Tech4Food 2026 Hackathon.
Your mission is to build the complete React + Vite + Tailwind CSS frontend located in `frontend/`.

CRITICAL INSTRUCTIONS:
1. Read `PROJECT_SPECIFICATION.md` to understand the data models and API endpoints.
2. Build 3 primary screen experiences:
   a. **Operations & Genealogy Dashboard (`DashboardPage.jsx`)**:
      - Batch summary statistics (Active Batches, Quarantined, Recalled).
      - Interactive visual lineage tree (SVG or card nodes with connectors) showing how raw milk batches feed into paneer batches and retail stores.
      - "Create Batch" and "Link Milk to Paneer" modals.
   b. **Smart Recall Command Center (`RecallCenterPage.jsx` or `RecallModal.jsx`)**:
      - A high-impact "Flag Batch" interface.
      - Instant visual display of the "Blast Radius": Affected products highlighted in red, co-inputs in amber, and retail locations with contact numbers for targeted lockdown.
      - Button to download/view the FSSAI Recall Dossier.
   c. **Public Consumer Batch Passport (`ConsumerPassportPage.jsx`)**:
      - Mobile-first card view showing consumer-friendly verification (Processing Date, Dairy Origin, "FSSAI Verified" safety badge, lab-tested fat & purity indicators).
3. Connect with the backend at `http://localhost:8000/api`. Include a one-click button "Load Tech4Food Pitch Demo Scenario" that triggers the seed endpoint.

Ensure clean component structure, modern UI polish with Lucide-react icons, and smooth transitions.
```

### Acceptance Criteria:
- [ ] `npm run dev` serves on `http://localhost:5173`.
- [ ] Lineage graph clearly renders connections from `MILK-101` and `MILK-102` to `PAN-201`.
- [ ] Triggering recall on `MILK-101` updates UI badges in real time to Red (RECALLED) and Amber (QUARANTINED).
- [ ] Consumer passport is clean, trustworthy, and mobile-responsive.

---

## 4. Agent 3: QA, Compliance & Mock Data Engineer (`Gemini Argon`)

### Mission:
Ensure 100% demo readiness by constructing the official pitch dataset, the automated FSSAI recall notice generator, and exhaustive Pytest validation suites.

### Target Files:
* `backend/app/seed_data.py`: Pre-configured dataset implementing the exact Pitch Deck Scenario (Shirur & Junnar milk collection centres, Pune retail stores).
* `backend/app/services/fssai_export.py`: Generates official FSSAI FoSCoS-compliant recall notices in JSON and printable HTML formats.
* `backend/tests/test_recall_engine.py`: Pytest test suite validating graph traversal accuracy, multi-parent handling, and cycle prevention.
* `backend/tests/test_api.py`: Automated tests for all REST API endpoints.
* `DEMO_RUNBOOK.md`: Step-by-step 3-minute script for the team to present flawlessly on pitch day (Oct 23).

### Copy-Paste Prompt for Gemini Argon:
```text
You are the QA, Compliance & Data Engineer for DairyTrace (FoodSync) for the Tech4Food 2026 Hackathon.
Your mission is to build the seed data generator, the FSSAI recall notice export service, and the verification test suite.

CRITICAL INSTRUCTIONS:
1. Refer to `PROJECT_SPECIFICATION.md` for data models and the official demo reference scenario (Section 6).
2. Create `backend/app/seed_data.py`:
   - Populates `MILK-101` (1,000L from Shirur Centre) with full verified quality tests.
   - Populates `MILK-102` (800L from Junnar Centre).
   - Populates `MILK-103` (Control batch - 500L).
   - Links `MILK-101` + `MILK-102` to produce `PAN-201` (120kg).
   - Links `MILK-101` to produce `PAN-202` (90kg).
   - Links `MILK-103` to produce `PAN-303` (Control paneer).
   - Dispatches `PAN-201` to Retailer A (Kothrud) and Retailer B (Wakad).
   - Dispatches `PAN-202` to Retailer C (Hinjawadi).
3. Create `backend/app/services/fssai_export.py`:
   - Formats a standard FSSAI Food Recall Dossier with Ref Number, Date, Product Name, Brand Name, Batch Numbers, Nature of Hazard, Distribution Summary, and Action Advised.
4. Create comprehensive Pytest tests in `backend/tests/test_recall_engine.py`:
   - Test 1: Flagging `MILK-101` catches `PAN-201`, `PAN-202`, and Retailers A, B, C.
   - Test 2: Ensures `PAN-303` is never falsely flagged.
   - Test 3: Ensures co-input `MILK-102` is flagged for quarantine review.
5. Create `DEMO_RUNBOOK.md` in the project root detailing the exact 3-minute pitch demo flow.

Ensure high rigor and clear, deterministic test outputs.
```

### Acceptance Criteria:
- [x] `pytest tests/` runs with 100% passing rate.
- [x] Seeding script reliably re-initializes clean test data on demand via API.
- [x] FSSAI export generates a printable document that judges can inspect.

---

## 5. Execution Workflow & Handoff Checklist

```mermaid
sequenceDiagram
    autonumber
    actor User as You (Team Lead)
    participant A1 as Opus 5.5 (Backend Architect)
    participant A3 as Gemini Argon (Data & QA)
    participant A2 as Gemini Flash (Frontend UI)

    User->>A1: Implement backend models, DB & Graph Recall Engine
    A1-->>User: Backend running & endpoints validated
    User->>A3: Populate seed data & create Pytest validation suite
    A3-->>User: Tests pass; FSSAI exporter ready
    User->>A2: Build React UI & connect with API
    A2-->>User: Full UI connected with live lineage & recall
    User->>User: Rehearse 3-minute demo using DEMO_RUNBOOK.md
```
