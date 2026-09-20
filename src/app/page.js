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
  const [isPrinting, setIsPrinting] = useState(false); // State untuk mode cetak
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
    return String(val).replace(/\s+/g, " ").trim();
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
      const nomor = getFieldValue(row, ["Nomor_Berkas", "No_Berkas", "Nomor", "NoBerkas"]);
      const tahun = getFieldValue(row, ["Tahun_Berkas", "Tahun"]);
      const tglTerdaftar = getFieldValue(row, ["Tanggal_Terdaftar", "Tgl_Terdaftar", "Terdaftar"]);
      const jatuhtempo = getFieldValue(row, ["Jatuh_Tempo", "Jatuhtempo", "Tempo"]);
      const tglSelesai = getFieldValue(row, ["Tanggal_Selesai", "Tgl_Selesai", "Selesai"]);
      const tglDiserahkan = getFieldValue(row, ["Tanggal_Diserahkan", "Tgl_Diserahkan", "Dikirim"]);
      
      const rawKegiatan = getFieldValue(row, ["Nama_Kegiatan", "Nama_Layanan", "Kegiatan", "Layanan"]);
      const rawPosisi = getFieldValue(row, [
        "Petugas_Ukur", "PetugasUkur", "Nama_Petugas", "Petugas_Terakhir", 
        "Nama_Jabatan", "Jabatan", "Petugas", "Posisi_Terakhir", "Posisi_Berkas"
      ]);

      let fullNoBerkas = formatValue(nomor);
      if (tahun && String(nomor) !== "-" && String(tahun) !== "-") {
        fullNoBerkas = `${nomor}/${tahun}`;
      }

      let cleanedKegiatan = formatValue(rawKegiatan);
      let cleanedPosisi = formatValue(rawPosisi);

      if (cleanedKegiatan.includes("Pemetan")) {
        cleanedKegiatan = cleanedKegiatan.replace(/Pemetan/g, "Pemetaan");
      }
      if (cleanedPosisi.includes("Pemetan")) {
        cleanedPosisi = cleanedPosisi.replace(/Pemetan/g, "Pemetaan");
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
  }, [generateAggregations]);

  const processAndSetData = useCallback((rawJsonData, sourceName) => {
    if (!Array.isArray(rawJsonData) || rawJsonData.length === 0) return;
    setFileName(sourceName);
    if (typeof window !== "undefined") {
      localStorage.setItem("atr_bpn_file_name", sourceName);
    }
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
        console.error("Gagal mengambil data otomatis:", err);
      }
    };
    fetchDataAuto();
  }, [processAndSetData]);

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
          alert("Gagal membaca file JSON.");
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
      const matchesSearch =
        item.noBerkas.toLowerCase().includes(q) ||
        item.namaPemohon.toLowerCase().includes(q) ||
        item.namaKegiatan.toLowerCase().includes(q) ||
        item.jabatan.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [dataRincian, selectedFilter, searchQuery]);

  const totalPages = Math.ceil(filteredRincian.length / itemsPerPage) || 1;
  
  // Jika sedang mode cetak, tampilkan SELURUH data sekaligus tanpa dibatasi pagination per halaman
  const paginatedRincian = useMemo(() => {
    if (isPrinting) return filteredRincian;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRincian.slice(start, start + itemsPerPage);
  }, [filteredRincian, currentPage, isPrinting, itemsPerPage]);

  const handlePrintPdf = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 400); // Beri jeda render agar DOM tabel memuat semua baris data sebelum dialog cetak terbuka
  };

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
    plugins: { legend: { position: "top" } },
  };

  const topRedJabatan = useMemo(() => {
    return [...dataJabatan]
      .filter((j) => j.sudah > 0)
      .sort((a, b) => b.sudah - a.sudah)
      .slice(0, 10);
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
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: "#f1f5f9" } },
      y: { grid: { display: false } },
    },
  };

  const getStatusBadge = (status) => {
    if (status === "GREEN") {
      return (
        <span style={{ backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0", padding: "3px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700" }}>
          GREEN
        </span>
      );
    }
    if (status === "YELLOW") {
      return (
        <span style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "3px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700" }}>
          YELLOW
        </span>
      );
    }
    return (
      <span style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", padding: "3px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700" }}>
        RED
      </span>
    );
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", padding: "32px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        
        {/* CSS Khusus Cetak agar Tabel & Header Terulang Rapi di Tiap Halaman Kertas */}
        <style jsx global>{`
          @media print {
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            body, html {
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              font-size: 11px !important;
              color: #000 !important;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            th, td {
              padding: 6px 8px !important;
              font-size: 10px !important;
              border-bottom: 1px solid #cbd5e1 !important;
            }
          }
        `}</style>

        {/* Header Dashboard */}
        <header style={{ marginBottom: "28px", backgroundColor: "#0f172a", color: "white", padding: "28px 32px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#38bdf8", marginBottom: "8px", fontWeight: "600" }}>Sistem Informasi Pertanahan (GEOTAS)</div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>Dashboard Eksekutif Monitoring Tunggakan Berkas</h1>
            <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "15px" }}>Kantor Pertanahan Kabupaten Kotawaringin Barat</p>
          </div>

          <div className="no-print" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handlePrintPdf}
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
                📤 Upload Excel / JSON
              </label>
              <input type="file" accept=".xlsx, .xls, .json" onChange={handleFileUpload} style={{ fontSize: "11px", color: "#94a3b8" }} />
              {fileName && <div style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#38bdf8" }}>✓ File: {fileName}</div>}
            </div>
          </div>
        </header>

        {/* Statistik KPI */}
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "28px" }}>
          <div onClick={() => { setSelectedFilter("semua"); setCurrentPage(1); }} style={{ backgroundColor: "white", padding: "22px", borderRadius: "14px", border: selectedFilter === "semua" ? "2px solid #2563eb" : "1px solid #e2e8f0", cursor: "pointer" }}>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: "600" }}>Total Berkas</div>
            <h2 style={{ margin: "10px 0 8px 0", fontSize: "32px", fontWeight: "800", color: "#0f172a" }}>{totalBerkas}</h2>
          </div>
          <div onClick={() => { setSelectedFilter("sesuai"); setCurrentPage(1); }} style={{ backgroundColor: "white", padding: "22px", borderRadius: "14px", border: selectedFilter === "sesuai" ? "2px solid #10b981" : "1px solid #e2e8f0", cursor: "pointer" }}>
            <div style={{ color: "#047857", fontSize: "13px", fontWeight: "600" }}>GREEN (Aman)</div>
            <h2 style={{ margin: "10px 0 8px 0", fontSize: "32px", fontWeight: "800", color: "#059669" }}>{totalSesuai}</h2>
          </div>
          <div onClick={() => { setSelectedFilter("hampir"); setCurrentPage(1); }} style={{ backgroundColor: "white", padding: "22px", borderRadius: "14px", border: selectedFilter === "hampir" ? "2px solid #f59e0b" : "1px solid #e2e8f0", cursor: "pointer" }}>
            <div style={{ color: "#b45309", fontSize: "13px", fontWeight: "600" }}>YELLOW (Hari H)</div>
            <h2 style={{ margin: "10px 0 8px 0", fontSize: "32px", fontWeight: "800", color: "#d97706" }}>{totalHampir}</h2>
          </div>
          <div onClick={() => { setSelectedFilter("sudah"); setCurrentPage(1); }} style={{ backgroundColor: "white", padding: "22px", borderRadius: "14px", border: selectedFilter === "sudah" ? "2px solid #ef4444" : "1px solid #e2e8f0", cursor: "pointer" }}>
            <div style={{ color: "#b91c1c", fontSize: "13px", fontWeight: "600" }}>RED (Terlambat)</div>
            <h2 style={{ margin: "10px 0 8px 0", fontSize: "32px", fontWeight: "800", color: "#dc2626" }}>{totalSudah}</h2>
          </div>
        </div>

        {/* Grafik */}
        {dataLayanan.length > 0 && (
          <div className="no-print" style={{ display: "grid", gridTemplateColumns: topRedJabatan.length > 0 ? "2fr 1fr" : "1fr", gap: "20px", marginBottom: "28px" }}>
            <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "14px", border: "1px solid #e2e8f0", height: "350px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", color: "#0f172a" }}>📊 Grafik Status per Jenis Layanan</h3>
              <div style={{ height: "270px" }}>
                <Bar data={chartDataLayanan} options={chartOptionsLayanan} />
              </div>
            </div>
            {topRedJabatan.length > 0 && (
              <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "14px", border: "1px solid #e2e8f0", height: "350px" }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", color: "#991b1b" }}>⚠️ Top Bottleneck (RED)</h3>
                <div style={{ height: "270px" }}>
                  <Bar data={chartDataJabatan} options={chartOptionsJabatan} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabel Data */}
        <div className="print-container" style={{ backgroundColor: "white", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "20px" }}>
          
          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>Daftar Rincian Berkas</h3>
            <input
              type="text"
              placeholder="🔍 Cari No Berkas, Pemohon..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", width: "260px" }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "10px", width: "40px", textAlign: "center" }}>#</th>
                  <th style={{ padding: "10px" }}>No Berkas</th>
                  <th style={{ padding: "10px" }}>Tgl Terdaftar</th>
                  <th style={{ padding: "10px" }}>Jatuh Tempo</th>
                  <th style={{ padding: "10px" }}>Tgl Selesai</th>
                  <th style={{ padding: "10px" }}>Kegiatan</th>
                  <th style={{ padding: "10px" }}>Pemohon</th>
                  <th style={{ padding: "10px" }}>Posisi / Petugas</th>
                  <th style={{ padding: "10px", textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRincian.length > 0 ? (
                  paginatedRincian.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px", textAlign: "center", color: "#64748b" }}>
                        {isPrinting ? idx + 1 : (currentPage - 1) * itemsPerPage + idx + 1}
                      </td>
                      <td style={{ padding: "10px", fontWeight: "bold", color: "#1d4ed8" }}>{row.noBerkas}</td>
                      <td style={{ padding: "10px" }}>{row.tglTerdaftar}</td>
                      <td style={{ padding: "10px" }}>{row.jatuhtempo}</td>
                      <td style={{ padding: "10px" }}>{row.tglSelesai}</td>
                      <td style={{ padding: "10px" }}>{row.namaKegiatan}</td>
                      <td style={{ padding: "10px", textTransform: "uppercase" }}>{row.namaPemohon}</td>
                      <td style={{ padding: "10px" }}>{row.jabatan}</td>
                      <td style={{ padding: "10px", textAlign: "center" }}>{getStatusBadge(row.status)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>Tidak ada data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!isPrinting && filteredRincian.length > itemsPerPage && (
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Halaman {currentPage} dari {totalPages} ({filteredRincian.length} total berkas)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: currentPage === 1 ? "#f1f5f9" : "white", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: "12px" }}
                >
                  ← Sebelumnya
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: currentPage === totalPages ? "#f1f5f9" : "white", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: "12px" }}
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