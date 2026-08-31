"""Prepare offline, layer-safe model directories for Dockerfile.vercel.

Vercel Container Registry accepts large images, but caps each compressed OCI
layer at 500 MB.  Hugging Face's original SigLIP and CLIP checkpoints are
larger than that as single files.  ``save_pretrained(max_shard_size=...)``
creates smaller checkpoint files, and this script puts each shard in its own
source directory so Dockerfile.vercel can COPY one shard per final layer.

This runs only while the container image is built.  It is not imported by the
application at runtime.
"""

from __future__ import annotations

import gc
import os
from pathlib import Path
import shutil
import sys

from transformers import AutoModel, AutoProcessor, CLIPModel, CLIPProcessor


SCREEN_MODEL_SOURCE = "google/siglip-base-patch16-224"
CLIP_MODEL_SOURCE = "openai/clip-vit-base-patch32"
MAX_SHARDS = 8
MAX_SHARD_SIZE = "190MB"


def _prepare_layout(model_dir: Path) -> tuple[Path, list[Path]]:
    meta_dir = model_dir / "meta"
    layer_dirs = [model_dir / f"layer-{index:02d}" for index in range(1, MAX_SHARDS + 1)]
    meta_dir.mkdir(parents=True, exist_ok=True)
    for layer_dir in layer_dirs:
        layer_dir.mkdir(parents=True, exist_ok=True)
    return meta_dir, layer_dirs


def _save_sharded_model(
    source: str,
    destination: Path,
    model_class,
    processor_class,
) -> None:
    staging = destination / "staging"
    staging.mkdir(parents=True, exist_ok=True)

    processor = processor_class.from_pretrained(source)
    model = model_class.from_pretrained(source)
    processor.save_pretrained(staging)
    model.save_pretrained(
        staging,
        safe_serialization=True,
        max_shard_size=MAX_SHARD_SIZE,
    )

    del model
    del processor
    gc.collect()

    meta_dir, layer_dirs = _prepare_layout(destination)
    weight_files = sorted(
        path
        for path in staging.iterdir()
        if path.name.startswith(("model", "pytorch_model"))
        and path.suffix in {".safetensors", ".bin"}
    )

    if not weight_files:
        raise RuntimeError(f"No checkpoint files were generated for {source}.")
    if len(weight_files) > len(layer_dirs):
        raise RuntimeError(
            f"{source} produced {len(weight_files)} shards; Dockerfile.vercel "
            f"only reserves {len(layer_dirs)} layers."
        )

    for weight_file, layer_dir in zip(weight_files, layer_dirs):
        shutil.move(str(weight_file), layer_dir / weight_file.name)

    for metadata_file in staging.iterdir():
        shutil.move(str(metadata_file), meta_dir / metadata_file.name)
    staging.rmdir()


def _cache_easyocr(destination: Path) -> None:
    # EasyOCR honours this variable and stores both detector and recognition
    # weights below it.  The runtime uses the same variable and never needs to
    # download a model into Vercel's ephemeral filesystem.
    os.environ["EASYOCR_MODULE_PATH"] = str(destination)
    import easyocr

    easyocr.Reader(["en", "hi"], gpu=False, verbose=False, download_enabled=True)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: cache_vercel_models.py OUTPUT_DIRECTORY")

    output_dir = Path(sys.argv[1]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    _save_sharded_model(
        SCREEN_MODEL_SOURCE,
        output_dir / "siglip",
        AutoModel,
        AutoProcessor,
    )
    _save_sharded_model(
        CLIP_MODEL_SOURCE,
        output_dir / "clip",
        CLIPModel,
        CLIPProcessor,
    )
    _cache_easyocr(output_dir / "easyocr")


if __name__ == "__main__":
    main()
