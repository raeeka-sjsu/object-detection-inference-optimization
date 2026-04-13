import { useRef, useState } from "react";
import heic2any from "heic2any";

async function convertIfNeeded(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif")) {
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    return new File([blob], file.name.replace(/\.heic|\.heif/i, ".jpg"), { type: "image/jpeg" });
  }
  return file;
}

function FileUpload({ onFileSelect }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setConverting(true);
    try {
      const converted = await convertIfNeeded(file);
      onFileSelect(converted);
    } catch {
      onFileSelect(file);
    }
    setConverting(false);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current.click()}
      style={{
        padding: "8px 16px",
        background: dragging ? "#e3f2fd" : "#fff",
        border: dragging ? "2px dashed #2196F3" : "1px solid #ddd",
        borderRadius: 6, cursor: "pointer", fontSize: "0.9rem", transition: "all 0.2s",
      }}
    >
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif,video/mp4,video/mov,video/*"
        onChange={(e) => handleFile(e.target.files[0])} style={{ display: "none" }} />
      {converting ? "Converting..." : dragging ? "Drop here" : "Upload Image or Video"}
    </div>
  );
}

export default FileUpload;
