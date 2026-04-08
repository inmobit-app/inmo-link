import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Property, PropertyPhoto } from "@/types/database";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

interface Props {
  properties: (Property & { property_photos: PropertyPhoto[] })[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

export default function SearchMap({ properties, hoveredId, selectedId, onHover, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-58.4173, -34.6118],
      zoom: 11,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    properties.forEach((p) => {
      if (!p.address_lat || !p.address_lng) return;
      const fmt = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 0 }).format(p.price);
      const el = document.createElement("div");
      el.className = "search-marker";
      el.innerHTML = `<span class="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full shadow-md whitespace-nowrap">$${fmt}</span>`;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([p.address_lng, p.address_lat])
        .addTo(map);

      el.addEventListener("mouseenter", () => onHover(p.id));
      el.addEventListener("mouseleave", () => onHover(null));
      el.addEventListener("click", () => onSelect(p.id));

      markersRef.current.set(p.id, marker);
      bounds.extend([p.address_lng, p.address_lat]);
      hasBounds = true;
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  }, [properties, onHover, onSelect]);

  // Highlight hovered marker
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      const span = el.querySelector("span");
      if (!span) return;
      if (id === hoveredId || id === selectedId) {
        span.classList.add("ring-2", "ring-ring", "scale-110");
      } else {
        span.classList.remove("ring-2", "ring-ring", "scale-110");
      }
    });
  }, [hoveredId, selectedId]);

  // Hover popup
  useEffect(() => {
    if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    if (!hoveredId || !mapRef.current) return;
    const p = properties.find((x) => x.id === hoveredId);
    if (!p?.address_lat || !p?.address_lng) return;
    const cover = p.property_photos?.find((ph) => ph.is_cover) ?? p.property_photos?.[0];
    const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: p.currency || "USD", maximumFractionDigits: 0 }).format(p.price);
    const popup = new mapboxgl.Popup({ closeButton: false, offset: 25, className: "search-popup" })
      .setLngLat([p.address_lng, p.address_lat])
      .setHTML(`
        <div style="width:180px">
          ${cover ? `<img src="${cover.url}" style="width:100%;height:100px;object-fit:cover;border-radius:4px" />` : ""}
          <p style="font-weight:700;margin-top:4px">${fmt}</p>
          <p style="font-size:12px;color:#666">${p.address_street || ""}</p>
        </div>
      `)
      .addTo(mapRef.current);
    popupRef.current = popup;
  }, [hoveredId, properties]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-muted text-muted-foreground text-sm">
        Configurá VITE_MAPBOX_TOKEN para ver el mapa
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
