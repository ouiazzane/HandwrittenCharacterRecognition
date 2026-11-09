"""CharVision AI API. Run with: uvicorn api:app --reload --port 8010."""

import base64
import binascii
import csv
import io
import json
from contextlib import asynccontextmanager
from pathlib import Path
from statistics import median
from typing import Annotated, Literal

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel, Field

from char_recognizer import CharRecognizer


ROOT = Path(__file__).resolve().parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.recognizer = CharRecognizer(str(ROOT / "models"), device="cpu")
    yield


app = FastAPI(title="CharVision AI API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/results", StaticFiles(directory=ROOT / "results"), name="results")


@app.get("/api/health")
def health():
    recognizer = getattr(app.state, "recognizer", None)
    if recognizer is None:
        return {
            "app": "CharVision AI",
            "status": "ok",
            "model_loaded": False,
            "classes": 0,
        }
    return {
        "app": "CharVision AI",
        "status": "ok",
        "model_loaded": True,
        "classes": len(recognizer.classes),
    }


class PredictionRequest(BaseModel):
    image: str
    top_k: Annotated[int, Field(ge=1, le=47)] = 3
    allowed: Literal["all", "digits", "letters"] = "all"


class WordPredictionRequest(BaseModel):
    image: str
    allowed: Literal["all", "digits", "letters"] = "all"


def normalize_allowed_predictions(predictions: list[dict], allowed: str, top_k: int):
    if allowed == "digits":
        kept = [item for item in predictions if item["char"] in "0123456789"]
    elif allowed == "letters":
        kept = [item for item in predictions if item["char"].isalpha()]
    else:
        kept = predictions

    allowed_mass = sum(item["probability"] for item in kept)
    normalized = [
        {**item, "probability": item["probability"] / allowed_mass}
        for item in kept
    ]
    normalized.sort(key=lambda item: item["probability"], reverse=True)
    return normalized[:top_k], allowed_mass, allowed_mass < 0.15


def filtered_predictions(recognizer, image: Image.Image, allowed: str, top_k: int):
    predictions = recognizer.predict(image, top_k=47)
    return normalize_allowed_predictions(predictions, allowed, top_k)


