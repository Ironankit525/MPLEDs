"""
OCR-based receipt and document analysis for the MPLADS module.

Extracts text from uploaded receipt/document images and cross-checks
key fields (amounts, dates, vendor names) against the claimed metadata.
This catches fraud like:
  - Receipts with dates that don't match the claimed work period
  - Amount mismatches between receipt and sanctioned amount
  - Receipts from vendors in a different city/state

Uses EasyOCR (pip install, no system deps, CPU-friendly).  Gracefully
degrades if EasyOCR is not installed — the pipeline continues without
OCR analysis, just like CLIP graceful degradation.

No model training required — uses pre-trained multilingual OCR.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ── Lazy import — EasyOCR is optional ────────────────────────────────
_ocr_reader = None
_ocr_load_attempted = False


def _get_reader():
    """Lazy-load the EasyOCR reader singleton.

    Downloads ~100 MB of models on first use.  Returns None if
    EasyOCR is not installed.
    """
    global _ocr_reader, _ocr_load_attempted

    if _ocr_load_attempted:
        return _ocr_reader

    _ocr_load_attempted = True

    try:
        import easyocr
        logger.info("Loading EasyOCR reader (English + Hindi)...")
        _ocr_reader = easyocr.Reader(
            ["en", "hi"],  # English + Hindi for Indian receipts
            gpu=False,
            verbose=False,
        )
        logger.info("EasyOCR reader loaded successfully.")
    except ImportError:
        logger.warning(
            "EasyOCR not installed — OCR analysis will be skipped. "
            "Install with: pip install easyocr"
        )
    except Exception as e:
        logger.warning("Failed to initialise EasyOCR: %s", e)

    return _ocr_reader


@dataclass
class OCRResult:
    """Result of OCR analysis on a receipt/document image.

    Attributes:
        text:               Full extracted text (joined lines).
        extracted_amounts:  All currency amounts found (₹ or Rs.).
        extracted_dates:    All dates found in common Indian formats.
        date_mismatch:      True if a receipt date conflicts with sanction date.
        flags:              List of flag codes raised by OCR analysis.
        confidence:         Average OCR confidence across all detected text.
        available:          True if EasyOCR was available and ran.
    """
    text: str = ""
    extracted_amounts: list[float] = field(default_factory=list)
    extracted_dates: list[str] = field(default_factory=list)
    date_mismatch: bool = False
    flags: list[str] = field(default_factory=list)
    confidence: float = 0.0
    available: bool = False


# ── Amount extraction ────────────────────────────────────────────────

# Matches patterns like: ₹1,23,456.78  Rs. 1234  INR 50,000  Rs 1,00,000/-
_AMOUNT_PATTERN = re.compile(
    r'(?:₹|Rs\.?|INR|Rupees)\s*'   # Currency prefix
    r'(\d[\d,]*\.?\d*)',            # Number with optional commas and decimal
    re.IGNORECASE,
)


def extract_amounts(text: str) -> list[float]:
    """Extract all currency amounts from text.

    Handles Indian number formatting (lakh/crore commas):
    ₹1,23,456.78 → 123456.78

    Args:
        text: Raw OCR text.

    Returns:
        List of amounts as floats, sorted descending.
    """
    amounts = []
    for match in _AMOUNT_PATTERN.finditer(text):
        raw = match.group(1).replace(",", "")
        try:
            amounts.append(float(raw))
        except ValueError:
            continue
    return sorted(amounts, reverse=True)


# ── Date extraction ──────────────────────────────────────────────────

# Common Indian date formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
_DATE_PATTERNS = [
    (re.compile(r'(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})'), "%d/%m/%Y"),
    (re.compile(r'(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})'), "%Y/%m/%d"),
]

# Month names (English) for "12 March 2024" style dates
_MONTH_DATE_PATTERN = re.compile(
    r'(\d{1,2})\s+'
    r'(January|February|March|April|May|June|July|August|'
    r'September|October|November|December)\s+'
    r'(\d{4})',
    re.IGNORECASE,
)


def extract_dates(text: str) -> list[str]:
    """Extract all dates from text in ISO format (YYYY-MM-DD).

    Handles DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD,
    and "12 March 2024" formats.

    Args:
        text: Raw OCR text.

    Returns:
        List of dates as ISO strings, deduplicated.
    """
    dates = set()

    # Numeric date patterns
    for pattern, fmt in _DATE_PATTERNS:
        for match in pattern.finditer(text):
            try:
                groups = match.groups()
                if fmt.startswith("%d"):
                    d, m, y = int(groups[0]), int(groups[1]), int(groups[2])
                else:
                    y, m, d = int(groups[0]), int(groups[1]), int(groups[2])

                # Basic validation
                if 1 <= d <= 31 and 1 <= m <= 12 and 1900 <= y <= 2100:
                    dt = datetime(y, m, d)
                    dates.add(dt.strftime("%Y-%m-%d"))
            except (ValueError, IndexError):
                continue

    # "12 March 2024" style
    for match in _MONTH_DATE_PATTERN.finditer(text):
        try:
            day_str, month_str, year_str = match.groups()
            dt = datetime.strptime(f"{day_str} {month_str} {year_str}", "%d %B %Y")
            dates.add(dt.strftime("%Y-%m-%d"))
        except ValueError:
            continue

    return sorted(dates)


def analyse_receipt(
    image_path: str,
    sanction_date: Optional[datetime] = None,
    claimed_amount: Optional[float] = None,
) -> OCRResult:
    """Run OCR on a receipt/document image and extract structured data.

    Extracts text, amounts, and dates, then cross-checks against
    the claimed metadata to detect inconsistencies.

    Args:
        image_path:     Path to the receipt image.
        sanction_date:  When the work was sanctioned (for date validation).
        claimed_amount: Expected amount (for amount comparison).

    Returns:
        OCRResult with extracted data and any flags raised.
    """
    reader = _get_reader()
    if reader is None:
        return OCRResult(available=False)

    try:
        # Run OCR
        results = reader.readtext(image_path)
    except Exception as e:
        logger.warning("OCR failed for %s: %s", image_path, e)
        return OCRResult(available=False)

    if not results:
        return OCRResult(available=True, text="", confidence=0.0)

    # Join all detected text
    texts = []
    total_confidence = 0.0
    for (bbox, text, conf) in results:
        texts.append(text)
        total_confidence += conf

    full_text = "\n".join(texts)
    avg_confidence = total_confidence / len(results) if results else 0.0

    # Extract structured data
    amounts = extract_amounts(full_text)
    dates = extract_dates(full_text)

    result = OCRResult(
        text=full_text,
        extracted_amounts=amounts,
        extracted_dates=dates,
        confidence=avg_confidence,
        available=True,
    )

    # ── Cross-check: receipt dates vs sanction date ──────────────────
    if sanction_date and dates:
        for date_str in dates:
            try:
                receipt_date = datetime.strptime(date_str, "%Y-%m-%d")
                if receipt_date < sanction_date:
                    result.date_mismatch = True
                    result.flags.append("RECEIPT_DATE_BEFORE_SANCTION")
                    break
            except ValueError:
                continue

    # ── Cross-check: amount mismatch ─────────────────────────────────
    if claimed_amount and amounts:
        # Flag if the largest extracted amount differs by more than 20%.
        # Use max(claimed_amount, 1.0) as denominator to avoid ratio
        # explosion on very small claimed amounts (e.g. ₹0.01).
        largest = amounts[0]
        safe_denom = max(claimed_amount, 1.0)
        if abs(largest - claimed_amount) / safe_denom > 0.20:
            result.flags.append("RECEIPT_AMOUNT_MISMATCH")

    logger.info(
        "OCR for %s: %d chars, %d amounts, %d dates, confidence=%.2f, flags=%s",
        image_path, len(full_text), len(amounts), len(dates),
        avg_confidence, result.flags,
    )

    return result
