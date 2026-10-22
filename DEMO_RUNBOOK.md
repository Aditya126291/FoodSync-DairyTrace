# DairyTrace: Official 3-Minute Pitch Demo Runbook

**Event:** Tech4Food 2026 (CESA · ACM PCCOE Student Chapter · PCCOE, Pune)  
**Pitch Date:** October 23, 2026  
**Theme:** TRACE: Smart Food Traceability & Recall  
**Team:** FoodSync (Saloni Gupta, Vikash Kumar, Aditya Kumar)  
**Tagline:** *Every Batch Has a History. Every Recall Needs a Trace.*

---

## 0. Pre-Stage Checklist (5 Minutes Before Going Live)

### Option A — One-Command Launcher (Recommended)
```bash
# macOS / Linux (with clean database re-seed)
./start.sh --reset
```
```powershell
# Windows PowerShell (with clean database re-seed)
.\start.ps1 -Reset
```

### Option B — Manual Terminal Setup
1. **Seed Database & Verify Tests (`backend/`):**
   ```bash
   cd backend
   ./.venv/bin/python -m app.manage seed
   ./.venv/bin/python -m pytest -q
   ```
2. **Start FastAPI Backend (`port 8000`):**
   ```bash
   cd backend
   ./.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
3. **Start React + Vite Frontend (`port 5173`):**
   ```bash
   cd frontend
   npm run dev -- --host 127.0.0.1 --port 5173
   ```

### Pre-Seeded Staff Login Credentials
- **Inspector (`INSPECTOR`):** `inspector@dairytrace.demo` / `Inspect@2026` *(Priya Nair — FSSAI Field Inspectorate)*
- **QA Officer (`QA_OFFICER`):** `qa@dairytrace.demo` / `QaOfficer@2026` *(Vikram Patil — FoodSync Quality Assurance)*

### Browser Tabs to Keep Open
1. **Tab 1:** `http://127.0.0.1:5173` — **Landing Page & Unified QR Scanner**
2. **Tab 2:** `http://127.0.0.1:5173/passport/PAN-201` — **Public Consumer Product Passport**
3. **Tab 3:** `http://127.0.0.1:5173/login` — **Staff Login (`INSPECTOR` / `QA_OFFICER`)**

---

## 1. The 3-Minute Live Demo Script (180 Seconds)

### [0:00 – 0:40] Act I: Consumer QR Scan & Two-Panel AI Complaint Copilot (Saloni Gupta)
* **Visual on Screen:** Landing page QR Scanner (`/`) $\rightarrow$ Consumer Passport (`/passport/PAN-201`) $\rightarrow$ AI Complaint Workspace (`/passport/PAN-201/report`).
* **Live Action:**
  1. Scan or select `PAN-201` on the landing page while logged out.
  2. Show the **Public Product Passport** (`/passport/PAN-201`): 3-Tier `VERIFIED` trust badge, 98% purity score, and farm-to-pack timeline (60% Shirur `MILK-101` + 40% Junnar `MILK-102`).
  3. Click **"Report a Safety Concern"** to open `/passport/PAN-201/report`.
  4. Point out that Batch/Lot `PAN-201`, Product Code, Facility, Mfg Date, and Expiry Date are **automatically bound and locked** from the QR scan.
  5. In the right-hand **AI Copilot** panel, click a quick prompt or drop a forensic lab note / type a complaint description. Show all 17 structured fields + Risk Assessment, Root Cause Hypothesis, and CAPA recommendations populate with green AI highlights, then click **Commit Complaint**.

---

