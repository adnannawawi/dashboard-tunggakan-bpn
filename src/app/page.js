"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardView from "@/components/DashboardView";
import PemeriksaView from "@/components/PemeriksaView";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dataRincian, setDataRincian] = useState([]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f1f5f9" }}>
      {/* 1. Sidebar Navigasi Vertikal */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 2. Main Content berdasarkan Menu yang Dipilih */}
      <main style={{ flex: 1, padding: "32px 20px", overflowX: "hidden" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {activeTab === "dashboard" && <DashboardView dataRincian={dataRincian} setDataRincian={setDataRincian} />}
          {activeTab === "pemeriksa" && <PemeriksaView dataRincian={dataRincian} />}
          {activeTab === "jadwal" && <div>Halaman Buat Jadwal Pengukuran</div>}
          {activeTab === "list_entry" && <div>Halaman List Entry</div>}
          {activeTab === "selesai" && <div>Halaman Berkas Selesai</div>}
          {activeTab === "surveyor" && <div>Halaman Surveyor</div>}
          {activeTab === "laporan" && <div>Halaman Laporan</div>}
        </div>
      </main>
    </div>
  );
}