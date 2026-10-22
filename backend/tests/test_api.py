"""Automated End-to-End REST API Test Suite for DairyTrace (`backend/tests/test_api.py`).

Tests every endpoint specified in Section 4 of PROJECT_SPECIFICATION.md:
- POST /api/seed/tech4food
- GET /api/batches & POST /api/batches
- POST /api/batches/link
- GET /api/batches/{batch_id}/lineage
- GET /api/batches/{batch_id}/qr
- POST /api/quality & GET /api/quality/{batch_id}
- POST /api/distribution & GET /api/distribution
- POST /api/recall/simulate
- POST /api/recall/execute
- GET /api/recall/history
- GET /api/recall/{recall_id}/export-fssai
- GET /api/public/passport/{batch_id}
"""

import os
import sys
import unittest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from tests.conftest import isolated_test_client


def test_seed_and_batches_endpoints(client=None):
    """Tests POST /api/seed/tech4food, GET /api/batches (with filters), and POST /api/batches."""
    def _run(c):
        # 1. Seed the Tech4Food scenario
        res = c.post("/api/seed/tech4food")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "seeded"
        assert data["batches_created"] == 6
        assert data["links_created"] == 4
        assert data["distributions_created"] == 3

        # 2. List all batches and verify computed trust_level from quality records
        all_res = c.get("/api/batches")
        assert all_res.status_code == 200
        batches_list = all_res.json()
        assert len(batches_list) == 6
        trust_by_id = {b["id"]: b["trust_level"] for b in batches_list}
        assert trust_by_id["MILK-101"] == "VERIFIED"
        assert trust_by_id["MILK-102"] == "DOCUMENT_CHECKED"
        assert trust_by_id["PAN-202"] == "DOCUMENT_CHECKED"

        # 3. Filter by product_type=MILK and PANEER
        milk_res = c.get("/api/batches?product_type=MILK")
        assert milk_res.status_code == 200
        assert {b["id"] for b in milk_res.json()} == {"MILK-101", "MILK-102", "MILK-103"}

        paneer_res = c.get("/api/batches?product_type=PANEER")
        assert paneer_res.status_code == 200
        assert {b["id"] for b in paneer_res.json()} == {"PAN-201", "PAN-202", "PAN-303"}

        # 4. Create a new batch and verify duplicate rejection
        new_batch_res = c.post(
            "/api/batches",
            json={
                "id": "MILK-104",
                "product_type": "MILK",
                "initial_quantity": 750.0,
                "facility_name": "Khed Collection Centre",
            },
        )
        assert new_batch_res.status_code == 201
        created = new_batch_res.json()
        assert created["id"] == "MILK-104"
        assert created["remaining_quantity"] == 750.0
        assert created["status"] == "ACTIVE"
        assert created["expiry_date"] is not None

        dup_res = c.post(
            "/api/batches",
            json={
                "id": "MILK-104",
                "product_type": "MILK",
                "initial_quantity": 500.0,
                "facility_name": "Khed Collection Centre",
            },
        )
        assert dup_res.status_code == 409

    if client is not None:
        _run(client)
    else:
        with isolated_test_client() as (c, _):
            _run(c)


