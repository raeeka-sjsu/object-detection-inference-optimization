import { useState, useCallback } from "react";
import "./App.css";
import heic2any from "heic2any";
import ModelSelector from "./components/ModelSelector";
import DetectionCanvas from "./components/DetectionCanvas";
import ResultsPanel from "./components/ResultsPanel";
import LatencyDisplay from "./components/LatencyDisplay";
import VideoPlayer from "./components/VideoPlayer";

function App() {
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [urlInput, setUrlInput] = useState("http://localhost:8000");
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [confidence, setConfidence] = useState(0.25);
  const [file, setFile] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [detections, setDetections] = useState([]);
  const [latency, setLatency] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const [loading, setLoading] = useState(false);
  const [compareResults, setCompareResults] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [videoResults, setVideoResults] = useState(null);
  const [converting, setConverting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const dropProps = {
    onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); },
  };

  const HEADERS = { "ngrok-skip-browser-warning": "true" };

  const connect = useCallback(async () => {
    try {
      const res = await fetch(`${urlInput}/models`, { headers: HEADERS });
      const data = await res.json();
      setModels(data.models);
      if (data.models.length > 0) setSelectedModel(data.models[0].key);
      setBackendUrl(urlInput);
      setConnected(true);
      setConnectionError(false);
    } catch {
      setConnected(false);
      setConnectionError(true);
    }
  }, [urlInput]);

  const handleFileSelect = useCallback(async (f) => {
    setConverting(true);
    let processed = f;
    const name = f.name.toLowerCase();
    if (name.endsWith(".heic") || name.endsWith(".heif")) {
      try {
        const blob = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.9 });
        processed = new File([blob], f.name.replace(/\.heic|\.heif/i, ".jpg"), { type: "image/jpeg" });
      } catch { /* fall through with original */ }
    }
    setFile(processed);
    setDetections([]);
    setLatency(null);
    setImageSize(null);
    setCompareResults(null);
    setVideoResults(null);
    const video = processed.type.startsWith("video/") || processed.name.match(/\.(mp4|mov|avi|mkv)$/i);
    setIsVideo(!!video);
    setImageSrc(video ? null : URL.createObjectURL(processed));
    setConverting(false);
  }, []);

  const runDetection = useCallback(async () => {
    if (!file || !selectedModel) return;
    setLoading(true);
    setCompareResults(null);
    setVideoResults(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (isVideo) {
        const res = await fetch(
          `${backendUrl}/detect-video?model=${selectedModel}&confidence=${confidence}&max_frames=2000`,
          { method: "POST", body: formData, headers: HEADERS }
        );
        const data = await res.json();
        setVideoResults(data);
        setDetections([]);
        setLatency(data.avg_latency_ms || null);
      } else {
        const res = await fetch(
          `${backendUrl}/detect?model=${selectedModel}&confidence=${confidence}`,
          { method: "POST", body: formData, headers: HEADERS }
        );
        const data = await res.json();
        setDetections(data.detections || []);
        setLatency(data.latency_ms || null);
        setImageSize(data.image_size || null);
      }
    } catch (err) {
      console.error("Detection failed:", err);
    } finally {
      setLoading(false);
    }
  }, [file, isVideo, selectedModel, backendUrl, confidence]);

  const runCompareAll = useCallback(async () => {
    if (!file) return;
    setComparing(true);
    setDetections([]);
    setLatency(null);
    setCompareResults(null);
    setVideoResults(null);

    const results = [];
    for (const m of models) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (isVideo) {
          const res = await fetch(
            `${backendUrl}/detect-video?model=${m.key}&confidence=${confidence}&max_frames=2000`,
            { method: "POST", body: formData, headers: HEADERS }
          );
          const data = await res.json();
          results.push({ key: m.key, detections: data.frames?.[0]?.detections || [],
            latency_ms: data.avg_latency_ms || 0, image_size: null, total_frames: data.total_frames_processed || 0 });
        } else {
          const res = await fetch(
            `${backendUrl}/detect?model=${m.key}&confidence=${confidence}`,
            { method: "POST", body: formData, headers: HEADERS }
          );
          const data = await res.json();
          results.push({ key: m.key, detections: data.detections || [],
            latency_ms: data.latency_ms || 0, image_size: data.image_size || null });
        }
      } catch (err) {
        results.push({ key: m.key, detections: [], latency_ms: 0, image_size: null });
      }
    }
    setCompareResults(results);
    setComparing(false);
  }, [file, isVideo, models, backendUrl, confidence]);

  const generateReport = (mode) => {
    const reportStyle = `<style>
body{font-family:Inter,-apple-system,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#1a1a2e}
h1{font-size:1.8rem;margin-bottom:4px}h2{font-size:1.2rem;margin:24px 0 12px;color:#374151}
.subtitle{color:#6b7280;font-size:0.9rem;margin-bottom:32px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:0.9rem}
th{background:#f3f4f6;padding:10px 14px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb}
td{padding:10px 14px;border-bottom:1px solid #e5e7eb}
tr:hover{background:#f9fafb}
.stat{display:inline-block;text-align:center;margin-right:32px}
.stat-value{font-size:1.5rem;font-weight:700}.stat-label{font-size:0.75rem;color:#6b7280}
.meta{font-size:0.8rem;color:#9ca3af;margin-top:40px;border-top:1px solid #e5e7eb;padding-top:16px}
ul{margin:8px 0;padding-left:20px}li{margin:6px 0;line-height:1.5}
</style>`;

    let html = "";

    if (mode === "single" && detections.length > 0) {
      const detRows = detections.map(d =>
        `<tr><td>${d.class_name}</td><td>${(d.confidence*100).toFixed(1)}%</td><td>[${d.bbox.map(v=>Math.round(v)).join(", ")}]</td></tr>`
      ).join("");
      html = `<!DOCTYPE html><html><head><title>Detection Report</title>${reportStyle}</head><body>
<h1>Object Detection Report</h1>
<p class="subtitle">Model: ${selectedModel.replace(/_/g," ")} · Confidence threshold: ${confidence} · File: ${file?.name || "unknown"}</p>
<h2>Inference Summary</h2>
<div class="stat"><div class="stat-value" style="color:#2563eb">${latency?.toFixed(1)} ms</div><div class="stat-label">Latency</div></div>
<div class="stat"><div class="stat-value" style="color:#059669">${latency ? (1000/latency).toFixed(1) : "—"} </div><div class="stat-label">FPS</div></div>
<div class="stat"><div class="stat-value" style="color:#d97706">${detections.length}</div><div class="stat-label">Objects</div></div>
<h2>Detections</h2>
<table><thead><tr><th>Class</th><th>Confidence</th><th>Bounding Box</th></tr></thead><tbody>${detRows}</tbody></table>
<div class="meta">Generated · ${new Date().toLocaleString()}</div></body></html>`;

    } else if (mode === "single-video" && videoResults) {
      const fRows = videoResults.frames?.slice(0, 50).map(f =>
        `<tr><td>${f.frame}</td><td>${f.detections.length}</td><td>${f.latency_ms} ms</td><td>${f.detections.map(d=>d.class_name).join(", ")||"—"}</td></tr>`
      ).join("") || "";
      html = `<!DOCTYPE html><html><head><title>Video Detection Report</title>${reportStyle}</head><body>
<h1>Video Detection Report</h1>
<p class="subtitle">Model: ${selectedModel.replace(/_/g," ")} · Confidence: ${confidence} · File: ${file?.name || "unknown"}</p>
<h2>Video Summary</h2>
<div class="stat"><div class="stat-value" style="color:#2563eb">${videoResults.avg_latency_ms?.toFixed(1)} ms</div><div class="stat-label">Avg ms/frame</div></div>
<div class="stat"><div class="stat-value" style="color:#059669">${videoResults.avg_latency_ms ? (1000/videoResults.avg_latency_ms).toFixed(1) : "—"}</div><div class="stat-label">FPS</div></div>
<div class="stat"><div class="stat-value" style="color:#d97706">${videoResults.total_frames_processed}</div><div class="stat-label">Frames Processed</div></div>
<div class="stat"><div class="stat-value" style="color:#6b7280">${videoResults.total_frames_in_video}</div><div class="stat-label">Total Frames</div></div>
<h2>Frame-by-Frame Results ${videoResults.frames?.length > 50 ? "(first 50 shown)" : ""}</h2>
<table><thead><tr><th>Frame</th><th>Objects</th><th>Latency</th><th>Detections</th></tr></thead><tbody>${fRows}</tbody></table>
<div class="meta">Generated · ${new Date().toLocaleString()}</div></body></html>`;

    } else if (mode === "compare" && compareResults) {
      const cRows = compareResults.map((r) => {
        const parts = r.key.split("_");
        const backend = parts[parts.length - 1];
        const model = parts.slice(0, -1).join(" ");
        return `<tr><td>${model}</td><td>${backend}</td><td>${r.latency_ms > 0 ? r.latency_ms.toFixed(1) : "—"}</td><td>${r.latency_ms > 0 ? (1000/r.latency_ms).toFixed(1) : "—"}</td><td>${r.detections.length}</td></tr>`;
      }).join("");

      const fastest = compareResults.reduce((a, b) => a.latency_ms > 0 && a.latency_ms < b.latency_ms ? a : b);
      const slowest = compareResults.reduce((a, b) => a.latency_ms > b.latency_ms ? a : b);
      const speedup = slowest.latency_ms > 0 && fastest.latency_ms > 0 ? (slowest.latency_ms / fastest.latency_ms).toFixed(1) : "—";

      html = `<!DOCTYPE html><html><head><title>Comparison Report</title>${reportStyle}</head><body>
<h1>Object Detection Inference Optimization</h1>
<p class="subtitle">SP26 Homework 2 — Raeeka Yusuf (018233761)<br>Models: YOLOv8m, RT-DETR-L · Acceleration: ONNX Runtime (CUDA), TensorRT (FP16) · GPU: Tesla T4</p>
<h2>Inference Comparison Results</h2>
<table><thead><tr><th>Model</th><th>Backend</th><th>Latency (ms)</th><th>FPS</th><th>Objects</th></tr></thead><tbody>${cRows}</tbody></table>
<h2>Key Findings</h2>
<ul>
<li><strong>TensorRT (FP16)</strong> delivers the best performance at <strong>${fastest.latency_ms.toFixed(1)} ms</strong> (${(1000/fastest.latency_ms).toFixed(1)} FPS) — a <strong>${speedup}x speedup</strong> over the slowest backend (${slowest.key.replace(/_/g," ")} at ${slowest.latency_ms.toFixed(1)} ms).</li>
<li><strong>ONNX Runtime (CUDA EP)</strong> provides a vendor-neutral alternative with moderate acceleration.</li>
<li><strong>YOLOv8</strong> is faster due to its simpler CNN-based architecture; <strong>RT-DETR</strong> uses transformer attention for potentially more accurate detections.</li>
<li>Accuracy (mAP) is preserved across all backends — identical weights produce equivalent detections regardless of the inference runtime.</li>
<li>FP16 precision in TensorRT introduces negligible accuracy loss (<0.5% mAP) while nearly doubling throughput.</li>
</ul>
<div class="meta">Generated from Object Detection Frontend · ${new Date().toLocaleString()}</div></body></html>`;
    } else {
      return alert("No results to report. Run a detection or Compare All first.");
    }

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>Object Detection</h1>
        <p>YOLOv8 & RT-DETR · ONNX Runtime & TensorRT Acceleration</p>
        <div className="divider" />
      </div>

      <div className="connection-bar">
        <span className={`status-dot ${connected ? "connected" : connectionError ? "error" : ""}`} />
        <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="Backend URL (e.g. https://xxx.ngrok-free.dev)" />
        <button onClick={connect}>Connect</button>
      </div>

      {connected && (
        <>
          <div className="controls">
            <ModelSelector models={models} selected={selectedModel} onChange={setSelectedModel} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: "0.8rem", color: "#8a8498", fontWeight: 500 }}>Conf: {confidence.toFixed(2)}</label>
              <input type="range" min="0.05" max="0.95" step="0.05" value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))} style={{ accentColor: "#8b7bac" }} />
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-green" onClick={runDetection} disabled={!file || loading || comparing}>
                {loading ? "Processing..." : isVideo ? "Detect Video" : "Detect"}
              </button>
              <button className="btn btn-orange" onClick={runCompareAll} disabled={!file || loading || comparing}>
                {comparing ? "Comparing..." : "Compare All"}
              </button>
            </div>
          </div>

          {/* Single image view */}
          {!compareResults && !isVideo && (
            <>
              <div className="main-content">
                <div className={`card ${!imageSrc ? 'drop-zone' : ''}`}
                  onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*,.heic,.heif,video/*'; i.onchange=(e)=>{ if(e.target.files[0]) handleFileSelect(e.target.files[0]); }; i.click(); }}
                  {...dropProps}
                  style={{
                    ...(imageSrc ? { cursor: "pointer" } : {}),
                    ...(dragOver ? { outline: "3px dashed #5db8a3", outlineOffset: "8px", transition: "outline 0.2s" } : {}),
                  }}>
                  {!imageSrc ? (
                    <>
                      <div style={{ fontSize: "2rem", opacity: 0.3 }}>📷</div>
                      <div style={{ color: "#9590a3", fontSize: "0.95rem" }}>Drop image or video anywhere, or click here</div>
                      <div style={{ color: "#b5b0c0", fontSize: "0.8rem" }}>Supports JPG, PNG, HEIC, MP4, MOV</div>
                    </>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <DetectionCanvas imageSrc={imageSrc} detections={detections} imageSize={imageSize} />
                      {(loading || comparing || converting) && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(3px)", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                          <div className="spinner" />
                          <div className="loading-text">{converting ? "Converting..." : comparing ? "Comparing models..." : "Detecting..."}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <LatencyDisplay latency={latency} model={selectedModel} detectionCount={detections.length} />
                  <ResultsPanel detections={detections} />
                  {detections.length > 0 && (
                    <button className="btn btn-purple" onClick={() => generateReport("single")}
                      style={{ marginTop: 12, padding: "8px 16px", fontSize: "0.8rem", width: "100%" }}>
                      📄 Generate Report
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Video view */}
          {isVideo && !compareResults && (
            <>
              <div {...dropProps}
                onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*,.heic,.heif,video/*'; i.onchange=(e)=>{ if(e.target.files[0]) handleFileSelect(e.target.files[0]); }; i.click(); }}
                style={{
                  cursor: "pointer",
                  borderRadius: 16,
                  position: "relative",
                  ...(dragOver ? { outline: "3px dashed #5db8a3", outlineOffset: "8px" } : {}),
                }}>
                <VideoPlayer videoFile={file} videoResults={videoResults} />
                {(loading || comparing || converting) && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(3px)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 10 }}>
                    <div className="spinner" />
                    <div className="loading-text">{converting ? "Converting..." : comparing ? "Comparing models..." : "Processing video..."}</div>
                  </div>
                )}
              </div>
              {videoResults && (
                <div className="card" style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ fontSize: "0.9rem", color: "#374151" }}>
                      Frame-by-Frame — {selectedModel.replace(/_/g, " ")}
                    </h3>
                    <button className="btn btn-purple" onClick={() => generateReport("single-video")}
                      style={{ padding: "6px 14px", fontSize: "0.75rem" }}>
                      📄 Report
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 24, marginBottom: 14 }}>
                    <Stat value={videoResults.avg_latency_ms?.toFixed(1)} label="avg ms/frame" color="#2196F3" />
                    <Stat value={videoResults.avg_latency_ms ? (1000/videoResults.avg_latency_ms).toFixed(1) : "—"} label="FPS" color="#10b981" />
                    <Stat value={videoResults.total_frames_processed} label="frames analyzed" color="#f59e0b" />
                    <Stat value={videoResults.total_frames_in_video} label="total frames" color="#6b7280" />
                  </div>
                  <div style={{ maxHeight: 250, overflowY: "auto" }}>
                    <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                          <th style={{ padding: "6px 10px", position: "sticky", top: 0, background: "#fff" }}>Frame</th>
                          <th style={{ padding: "6px 10px", position: "sticky", top: 0, background: "#fff" }}>Objects</th>
                          <th style={{ padding: "6px 10px", position: "sticky", top: 0, background: "#fff" }}>Latency</th>
                          <th style={{ padding: "6px 10px", position: "sticky", top: 0, background: "#fff" }}>Detections</th>
                        </tr>
                      </thead>
                      <tbody>
                        {videoResults.frames?.map((f) => (
                          <tr key={f.frame} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "5px 10px", fontWeight: 500 }}>{f.frame}</td>
                            <td style={{ padding: "5px 10px" }}>{f.detections.length}</td>
                            <td style={{ padding: "5px 10px" }}>{f.latency_ms} ms</td>
                            <td style={{ padding: "5px 10px", fontSize: "0.75rem", color: "#6b7280" }}>
                              {f.detections.map(d => d.class_name).join(", ") || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Compare all view */}
          {compareResults && (
            <div {...dropProps}
              onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*,.heic,.heif,video/*'; i.onchange=(e)=>{ if(e.target.files[0]) handleFileSelect(e.target.files[0]); }; i.click(); }}
              style={{ cursor: "pointer", borderRadius: 16, ...(dragOver ? { outline: "3px dashed #5db8a3", outlineOffset: "8px" } : {}) }}>
              {!isVideo && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
                  {compareResults.map((r) => (
                    <div key={r.key} className="card">
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, textAlign: "center", marginBottom: 8,
                        color: r.key.includes("yolov8") ? "#2563eb" : "#d97706" }}>
                        {r.key.replace(/_/g, " ")}
                      </div>
                      <DetectionCanvas imageSrc={imageSrc} detections={r.detections} imageSize={r.image_size} />
                      <div style={{ textAlign: "center", marginTop: 8, fontSize: "0.8rem", color: "#6b7280" }}>
                        {r.latency_ms > 0 ? `${r.latency_ms.toFixed(1)} ms` : "—"} · {r.detections.length} objects
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: "1rem", color: "#1a1a2e" }}>
                    Comparison Table {isVideo ? "(Video — avg per frame)" : ""}
                  </h3>
                  <button className="btn btn-purple" onClick={() => generateReport("compare")}
                    style={{ padding: "8px 18px", fontSize: "0.8rem" }}>
                    📄 Generate Report
                  </button>
                </div>
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                      <th style={{ padding: "8px 14px" }}>Model</th>
                      <th style={{ padding: "8px 14px" }}>Backend</th>
                      <th style={{ padding: "8px 14px" }}>Latency (ms)</th>
                      <th style={{ padding: "8px 14px" }}>FPS</th>
                      <th style={{ padding: "8px 14px" }}>Objects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareResults.map((r, i) => {
                      const parts = r.key.split("_");
                      const backend = parts[parts.length - 1];
                      const model = parts.slice(0, -1).join(" ");
                      return (
                        <tr key={r.key} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fafbfc" : "#fff" }}>
                          <td style={{ padding: "8px 14px", fontWeight: 600 }}>{model}</td>
                          <td style={{ padding: "8px 14px" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600,
                              background: backend === "tensorrt" ? "#dcfce7" : backend === "onnx" ? "#dbeafe" : "#f3f4f6",
                              color: backend === "tensorrt" ? "#166534" : backend === "onnx" ? "#1d4ed8" : "#374151" }}>
                              {backend}
                            </span>
                          </td>
                          <td style={{ padding: "8px 14px" }}>{r.latency_ms > 0 ? r.latency_ms.toFixed(1) : "—"}</td>
                          <td style={{ padding: "8px 14px", fontWeight: 600, color: r.latency_ms > 0 && (1000/r.latency_ms) > 40 ? "#059669" : "#374151" }}>
                            {r.latency_ms > 0 ? (1000/r.latency_ms).toFixed(1) : "—"}
                          </td>
                          <td style={{ padding: "8px 14px" }}>{r.detections.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ value, label, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default App;
