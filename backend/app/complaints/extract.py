"""Deterministic complaint entity extractor (regex + keyword heuristics).

Ported from the reference AI Complaint Management System (`extract_patch`), keeping the same
key/value patterns, targeted-edit ("change the X to Y") grammar and severity/priority
normalisation, with the pharma vocabulary replaced by dairy / food-safety vocabulary.
It is both the offline mode (no LLM key) and the safety net when the LLM call fails.
"""

from __future__ import annotations

import datetime
import re
from typing import Any

SEVERITY_OPTIONS = ["Low", "Medium", "High", "Critical", "Needs QA Review"]
PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent", "Needs QA Review"]

# Fields that are always derived from the scanned batch and can never be changed by the AI/client.
LOCKED_FIELDS = {"productName", "batchLotNumber", "manufacturingDate", "expiryDate", "originatingSite"}

ALLOWED_FIELDS = {
    "customerName", "complaintSource", "productName", "strengthGrade", "batchLotNumber",
    "manufacturingDate", "expiryDate", "affectedQuantity", "originatingSite", "impactedMaterial",
    "complaintType", "complaintDate", "defectSummary", "detailedDescription", "severity",
    "priority", "riskAssessment",
}

# Categories: (label, keywords, severity, priority, root cause, CAPA)
CATEGORIES: list[tuple[str, tuple[str, ...], str, str, str, list[str]]] = [
    (
        "Illness reported",
        ("illness", "vomit", "diarrh", "food poison", "fell sick", "became sick", "hospital", "stomach pain", "allergic"),
        "Critical", "Urgent",
        "Possible microbial or chemical contamination reaching consumers.",
        [
            "Immediate Containment: place the batch and all derived products on hold and notify the QA Officer.",
            "Root Cause: retrieve retained samples and run microbiological and chemical panels.",
            "Preventive Action: review pasteurisation and cold-chain records for the production run.",
        ],
    ),
    (
        "Chemical / adulterant contamination",
        ("aflatoxin", "antibiotic", "pesticide", "residue", "formalin", "melamine", "urea", "detergent", "starch", "adulterat", "neutraliser", "neutralizer", "hydrogen peroxide"),
        "Critical", "Urgent",
        "Adulterant or chemical residue introduced at source (feed, farm or collection centre).",
        [
            "Immediate Containment: quarantine the batch and trace every linked paneer batch with the recall engine.",
            "Root Cause: re-test retained milk samples and audit the contributing collection centres.",
            "Preventive Action: add adulterant screening at milk intake and supplier onboarding checks.",
        ],
    ),
    (
        "Foreign matter",
        ("foreign", "hair", "insect", "plastic", "glass", "metal", "particle", "stone", "fly "),
        "Critical", "Urgent",
        "Foreign material entering during filling, processing or packaging.",
        [
            "Immediate Containment: pull remaining stock for the batch and inspect retained packs.",
            "Root Cause: audit filters, sieves and the packaging line for breakage or ingress points.",
            "Preventive Action: add inline metal/vision inspection and revisit GMP hygiene training.",
        ],
    ),
    (
        "Spoilage / sourness",
        ("sour", "curdl", "spoil", "smell", "odour", "odor", "rancid", "bad taste", "fungus", "mould", "mold", "whey", "slimy", "off taste", "expired"),
        "High", "High",
        "Microbial growth from a cold-chain excursion or elevated acidity at processing.",
        [
            "Immediate Containment: hold remaining stock at the affected store and in the warehouse.",
            "Root Cause: review reefer temperature logs and the batch acidity records.",
            "Preventive Action: tighten cold-chain monitoring and shorten dispatch-to-shelf time.",
        ],
    ),
    (
        "Packaging / tamper",
        ("leak", "torn", "seal", "swollen", "bulg", "damaged pack", "tamper", "open pack", "punctur", "burst"),
        "High", "High",
        "Container closure or sealing failure, or tampering after dispatch.",
        [
            "Immediate Containment: inspect cartons in transit and quarantine affected packs.",
            "Root Cause: verify sealing-machine settings and film quality for the production date.",
            "Preventive Action: add seal-integrity checks and tamper-evident closures.",
        ],
    ),
    (
        "Cold-chain failure",
        ("temperature", "cold chain", "cold-chain", "warm", "reefer", "not refrigerated", "thaw"),
        "High", "High",
        "Temperature excursion during transport or storage.",
        [
            "Immediate Containment: segregate stock exposed to the excursion pending QA review.",
            "Root Cause: pull data-logger and reefer records for the affected route.",
            "Preventive Action: add continuous temperature alerts for distributors and retailers.",
        ],
    ),
]
DEFAULT_CATEGORY = (
    "Product quality concern", (), "Medium", "Medium",
    "Quality deviation requiring standard QA investigation.",
    [
        "Immediate Containment: place remaining batch inventory on hold pending review.",
        "Root Cause: perform a 5-Why analysis and review the batch processing records.",
        "Preventive Action: refresh staff training on deviation handling procedures.",
    ],
)


