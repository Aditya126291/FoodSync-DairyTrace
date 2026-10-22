# FoodSync (DairyTrace) — Tech4Food 2026

**Theme:** TRACE: Smart Food Traceability & Recall  
**Team:** FoodSync (Aditya Kumar, Saloni Gupta, Vikash Kumar)  
**Tagline:** *Every Batch Has a History. Every Recall Needs a Trace.*

---

## ⚡ One-Command Quick Start

### macOS / Linux
```bash
./start.sh
```
*(Pass `./start.sh --reset` to wipe and re-seed the starter Tech4Food database.)*

### Windows (PowerShell)
```powershell
.\start.ps1
```
*(Pass `.\start.ps1 -Reset` to wipe and re-seed the starter Tech4Food database.)*

Once running:
- **Web Application:** `http://127.0.0.1:5173`
- **Interactive Swagger API Docs:** `http://127.0.0.1:8000/docs`

---

## 🔐 Server-Verified Staff Authentication & RBAC

DairyTrace enforces strict server-side role-based access control (`INSPECTOR` vs `QA_OFFICER`) using bcrypt password hashing and signed HS256 JWT tokens. Users can never self-select a role in the browser, and there is no public self-signup endpoint.

### Pre-Seeded Demo Accounts
| Role | Email | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **Inspector** (`INSPECTOR`) | `inspector@dairytrace.demo` | `Inspect@2026` | Scan/search batches, inspect milk-to-paneer genealogy, log physical security inspections (SHA-256 + photo evidence), simulate blast radius, triage complaints |
| **QA Officer** (`QA_OFFICER`) | `qa@dairytrace.demo` | `QaOfficer@2026` | All Inspector capabilities **plus** create raw milk & paneer batches, attach quality records, link milk-to-paneer vats, dispatch to retail stores, execute recalls, export FSSAI Schedule-I notices, delete complaints |

### Admin CLI Account Provisioning
Staff accounts are created and managed exclusively via the backend CLI:
```bash
cd backend
./.venv/bin/python -m app.manage list-users
./.venv/bin/python -m app.manage create-user --email officer@dairytrace.in --name "Saloni Gupta" --role INSPECTOR --org "FSSAI Pune"
./.venv/bin/python -m app.manage reset-password --email officer@dairytrace.in
./.venv/bin/python -m app.manage deactivate-user --email officer@dairytrace.in
./.venv/bin/python -m app.manage seed
```

---

## 🧭 Core Product Workflows

1. **Single QR Scanner Entry (`/`)**:
   - **Public Consumer (Not signed in):** Scanning or entering a batch code (e.g. `PAN-201`) opens the public **Product Passport** (`/passport/PAN-201`) showing 3-tier verification status, purity metrics, and farm-to-pack cooperative lineage.
   - **Signed-In Staff (`INSPECTOR` or `QA_OFFICER`):** Using the same scanner routes directly into the **Staff Batch Audit Workspace** (`/staff/batch/PAN-201`).
2. **Two-Panel AI Complaint Management System (`/passport/:id/report` & `/staff/batch/:id/report`)**:
   - Every complaint is pre-bound to a scanned QR batch (`batchLotNumber`, `productCode`, `productDescription`, `manufacturingSite`, `manufacturingDate`, and `expiryDate` are auto-filled from the batch record and locked).
   - **Left Panel:** 17-field structured complaint record + Risk Assessment, Root Cause Hypothesis, and CAPA checklist, with green AI-updated field highlights.
   - **Right Panel:** AI Copilot chat supporting natural-language complaint intake, partial field updates, quick-action prompts, and drag-and-drop file upload (`.pdf`, `.docx`, `.csv`, `.txt`). Uses Groq Llama 3.3 70B when `GROQ_API_KEY` is configured in `backend/.env`, with automatic deterministic fallback.
3. **Smart BFS Recall Engine & FSSAI FoSCoS Export**:
   - Simulates downstream finished paneer batches (`PAN-201`, `PAN-202`), co-input milk quarantine alerts (`MILK-102`), untouched control batches (`PAN-303`), and retail store lockdown lists in milliseconds.
   - QA Officers can execute the recall and export a print-ready statutory **FSSAI Schedule-I Recall Notice**.

---

## 🧪 Running Tests & Build Verification

```bash
# Backend test suite (Pytest)
cd backend
./.venv/bin/python -m pytest -q

# Frontend production build
cd frontend
npm run build
```
