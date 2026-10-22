"""Comprehensive automated tests for 3-mode Complaint Raising, AI Copilot, and Forensic Report Upload."""

import json


def test_natural_language_copilot_extraction_and_conversational_patch(client):
    """Tests Mode 2: Natural language complaint extraction and multi-turn conversational patching."""
    client.post("/api/seed/tech4food")

    # Turn 1: Partial natural language complaint
    res1 = client.post(
        "/api/copilot/process",
        json={
            "message": (
                "I am Dr. Ananya Deshmukh from Shirur Collection Centre. We tested raw milk batch MILK-101 "
                "and found elevated Aflatoxin M1 at 0.78 ug/kg with Fat 4.1%, SNF 8.2%, and Acidity 0.21%."
            ),
            "current_form": {},
        },
    )
    assert res1.status_code == 200, res1.text
    data1 = res1.json()
    patch1 = data1["patch"]
    assert patch1["batch_id"] == "MILK-101"
    assert patch1["reporter_name"] == "Dr. Ananya Deshmukh"
    assert patch1["facility_or_store"] == "Shirur Collection Centre"
    assert patch1["fat_percentage"] == 4.1
    assert patch1["snf_percentage"] == 8.2
    assert patch1["acidity_percentage"] == 0.21
    assert patch1["adulterant_status"] == "POSITIVE"
    assert patch1["severity"] == "CRITICAL"
    assert "Aflatoxin" in patch1["adulterant_findings"]
    assert data1["completeness"]["is_complete"] is True
    assert data1["safety_evaluation"]["requires_recall_preview"] is True

    # Turn 2: Conversational update on top of merged_form
    res2 = client.post(
        "/api/complaints/parse-text",
        json={
            "message": "Change severity to MAJOR and set store to Retailer B (Wakad)",
            "current_form": data1["merged_form"],
        },
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["merged_form"]["batch_id"] == "MILK-101"
    assert data2["merged_form"]["fat_percentage"] == 4.1
    assert data2["merged_form"]["severity"] == "MAJOR"
    assert data2["merged_form"]["facility_or_store"] == "Retailer B (Wakad)"


def test_natural_language_preserves_decimals_and_handles_negative_hazard_results(client):
    client.post("/api/seed/tech4food")
    positive = client.post(
        "/api/copilot/process",
        json={
            "message": (
                "Retailer QA at Pune Demo Store reports a positive Aflatoxin M1 result of "
                "0.78 ug/kg for milk batch MILK-101. Reported by Demo NLP Tester."
            ),
            "current_form": {},
        },
    )
    assert positive.status_code == 200, positive.text
    positive_form = positive.json()["merged_form"]
    assert "0.78" in positive_form["adulterant_findings"]
    assert positive_form["reporter_name"] == "Demo NLP Tester"
    assert positive_form["facility_or_store"] == "Pune Demo Store"
    assert positive_form["adulterant_status"] == "POSITIVE"

    negative = client.post(
        "/api/copilot/process",
        json={
            "message": (
                "Milk batch MILK-101 tested negative. No Aflatoxin M1 was detected. "
                "Reported by Demo QA Tester at Pune Demo Store."
            ),
            "current_form": {},
        },
    )
    assert negative.status_code == 200, negative.text
    negative_form = negative.json()["merged_form"]
    assert negative_form["adulterant_status"] == "NEGATIVE"
    assert negative_form.get("severity") != "CRITICAL"


def test_public_passport_does_not_claim_safety_without_a_negative_screen(client):
    new_batch = client.post(
        "/api/batches",
        json={
            "id": "MILK-NOT-TESTED",
            "product_type": "MILK",
            "initial_quantity": 100,
            "facility_name": "Demo Farm",
        },
    )
    assert new_batch.status_code == 201, new_batch.text
    initial = client.get("/api/public/passport/MILK-NOT-TESTED").json()
    assert initial["adulterant_status"] == "NOT_TESTED"
    assert initial["is_safe"] is False
    assert initial["purity_score"] is None
    assert initial["adulterant_screen"] == "NOT TESTED"

    complaint = client.post(
        "/api/complaints",
        json={
            "batch_id": "MILK-NOT-TESTED",
            "reporter_name": "Demo Inspector",
            "facility_or_store": "Demo Farm",
            "complaint_category": "Possible contamination",
            "severity": "PRECAUTIONARY",
            "fat_percentage": 4.0,
            "snf_percentage": 8.0,
            "acidity_percentage": 0.2,
            "adulterant_status": "SUSPECTED",
            "adulterant_findings": "Unusual odor; lab verification pending",
            "description": "Product has an unusual odor; please hold pending testing.",
            "intake_mode": "MANUAL",
            "record_quality_check": True,
        },
    )
    assert complaint.status_code == 201, complaint.text
    flagged = client.get("/api/public/passport/MILK-NOT-TESTED").json()
    assert flagged["adulterant_status"] == "SUSPECTED"
    assert flagged["is_safe"] is False
    assert "review" in flagged["verification_badge"].lower()


def test_sample_reports_download_and_upload_parsing_all_formats(client):
    """Tests Mode 3: Downloading sample PDF, DOCX, TXT, JSON forensic reports and uploading them for auto-fill."""
    catalog_res = client.get("/api/complaints/sample-reports")
    assert catalog_res.status_code == 200
    catalog = catalog_res.json()
    assert len(catalog) == 4

    # 1. PDF Sample Report Download + Upload
    pdf_dl = client.get("/api/complaints/sample-reports/pdf-aflatoxin-milk101/download")
    assert pdf_dl.status_code == 200
    assert pdf_dl.headers["content-type"] == "application/pdf"
    assert pdf_dl.content.startswith(b"%PDF")

    pdf_up = client.post(
        "/api/copilot/upload",
        files={"file": ("NABL_Forensic_Report_MILK-101_Aflatoxin.pdf", pdf_dl.content, "application/pdf")},
        data={"current_form": "{}"},
    )
    assert pdf_up.status_code == 200, pdf_up.text
    pdf_parsed = pdf_up.json()["merged_form"]
    assert pdf_parsed["batch_id"] == "MILK-101"
    assert pdf_parsed["fat_percentage"] == 4.1
    assert pdf_parsed["snf_percentage"] == 8.2
    assert pdf_parsed["acidity_percentage"] == 0.21
    assert pdf_parsed["adulterant_status"] == "POSITIVE"
    assert pdf_parsed["severity"] == "CRITICAL"
    assert "0.50 ug/kg" in pdf_parsed["adulterant_findings"]
    assert "Trace sodium bicarbonate neutralizer present" in pdf_parsed["adulterant_findings"]
    assert "downstream paneer batches PAN-201 and PAN-202" in pdf_parsed["description"]

    # 2. DOCX Sample Report Download + Upload
    docx_dl = client.get("/api/complaints/sample-reports/docx-urea-pan201/download")
    assert docx_dl.status_code == 200
    assert docx_dl.content.startswith(b"PK")

    docx_up = client.post(
        "/api/complaints/parse-report",
        files={
            "file": (
                "Retailer_Quality_Check_PAN-201_Urea_Report.docx",
                docx_dl.content,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )
    assert docx_up.status_code == 200, docx_up.text
    docx_parsed = docx_up.json()["merged_form"]
    assert docx_parsed["batch_id"] == "PAN-201"
    assert docx_parsed["fat_percentage"] == 19.8
    assert docx_parsed["snf_percentage"] == 24.5
    assert docx_parsed["acidity_percentage"] == 0.29
    assert docx_parsed["adulterant_status"] == "POSITIVE"
    assert docx_parsed["severity"] == "CRITICAL"
    assert "Rajesh Kulkarni" in docx_parsed["reporter_name"]

    # 3. TXT Sample Report Download + Upload
    txt_dl = client.get("/api/complaints/sample-reports/txt-coldchain-pan202/download")
    assert txt_dl.status_code == 200
    txt_up = client.post(
        "/api/copilot/upload",
        files={"file": ("ColdChain_Field_Audit_PAN-202.txt", txt_dl.content, "text/plain")},
    )
    assert txt_up.status_code == 200
    txt_parsed = txt_up.json()["merged_form"]
    assert txt_parsed["batch_id"] == "PAN-202"
    assert txt_parsed["fat_percentage"] == 23.4
    assert txt_parsed["snf_percentage"] == 27.1
    assert txt_parsed["acidity_percentage"] == 0.25
    assert txt_parsed["severity"] == "MAJOR"

    # 4. JSON Sample Report Download + Upload
    json_dl = client.get("/api/complaints/sample-reports/json-analyzer-milk102/download")
    assert json_dl.status_code == 200
    json_up = client.post(
        "/api/copilot/upload",
        files={"file": ("Automated_LactoScan_Export_MILK-102.json", json_dl.content, "application/json")},
    )
    assert json_up.status_code == 200
    json_parsed = json_up.json()["merged_form"]
    assert json_parsed["batch_id"] == "MILK-102"
    assert json_parsed["fat_percentage"] == 4.3
    assert json_parsed["snf_percentage"] == 8.4
    assert json_parsed["acidity_percentage"] == 0.17
    assert json_parsed["severity"] == "PRECAUTIONARY"

    # 5. EML Email Report Upload
    eml_bytes = (
        b"From: Meera Joshi <meera@example.com>\r\n"
        b"Subject: Sour Paneer Complaint for Batch PAN-202 at Hinjawadi\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n\r\n"
        b"Batch ID: PAN-202\r\n"
        b"Store: Retailer C (Hinjawadi)\r\n"
        b"Fat: 22.0%\r\n"
        b"SNF: 26.5%\r\n"
        b"Acidity: 0.27%\r\n"
        b"The paneer pack had a sour odor and curdled texture."
    )
    eml_up = client.post(
        "/api/copilot/upload",
        files={"file": ("customer_complaint.eml", eml_bytes, "message/rfc822")},
    )
    assert eml_up.status_code == 200
    assert eml_up.json()["merged_form"]["batch_id"] == "PAN-202"
    assert eml_up.json()["merged_form"]["acidity_percentage"] == 0.27


def test_manual_complaint_persistence_ledger_and_recall_integration(client):
    """Tests Mode 1: Persisting complaints to the ledger, attaching QualityRecord, and linking to Smart Recall."""
    client.post("/api/seed/tech4food")

    # Initial seeded complaints in ledger
    initial_list = client.get("/api/complaints").json()
    assert len(initial_list) == 2

    # Create a new complaint on MILK-101 with forensic metrics
    create_res = client.post(
        "/api/complaints",
        json={
            "batch_id": "milk-101",
            "product_name": "FoodSync Farm-Chilled Raw Milk",
            "reporter_name": "Saloni Gupta",
            "reporter_role": "QA Lead",
            "facility_or_store": "Shirur Collection Centre",
            "complaint_category": "Chemical / Mycotoxin Contaminant",
            "severity": "CRITICAL",
            "fat_percentage": 4.0,
            "snf_percentage": 8.1,
            "acidity_percentage": 0.22,
            "adulterant_status": "POSITIVE",
            "adulterant_findings": "Confirmed Aflatoxin M1 at 0.82 ug/kg",
            "description": "Confirmatory lab assay detected Aflatoxin M1 above FSSAI safe limit.",
            "intake_mode": "MANUAL",
            "record_quality_check": True,
        },
    )
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()
    assert created["batch_id"] == "MILK-101"
    assert created["complaint_ref"].startswith("CMP-2026-")
    assert created["safety_alert_recommended"] is True
    assert created["batch_exists"] is True
    assert created["status"] == "OPEN"

    # Verify QualityRecord was also attached to MILK-101
    q_records = client.get("/api/quality/MILK-101").json()
    submitted_quality = next(r for r in q_records if "Confirmed Aflatoxin M1 at 0.82 ug/kg" in (r.get("contaminant_details") or ""))
    assert submitted_quality["trust_level"] == "SUPPLIER_ENTERED"

    # Filter ledger by batch_id and severity
    milk101_complaints = client.get("/api/complaints?batch_id=MILK-101&severity=CRITICAL").json()
    assert len(milk101_complaints) >= 2

    # Execute Smart Recall on MILK-101 -> verify complaints on MILK-101 and PAN-201 transition to RECALL_TRIGGERED
    exec_res = client.post(
        "/api/recall/execute",
        json={
            "batch_id": "MILK-101",
            "reason": created["adulterant_findings"],
            "severity": "CRITICAL",
            "initiated_by": created["reporter_name"],
        },
    )
    assert exec_res.status_code == 200

    updated_comp = client.get(f"/api/complaints/{created['id']}").json()
    assert updated_comp["status"] == "RECALL_TRIGGERED"

    # Manual status patch
    patch_res = client.patch(
        f"/api/complaints/{created['id']}/status",
        json={"status": "RESOLVED"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "RESOLVED"


def test_complaint_upload_and_validation_edge_cases(client):
    """Tests edge cases: empty files, unsupported binary files, invalid JSON, and missing fields."""
    # Empty file upload -> 400
    empty_res = client.post(
        "/api/copilot/upload",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert empty_res.status_code == 400

    # Unsupported binary file -> 415
    exe_res = client.post(
        "/api/copilot/upload",
        files={"file": ("malware.exe", b"MZ\x90\x00\x03", "application/octet-stream")},
    )
    assert exe_res.status_code == 415

    # Invalid JSON file -> 400
    bad_json = client.post(
        "/api/copilot/upload",
        files={"file": ("broken.json", b"{not valid json", "application/json")},
    )
    assert bad_json.status_code == 400

    # Unknown sample report -> 404
    assert client.get("/api/complaints/sample-reports/does-not-exist/download").status_code == 404

    # Incomplete natural language input reports missing fields
    inc_res = client.post(
        "/api/copilot/process",
        json={"message": "The milk fat is 4.2%", "current_form": {}},
    )
    assert inc_res.status_code == 200
    comp = inc_res.json()["completeness"]
    assert comp["is_complete"] is False
    assert "Batch ID" in comp["missing_fields"]
