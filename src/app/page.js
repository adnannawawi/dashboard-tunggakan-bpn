"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

// Import Leaflet secara Dynamic (SSR Disabled) untuk menghindari error 'window is not defined'
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const Polygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false }
);
const LayersControl = dynamic(
  () => import("react-leaflet").then((mod) => mod.LayersControl),
  { ssr: false }
);

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // State Dashboard
  const [dataRincian, setDataRincian] = useState([]);
  const [dataJabatan, setDataJabatan] = useState([]);
  const [dataLayanan, setDataLayanan] = useState([]);
  const [fileName, setFileName] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("semua");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Leaflet Fix Icon Import (Client Side Only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("leaflet").then((L) => {
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });
      });
    }
  }, []);

  // Format Jam
  const formatCurrentTimestamp = () => {
    return `${new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    })} WIB`;
  };

  const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) {
      val.setHours(0, 0, 0, 0);
      return val;
    }
    if (typeof val === "number") {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      date.setHours(0, 0, 0, 0);
      return date;
    }
    if (typeof val === "string") {
      const cleanVal = val.trim();
      const parts = cleanVal.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);
        return date;
      }
      const parsed = new Date(cleanVal);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    return null;
  };

  const formatValue = (val) => {
    if (val === undefined || val === null || val === "" || String(val).trim() === "") return "-";
    if (val instanceof Date && !isNaN(val)) return val.toLocaleDateString("id-ID");
    if (typeof val === "number" && val > 30000 && val < 60000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toLocaleDateString("id-ID");
    }
    return String(val).replace(/\s+/g, " ").trim();
  };

  const calculateStatus = (jatuhtempoVal, tglSelesaiVal) => {
    if (tglSelesaiVal && tglSelesaiVal !== "-" && tglSelesaiVal !== "") return "GREEN";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = parseDate(jatuhtempoVal);
    if (!dueDate) return "GREEN";

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return "GREEN";
    if (diffDays === 0) return "YELLOW";
    return "RED";
  };

  const getFieldValue = (rowObj, possibleKeys) => {
    const keys = Object.keys(rowObj);
    for (const p of possibleKeys) {
      const exactKey = keys.find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === p.toLowerCase().replace(/[^a-z0-9]/g, "")
      );
      if (exactKey && rowObj[exactKey] !== undefined && String(rowObj[exactKey]).trim() !== "") {
        return rowObj[exactKey];
      }
    }
    return undefined;
  };

  const generateAggregations = useCallback((list) => {
    const layananMap = {};
    const jabatanMap = {};

    list.forEach((item) => {
      const lay = item.namaKegiatan !== "-" ? item.namaKegiatan.trim() : "Layanan Lainnya";
      if (!layananMap[lay]) layananMap[lay] = { kategori: lay, jumlah: 0, sesuai: 0, hampir: 0, sudah: 0 };
      layananMap[lay].jumlah += 1;
      if (item.status === "GREEN") layananMap[lay].sesuai += 1;
      else if (item.status === "YELLOW") layananMap[lay].hampir += 1;
      else if (item.status === "RED") layananMap[lay].sudah += 1;

      const jab = item.jabatan !== "-" ? item.jabatan.trim() : "Petugas / Posisi Lain";
      if (!jabatanMap[jab]) jabatanMap[jab] = { kategori: jab, jumlah: 0, sesuai: 0, hampir: 0, sudah: 0 };
      jabatanMap[jab].jumlah += 1;
      if (item.status === "GREEN") jabatanMap[jab].sesuai += 1;
      else if (item.status === "YELLOW") jabatanMap[jab].hampir += 1;
      else if (item.status === "RED") jabatanMap[jab].sudah += 1;
    });

    setDataLayanan(Object.values(layananMap));
    setDataJabatan(Object.values(jabatanMap));
  }, []);

  const processExcelData = useCallback((rows) => {
    const rincianList = [];

    rows.forEach((row) => {
      const nomor = getFieldValue(row, ["Nomor_Berkas", "No_Berkas", "Nomor"]);
      const tahun = getFieldValue(row, ["Tahun_Berkas", "Tahun"]);
      const tglTerdaftar = getFieldValue(row, ["Tanggal_Terdaftar", "Tgl_Terdaftar"]);
      const jatuhtempo = getFieldValue(row, ["Jatuh_Tempo", "Jatuhtempo"]);
      const tglSelesai = getFieldValue(row, ["Tanggal_Selesai", "Tgl_Selesai"]);
      const tglDiserahkan = getFieldValue(row, ["Tanggal_Diserahkan", "Tgl_Diserahkan"]);
      const rawKegiatan = getFieldValue(row, ["Nama_Kegiatan", "Nama_Layanan", "Kegiatan"]);
      const rawPosisi = getFieldValue(row, ["Petugas_Ukur", "Petugas", "Nama_Jabatan", "Jabatan"]);

      let fullNoBerkas = formatValue(nomor);
      if (tahun && String(nomor) !== "-" && String(tahun) !== "-") {
        fullNoBerkas = `${nomor}/${tahun}`;
      }

      if (fullNoBerkas !== "-") {
        rincianList.push({
          noBerkas: fullNoBerkas,
          tglTerdaftar: formatValue(tglTerdaftar),
          tglDikirim: formatValue(tglDiserahkan),
          jatuhtempo: formatValue(jatuhtempo),
          tglSelesai: formatValue(tglSelesai),
          namaKegiatan: formatValue(rawKegiatan),
          namaPemohon: formatValue(getFieldValue(row, ["Nama_Pemohon", "Pemohon"])),
          status: calculateStatus(jatuhtempo, tglSelesai),
          jabatan: formatValue(rawPosisi),
        });
      }
    });

    setDataRincian(rincianList);
    generateAggregations(rincianList);
    setCurrentPage(1);
  }, [generateAggregations]);

  const processAndSetData = useCallback((rawJsonData, sourceName) => {
    if (!Array.isArray(rawJsonData) || rawJsonData.length === 0) return;
    setFileName(sourceName);
    processExcelData(rawJsonData);
  }, [processExcelData]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const newTimestamp = formatCurrentTimestamp();
    setLastUpdated(newTimestamp);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const workbook = XLSX.read(bstr, { type: "binary", cellDates: true });
      const ws = workbook.Sheets[workbook.SheetNames[0]];
      const rawDataJson = XLSX.utils.sheet_to_json(ws, { defval: "" });
      processAndSetData(rawDataJson, file.name);
    };
    reader.readAsBinaryString(file);
  };

  // KPI Computations
  const totalBerkas = dataRincian.length;
  const totalSesuai = dataRincian.filter((i) => i.status === "GREEN").length;
  const totalHampir = dataRincian.filter((i) => i.status === "YELLOW").length;
  const totalSudah = dataRincian.filter((i) => i.status === "RED").length;

  const pctSesuai = totalBerkas > 0 ? Math.round((totalSesuai / totalBerkas) * 100) : 0;
  const pctHampir = totalBerkas > 0 ? Math.round((totalHampir / totalBerkas) * 100) : 0;
  const pctSudah = totalBerkas > 0 ? Math.round((totalSudah / totalBerkas) * 100) : 0;

  const filteredRincian = useMemo(() => {
    return dataRincian.filter((item) => {
      let matchesFilter = true;
      if (selectedFilter === "sesuai") matchesFilter = item.status === "GREEN";
      if (selectedFilter === "hampir") matchesFilter = item.status === "YELLOW";
      if (selectedFilter === "sudah") matchesFilter = item.status === "RED";

      const q = searchQuery.toLowerCase();
      return matchesFilter && (
        item.noBerkas.toLowerCase().includes(q) ||
        item.namaPemohon.toLowerCase().includes(q) ||
        item.namaKegiatan.toLowerCase().includes(q) ||
        item.jabatan.toLowerCase().includes(q)
      );
    });
  }, [dataRincian, selectedFilter, searchQuery]);

  const totalPages = Math.ceil(filteredRincian.length / itemsPerPage) || 1;
  const paginatedRincian = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRincian.slice(start, start + itemsPerPage);
  }, [filteredRincian, currentPage]);

  // Sample Polygon & Points Data untuk Custom GIS
  const samplePolygonCoord = [
    [-2.6841, 111.6212],
    [-2.6855, 111.6235],
    [-2.6872, 111.6218],
    [-2.6860, 111.6198],
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", padding: "24px 20px", fontFamily: "'Inter', sans-serif" }}>
      {/* Import CSS Leaflet */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        
        {/* Navigation & Header */}
        <header style={{ marginBottom: "20px", backgroundColor: "#0f172a", color: "white", padding: "20px 28px", borderRadius: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ backgroundColor: "#1e293b", color: "#38bdf8", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                SI-PERTANAHAN KOBAR
              </span>
              {lastUpdated && <span style={{ fontSize: "11px", color: "#94a3b8" }}>Last Update: {lastUpdated}</span>}
            </div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>
              {activeTab === "dashboard" ? "Dashboard Monitoring Tunggakan Berkas" : "Custom GEOTAS - Web GIS Pertanahan"}
            </h1>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", backgroundColor: "#1e293b", padding: "4px", borderRadius: "10px" }}>
              <button
                onClick={() => setActiveTab("dashboard")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  border: "none",
                  backgroundColor: activeTab === "dashboard" ? "#2563eb" : "transparent",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setActiveTab("peta")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  border: "none",
                  backgroundColor: activeTab === "peta" ? "#2563eb" : "transparent",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                🗺️ Web GIS Custom
              </button>
            </div>

            <label style={{ backgroundColor: "#0284c7", color: "white", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
              📁 Import Excel
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>
          </div>
        </header>

        {/* TAB 1: DASHBOARD MONITORING */}
        {activeTab === "dashboard" && (
          <div>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>Total Berkas</span>
                <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: "800", color: "#0f172a" }}>{totalBerkas}</h2>
              </div>
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#059669", fontWeight: "600" }}>GREEN (Sesuai)</span>
                <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: "800", color: "#10b981" }}>{totalSesuai} ({pctSesuai}%)</h2>
              </div>
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#d97706", fontWeight: "600" }}>YELLOW (Jatuh Tempo Hari Ini)</span>
                <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: "800", color: "#f59e0b" }}>{totalHampir} ({pctHampir}%)</h2>
              </div>
              <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: "600" }}>RED (Terlambat)</span>
                <h2 style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: "800", color: "#ef4444" }}>{totalSudah} ({pctSudah}%)</h2>
              </div>
            </div>

            {/* Tabel Monitoring */}
            <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <input
                  type="text"
                  placeholder="🔍 Cari No Berkas / Pemohon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", width: "300px" }}
                />
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left", color: "#475569" }}>
                    <th style={{ padding: "12px 16px" }}>No Berkas</th>
                    <th style={{ padding: "12px 16px" }}>Tgl Terdaftar</th>
                    <th style={{ padding: "12px 16px" }}>Jatuh Tempo</th>
                    <th style={{ padding: "12px 16px" }}>Layanan</th>
                    <th style={{ padding: "12px 16px" }}>Pemohon</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRincian.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 16px", fontWeight: "700", color: "#2563eb" }}>{row.noBerkas}</td>
                      <td style={{ padding: "12px 16px" }}>{row.tglTerdaftar}</td>
                      <td style={{ padding: "12px 16px" }}>{row.jatuhtempo}</td>
                      <td style={{ padding: "12px 16px" }}>{row.namaKegiatan}</td>
                      <td style={{ padding: "12px 16px" }}>{row.namaPemohon}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700",
                          backgroundColor: row.status === "GREEN" ? "#d1fae5" : row.status === "YELLOW" ? "#fef3c7" : "#fee2e2",
                          color: row.status === "GREEN" ? "#065f46" : row.status === "YELLOW" ? "#92400e" : "#991b1b"
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOM WEB GIS (GEOTAS BUATAN SENDIRI) */}
        {activeTab === "peta" && (
          <div style={{ backgroundColor: "white", borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0", height: "calc(100vh - 160px)", position: "relative" }}>
            
            {/* Sidebar Kontrol Layer */}
            <div style={{ position: "absolute", top: "16px", right: "16px", zIndex: 1000, backgroundColor: "rgba(255, 255, 255, 0.95)", padding: "14px", borderRadius: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", width: "220px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#0f172a" }}>⚙️ Sidebar Web GIS</h4>
              <div style={{ fontSize: "12px", color: "#475569", display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="checkbox" defaultChecked /> Layer Persil BMN
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="checkbox" defaultChecked /> Titik Kantor Pertanahan
                </label>
                <hr style={{ margin: "4px 0", border: "none", borderTop: "1px solid #e2e8f0" }} />
                <button onClick={() => alert("Fitur Ukur Jarak Aktif")} style={{ padding: "6px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "11px" }}>
                  📏 Ukur Jarak / Luas
                </button>
              </div>
            </div>

            {/* Render Peta Leaflet Interactive */}
            <MapContainer
              center={[-2.685, 111.62]}
              zoom={14}
              style={{ width: "100%", height: "100%" }}
            >
              <LayersControl position="topleft">
                {/* Base Maps */}
                <LayersControl.BaseLayer checked name="OpenStreetMap">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>
                
                <LayersControl.BaseLayer name="Satelit Esri ArcGIS">
                  <TileLayer
                    attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                </LayersControl.BaseLayer>

                {/* Overlays Custom */}
                <LayersControl.Overlay checked name="Batas Persil / Polygon">
                  <Polygon
                    positions={samplePolygonCoord}
                    pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.4 }}
                  >
                    <Popup>
                      <div style={{ fontSize: "12px" }}>
                        <strong>Persil Aset BMN</strong><br />
                        No Hak: 00012/2026<br />
                        Luas: 1.250 m²<br />
                        Penggunaan: Kantor Pemerintah
                      </div>
                    </Popup>
                  </Polygon>
                </LayersControl.Overlay>

                <LayersControl.Overlay checked name="Titik Lokasi Kantah">
                  <Marker position={[-2.685, 111.62]}>
                    <Popup>
                      <div style={{ fontSize: "12px" }}>
                        <strong>Kantor Pertanahan Kab. Kotawaringin Barat</strong><br />
                        Jl. RM. Sedyatmo No. 12, Pangkalan Bun
                      </div>
                    </Popup>
                  </Marker>
                </LayersControl.Overlay>
              </LayersControl>
            </MapContainer>

          </div>
        )}

      </div>
    </div>
  );
}