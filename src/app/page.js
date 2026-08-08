"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Home() {
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

  // Format Jam Indonesia saat ini
  const formatCurrentTimestamp = () => {
    return `${new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    })} WIB`;
  };

  // Helper Formatting & Parsing Tanggal
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
    if (val instanceof Date && !isNaN(val)) {
      return val.toLocaleDateString("id-ID");
    }
    if (typeof val === "number" && val > 30000 && val < 60000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toLocaleDateString("id-ID");
    }
    return String(val).trim();
  };

  const calculateStatus = (jatuhtempoVal, tglSelesaiVal) => {
    if (tglSelesaiVal && tglSelesaiVal !== "-" && tglSelesaiVal !== "") {
      return "GREEN";
    }

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
    for (const p of possibleKeys) {
      const matchedKey = keys.find((k) =>
        k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(p.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      if (matchedKey && rowObj[matchedKey] !== undefined && String(rowObj[matchedKey]).trim() !== "") {
        return rowObj[matchedKey];
      }
    }
    return undefined;
  };

  const generateAggregations = (list) => {
    const layananMap = {};
    const jabatanMap = {};

    list.forEach((item) => {
      const lay = item.namaKegiatan !== "-" ? item.namaKegiatan : "Layanan Lainnya";
      if (!layananMap[lay]) layananMap[lay] = { kategori: lay, jumlah: 0, sesuai: 0, hampir: 0, sudah: 0 };
      layananMap[lay].jumlah += 1;
      if (item.status === "GREEN") layananMap[lay].sesuai += 1;
      else if (item.status === "YELLOW") layananMap[lay].hampir += 1;
      else if (item.status === "RED") layananMap[lay].sudah += 1;

      const jab = item.jabatan !== "-" ? item.jabatan : "Petugas / Posisi Lain";
      if (!jabatanMap[jab]) jabatanMap[jab] = { kategori: jab, jumlah: 0, sesuai: 0, hampir: 0, sudah: 0 };
      jabatanMap[jab].jumlah += 1;
      if (item.status === "GREEN") jabatanMap[jab].sesuai += 1;
      else if (item.status === "YELLOW") jabatanMap[jab].hampir += 1;
      else if (item.status === "RED") jabatanMap[jab].sudah += 1;
    });

    setDataLayanan(Object.values(layananMap));
    setDataJabatan(Object.values(jabatanMap));
  };

  const processExcelData = useCallback((rows) => {
    const rincianList = [];

    rows.forEach((row) => {
      const nomor = getFieldValue(row, ["Nomor_Berkas", "No_Berkas", "Nomor", "NoBerkas"]);
      const tahun = getFieldValue(row, ["Tahun_Berkas", "Tahun"]);
      const tglTerdaftar = getFieldValue(row, ["Tanggal_Terdaftar", "Tgl_Terdaftar", "Terdaftar"]);
      const jatuhtempo = getFieldValue(row, ["Jatuh_Tempo", "Jatuhtempo", "Tempo"]);
      const tglSelesai = getFieldValue(row, ["Tanggal_Selesai", "Tgl_Selesai", "Selesai"]);
      const tglDiserahkan = getFieldValue(row, ["Tanggal_Diserahkan", "Tgl_Diserahkan", "Dikirim"]);
      
      const rawKegiatan = getFieldValue(row, ["Nama_Kegiatan", "Nama_Layanan", "Kegiatan", "Layanan"]);
      const rawPosisi = getFieldValue(row, [
        "Posisi_Terakhir", 
        "Posisi_Berkas", 
        "Nama_Petugas", 
        "Petugas_Terakhir", 
        "Nama_Jabatan", 
        "Jabatan", 
        "Petugas"
        "Petugas Ukur"
      ]);

      let fullNoBerkas = formatValue(nomor);
      if (tahun && String(nomor) !== "-" && String(tahun) !== "-") {
        fullNoBerkas = `${nomor}/${tahun}`;
      }

      let cleanedKegiatan = formatValue(rawKegiatan);
      let cleanedPosisi = formatValue(rawPosisi);

      if (
        cleanedPosisi.toLowerCase() === "pengukuran dan pemetaan kadastral" ||
        cleanedPosisi.toLowerCase() === "pengukuran dan pemetaan kadastral"
      ) {
        cleanedPosisi = "-";
      }

      if (fullNoBerkas !== "-") {
        const computedStatus = calculateStatus(jatuhtempo, tglSelesai);

        rincianList.push({
          noBerkas: fullNoBerkas,
          tglTerdaftar: formatValue(tglTerdaftar),
          tglDikirim: formatValue(tglDiserahkan),
          jatuhtempo: formatValue(jatuhtempo),
          tglSelesai: formatValue(tglSelesai),
          namaKegiatan: cleanedKegiatan,
          namaPemohon: formatValue(getFieldValue(row, ["Nama_Pemohon", "Pemohon"])),
          status: computedStatus,
          jabatan: cleanedPosisi,
        });
      }
    });

    setDataRincian(rincianList);
    generateAggregations(rincianList);
    setCurrentPage(1);
  }, []);

  const processAndSetData = useCallback((rawJsonData, sourceName) => {
    if (!Array.isArray(rawJsonData) || rawJsonData.length === 0) return;

    setFileName(sourceName);
    localStorage.setItem("atr_bpn_file_name", sourceName);

    processExcelData(rawJsonData);
  }, [processExcelData]);

  // AUTO-LOAD WEB DATA PADA INITIAL RENDER & REFRESH
  useEffect(() => {
    const fetchDataAuto = async () => {
      const savedFileName = localStorage.getItem("atr_bpn_file_name");
      const savedTimestamp = localStorage.getItem("atr_bpn_last_updated");

      if (savedTimestamp) setLastUpdated(savedTimestamp);
      if (savedFileName) setFileName(savedFileName);

      try {
        const res = await fetch(`/api/ingest?t=${Date.now()}`); // Bypass HTTP Cache
        const result = await res.json();
        
        if (result.success && result.data && result.data.length > 0) {
          processAndSetData(result.data, savedFileName || "Auto-Sync Web ATR/BPN");

          // Update timestamp jika server menyajikan lastUpdated
          if (result.lastUpdated) {
            setLastUpdated(result.lastUpdated);
            localStorage.setItem("atr_bpn_last_updated", result.lastUpdated);
          }
        }
      } catch (err) {
        console.error("Gagal mengambil data otomatis:", err);
      }
    };

    fetchDataAuto();
  }, [processAndSetData]);

  // UPLOAD FILE MANUAL (EXCEL / JSON)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const newTimestamp = formatCurrentTimestamp();
    setLastUpdated(newTimestamp);
    localStorage.setItem("atr_bpn_last_updated", newTimestamp);

    const isJson = file.name.endsWith(".json");

    if (isJson) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsedData = JSON.parse(evt.target.result);
          const dataArray = Array.isArray(parsedData) ? parsedData : parsedData.data || [];
          processAndSetData(dataArray, file.name);
        } catch (err) {
          alert("Gagal membaca file JSON. Pastikan format file benar.");
        }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];

        const rawDataJson = XLSX.utils.sheet_to_json(ws, { defval: "" });
        processAndSetData(rawDataJson, file.name);
      };
      reader.readAsBinaryString(file);
    }
  };

  // Metrics KPI
  const totalBerkas = dataRincian.length;
  const totalSesuai = dataRincian.filter((i) => i.status === "GREEN").length;
  const totalHampir = dataRincian.filter((i) => i.status === "YELLOW").length;
  const totalSudah = dataRincian.filter((i) => i.status === "RED").length;

  const pctSesuai = totalBerkas > 0 ? Math.round((totalSesuai / totalBerkas) * 100) : 0;
  const pctHampir = totalBerkas > 0 ? Math.round((totalHampir / totalBerkas) * 100) : 0;
  const pctSudah = totalBerkas > 0 ? Math.round((totalSudah / totalBerkas) * 100) : 0;

  // Filtered & Paginated Table Data
  const filteredRincian = useMemo(() => {
    return dataRincian.filter((item) => {
      let matchesFilter = true;
      if (selectedFilter === "sesuai") matchesFilter = item.status === "GREEN";
      if (selectedFilter === "hampir") matchesFilter = item.status === "YELLOW";
      if (selectedFilter === "sudah") matchesFilter = item.status === "RED";

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        item.noBerkas.toLowerCase().includes(q) ||
        item.namaPemohon.toLowerCase().includes(q) ||
        item.namaKegiatan.toLowerCase().includes(q) ||
        item.jabatan.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [dataRincian, selectedFilter, searchQuery]);

  const totalPages = Math.ceil(filteredRincian.length / itemsPerPage) || 1;
  const paginatedRincian = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRincian.slice(start, start + itemsPerPage);
  }, [filteredRincian, currentPage]);

  // Chart Layanan
  const chartDataLayanan = {
    labels: dataLayanan.map((item) => item.kategori),
    datasets: [
      { label: "Aman (GREEN)", data: dataLayanan.map((item) => item.sesuai), backgroundColor: "#10b981", borderRadius: 4 },
      { label: "Hari H (YELLOW)", data: dataLayanan.map((item) => item.hampir), backgroundColor: "#f59e0b", borderRadius: 4 },
      { label: "Terlambat (RED)", data: dataLayanan.map((item) => item.sudah), backgroundColor: "#ef4444", borderRadius: 4 },
    ],
  };

  const chartOptionsLayanan = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, grid: { color: "#f1f5f9" } },
      y: { stacked: true, grid: { display: false } },
    },
    plugins: {
      legend: { position: "top" },
    },
  };

  // Chart Bottleneck Posisi Terakhir
  const topRedJabatan = useMemo(() => {
    return [...dataJabatan]
      .filter((j) => j.sudah > 0)
      .sort((a, b) => b.sudah - a.sudah)
      .slice(0, 5);
  }, [dataJabatan]);

  const chartDataJabatan = {
    labels: topRedJabatan.map((item) => item.kategori),
    datasets: [
      { label: "Berkas Terlambat (RED)", data: topRedJabatan.map((item) => item.sudah), backgroundColor: "#dc2626", borderRadius: 4 },
    ],
  };

  const chartOptionsJabatan = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { color: "#f1f5f9" } },
      y: { grid: { display: false } },
    },
  };

  const getStatusBadge = (status) => {
    if (status === "GREEN") {
      return (
        <span style={{ backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }}></span> GREEN
        </span>
      );
    }
    if (status === "YELLOW") {
      return (
        <span style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#f59e0b" }}></span> YELLOW
        </span>
      );
    }
    return (
      <span style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ef4444" }}></span> RED
      </span>
    );
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", padding: "32px 20px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        
        {/* CSS Cetak Multi-Halaman */}
        <style jsx global>{`
          @media print {
            body, html { 
              background: white !important; 
              padding: 0 !important; 
              margin: 0 !important;
              height: auto !important;
              overflow: visible !important;
            }
            .no-print { display: none !important; }
            .print-container { 
              width: 100% !important; 
              max-width: 100% !important; 
              overflow: visible !important; 
              position: static !important;
            }
            .card-box { 
              box-shadow: none !important; 
              border: 1px solid #cbd5e1 !important; 
              overflow: visible !important;
              page-break-inside: auto;
            }
            .table-responsive-wrapper {
              overflow: visible !important;
              height: auto !important;
            }
            table { 
              page-break-inside: auto;
              width: 100% !important;
            }
            tr { 
              page-break-inside: avoid; 
              page-break-after: auto;
            }
            thead { 
              display: table-header-group; 
            }
          }
        `}</style>

        {/* Header Dashboard */}
        <header style={{ marginBottom: "28px", backgroundColor: "#0f172a", color: "white", padding: "28px 32px", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.25)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ display: "inline-block", backgroundColor: "#1e293b", color: "#38bdf8", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" }}>
                Sistem Informasi Pertanahan
              </div>
              {lastUpdated && (
                <div style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }}></span>
                  Last Update: {lastUpdated}
                </div>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", letterSpacing: "-0.5px" }}>Dashboard Eksekutif Monitoring Tunggakan Berkas</h1>
            <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "15px" }}>Kantor Pertanahan Kabupaten Kotawaringin Barat</p>
          </div>

          <div className="no-print" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => window.print()}
              style={{
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                padding: "10px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              🖨️ Cetak Laporan PDF
            </button>

            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "10px 16px", borderRadius: "12px" }}>
              <label style={{ display: "block", fontSize: "11px", color: "#cbd5e1", marginBottom: "4px", fontWeight: "600" }}>
                📤 Upload Excel / JSON (Back Office)
              </label>
              <input type="file" accept=".xlsx, .xls, .json" onChange={handleFileUpload} style={{ fontSize: "11px", color: "#94a3b8" }} />
              {fileName && (
                <div style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#38bdf8", fontWeight: "500" }}>
                  <p style={{ margin: 0 }}>✓ File dimuat: {fileName}</p>
                  {lastUpdated && <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "10px" }}>🕒 Sync: {lastUpdated}</p>}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Card KPI Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "28px" }}>
          
          <div 
            onClick={() => { setSelectedFilter("semua"); setCurrentPage(1); }}
            className="card-box"
            style={{ 
              backgroundColor: "white", padding: "22px", borderRadius: "14px", border: selectedFilter === "semua" ? "2px solid #2563eb" : "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", cursor: "pointer"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "13px", fontWeight: "600" }}>
              <span>Total Berkas</span>
              <span>📦</span>
            </div>
            <h2 style={{ margin: "10px 0 8px 0", fontSize: "32px", fontWeight: "800", color: "#0f172a" }}>{totalBerkas}</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>Semua berkas yang terdata</p>
          </div>

          <div 
            onClick={() => { setSelectedFilter("sesuai"); setCurrentPage(1); }}
            className="card-box"
            style={{ 
              backgroundColor: "white", padding: "22px", borderRadius: "14px", border: selectedFilter === "sesuai" ? "2px solid #10b981" : "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", cursor: "pointer"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "#047857", fontSize: "13px", fontWeight: "600" }}>
              <span>Belum Jatuh Tempo (GREEN)</span>
              <span>🟢</span>
            </div>
            <h2 style={{ margin: "10px 0 8px 0", fontSize: "32px", fontWeight: "800", color: "#059669" }}>{totalSesuai}</h2>
            <div style={{ width: "100%", backgroundColor: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${pctSesuai}%`, backgroundColor: "#10b981", height: "100%" }}></div>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>{pctSesuai}% dari total berkas</p>
          </div>

          <div 
            onClick={() => { setSelectedFilter("hampir"); setCurrentPage(1); }}
            className="card-box"
            style={{ 
              backgroundColor: "white", padding: "22px", borderRadius: "14px", border: selectedFilter === "hampir" ? "2px solid #f59e0b" : "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", cursor: "pointer"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309", fontSize: "13px", fontWeight: "600" }}>
              <span>Hampir Jatuh Tempo (YELLOW)</span>
              <span>🟡</span>
            </div>
            <h2 style={{ margin: "10px 0 8px 0", fontSize: "32px", fontWeight: "800", color: "#d97706" }}>{totalHampir}</h2>
            <div style={{ width: "100%", backgroundColor: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${pctHampir}%`, backgroundColor: "#f59e0b", height: "100%" }}></div>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>{pctHampir}% jatuh tempo hari ini</p>
          </div>

          <div 
            onClick={() => { setSelectedFilter("sudah"); setCurrentPage(1); }}
            className="card-box"
            style={{ 
              backgroundColor: "white", padding: "22px", borderRadius: "14px", border: selectedFilter === "sudah" ? "2px solid #ef4444" : "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", cursor: "pointer"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "#b91c1c", fontSize: "13px", fontWeight: "600" }}>
              <span>Terlambat (RED)</span>
              <span>🔴</span>
            </div>
            <h2 style={{ margin: "10px 0 8px 0", fontSize: "32px", fontWeight: "800", color: "#dc2626" }}>{totalSudah}</h2>
            <div style={{ width: "100%", backgroundColor: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${pctSudah}%`, backgroundColor: "#ef4444", height: "100%" }}></div>
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#64748b" }}>{pctSudah}% melebihi jatuh tempo</p>
          </div>

        </div>

        {/* Visualisasi Grafik */}
        {dataLayanan.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: topRedJabatan.length > 0 ? "2fr 1fr" : "1fr", gap: "20px", marginBottom: "28px" }}>
            
            <div className="card-box" style={{ backgroundColor: "white", padding: "24px", borderRadius: "14px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", color: "#0f172a", fontWeight: "700" }}>📊 Grafik Status per Jenis Layanan</h3>
              <div style={{ height: "300px" }}>
                <Bar data={chartDataLayanan} options={chartOptionsLayanan} />
              </div>
            </div>

            {topRedJabatan.length > 0 && (
              <div className="card-box" style={{ backgroundColor: "white", padding: "24px", borderRadius: "14px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", color: "#991b1b", fontWeight: "700" }}>⚠️ Top Bottleneck</h3>
                <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#64748b" }}>Petugas dengan berkas RED terbanyak</p>
                <div style={{ height: "240px" }}>
                  <Bar data={chartDataJabatan} options={chartOptionsJabatan} />
                </div>
              </div>
            )}

          </div>
        )}

        {/* Tabel Data */}
        <div className="card-box print-container" style={{ backgroundColor: "white", borderRadius: "14px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e2e8f0" }}>
          
          <div className="no-print" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
            
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[
                { id: "semua", label: "Semua Berkas" },
                { id: "sesuai", label: "🟢 GREEN (Aman)" },
                { id: "hampir", label: "🟡 YELLOW (Hari H)" },
                { id: "sudah", label: "🔴 RED (Terlambat)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setSelectedFilter(tab.id); setCurrentPage(1); }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    border: "1px solid",
                    borderColor: selectedFilter === tab.id ? "#2563eb" : "#cbd5e1",
                    backgroundColor: selectedFilter === tab.id ? "#eff6ff" : "white",
                    color: selectedFilter === tab.id ? "#1d4ed8" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="🔍 Cari No Berkas, Pemohon, Layanan, Posisi..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{
                padding: "8px 14px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "13px",
                minWidth: "280px",
                outline: "none"
              }}
            />
          </div>

          <div className="table-responsive-wrapper">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", color: "#334155" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "14px 16px", textAlign: "center", width: "40px", color: "#1e3a8a", fontWeight: "700" }}>#</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#1e3a8a", fontWeight: "700" }}>Nomor Berkas</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#1e3a8a", fontWeight: "700" }}>Tgl Terdaftar</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#1e3a8a", fontWeight: "700" }}>Jatuh Tempo</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#1e3a8a", fontWeight: "700" }}>Tgl Selesai</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#1e3a8a", fontWeight: "700" }}>Nama Kegiatan</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#1e3a8a", fontWeight: "700" }}>Nama Pemohon</th>
                  <th style={{ padding: "14px 16px", textAlign: "left", color: "#1e3a8a", fontWeight: "700" }}>Posisi Terakhir</th>
                  <th style={{ padding: "14px 16px", textAlign: "center", color: "#1e3a8a", fontWeight: "700" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRincian.length > 0 ? (
                  paginatedRincian.map((row, idx) => (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: "1px solid #f1f5f9",
                        backgroundColor: idx % 2 === 0 ? "white" : "#f8fafc"
                      }}
                    >
                      <td style={{ padding: "12px 16px", textAlign: "center", color: "#94a3b8", fontWeight: "600" }}>
                        {(currentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: "700", color: "#1d4ed8" }}>{row.noBerkas}</td>
                      <td style={{ padding: "12px 16px" }}>{row.tglTerdaftar}</td>
                      <td style={{ padding: "12px 16px", fontWeight: "600" }}>{row.jatuhtempo}</td>
                      <td style={{ padding: "12px 16px" }}>{row.tglSelesai}</td>
                      <td style={{ padding: "12px 16px", fontWeight: "500" }}>{row.namaKegiatan}</td>
                      <td style={{ padding: "12px 16px", fontWeight: "600", textTransform: "uppercase" }}>{row.namaPemohon}</td>
                      <td style={{ padding: "12px 16px", color: "#475569", fontWeight: "500" }}>{row.jabatan}</td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {getStatusBadge(row.status)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                      {dataRincian.length === 0 
                        ? "Memuat data..." 
                        : "Tidak ditemukan data yang cocok dengan kriteria filter"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Navigasi Pagination */}
          {filteredRincian.length > itemsPerPage && (
            <div className="no-print" style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRincian.length)} dari {filteredRincian.length} berkas
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: currentPage === 1 ? "#f1f5f9" : "white",
                    color: currentPage === 1 ? "#94a3b8" : "#334155",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontSize: "12px"
                  }}
                >
                  ← Sebelumnya
                </button>
                <span style={{ padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#1e293b" }}>
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: currentPage === totalPages ? "#f1f5f9" : "white",
                    color: currentPage === totalPages ? "#94a3b8" : "#334155",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    fontSize: "12px"
                  }}
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}