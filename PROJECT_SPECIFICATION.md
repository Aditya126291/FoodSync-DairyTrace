# DairyTrace: Complete Technical Specification

**Theme:** TRACE: Smart Food Traceability & Recall  
**Event:** Tech4Food 2026 (CESA · ACM PCCOE Student Chapter · PCCOE, Pune)  
**Team:** FoodSync (Saloni Gupta, Vikash Kumar, Aditya Kumar)  
**Tagline:** *Every Batch Has a History. Every Recall Needs a Trace.*

---

## 1. System Vision & Problem Formulation

### 1.1 The Industry Challenge
In the Indian dairy processing ecosystem, milk arrives from hundreds of rural collection centres and is pooled into processing vats to manufacture value-added dairy products like paneer, curd, and butter. 

When a food safety adulteration or microbiological contamination occurs (e.g., elevated aflatoxin M1, antibiotic residues, bacterial load, or detergent adulterants), traditional paper or siloed digital manifests fail because:
1. **The Transformation Gap:** Processing creates a complex many-to-many relationship (multiple raw milk batches merge to produce multiple paneer blocks).
2. **Untracked Downstream Blast Radius:** Processors cannot immediately identify which retail stores received packages derived from the flagged raw milk batch.
3. **Delayed & Indiscriminate Recalls:** Manufacturers either delay recalls while investigating paper trails or issue massive, blanket recalls that destroy millions of rupees of safe food.

### 1.2 The DairyTrace Solution
DairyTrace is a lightweight, software-first, QR-enabled traceability platform designed to bridge milk-to-paneer transformations. It features an automated **Graph Recall Engine** that computes the downstream blast radius in milliseconds, links verifiable lab test records with explicit trust tiers, and empowers consumers with a mobile batch passport.

---

## 2. Core Functional Pillars

### Pillar 1: Batch Passport & Dynamic QR Code
* Every raw milk collection and finished paneer batch receives an immutable Batch ID (e.g., `MILK-2026-101`, `PAN-2026-201`).
* Generates a dynamic QR code pointing to the Public Consumer Passport: `https://<domain>/passport/{batch_id}`.
* Dual permission model:
  * **Internal View (Authorized Users):** Full genealogy, test certificates, temperatures, dispatch records, and audit history.
  * **Public View (Consumers):** Approved transparency fields: Processing date, origin cooperative/facility, pasteurization status, and "FSSAI Standards Compliant" verification badge.

### Pillar 2: Milk-to-Paneer Genealogy (The Transformation Graph)
* Records raw material input-to-output ratios (e.g., 600L from `M-101` + 400L from `M-102` $\rightarrow$ 120kg in `P-201` + 80kg in `P-202`).
* Supports:
  * **Forward Tracing:** Milk $\rightarrow$ Co-inputs $\rightarrow$ Paneer batches $\rightarrow$ Distributors $\rightarrow$ Retail Outlets.
  * **Backward Tracing:** Paneer pack $\rightarrow$ Parent milk batches $\rightarrow$ Collection centres $\rightarrow$ Farmer clusters.

### Pillar 3: Smart Recall Engine (Blast Radius Traversal)
* Triggered when QA/Admin flags a batch with a reported or confirmed safety alert.
* Uses Breadth-First Search (BFS) / Depth-First Search (DFS) graph traversal over `batch_links` and `distribution_records`.
* **Output Outputs:**
  1. **Directly Compromised Batches:** Every finished product containing ingredients from the flagged batch.
  2. **Co-Input Batches for Quarantine Review:** Other safe milk batches blended in the same vat that are now cross-contaminated.
  3. **Targeted Retail Lockdown List:** Exact retail stores (Name, Location, Phone, Units received) currently holding affected stock.
  4. **FSSAI Recall Dossier:** Auto-drafts an incident report following the FSSAI FoSCoS recall notification framework.

### Pillar 4: Evidence-Linked Quality Records with Trust Tiers
* Prevents blind trust in self-reported numbers by enforcing a 3-tier classification:
  * Tier 1: **SUPPLIER_ENTERED** (Self-reported at collection centre).
  * Tier 2: **DOCUMENT_CHECKED** (Lab report PDF/image attached with certificate number).
  * Tier 3: **VERIFIED** (Validated by accredited dairy chemist / certified lab with digital sign-off).
* Core parameters tracked: Fat %, SNF (Solids-Not-Fat) %, Acidity (lactic acid %), MBRT (Methylene Blue Reduction Test), and Adulteration screens (Urea, Starch, Detergent, Neutralizers).

---

## 3. Database Schema & Relational Specifications

