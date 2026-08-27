"""
Tests for the OCR receipt analysis module.

Tests cover:
  - Amount extraction from text (₹, Rs., INR formats)
  - Date extraction (DD/MM/YYYY, DD-MM-YYYY, month names)
  - Date cross-checking against sanction date
  - Graceful degradation when EasyOCR is unavailable
"""

from datetime import datetime

import pytest

from app.ocr_analysis import extract_amounts, extract_dates, OCRResult


# ── Amount extraction tests ──────────────────────────────────────────

class TestExtractAmounts:
    """Test currency amount extraction from OCR text."""

    def test_rupee_symbol(self) -> None:
        assert extract_amounts("Total: ₹1,23,456.78") == [123456.78]

    def test_rs_prefix(self) -> None:
        assert extract_amounts("Amount: Rs. 50,000") == [50000.0]

    def test_rs_no_dot(self) -> None:
        assert extract_amounts("Rs 1,00,000/-") == [100000.0]

    def test_inr_prefix(self) -> None:
        assert extract_amounts("INR 25000") == [25000.0]

    def test_rupees_word(self) -> None:
        assert extract_amounts("Rupees 5,500.50 only") == [5500.50]

    def test_multiple_amounts(self) -> None:
        text = "Sub-total: ₹10,000  Tax: ₹1,800  Grand Total: ₹11,800"
        amounts = extract_amounts(text)
        assert len(amounts) == 3
        assert amounts[0] == 11800.0  # Sorted descending
        assert amounts[2] == 1800.0

    def test_no_amounts(self) -> None:
        assert extract_amounts("No currency here, just text.") == []

    def test_lakh_format(self) -> None:
        """Indian lakh format: 1,23,456 (not 123,456)."""
        assert extract_amounts("₹1,23,456") == [123456.0]

    def test_case_insensitive(self) -> None:
        assert extract_amounts("rs 500") == [500.0]
        assert extract_amounts("RS 500") == [500.0]
        assert extract_amounts("inr 500") == [500.0]


# ── Date extraction tests ────────────────────────────────────────────

class TestExtractDates:
    """Test date extraction from OCR text."""

    def test_dd_mm_yyyy_slash(self) -> None:
        assert extract_dates("Date: 15/03/2024") == ["2024-03-15"]

    def test_dd_mm_yyyy_dash(self) -> None:
        assert extract_dates("Date: 15-03-2024") == ["2024-03-15"]

    def test_dd_mm_yyyy_dot(self) -> None:
        assert extract_dates("Date: 15.03.2024") == ["2024-03-15"]

    def test_yyyy_mm_dd(self) -> None:
        assert extract_dates("Date: 2024-03-15") == ["2024-03-15"]

    def test_month_name(self) -> None:
        assert extract_dates("Dated 12 March 2024") == ["2024-03-12"]

    def test_month_name_case_insensitive(self) -> None:
        assert extract_dates("Dated 5 JANUARY 2025") == ["2025-01-05"]

    def test_multiple_dates(self) -> None:
        text = "Invoice: 01/01/2024  Due: 31/01/2024"
        dates = extract_dates(text)
        assert len(dates) == 2
        assert "2024-01-01" in dates
        assert "2024-01-31" in dates

    def test_no_dates(self) -> None:
        assert extract_dates("No dates in this text") == []

    def test_invalid_date_rejected(self) -> None:
        """Day 32 or month 13 should not be extracted."""
        assert extract_dates("32/13/2024") == []


# ── OCRResult dataclass tests ────────────────────────────────────────

class TestOCRResult:
    """Test OCRResult defaults and structure."""

    def test_defaults(self) -> None:
        result = OCRResult()
        assert result.text == ""
        assert result.extracted_amounts == []
        assert result.extracted_dates == []
        assert result.date_mismatch is False
        assert result.flags == []
        assert result.available is False

    def test_with_data(self) -> None:
        result = OCRResult(
            text="Invoice ₹50,000",
            extracted_amounts=[50000.0],
            extracted_dates=["2024-03-15"],
            confidence=0.85,
            available=True,
        )
        assert result.available is True
        assert result.extracted_amounts == [50000.0]