def classify(text: str) -> tuple[str, str, str, str, list[str]]:
    """Return (type, severity, priority, root cause, CAPA) using the first matching category."""
    lowered = text.lower()
    for label, keywords, severity, priority, root_cause, capa in CATEGORIES:
        if any(k in lowered for k in keywords):
            return label, severity, priority, root_cause, capa
    label, _, severity, priority, root_cause, capa = DEFAULT_CATEGORY
    return label, severity, priority, root_cause, capa


def default_capa(text: str) -> tuple[str, list[str]]:
    _, _, _, root_cause, capa = classify(text)
    return root_cause, capa


def default_risk(text: str) -> str:
    label, severity, _, _, _ = classify(text)
    return f"{severity} - {label} requiring QA review."


def normalize_severity(val: str | None, text: str = "") -> str:
    v = (val or "").strip().lower()
    for option in SEVERITY_OPTIONS:
        if v == option.lower():
            return option
    if "needs" in v or "qa" in v:
        return "Needs QA Review"
    for option in ("Critical", "High", "Medium", "Low"):
        if option.lower() in v:
            return option
    return classify(text)[1]


def normalize_priority(val: str | None, text: str = "") -> str:
    v = (val or "").strip().lower()
    for option in PRIORITY_OPTIONS:
        if v == option.lower():
            return option
    if "needs" in v or "qa" in v:
        return "Needs QA Review"
    if "critical" in v:
        return "Urgent"
    for option in ("Urgent", "High", "Medium", "Low"):
        if option.lower() in v:
            return option
    return classify(text)[2]


def synthesize_defect_summary(text: str, patch: dict[str, str], current_form: dict[str, str]) -> str:
    merged = {**current_form, **patch}
    label = classify(text)[0].lower()
    product = merged.get("productName") or "dairy product"
    batch = merged.get("batchLotNumber")
    batch_str = f" (batch {batch})" if batch else ""
    who = merged.get("customerName")
    who_str = f" reported by {who}" if who else ""
    qty = merged.get("affectedQuantity")
    qty_str = f", affecting {qty}" if qty else ""
    return f"{label.capitalize()} complaint{who_str} regarding {product}{batch_str}{qty_str}. Pending QA review."


_NAME = r"(?-i:[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})"
_ORG = r"(?-i:[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'-]*){0,3})"

KV_PATTERNS: dict[str, list[str]] = {
    "customerName": [
        r"(?:Reporter|Customer|Client|Reported\s*By)\s*(?:Name)?\s*:\s*\n?\s*([^\n\r|]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?(?:customer|reporter)(?:\s+name)?\s+(?:to|is|as)\s+([^\n\r.]+)",
        rf"(?:reported|complained|filed|logged|submitted)\s+by\s+({_NAME})",
        rf"(?:my\s+name\s+is|i\s+am|this\s+is)\s+({_NAME})",
        rf"({_ORG}\s+(?:Store|Mart|Supermarket|Retail|Dairy|Cooperative|Hotel|Restaurant|Cafe|Bakery|Distributors?))",
        r"(Retailer\s+[A-Z]\b(?:\s*\([^)]+\))?)",
    ],
    "complaintSource": [
        r"Complaint\s*Source\s*:\s*\n?\s*([^\n\r]+)",
        r"Source\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?complaint\s+source\s+(?:to|is|as)\s+([^\n\r.]+)",
    ],
    "productName": [
        r"Product(?:\s*Name)?\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?product(?:\s+name)?\s+(?:to|is|as)\s+([^\n\r.]+)",
    ],
    "strengthGrade": [
        r"(?:Pack\s*Size|Fat\s*(?:Grade|Content)|Grade)\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?(?:pack\s+size|grade)\s+(?:to|is|as)\s+([^\n\r.]+)",
        r"(\d+\s*(?:g|gm|kg|ml|l|litre|liter)\s*(?:pack|pouch|tub|carton)?)\b",
    ],
    "batchLotNumber": [
        r"Batch\s*(?:\/\s*Lot)?\s*(?:Number|No\.?|ID)?\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?batch(?:\s+(?:number|id|lot))?\s+(?:to|is|as)\s+([^\n\r.]+)",
        r"\b((?:MILK|PAN|PANEER)-\d{2,6})\b",
    ],
    "manufacturingDate": [
        r"(?:Manufactur(?:ing|ed)|Production|Packed)\s*Date\s*:\s*\n?\s*([^\n\r.,]+)",
        r"mfg\s*date\s*:\s*\n?\s*([^\n\r.,]+)",
    ],
    "expiryDate": [
        r"(?:Expir(?:y|ation)|Best\s*Before|Use\s*By)\s*(?:Date)?\s*:\s*\n?\s*([^\n\r.,]+)",
        r"exp\s*date\s*:\s*\n?\s*([^\n\r.,]+)",
    ],
    "affectedQuantity": [
        r"Affected\s*Quantity\s*:\s*\n?\s*([^\n\r]+)",
        r"Quantity\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?(?:affected\s+)?quantity\s+(?:to|is|as)\s+([^\n\r.]+)",
        r"(\d+(?:\.\d+)?\s*(?:packs?|pouches|litres?|liters?|kg|cartons?|units|bottles|crates|tubs))\b",
    ],
    "originatingSite": [
        r"(?:Originating\s*)?(?:Site|Facility|Store|Location)\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?(?:site|facility|store)\s+(?:to|is|as)\s+([^\n\r.]+)",
    ],
    "impactedMaterial": [
        r"Impacted\s*(?:Material|Packaging|Ingredient)s?\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?(?:material|packaging)\s+(?:to|is|as)\s+([^\n\r.]+)",
    ],
    "complaintType": [
        r"Complaint\s*Type\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?complaint\s+type\s+(?:to|is|as)\s+([^\n\r.]+)",
    ],
    "complaintDate": [
        r"Complaint\s*Date\s*:\s*\n?\s*([^\n\r]+)",
        r"Date\s*of\s*(?:Incident|Purchase)\s*:\s*\n?\s*([^\n\r]+)",
    ],
    "severity": [
        r"Severity\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?severity\s+(?:to|is|as)\s+(Low|Medium|High|Critical|Needs QA Review)",
    ],
    "priority": [
        r"Priority\s*:\s*\n?\s*([^\n\r]+)",
        r"(?:change|update|set|edit)\s+(?:the\s+)?priority\s+(?:to|is|as)\s+(Low|Medium|High|Urgent|Needs QA Review)",
    ],
}

