import type { PropertyFormData } from "../PropertyWizard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minus, Plus } from "lucide-react";

const AMENITIES = [
  { key: "pool", label: "Pileta" },
  { key: "gym", label: "Gimnasio" },
  { key: "security", label: "Seguridad 24h" },
  { key: "sum", label: "SUM" },
  { key: "grill", label: "Parrilla" },
  { key: "garden", label: "Jardín" },
];

interface Props {
  form: PropertyFormData;
  update: (p: Partial<PropertyFormData>) => void;
}

function Stepper({ value, onChange, label, min = 0 }: { value: number; onChange: (v: number) => void; label: string; min?: number }) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={() => onChange(Math.max(min, value - 1))}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center font-semibold text-foreground">{value}</span>
        <Button type="button" variant="outline" size="icon" onClick={() => onChange(value + 1)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function StepCharacteristics({ form, update }: Props) {
  const toggleAmenity = (key: string, checked: boolean) => {
    update({ amenities: { ...form.amenities, [key]: checked } });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-1 block">Título de la publicación</Label>
        <Input value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="Depto 3 amb con balcón en Palermo" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Precio</Label>
          <Input type="number" value={form.price} onChange={(e) => update({ price: e.target.value ? Number(e.target.value) : "" })} placeholder="150000" />
        </div>
        <div>
          <Label>Moneda</Label>
          <Select value={form.currency} onValueChange={(v) => update({ currency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="ARS">ARS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Superficie total (m²)</Label>
          <Input type="number" value={form.surface_total} onChange={(e) => update({ surface_total: e.target.value ? Number(e.target.value) : "" })} />
        </div>
        <div>
          <Label>Superficie cubierta (m²)</Label>
          <Input type="number" value={form.surface_covered} onChange={(e) => update({ surface_covered: e.target.value ? Number(e.target.value) : "" })} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stepper label="Ambientes" value={form.rooms} onChange={(v) => update({ rooms: v })} min={1} />
        <Stepper label="Baños" value={form.bathrooms} onChange={(v) => update({ bathrooms: v })} min={1} />
        <Stepper label="Cocheras" value={form.parking} onChange={(v) => update({ parking: v })} />
      </div>

      <div>
        <Label className="text-base font-semibold mb-3 block">Amenities</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {AMENITIES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={!!form.amenities[key]}
                onCheckedChange={(checked) => toggleAmenity(key, !!checked)}
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
