"""Complaint workspace tests (AI copilot intake, commit rules, ledger permissions)."""

import io

import pytest
from docx import Document

from app.complaints import agent
from app.complaints.extract import extract_patch
from tests.conftest import isolated_test_client

TEXT = (
    "Retailer A (Kothrud) reported a sour smell and excess whey in 6 packs of paneer batch PAN-201. "
    "Rajesh Kulkarni noticed it on the morning shelf check."
)


@pytest.fixture(autouse=True)
def _rule_based_mode(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)


def _form(**kw):
    base = {"customerName": "Asha Rao", "complaintType": "Spoilage / sourness", "defectSummary": "Paneer smelled sour",
            "detailedDescription": "Opened pack was sour and watery.", "severity": "High", "priority": "High"}
    return {**base, **kw}


def _commit(c, batch="PAN-201", **form_kw):
    return c.post("/api/complaints/commit", json={"batchId": batch, "form": _form(**form_kw)})


def _minimal_pdf(text: str) -> bytes:
    stream = f"BT /F1 12 Tf 50 750 Td ({text}) Tj ET".encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    return out + f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()


# ------------------------------------------------------------------ extraction
def test_regex_extractor_reads_dairy_complaint_text():
    patch = extract_patch(TEXT)
    assert patch["affectedQuantity"].lower() == "6 packs"
    assert patch["complaintType"] == "Spoilage / sourness"
    assert patch["severity"] == "High" and patch["priority"] == "High"
    assert "Retailer" in patch["customerName"] or "Kulkarni" in patch["customerName"]


def test_critical_keywords_escalate_severity():
    patch = extract_patch("My child vomited after drinking milk from batch MILK-101, we went to hospital.")
    assert patch["severity"] == "Critical" and patch["priority"] == "Urgent"
    assert patch["complaintType"] == "Illness reported"


def test_targeted_edit_returns_only_the_changed_field():
    patch = extract_patch("change the severity to Low", is_update=True)
    assert patch == {"severity": "Low"}


def test_llm_failure_falls_back_to_rule_based(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "dummy")
    import sys, types

    fake = types.ModuleType("langchain_groq")

    class Boom:
        def __init__(self, *a, **k): raise RuntimeError("network down")

    fake.ChatGroq = Boom
    monkeypatch.setitem(sys.modules, "langchain_groq", fake)
    result = agent.run_intake(TEXT, {})
    assert result["engine"] == "rule-based" and result["patch"]["complaintType"] == "Spoilage / sourness"


# ------------------------------------------------------------------ copilot endpoints
def test_context_locks_batch_fields_and_unknown_batch_404():
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        ctx = c.get("/api/complaints/context/pan-201").json()
        assert ctx["locked"]["batchLotNumber"] == "PAN-201" and ctx["locked"]["productName"] == "Fresh Malai Paneer"
        assert "Fat" in ctx["defaults"]["strengthGrade"] and "SNF" in ctx["defaults"]["strengthGrade"]
        assert c.get("/api/complaints/context/NOPE-1").status_code == 404


def test_process_cannot_override_locked_batch_fields():
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        res = c.post("/api/copilot/process", json={"text": TEXT + " Batch: MILK-999. Product: Fake Cheese.", "batchId": "PAN-201", "current_form": {}})
        assert res.status_code == 200
        patch = res.json()["patch"]
        assert not ({"batchLotNumber", "productName", "manufacturingDate", "expiryDate", "originatingSite"} & set(patch))
        assert res.json()["rootCause"] and len(res.json()["capaRecommendations"]) == 3
        assert c.post("/api/copilot/process", json={"text": "x", "batchId": "NOPE", "current_form": {}}).status_code == 404


def test_upload_txt_eml_docx_pdf_and_rejections():
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        body = "Complaint Type: Packaging / tamper\nAffected Quantity: 12 packs\nDefect Summary: Pouches arrived leaking at the store"

        def up(name, data, mime="application/octet-stream", current_form="{}"):
            return c.post("/api/copilot/upload", data={"batchId": "PAN-201", "current_form": current_form}, files={"file": (name, data, mime)})

        txt_res = up("a.txt", body.encode(), current_form='{"customerName": "Asha Rao", "complaintSource": "Consumer"}').json()
        assert txt_res["patch"]["affectedQuantity"] == "12 packs"
        assert "Reporter name" not in txt_res["missingFields"]
        eml = f"From: a@b.c\nTo: q@d.t\nSubject: complaint\nContent-Type: text/plain\n\n{body}\n".encode()
        assert up("a.eml", eml).status_code == 200
        buf = io.BytesIO(); d = Document()
        for line in body.split("\n"): d.add_paragraph(line)
        d.save(buf)
        assert up("a.docx", buf.getvalue()).json()["patch"]["complaintType"] == "Packaging / tamper"
        assert up("a.pdf", _minimal_pdf("Defect Summary: Pouches arrived leaking")).status_code == 200
        assert up("a.exe", b"MZ").status_code == 415
        assert up("big.txt", b"a" * (10 * 1024 * 1024 + 5)).status_code == 413
        assert up("empty.txt", b"   ").status_code == 422