_SOURCE_HINTS = (
    ("lab", "Lab (NABL)"), ("nabl", "Lab (NABL)"), ("inspector", "Inspector"),
    ("distributor", "Distributor"), ("retailer", "Retailer"), ("store", "Retailer"),
    ("shop", "Retailer"), ("supermarket", "Retailer"),
    ("bought", "Consumer"), ("purchased", "Consumer"), ("customer", "Consumer"),
    ("consumer", "Consumer"), ("my family", "Consumer"), ("i ", "Consumer"),
)


def extract_patch(text: str, is_update: bool = False) -> dict[str, str]:
    """High-precision entity extractor for free text and uploaded document tables."""
    patch: dict[str, str] = {}

    for field, patterns in KV_PATTERNS.items():
        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
            if match:
                val = match.group(1).strip(" .,\r\n")
                if "|" in val:
                    val = val.split("|")[0].strip()
                if val and val.lower() not in ("not provided", "none", "n/a", "null"):
                    patch[field] = val[:250]
                    break

    defect_match = re.search(
        r"(?:Defect\s*Summary|Description\s*of\s*Complaint|Incident\s*Details|Defect)\s*:\s*\n?\s*([^\n\r]+)",
        text, re.IGNORECASE,
    )
    if defect_match:
        patch["defectSummary"] = defect_match.group(1).strip(" .,\r\n")[:500]

    lowered = text.lower()

    if not is_update:
        if not patch.get("complaintSource"):
            for hint, source in _SOURCE_HINTS:
                if hint in lowered:
                    patch["complaintSource"] = source
                    break
        if not patch.get("complaintDate"):
            patch["complaintDate"] = datetime.date.today().strftime("%d %B %Y")
        if not patch.get("detailedDescription"):
            patch["detailedDescription"] = text.strip()
        label, severity, priority, _, _ = classify(text)
        if not patch.get("complaintType"):
            patch["complaintType"] = label
        patch["severity"] = normalize_severity(patch.get("severity"), text)
        patch["priority"] = normalize_priority(patch.get("priority"), text)
        if not patch.get("impactedMaterial"):
            mat = re.search(r"((?:foil|plastic|poly|pouch|tetra|carton|tub|bottle|cap|seal)\s*(?:pack|packaging|pouch|seal|lid|film)?s?)", text, re.IGNORECASE)
            if mat and label in ("Packaging / tamper", "Foreign matter"):
                patch["impactedMaterial"] = mat.group(1).strip().title()
    else:
        if patch.get("severity"):
            patch["severity"] = normalize_severity(patch.get("severity"), text)
        if patch.get("priority"):
            patch["priority"] = normalize_priority(patch.get("priority"), text)

    return patch


def missing_fields(form: dict[str, Any]) -> list[str]:
    labels = {
        "customerName": "Reporter name",
        "defectSummary": "Defect summary",
    }
    return [label for field, label in labels.items() if not form.get(field)]
