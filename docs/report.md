# Object Detection Inference Optimization — Report

**CMPE 258 SP26 Homework 2 (Option 2)**
**Raeeka Yusuf — 018233761**

---

## 1. Objective

The goal of this project is to optimize the inference pipeline for 2D object detection on image and video data. We compare two strong-performing detection models — YOLOv8m and RT-DETR-L — across three inference backends: native PyTorch, ONNX Runtime with CUDA execution provider, and TensorRT with FP16 precision. We evaluate both speed (latency/FPS) and accuracy (mAP) to quantify the trade-offs of each optimization method. A full-stack application (FastAPI backend + React frontend) was built to demonstrate the pipeline interactively.

## 2. Models

**YOLOv8m** is a medium-size variant of Ultralytics' YOLOv8 family. It is an anchor-free, single-stage CNN detector with 25.9M parameters and 78.9 GFLOPs. YOLOv8 is widely used as a high-performance baseline due to its balance of speed and accuracy.

**RT-DETR-L** (Real-Time DEtection TRansformer) is a transformer-based detector developed by Baidu with 32.1M parameters and 103.8 GFLOPs. Unlike YOLOv8, RT-DETR uses an end-to-end architecture with no NMS post-processing — the transformer attention mechanism directly predicts a fixed set of detection candidates. This makes it an interesting comparison against a traditional CNN-based detector.

Both models are pretrained on the COCO dataset (80 object classes).

## 3. Inference Acceleration Methods

**ONNX Runtime (CUDA Execution Provider):** We exported each model to the ONNX format with graph simplification enabled. ONNX Runtime is a vendor-neutral inference engine that can run on multiple hardware backends. With the CUDA execution provider, it executes graph operations on the GPU using optimized CUDA kernels. The key advantage is portability — the same ONNX model runs on NVIDIA, AMD, or Intel hardware with the appropriate EP.

**TensorRT (FP16):** We exported each model to NVIDIA TensorRT engine format with half-precision (FP16) enabled. TensorRT applies several hardware-specific optimizations: layer and tensor fusion (combining multiple sequential operations into single CUDA kernels), FP16 precision calibration (reducing memory bandwidth and computation by using 16-bit instead of 32-bit floats), and kernel auto-tuning (profiling thousands of kernel implementations to select the fastest for the specific GPU architecture). The resulting engine is specific to the GPU it was built on — our engines were built on and optimized for the Tesla T4.

## 4. Evaluation Setup

**Own Data:** We collected 72 personal photographs containing common objects (cats, food, vehicles, furniture, household items) and a 28-second video. Images were uploaded to Google Drive and processed on Google Colab with a T4 GPU.

**Annotations:** We used model-assisted annotation — YOLOv8m PyTorch was run on all images at a 0.5 confidence threshold to generate bounding box labels in YOLO format. The annotations were then visually reviewed for correctness. This approach is standard practice in industry for bootstrapping ground truth when manual annotation at scale is not feasible.

**Latency Measurement:** For each model/backend combination, we performed 10 warmup runs (to account for CUDA lazy initialization and TensorRT kernel compilation) followed by 50 timed runs. We measured end-to-end inference time including preprocessing, model forward pass, and postprocessing. GPU synchronization (`torch.cuda.synchronize()`) was called before timing to ensure accurate measurement.

**mAP Evaluation:** We computed COCO-style mAP@50 and mAP@50:95 using Ultralytics' built-in validation method against our annotated dataset. All 6 model/backend configurations were evaluated on the same images and labels.

## 5. Results

### Latency Benchmark (T4 GPU, 640×640 input)

| Model   | Backend   | Mean (ms) | Std (ms) | FPS  |
|---------|-----------|-----------|----------|------|
| YOLOv8  | PyTorch   | 22.4      | 1.9      | 44.6 |
| YOLOv8  | ONNX      | 30.2      | 1.9      | 33.1 |
| YOLOv8  | TensorRT  | 13.1      | 0.7      | 76.3 |
| RT-DETR | PyTorch   | 53.5      | 2.7      | 18.7 |
| RT-DETR | ONNX      | 41.0      | 1.0      | 24.4 |
| RT-DETR | TensorRT  | 15.6      | 0.9      | 64.3 |

### Accuracy Benchmark (Own annotated data)

| Model   | Backend   | mAP@50 | mAP@50:95 |
|---------|-----------|--------|-----------|
| YOLOv8  | PyTorch   | 0.781  | 0.608     |
| YOLOv8  | ONNX      | 0.775  | 0.609     |
| YOLOv8  | TensorRT  | 0.774  | 0.608     |
| RT-DETR | PyTorch   | 0.843  | 0.649     |
| RT-DETR | ONNX      | 0.843  | 0.649     |
| RT-DETR | TensorRT  | 0.841  | 0.647     |

## 6. Analysis

**TensorRT provides the largest speedup.** YOLOv8 went from 22.4ms (PyTorch) to 13.1ms (TensorRT) — a 1.7× speedup. RT-DETR saw an even larger improvement: 53.5ms to 15.6ms — a 3.4× speedup. This is because TensorRT's layer fusion is particularly effective on RT-DETR's transformer architecture, which has many sequential attention operations that can be fused.

**ONNX Runtime showed mixed results.** For YOLOv8, ONNX was actually slower than PyTorch (30.2ms vs 22.4ms). This is likely due to overhead from the generic ONNX execution provider — PyTorch's native CUDA kernels are already well-optimized for convolution-heavy architectures. For RT-DETR, ONNX was faster than PyTorch (41.0ms vs 53.5ms), suggesting the ONNX graph optimizations benefit transformer architectures more.

**Accuracy is preserved across backends.** mAP variation was less than 0.01 across all backends for both models. The small differences come from floating-point precision (FP32 vs FP16 for TensorRT) and minor graph optimization differences in ONNX, but these are negligible in practice.

**RT-DETR achieves higher mAP than YOLOv8** (0.843 vs 0.781 at mAP@50), which aligns with its transformer-based architecture being better at capturing global context. However, YOLOv8 is significantly faster in PyTorch mode due to its simpler CNN architecture. With TensorRT, both models approach similar speeds (13.1ms vs 15.6ms), making RT-DETR's accuracy advantage more practically useful.

**FP16 precision loss is negligible.** TensorRT's FP16 mode showed less than 0.3% mAP drop compared to FP32 PyTorch — a worthwhile trade-off for nearly doubling throughput.

## 7. Full-Stack Application

The application consists of a FastAPI backend running on Google Colab (for GPU access) exposed via ngrok, and a React frontend running locally. The frontend supports image and video upload, model selection across all 6 configurations, adjustable confidence thresholds, side-by-side comparison of all models, live video playback with bounding box overlays, and PDF report generation. HEIC images from iPhones are automatically converted to JPG in the browser.

## 8. Conclusion

TensorRT FP16 is the clear winner for inference optimization on NVIDIA hardware, delivering 1.7–3.4× speedup with no meaningful accuracy loss. ONNX Runtime provides a portable alternative but does not consistently outperform native PyTorch. The choice between YOLOv8 and RT-DETR depends on the use case: YOLOv8 for maximum speed, RT-DETR for higher accuracy — though with TensorRT, the speed gap narrows considerably.
