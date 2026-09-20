'use client';

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

// Pastikan path ini bertuliskan "../component/Map" (tanpa 's')
const Map = dynamic(() => import("../component/Map"), {
  ssr: false,
  loading: () => <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>Memuat Peta GEOTAS...</div>,
});

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Pusat Koordinat Default (Kotawaringin Barat / Pangkalan Bun)
const CENTER_LAT = -2.6833;
const CENTER_LNG = 111.6167;

// Daftar Layanan Prioritas
const LAYANAN_PRIORITAS = [
  "pengecekan sertipikat",
  "surat keterangan pendaftaran tanah",
  "hak tanggungan",
  "roya",
  "peralihan hak",
  "pendaftaran surat keputusan",
  "perubahan hak",
];

export default function Home() {
  const [dataRincian, setDataRincian] = useState([]);
  const [dataJabatan, setDataJabatan] = useState([]);
  const [dataLayanan, setDataLayanan] = useState([]);
  const [fileName, setFileName] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("semua");
  const [basemap, setBasemap] = useState("osm");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

    rows.forEach((row, idx) => {
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

      let latVal = parseFloat(getFieldValue(row, ["Latitude", "Lat", "Y"]));
      let lngVal = parseFloat(getFieldValue(row, ["Longitude", "Lng", "Long", "X"]));

      if (isNaN(latVal) || latVal === 0) latVal = CENTER_LAT + (Math.sin(idx * 7) * 0.08);
      if (isNaN(lngVal) || lngVal === 0) lngVal = CENTER_LNG + (Math.cos(idx * 7) * 0.08);

      let fullNoBerkas = formatValue(nomor);
      if (tahun && String(nomor) !== "-" && String(tahun) !== "-") {
        fullNoBerkas = `${nomor}/${tahun}`;
      }

      let cleanedKegiatan = formatValue(rawKegiatan);
      let cleanedPosisi = formatValue(rawPosisi);

      if (cleanedKegiatan.includes("Pemetan")) cleanedKegiatan = cleanedKegiatan.replace(/Pemetan/g, "Pemetaan");
      if (cleanedPosisi.includes("Pemetan")) cleanedPosisi = cleanedPosisi.replace(/Pemetan/g, "Pemetaan");

      if (fullNoBerkas !== "-") {
        const computedStatus = calculateStatus(jatuhtempo, tglSelesai);
        const lowerKegiatan = cleanedKegiatan.toLowerCase();
        const isPrioritas = LAYANAN_PRIORITAS.some((p) => lowerKegiatan.includes(p));

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
          isPrioritas: isPrioritas,
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
    if (typeof window !== "undefined") {
      localStorage.setItem("atr_bpn_file_name", sourceName);
    }
    processExcelData(rawJsonData);
  }, [processExcelData]);

  useEffect(() => {
    const savedFileName = localStorage.getItem("atr_bpn_file_name");
    const savedTimestamp = localStorage.getItem("atr_bpn_last_updated");

    if (savedTimestamp) setLastUpdated(savedTimestamp);
    if (savedFileName) setFileName(savedFileName);

    const eventSource = new EventSource("/api/stream");
    eventSource.onmessage = (event) => {
      try {
        const result = JSON.parse(event.data);
        if (result && (Array.isArray(result) || result.data)) {
          const rawData = Array.isArray(result) ? result : result.data;
          if (rawData && rawData.length > 0) {
            processAndSetData(rawData, savedFileName || "Auto-Sync Realtime Web ATR/BPN");
            const newTime = result.lastUpdated || formatCurrentTimestamp();
            setLastUpdated(newTime);
            localStorage.setItem("atr_bpn_last_updated", newTime);
          }
        }
      } catch (err) {
        console.error("Gagal memproses stream SSE:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("Koneksi SSE terputus/error:", err);
      eventSource.close();
    };

    return () => { eventSource.close(); };
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
  const totalPrioritas = dataRincian.filter((i) => i.isPrioritas).length;
  const totalSesuai = dataRincian.filter((i) => i.status === "GREEN").length;
  const totalHampir = dataRincian.filter((i) => i.status === "YELLOW").length;
  const totalSudah = dataRincian.filter((i) => i.status === "RED").length;

  const pctSesuai = totalBerkas > 0 ? Math.round((totalSesuai / totalBerkas) * 100) : 0;
  const pctHampir = totalBerkas > 0 ? Math.round((totalHampir / totalBerkas) * 100) : 0;
  const pctSudah = totalBerkas > 0 ? Math.round((totalSudah / totalBerkas) * 100) : 0;

  const filteredRincian = useMemo(() => {
    return dataRincian.filter((item) => {
      let matchesFilter = true;
      if (selectedFilter === "prioritas") matchesFilter = item.isPrioritas;
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
    return [...dataJabatan].filter((j) => j.sudah > 0).sort((a, b) => b.sudah - a.sudah).slice(0, 10);
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
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", padding: "32px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <style jsx global>{`
          .only-print { display: none !important; }
          @media print {
            @page { size: A4 landscape; margin: 8mm; }
            body { background: white !important; }
            .no-print, header, .leaflet-container, canvas, svg { display: none !important; }
            .only-print { display: block !important; width: 100% !important; }
            .only-print table { width: 100% !important; border-collapse: collapse !important; }
            .only-print th, .only-print td { padding: 6px 8px !important; font-size: 9px !important; }
          }
        `}</style>

        <header className="no-print" style={{ marginBottom: "28px", backgroundColor: "#0f172a", color: "white", padding: "28px 32px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#38bdf8", marginBottom: "8px", fontWeight: "600" }}>Sistem Informasi Pertanahan (GEOTAS)</div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>Dashboard Eksekutif Monitoring Tunggakan Berkas</h1>
            <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "15px" }}>Kantor Pertanahan Kabupaten Kotawaringin Barat</p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button onClick={() => window.print()} style={{ backgroundColor: "#2563eb", color: "white", border: "none", padding: "10px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>🖨️ Cetak PDF</button>
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", padding: "10px 16px", borderRadius: "12px" }}>
              <input type="file" accept=".xlsx, .xls, .json" onChange={handleFileUpload} style={{ fontSize: "11px", color: "#94a3b8" }} />
            </div>
          </div>
        </header>

        {/* Panel Peta GIS GEOTAS */}
        <div className="card-box no-print" style={{ backgroundColor: "white", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a", fontWeight: "700" }}>🗺️ Peta Interaktif Sebaran Persil & Berkas (GEOTAS)</h3>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => setBasemap("osm")} style={{ backgroundColor: basemap === "osm" ? "#2563eb" : "#f1f5f9", color: basemap === "osm" ? "white" : "#475569", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>Peta Jalan</button>
              <button onClick={() => setBasemap("satellite")} style={{ backgroundColor: basemap === "satellite" ? "#2563eb" : "#f1f5f9", color: basemap === "satellite" ? "white" : "#475569", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>Satelit</button>
            </div>
          </div>
          <div style={{ height: "460px", width: "100%", borderRadius: "10px", overflow: "hidden", position: "relative", border: "1px solid #cbd5e1" }}>
            <Map basemap={basemap} filteredRincian={filteredRincian} />
          </div>
        </div>

        {/* Tabel Data */}
        <div style={{ backgroundColor: "white", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0" }}>Daftar Berkas</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left" }}>
                <th style={{ padding: "10px" }}>No Berkas</th>
                <th style={{ padding: "10px" }}>Pemohon</th>
                <th style={{ padding: "10px" }}>Kegiatan</th>
                <th style={{ padding: "10px" }}>Posisi</th>
                <th style={{ padding: "10px", textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRincian.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px", fontWeight: "bold" }}>{row.noBerkas}</td>
                  <td style={{ padding: "10px" }}>{row.namaPemohon}</td>
                  <td style={{ padding: "10px" }}>{row.namaKegiatan}</td>
                  <td style={{ padding: "10px" }}>{row.jabatan}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{getStatusBadge(row.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}