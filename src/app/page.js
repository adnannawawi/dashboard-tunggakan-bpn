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

// Peta dimuat secara dinamis khusus client-side
const Map = dynamic(() => import("../component/Map"), {
  ssr: false,
  loading: () => <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>Memuat Peta GEOTAS...</div>,
});

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CENTER_LAT = -2.6833;
const CENTER_LNG = 111.6167;

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

    // Dummy data default agar chart dan tabel langsung terisi aman saat pertama kali dibuka
    const dummyData = [
      { noBerkas: "123/2026", namaPemohon: "Budi Santoso", namaKegiatan: "Pengecekan Sertipikat", jabatan: "Loket", status: "GREEN", lat: CENTER_LAT, lng: CENTER_LNG, isPrioritas: true },
      { noBerkas: "124/2026", namaPemohon: "Siti Aminah", namaKegiatan: "Hak Tanggungan", jabatan: "Pemeriksa", status: "YELLOW", lat: CENTER_LAT + 0.01, lng: CENTER_LNG + 0.01, isPrioritas: true },
    ];
    processAndSetData(dummyData, "Data Dummy Sistem");
  }, [processAndSetData]);

  const totalBerkas = dataRincian.length;
  const totalSesuai = dataRincian.filter((i) => i.status === "GREEN").length;
  const totalHampir = dataRincian.filter((i) => i.status === "YELLOW").length;
  const totalSudah = dataRincian.filter((i) => i.status === "RED").length;

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

  const getStatusBadge = (status) => {
    if (status === "GREEN") {
      return <span style={{ backgroundColor: "#d1fae5", color: "#065f46", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>GREEN</span>;
    }
    if (status === "YELLOW") {
      return <span style={{ backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>YELLOW</span>;
    }
    return <span style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" }}>RED</span>;
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", padding: "32px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <header style={{ marginBottom: "28px", backgroundColor: "#0f172a", color: "white", padding: "28px 32px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#38bdf8", marginBottom: "8px", fontWeight: "600" }}>Sistem Informasi Pertanahan (GEOTAS)</div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>Dashboard Eksekutif Monitoring Tunggakan Berkas</h1>
            <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "15px" }}>Kantor Pertanahan Kabupaten Kotawaringin Barat</p>
          </div>
        </header>

        {/* Statistik Ringkas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "28px" }}>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#64748b", fontSize: "13px" }}>Total Berkas</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>{totalBerkas}</div>
          </div>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#10b981", fontSize: "13px", fontWeight: "600" }}>Aman (GREEN)</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#10b981" }}>{totalSesuai}</div>
          </div>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#f59e0b", fontSize: "13px", fontWeight: "600" }}>Hari H (YELLOW)</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#f59e0b" }}>{totalHampir}</div>
          </div>
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#ef4444", fontSize: "13px", fontWeight: "600" }}>Terlambat (RED)</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "#ef4444" }}>{totalSudah}</div>
          </div>
        </div>

        {/* Grafik Layanan */}
        {dataLayanan.length > 0 && (
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "28px", height: "350px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#0f172a" }}>📊 Statistik Berkas Berdasarkan Layanan</h3>
            <div style={{ height: "270px", position: "relative" }}>
              <Bar data={chartDataLayanan} options={chartOptionsLayanan} />
            </div>
          </div>
        )}

        {/* Panel Peta GIS GEOTAS */}
        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "28px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#0f172a", fontWeight: "700" }}>🗺️ Peta Interaktif Sebaran Persil & Berkas (GEOTAS)</h3>
          <div style={{ height: "420px", width: "100%", borderRadius: "10px", overflow: "hidden", border: "1px solid #cbd5e1" }}>
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