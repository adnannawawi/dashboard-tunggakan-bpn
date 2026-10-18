"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardView from "@/components/DashboardView";
import PemeriksaView from "@/components/PemeriksaView";
import JadwalView from "@/components/JadwalView";
import ListEntryView from "@/components/ListEntryView";
import SelesaiView from "@/components/SelesaiView";
import SurveyorView from "@/components/SurveyorView";
import LaporanView from "@/components/LaporanView";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dataRincian, setDataRincian] = useState([]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f1f5f9" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main style={{ flex: 1, padding: "32px 20px", overflowX: "hidden" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {activeTab === "dashboard" && <DashboardView dataRincian={dataRincian} setDataRincian={setDataRincian} />}
          {activeTab === "pemeriksa" && <PemeriksaView dataRincian={dataRincian} />}
          {activeTab === "jadwal" && <JadwalView />}
          {activeTab === "list_entry" && <ListEntryView />}
          {activeTab === "selesai" && <SelesaiView />}
          {activeTab === "surveyor" && <SurveyorView />}
          {activeTab === "laporan" && <LaporanView />}
        </div>
      </main>
    </div>
  );
}