def test_public_ai_endpoints_are_rate_limited():
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        codes = [c.post("/api/copilot/process", json={"text": "sour", "batchId": "PAN-201", "current_form": {}}).status_code for _ in range(22)]
        assert codes[:20] == [200] * 20 and codes[20] == 429


# ------------------------------------------------------------------ commit rules
def test_commit_enforces_locked_fields_numbering_and_requires_description():
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        res = _commit(c, productName="Hacked", batchLotNumber="X", expiryDate="never")
        assert res.status_code == 201
        rec = res.json()
        assert rec["batchLotNumber"] == "PAN-201" and rec["productName"] == "Fresh Malai Paneer" and rec["expiryDate"] != "never"
        assert rec["complaintNumber"].startswith("CC-") and rec["status"] == "Committed"
        assert _commit(c, batch="NOPE-1").status_code == 404
        empty = c.post("/api/complaints/commit", json={"batchId": "PAN-201", "form": {}})
        assert empty.status_code == 422


def test_duplicate_rule_blocks_same_reporter_but_accepts_different_people():
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        assert _commit(c).status_code == 201
        assert _commit(c).status_code == 409  # same batch + reporter + type within 24h
        other = _commit(c, customerName="Ben Joseph")
        assert other.status_code == 201 and other.json()["otherReports"] >= 1


def test_three_independent_reporters_auto_flag_batch_for_review():
    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        c.post("/api/seed/ignored")  # no-op safety
        flagged = None
        for name in ("P One", "P Two", "P Three"):
            flagged = _commit(c, batch="PAN-303", customerName=name).json()
        assert flagged["autoFlagged"] is True
    with isolated_test_client(role="QA_OFFICER") as (c, _):
        c.reseed()
        for name in ("P One", "P Two", "P Three"):
            _commit(c, batch="PAN-303", customerName=name)
        statuses = {r["status"] for r in c.get("/api/complaints?batch_id=PAN-303").json()}
        assert statuses == {"Under review"}


def test_complaint_numbers_stay_unique_after_deletes():
    with isolated_test_client(role="QA_OFFICER") as (c, _):
        c.reseed()
        a = _commit(c, customerName="A A").json()
        c.delete(f"/api/complaints/{a['id']}")
        b = _commit(c, customerName="B B").json()
        d = _commit(c, customerName="D D").json()
        assert len({a["complaintNumber"], b["complaintNumber"], d["complaintNumber"]}) == 3


# ------------------------------------------------------------------ ledger permissions
def test_ledger_edit_status_and_delete_permissions():
    with isolated_test_client(role="INSPECTOR") as (c, _):
        c.reseed()
        rec = _commit(c).json()
        assert rec["customerName"] == "Asha Rao"
        listed = c.get("/api/complaints").json()
        assert any(r["complaintNumber"] == rec["complaintNumber"] for r in listed)
        upd = c.put(f"/api/complaints/{rec['id']}", json={"batchId": "PAN-201", "form": _form(severity="Critical")})
        assert upd.status_code == 200 and upd.json()["severity"] == "Critical"
        assert c.patch(f"/api/complaints/{rec['id']}/status", json={"status": "Under review"}).json()["status"] == "Under review"
        assert c.patch(f"/api/complaints/{rec['id']}/status", json={"status": "bogus"}).status_code == 422
        assert c.delete(f"/api/complaints/{rec['id']}").status_code == 403
        qa = c.login_headers("QA_OFFICER")
        assert c.delete(f"/api/complaints/{rec['id']}", headers=qa).status_code == 200


def test_executing_recall_marks_open_complaints_and_passport_reflects_open_complaints():
    with isolated_test_client(role="QA_OFFICER") as (c, _):
        c.reseed()
        assert c.post("/api/recall/execute", json={"batch_id": "MILK-101", "reason": "Aflatoxin"}).status_code == 200
        statuses = {r["batchId"]: r["status"] for r in c.get("/api/complaints").json()}
        assert statuses["MILK-101"] == "Recall triggered" and statuses["PAN-201"] == "Recall triggered"