### [0:40 – 1:35] Act II: Server-Verified RBAC & Physical Security Inspection (Vikash Kumar)
* **Visual on Screen:** Staff Login (`/login`) $\rightarrow$ Staff Batch Workspace (`/staff/batch/PAN-201`).
* **Live Action:**
  1. Sign in at `/login` as **Inspector** (`inspector@dairytrace.demo` / `Inspect@2026`).
  2. Point out that roles come strictly from the server-verified JWT (`/api/auth/me`) and accounts are provisioned only via `python -m app.manage create-user`.
  3. Inspect the Milk-to-Paneer Genealogy Graph (`600L MILK-101` + `400L MILK-102` $\rightarrow$ `PAN-201`; `400L MILK-101` $\rightarrow$ `PAN-202`; `500L MILK-103` $\rightarrow$ `PAN-303`).
  4. Log a **Physical Security Inspection** with tamper-evident SHA-256 hash and optional photo evidence.
  5. Open **Blast Radius Simulation** on `MILK-101` — note that as an `INSPECTOR`, you can simulate the blast radius but **cannot** execute a recall (enforced by both UI and `403 Forbidden` on the API).

---

### [1:35 – 2:30] Act III: QA Officer Recall Execution & Millisecond Blast Radius (Aditya Kumar)
* **Visual on Screen:** Sign in as **QA Officer** (`qa@dairytrace.demo` / `QaOfficer@2026`) $\rightarrow$ Smart Recall Modal on `MILK-101`.
* **Live Action:**
  1. Sign in as QA Officer (`qa@dairytrace.demo`). Show QA-exclusive controls: **New Batch**, **Record Quality Check**, **Dispatch to Store**, and **Execute Official Recall**.
  2. Open Recall Modal on `MILK-101` (`"Aflatoxin M1 contamination above FSSAI 0.5 ppb threshold"`):
     - **Compromised Finished Batches (Red):** `PAN-201` (120kg) and `PAN-202` (90kg) — 210kg total.
     - **Co-Input Quarantine Alert (Amber):** `MILK-102` (from Junnar) flagged for lab verification because it was blended in the same vat.
     - **Safe Control Untouched (Green):** `PAN-303` (150kg from `MILK-103`) remains active — saving 41.6% of plant inventory.
     - **Targeted Retail Lockdown:** Retailer A (Kothrud), Retailer B (Wakad), and Retailer C (Hinjawadi).
  3. Type `MILK-101` to confirm and click **Execute Official Recall**.

---

### [2:30 – 3:00] Act IV: Statutory FSSAI Form-I Notice & Live Consumer Protection (All)
* **Visual on Screen:** Printable FSSAI Schedule-I Recall Notice Modal & refreshed Consumer Passport (`/passport/PAN-201`).
* **Live Action:**
  1. Click **Open Printable FSSAI Recall Notice** to display the statutory Schedule-I / Form-I recall document.
  2. Switch back to `/passport/PAN-201` and refresh: the consumer badge has flipped from Green to a Red **RECALLED — DO NOT CONSUME** warning.

---

## 2. Reference Scenario Cheat Sheet (For Judge Q&A)

| Batch / Entity | Type | Quantity | Origin / Location | Status Before Recall | Status After `MILK-101` Recall |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`MILK-101`** | Raw Milk | 1,000 L | Shirur Collection Centre | `ACTIVE` | **`RECALLED`** (Root Source) |
| **`MILK-102`** | Raw Milk | 800 L | Junnar Collection Centre | `ACTIVE` | **`QUARANTINED`** (Co-input in Vat) |
| **`MILK-103`** | Raw Milk | 500 L | Baramati Chilling Centre | `ACTIVE` | **`ACTIVE`** (Safe Control) |
| **`PAN-201`** | Paneer | 120 kg | 600L `MILK-101` + 400L `MILK-102` | `ACTIVE` | **`RECALLED`** (Descendant 1) |
| **`PAN-202`** | Paneer | 90 kg | 400L `MILK-101` alone | `ACTIVE` | **`RECALLED`** (Descendant 2) |
| **`PAN-303`** | Paneer | 150 kg | 500L `MILK-103` alone | `ACTIVE` | **`ACTIVE`** (Safe Control) |
| **Retailer A** | Retail Store | 60 kg (`PAN-201`) | Kothrud, Pune | Dispatched | **Targeted Lockdown** |
| **Retailer B** | Retail Store | 60 kg (`PAN-201`) | Wakad, Pune | Dispatched | **Targeted Lockdown** |
| **Retailer C** | Retail Store | 90 kg (`PAN-202`) | Hinjawadi, Pune | Dispatched | **Targeted Lockdown** |