Database engine: **SQLite** (local hackathon speed and zero-friction demo) with seamless migration compatibility to **PostgreSQL**.

### 3.1 `batches` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(64) | PRIMARY KEY | Batch code (e.g. `MILK-101`, `PAN-201`) |
| `product_type` | VARCHAR(20) | NOT NULL | `MILK` or `PANEER` |
| `initial_quantity` | FLOAT | NOT NULL | Volume in Liters (Milk) or kg (Paneer) |
| `remaining_quantity` | FLOAT | NOT NULL | Current unsold/unprocessed quantity |
| `facility_name` | VARCHAR(120) | NOT NULL | Processing plant / Chilling centre name |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | `ACTIVE`, `QUARANTINED`, `RECALLED` |
| `production_date` | DATETIME | NOT NULL | Date of collection or curdling |
| `expiry_date` | DATETIME | NULLABLE | Product shelf-life expiration |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | System timestamp |

### 3.2 `batch_links` Table (Genealogy Edges)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Edge ID |
| `parent_batch_id` | VARCHAR(64) | FOREIGN KEY (`batches.id`) | Raw material batch (e.g., `MILK-101`) |
| `child_batch_id` | VARCHAR(64) | FOREIGN KEY (`batches.id`) | Finished product batch (e.g., `PAN-201`) |
| `quantity_used` | FLOAT | NOT NULL | Quantity of parent consumed |
| `unit` | VARCHAR(10) | DEFAULT 'L' | 'L' (Liters) or 'KG' |
| `linked_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Processing timestamp |

### 3.3 `quality_records` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Record ID |
| `batch_id` | VARCHAR(64) | FOREIGN KEY (`batches.id`) | Targeted batch |
| `test_date` | DATETIME | NOT NULL | When the test was performed |
| `lab_name` | VARCHAR(120) | NOT NULL | Lab or testing facility name |
| `fat_percentage` | FLOAT | NOT NULL | Milk fat percentage (e.g., 4.5) |
| `snf_percentage` | FLOAT | NOT NULL | Solids-Not-Fat percentage (e.g., 8.5) |
| `acidity` | FLOAT | NOT NULL | Acidity % lactic acid (e.g., 0.14) |
| `adulterant_test` | VARCHAR(20) | DEFAULT 'NEGATIVE' | `NEGATIVE` or `POSITIVE` |
| `contaminant_details` | TEXT | NULLABLE | Details if adulteration detected |
| `trust_level` | VARCHAR(30) | NOT NULL | `SUPPLIER_ENTERED`, `DOCUMENT_CHECKED`, `VERIFIED` |
| `certificate_url` | VARCHAR(255) | NULLABLE | Link to uploaded report/certificate |

### 3.4 `distribution_records` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Distribution ID |
| `batch_id` | VARCHAR(64) | FOREIGN KEY (`batches.id`) | Batch dispatched |
| `destination_name` | VARCHAR(120) | NOT NULL | Store or distributor (e.g., "Retailer A (Kothrud)") |
| `destination_type` | VARCHAR(20) | NOT NULL | `RETAILER` or `DISTRIBUTOR` |
| `location` | VARCHAR(120) | NOT NULL | City/Neighborhood (e.g., "Pune, MH") |
| `quantity_dispatched`| FLOAT | NOT NULL | Units/kg sent |
| `contact_phone` | VARCHAR(20) | NOT NULL | Retail contact number |
| `dispatched_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Dispatch timestamp |

### 3.5 `recall_events` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Recall event ID |
| `root_batch_id` | VARCHAR(64) | FOREIGN KEY (`batches.id`) | Originating defective batch |
| `reason` | TEXT | NOT NULL | Description of failure/contaminant |
| `severity` | VARCHAR(20) | NOT NULL | `CRITICAL`, `MAJOR`, `PRECAUTIONARY` |
| `initiated_by` | VARCHAR(80) | NOT NULL | QA Officer name / ID |
| `status` | VARCHAR(20) | DEFAULT 'ACTIVE' | `ACTIVE`, `CONTAINED`, `CLOSED` |
| `affected_batches_json`| TEXT | NOT NULL | JSON serialized array of affected batch IDs |
| `affected_destinations_json`| TEXT | NOT NULL | JSON serialized array of retail destinations |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

---

## 4. REST API Endpoint Specifications

Base URL: `http://localhost:8000/api`

### 4.1 Batch & Lineage Endpoints
* `GET /batches`: Returns all batches. Supports filtering by `product_type` and `status`.
* `POST /batches`: Creates a new batch with initial volume and facility.
* `POST /batches/link`: Links parent batch(es) to a child batch (Milk $\rightarrow$ Paneer).
* `GET /batches/{batch_id}/lineage`: Returns recursive graph of upstream inputs (provenance) and downstream outputs.
* `GET /batches/{batch_id}/qr`: Generates a dynamic PNG/SVG QR code representing the public passport URL.

