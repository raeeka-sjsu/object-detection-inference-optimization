function ResultsPanel({ detections }) {
  if (!detections.length) return null;
  return (
    <div className="card" style={{ maxHeight: 380, overflowY: "auto" }}>
      <h3 style={{ fontSize: "0.72rem", color: "#9b8ec4", marginBottom: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        Detections ({detections.length})
      </h3>
      <table>
        <thead>
          <tr><th>Class</th><th>Conf</th><th>BBox</th></tr>
        </thead>
        <tbody>
          {detections.map((det, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 600 }}>{det.class_name}</td>
              <td style={{ color: "#5db8a3" }}>{(det.confidence * 100).toFixed(1)}%</td>
              <td style={{ color: "#b5b0c0", fontSize: "0.7rem", fontFamily: "monospace" }}>
                [{det.bbox.map(v => Math.round(v)).join(", ")}]
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default ResultsPanel;
