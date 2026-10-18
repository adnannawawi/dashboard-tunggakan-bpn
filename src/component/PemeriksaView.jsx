"use client";

export default function PemeriksaView({ dataRincian }) {
  return (
    <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", color: "#0f172a", fontWeight: "700" }}>🔍 Pemeriksaan Berkas Pra-Entry</h2>
          <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Saring dan validasi berkas sebelum masuk ke sistem utama.</p>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
            <th style={{ padding: "12px", textAlign: "left" }}>#</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Nomor Berkas</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Nama Pemohon</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Kegiatan</th>
            <th style={{ padding: "12px", textAlign: "center" }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {dataRincian.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "12px" }}>{idx + 1}</td>
              <td style={{ padding: "12px", fontWeight: "700", color: "#2563eb" }}>{row.noBerkas}</td>
              <td style={{ padding: "12px" }}>{row.namaPemohon}</td>
              <td style={{ padding: "12px" }}>{row.namaKegiatan}</td>
              <td style={{ padding: "12px", textAlign: "center" }}>
                <button style={{ backgroundColor: "#10b981", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", marginRight: "6px" }}>✔ Verifikasi</button>
                <button style={{ backgroundColor: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer" }}>✖ Tolak</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}