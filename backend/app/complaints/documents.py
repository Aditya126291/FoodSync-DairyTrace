"""In-memory text extraction for uploaded complaint documents (.pdf, .docx, .txt, .eml).

Files are parsed from memory and never written to disk.
"""

from __future__ import annotations

import re
from email import policy
from email.parser import BytesParser
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_EXTRACTED_CHARACTERS = 20_000
SUPPORTED_UPLOAD_EXTENSIONS = {".pdf", ".docx", ".txt", ".eml"}


def _decode_text_document(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="The text document could not be decoded.")


def _extract_email_text(data: bytes) -> str:
    message = BytesParser(policy=policy.default).parsebytes(data)
    body = message.get_body(preferencelist=("plain", "html"))
    if body is None:
        return ""
    content = body.get_content()
    return re.sub(r"<[^>]+>", " ", content) if body.get_content_type() == "text/html" else content


def extract_uploaded_document(filename: str, data: bytes) -> tuple[str, bool]:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_UPLOAD_EXTENSIONS:
        allowed = ", ".join(sorted(SUPPORTED_UPLOAD_EXTENSIONS))
        raise HTTPException(status_code=415, detail=f"Unsupported file type. Use: {allowed}.")
    try:
        if extension == ".pdf":
            from pypdf import PdfReader

            text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(data)).pages)
        elif extension == ".docx":
            from docx import Document

            text = "\n".join(paragraph.text for paragraph in Document(BytesIO(data)).paragraphs)
        elif extension == ".eml":
            text = _extract_email_text(data)
        else:
            text = _decode_text_document(data)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail="The uploaded document could not be read.") from error

    cleaned = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not cleaned:
        raise HTTPException(
            status_code=422,
            detail="No readable text was found in this document. Image-only PDFs need OCR, which is not enabled yet.",
        )
    return cleaned[:MAX_EXTRACTED_CHARACTERS], len(cleaned) > MAX_EXTRACTED_CHARACTERS
