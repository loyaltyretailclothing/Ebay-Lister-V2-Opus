"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Pin color by average items per visit — matches the list-view legend.
function pinColor(visits, ipv) {
  if (!visits) return "#a1a1aa"; // zinc-400 — no visits yet
  if (ipv > 7) return "#22c55e"; // green-500
  if (ipv >= 4) return "#eab308"; // yellow-500
  return "#ef4444"; // red-500
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Leaflet map of sourcing stores. Rendered client-only (dynamic import with
// ssr:false) since Leaflet needs the DOM. Uses free OpenStreetMap tiles and
// divIcon markers (so there's no default-marker-image bundling issue).
export default function SourcingMap({ stores }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  // Initialize the map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.setView([39.8283, -98.5795], 4); // continental US default
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Draw/redraw markers whenever the stores change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const located = (stores || []).filter(
      (s) => typeof s.lat === "number" && typeof s.lng === "number"
    );
    const markers = [];
    for (const s of located) {
      const color = pinColor(s.visits, s.itemsPerVisit);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
      });
      const m = L.marker([s.lat, s.lng], { icon }).addTo(layer);
      const ipv = s.visits ? s.itemsPerVisit.toFixed(1) : "0";
      m.bindPopup(
        `<div style="font:13px system-ui,sans-serif;min-width:130px;line-height:1.5">` +
          `<strong>${escapeHtml(s.name)}</strong><br/>` +
          `${s.totalItems} items<br/>` +
          `${s.visits} visit${s.visits === 1 ? "" : "s"}<br/>` +
          `${ipv} / visit` +
          `</div>`
      );
      markers.push(m);
    }

    if (markers.length === 1) {
      map.setView(markers[0].getLatLng(), 13);
    } else if (markers.length > 1) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.25));
    }
  }, [stores]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg"
      style={{ height: "60vh", minHeight: 320 }}
    />
  );
}
