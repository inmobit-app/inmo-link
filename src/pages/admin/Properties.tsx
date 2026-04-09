import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import type { PropertyStatus } from "@/types/database";

interface PropertyRow {
  id: string;
  title: string;
  status: PropertyStatus;
  price: number;
  currency: string;
  address_city: string | null;
  owner_name: string;
  created_at: string;
}

const STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: "Borrador", ACTIVE: "Activa", RESERVED: "Reservada",
  SOLD: "Vendida", RENTED: "Alquilada", PAUSED: "Pausada",
};

export default function AdminProperties() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchProperties = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("properties")
      .select("id, title, status, price, currency, address_city, owner_id, created_at")
      .order("created_at", { ascending: false });
    if (!data) { setLoading(false); return; }

    const ownerIds = [...new Set(data.map(p => p.owner_id).filter(Boolean))];
    const { data: owners } = await supabase.from("users").select("id, full_name").in("id", ownerIds as string[]);
    const ownerMap = new Map((owners || []).map(o => [o.id, o.full_name]));

    setProperties(data.map(p => ({
      ...p,
      owner_name: p.owner_id ? ownerMap.get(p.owner_id) || "—" : "—",
    } as PropertyRow)));
    setLoading(false);
  };

  useEffect(() => { fetchProperties(); }, []);

  const updateStatus = async (id: string, status: PropertyStatus) => {
    const { error } = await supabase.from("properties").update({ status }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Propiedad ${STATUS_LABELS[status].toLowerCase()}` });
    fetchProperties();
  };

  const filtered = properties.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Gestión de Propiedades</h1>

        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Buscar propiedad..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Dueño</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell></TableRow>
                ) : (
                  filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.title}</TableCell>
                      <TableCell className="text-muted-foreground">{p.address_city || "—"}</TableCell>
                      <TableCell>{p.owner_name}</TableCell>
                      <TableCell>{p.currency} {p.price.toLocaleString("es-AR")}</TableCell>
                      <TableCell><Badge variant="outline">{STATUS_LABELS[p.status]}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.status === "DRAFT" && (
                            <Button variant="outline" size="sm" onClick={() => updateStatus(p.id, "ACTIVE")}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Aprobar
                            </Button>
                          )}
                          {p.status === "ACTIVE" && (
                            <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, "PAUSED")}>
                              <EyeOff className="h-3 w-3 mr-1" /> Ocultar
                            </Button>
                          )}
                          {p.status === "PAUSED" && (
                            <Button variant="ghost" size="sm" onClick={() => updateStatus(p.id, "ACTIVE")}>
                              <Eye className="h-3 w-3 mr-1" /> Mostrar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
