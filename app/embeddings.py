"""
Layer 3: CLIP-based semantic image embeddings and zero-shot classification.

This layer catches fraud that defeats pixel-level hashing:
  - Same physical site photographed from a different angle
  - Significantly cropped or rotated versions
  - Content that doesn't match the claimed work type

Uses OpenAI's CLIP model (open source, runs locally on CPU) to compute
512-dimensional image embeddings and perform zero-shot text-image
matching.

IMPORTANT: This module lazy-loads the CLIP model.  Importing this file
does NOT download the ~600 MB model — that happens on the first call
to embed_image() or zero_shot_match().  If CLIP is disabled or torch
is unavailable, all methods return None and the pipeline continues
with hash + EXIF checks only.
"""

import logging
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

# ── Lazy imports ─────────────────────────────────────────────────────
# torch and transformers are heavy dependencies that may not be
# installed.  We import them lazily inside CLIPEngine to avoid
# crashing the module on import.

_clip_engine_instance: Optional["CLIPEngine"] = None


class CLIPEngine:
    """Lazy-loaded singleton for CLIP image embeddings and zero-shot matching.

    The model is not loaded until the first call to embed_image() or
    zero_shot_match().  If ENABLE_CLIP is False or torch/transformers
    can't be imported, all methods return None gracefully.

    The embedding dimension depends on the configured CLIP model variant
    (e.g. 512 for clip-vit-base-patch32, 768 for clip-vit-large-patch14).

    Usage::

        engine = get_clip_engine()
        embedding = engine.embed_image("photo.jpg")  # -> np.ndarray or None
        confidence = engine.zero_shot_match("photo.jpg", "road construction")  # -> float or None
    """

    def __init__(self) -> None:
        self._model = None
        self._processor = None
        self._tokenizer = None
        self._available = False
        self._load_attempted = False
        self._embedding_dim: int | None = None

    def _ensure_loaded(self) -> bool:
        """Load the CLIP model on first use.  Returns True if ready.

        This method is idempotent — calling it multiple times after
        a failed load does NOT retry.  This avoids hammering the disk
        or network on every request when the model is genuinely
        unavailable.
        """
        if self._load_attempted:
            return self._available

        self._load_attempted = True

        if not settings.ENABLE_CLIP:
            logger.info("CLIP is disabled via ENABLE_CLIP=False.")
            return False

        try:
            import torch  # noqa: F811
            from transformers import CLIPModel, CLIPProcessor

            logger.info(
                "Loading CLIP model '%s' (this downloads ~600 MB on first run)...",
                settings.CLIP_MODEL_NAME,
            )
            self._processor = CLIPProcessor.from_pretrained(settings.CLIP_MODEL_NAME)
            self._model = CLIPModel.from_pretrained(settings.CLIP_MODEL_NAME)
            self._model.eval()  # Inference mode — no gradient computation

            self._available = True
            logger.info("CLIP model loaded successfully.")
            return True

        except ImportError as e:
            logger.warning(
                "CLIP unavailable — torch or transformers not installed: %s. "
                "The pipeline will continue with hash + EXIF checks only.",
                e,
            )
            return False
        except Exception as e:
            logger.warning(
                "Failed to load CLIP model '%s': %s. "
                "The pipeline will continue with hash + EXIF checks only.",
                settings.CLIP_MODEL_NAME, e,
            )
            return False

    @property
    def is_available(self) -> bool:
        """Whether the CLIP model is loaded and ready for inference."""
        return self._available

    def embed_image(self, image_path: str) -> Optional[np.ndarray]:
        """Compute an L2-normalised float32 embedding for an image.

        The embedding captures the semantic content of the image —
        two images of the same scene from different angles will have
        high cosine similarity even if their pixel-level hashes are
        completely different.

        The output dimension depends on the CLIP model variant configured
        in settings.CLIP_MODEL_NAME (e.g. 512 for base, 768 for large).

        Args:
            image_path: Path to the image file.

        Returns:
            L2-normalised numpy array of shape (dim,) and dtype float32,
            or None if CLIP is unavailable.
        """
        if not self._ensure_loaded():
            return None

        try:
            import torch

            img = Image.open(image_path).convert("RGB")
            inputs = self._processor(images=img, return_tensors="pt")

            with torch.no_grad():
                image_features = self._model.get_image_features(**inputs)

            # transformers >= 5.0 changed get_image_features() to return a
            # BaseModelOutputWithPooling object (the projected 512-dim
            # embedding lives in .pooler_output) instead of the plain
            # (batch, 512) tensor older transformers returned directly.
            # requirements.txt pins transformers>=4.30.0 with no upper
            # bound, so both shapes are possible depending on what's
            # actually installed — handle both rather than assuming one.
            # (Discovered via Round 2 CLIP verification: without this,
            # embed_image() silently returned a (50, 768) patch-token
            # tensor instead of a (512,) embedding — wrong shape, wrong
            # values, and no exception, since the [0] indexing "worked".)
            if hasattr(image_features, "pooler_output"):
                image_features = image_features.pooler_output

            # L2 normalise so cosine similarity = dot product
            embedding = image_features[0].cpu().numpy().astype(np.float32)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

            # Record / validate embedding dimension — all embeddings in
            # the database must share the same shape for cosine similarity
            # to be meaningful.  Catch model-change mistakes early.
            if self._embedding_dim is None:
                self._embedding_dim = embedding.shape[0]
                logger.info("CLIP embedding dimension: %d", self._embedding_dim)
            elif embedding.shape[0] != self._embedding_dim:
                logger.error(
                    "Embedding dimension mismatch: expected %d, got %d for %s. "
                    "Did CLIP_MODEL_NAME change without re-embedding stored images?",
                    self._embedding_dim, embedding.shape[0], image_path,
                )
                return None

            return embedding

        except Exception as e:
            logger.warning("CLIP embedding failed for %s: %s", image_path, e)
            return None

    def zero_shot_match(self, image_path: str, work_type: str) -> Optional[float]:
        """Estimate confidence (0–1) that the image depicts the claimed work type.

        Uses CLIP's zero-shot classification: the image is compared against
        a set of text descriptions, and we return the softmax probability
        of the best matching positive description.

        For known MPLADS work types (listed in settings.WORK_TYPE_PROMPTS),
        multiple domain-specific prompts are used for higher accuracy.
        Unknown work types fall back to a single generic prompt.

        Negative labels are always included as contrast:
          - "a photograph of an unrelated subject"
          - "a blurry or unusable photograph"
          - "a screenshot or document scan"

        Args:
            image_path: Path to the image file.
            work_type:  Claimed type of work (e.g. "road construction").

        Returns:
            Maximum softmax probability across all positive labels (float 0–1),
            or None if CLIP is unavailable.
        """
        if not self._ensure_loaded():
            return None

        try:
            import torch

            img = Image.open(image_path).convert("RGB")

            # Build positive labels from config or generic fallback
            work_type_lower = work_type.strip().lower()
            positive_labels = settings.WORK_TYPE_PROMPTS.get(
                work_type_lower,
                [f"a photograph of {work_type}"],
            )
            num_positive = len(positive_labels)

            # Negative labels provide contrast — same as before
            negative_labels = [
                "a photograph of an unrelated subject",
                "a blurry or unusable photograph",
                "a screenshot or document scan",
            ]

            all_labels = positive_labels + negative_labels

            inputs = self._processor(
                text=all_labels,
                images=img,
                return_tensors="pt",
                padding=True,
            )

            with torch.no_grad():
                outputs = self._model(**inputs)
                # logits_per_image shape: (1, num_labels)
                logits = outputs.logits_per_image[0]
                probs = torch.softmax(logits, dim=0)

            # Return the MAXIMUM probability across all positive labels.
            # This way, if any domain-specific prompt matches well, we
            # get a high confidence score even if other prompts don't.
            positive_probs = probs[:num_positive]
            return float(torch.max(positive_probs).item())

        except Exception as e:
            logger.warning(
                "CLIP zero-shot match failed for %s (work_type='%s'): %s",
                image_path, work_type, e,
            )
            return None


def get_clip_engine() -> CLIPEngine:
    """Return the global CLIPEngine singleton.

    Creates the engine on first call but does NOT load the model —
    that happens lazily on the first embed_image() or zero_shot_match()
    call.
    """
    global _clip_engine_instance
    if _clip_engine_instance is None:
        _clip_engine_instance = CLIPEngine()
    return _clip_engine_instance
