import type { PropertyFormData } from "../PropertyWizard";
import type { PropertyType, OperationType } from "@/types/database";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Home, Building2, TreePine, Store, Car } from "lucide-react";

const TYPES: { value: PropertyType; label: string; icon: typeof Home }[] = [
  { value: "HOUSE", label: "Casa", icon: Home },
  { value: "APARTMENT", label: "Departamento", icon: Building2 },
  { value: "LAND", label: "Terreno", icon: TreePine },
  { value: "COMMERCIAL", label: "Local comercial", icon: Store },
  { value: "GARAGE", label: "Cochera", icon: Car },
];

interface Props {
  form: PropertyFormData;
  update: (p: Partial<PropertyFormData>) => void;
}

export default function StepTypeOperation({ form, update }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold mb-3 block">Tipo de propiedad</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ type: value })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                form.type === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              <Icon className="h-8 w-8" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-base font-semibold mb-3 block">Operación</Label>
        <div className="flex gap-3">
          {(["SALE", "RENT"] as OperationType[]).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => update({ operation: op })}
              className={cn(
                "flex-1 rounded-lg border-2 py-3 px-6 text-center font-medium transition-all hover:border-primary/50",
                form.operation === op
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              {op === "SALE" ? "Venta" : "Alquiler"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