def test_lineage_link_and_qr_endpoints(client=None):
    """Tests POST /api/batches/link, GET /api/batches/{id}/lineage, and GET /api/batches/{id}/qr."""
    def _run(c):
        c.post("/api/seed/tech4food")

        # 1. Inspect forward lineage from MILK-101
        lin_milk = c.get("/api/batches/MILK-101/lineage")
        assert lin_milk.status_code == 200
        lin_data = lin_milk.json()
        assert lin_data["batch_id"] == "MILK-101"
        downstream_ids = {b["id"] for b in lin_data["downstream"]}
        assert downstream_ids == {"PAN-201", "PAN-202"}
        co_input_ids = {b["id"] for b in lin_data["co_inputs"]}
        assert co_input_ids == {"MILK-102"}
        assert len(lin_data["distributions"]) == 3

        # 2. Inspect backward provenance from PAN-201
        lin_pan = c.get("/api/batches/PAN-201/lineage")
        assert lin_pan.status_code == 200
        upstream_ids = {b["id"] for b in lin_pan.json()["upstream"]}
        assert upstream_ids == {"MILK-101", "MILK-102"}

        # 3. Reject cycle creation via API (PAN-201 -> MILK-101)
        cycle_res = c.post(
            "/api/batches/link",
            json={
                "parent_batch_id": "PAN-201",
                "child_batch_id": "MILK-101",
                "quantity_used": 10.0,
                "unit": "KG",
            },
        )
        assert cycle_res.status_code == 400
        assert "cycle" in cycle_res.json()["detail"].lower()

        # 4. Generate QR code in PNG, SVG, and JSON formats
        qr_png = c.get("/api/batches/PAN-201/qr")
        assert qr_png.status_code == 200
        assert qr_png.headers["content-type"] == "image/png"
        assert qr_png.content.startswith(b"\x89PNG\r\n\x1a\n")

        qr_svg = c.get("/api/batches/PAN-201/qr?format=svg")
        assert qr_svg.status_code == 200
        assert "image/svg+xml" in qr_svg.headers["content-type"]
        assert "<svg" in qr_svg.text
        assert 'viewBox="0 0 296 296"' in qr_svg.text

        qr_json = c.get("/api/batches/PAN-201/qr?format=json")
        assert qr_json.status_code == 200
        assert qr_json.json()["passport_url"].endswith("/passport/PAN-201")
        assert qr_json.json()["qr_base64"].startswith("data:image/png;base64,")

        # 5. 404 for unknown batch QR / lineage
        assert c.get("/api/batches/UNKNOWN-999/qr").status_code == 404
        assert c.get("/api/batches/UNKNOWN-999/lineage").status_code == 404

    if client is not None:
        _run(client)
    else:
        with isolated_test_client() as (c, _):
            _run(c)


def test_quality_and_distribution_endpoints(client=None):
    """Tests POST /api/quality, GET /api/quality/{batch_id}, POST /api/distribution, and GET /api/distribution."""
    def _run(c):
        c.post("/api/seed/tech4food")

        # 1. Fetch existing quality records for MILK-101
        q_res = c.get("/api/quality/MILK-101")
        assert q_res.status_code == 200
        records = q_res.json()
        assert len(records) >= 2
        trust_levels = {r["trust_level"] for r in records}
        assert "VERIFIED" in trust_levels

        # 2. Add a new POSITIVE contaminant lab report
        post_q = c.post(
            "/api/quality",
            json={
                "batch_id": "MILK-101",
                "lab_name": "FSSAI Referral Food Lab, Ghaziabad",
                "fat_percentage": 4.5,
                "snf_percentage": 8.6,
                "acidity": 0.16,
                "adulterant_test": "POSITIVE",
                "contaminant_details": "Elevated Aflatoxin M1 (1.8 ppb vs 0.5 ppb FSSAI limit)",
                "trust_level": "VERIFIED",
                "certificate_url": "https://certs.dairytrace.in/2026/FSSAI-REF-M101.pdf",
            },
        )
        assert post_q.status_code == 201
        assert post_q.json()["adulterant_test"] == "POSITIVE"

        # 3. Verify distribution endpoints
        dist_list = c.get("/api/distribution?batch_id=PAN-201")
        assert dist_list.status_code == 200
        assert len(dist_list.json()) == 2

        new_dist = c.post(
            "/api/distribution",
            json={
                "batch_id": "PAN-303",
                "destination_name": "Retailer D (Baner)",
                "destination_type": "RETAILER",
                "location": "Baner, Pune, MH",
                "quantity_dispatched": 50.0,
                "contact_phone": "+91-9822011104",
            },
        )
        assert new_dist.status_code == 201
        assert new_dist.json()["destination_name"] == "Retailer D (Baner)"

    if client is not None:
        _run(client)
    else:
        with isolated_test_client() as (c, _):
            _run(c)


