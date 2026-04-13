"""
Evaluation script: compute mAP for each model/backend combo against our own annotations.

Usage:
    python evaluate.py --annotations annotations/instances.json --images images/

Expects COCO-format annotations (exported from Label Studio).
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
from ultralytics import YOLO


def load_model_configs():
    """Load model paths from the export notebook output."""
    with open("../model_paths.json") as f:
        return json.load(f)


def benchmark_latency(model, image_paths, warmup=5, runs=None):
    """Measure average inference latency over a set of images."""
    # Warmup
    for img_path in image_paths[:warmup]:
        model(str(img_path), verbose=False)

    test_images = image_paths if runs is None else image_paths[:runs]
    latencies = []
    for img_path in test_images:
        start = time.perf_counter()
        model(str(img_path), verbose=False)
        latencies.append((time.perf_counter() - start) * 1000)

    return {
        "mean_ms": np.mean(latencies),
        "std_ms": np.std(latencies),
        "fps": 1000 / np.mean(latencies),
    }


def evaluate_map(model, data_yaml):
    """Run COCO mAP evaluation using Ultralytics val."""
    results = model.val(data=data_yaml, verbose=False)
    return {
        "map50": float(results.box.map50),
        "map50_95": float(results.box.map),
    }


def main():
    parser = argparse.ArgumentParser(description="Evaluate object detection models")
    parser.add_argument("--data", type=str, required=True, help="Path to data YAML file for validation")
    parser.add_argument("--images", type=str, default="images/", help="Path to test images directory")
    args = parser.parse_args()

    model_paths = load_model_configs()

    configs = [
        ("YOLOv8", "PyTorch", model_paths["yolov8m_pytorch"]),
        ("YOLOv8", "ONNX", model_paths["yolov8m_onnx"]),
        ("YOLOv8", "TensorRT", model_paths["yolov8m_tensorrt"]),
        ("RT-DETR", "PyTorch", model_paths["rtdetr_l_pytorch"]),
        ("RT-DETR", "ONNX", model_paths["rtdetr_l_onnx"]),
        ("RT-DETR", "TensorRT", model_paths["rtdetr_l_tensorrt"]),
    ]

    image_paths = sorted(Path(args.images).glob("*.jpg")) + sorted(Path(args.images).glob("*.png"))
    print(f"Found {len(image_paths)} test images in {args.images}")

    results = []
    for model_name, backend, path in configs:
        if not Path(path).exists():
            print(f"Skipping {model_name}/{backend} — file not found: {path}")
            continue

        print(f"\nEvaluating {model_name} / {backend}...")
        model = YOLO(path)

        # Latency
        lat = benchmark_latency(model, image_paths)
        print(f"  Latency: {lat['mean_ms']:.1f} ms ({lat['fps']:.1f} FPS)")

        # mAP
        acc = evaluate_map(model, args.data)
        print(f"  mAP@50: {acc['map50']:.3f}, mAP@50:95: {acc['map50_95']:.3f}")

        results.append({
            "Model": model_name,
            "Backend": backend,
            "mAP@50": round(acc["map50"], 3),
            "mAP@50:95": round(acc["map50_95"], 3),
            "Avg Latency (ms)": round(lat["mean_ms"], 1),
            "FPS": round(lat["fps"], 1),
        })

    # Print final table
    print("\n" + "=" * 70)
    print("Combined Results:")
    print(f"{'Model':<10} {'Backend':<12} {'mAP@50':>8} {'mAP@50:95':>10} {'Latency':>10} {'FPS':>8}")
    print("-" * 70)
    for r in results:
        print(f"{r['Model']:<10} {r['Backend']:<12} {r['mAP@50']:>8.3f} {r['mAP@50:95']:>10.3f} {r['Avg Latency (ms)']:>8.1f} ms {r['FPS']:>8.1f}")

    # Save to CSV
    import csv
    with open("benchmark_results.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
    print("\nSaved to benchmark_results.csv")


if __name__ == "__main__":
    main()
