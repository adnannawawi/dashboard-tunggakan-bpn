"use client";

export default function SelesaiView() {
  return (
    <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
      <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", color: "#0f172a", fontWeight: "700" }}>✅ Selesai</h2>
      <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 20px 0" }}>Arsip dan daftar berkas yang prosesnya telah rampung sepenuhnya.</p>
      
      <div style={{ padding: "30px", border: "2px dashed #cbd5e1", borderRadius: "10px", textAlign: "center", color: "#64748b" }}>
        Daftar berkas selesai akan diletakkan di sini.
      </div>
    </div>
  );
}