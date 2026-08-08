"use client";

import { useState } from "react";

export default function Home() {
  const [dataTunggakan, setDataTunggakan] = useState([
    { id: 1, nomorBerkas: "BPN-2026-001", pemohon: "Budi Santoso", jenis: "Sertifikat Hak Milik (SHM)", status: "Proses", tanggal: "2026-06-10" },
    { id: 2, nomorBerkas: "BPN-2026-002", pemohon: "Siti Aminah", jenis: "Peningkatan Hak", status: "Tertunda", tanggal: "2026-05-15" },
    { id: 3, nomorBerkas: "BPN-2026-003", pemohon: "Ahmad Fauzi", jenis: "Pecah Sertifikat", status: "Selesai", tanggal: "2026-04-20" },
    { id: 4, nomorBerkas: "BPN-2026-004", pemohon: "Dewi Lestari", jenis: "Balik Nama", status: "Proses", tanggal: "2026-06-01" },
  ]);

  const [filterStatus, setFilterStatus] = useState("Semua");

  const filteredData = filterStatus === "Semua" 
    ? dataTunggakan 
    : dataTunggakan.filter(item => item.status === filterStatus);

  const totalBerkas = dataTunggakan.length;
  const totalSelesai = dataTunggakan.filter(i => i.status === "Selesai").length;
  const totalProses = dataTunggakan.filter(i => i.status === "Proses").length;
  const totalTertunda = dataTunggakan.filter(i => i.status === "Tertunda").length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", padding: "30px", fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        
        {/* Header */}
        <header style={{ marginBottom: "30px", backgroundColor: "#1e3a8a", color: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "24px" }}>Dashboard Monitoring Tunggakan Berkas BPN</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: "14px" }}>Sistem Pengelolaan dan Pemantauan Penyelesaian Berkas Pertanahan</p>
        </header>

        {/* Kartu Statistik */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "30px" }}>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #1e3a8a" }}>
            <p style={{ margin: "0 0 5px 0", color: "#6b7280", fontSize: "14px" }}>Total Berkas</p>
            <h2 style={{ margin: 0, fontSize: "28px", color: "#1f2937" }}>{totalBerkas}</h2>
          </div>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #3b82f6" }}>
            <p style={{ margin: "0 0 5px 0", color: "#6b7280", fontSize: "14px" }}>Sedang Proses</p>
            <h2 style={{ margin: 0, fontSize: "28px", color: "#3b82f6" }}>{totalProses}</h2>
          </div>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #10b981" }}>
            <p style={{ margin: "0 0 5px 0", color: "#6b7280", fontSize: "14px" }}>Selesai</p>
            <h2 style={{ margin: 0, fontSize: "28px", color: "#10b981" }}>{totalSelesai}</h2>
          </div>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #ef4444" }}>
            <p style={{ margin: "0 0 5px 0", color: "#6b7280", fontSize: "14px" }}>Tertunda / Kendala</p>
            <h2 style={{ margin: 0, fontSize: "28px", color: "#ef4444" }}>{totalTertunda}</h2>
          </div>
        </div>

        {/* Konten Tabel & Filter */}
        <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, color: "#374151" }}>Daftar Berkas Masuk</h3>
            
            {/* Filter Tombol */}
            <div style={{ display: "flex", gap: "8px" }}>
              {["Semua", "Proses", "Selesai", "Tertunda"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    backgroundColor: filterStatus === status ? "#1e3a8a" : "white",
                    color: filterStatus === status ? "white" : "#374151",
                    cursor: "pointer",
                    fontWeight: "500",
                    fontSize: "13px"
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Tabel Data */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb", color: "#4b5563" }}>
                  <th style={{ padding: "12px" }}>No. Berkas</th>
                  <th style={{ padding: "12px" }}>Nama Pemohon</th>
                  <th style={{ padding: "12px" }}>Jenis Layanan</th>
                  <th style={{ padding: "12px" }}>Tanggal Masuk</th>
                  <th style={{ padding: "12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "12px", fontWeight: "600", color: "#1f2937" }}>{item.nomorBerkas}</td>
                      <td style={{ padding: "12px" }}>{item.pemohon}</td>
                      <td style={{ padding: "12px" }}>{item.jenis}</td>
                      <td style={{ padding: "12px" }}>{item.tanggal}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "600",
                          backgroundColor: 
                            item.status === "Selesai" ? "#d1fae5" : 
                            item.status === "Proses" ? "#dbeafe" : "#fee2e2",
                          color: 
                            item.status === "Selesai" ? "#065f46" : 
                            item.status === "Proses" ? "#1e40af" : "#991b1b"
                        }}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
                      Tidak ada data untuk status ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}