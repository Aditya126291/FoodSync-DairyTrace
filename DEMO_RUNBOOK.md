# DairyTrace: Official 3-Minute Pitch Demo Runbook

**Event:** Tech4Food 2026 (CESA · ACM PCCOE Student Chapter · PCCOE, Pune)  
**Pitch Date:** October 23, 2026  
**Theme:** TRACE: Smart Food Traceability & Recall  
**Team:** FoodSync (Saloni Gupta, Vikash Kumar, Aditya Kumar)  
**Tagline:** *Every Batch Has a History. Every Recall Needs a Trace.*

---

## 0. Pre-Stage Checklist (5 Minutes Before Going Live)

Run these commands to ensure a clean, deterministic environment before walking up to the podium:

### Terminal 1 — Start the FastAPI Backend (`port 8000`)
```powershell
cd backend
uvicorn app.main:app --reload --port 8000
```

### Terminal 2 — Seed the Official Pitch Scenario & Verify Tests
```powershell
cd backend
python -m app.seed_data
pytest tests/ -v
# Or using standard library unittest (zero external test runner required):
python -m unittest discover -s tests -v
```
*(Or click **"Load Tech4Food Pitch Demo Scenario"** in the top-right navbar of the web dashboard, or call `POST http://localhost:8000/api/seed/tech4food`.)*

### Terminal 3 — Start the React + Vite Frontend (`port 5173`)
```powershell
cd frontend
npm run dev
```

### Browser Tabs to Keep Open (in Order)
1. **Tab 1:** `http://localhost:5173` — **Operations & Genealogy Dashboard**
2. **Tab 2:** `http://localhost:5173/passport/PAN-201` — **Public Consumer Batch Passport** (or `http://localhost:8000/api/public/passport/PAN-201`)
3. **Tab 3:** `http://localhost:8000/docs` — **Interactive Swagger API Docs** (backup / technical deep-dive for judges)

---

## 1. The 3-Minute Live Demo Script (180 Seconds)

### [0:00 – 0:35] Act I: The Transformation Gap in Indian Dairy (Saloni Gupta)
* **Visual on Screen:** Operations Dashboard showing the 6 active batches (`MILK-101`, `MILK-102`, `MILK-103`, `PAN-201`, `PAN-202`, `PAN-303`) and the Milk-to-Paneer Genealogy Graph.
* **Spoken Script:**
  > *"In India's dairy supply chain, raw milk from rural collection centres like Shirur and Junnar is pooled into central processing vats to manufacture paneer. When an Aflatoxin M1 or antibiotic residue alert strikes a raw milk batch three days later, processors face the **Transformation Gap**: a many-to-many blending graph where they cannot tell which paneer blocks or retail stores received that milk. The result? Either dangerous delays or blanket recalls that destroy lakhs of rupees of safe food. **DairyTrace** solves this in milliseconds."*
* **Live Action:**
  * Hover over `MILK-101` (1,000L from Shirur Collection Centre) and `MILK-102` (800L from Junnar Collection Centre).
  * Point out how `600L of MILK-101` + `400L of MILK-102` merged into `PAN-201` (120kg), while `400L of MILK-101` went into `PAN-202` (90kg).
  * Highlight the independent control flow: `MILK-103` (500L from Baramati) $\rightarrow$ `PAN-303` (150kg).

---

### [0:35 – 1:15] Act II: Evidence-Linked Trust Tiers & Consumer QR Passport (Vikash Kumar)
* **Visual on Screen:** Quality & Trust Tier panel for `MILK-101` / `PAN-201` + Consumer Passport view (`/passport/PAN-201`).
* **Spoken Script:**
  > *"First, DairyTrace eliminates blind trust in self-reported numbers using a 3-Tier Quality Evidence model: Tier 1 `SUPPLIER_ENTERED` at collection intake, Tier 2 `DOCUMENT_CHECKED` with lab certificates, and Tier 3 `VERIFIED` signed off by an NABL-accredited dairy chemist. Every finished pack of paneer gets a dynamic QR code. When a shopper in Kothrud scans `PAN-201`, they see a privacy-safe Consumer Passport showing pasteurization status, exact cooperative origin percentages (60% Shirur, 40% Junnar), and an FSSAI Standards Compliant badge—without leaking internal supplier PII or retail phone numbers."*
