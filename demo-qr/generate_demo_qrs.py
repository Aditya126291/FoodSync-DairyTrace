"""Generate standalone QR images and printable mock-batch cards."""

import html
import json
from pathlib import Path

import qrcode
from qrcode.constants import ERROR_CORRECT_M


ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT / "mock-batches.json").read_text(encoding="utf-8"))
BASE_URL = DATA["base_url"].rstrip("/")
IMAGE_DIR = ROOT / "images"
IMAGE_DIR.mkdir(exist_ok=True)

cards = []
for batch in DATA["batches"]:
    batch_id = batch["id"]
    passport_url = f"{BASE_URL}/passport/{batch_id}"
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=12,
        border=4,
    )
    qr.add_data(passport_url)
    qr.make(fit=True)
    qr.make_image(fill_color="#10251d", back_color="white").convert("RGB").save(IMAGE_DIR / f"{batch_id}.png")

    safe_id = html.escape(batch_id)
    fields = [
        ("Product", batch["product"]),
        ("Batch type", batch["type"]),
        ("Quantity", batch["quantity"]),
        ("Origin / facility", batch["facility"]),
        ("Production date", batch["production_date"].replace("T", " ")),
        ("Best before", batch["expiry_date"].replace("T", " ")),
        ("Status", batch["status"]),
        ("Connected batches", ", ".join(batch["connected_batches"])),
        ("Quality note", batch["quality_note"]),
        ("Distribution / journey", batch["delivery_note"]),
    ]
    detail_html = "".join(
        f"<div class=\"detail\"><dt>{html.escape(label)}</dt><dd>{html.escape(value)}</dd></div>"
        for label, value in fields
    )
    cards.append(
        f"<article class=\"card\"><div class=\"copy\"><p class=\"eyebrow\">DAIRYTRACE DEMO BATCH</p>"
        f"<h2>{safe_id}</h2><dl>{detail_html}</dl></div>"
        f"<div class=\"qr-block\"><img src=\"images/{safe_id}.png\" alt=\"QR for batch {safe_id}\">"
        f"<p>Scan or upload to view this batch</p></div></article>"
    )

page = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DairyTrace · Demo batch QR cards</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; color: #24332c; background: #f6f5ef; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; }
    header { max-width: 1100px; margin: 0 auto 24px; display: flex; justify-content: space-between; align-items: end; gap: 20px; }
    h1 { margin: 0; color: #173c2b; font: 700 30px Georgia, serif; }
    header p { margin: 8px 0 0; color: #617068; font-size: 14px; }
    .cards { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { display: grid; grid-template-columns: minmax(0,1fr) 170px; gap: 16px; padding: 20px; border: 1px solid #dfe5df; border-radius: 18px; background: white; break-inside: avoid; }
    .eyebrow { margin: 0 0 7px; color: #477558; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
    h2 { margin: 0 0 13px; color: #142b20; font: 700 23px Georgia, serif; }
    dl { margin: 0; display: grid; gap: 8px; }
    .detail dt { margin-bottom: 2px; color: #77827b; font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .detail dd { margin: 0; font-size: 12px; line-height: 1.45; }
    .qr-block { align-self: start; text-align: center; }
    .qr-block img { display: block; width: 160px; height: 160px; margin: 0 auto; image-rendering: pixelated; }
    .qr-block p { margin: 7px 0 0; color: #647168; font-size: 10px; }
    @media (max-width: 760px) { body { padding: 16px; } header { align-items: start; flex-direction: column; } .cards { grid-template-columns: 1fr; } }
    @media print { body { padding: 0; background: white; } header { margin-bottom: 12px; } .cards { grid-template-columns: 1fr 1fr; gap: 10px; } .card { padding: 14px; border-radius: 10px; } }
  </style>
</head>
<body>
  <header><div><h1>DairyTrace demo batches</h1><p>Mock batch details and individual QR codes for local scanning tests.</p></div></header>
  <main class="cards">
    __CARDS__
  </main>
</body>
</html>
""".replace("__CARDS__", "\n".join(cards))

(ROOT / "demo-batch-cards.html").write_text(page, encoding="utf-8")
print(f"Generated {len(cards)} QR files in {IMAGE_DIR} and {ROOT / 'demo-batch-cards.html'}")
