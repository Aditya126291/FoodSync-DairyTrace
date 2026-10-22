"""Create local QR images for the end-to-end workflow test batches."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "backend"))

from app.services.qr_service import generate_batch_qr_png  # noqa: E402

OUTPUT = ROOT / "workflow-tests"
OUTPUT.mkdir(exist_ok=True)

for batch_id in ("MILK-901", "PAN-901"):
    (OUTPUT / f"{batch_id}.png").write_bytes(
        generate_batch_qr_png(batch_id, "http://localhost:5173")
    )

print(f"Generated test workflow QR files in {OUTPUT}")
