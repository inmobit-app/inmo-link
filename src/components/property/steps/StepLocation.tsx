import { useEffect, useRef, useState } from "react";
import type { PropertyFormData } from "../PropertyWizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Search } from "lucide-react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface Props {
  form: PropertyFormData;
  update: (p: Partial<PropertyFormData>) => void;
}

export default function StepLocation({ form, update }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || mapRef.current) return;

    import("mapbox-gl").then((mapboxgl) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      (mapboxgl as any).accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [form.address_lng ?? -58.38, form.address_lat ?? -34.6],
        zoom: 12,
      });

      map.on("click", (e: any) => {
        const { lng, lat } = e.lngLat;
        update({ address_lat: lat, address_lng: lng });
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new mapboxgl.default.Marker().setLngLat([lng, lat]).addTo(map);
      });

      if (form.address_lat && form.address_lng) {
        markerRef.current = new mapboxgl.default.Marker()
          .setLngLat([form.address_lng, form.address_lat])
          .addTo(map);
      }

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const geocode = async () => {
    if (!MAPBOX_TOKEN) return;
    const q = `${form.address_street}, ${form.address_city}, ${form.address_province}`;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      const data = await res.json();
      if (data.features?.[0]) {
        const [lng, lat] = data.features[0].center;
        update({ address_lat: lat, address_lng: lng });
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 15 });
        if (markerRef.current) markerRef.current.remove();
        import("mapbox-gl").then((mapboxgl) => {
          markerRef.current = new mapboxgl.default.Marker()
            .setLngLat([lng, lat])
            .addTo(mapRef.current);
        });
      }
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Calle y número</Label>
        <Input value={form.address_street} onChange={(e) => update({ address_street: e.target.value })} placeholder="Av. Corrientes 1234" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Ciudad</Label>
          <Input value={form.address_city} onChange={(e) => update({ address_city: e.target.value })} placeholder="Buenos Aires" />
        </div>
        <div>
          <Label>Provincia</Label>
          <Input value={form.address_province} onChange={(e) => update({ address_province: e.target.value })} placeholder="CABA" />
        </div>
      </div>

      {MAPBOX_TOKEN && (
        <Button type="button" variant="outline" onClick={geocode} disabled={geocoding} className="w-full">
          <Search className="mr-2 h-4 w-4" />
          {geocoding ? "Buscando..." : "Buscar en mapa"}
        </Button>
      )}

      {MAPBOX_TOKEN ? (
        <div>
          <Label className="mb-2 block">Ubicación en mapa (hacé click para marcar)</Label>
          <div ref={mapContainer} className="h-64 rounded-lg border border-border" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Configurá VITE_MAPBOX_TOKEN para habilitar el mapa interactivo.
        </p>
      )}

      {form.address_lat && form.address_lng && (
        <p className="text-xs text-muted-foreground">
          Coordenadas: {form.address_lat.toFixed(5)}, {form.address_lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