def test_smart_recall_simulate_execute_history_and_fssai_export(client=None):
    """Tests non-mutating simulation, recall execution, recall history, and FSSAI export endpoints."""
    def _run(c):
        c.post("/api/seed/tech4food")

        # 1. Simulate recall on MILK-101
        sim_res = c.post(
            "/api/recall/simulate",
            json={
                "batch_id": "MILK-101",
                "reason": "Aflatoxin M1 contamination",
            },
        )
        assert sim_res.status_code == 200
        sim = sim_res.json()
        assert sim["root_batch"] == "MILK-101"
        assert sim["root_batch_details"]["id"] == "MILK-101"
        assert set(sim["affected_product_batches"]) == {"PAN-201", "PAN-202"}
        assert len(sim["affected_product_details"]) == 2
        assert sim["co_input_batches_for_review"] == ["MILK-102"]
        assert len(sim["co_input_details"]) == 1
        assert len(sim["compromised_retail_destinations"]) == 3
        assert sim["total_affected_volume_kg"] == 210.0
        assert sim["total_retail_units_at_risk"] == 210.0

        # Simulate recall directly on a leaf finished paneer batch (PAN-201)
        sim_leaf = c.post(
            "/api/recall/simulate",
            json={
                "batch_id": "PAN-201",
                "reason": "Direct packaging seal defect",
            },
        ).json()
        assert sim_leaf["total_affected_volume_kg"] == 120.0
        assert sim_leaf["total_retail_units"] == 120.0

        # Confirm simulation did NOT mutate database statuses
        b_check = c.get("/api/batches/MILK-101").json()
        assert b_check["status"] == "ACTIVE"

        # 2. Execute recall on MILK-101
        exec_res = c.post(
            "/api/recall/execute",
            json={
                "batch_id": "MILK-101",
                "reason": "Aflatoxin M1 contamination confirmed by NABL lab",
                "severity": "CRITICAL",
                "initiated_by": "Saloni Gupta (QA Officer)",
            },
        )
        assert exec_res.status_code == 200
        exec_data = exec_res.json()
        recall_id = exec_data["recall_event"]["id"]
        assert exec_data["recall_event"]["root_batch_id"] == "MILK-101"
        assert "fssai_dossier" in exec_data

        # Confirm statuses mutated accurately in database
        assert c.get("/api/batches/MILK-101").json()["status"] == "RECALLED"
        assert c.get("/api/batches/PAN-201").json()["status"] == "RECALLED"
        assert c.get("/api/batches/PAN-202").json()["status"] == "RECALLED"
        assert c.get("/api/batches/MILK-102").json()["status"] == "QUARANTINED"
        assert c.get("/api/batches/MILK-103").json()["status"] == "ACTIVE"
        assert c.get("/api/batches/PAN-303").json()["status"] == "ACTIVE"

        # 3. Check recall history
        hist_res = c.get("/api/recall/history")
        assert hist_res.status_code == 200
        history = hist_res.json()
        assert len(history) == 1
        assert history[0]["id"] == recall_id
        assert set(history[0]["affected_batches"]) == {"PAN-201", "PAN-202"}

        # 4. Export FSSAI recall dossier in JSON and printable HTML formats
        fssai_json = c.get(f"/api/recall/{recall_id}/export-fssai")
        assert fssai_json.status_code == 200
        dossier_payload = fssai_json.json()
        assert dossier_payload["ref_number"].startswith("FSSAI/FOSCOS/REC/")
        assert "printable_html" in dossier_payload
        assert "FSSAI Statutory Food Recall Notice" in dossier_payload["printable_html"]

        fssai_html = c.get(f"/api/recall/{recall_id}/export-fssai?format=html")
        assert fssai_html.status_code == 200
        assert "text/html" in fssai_html.headers["content-type"]
        assert "Retailer A (Kothrud)" in fssai_html.text

        # 5. 404 on nonexistent recall export
        assert c.get("/api/recall/9999/export-fssai").status_code == 404

    if client is not None:
        _run(client)
    else:
        with isolated_test_client() as (c, _):
            _run(c)


