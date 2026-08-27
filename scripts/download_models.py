"""
Task 3.1: Pre-download and verify the CLIP model.

Fetches the CLIP model + processor (settings.CLIP_MODEL_NAME), prints the
on-disk cache location and total size, and runs one real test inference to
confirm the model actually works end to end — not just that the download
succeeded. Runnable independently ahead of time on a reliable network
connection, separate from the rest of the pipeline.

Usage:
    python -m scripts.download_models
    python -m scripts.download_models --sample-image data/images/clean_0000.jpg
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import PROJECT_ROOT, settings

DEFAULT_SAMPLE_IMAGE = PROJECT_ROOT / "data" / "images" / "clean_0000.jpg"


def _human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def download_and_verify(model_name: str | None = None, sample_image: str | None = None) -> None:
    model_name = model_name or settings.CLIP_MODEL_NAME
    sample_image = sample_image or str(DEFAULT_SAMPLE_IMAGE)

    print(f"Downloading/locating '{model_name}'...")
    t0 = time.time()
    try:
        from huggingface_hub import snapshot_download
    except ImportError as e:
        raise SystemExit(
            f"huggingface_hub is not installed ({e}). It's a transitive dependency of "
            f"transformers — run `pip install torch torchvision transformers` first."
        )

    try:
        cache_path = snapshot_download(repo_id=model_name)
    except Exception as e:
        raise SystemExit(
            f"Failed to download '{model_name}': {e}\n"
            f"This is the fallback trigger point — if this environment's Python/torch "
            f"combination can't fetch the model, CLIP verification cannot proceed here. "
            f"The rest of the pipeline still runs fine with ENABLE_CLIP=False."
        )
    download_elapsed = time.time() - t0

    total_bytes = sum(f.stat().st_size for f in Path(cache_path).rglob("*") if f.is_file())
    print(f"Cache location: {cache_path}")
    print(f"Total size on disk: {_human_size(total_bytes)}")
    print(f"Download/locate time: {download_elapsed:.1f}s")
    print()

    print("Running a test inference to confirm the model actually works...")
    from unittest.mock import patch

    import app.embeddings as embeddings_module

    with patch.object(settings, "ENABLE_CLIP", True):
        embeddings_module._clip_engine_instance = None
        from app.embeddings import get_clip_engine

        engine = get_clip_engine()

        t0 = time.time()
        engine._ensure_loaded()
        load_elapsed = time.time() - t0

        if not engine.is_available:
            raise SystemExit(
                "Model files were downloaded, but the CLIP engine failed to load "
                "(see the warning logged above for the root cause)."
            )

        t0 = time.time()
        embedding = engine.embed_image(sample_image)
        inference_elapsed = time.time() - t0

    embeddings_module._clip_engine_instance = None

    if embedding is None:
        raise SystemExit(f"Model loaded, but embed_image('{sample_image}') returned None.")

    print(f"Model load time: {load_elapsed:.2f}s")
    print(f"Test inference time: {inference_elapsed * 1000:.0f}ms  (image: {sample_image})")
    print(f"Embedding shape: {embedding.shape}, dtype: {embedding.dtype}, L2 norm: {(embedding ** 2).sum() ** 0.5:.4f}")
    print()
    print("CLIP is verified and working.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download and verify the CLIP model.")
    parser.add_argument("--model-name", type=str, default=None)
    parser.add_argument("--sample-image", type=str, default=None)
    args = parser.parse_args()
    download_and_verify(args.model_name, args.sample_image)
