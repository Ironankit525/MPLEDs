"""Mandatory SigLIP validation of uploaded visual evidence.

This layer is deliberately separate from ELA. ELA's screenshot heuristic is
kept disabled because compression uniformity overlaps heavily between modern
camera JPEGs and screenshots. The detector here uses SigLIP image/text
similarity for two independent questions:

1. Is the file a screen capture or a camera photograph?
2. Is the photograph plausible contractor/project evidence, or is it a
   landmark/stock/travel/unrelated image that merely depicts the same noun as
   the claimed work type?

The second question closes an important semantic gap: a photo of the Golden
Gate Bridge is certainly a "bridge", but it is not evidence that a contractor
built a bridge in Pune. The API eagerly prepares the shared model at startup,
so it cannot accept submissions while this mandatory gate is unavailable.
"""

from dataclasses import dataclass
import logging
from typing import Optional

from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

_detector_instance: Optional["ScreenCaptureDetector"] = None


@dataclass
class ScreenDetectionResult:
    """Normalised screen-vs-camera result returned to the risk engine."""

    available: bool = False
    screen_probability: Optional[float] = None
    model_name: Optional[str] = None


@dataclass
class WorkEvidenceDetectionResult:
    """Structured project-evidence classification returned to the engine."""

    available: bool = False
    valid_probability: Optional[float] = None
    top_category: Optional[str] = None
    top_probability: Optional[float] = None
    category_scores: Optional[dict[str, float]] = None
    model_name: Optional[str] = None


