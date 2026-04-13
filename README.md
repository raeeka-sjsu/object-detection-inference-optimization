# Object Detection Inference Optimization

### CMPE 258 — SP26 Homework 2 (Option 2)
**Raeeka Yusuf — 018233761**

---

## Overview

A full-stack object detection application that compares inference performance across two models and three runtime backends on a Tesla T4 GPU.

| Component | Details |
|-----------|---------|
| **Models** | YOLOv8m (CNN-based), RT-DETR-L (Transformer-based) |
| **Acceleration** | ONNX Runtime (CUDA EP), TensorRT (FP16) |
| **Backend** | FastAPI running on Google Colab (T4 GPU) |
| **Frontend** | React + Vite (local) |
| **Tunnel** | ngrok (connects local frontend to Colab backend) |

## Architecture

```
React Frontend (localhost:5173)
        │
        ▼
  ngrok tunnel (HTTPS)
        │
        ▼
FastAPI Backend (Google Colab, T4 GPU)
   ├── YOLOv8m  × PyTorch / ONNX / TensorRT
   └── RT-DETR-L × PyTorch / ONNX / TensorRT
```

## Repository Structure

```
├── README.md
├── frontend/                  # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx            # Main app — detect, compare all, reports
│   │   └── components/
│   │       ├── DetectionCanvas.jsx   # Bounding box overlay on images
│   │       ├── VideoPlayer.jsx       # Video playback with live detections
│   │       ├── LatencyDisplay.jsx    # Inference stats (ms, FPS, objects)
│   │       ├── ResultsPanel.jsx      # Detection results table
│   │       └── ModelSelector.jsx     # Model dropdown
│   └── package.json
├── backend/
│   ├── main.py                # FastAPI server (/detect, /detect-video, /health, /models)
│   └── requirements.txt
├── notebooks/
│   └── object_detection_pipeline.ipynb   # Full pipeline: export, benchmark, annotate, serve
├── eval/
│   ├── evaluate.py            # mAP evaluation script
│   ├── annotations/           # YOLO-format ground truth labels
│   └── images/                # Test images
└── docs/
    ├── report.md              # Write-up with results and analysis
    ├── Comparison Report.pdf  # Generated comparison report
    └── Video Detection Report.pdf
```

## How to Run

### Prerequisites

- **Google Colab** with T4 GPU (Runtime → Change runtime type → T4 GPU)
- **Node.js** v20+ on your local machine
- **ngrok account** (free) — get an auth token at https://dashboard.ngrok.com/get-started/your-authtoken

### Step 1: Run the Colab Notebook

1. Upload `notebooks/object_detection_pipeline.ipynb` to Google Colab
2. Set runtime to **T4 GPU**
3. Run all cells in order:
   - **Part 0** — Mounts Google Drive and loads your images/video
   - **Part 1** — Loads YOLOv8m + RT-DETR-L, exports to ONNX and TensorRT (~15 min first time)
   - **Part 2** — Auto-annotates your images, creates ground truth labels
   - **Part 3** — Runs latency benchmarks and mAP evaluation across all 6 model/backend combos
   - **Part 4** — Video inference demo across all models
   - **Part 5** — Starts the FastAPI server with ngrok

4. After Part 5, you'll see a URL like `https://xxx.ngrok-free.dev` — copy this.

### Step 2: Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Step 3: Connect

1. Paste the ngrok URL into the connection bar
2. Press Enter or click **Connect** — green dot = connected
3. Upload an image or video (drag & drop or click the drop zone)
4. Select a model from the dropdown
5. Click **Detect** for single model or **Compare All** for all 6

### About ngrok

The backend runs on Google Colab because it requires an NVIDIA GPU (T4) for TensorRT inference. Since Colab isn't directly accessible from your local network, **ngrok** creates a secure HTTPS tunnel that routes requests from your browser to the Colab server.

Free tier limitations:
- Tunnel URL changes each session
- One tunnel at a time per account
- Occasional browser warning page on first visit (the frontend handles this with a skip-header)

### Quick Restart (Demo Notebook)

If the Colab runtime disconnects, use the mini demo notebook (3 cells):

1. Install dependencies + load models from Google Drive
2. Write `main.py` + start ngrok tunnel
3. Start FastAPI server

Model files are saved to Google Drive so no re-exporting is needed. **Note:** TensorRT engines are GPU-specific — if Colab assigns a different GPU type, the `.engine` files need to be re-exported.

## Frontend Features

- **Single Detection** — Upload image → select model → detect → see bounding boxes + latency
- **Compare All** — Runs all 6 model/backend combos on the same image, shows side-by-side results with comparison table
- **Video Detection** — Upload video → processes frames → plays video with live bounding box overlay
- **Generate Report** — PDF-ready reports for individual detections, video results, and full comparisons
- **Drag & Drop** — Drop images/videos anywhere on the page
- **HEIC Support** — iPhone photos (HEIC) are automatically converted to JPG
- **Confidence Slider** — Adjust detection threshold in real-time

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status and loaded models |
| `GET` | `/models` | List available model/backend configurations |
| `POST` | `/detect` | Image detection — returns bounding boxes + latency |
| `POST` | `/detect-video` | Video detection — returns per-frame detections + latency |

### Example: Image Detection

```bash
curl -X POST "https://xxx.ngrok-free.dev/detect?model=yolov8m_tensorrt&confidence=0.25" \
  -F "file=@photo.jpg"
```

Response:
```json
{
  "detections": [
    {"bbox": [100.5, 200.3, 400.1, 500.8], "confidence": 0.92, "class_id": 0, "class_name": "person"}
  ],
  "model": "yolov8m_tensorrt",
  "latency_ms": 17.6,
  "image_size": {"width": 1920, "height": 1080}
}
```
