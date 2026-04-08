import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { SlidersHorizontal, Bookmark, X } from "lucide-react";
import type { SearchFiltersState } from "@/pages/client/Search";

const TYPES = [
  { value: "HOUSE", label: "Casa" },
  { value: "APARTMENT", label: "Depto" },
  { value: "LAND", label: "Terreno" },
  { value: "COMMERCIAL", label: "Local" },
  { value: "GARAGE", label: "Cochera" },
];

const AMENITIES = ["pileta", "gimnasio", "seguridad_24h", "sum", "parrilla", "jardin"];
const AMENITY_LABELS: Record<string, string> = {
  pileta: "Pileta",
  gimnasio: "Gimnasio",
  seguridad_24h: "Seguridad 24h",
  sum: "SUM",
  parrilla: "Parrilla",
  jardin: "Jardín",
};

interface Props {
  filters: SearchFiltersState;
  onChange: (f: SearchFiltersState) => void;
  onSave: () => void;
}

export default function SearchFilters({ filters, onChange, onSave }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const set = (partial: Partial<SearchFiltersState>) => onChange({ ...filters, ...partial });

  const toggleType = (t: string) => {
    set({ types: filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t] });
  };

  return (
    <div className="border-b border-border bg-card px-4 py-3 flex flex-wrap items-center gap-2">
      {/* Operation toggle */}
      <div className="flex rounded-md border border-input overflow-hidden text-sm">
        {(["SALE", "RENT"] as const).map((op) => (
          <button
            key={op}
            onClick={() => set({ operation: filters.operation === op ? null : op })}
            className={`px-3 py-1.5 transition-colors ${
              filters.operation === op
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:bg-accent"
            }`}
          >
            {op === "SALE" ? "Venta" : "Alquiler"}
          </button>
        ))}
      </div>

      {/* Type badges */}
      <div className="flex gap-1 flex-wrap">
        {TYPES.map((t) => (
          <Badge
            key={t.value}
            variant={filters.types.includes(t.value) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleType(t.value)}
          >
            {t.label}
          </Badge>
        ))}
      </div>

      {/* City */}
      <Input
        placeholder="Ciudad"
        value={filters.city}
        onChange={(e) => set({ city: e.target.value })}
        className="w-32 h-8 text-sm"
      />

      {/* Price range */}
      <Input
        type="number"
        placeholder="$ Min"
        value={filters.priceMin ?? ""}
        onChange={(e) => set({ priceMin: e.target.value ? Number(e.target.value) : null })}
        className="w-24 h-8 text-sm"
      />
      <Input
        type="number"
        placeholder="$ Max"
        value={filters.priceMax ?? ""}
        onChange={(e) => set({ priceMax: e.target.value ? Number(e.target.value) : null })}
        className="w-24 h-8 text-sm"
      />

      {/* Rooms */}
      <div className="flex rounded-md border border-input overflow-hidden text-sm">
        {[1, 2, 3, 4].map((r) => (
          <button
            key={r}
            onClick={() => set({ rooms: filters.rooms === r ? null : r })}
            className={`px-2.5 py-1.5 transition-colors ${
              filters.rooms === r
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:bg-accent"
            }`}
          >
            {r === 4 ? "4+" : r}
          </button>
        ))}
      </div>

      {/* More filters */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Más filtros
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filtros avanzados</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Superficie mín (m²)</Label>
                <Input
                  type="number"
                  value={filters.surfaceMin ?? ""}
                  onChange={(e) => set({ surfaceMin: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label className="text-sm">Superficie máx (m²)</Label>
                <Input
                  type="number"
                  value={filters.surfaceMax ?? ""}
                  onChange={(e) => set({ surfaceMax: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Amenities</Label>
              <div className="grid grid-cols-2 gap-2">
                {AMENITIES.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={filters.amenities.includes(a)}
                      onCheckedChange={() =>
                        set({
                          amenities: filters.amenities.includes(a)
                            ? filters.amenities.filter((x) => x !== a)
                            : [...filters.amenities, a],
                        })
                      }
                    />
                    {AMENITY_LABELS[a]}
                  </label>
                ))}
              </div>
            </div>
            <DrawerClose asChild>
              <Button className="w-full">Aplicar filtros</Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Clear */}
      {(filters.operation || filters.types.length || filters.city || filters.priceMin || filters.priceMax || filters.rooms || filters.surfaceMin || filters.surfaceMax || filters.amenities.length) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({
          operation: null, types: [], city: "", priceMin: null, priceMax: null,
          rooms: null, surfaceMin: null, surfaceMax: null, amenities: [],
        })}>
          <X className="h-3.5 w-3.5 mr-1" /> Limpiar
        </Button>
      )}

      {/* Save search */}
      <Button variant="outline" size="sm" className="gap-1 ml-auto" onClick={onSave}>
        <Bookmark className="h-3.5 w-3.5" /> Guardar búsqueda
      </Button>
    </div>
  );
}
