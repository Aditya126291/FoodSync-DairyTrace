"""Batch creation (with QR designation) and public passport smoke tests."""

from tests.conftest import isolated_test_client


def test_batch_creation_designates_qr_and_passport_is_public():
    with isolated_test_client(role="QA_OFFICER") as (c, _):
        res = c.post("/api/batches", json={"product_type": "MILK", "initial_quantity": 620.0, "facility_name": "Manchar Dairy Hub"})
        assert res.status_code == 201
        data = res.json()
        batch_id = data["id"]
        assert batch_id.startswith("MILK-")
        assert data["qr_code_url"] == f"/api/batches/{batch_id}/qr"
        assert data["passport_url"].endswith(f"/passport/{batch_id}")

    with isolated_test_client(role=None) as (c, _):
        c.reseed()
        png = c.get("/api/batches/PAN-201/qr?format=png")
        assert png.status_code == 200 and png.content.startswith(b"\x89PNG")
        svg = c.get("/api/batches/PAN-201/qr?format=svg")
        assert svg.status_code == 200 and "<svg" in svg.text
        assert c.get("/api/batches/PAN-201/qr?format=json").json()["batch_id"] == "PAN-201"
        passport = c.get("/api/public/passport/PAN-303").json()
        assert passport["batch_id"] == "PAN-303"
