import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface VisitRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (slots: Date[], note: string) => Promise<void>;
  submitting?: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 8; // 08:00 to 19:00
  return { value: `${h}`, label: `${h.toString().padStart(2, "0")}:00` };
});

export default function VisitRequestModal({ open, onOpenChange, onSubmit, submitting }: VisitRequestModalProps) {
  const [slots, setSlots] = useState<{ date: Date | undefined; hour: string }[]>([
    { date: undefined, hour: "10" },
  ]);
  const [note, setNote] = useState("");

  const addSlot = () => {
    if (slots.length >= 3) return;
    setSlots(prev => [...prev, { date: undefined, hour: "10" }]);
  };

  const removeSlot = (idx: number) => {
    setSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const updateSlot = (idx: number, field: "date" | "hour", value: any) => {
    setSlots(prev => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const validSlots = slots.filter(s => s.date);

  const handleSubmit = async () => {
    const dates = validSlots.map(s => {
      const d = new Date(s.date!);
      d.setHours(parseInt(s.hour), 0, 0, 0);
      return d;
    });
    if (dates.length === 0) return;
    await onSubmit(dates, note.trim());
    setSlots([{ date: undefined, hour: "10" }]);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar visita</DialogTitle>
          <DialogDescription>Proponé hasta 3 horarios alternativos para que el corredor elija.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {slots.map((slot, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Opción {idx + 1}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !slot.date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {slot.date ? format(slot.date, "EEE d MMM", { locale: es }) : "Elegir fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={slot.date}
                      onSelect={d => updateSlot(idx, "date", d)}
                      disabled={d => d < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-24">
                <Select value={slot.hour} onValueChange={v => updateSlot(idx, "hour", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => (
                      <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {slots.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeSlot(idx)} className="text-muted-foreground">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {slots.length < 3 && (
            <Button variant="outline" size="sm" onClick={addSlot} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Agregar horario alternativo
            </Button>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Nota opcional</Label>
            <Textarea
              placeholder="Ej: Prefiero por la tarde, tengo flexibilidad..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting || validSlots.length === 0}>
            {submitting ? "Enviando..." : `Enviar ${validSlots.length} opción${validSlots.length > 1 ? "es" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
