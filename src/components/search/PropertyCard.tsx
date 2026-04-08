import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Bed, Maximize } from "lucide-react";
import type { Property, PropertyPhoto } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  HOUSE: "Casa",
  APARTMENT: "Depto",
  LAND: "Terreno",
  COMMERCIAL: "Local",
  GARAGE: "Cochera",
};

interface Props {
  property: Property & { property_photos: PropertyPhoto[] };
  isFav: boolean;
  isCompare: boolean;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onToggleFav: (id: string) => void;
  onToggleCompare: (id: string) => void;
}

export default function PropertyCard({
  property: p,
  isFav,
  isCompare,
  isHovered,
  isSelected,
  onHover,
  onToggleFav,
  onToggleCompare,
}: Props) {
  const navigate = useNavigate();
  const cover = p.property_photos?.find((ph) => ph.is_cover) ?? p.property_photos?.[0];
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: p.currency || "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <Card
      className={`overflow-hidden cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary" : isHovered ? "ring-1 ring-primary/50" : ""
      }`}
      onMouseEnter={() => onHover(p.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => navigate(`/propiedad/${p.id}`)}
    >
      <div className="flex gap-3 p-3">
        {/* Cover image */}
        <div className="relative w-32 h-24 shrink-0 rounded-md overflow-hidden bg-muted">
          {cover ? (
            <img src={cover.url} alt={p.title} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Sin foto</div>
          )}
          {/* Favorite star */}
          <button
            className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background"
            onClick={(e) => { e.stopPropagation(); onToggleFav(p.id); }}
          >
            <Star className={`h-4 w-4 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg text-foreground">{fmt(p.price)}</p>
          <p className="text-sm text-muted-foreground truncate">
            {[p.address_street, p.address_city].filter(Boolean).join(", ") || "Sin dirección"}
          </p>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {p.type && <Badge variant="secondary" className="text-xs">{TYPE_LABELS[p.type] ?? p.type}</Badge>}
            {p.rooms && (
              <Badge variant="outline" className="text-xs gap-1">
                <Bed className="h-3 w-3" /> {p.rooms}
              </Badge>
            )}
            {p.surface_total && (
              <Badge variant="outline" className="text-xs gap-1">
                <Maximize className="h-3 w-3" /> {p.surface_total} m²
              </Badge>
            )}
          </div>
        </div>

        {/* Compare checkbox */}
        <div className="flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isCompare}
            onCheckedChange={() => onToggleCompare(p.id)}
            className="mb-1"
          />
          <span className="text-[10px] text-muted-foreground">Comparar</span>
        </div>
      </div>
    </Card>
  );
}