### 4.2 Quality & Evidence Endpoints
* `POST /quality`: Attaches a new quality testing record with specific trust level.
* `GET /quality/{batch_id}`: Fetches all lab reports and trust indicators for a batch.

### 4.3 Smart Recall Endpoints
* `POST /recall/simulate`: 
  * Request Body: `{ "batch_id": "MILK-101", "reason": "Aflatoxin M1 contamination" }`
  * Response: Computes the blast radius in real time without mutating database state. Returns list of affected paneer batches, co-inputs, and retail destinations.
* `POST /recall/execute`:
  * Commits the recall: sets root and descendant batches to `RECALLED`, co-inputs to `QUARANTINED`, creates an audit log entry, and generates an official FSSAI recall notice.
* `GET /recall/history`: Lists all past recall actions and containment statuses.
* `GET /recall/{recall_id}/export-fssai`: Returns structured JSON & formatted printable HTML/PDF FSSAI recall notice.

### 4.4 Public Consumer Endpoint
* `GET /public/passport/{batch_id}`:
  * Publicly accessible, unauthenticated.
  * Strips internal financial and supplier identities; returns consumer-friendly data: product name, facility, manufacture date, quality compliance status, and raw milk origin breakdown.

### 4.5 Seed Data Endpoint
* `POST /seed/tech4food`: Wipes test database and seeds the exact pitch deck scenario (`M-101`, `M-102`, `P-201`, `P-202`, Retailers A, B, C).

---

## 5. The Graph Traversal Recall Algorithm

```python
def compute_blast_radius(root_batch_id: str, db_session) -> dict:
    """
    Traverses batch_links forward to find all downstream products,
    co-inputs, and retail destinations.
    """
    visited_batches = set()
    queue = [root_batch_id]
    affected_batches = []
    co_input_batches = set()
    
    while queue:
        current_id = queue.pop(0)
        visited_batches.add(current_id)
        
        # 1. Find all child batches derived from current_id
        child_links = db_session.query(BatchLink).filter_by(parent_batch_id=current_id).all()
        for link in child_links:
            child_id = link.child_batch_id
            if child_id not in visited_batches:
                affected_batches.append(child_id)
                queue.append(child_id)
                
            # 2. Find sibling inputs (co-inputs) used in making this same child
            sibling_links = db_session.query(BatchLink).filter_by(child_batch_id=child_id).all()
            for sib in sibling_links:
                if sib.parent_batch_id != root_batch_id and sib.parent_batch_id not in visited_batches:
                    co_input_batches.add(sib.parent_batch_id)
                    
    # 3. Find all distribution destinations for affected finished batches
    all_compromised_ids = [root_batch_id] + affected_batches
    destinations = db_session.query(DistributionRecord).filter(
        DistributionRecord.batch_id.in_(all_compromised_ids)
    ).all()
    
    return {
        "root_batch": root_batch_id,
        "affected_product_batches": affected_batches,
        "co_input_batches_for_review": list(co_input_batches),
        "compromised_retail_destinations": destinations
    }
```

---

## 6. Official Pitch Demo Reference Scenario

| Node Type | ID | Details | Role in Pitch Demo |
| :--- | :--- | :--- | :--- |
| **Input Milk** | `MILK-101` | 1,000L from Shirur Collection Centre | **Contaminated / Flagged Batch** |
| **Input Milk** | `MILK-102` | 800L from Junnar Collection Centre | **Co-input Batch (Safe raw milk mixed into vat)** |
| **Processed Paneer** | `PAN-201` | 120kg (Made from `MILK-101` + `MILK-102`) | **Affected Finished Batch 1** |
| **Processed Paneer** | `PAN-202` | 90kg (Made from `MILK-101` alone) | **Affected Finished Batch 2** |
| **Control Paneer** | `PAN-303` | 150kg (Made from `MILK-103` alone) | **Safe Control Batch (Must NOT be flagged)** |
| **Retail Destination** | `Retailer A` | Kothrud, Pune (Received 60kg from `PAN-201`) | **Targeted for immediate recall lockdown** |
| **Retail Destination** | `Retailer B` | Wakad, Pune (Received 60kg from `PAN-201`) | **Targeted for immediate recall lockdown** |
| **Retail Destination** | `Retailer C` | Hinjawadi, Pune (Received 90kg from `PAN-202`) | **Targeted for immediate recall lockdown** |
