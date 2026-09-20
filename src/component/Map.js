'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix icon marker Leaflet di Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const CENTER_LAT = -2.6833;
const CENTER_LNG = 111.6167;

export default function MapComponent({ basemap, filteredRincian }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>Memuat Peta...</div>;
  }

  const tileUrl =
    basemap === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const attribution =
    basemap === "satellite"
      ? "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <MapContainer
      center={[CENTER_LAT, CENTER_LNG]}
      zoom={11}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url={tileUrl} attribution={attribution} />
      {filteredRincian &&
        filteredRincian.map((item, index) => (
          <Marker key={index} position={[item.lat || CENTER_LAT, item.lng || CENTER_LNG]}>
            <Popup>
              <div style={{ fontSize: "12px" }}>
                <strong>No. Berkas:</strong> {item.noBerkas}<br />
                <strong>Pemohon:</strong> {item.namaPemohon}<br />
                <strong>Kegiatan:</strong> {item.namaKegiatan}<br />
                <strong>Status:</strong> {item.status}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}