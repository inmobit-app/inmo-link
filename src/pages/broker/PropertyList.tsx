import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Eye, Trash2 } from "lucide-react";
import type { Property, PropertyPhoto, PropertyStatus, PropertyType, OperationType } from "@/types/database";

const STATUS_LABELS: Record<PropertyStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activa",
  RESERVED: "Reservada",
  SOLD: "Vendida",
  RENTED: "Alquilada",
  PAUSED: "Pausada",
};

const STATUS_COLORS: Record<PropertyStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-primary/10 text-primary",
  RESERVED: "bg-accent text-accent-foreground",
  SOLD: "bg-destructive/10 text-destructive",
  RENTED: "bg-secondary text-secondary-foreground",
  PAUSED: "bg-muted text-muted-foreground",
};

const TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: "Casa",
  APARTMENT: "Depto",
  LAND: "Terreno",
  COMMERCIAL: "Local",
  GARAGE: "Cochera",
};

interface PropertyWithCover extends Property {
  cover_url?: string;
}

export default function PropertyList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterOp, setFilterOp] = useState<string>("ALL");

  const fetchProperties = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("properties").select("*").eq("broker_id", user.id).order("created_at", { ascending: false });
    if (filterStatus !== "ALL") q = q.eq("status", filterStatus);
    if (filterType !== "ALL") q = q.eq("type", filterType);
    if (filterOp !== "ALL") q = q.eq("operation", filterOp);
    const { data } = await q;
    if (!data) { setLoading(false); return; }

    // Fetch cover photos
    const ids = data.map((p) => p.id);
    const { data: photos } = await supabase.from("property_photos").select("*").in("property_id", ids).eq("is_cover", true);
    const coverMap = new Map((photos || []).map((p: PropertyPhoto) => [p.property_id, p.url]));

    setProperties(data.map((p) => ({ ...p, cover_url: coverMap.get(p.id) })) as PropertyWithCover[]);
    setLoading(false);
  };

  useEffect(() => { fetchProperties(); }, [user, filterStatus, filterType, filterOp]);

  const deleteProperty = async (id: string) => {
    const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("property_id", id).not("stage", "in", '("CLOSED","LOST")');
    if (count && count > 0) {
      toast({ title: "No se puede eliminar", description: "La propiedad tiene leads activos.", variant: "destructive" });
      return;
    }
    await supabase.from("property_photos").delete().eq("property_id", id);
    await supabase.from("properties").delete().eq("id", id);
    toast({ title: "Propiedad eliminada" });
    fetchProperties();
  };

  const changeStatus = async (id: string, status: PropertyStatus) => {
    await supabase.from("properties").update({ status }).eq("id", id);
    fetchProperties();
  };

  const formatPrice = (p: Property) =>
    `${p.currency} ${Number(p.price).toLocaleString("es-AR")}`;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Mis propiedades</h1>
          <Button onClick={() => navigate("/corredor/propiedades/nueva")}>
            <Plus className="mr-2 h-4 w-4" /> Nueva propiedad
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterOp} onValueChange={setFilterOp}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Operación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              <SelectItem value="SALE">Venta</SelectItem>
              <SelectItem value="RENT">Alquiler</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : properties.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay propiedades</TableCell></TableRow>
              ) : (
                properties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.cover_url ? (
                        <img src={p.cover_url} alt="" className="h-10 w-14 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-14 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{p.address_street || p.title}</TableCell>
                    <TableCell>{p.type ? TYPE_LABELS[p.type] : "—"}</TableCell>
                    <TableCell>{p.operation === "SALE" ? "Venta" : p.operation === "RENT" ? "Alquiler" : "—"}</TableCell>
                    <TableCell className="font-semibold">{formatPrice(p)}</TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={(v) => changeStatus(p.id, v as PropertyStatus)}>
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <Badge variant="secondary" className={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/propiedad/${p.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/corredor/propiedades/${p.id}/editar`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteProperty(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
