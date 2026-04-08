import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { MandateStatus } from "@/types/database";

const STATUS_LABELS: Record<MandateStatus, string> = {
  PENDING: "Pendiente de firma",
  ACTIVE: "Activo",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<MandateStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-primary/10 text-primary",
  EXPIRED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

interface MandateRow {
  id: string;
  type: string;
  commission_pct: number;
  start_date: string;
  end_date: string | null;
  status: MandateStatus;
  signed_at: string | null;
  property_title: string;
  broker_name: string;
}

export default function OwnerMandateList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mandates, setMandates] = useState<MandateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("mandates")
        .select("id, type, commission_pct, start_date, end_date, status, signed_at, property_id, broker_id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (!data) { setLoading(false); return; }

      const propIds = [...new Set(data.map((m: any) => m.property_id))];
      const brokerIds = [...new Set(data.map((m: any) => m.broker_id))];

      const [{ data: props }, { data: brokers }] = await Promise.all([
        supabase.from("properties").select("id, title").in("id", propIds),
        supabase.from("users").select("id, full_name").in("id", brokerIds),
      ]);

      const propMap = new Map((props || []).map((p: any) => [p.id, p.title]));
      const brokerMap = new Map((brokers || []).map((b: any) => [b.id, b.full_name]));

      setMandates(data.map((m: any) => ({
        ...m,
        property_title: propMap.get(m.property_id) || "—",
        broker_name: brokerMap.get(m.broker_id) || "—",
      })));
      setLoading(false);
    })();
  }, [user]);

  const typeLabel = (t: string) => {
    if (t === "EXCLUSIVE") return "Exclusiva";
    if (t === "CO_EXCLUSIVE") return "Co-Exclusiva";
    return "Abierta";
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Mis mandatos</h1>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Corredor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : mandates.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tenés mandatos</TableCell></TableRow>
              ) : (
                mandates.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-foreground">{m.property_title}</TableCell>
                    <TableCell>{m.broker_name}</TableCell>
                    <TableCell>{typeLabel(m.type)}</TableCell>
                    <TableCell>{m.commission_pct}%</TableCell>
                    <TableCell className="text-sm">
                      {m.start_date}{m.end_date ? ` → ${m.end_date}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[m.status]}>
                        {STATUS_LABELS[m.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {m.status === "PENDING" && (
                        <Button size="sm" onClick={() => navigate(`/dueno/mandatos/${m.id}/firmar`)}>
                          Firmar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
