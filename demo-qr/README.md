# DairyTrace demo QR files

This folder contains standalone QR images for the six seeded demo batches and a printable reference sheet. The files are separate from the website UI so they can be uploaded to the landing-page QR scanner.

## Quick test

1. Start the DairyTrace frontend and backend using the project's normal run steps.
2. Open the landing page in the same browser running at `http://localhost:5173/`.
3. Choose **Upload QR image** and select any PNG from `images/`.
4. The scanner should open the matching `/passport/{batchId}` page. The inspector can also scan the same QR and open that batch's audit record.
5. Use `demo-batch-cards.html` to view or print the QRs with their mock details. Each QR image is also usable on its own.

The QR images encode local passport links such as `http://localhost:5173/passport/PAN-201`. They work for local manual upload tests and for scanning from a second device only when the frontend is reachable from that device. The batch IDs and details match the app's existing seeded demo scenario; these files do not add or change website data.

## Files

- `images/{BATCH-ID}.png` — high-contrast QR image for a single seeded batch.
- `demo-batch-cards.html` — standalone, printable batch and QR reference sheet.
- `mock-batches.json` — mock batch descriptions used to generate the sheet and QR files.
- `generate_demo_qrs.py` — regenerate the PNGs and HTML sheet with Python `qrcode` and Pillow installed.
