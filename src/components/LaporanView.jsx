"use client";

export default function LaporanView() {
  return (
    <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
      <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", color: "#0f172a", fontWeight: "700" }}>📈 Laporan</h2>
      <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 20px 0" }}>Pusat unduh laporan rekapitulasi kinerja dan statistik kantor.</p>
      
      <div style={{ padding: "30px", border: "2px dashed #cbd5e1", borderRadius: "10px", textAlign: "center", color: "#64748b" }}>
        Grafik tambahan dan format laporan berkala akan diletakkan di sini.
      </div>
    </div>
  );
}