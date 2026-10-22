"""Official Tech4Food 2026 Pitch Demo Seed Dataset Generator for DairyTrace.

Implements Section 6 of PROJECT_SPECIFICATION.md and Section 4 of AGENT_TASK_ASSIGNMENTS.md:
- MILK-101: 1,000L from Shirur Collection Centre (with full VERIFIED quality tests)
- MILK-102: 800L from Junnar Collection Centre (Co-input batch)
- MILK-103: 500L from Baramati Chilling Centre (Control raw milk batch)
- PAN-201: 120kg Paneer (Made from 600L MILK-101 + 400L MILK-102)
- PAN-202: 90kg Paneer (Made from 400L MILK-101 alone)
- PAN-303: 150kg Paneer (Made from 500L MILK-103 alone — Safe Control Batch)
- Retailer A (Kothrud, Pune): Received 60kg from PAN-201
- Retailer B (Wakad, Pune): Received 60kg from PAN-201
- Retailer C (Hinjawadi, Pune): Received 90kg from PAN-202
"""

from datetime import datetime, timedelta
import os
import sys
from typing import Any, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal, init_db
from app.models import (
    Batch,
    BatchLink,
    ComplaintRecord,
    DistributionRecord,
    QualityRecord,
    RecallEvent,
    SecurityInspection,
)


