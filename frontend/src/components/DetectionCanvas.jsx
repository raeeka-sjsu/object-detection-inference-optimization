import { useRef, useEffect } from "react";

const COLORS = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
  "#FF9F40", "#FF6384", "#C9CBCF", "#7BC043", "#F44336",
];

function DetectionCanvas({ imageSrc, detections, imageSize }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = canvas.parentElement.clientWidth;
      const scale = Math.min(maxWidth / img.width, 600 / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (!detections || !detections.length || !imageSize) return;

      const scaleX = canvas.width / (imageSize.width || 1);
      const scaleY = canvas.height / (imageSize.height || 1);

      detections.forEach((det) => {
        const [x1, y1, x2, y2] = det.bbox;
        const sx1 = x1 * scaleX;
        const sy1 = y1 * scaleY;
        const sw = (x2 - x1) * scaleX;
        const sh = (y2 - y1) * scaleY;

        const color = COLORS[det.class_id % COLORS.length];

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx1, sy1, sw, sh);

        const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
        ctx.font = "bold 13px sans-serif";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = color;
        ctx.fillRect(sx1, sy1 - 20, textWidth + 8, 20);

        ctx.fillStyle = "#fff";
        ctx.fillText(label, sx1 + 4, sy1 - 5);
      });
    };
    img.src = imageSrc;
  }, [imageSrc, detections, imageSize]);

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        minHeight: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {imageSrc ? (
        <canvas ref={canvasRef} style={{ maxWidth: "100%" }} />
      ) : (
        <p style={{ color: "#999" }}>Upload an image to get started</p>
      )}
    </div>
  );
}

export default DetectionCanvas;