def test_public_consumer_passport_privacy_and_recall_alert(client=None):
    """Tests GET /api/public/passport/{batch_id} before and after recall execution."""
    def _run(c):
        c.post("/api/seed/tech4food")

        # 1. Inspect PAN-201 consumer passport while ACTIVE
        pass_res = c.get("/api/public/passport/PAN-201")
        assert pass_res.status_code == 200
        passport = pass_res.json()
        assert passport["batch_id"] == "PAN-201"
        # An open upstream positive complaint must remain visible through batch lineage.
        assert passport["is_safe"] is False
        assert passport["fssai_compliant"] is False
        assert passport["adulterant_status"] == "POSITIVE"
        assert passport["verification_badge"].startswith("CONTAMINATION ALERT")
        assert len(passport["raw_milk_origin_breakdown"]) == 2

        # Verify origin percentages sum to 100% (60% Shirur + 40% Junnar)
        pcts = sorted(item["contribution_percentage"] for item in passport["raw_milk_origin_breakdown"])
        assert pcts == [40.0, 60.0]

        # Ensure internal retail contact phone numbers are never leaked in the public passport
        raw_text = pass_res.text
        assert "+91-9822011101" not in raw_text
        assert "+91-9822011102" not in raw_text

        # 2. Execute recall on MILK-101 and verify PAN-201 public passport immediately shows recall warning
        c.post(
            "/api/recall/execute",
            json={
                "batch_id": "MILK-101",
                "reason": "Aflatoxin M1 contamination",
                "severity": "CRITICAL",
                "initiated_by": "QA Lead",
            },
        )
        recalled_pass = c.get("/api/public/passport/PAN-201").json()
        assert recalled_pass["status"] == "RECALLED"
        assert recalled_pass["is_safe"] is False
        assert recalled_pass["fssai_compliant"] is False
        assert "DO NOT CONSUME" in recalled_pass["verification_badge"]
        assert recalled_pass["adulterant_screen"] == "ALERT: FAILED"
        assert "Aflatoxin M1 contamination" in recalled_pass["contaminant_warning"]

        # Quarantined co-input batch MILK-102 displays UNDER QA HOLD
        quarantined_pass = c.get("/api/public/passport/MILK-102").json()
        assert quarantined_pass["status"] == "QUARANTINED"
        assert quarantined_pass["adulterant_screen"] == "UNDER QA HOLD"

        # Safe control batch PAN-303 still displays compliant badge
        safe_pass = c.get("/api/public/passport/PAN-303").json()
        assert safe_pass["status"] == "ACTIVE"
        assert safe_pass["is_safe"] is True
        assert safe_pass["verification_badge"] == "Quality Screen Passed"
        assert safe_pass["id"] == "PAN-303"
        assert safe_pass["purity_score"] == 99.4
        assert safe_pass["adulterant_screen"] == "PASSED"
        assert len(safe_pass["origins"]) == 1
        assert safe_pass["origins"][0]["percentage"] == 100.0

        # Verify lineage endpoint includes allLinks, allDistributions, parents, and children for React App.jsx
        lin_res = c.get("/api/batches/MILK-101/lineage").json()
        assert len(lin_res["allLinks"]) == 4
        assert len(lin_res["allDistributions"]) == 3
        assert len(lin_res["children"]) == 2

        # Verify ALL filter on /api/batches returns all 6 batches
        all_filter_res = c.get("/api/batches?product_type=ALL&status=ALL").json()
        assert len(all_filter_res) == 6

        # Verify 2-hop upstream raw milk origin resolution (MILK-101 + MILK-102 -> PAN-201 -> PAN-REPACK-401)
        c.post(
            "/api/batches",
            json={
                "id": "PAN-REPACK-401",
                "product_type": "PANEER",
                "initial_quantity": 60.0,
                "facility_name": "Pune Cold-Chain Repack Hub",
            },
        )
        c.post(
            "/api/batches/link",
            json={
                "parent_batch_id": "PAN-201",
                "child_batch_id": "PAN-REPACK-401",
                "quantity_used": 60.0,
                "unit": "KG",
            },
        )
        repack_pass = c.get("/api/public/passport/PAN-REPACK-401").json()
        repack_pcts = sorted(item["contribution_percentage"] for item in repack_pass["raw_milk_origin_breakdown"])
        assert repack_pcts == [40.0, 60.0]

    if client is not None:
        _run(client)
    else:
        with isolated_test_client() as (c, _):
            _run(c)


class TestDairyTraceAPISuite(unittest.TestCase):
    """Unittest wrapper so `python -m unittest` runs all REST API tests alongside `pytest`."""

    def test_1_seed_and_batches(self):
        test_seed_and_batches_endpoints()

    def test_2_lineage_link_and_qr(self):
        test_lineage_link_and_qr_endpoints()

    def test_3_quality_and_distribution(self):
        test_quality_and_distribution_endpoints()

    def test_4_smart_recall_and_fssai_export(self):
        test_smart_recall_simulate_execute_history_and_fssai_export()

    def test_5_public_consumer_passport(self):
        test_public_consumer_passport_privacy_and_recall_alert()


if __name__ == "__main__":
    unittest.main()