def seed_tech4food_scenario(db_session: Optional[Session] = None) -> dict[str, Any]:
    """
    Wipes existing database records and seeds the canonical Tech4Food 2026 pitch scenario.
    If `db_session` is None, creates and closes its own session against the configured engine.
    """
    owns_session = False
    if db_session is None:
        init_db()
        db_session = SessionLocal()
        owns_session = True

    try:
        # 1. Clean wipe in foreign-key-safe child-to-parent order
        db_session.query(ComplaintRecord).delete()
        db_session.query(SecurityInspection).delete()
        db_session.query(RecallEvent).delete()
        db_session.query(DistributionRecord).delete()
        db_session.query(QualityRecord).delete()
        db_session.query(BatchLink).delete()
        db_session.query(Batch).delete()
        try:
            db_session.execute(text("DELETE FROM sqlite_sequence"))
        except Exception:
            pass
        db_session.commit()
        db_session.expunge_all()

        base_date = datetime(2026, 10, 22, 6, 0, 0)

        # 2. Seed Raw Milk & Finished Paneer Batches
        batches = [
            Batch(
                id="MILK-101",
                product_type="MILK",
                initial_quantity=1000.0,
                remaining_quantity=0.0,  # 600L -> PAN-201, 400L -> PAN-202
                facility_name="Shirur Collection Centre",
                status="ACTIVE",
                production_date=base_date,
                expiry_date=base_date + timedelta(days=2),
                created_at=base_date,
            ),
            Batch(
                id="MILK-102",
                product_type="MILK",
                initial_quantity=800.0,
                remaining_quantity=400.0,  # 400L -> PAN-201, 400L remaining in cold tank
                facility_name="Junnar Collection Centre",
                status="ACTIVE",
                production_date=base_date + timedelta(minutes=30),
                expiry_date=base_date + timedelta(days=2),
                created_at=base_date + timedelta(minutes=30),
            ),
            Batch(
                id="MILK-103",
                product_type="MILK",
                initial_quantity=500.0,
                remaining_quantity=0.0,  # 500L -> PAN-303 (Control)
                facility_name="Baramati Chilling Centre",
                status="ACTIVE",
                production_date=base_date + timedelta(hours=1),
                expiry_date=base_date + timedelta(days=2),
                created_at=base_date + timedelta(hours=1),
            ),
            Batch(
                id="PAN-201",
                product_type="PANEER",
                initial_quantity=120.0,
                remaining_quantity=0.0,  # 60kg -> Retailer A, 60kg -> Retailer B
                facility_name="FoodSync Central Dairy Plant, Pune",
                status="ACTIVE",
                production_date=base_date + timedelta(hours=4),
                expiry_date=base_date + timedelta(days=14),
                created_at=base_date + timedelta(hours=4),
            ),
            Batch(
                id="PAN-202",
                product_type="PANEER",
                initial_quantity=90.0,
                remaining_quantity=0.0,  # 90kg -> Retailer C
                facility_name="FoodSync Central Dairy Plant, Pune",
                status="ACTIVE",
                production_date=base_date + timedelta(hours=5),
                expiry_date=base_date + timedelta(days=14),
                created_at=base_date + timedelta(hours=5),
            ),
            Batch(
                id="PAN-303",
                product_type="PANEER",
                initial_quantity=150.0,
                remaining_quantity=150.0,  # Safe Control Batch in cold storage
                facility_name="FoodSync Central Dairy Plant, Pune",
                status="ACTIVE",
                production_date=base_date + timedelta(hours=6),
                expiry_date=base_date + timedelta(days=14),
                created_at=base_date + timedelta(hours=6),
            ),
        ]
        db_session.add_all(batches)
        db_session.flush()

        # 3. Seed Genealogy Transformation Links (Milk -> Paneer)
        links = [
            BatchLink(
                parent_batch_id="MILK-101",
                child_batch_id="PAN-201",
                quantity_used=600.0,
                unit="L",
                linked_at=base_date + timedelta(hours=3, minutes=30),
            ),
            BatchLink(
                parent_batch_id="MILK-102",
                child_batch_id="PAN-201",
                quantity_used=400.0,
                unit="L",
                linked_at=base_date + timedelta(hours=3, minutes=35),
            ),
            BatchLink(
                parent_batch_id="MILK-101",
                child_batch_id="PAN-202",
                quantity_used=400.0,
                unit="L",
                linked_at=base_date + timedelta(hours=4, minutes=30),
            ),
            BatchLink(
                parent_batch_id="MILK-103",
                child_batch_id="PAN-303",
                quantity_used=500.0,
                unit="L",
                linked_at=base_date + timedelta(hours=5, minutes=30),
            ),
        ]
        db_session.add_all(links)
        db_session.flush()

        # 4. Seed Evidence-Linked Quality Records with 3-Tier Trust Classification
        quality_records = [
            # MILK-101: Initial collection centre intake + Full NABL Verified quality test
            QualityRecord(
                batch_id="MILK-101",
                test_date=base_date + timedelta(minutes=15),
                lab_name="Shirur Collection Rapid Lactometer Desk",
                fat_percentage=4.5,
                snf_percentage=8.6,
                acidity=0.14,
                adulterant_test="NEGATIVE",
                contaminant_details="Rapid intake screen clear for urea, starch, and neutralizers.",
                trust_level="SUPPLIER_ENTERED",
                certificate_url=None,
            ),
            QualityRecord(
                batch_id="MILK-101",
                test_date=base_date + timedelta(hours=2),
                lab_name="Pune Regional Dairy Quality Lab (NABL Accredited)",
                fat_percentage=4.6,
                snf_percentage=8.7,
                acidity=0.14,
                adulterant_test="NEGATIVE",
                contaminant_details="Standard physicochemical & MBRT parameters verified prior to vat pooling.",
                trust_level="VERIFIED",
                certificate_url="https://certs.dairytrace.in/2026/NABL-M101-VERIFIED.pdf",
            ),
            # MILK-102: Co-input batch from Junnar
            QualityRecord(
                batch_id="MILK-102",
                test_date=base_date + timedelta(hours=2, minutes=15),
                lab_name="Junnar Co-op Quality Testing Lab",
                fat_percentage=4.4,
                snf_percentage=8.5,
                acidity=0.13,
                adulterant_test="NEGATIVE",
                contaminant_details="No adulterants detected; certificate attached.",
                trust_level="DOCUMENT_CHECKED",
                certificate_url="https://certs.dairytrace.in/2026/JUNNAR-M102-DOC.pdf",
            ),
            # MILK-103: Control batch from Baramati
            QualityRecord(
                batch_id="MILK-103",
                test_date=base_date + timedelta(hours=2, minutes=45),
                lab_name="Pune Regional Dairy Quality Lab (NABL Accredited)",
                fat_percentage=4.7,
                snf_percentage=8.8,
                acidity=0.13,
                adulterant_test="NEGATIVE",
                contaminant_details="100% compliant across Fat, SNF, MBRT, and antibiotic residue panels.",
                trust_level="VERIFIED",
                certificate_url="https://certs.dairytrace.in/2026/NABL-M103-VERIFIED.pdf",
            ),
            # PAN-201: Finished Paneer Batch 1
            QualityRecord(
                batch_id="PAN-201",
                test_date=base_date + timedelta(hours=4, minutes=20),
                lab_name="FoodSync Central QA Lab, Pune",
                fat_percentage=24.5,
                snf_percentage=28.0,
                acidity=0.18,
                adulterant_test="NEGATIVE",
                contaminant_details="Moisture 52.4% (within FSSAI max 60% limit for Chhana/Paneer).",
                trust_level="VERIFIED",
                certificate_url="https://certs.dairytrace.in/2026/QA-PAN201.pdf",
            ),
            # PAN-202: Finished Paneer Batch 2
            QualityRecord(
                batch_id="PAN-202",
                test_date=base_date + timedelta(hours=5, minutes=20),
                lab_name="FoodSync Central QA Lab, Pune",
                fat_percentage=24.2,
                snf_percentage=27.8,
                acidity=0.19,
                adulterant_test="NEGATIVE",
                contaminant_details="Batch release QA check passed.",
                trust_level="DOCUMENT_CHECKED",
                certificate_url="https://certs.dairytrace.in/2026/QA-PAN202.pdf",
            ),
            # PAN-303: Control Paneer Batch
            QualityRecord(
                batch_id="PAN-303",
                test_date=base_date + timedelta(hours=6, minutes=20),
                lab_name="Pune Regional Dairy Quality Lab (NABL Accredited)",
                fat_percentage=25.0,
                snf_percentage=28.5,
                acidity=0.17,
                adulterant_test="NEGATIVE",
                contaminant_details="Gold-standard control batch; NABL chemist signed off.",
                trust_level="VERIFIED",
                certificate_url="https://certs.dairytrace.in/2026/NABL-PAN303.pdf",
            ),
        ]
        db_session.add_all(quality_records)
        db_session.flush()

        # 5. Seed Downstream Retail Distribution Records
        distributions = [
            DistributionRecord(
                batch_id="PAN-201",
                destination_name="Retailer A (Kothrud)",
                destination_type="RETAILER",
                location="Kothrud, Pune, MH",
                quantity_dispatched=60.0,
                contact_phone="+91-9822011101",
                dispatched_at=base_date + timedelta(hours=7),
            ),
            DistributionRecord(
                batch_id="PAN-201",
                destination_name="Retailer B (Wakad)",
                destination_type="RETAILER",
                location="Wakad, Pune, MH",
                quantity_dispatched=60.0,
                contact_phone="+91-9822011102",
                dispatched_at=base_date + timedelta(hours=7, minutes=15),
            ),
            DistributionRecord(
                batch_id="PAN-202",
                destination_name="Retailer C (Hinjawadi)",
                destination_type="RETAILER",
                location="Hinjawadi, Pune, MH",
                quantity_dispatched=90.0,
                contact_phone="+91-9822011103",
                dispatched_at=base_date + timedelta(hours=7, minutes=30),
            ),
        ]
        db_session.add_all(distributions)

        # 6. Seed starter complaints (same contract as the AI complaint workspace)
        starter_complaints = [
            ComplaintRecord(
                complaint_number="CC-2026-0001",
                batch_id="MILK-101",
                customer_name="Dr. Ananya Deshmukh",
                complaint_source="Lab (NABL)",
                product_name="Raw Milk",
                strength_grade="Fat 4.1% / SNF 8.2%",
                batch_lot_number="MILK-101",
                affected_quantity="1000 L",
                originating_site="Shirur Collection Centre",
                impacted_material="Downstream paneer PAN-201, PAN-202",
                complaint_type="Chemical / Mycotoxin Contaminant",
                complaint_date=(base_date + timedelta(hours=8)).strftime("%d %B %Y"),
                defect_summary="Aflatoxin M1 at 0.78 ug/kg exceeds the FSSAI limit of 0.50 ug/kg.",
                detailed_description=(
                    "Forensic laboratory confirmation on retained raw milk sample MILK-101 from Shirur Collection Centre "
                    "detected Aflatoxin M1 at 0.78 ug/kg alongside elevated acidity (0.21%). Recommend immediate blast-radius "
                    "simulation for downstream paneer batches PAN-201 and PAN-202."
                ),
                severity="Critical",
                priority="Urgent",
                risk_assessment="Critical - mycotoxin residue above permissible limit with downstream paneer exposure.",
                root_cause="Aflatoxin-contaminated cattle feed supplied to the Shirur catchment.",
                capa_json='["Immediate Containment: quarantine MILK-101 and all derived paneer.", '
                          '"Root Cause: test feed lots at contributing farms.", '
                          '"Preventive Action: add Aflatoxin M1 screening at intake."]',
                status="Committed",
                created_at=base_date + timedelta(hours=8),
            ),
            ComplaintRecord(
                complaint_number="CC-2026-0002",
                batch_id="PAN-201",
                customer_name="Rajesh Kulkarni",
                complaint_source="Retailer",
                product_name="Malai Paneer",
                strength_grade="200 g pack",
                batch_lot_number="PAN-201",
                affected_quantity="6 packs",
                originating_site="Pune Processing Plant",
                impacted_material="",
                complaint_type="Spoilage / Sourness",
                complaint_date=(base_date + timedelta(hours=8, minutes=30)).strftime("%d %B %Y"),
                defect_summary="Sour smell and excess whey in 6 packs at Retailer A (Kothrud).",
                detailed_description=(
                    "Store quality supervisor at Retailer A (Kothrud) reported sour smell and excess whey "
                    "moisture in 6 packs of batch PAN-201 during the morning shelf check."
                ),
                severity="High",
                priority="High",
                risk_assessment="High - possible microbial spoilage or cold-chain failure.",
                root_cause="Cold-chain excursion or elevated acidity at processing.",
                capa_json='["Immediate Containment: hold remaining PAN-201 stock at Retailer A.", '
                          '"Root Cause: review reefer temperature logs.", '
                          '"Preventive Action: tighten cold-chain monitoring."]',
                status="Committed",
                created_at=base_date + timedelta(hours=8, minutes=30),
            ),
        ]
        db_session.add_all(starter_complaints)
        db_session.commit()

        return {
            "status": "seeded",
            "scenario": "Tech4Food 2026 Official Pitch Demo Scenario",
            "batches_created": len(batches),
            "links_created": len(links),
            "quality_records_created": len(quality_records),
            "distributions_created": len(distributions),
            "complaints_created": len(starter_complaints),
            "batch_ids": [b.id for b in batches],
            "retail_destinations": [d.destination_name for d in distributions],
        }
    finally:
        if owns_session:
            db_session.close()


