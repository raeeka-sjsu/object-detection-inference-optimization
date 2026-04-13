function LatencyDisplay({ latency, model, detectionCount }) {
  if (latency === null) return null;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: "0.72rem", color: "#9b8ec4", marginBottom: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        Inference Stats
      </h3>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#9b8ec4" }}>{latency.toFixed(1)}</div>
          <div style={{ fontSize: "0.7rem", color: "#a5a0b5", fontWeight: 500 }}>ms</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#5db8a3" }}>{(1000 / latency).toFixed(1)}</div>
          <div style={{ fontSize: "0.7rem", color: "#a5a0b5", fontWeight: 500 }}>FPS</div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e8a065" }}>{detectionCount}</div>
          <div style={{ fontSize: "0.7rem", color: "#a5a0b5", fontWeight: 500 }}>objects</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: "0.7rem", color: "#b5b0c0", textAlign: "center" }}>
        {model.replace(/_/g, " ")}
      </div>
    </div>
  );
}
export default LatencyDisplay;