* **Live Action:**
  * Click/show the QR code for `PAN-201` (`/api/batches/PAN-201/qr`).
  * Switch to **Tab 2** (`/passport/PAN-201`) showing the green **FSSAI Standards Compliant** badge and the 60% / 40% raw milk origin breakdown.

---

### [1:15 – 2:20] Act III: The Smart Recall Engine — Millisecond Blast Radius (Aditya Kumar)
* **Visual on Screen:** Smart Recall Command Center Modal on `MILK-101`.
* **Spoken Script:**
  > *"Now, let's simulate an emergency. Confirmatory testing flags `MILK-101` from Shirur for elevated Aflatoxin M1. Watch what happens when we run our BFS Graph Recall Engine on `MILK-101`."*
* **Live Action 1 (Simulate):**
  * Select `MILK-101`, enter reason `"Aflatoxin M1 contamination above FSSAI 0.5 ppb threshold"`, and click **Simulate Blast Radius**.
  * Point out the 3 instant outputs:
    1. **Directly Compromised Finished Batches (Red):** `PAN-201` (120kg) and `PAN-202` (90kg) — 210kg total.
    2. **Co-Input Cross-Contamination Alert (Amber):** `MILK-102` (from Junnar) is automatically flagged for **Quarantine Review** because it was blended in the same vat as `MILK-101`!
    3. **Surgical Precision (Green Control):** `PAN-303` (150kg from `MILK-103`) is untouched—saving 41.6% of the plant's paneer inventory from unnecessary destruction.
    4. **Targeted Retail Lockdown List:** Exactly 3 stores—**Retailer A (Kothrud, 60kg)**, **Retailer B (Wakad, 60kg)**, and **Retailer C (Hinjawadi, 90kg)**—with manager contact numbers ready for immediate PoS lockdown.
* **Live Action 2 (Execute):**
  * Click **Execute Recall**.
  * Show the dashboard badges flip in real time: `MILK-101`, `PAN-201`, `PAN-202` turn **RECALLED (Red)**; `MILK-102` turns **QUARANTINED (Amber)**; `PAN-303` stays **ACTIVE (Green)**.

---

### [2:20 – 3:00] Act IV: One-Click FSSAI FoSCoS Recall Dossier & Live Consumer Protection (All)
* **Visual on Screen:** Printable FSSAI Form-I Recall Dossier (`/api/recall/1/export-fssai?format=html`) & refreshed Consumer Passport.
* **Spoken Script:**
  > *"Under the FSSAI Food Recall Procedure Regulations 2017, processors must file a statutory Form-I Recall Notice. DairyTrace auto-generates the print-ready FSSAI FoSCoS dossier in one click—complete with Reference Number, Class I Hazard Classification, compromised batch IDs, co-input quarantine directives, and the retail lockdown manifest. And simultaneously, if a consumer scans `PAN-201` right now, the public passport has automatically flipped from Green to a Red **ACTIVE FOOD RECALL — DO NOT CONSUME** alert. From 72-hour paper guesswork to 50-millisecond surgical precision—that is DairyTrace."*
* **Live Action:**
  * Open the printable **FSSAI Recall Dossier** (`/api/recall/1/export-fssai?format=html`) to show judges the statutory Form-I document.
  * Refresh **Tab 2** (`/passport/PAN-201`) to show the live consumer warning badge.

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

---

## 3. Emergency CLI / API Fallback Commands

If you ever need to reset or demonstrate the backend directly from PowerShell during technical judging:

```powershell
# 1. Reset & Re-seed the Pitch Scenario
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/seed/tech4food"

# 2. Simulate Blast Radius on MILK-101 (Non-mutating)
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/recall/simulate" `
  -ContentType "application/json" `
  -Body '{"batch_id": "MILK-101", "reason": "Aflatoxin M1 contamination"}'

# 3. Execute Recall on MILK-101 (Commits RECALLED & QUARANTINED states + FSSAI Dossier)
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/recall/execute" `
  -ContentType "application/json" `
  -Body '{"batch_id": "MILK-101", "reason": "Aflatoxin M1 contamination", "severity": "CRITICAL", "initiated_by": "Saloni Gupta"}'

# 4. Open Printable FSSAI Form-I Recall Notice in Browser
Start-Process "http://localhost:8000/api/recall/1/export-fssai?format=html"
```
