'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const CENTER_LAT = -2.6833;
const CENTER_LNG = 111.6167;

export default function Map({ basemap, filteredRincian }) {
  return (
    <MapContainer 
      center={[CENTER_LAT, CENTER_LNG]} 
      zoom={11} 
      style={{ height: "100%", width: "100%", position: "absolute", top: 0, left: 0 }}
    >
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
            radius={8}
            pathOptions={{ fillColor: color, color: "#ffffff", weight: 1.5, fillOpacity: 0.9 }}
          >
            <Popup>
              <div style={{ color: "#0f172a", fontSize: "12px", fontFamily: "sans-serif" }}>
                <strong style={{ color: "#2563eb" }}>No Berkas: {item.noBerkas}</strong><br />
                <b>Pemohon:</b> {item.namaPemohon}<br />
                <b>Kegiatan:</b> {item.namaKegiatan} {item.isPrioritas && <span style={{ color: "#7c3aed", fontWeight: "bold" }}>(⭐ Prioritas)</span>}<br />
                <b>Posisi:</b> {item.jabatan}<br />
                <b>Status:</b> <span style={{ color, fontWeight: "bold" }}>{item.status}</span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}