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
import "leaflet/dist/leaflet.css";

// Dynamic Import Leaflet untuk Server-Side Rendering (Next.js)
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Koordinat Pusat (Default: Kotawaringin Barat / Pangkalan Bun)
const CENTER_LAT = -2.6833;
const CENTER_LNG = 111.6167;

export default function GEOTASDashboard() {
  const [dataRincian, setDataRincian] = useState([]);
  const [dataJabatan, setDataJabatan] = useState([]);
  const [dataLayanan, setDataLayanan] = useState([]);
  const [fileName, setFileName] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("semua");
  const [basemap, setBasemap] = useState("osm"); // 'osm' | 'satellite'

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
        const date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
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
      return new Date(Math.round((val - 25569) * 86400 * 1000)).toLocaleDateString("id-ID");
    }
    return String(val).replace(/\s+/g, " ").trim();
  };

  const calculateStatus = (jatuhtempoVal, tglSelesaiVal) => {
    if (tglSelesaiVal && tglSelesaiVal !== "-" && tglSelesaiVal !== "") return "GREEN";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseDate(jatuhtempoVal);
    if (!dueDate) return "GREEN";
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return "GREEN";
    if (diffDays === 0) return "YELLOW";
    return "RED";
  };

  const getFieldValue = (rowObj, possibleKeys) => {
    const keys = Object.keys(rowObj);
    for (const p of possibleKeys) {
      const exactKey = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === p.toLowerCase().replace(/[^a-z0-9]/g, ""));
      if (exactKey && rowObj[exactKey] !== undefined && String(rowObj[exactKey]).trim() !== "") return rowObj[exactKey];
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

      const jab = item.jabatan !== "-" ? item.jabatan.trim() : "Petugas Lain";
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
    rows.forEach((row, idx) => {
      const nomor = getFieldValue(row, ["Nomor_Berkas", "No_Berkas", "Nomor", "NoBerkas"]);
      const tahun = getFieldValue(row, ["Tahun_Berkas", "Tahun"]);
      const tglTerdaftar = getFieldValue(row, ["Tanggal_Terdaftar", "Tgl_Terdaftar", "Terdaftar"]);
      const jatuhtempo = getFieldValue(row, ["Jatuh_Tempo", "Jatuhtempo", "Tempo"]);
      const tglSelesai = getFieldValue(row, ["Tanggal_Selesai", "Tgl_Selesai", "Selesai"]);
      const rawKegiatan = getFieldValue(row, ["Nama_Kegiatan", "Nama_Layanan", "Kegiatan", "Layanan"]);
      const rawPosisi = getFieldValue(row, ["Petugas_Ukur", "Petugas", "Nama_Jabatan", "Jabatan", "Posisi_Berkas"]);

      // Koordinat Asli atau Fallback Simulasi Geospasial GEOTAS
      let latVal = parseFloat(getFieldValue(row, ["Latitude", "Lat", "Y"]));
      let lngVal = parseFloat(getFieldValue(row, ["Longitude", "Lng", "Long", "X"]));

      if (isNaN(latVal) || latVal === 0) {
        latVal = CENTER_LAT + (Math.sin(idx * 7) * 0.08);
      }
      if (isNaN(lngVal) || lngVal === 0) {
        lngVal = CENTER_LNG + (Math.cos(idx * 7) * 0.08);
      }

      let fullNoBerkas = formatValue(nomor);
      if (tahun && String(nomor) !== "-" && String(tahun) !== "-") fullNoBerkas = `${nomor}/${tahun}`;

      if (fullNoBerkas !== "-") {
        rincianList.push({
          noBerkas: fullNoBerkas,
          tglTerdaftar: formatValue(tglTerdaftar),
          jatuhtempo: formatValue(jatuhtempo),
          tglSelesai: formatValue(tglSelesai),
          namaKegiatan: formatValue(rawKegiatan),
          namaPemohon: formatValue(getFieldValue(row, ["Nama_Pemohon", "Pemohon"])),
          status: calculateStatus(jatuhtempo, tglSelesai),
          jabatan: formatValue(rawPosisi),
          lat: latVal,
          lng: lngVal,
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
    if (typeof window !== "undefined") localStorage.setItem("atr_bpn_file_name", sourceName);
    processExcelData(rawJsonData);
  }, [processExcelData]);

  useEffect(() => {
    const fetchDataAuto = async () => {
      const savedFileName = localStorage.getItem("atr_bpn_file_name");
      const savedTimestamp = localStorage.getItem("atr_bpn_last_updated");
      if (savedTimestamp) setLastUpdated(savedTimestamp);
      if (savedFileName) setFileName(savedFileName);

      try {
        const res = await fetch(`/api/ingest?t=${Date.now()}`);
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
          processAndSetData(result.data, savedFileName || "Auto-Sync Web ATR/BPN");
          if (result.lastUpdated) {
            setLastUpdated(result.lastUpdated);
            localStorage.setItem("atr_bpn_last_updated", result.lastUpdated);
          }
        }
      } catch (err) {
        console.error("Autosync Error:", err);
      }
    };
    fetchDataAuto();
  }, [processAndSetData]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const nowStr = `${new Date().toLocaleString("id-ID")} WIB`;
    setLastUpdated(nowStr);
    localStorage.setItem("atr_bpn_last_updated", nowStr);

    const reader = new FileReader();
    if (file.name.endsWith(".json")) {
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          processAndSetData(Array.isArray(parsed) ? parsed : parsed.data || [], file.name);
        } catch (err) { alert("Format JSON tidak valid"); }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        processAndSetData(XLSX.utils.sheet_to_json(ws, { defval: "" }), file.name);
      };
      reader.readAsBinaryString(file);
    }
  };

  const totalBerkas = dataRincian.length;
  const totalSesuai = dataRincian.filter((i) => i.status === "GREEN").length;
  const totalHampir = dataRincian.filter((i) => i.status === "YELLOW").length;
  const totalSudah = dataRincian.filter((i) => i.status === "RED").length;

  const filteredRincian = useMemo(() => {
    return dataRincian.filter((item) => {
      let matchFilter = true;
      if (selectedFilter === "sesuai") matchFilter = item.status === "GREEN";
      if (selectedFilter === "hampir") matchFilter = item.status === "YELLOW";
      if (selectedFilter === "sudah") matchFilter = item.status === "RED";

      const q = searchQuery.toLowerCase();
      const matchSearch =
        item.noBerkas.toLowerCase().includes(q) ||
        item.namaPemohon.toLowerCase().includes(q) ||
        item.namaKegiatan.toLowerCase().includes(q) ||
        item.jabatan.toLowerCase().includes(q);

      return matchFilter && matchSearch;
    });
  }, [dataRincian, selectedFilter, searchQuery]);

  const paginatedRincian = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRincian.slice(start, start + itemsPerPage);
  }, [filteredRincian, currentPage]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header Utama GEOTAS */}
      <header style={{ borderBottom: "1px solid #1e293b", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#020617" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ backgroundColor: "#2563eb", padding: "8px 12px", borderRadius: "8px", fontWeight: "900", fontSize: "18px", letterSpacing: "1px" }}>
            GEOTAS
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Geospatial Online Tracking System</h1>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>Kantor Pertanahan Kabupaten Kotawaringin Barat</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>
            {lastUpdated && <span>Sync: <b style={{ color: "#38bdf8" }}>{lastUpdated}</b></span>}
          </div>
          <label style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>
            📤 Upload Excel/JSON
            <input type="file" accept=".xlsx, .xls, .json" onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
        </div>
      </header>

      <div style={{ padding: "20px", maxWidth: "1600px", margin: "0 auto" }}>
        
        {/* KPI Ringkasan Status GEOTAS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          {[
            { id: "semua", label: "TOTAL BERKAS", val: totalBerkas, color: "#38bdf8" },
            { id: "sesuai", label: "AMAN (GREEN)", val: totalSesuai, color: "#10b981" },
            { id: "hampir", label: "HARI H (YELLOW)", val: totalHampir, color: "#f59e0b" },
            { id: "sudah", label: "TERLAMBAT (RED)", val: totalSudah, color: "#ef4444" },
          ].map((kpi) => (
            <div
              key={kpi.id}
              onClick={() => { setSelectedFilter(kpi.id); setCurrentPage(1); }}
              style={{
                backgroundColor: "#1e293b",
                padding: "16px",
                borderRadius: "10px",
                border: selectedFilter === kpi.id ? `2px solid ${kpi.color}` : "1px solid #334155",
                cursor: "pointer"
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8" }}>{kpi.label}</div>
              <div style={{ fontSize: "28px", fontWeight: "800", color: kpi.color, marginTop: "4px" }}>{kpi.val}</div>
            </div>
          ))}
        </div>

        {/* --- PANEL PETA GEOTAS INTERAKTIF --- */}
        <div style={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "1px solid #334155", padding: "16px", marginBottom: "20px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🗺️</span>
              <h3 style={{ margin: 0, fontSize: "15px", color: "#f8fafc" }}>Peta Sebaran Persil & Berkas Pertanahan</h3>
            </div>

            {/* Control Basemap Switcher (GEOTAS Feature) */}
            <div style={{ display: "flex", gap: "6px", backgroundColor: "#0f172a", padding: "4px", borderRadius: "6px", border: "1px solid #334155" }}>
              <button
                onClick={() => setBasemap("osm")}
                style={{
                  backgroundColor: basemap === "osm" ? "#2563eb" : "transparent",
                  color: "white", border: "none", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", cursor: "pointer"
                }}
              >
                Peta Jalan
              </button>
              <button
                onClick={() => setBasemap("satellite")}
                style={{
                  backgroundColor: basemap === "satellite" ? "#2563eb" : "transparent",
                  color: "white", border: "none", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", cursor: "pointer"
                }}
              >
                Satelit / Citra
              </button>
            </div>
          </div>

          <div style={{ height: "480px", width: "100%", borderRadius: "8px", overflow: "hidden" }}>
            {typeof window !== "undefined" && (
              <MapContainer center={[CENTER_LAT, CENTER_LNG]} zoom={11} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  url={
                    basemap === "satellite"
                      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  }
                  attribution="&copy; ESRI / OpenStreetMap / ATR BPN GEOTAS"
                />
                {filteredRincian.map((item, idx) => {
                  const color = item.status === "GREEN" ? "#10b981" : item.status === "YELLOW" ? "#f59e0b" : "#ef4444";
                  return (
                    <CircleMarker
                      key={idx}
                      center={[item.lat, item.lng]}
                      radius={7}
                      pathOptions={{ fillColor: color, color: "#ffffff", weight: 1.5, fillOpacity: 0.9 }}
                    >
                      <Popup>
                        <div style={{ color: "#0f172a", fontSize: "12px", fontFamily: "sans-serif" }}>
                          <strong style={{ color: "#2563eb" }}>No Berkas: {item.noBerkas}</strong><br />
                          <b>Pemohon:</b> {item.namaPemohon}<br />
                          <b>Kegiatan:</b> {item.namaKegiatan}<br />
                          <b>Posisi:</b> {item.jabatan}<br />
                          <b>Status:</b> <span style={{ color, fontWeight: "bold" }}>{item.status}</span>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            )}
          </div>
        </div>

        {/* Tabel Monitoring GEOTAS */}
        <div style={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "1px solid #334155", overflow: "hidden" }}>
          <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #334155" }}>
            <input
              type="text"
              placeholder="🔍 Cari No Berkas, Pemohon, Petugas..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{
                backgroundColor: "#0f172a", border: "1px solid #334155", color: "white", padding: "8px 12px", borderRadius: "6px", fontSize: "13px", minWidth: "300px"
              }}
            />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#cbd5e1" }}>
            <thead>
              <tr style={{ backgroundColor: "#0f172a", textTransform: "uppercase", fontSize: "11px", color: "#94a3b8" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>No Berkas</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Tgl Terdaftar</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Jatuh Tempo</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Kegiatan</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Pemohon</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Posisi / Petugas</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRincian.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #334155" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "700", color: "#38bdf8" }}>{row.noBerkas}</td>
                  <td style={{ padding: "12px 16px" }}>{row.tglTerdaftar}</td>
                  <td style={{ padding: "12px 16px" }}>{row.jatuhtempo}</td>
                  <td style={{ padding: "12px 16px" }}>{row.namaKegiatan}</td>
                  <td style={{ padding: "12px 16px" }}>{row.namaPemohon}</td>
                  <td style={{ padding: "12px 16px" }}>{row.jabatan}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{
                      padding: "4px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: "700",
                      backgroundColor: row.status === "GREEN" ? "#064e3b" : row.status === "YELLOW" ? "#78350f" : "#7f1d1d",
                      color: row.status === "GREEN" ? "#6ee7b7" : row.status === "YELLOW" ? "#fde047" : "#fca5a5",
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
    </div>
  );
}