def character_segments(image: Image.Image) -> list[dict]:
    grayscale = np.asarray(image.convert("L"), dtype=np.uint8)
    border = np.concatenate((grayscale[0], grayscale[-1], grayscale[:, 0], grayscale[:, -1]))
    if np.median(border) > 127:
        ink = grayscale < 215
    else:
        ink = grayscale > 40
    foreground = ink.astype(np.uint8)
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(
        foreground, connectivity=8
    )
    components = [
        {
            "label": label,
            "x0": int(stats[label, cv2.CC_STAT_LEFT]),
            "y0": int(stats[label, cv2.CC_STAT_TOP]),
            "x1": int(stats[label, cv2.CC_STAT_LEFT] + stats[label, cv2.CC_STAT_WIDTH]),
            "y1": int(stats[label, cv2.CC_STAT_TOP] + stats[label, cv2.CC_STAT_HEIGHT]),
            "area": int(stats[label, cv2.CC_STAT_AREA]),
        }
        for label in range(1, component_count)
    ]
    if not components:
        return []

    median_area = median(component["area"] for component in components)
    median_width = median(component["x1"] - component["x0"] for component in components)
    median_height = median(component["y1"] - component["y0"] for component in components)
    parent = list(range(len(components)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(first: int, second: int) -> None:
        root_first, root_second = find(first), find(second)
        if root_first != root_second:
            parent[root_second] = root_first

    for small_index, small in enumerate(components):
        if small["area"] >= median_area * 0.08:
            continue
        candidates = []
        for large_index, large in enumerate(components):
            if large_index == small_index or large["area"] <= small["area"]:
                continue
            x_gap = max(large["x0"] - small["x1"], small["x0"] - large["x1"], 0)
            x_overlap = min(small["x1"], large["x1"]) - max(small["x0"], large["x0"])
            if x_overlap <= 0 and x_gap > median_width * 0.2:
                continue
            vertical_gap = max(large["y0"] - small["y1"], small["y0"] - large["y1"], 0)
            if vertical_gap > max(median_width * 0.5, median_height * 0.75):
                continue
            candidates.append((x_gap + vertical_gap, large_index))
        if candidates:
            union(small_index, min(candidates)[1])

    def grouped_components():
        groups: dict[int, dict] = {}
        for index, component in enumerate(components):
            root = find(index)
            if root not in groups:
                groups[root] = {
                    "labels": [component["label"]],
                    "x0": component["x0"],
                    "y0": component["y0"],
                    "x1": component["x1"],
                    "y1": component["y1"],
                    "area": component["area"],
                }
            else:
                group = groups[root]
                group["labels"].append(component["label"])
                group["x0"] = min(group["x0"], component["x0"])
                group["y0"] = min(group["y0"], component["y0"])
                group["x1"] = max(group["x1"], component["x1"])
                group["y1"] = max(group["y1"], component["y1"])
                group["area"] += component["area"]
        return sorted(groups.values(), key=lambda group: group["x0"])

    groups = grouped_components()
    changed = True
    while changed:
        changed = False
        for first in range(len(groups)):
            for second in range(first + 1, len(groups)):
                narrower = min(
                    groups[first]["x1"] - groups[first]["x0"],
                    groups[second]["x1"] - groups[second]["x0"],
                )
                overlap = min(groups[first]["x1"], groups[second]["x1"]) - max(
                    groups[first]["x0"], groups[second]["x0"]
                )
                if narrower > 0 and overlap > narrower * 0.5:
                    union(
                        next(i for i, item in enumerate(components) if item["label"] == groups[first]["labels"][0]),
                        next(i for i, item in enumerate(components) if item["label"] == groups[second]["labels"][0]),
                    )
                    groups = grouped_components()
                    changed = True
                    break
            if changed:
                break

    segments: list[dict] = []
    median_width = median(group["x1"] - group["x0"] for group in groups)
    for group in groups:
        x0, y0, x1, y1 = group["x0"], group["y0"], group["x1"], group["y1"]
        width, height = x1 - x0, y1 - y0
        is_wide = width > 1.6 * median_width and width > 1.2 * height
        if not is_wide:
            segments.append({**group, "touching": False})
            continue
        projection = ink[y0:y1, x0:x1].sum(axis=0)
        valley_start, valley_end = int(width * 0.2), max(int(width * 0.8), int(width * 0.2) + 1)
        valley = valley_start + int(np.argmin(projection[valley_start:valley_end]))
        maximum = int(projection.max())
        if maximum and projection[valley] < maximum * 0.25 and 0 < valley < width:
            split_x = x0 + valley
            for part_x0, part_x1 in ((x0, split_x), (split_x, x1)):
                ys, xs = np.where(ink[y0:y1, part_x0:part_x1])
                if len(xs):
                    segments.append({
                        **group,
                        "x0": part_x0 + int(xs.min()),
                        "y0": y0 + int(ys.min()),
                        "x1": part_x0 + int(xs.max()) + 1,
                        "y1": y0 + int(ys.max()) + 1,
                        "touching": False,
                    })
        else:
            segments.append({**group, "touching": True})

    return sorted(segments, key=lambda segment: segment["x0"])


def predict_segment(recognizer, grayscale: np.ndarray, segment: dict, allowed: str):
    height, width = grayscale.shape
    box_width = segment["x1"] - segment["x0"]
    box_height = segment["y1"] - segment["y0"]
    margin = max(2, int(round(max(box_width, box_height) * 0.08)))
    x0 = max(0, segment["x0"] - margin)
    y0 = max(0, segment["y0"] - margin)
    x1 = min(width, segment["x1"] + margin)
    y1 = min(height, segment["y1"] + margin)
    crop = Image.fromarray(grayscale[y0:y1, x0:x1])
    predictions, allowed_mass, suspicious = filtered_predictions(recognizer, crop, allowed, 3)
    return {
        "char": predictions[0]["char"],
        "probability": predictions[0]["probability"],
        "box": [segment["x0"], segment["y0"], segment["x1"], segment["y1"]],
        "touching": segment["touching"],
        "predictions": predictions,
        "allowed_mass": allowed_mass,
        "suspicious": suspicious,
    }


def decode_image(encoded: str) -> Image.Image:
    payload = encoded.split(",", 1)[1] if encoded.startswith("data:") and "," in encoded else encoded
    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Invalid base64 image") from exc
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            return image.copy()
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Invalid image data") from exc


def read_json(path: Path):
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def read_csv(path: Path):
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


@app.post("/api/predict")
def predict(request: PredictionRequest):
    image = decode_image(request.image)
    try:
        raw_predictions, processed = app.state.recognizer.predict(
            image, top_k=47, return_processed=True
        )
        predictions, allowed_mass, suspicious = normalize_allowed_predictions(
            raw_predictions, request.allowed, request.top_k
        )
    except ValueError as exc:
        if str(exc) == "No character drawn":
            raise HTTPException(status_code=400, detail="No character drawn") from exc
        raise

    processed_image = Image.fromarray(processed).resize((224, 224), Image.Resampling.NEAREST)
    output = io.BytesIO()
    processed_image.save(output, format="PNG")
    return {
        "predictions": predictions,
        "allowed": request.allowed,
        "allowed_mass": allowed_mass,
        "suspicious": suspicious,
        "processed_image": base64.b64encode(output.getvalue()).decode("ascii"),
        "confident": predictions[0]["probability"] >= 0.6,
    }


@app.get("/api/model-info")
def model_info():
    return read_json(ROOT / "models" / "model_info.json")


@app.get("/api/metrics")
def metrics():
    return read_json(ROOT / "results" / "final_metrics.json")


@app.get("/api/confusions")
def confusions():
    return [
        {
            "true": row["true"],
            "predicted": row["predicted"],
            "count": int(row["count"]),
            "pct_of_true_class": float(row["pct_of_true_class"]),
        }
        for row in read_csv(ROOT / "results" / "top_confusions_emnist.csv")
    ]


@app.get("/api/class-report")
def class_report():
    rows = read_csv(ROOT / "results" / "classification_report_emnist.csv")
    return [
        {
            "char": row[""],
            "precision": float(row["precision"]),
            "recall": float(row["recall"]),
            "f1": float(row["f1-score"]),
            "support": int(float(row["support"])),
        }
        for row in rows
        if row.get("") not in {"accuracy", "macro avg", "weighted avg", None}
    ]


@app.post("/api/predict-word")
def predict_word(request: WordPredictionRequest):
    image = decode_image(request.image)
    grayscale = np.asarray(image.convert("L"), dtype=np.uint8)
    segments = character_segments(image)
    if not segments:
        raise HTTPException(status_code=400, detail="No character drawn")
    characters = [
        predict_segment(app.state.recognizer, grayscale, segment, request.allowed)
        for segment in segments
    ]
    return {
        "text": "".join(item["char"] for item in characters),
        "allowed": request.allowed,
        "allowed_mass": sum(item["allowed_mass"] for item in characters) / len(characters),
        "suspicious": any(item["suspicious"] for item in characters),
        "characters": characters,
    }