class ScreenCaptureDetector:
    """Lazy-loaded SigLIP visual-authenticity classifier.

    The class name is kept for compatibility with existing imports. The same
    model instance now supplies both screen detection and project-evidence
    validation, avoiding a second 800 MB model in memory.
    """

    SCREEN_PROMPT = "a screenshot of a computer screen, website, or software interface"
    CAMERA_PROMPT = "a natural camera photograph of a physical location"

    # Each category deliberately has the same number of prompts. We average
    # logits inside a category before the final softmax so a category does not
    # win merely because it was given more wording variants.
    WORK_EVIDENCE_PROMPTS = {
        "valid_project_evidence": [
            "a contractor progress photo of {work_type} at a local public works site in India",
            "documentary evidence of active construction, repair, or newly completed {work_type}",
            "a field verification photo showing site context, materials, workers, or recent {work_type} work",
        ],
        "famous_landmark_or_stock": [
            "a tourist photograph of a famous internationally recognizable landmark",
            "a stock or internet photograph of an iconic monument, bridge, building, or attraction",
            "the Golden Gate Bridge, Eiffel Tower, Statue of Liberty, Leaning Tower of Pisa, or another world famous landmark",
        ],
        "generic_non_project_image": [
            "a scenic photograph of completed infrastructure with no visible local construction work",
            "a generic photograph of a bridge, building, road, or park that is not contractor evidence",
            "an editorial or travel photograph rather than a public works progress record",
        ],
        "unrelated_image": [
            "a photograph unrelated to the claimed public works project",
            "a personal, product, animal, food, or entertainment photograph",
            "an image that cannot serve as evidence of construction or local infrastructure work",
        ],
    }

    def __init__(self) -> None:
        self._model = None
        self._processor = None
        self._torch = None
        self._available = False
        self._load_attempted = False

    def _ensure_loaded(self) -> bool:
        if self._load_attempted:
            return self._available
        self._load_attempted = True

        if not settings.ENABLE_SCREEN_MODEL:
            logger.info("Screen ML detector is disabled via ENABLE_SCREEN_MODEL=False.")
            return False

        try:
            import torch
            from transformers import AutoModel, AutoProcessor

            logger.info("Loading screen ML model '%s' (first use may download model files)...", settings.SCREEN_MODEL_NAME)
            self._processor = AutoProcessor.from_pretrained(settings.SCREEN_MODEL_NAME)
            self._model = AutoModel.from_pretrained(settings.SCREEN_MODEL_NAME)
            self._model.eval()
            self._torch = torch
            self._available = True
            logger.info("Screen ML model loaded successfully.")
            return True
        except ImportError as exc:
            logger.warning("Screen ML detector unavailable — optional dependencies are missing: %s", exc)
        except Exception as exc:
            logger.warning("Failed to load screen ML model '%s': %s", settings.SCREEN_MODEL_NAME, exc)
        return False

    def load(self) -> bool:
        """Load the shared model and report whether it is ready for inference."""
        return self._ensure_loaded()

    @property
    def is_available(self) -> bool:
        return self._available

    @property
    def load_attempted(self) -> bool:
        return self._load_attempted

    def predict(self, image_path: str) -> ScreenDetectionResult:
        """Return the model's relative probability that an image is a screenshot."""
        if not self._ensure_loaded():
            return ScreenDetectionResult(model_name=settings.SCREEN_MODEL_NAME)

        try:
            image = Image.open(image_path).convert("RGB")
            inputs = self._processor(
                text=[self.SCREEN_PROMPT, self.CAMERA_PROMPT],
                images=image,
                padding="max_length",
                return_tensors="pt",
            )
            with self._torch.no_grad():
                logits = self._model(**inputs).logits_per_image[0]
                probability = self._torch.softmax(logits, dim=0)[0].item()

            return ScreenDetectionResult(
                available=True,
                screen_probability=round(float(probability), 6),
                model_name=settings.SCREEN_MODEL_NAME,
            )
        except Exception as exc:
            logger.warning("Screen ML inference failed for %s: %s", image_path, exc)
            return ScreenDetectionResult(model_name=settings.SCREEN_MODEL_NAME)

    def predict_work_evidence(
        self,
        image_path: str,
        work_type: str,
    ) -> WorkEvidenceDetectionResult:
        """Classify whether a physical-work photo is plausible project evidence.

        This is not landmark identification and does not claim to know the
        exact location. It is a conservative relative classifier that catches
        obvious category-valid but provenance-invalid images (for example, a
        famous tourist bridge submitted as a local bridge project). GPS and
        capture-time checks remain separate, independent evidence.
        """
        if not self._ensure_loaded():
            return WorkEvidenceDetectionResult(model_name=settings.SCREEN_MODEL_NAME)

        try:
            image = Image.open(image_path).convert("RGB")
            categories = list(self.WORK_EVIDENCE_PROMPTS)
            prompts: list[str] = []
            slices: dict[str, tuple[int, int]] = {}

            for category in categories:
                start = len(prompts)
                prompts.extend(
                    prompt.format(work_type=work_type.strip().lower())
                    for prompt in self.WORK_EVIDENCE_PROMPTS[category]
                )
                slices[category] = (start, len(prompts))

            inputs = self._processor(
                text=prompts,
                images=image,
                padding="max_length",
                return_tensors="pt",
            )
            with self._torch.no_grad():
                prompt_logits = self._model(**inputs).logits_per_image[0]
                category_logits = self._torch.stack([
                    prompt_logits[start:end].mean()
                    for start, end in (slices[category] for category in categories)
                ])
                probabilities = self._torch.softmax(category_logits, dim=0)

            scores = {
                category: round(float(probabilities[index].item()), 6)
                for index, category in enumerate(categories)
            }
            top_category = max(scores, key=scores.get)

            return WorkEvidenceDetectionResult(
                available=True,
                valid_probability=scores["valid_project_evidence"],
                top_category=top_category,
                top_probability=scores[top_category],
                category_scores=scores,
                model_name=settings.SCREEN_MODEL_NAME,
            )
        except Exception as exc:
            logger.warning("Work-evidence ML inference failed for %s: %s", image_path, exc)
            return WorkEvidenceDetectionResult(model_name=settings.SCREEN_MODEL_NAME)


def get_screen_detector() -> ScreenCaptureDetector:
    """Return the process-wide shared detector instance."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = ScreenCaptureDetector()
    return _detector_instance


def reset_screen_detector() -> None:
    """Reset the singleton for tests and configuration reloads."""
    global _detector_instance
    _detector_instance = None
