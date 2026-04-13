function ModelSelector({ models, selected, onChange }) {
  return (
    <select value={selected} onChange={(e) => onChange(e.target.value)}>
      {models.map((m) => (
        <option key={m.key} value={m.key}>
          {m.key.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

export default ModelSelector;
