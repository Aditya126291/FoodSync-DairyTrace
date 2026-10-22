"""Tests for Random Batch Initiation, Designated QR Allotment, and 3-Mode Safety Concern Intake."""

import io
from tests.conftest import isolated_test_client


def test_random_batch_initiation_and_qr_designation():
    """Verify that randomly initiated batches automatically receive a designated QR code and passport."""
    with isolated_test_client() as (client, _):
        client.post("/api/seed/tech4food")

        # 1. Randomly initiate a batch with zero arguments
        res = client.post("/api/batches/random")
        assert res.status_code == 201
        data = res.json()

        assert data["id"].startswith("MILK-") or data["id"].startswith("PAN-")
        assert data["status"] == "ACTIVE"
        assert data["qr_code_url"] == f"/api/batches/{data['id']}/qr"
        assert data["passport_url"].endswith(f"/passport/{data['id']}")
        assert data["qr_code_base64"].startswith("data:image/png;base64,")
        assert "<svg" in data["qr_code_svg"]

        batch_id = data["id"]

        # 2. Randomly initiate a specific product type (MILK and PANEER)
        milk_res = client.post("/api/batches/random?product_type=MILK")
        assert milk_res.status_code == 201
        milk_data = milk_res.json()
        assert milk_data["id"].startswith("MILK-")
        assert milk_data["product_type"] == "MILK"
        assert milk_data["qr_code_url"] == f"/api/batches/{milk_data['id']}/qr"

        pan_res = client.post("/api/batches/random?product_type=PANEER")
        assert pan_res.status_code == 201
        pan_data = pan_res.json()
        assert pan_data["id"].startswith("PAN-")
        assert pan_data["product_type"] == "PANEER"
        assert pan_data["qr_code_url"] == f"/api/batches/{pan_data['id']}/qr"

        # 3. Create batch via standard POST /api/batches with omitted / random ID
        custom_res = client.post(
            "/api/batches",
            json={
                "product_type": "MILK",
                "initial_quantity": 620.0,
                "facility_name": "Manchar Dairy Hub",
            },
        )
        assert custom_res.status_code == 201
        custom_data = custom_res.json()
        assert custom_data["id"].startswith("MILK-")
        assert custom_data["qr_code_url"] == f"/api/batches/{custom_data['id']}/qr"
        assert custom_data["passport_url"].endswith(f"/passport/{custom_data['id']}")

        # 4. Fetch the designated QR code formats (PNG, SVG, JSON)
        qr_png = client.get(f"/api/batches/{batch_id}/qr?format=png")
        assert qr_png.status_code == 200
        assert qr_png.headers["content-type"] == "image/png"
        assert qr_png.content.startswith(b"\x89PNG")

        qr_svg = client.get(f"/api/batches/{batch_id}/qr?format=svg")
        assert qr_svg.status_code == 200
        assert "image/svg+xml" in qr_svg.headers["content-type"]
        assert "<svg" in qr_svg.text

        qr_json = client.get(f"/api/batches/{batch_id}/qr?format=json")
        assert qr_json.status_code == 200
        assert qr_json.json()["batch_id"] == batch_id

        # 5. Public consumer passport returns complete batch details
        passport_res = client.get(f"/api/public/passport/{batch_id}")
        assert passport_res.status_code == 200
        passport = passport_res.json()
        assert passport["batch_id"] == batch_id
        assert passport["is_safe"] is True
        assert passport["fssai_licence_number"] == "11526034000981"
        assert len(passport["origins"]) >= 1


