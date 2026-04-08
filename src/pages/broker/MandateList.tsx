import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import type { MandateStatus } from "@/types/database";

const STATUS_LABELS: Record<MandateStatus, string> = {
  PENDING: "Pendiente",
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
  owner_name: string;
}

export default function MandateList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mandates, setMandates] = useState<MandateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const fetchMandates = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("mandates")
      .select("id, type, commission_pct, start_date, end_date, status, signed_at, property_id, owner_id")
      .eq("broker_id", user.id)
      .order("created_at", { ascending: false });
    if (filterStatus !== "ALL") q = q.eq("status", filterStatus);
    const { data } = await q;
    if (!data) { setLoading(false); return; }

    // Fetch property titles and owner names
    const propIds = [...new Set(data.map((m: any) => m.property_id))];
    const ownerIds = [...new Set(data.map((m: any) => m.owner_id))];

    const [{ data: props }, { data: owners }] = await Promise.all([
      supabase.from("properties").select("id, title").in("id", propIds),
      supabase.from("users").select("id, full_name").in("id", ownerIds),
    ]);

    const propMap = new Map((props || []).map((p: any) => [p.id, p.title]));
    const ownerMap = new Map((owners || []).map((o: any) => [o.id, o.full_name]));

    setMandates(data.map((m: any) => ({
      ...m,
      property_title: propMap.get(m.property_id) || "—",
      owner_name: ownerMap.get(m.owner_id) || "—",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchMandates(); }, [user, filterStatus]);

  const typeLabel = (t: string) => {
    if (t === "EXCLUSIVE") return "Exclusiva";
    if (t === "CO_EXCLUSIVE") return "Co-Exclusiva";
    return "Abierta";
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Mandatos</h1>
          <Button onClick={() => navigate("/corredor/mandatos/nuevo")}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo mandato
          </Button>
        </div>

        <div className="flex gap-3 mb-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Dueño</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Comisión</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : mandates.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay mandatos</TableCell></TableRow>
              ) : (
                mandates.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-foreground">{m.property_title}</TableCell>
                    <TableCell>{m.owner_name}</TableCell>
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
