import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Property, PropertyPhoto } from "@/types/database";

const LABELS: Record<string, string> = {
  type: "Tipo", operation: "Operación", price: "Precio", surface_total: "Sup. total",
  surface_covered: "Sup. cubierta", rooms: "Ambientes", bathrooms: "Baños", parking: "Cocheras",
  address_city: "Ciudad",
};
const TYPE_LABELS: Record<string, string> = { HOUSE: "Casa", APARTMENT: "Depto", LAND: "Terreno", COMMERCIAL: "Local", GARAGE: "Cochera" };

export default function Compare() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);

  const { data: properties = [] } = useQuery({
    queryKey: ["compare", ids],
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("*, property_photos(*)")
        .in("id", ids);
      return (data ?? []) as (Property & { property_photos: PropertyPhoto[] })[];
    },
    enabled: ids.length > 0,
  });

  const fmt = (p: Property) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: p.currency || "USD", maximumFractionDigits: 0 }).format(p.price);

  const rows = Object.keys(LABELS);

  return (
    <div className="min-h-screen bg-background p-6">
      <Button variant="ghost" className="mb-4 gap-1" onClick={() => navigate("/buscar")}>
        <ArrowLeft className="h-4 w-4" /> Volver
      </Button>
      <h1 className="text-2xl font-bold mb-6 text-foreground">Comparar propiedades</h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left p-3 border-b border-border text-muted-foreground" />
              {properties.map((p) => {
                const cover = p.property_photos?.find((ph) => ph.is_cover) ?? p.property_photos?.[0];
                return (
                  <th key={p.id} className="p-3 border-b border-border min-w-[200px]">
                    {cover && <img src={cover.url} className="w-full h-32 object-cover rounded-md mb-2" />}
                    <p className="font-bold text-foreground">{p.title}</p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => (
              <tr key={key} className="border-b border-border">
                <td className="p-3 font-medium text-muted-foreground">{LABELS[key]}</td>
                {properties.map((p) => {
                  let val: any = (p as any)[key];
                  if (key === "price") val = fmt(p);
                  if (key === "type") val = TYPE_LABELS[val] ?? val;
                  if (key === "operation") val = val === "SALE" ? "Venta" : val === "RENT" ? "Alquiler" : val;
                  return <td key={p.id} className="p-3 text-foreground">{val ?? "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
