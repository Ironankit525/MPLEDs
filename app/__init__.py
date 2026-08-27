"""
MPLADS Image Fraud & Anomaly Detection Module.

Ingests work-completion photographs for the MPLADS government scheme,
checks them against previously-uploaded photographs using multi-layer
duplicate detection (hash + perceptual + semantic), runs EXIF metadata
and GPS anomaly checks, and returns a structured risk assessment.
"""
