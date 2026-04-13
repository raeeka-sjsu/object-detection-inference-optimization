import { useRef, useEffect, useState } from "react";

const COLORS = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
  "#FF9F40", "#FF6384", "#C9CBCF", "#7BC043", "#F44336",
];

function VideoPlayer({ videoFile, videoResults }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const fps = videoResults?.video_fps || 30;
  const frames = videoResults?.frames || [];

  useEffect(() => {
    if (!videoFile || !videoRef.current) return;
    const url = URL.createObjectURL(videoFile);
    videoRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [videoFile]);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const draw = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.paused || video.ended) {
        setPlaying(false);
        return;
      }

      const ctx = canvas.getContext("2d");

      // Match canvas resolution to actual video element size
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Account for object-fit:contain — video might have black bars
      const videoAspect = video.videoWidth / video.videoHeight;
      const containerAspect = rect.width / rect.height;
      let offsetX = 0, offsetY = 0, drawW = rect.width, drawH = rect.height;
      if (videoAspect > containerAspect) {
        drawH = rect.width / videoAspect;
        offsetY = (rect.height - drawH) / 2;
      } else {
        drawW = rect.height * videoAspect;
        offsetX = (rect.width - drawW) / 2;
      }

      const currentFrame = Math.floor(video.currentTime * fps);
      const frameData = frames.length > 0
        ? frames.reduce((closest, f) =>
            Math.abs(f.frame - currentFrame) < Math.abs(closest.frame - currentFrame) ? f : closest,
            frames[0])
        : null;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (frameData && frameData.detections) {
        const scaleX = drawW / (video.videoWidth || 1);
        const scaleY = drawH / (video.videoHeight || 1);

        frameData.detections.forEach((det) => {
          const [x1, y1, x2, y2] = det.bbox;
          const sx = x1 * scaleX + offsetX;
          const sy = y1 * scaleY + offsetY;
          const sw = (x2 - x1) * scaleX;
          const sh = (y2 - y1) * scaleY;
          const color = COLORS[det.class_id % COLORS.length];

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(sx, sy, sw, sh);

          // Draw label — push below top edge if it would be clipped
          const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
          ctx.font = "bold 12px sans-serif";
          const tw = ctx.measureText(label).width;
          const labelY = sy < 20 ? sy + 16 : sy - 4;
          const bgY = sy < 20 ? sy + 1 : sy - 18;
          ctx.fillStyle = color;
          ctx.fillRect(sx, bgY, tw + 6, 18);
          ctx.fillStyle = "#fff";
          ctx.fillText(label, sx + 3, labelY);
        });

        // Frame counter
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(4, 4, 140, 22);
        ctx.fillStyle = "#fff";
        ctx.font = "12px monospace";
        ctx.fillText(`Frame ${currentFrame} · ${frameData.detections.length} obj`, 8, 19);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, frames, fps]);

  const handlePlay = () => { videoRef.current?.play(); setPlaying(true); };
  const handlePause = () => { videoRef.current?.pause(); setPlaying(false); };

  if (!videoFile) return null;

  return (
    <div className="card">
      <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
        <video ref={videoRef}
          style={{ width: "100%", maxHeight: 500, borderRadius: 6, objectFit: "contain", background: "#000" }}
          muted playsInline controls onEnded={() => setPlaying(false)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
        <canvas ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      </div>

      {frames.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
          <button className="btn btn-green" onClick={playing ? handlePause : handlePlay}
            style={{ padding: "8px 18px", fontSize: "0.85rem" }}>
            {playing ? "⏸ Pause" : "▶ Play with Detections"}
          </button>
          <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
            {frames.length} frames analyzed across {videoResults?.total_frames_in_video} total · avg {videoResults?.avg_latency_ms?.toFixed(1)} ms/frame
          </span>
        </div>
      )}

      {!frames.length && (
        <p style={{ color: "#9ca3af", textAlign: "center", marginTop: 12, fontSize: "0.85rem" }}>
          Click "Detect Video" to analyze frames
        </p>
      )}
    </div>
  );
}

export default VideoPlayer;