def seed_demo_users(db_session: Optional[Session] = None) -> list[str]:
    """Create the two demo staff accounts if missing. Passwords come from env or documented defaults."""
    from app.models import User
    from app.security import ROLE_INSPECTOR, ROLE_QA, hash_password

    owns_session = db_session is None
    if owns_session:
        init_db()
        db_session = SessionLocal()
    created: list[str] = []
    try:
        accounts = [
            ("inspector@dairytrace.demo", "Priya Nair", "FSSAI Field Inspectorate, Pune", ROLE_INSPECTOR,
             os.getenv("DEMO_INSPECTOR_PASSWORD", "Inspect@2026")),
            ("qa@dairytrace.demo", "Vikram Patil", "FoodSync Quality Assurance", ROLE_QA,
             os.getenv("DEMO_QA_PASSWORD", "QaOfficer@2026")),
        ]
        for email, name, org, role, password in accounts:
            if db_session.query(User).filter_by(email=email).first() is None:
                db_session.add(User(email=email, full_name=name, organisation=org, role=role,
                                    password_hash=hash_password(password)))
                created.append(email)
        db_session.commit()
        return created
    finally:
        if owns_session:
            db_session.close()


# Alias for convenience
seed_database = seed_tech4food_scenario


if __name__ == "__main__":
    for _email in seed_demo_users():
        print(f"[DairyTrace] Created demo user {_email}")
    summary = seed_tech4food_scenario()
    print(f"[DairyTrace] Successfully seeded {summary['scenario']}:")
    print(f"  - Batches ({summary['batches_created']}): {', '.join(summary['batch_ids'])}")
    print(f"  - Genealogy Links: {summary['links_created']}")
    print(f"  - Quality Records: {summary['quality_records_created']}")
    print(f"  - Retail Dispatches ({summary['distributions_created']}): {', '.join(summary['retail_destinations'])}")
