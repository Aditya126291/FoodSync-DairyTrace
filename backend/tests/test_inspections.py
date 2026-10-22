import asyncio
import io
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from PIL import Image
from starlette.datastructures import UploadFile

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.routers import batches as batch_router  # noqa: E402
from app.routers import inspections as inspection_router  # noqa: E402
from app.schemas import BatchCreate  # noqa: E402
from types import SimpleNamespace  # noqa: E402

from tests.conftest import isolated_db_session  # noqa: E402

INSPECTOR_USER = SimpleNamespace(id=None, full_name="A. Inspector", role="INSPECTOR")


def _png_upload(name="seal.png"):
    image = Image.new("RGB", (2, 2), color="white")
    stream = io.BytesIO()
    image.save(stream, format="PNG")
    stream.seek(0)
    return UploadFile(filename=name, file=stream, headers={"content-type": "image/png"})


def _batch_payload(batch_id, **extra):
    return BatchCreate(
        id=batch_id,
        product_type="PANEER",
        initial_quantity=25,
        facility_name="Pune Dairy Plant",
        **extra,
    )


def _inspection_args(batch_id, **overrides):
    return {
        "batch_id": batch_id,
        "tamper_seal_condition": "INTACT",
        "seal_serial_number": "SEAL-123",
        "packaging_status": "NORMAL",
        "expected_quantity": 25,
        "actual_quantity": 24.5,
        "temperature_c": 4.2,
        "humidity_percent": 52,
        "cold_chain_compliant": True,
        "verdict": "PASSED",
        "notes": "Seal and package are in good condition.",
        "inspector_name": "ignored-client-supplied-name",
        "user": INSPECTOR_USER,
        "evidence": None,
        **overrides,
    }


def test_batch_lookup_and_inspection_history(tmp_path, monkeypatch):
    upload_dir = tmp_path / "security_inspections"
    monkeypatch.setattr(inspection_router, "UPLOAD_DIR", upload_dir)
    with isolated_db_session() as db:
        batch_router.create_batch(_batch_payload("PAN-AUDIT-1", sku="DT-PAN-200G", serial_number="LOT-7788"), db)
        assert batch_router.lookup_batches("PAN-AUDIT", db)[0].id == "PAN-AUDIT-1"

        saved = asyncio.run(inspection_router.create_inspection(**_inspection_args(
            "PAN-AUDIT-1", evidence=_png_upload(), db=db
        )))
        assert saved["batch_id"] == "PAN-AUDIT-1"
        assert saved["inspector_name"] == "A. Inspector (INSPECTOR)"
        assert saved["created_at"]
        assert len(saved["record_sha256"]) == 64
        assert saved["evidence_url"]
        assert (upload_dir / next(upload_dir.iterdir()).name).exists()
        assert len(inspection_router.list_inspections("PAN-AUDIT-1", db)) == 1
        assert len(inspection_router.list_inspections("other", db)) == 0


def test_inspection_rejects_missing_batch_invalid_image_and_bad_values(tmp_path, monkeypatch):
    upload_dir = tmp_path / "security_inspections"
    monkeypatch.setattr(inspection_router, "UPLOAD_DIR", upload_dir)
    with isolated_db_session() as db:
        batch_router.create_batch(_batch_payload("PAN-AUDIT-2"), db)

        with pytest.raises(HTTPException) as missing:
            asyncio.run(inspection_router.create_inspection(**_inspection_args("MISSING", db=db)))
        assert missing.value.status_code == 404

        with pytest.raises(HTTPException) as humidity:
            asyncio.run(inspection_router.create_inspection(**_inspection_args("PAN-AUDIT-2", humidity_percent=120, db=db)))
        assert humidity.value.status_code == 422

        with pytest.raises(HTTPException) as invalid_image:
            asyncio.run(inspection_router.create_inspection(**_inspection_args(
                "PAN-AUDIT-2",
                evidence=UploadFile(filename="not-an-image.png", file=io.BytesIO(b"not a png"), headers={"content-type": "image/png"}),
                db=db,
            )))
        assert invalid_image.value.status_code == 415
        assert not upload_dir.exists() or not any(upload_dir.iterdir())

