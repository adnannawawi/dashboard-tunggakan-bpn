"use client";

import { useState } from "react";

export default function Sidebar({ activeTab, setActiveTab }) {
  const [isOpen, setIsOpen] = useState(true);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "pemeriksa", label: "Pemeriksa Berkas", icon: "🔍" },
    { id: "jadwal", label: "Buat Jadwal Pengukuran", icon: "📅" },
    { id: "list_entry", label: "List Entry", icon: "📋" },
    { id: "selesai", label: "Selesai", icon: "✅" },
    { id: "surveyor", label: "Surveyor", icon: "👷" },
    { id: "laporan", label: "Laporan", icon: "📈" },
  ];

  return (
    <aside
      className="no-print"
      style={{
        width: isOpen ? "260px" : "80px",
        minHeight: "100vh",
        backgroundColor: "#18181b",
        color: "#f4f4f5",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease",
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "20px 16px", display: "flex", justifyContent: isOpen ? "space-between" : "center", alignItems: "center", borderBottom: "1px solid #27272a" }}>
        {isOpen && (
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: "700", margin: 0, color: "#fff" }}>si ukur</h2>
            <p style={{ fontSize: "11px", color: "#a1a1aa", margin: 0 }}>Kantah Palangka Raya</p>
          </div>
        )}
        <button onClick={() => setIsOpen(!isOpen)} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer" }}>
          {isOpen ? "◀" : "▶"}
        </button>
      </div>

      <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: activeTab === item.id ? "#27272a" : "transparent",
              color: activeTab === item.id ? "#38bdf8" : "#a1a1aa",
              fontWeight: activeTab === item.id ? "600" : "500",
              fontSize: "14px",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span>{item.icon}</span>
            {isOpen && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}