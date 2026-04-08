import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, FileCheck } from "lucide-react";

interface MandateDetail {
  id: string;
  type: string;
  commission_pct: number;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  property_title: string;
  broker_name: string;
}

export default function MandateSign() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mandate, setMandate] = useState<MandateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data } = await supabase
        .from("mandates")
        .select("id, type, commission_pct, start_date, end_date, status, notes, property_id, broker_id")
        .eq("id", id)
        .eq("owner_id", user.id)
        .single();
      if (!data) { setLoading(false); return; }

      const [{ data: prop }, { data: broker }] = await Promise.all([
        supabase.from("properties").select("title").eq("id", data.property_id).single(),
        supabase.from("users").select("full_name").eq("id", data.broker_id).single(),
      ]);

      setMandate({
        ...data,
        property_title: prop?.title || "—",
        broker_name: broker?.full_name || "—",
      } as MandateDetail);
      setLoading(false);
    })();
  }, [id, user]);

  const handleSign = async () => {
    if (!id) return;
    setSigning(true);
    try {
      const { error } = await supabase
        .from("mandates")
        .update({ signed_at: new Date().toISOString(), status: "ACTIVE" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Mandato firmado", description: "El mandato está ahora activo." });
      navigate("/dueno/mandatos");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSigning(false);
    }
  };

  const typeLabel = (t: string) => {
    if (t === "EXCLUSIVE") return "Exclusiva";
    if (t === "CO_EXCLUSIVE") return "Co-Exclusiva";
    return "Abierta";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!mandate) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Mandato no encontrado</p>
      </div>
    );
  }

  const alreadySigned = mandate.status !== "PENDING";

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-xl">
        <Button variant="ghost" onClick={() => navigate("/dueno/mandatos")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a mandatos
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              {alreadySigned ? "Mandato firmado" : "Firmar mandato"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Propiedad</p>
                <p className="font-medium text-foreground">{mandate.property_title}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Corredor</p>
                <p className="font-medium text-foreground">{mandate.broker_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tipo de mandato</p>
                <p className="font-medium text-foreground">{typeLabel(mandate.type)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Comisión</p>
                <p className="font-medium text-foreground">{mandate.commission_pct}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Inicio</p>
                <p className="font-medium text-foreground">{mandate.start_date}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fin</p>
                <p className="font-medium text-foreground">{mandate.end_date || "Sin fecha de fin"}</p>
              </div>
            </div>

            {mandate.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="text-sm text-foreground mt-1">{mandate.notes}</p>
              </div>
            )}

            {alreadySigned ? (
              <p className="text-sm text-primary font-medium">
                ✓ Firmado el {new Date(mandate.status === "ACTIVE" ? mandate.start_date : "").toLocaleDateString("es-AR")}
              </p>
            ) : (
              <>
                <div className="flex items-start gap-2 p-4 rounded-lg bg-muted/50 border border-border">
                  <Checkbox
                    id="accept"
                    checked={accepted}
                    onCheckedChange={(v) => setAccepted(v === true)}
                  />
                  <label htmlFor="accept" className="text-sm text-foreground leading-snug cursor-pointer">
                    Acepto los términos de este mandato y autorizo al corredor a comercializar mi propiedad bajo las condiciones indicadas.
                  </label>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSign}
                  disabled={!accepted || signing}
                >
                  {signing ? "Firmando..." : "Firmar digitalmente"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Firma digital con timestamp. En Fase 3 se integrará firma electrónica con validez legal.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