def test_three_tier_safety_concern_intake_for_scanned_batch():
    """Verify that a consumer can submit safety concerns across all 3 intake modes for any scanned batch."""
    with isolated_test_client() as (client, _):
        # 1. Randomly initiate a batch
        res = client.post("/api/batches/random?product_type=PANEER")
        assert res.status_code == 201
        batch_id = res.json()["id"]

        # -------------------------------------------------------------
        # Mode 1: Natural Language / Voice Transcript Intake
        # -------------------------------------------------------------
        nl_message = (
            f"Consumer Vikram Mehta from Kothrud Store observed sour odor and whey separation "
            f"in paneer batch {batch_id}. Lab acidity was 0.28%, fat 22.0%, SNF 26.5%. "
            f"Suspected bacterial spoilage, severity Major."
        )
        nl_parse_res = client.post(
            "/api/copilot/process",
            json={"message": nl_message, "current_form": {"batch_id": batch_id}},
        )
        assert nl_parse_res.status_code == 200
        nl_parsed = nl_parse_res.json()
        assert nl_parsed["patch"]["batch_id"] == batch_id
        assert nl_parsed["patch"]["acidity_percentage"] == 0.28
        assert nl_parsed["patch"]["severity"] in ("MAJOR", "CRITICAL")

        # Submit Mode 1 complaint
        c1_res = client.post(
            "/api/complaints",
            json={
                "batch_id": batch_id,
                "reporter_name": "Vikram Mehta",
                "reporter_role": "Consumer",
                "facility_or_store": "Kothrud Store",
                "complaint_category": "Microbial / Spoilage / Sourness",
                "severity": "MAJOR",
                "fat_percentage": 22.0,
                "snf_percentage": 26.5,
                "acidity_percentage": 0.28,
                "adulterant_status": "SUSPECTED",
                "adulterant_findings": "High titratable acidity (0.28%) with sour smell",
                "description": nl_message,
                "intake_mode": "NATURAL_LANGUAGE",
            },
        )
        assert c1_res.status_code == 201
        c1_data = c1_res.json()
        assert c1_data["complaint_ref"].startswith("CMP-2026-")
        assert c1_data["batch_id"] == batch_id
        assert c1_data["intake_mode"] == "NATURAL_LANGUAGE"

        # -------------------------------------------------------------
        # Mode 2: Lab / Forensic Report Upload Intake
        # -------------------------------------------------------------
        report_content = (
            f"NABL ACCREDITED LABORATORY CERTIFICATE OF ANALYSIS\n"
            f"Batch ID: {batch_id}\n"
            f"Product: Fresh Paneer\n"
            f"Tested by: Dr. S. Kulkarni (Quality Chemist)\n"
            f"Location: Pune QA Central Lab\n"
            f"Milk Fat: 21.5%\n"
            f"Milk Solids SNF: 25.0%\n"
            f"Acidity: 0.31%\n"
            f"Adulterant Test: POSITIVE\n"
            f"Findings: Positive urea and alkaline neutralizer reaction\n"
            f"Severity: CRITICAL\n"
            f"Summary: Chemical adulterant positive in batch {batch_id}.\n"
        ).encode("utf-8")

        upload_res = client.post(
            "/api/copilot/upload",
            files={"file": ("lab_report.txt", io.BytesIO(report_content), "text/plain")},
            data={"current_form": f'{{"batch_id": "{batch_id}"}}'},
        )
        assert upload_res.status_code == 200
        upload_parsed = upload_res.json()
        assert upload_parsed["patch"]["batch_id"] == batch_id
        assert upload_parsed["patch"]["adulterant_status"] == "POSITIVE"

        # Submit Mode 2 complaint
        c2_res = client.post(
            "/api/complaints",
            json={
                "batch_id": batch_id,
                "reporter_name": "Dr. S. Kulkarni",
                "reporter_role": "Quality Chemist",
                "facility_or_store": "Pune QA Central Lab",
                "complaint_category": "Forensic / Adulteration Alert",
                "severity": "CRITICAL",
                "fat_percentage": 21.5,
                "snf_percentage": 25.0,
                "acidity_percentage": 0.31,
                "adulterant_status": "POSITIVE",
                "adulterant_findings": "Positive urea and alkaline neutralizer reaction",
                "description": "Lab report upload detected chemical adulterant.",
                "intake_mode": "REPORT_UPLOAD",
                "source_report_name": "lab_report.txt",
            },
        )
        assert c2_res.status_code == 201
        c2_data = c2_res.json()
        assert c2_data["intake_mode"] == "REPORT_UPLOAD"

        # -------------------------------------------------------------
        # Mode 3: Manual Entry Intake
        # -------------------------------------------------------------
        c3_res = client.post(
            "/api/complaints",
            json={
                "batch_id": batch_id,
                "reporter_name": "Rohan Deshmukh",
                "reporter_role": "Retail Store Partner",
                "facility_or_store": "Aundh Retail Hub",
                "complaint_category": "Packaging / Tamper Seal Issue",
                "severity": "PRECAUTIONARY",
                "adulterant_status": "NOT_TESTED",
                "description": "Broken seal on 3 packs received this morning in batch delivery.",
                "intake_mode": "MANUAL",
            },
        )
        assert c3_res.status_code == 201
        c3_data = c3_res.json()
        assert c3_data["intake_mode"] == "MANUAL"

        # -------------------------------------------------------------
        # Verify all 3 complaints are recorded in ledger for this batch
        # -------------------------------------------------------------
        ledger_res = client.get(f"/api/complaints?batch_id={batch_id}")
        assert ledger_res.status_code == 200
        complaints = ledger_res.json()
        assert len(complaints) == 3
        modes = {c["intake_mode"] for c in complaints}
        assert modes == {"NATURAL_LANGUAGE", "REPORT_UPLOAD", "MANUAL"}

        # Verify that the public consumer passport now flags the contamination alert
        passport_after = client.get(f"/api/public/passport/{batch_id}").json()
        assert passport_after["is_safe"] is False
        assert passport_after["adulterant_status"] == "POSITIVE"
        assert "CONTAMINATION ALERT" in passport_after["verification_badge"]
