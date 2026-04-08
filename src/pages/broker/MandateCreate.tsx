import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, ArrowLeft } from "lucide-react";
import type { Property, MandateType } from "@/types/database";

const MANDATE_TYPES: { value: MandateType; label: string; desc: string }[] = [
  { value: "EXCLUSIVE", label: "Exclusiva", desc: "Solo vos podés comercializar la propiedad. Mayor compromiso, mayor dedicación." },
  { value: "CO_EXCLUSIVE", label: "Co-Exclusiva", desc: "Compartís la comercialización con un número limitado de corredores." },
  { value: "OPEN", label: "Abierta", desc: "El dueño puede trabajar con múltiples corredores sin exclusividad." },
];

export default function MandateCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerFound, setOwnerFound] = useState<{ id: string; full_name: string } | null>(null);
  const [ownerSearching, setOwnerSearching] = useState(false);

  const [propertyId, setPropertyId] = useState("");
  const [mandateType, setMandateType] = useState<MandateType | "">("");
  const [commissionPct, setCommissionPct] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("properties")
      .select("*")
      .eq("broker_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProperties(data as Property[]); });
  }, [user]);

  const searchOwner = async () => {
    if (!ownerEmail.trim()) return;
    setOwnerSearching(true);
    setOwnerFound(null);
    const { data } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("email", ownerEmail.trim())
      .eq("role", "OWNER")
      .single();
    if (data) {
      setOwnerFound(data);
    } else {
      toast({ title: "Dueño no encontrado", description: "No existe un dueño registrado con ese email.", variant: "destructive" });
    }
    setOwnerSearching(false);
  };

  const handleSave = async () => {
    if (!user || !ownerFound || !propertyId || !mandateType || !commissionPct || !startDate) return;
    setSaving(true);
    try {
      // Check exclusive mandate constraint
      if (mandateType === "EXCLUSIVE") {
        const { data: existing } = await supabase
          .from("mandates")
          .select("id")
          .eq("property_id", propertyId)
          .eq("type", "EXCLUSIVE")
          .eq("status", "ACTIVE")
          .limit(1);
        if (existing && existing.length > 0) {
          toast({ title: "Error", description: "Esta propiedad ya tiene un mandato exclusivo activo.", variant: "destructive" });
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase.from("mandates").insert({
        property_id: propertyId,
        broker_id: user.id,
        owner_id: ownerFound.id,
        type: mandateType,
        commission_pct: Number(commissionPct),
        start_date: startDate,
        end_date: endDate || null,
        notes: notes || null,
        status: "PENDING",
      });
      if (error) throw error;

      toast({ title: "Mandato creado", description: "El dueño recibirá una notificación para firmar." });
      navigate("/corredor/mandatos");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const canSave = ownerFound && propertyId && mandateType && commissionPct && startDate;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" onClick={() => navigate("/corredor/mandatos")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a mandatos
        </Button>
        <h1 className="text-2xl font-bold mb-6 text-foreground">Nuevo mandato</h1>

        <Card className="mb-6">
          <CardHeader><CardTitle>Dueño</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email del dueño</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="email"
                  placeholder="dueno@email.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
                <Button onClick={searchOwner} disabled={ownerSearching} variant="secondary">
                  Buscar
                </Button>
              </div>
            </div>
            {ownerFound && (
              <p className="text-sm text-primary font-medium">
                ✓ Dueño encontrado: {ownerFound.full_name}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>Detalle del mandato</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Propiedad</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccioná una propiedad" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} — {p.address_street || p.address_city || "Sin dirección"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de mandato</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                {MANDATE_TYPES.map((mt) => (
                  <div
                    key={mt.value}
                    onClick={() => setMandateType(mt.value)}
                    className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      mandateType === mt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-semibold text-sm text-foreground">{mt.label}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px]">{mt.desc}</TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{mt.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Comisión total (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="3"
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(e.target.value ? Number(e.target.value) : "")}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Notas adicionales</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="Condiciones especiales, observaciones..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/corredor/mandatos")}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Guardando..." : "Crear mandato"}
          </Button>
        </div>
      </div>
    </div>
  );
}
