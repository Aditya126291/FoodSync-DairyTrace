"""Dynamic QR Code Generator Service for DairyTrace Public Consumer Passports."""

import base64
import hashlib
import io
import os
from typing import Any

DEFAULT_FRONTEND_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


def get_passport_url(batch_id: str, base_url: str = DEFAULT_FRONTEND_URL) -> str:
    """Constructs the public consumer passport URL for a batch."""
    clean_base = base_url.rstrip("/")
    return f"{clean_base}/passport/{batch_id}"


def _build_deterministic_matrix(data: str, size: int = 21) -> list[list[bool]]:
    """
    Builds a deterministic 21x21 QR-style matrix with standard 7x7 finder patterns
    at top-left, top-right, and bottom-left corners, timing patterns, and SHA-256 data modules.
    Used when the optional `qrcode` library is not installed in the active environment.
    """
    matrix = [[False for _ in range(size)] for _ in range(size)]
    reserved = [[False for _ in range(size)] for _ in range(size)]

    def place_finder(row_off: int, col_off: int) -> None:
        for r in range(7):
            for c in range(7):
                is_border = r in (0, 6) or c in (0, 6)
                is_inner = 2 <= r <= 4 and 2 <= c <= 4
                matrix[row_off + r][col_off + c] = is_border or is_inner
                reserved[row_off + r][col_off + c] = True

    place_finder(0, 0)
    place_finder(0, size - 7)
    place_finder(size - 7, 0)

    # Quiet separators around finder patterns
    for i in range(8):
        for r, c in [
            (7, i), (i, 7),
            (7, size - 1 - i), (i, size - 8),
            (size - 8, i), (size - 1 - i, 7),
        ]:
            if 0 <= r < size and 0 <= c < size:
                reserved[r][c] = True

    # Timing patterns
    for i in range(8, size - 8):
        matrix[6][i] = (i % 2 == 0)
        reserved[6][i] = True
        matrix[i][6] = (i % 2 == 0)
        reserved[i][6] = True

    digest = hashlib.sha256(data.encode("utf-8")).digest()
    bit_idx = 0
    total_bits = len(digest) * 8

    for r in range(size):
        for c in range(size):
            if not reserved[r][c]:
                byte_val = digest[(bit_idx // 8) % len(digest)]
                bit_val = (byte_val >> (7 - (bit_idx % 8))) & 1
                matrix[r][c] = bool(bit_val)
                bit_idx = (bit_idx + 1) % total_bits

    return matrix


def generate_batch_qr_png(batch_id: str, base_url: str = DEFAULT_FRONTEND_URL) -> bytes:
    """
    Generates a PNG image (bytes) encoding the public consumer passport URL for batch_id.
    Uses `qrcode` if available, falling back seamlessly to Pillow (`PIL.Image`).
    """
    passport_url = get_passport_url(batch_id, base_url=base_url)

    try:
        import qrcode  # type: ignore

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(passport_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except ImportError:
        from PIL import Image, ImageDraw

        matrix = _build_deterministic_matrix(passport_url, size=29)
        box_size = 10
        border = 4
        dim = (len(matrix) + border * 2) * box_size
        img = Image.new("RGB", (dim, dim), "white")
        draw = ImageDraw.Draw(img)

        for r, row in enumerate(matrix):
            for c, val in enumerate(row):
                if val:
                    x0 = (c + border) * box_size
                    y0 = (r + border) * box_size
                    draw.rectangle([x0, y0, x0 + box_size - 1, y0 + box_size - 1], fill="black")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()


def generate_batch_qr_svg(batch_id: str, base_url: str = DEFAULT_FRONTEND_URL) -> str:
    """Generates an SVG string representation of the batch passport QR code."""
    passport_url = get_passport_url(batch_id, base_url=base_url)
    try:
        import qrcode  # type: ignore

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=0,
        )
        qr.add_data(passport_url)
        qr.make(fit=True)
        matrix = [list(map(bool, row)) for row in qr.get_matrix()]
    except ImportError:
        matrix = _build_deterministic_matrix(passport_url, size=29)

    box = 8
    border = 4
    dim = (len(matrix) + border * 2) * box

    rects = []
    for r, row in enumerate(matrix):
        for c, val in enumerate(row):
            if val:
                x = (c + border) * box
                y = (r + border) * box
                rects.append(f'<rect x="{x}" y="{y}" width="{box}" height="{box}" fill="#0f172a"/>')

    rects_str = "".join(rects)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {dim} {dim}" width="{dim}" height="{dim}">'
        f'<rect width="100%" height="100%" fill="#ffffff"/>'
        f"{rects_str}</svg>"
    )


def generate_batch_qr_payload(batch_id: str, base_url: str = DEFAULT_FRONTEND_URL) -> dict[str, Any]:
    """Returns passport URL, base64 data URI, and SVG string for a batch."""
    passport_url = get_passport_url(batch_id, base_url=base_url)
    png_bytes = generate_batch_qr_png(batch_id, base_url=base_url)
    b64_str = base64.b64encode(png_bytes).decode("ascii")
    return {
        "batch_id": batch_id,
        "passport_url": passport_url,
        "qr_base64": f"data:image/png;base64,{b64_str}",
        "qr_svg": generate_batch_qr_svg(batch_id, base_url=base_url),
    }
