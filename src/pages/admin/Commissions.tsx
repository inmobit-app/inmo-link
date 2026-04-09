import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, DollarSign, AlertTriangle, Scale, Gavel } from "lucide-react";
import type { Commission } from "@/types/database";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  CONFIRMED: { label: "Confirmada", variant: "default" },
  PAID: { label: "Pagada", variant: "default" },
  DISPUTED: { label: "En disputa", variant: "destructive" },
  RESOLVED: { label: "Resuelta", variant: "outline" },
};

const RULE_LABELS: Record<string, string> = {
  C_EXCLUSIVE: "C – Exclusiva",
  C_OPEN: "C – Abierta",
  A: "A – Dos corredores",
  D: "D – Externa",
};

interface EnrichedCommission extends Commission {
  property_title?: string;
  property_currency?: string;
  broker_captador?: string;
  broker_cliente?: string;
}

export default function AdminCommissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [commissions, setCommissions] = useState<EnrichedCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selectedComm, setSelectedComm] = useState<EnrichedCommission | null>(null);
  const [resolveAction, setResolveAction] = useState<"confirm" | "adjust" | "split5050">("confirm");
  const [adjustCapturing, setAdjustCapturing] = useState(40);
  const [adjustClient, setAdjustClient] = useState(40);
  const [resolveNotes, setResolveNotes] = useState("");

  const fetchCommissions = async () => {
    const { data: comms } = await supabase
      .from("commissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!comms) { setLoading(false); return; }

    const propertyIds = [...new Set(comms.map(c => c.property_id))];
    const leadIds = [...new Set(comms.map(c => c.lead_id))];

    const [{ data: props }, { data: leads }] = await Promise.all([
      supabase.from("properties").select("id, title, currency").in("id", propertyIds),
      supabase.from("leads").select("id, capturing_broker_id, client_broker_id").in("id", leadIds),
    ]);

    const brokerIds = new Set<string>();
    (leads || []).forEach(l => {
      if (l.capturing_broker_id) brokerIds.add(l.capturing_broker_id);
      if (l.client_broker_id) brokerIds.add(l.client_broker_id);
    });
    const { data: brokers } = await supabase.from("users").select("id, full_name").in("id", Array.from(brokerIds));

    const propsMap = new Map((props || []).map(p => [p.id, p]));
    const leadsMap = new Map((leads || []).map(l => [l.id, l]));
    const brokersMap = new Map((brokers || []).map(b => [b.id, b.full_name]));

    const enriched: EnrichedCommission[] = comms.map(c => {
      const prop = propsMap.get(c.property_id);
      const lead = leadsMap.get(c.lead_id);
      return {
        ...c,
        property_title: prop?.title || "—",
        property_currency: prop?.currency || "USD",
        broker_captador: lead?.capturing_broker_id ? brokersMap.get(lead.capturing_broker_id) || "—" : "—",
        broker_cliente: lead?.client_broker_id ? brokersMap.get(lead.client_broker_id) || "—" : "—",
      };
    });

    setCommissions(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchCommissions(); }, []);

  const confirmPayment = async (comm: EnrichedCommission) => {
    const { error } = await supabase.from("commissions").update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", comm.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    await supabase.from("audit_log").insert({
      user_id: user?.id,
      action: "COMMISSION_PAID",
      table_name: "commissions",
      record_id: comm.id,
    });

    toast({ title: "Pago confirmado" });
    fetchCommissions();
  };

  const confirmCommission = async (comm: EnrichedCommission) => {
    const { error } = await supabase.from("commissions").update({
      status: "CONFIRMED",
      updated_at: new Date().toISOString(),
    }).eq("id", comm.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Comisión confirmada" });
    fetchCommissions();
  };

  const openResolve = (comm: EnrichedCommission) => {
    setSelectedComm(comm);
    setResolveAction("confirm");
    setAdjustCapturing(comm.capturing_broker_pct);
    setAdjustClient(comm.client_broker_pct);
    setResolveNotes("");
    setResolveOpen(true);
  };

  const submitResolve = async () => {
    if (!selectedComm) return;
    let updates: any = {
      status: "RESOLVED",
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
      updated_at: new Date().toISOString(),
    };

    if (resolveAction === "split5050") {
      const halfBroker = 40;
      updates.capturing_broker_pct = halfBroker;
      updates.client_broker_pct = halfBroker;
      updates.capturing_broker_amount = (selectedComm.total_amount * halfBroker) / 100;
      updates.client_broker_amount = (selectedComm.total_amount * halfBroker) / 100;
    } else if (resolveAction === "adjust") {
      updates.capturing_broker_pct = adjustCapturing;
      updates.client_broker_pct = adjustClient;
      updates.platform_pct = 100 - adjustCapturing - adjustClient;
      updates.capturing_broker_amount = (selectedComm.total_amount * adjustCapturing) / 100;
      updates.client_broker_amount = (selectedComm.total_amount * adjustClient) / 100;
      updates.platform_amount = (selectedComm.total_amount * (100 - adjustCapturing - adjustClient)) / 100;
    }

    const oldData = { ...selectedComm };
    const { error } = await supabase.from("commissions").update(updates).eq("id", selectedComm.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    await supabase.from("audit_log").insert({
      user_id: user?.id,
      action: "COMMISSION_DISPUTE_RESOLVED",
      table_name: "commissions",
      record_id: selectedComm.id,
      old_data: { capturing_broker_pct: oldData.capturing_broker_pct, client_broker_pct: oldData.client_broker_pct },
      new_data: { ...updates, resolve_notes: resolveNotes },
    });

    toast({ title: "Disputa resuelta" });
    setResolveOpen(false);
    fetchCommissions();
  };

  const filtered = commissions.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchFilter && !c.property_title?.toLowerCase().includes(searchFilter.toLowerCase()) && !c.broker_captador?.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  const disputes = commissions.filter(c => c.status === "DISPUTED");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Administración de Comisiones</h1>
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Todas ({commissions.length})</TabsTrigger>
            <TabsTrigger value="disputes">Disputas ({disputes.length})</TabsTrigger>
            <TabsTrigger value="rules">Reglas</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmada</SelectItem>
                  <SelectItem value="PAID">Pagada</SelectItem>
                  <SelectItem value="DISPUTED">En disputa</SelectItem>
                  <SelectItem value="RESOLVED">Resuelta</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Buscar propiedad o corredor..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="w-64" />
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propiedad</TableHead>
                      <TableHead>Captador</TableHead>
                      <TableHead>Corredor cliente</TableHead>
                      <TableHead>Regla</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Split</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(c => {
                      const statusInfo = STATUS_LABELS[c.status] || { label: c.status, variant: "secondary" as const };
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.property_title}</TableCell>
                          <TableCell>{c.broker_captador}</TableCell>
                          <TableCell>{c.broker_cliente}</TableCell>
                          <TableCell><Badge variant="outline">{RULE_LABELS[c.rule] || c.rule}</Badge></TableCell>
                          <TableCell>{c.property_currency} {c.total_amount.toLocaleString("es-AR")}</TableCell>
                          <TableCell>
                            <SplitBar capturing={c.capturing_broker_pct} client={c.client_broker_pct} platform={c.platform_pct} />
                          </TableCell>
                          <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {c.status === "PENDING" && (
                                <Button variant="outline" size="sm" onClick={() => confirmCommission(c)}>
                                  <CheckCircle className="h-3 w-3 mr-1" /> Confirmar
                                </Button>
                              )}
                              {c.status === "CONFIRMED" && (
                                <Button variant="default" size="sm" onClick={() => confirmPayment(c)}>
                                  <DollarSign className="h-3 w-3 mr-1" /> Marcar pagada
                                </Button>
                              )}
                              {c.status === "DISPUTED" && (
                                <Button variant="destructive" size="sm" onClick={() => openResolve(c)}>
                                  <Gavel className="h-3 w-3 mr-1" /> Resolver
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="disputes" className="space-y-4 mt-4">
            {disputes.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No hay disputas activas</CardContent></Card>
            ) : (
              disputes.map(c => (
                <Card key={c.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        {c.property_title}
                      </CardTitle>
                      <Badge variant="destructive">En disputa</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Captador</p>
                        <p className="font-medium text-foreground">{c.broker_captador}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Corredor cliente</p>
                        <p className="font-medium text-foreground">{c.broker_cliente}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Regla</p>
                        <p className="font-medium text-foreground">{RULE_LABELS[c.rule] || c.rule}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monto total</p>
                        <p className="font-medium text-foreground">{c.property_currency} {c.total_amount.toLocaleString("es-AR")}</p>
                      </div>
                    </div>
                    <div className="bg-destructive/5 border border-destructive/20 rounded p-3">
                      <p className="text-sm font-medium text-foreground">Motivo de disputa:</p>
                      <p className="text-sm text-muted-foreground mt-1">{c.dispute_reason || "Sin motivo especificado"}</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => openResolve(c)}>
                      <Gavel className="h-4 w-4 mr-1" /> Resolver disputa
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" /> Reglas de comisión</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Regla</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Captador</TableHead>
                      <TableHead>Corredor cliente</TableHead>
                      <TableHead>Plataforma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell><Badge>A</Badge></TableCell>
                      <TableCell>Un solo corredor (captó y trajo cliente)</TableCell>
                      <TableCell>50%</TableCell>
                      <TableCell>30%</TableCell>
                      <TableCell>20%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge>B</Badge></TableCell>
                      <TableCell>Dos corredores distintos</TableCell>
                      <TableCell>40%</TableCell>
                      <TableCell>40%</TableCell>
                      <TableCell>20%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge>C Exclusiva</Badge></TableCell>
                      <TableCell>Mandato exclusivo, un corredor</TableCell>
                      <TableCell>50%</TableCell>
                      <TableCell>30%</TableCell>
                      <TableCell>20%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge>C Abierta</Badge></TableCell>
                      <TableCell>Sin mandato exclusivo</TableCell>
                      <TableCell>Variable (mín. 10%)</TableCell>
                      <TableCell>60% - captación</TableCell>
                      <TableCell>20%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="destructive">D</Badge></TableCell>
                      <TableCell>Operación cerrada fuera de plataforma</TableCell>
                      <TableCell colSpan={3} className="text-muted-foreground">Sin cobro — se registra en auditoría</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Resolve dispute dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolver disputa</DialogTitle>
            <DialogDescription>{selectedComm?.property_title} — {selectedComm?.property_currency} {selectedComm?.total_amount.toLocaleString("es-AR")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Acción</Label>
              <Select value={resolveAction} onValueChange={v => setResolveAction(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirm">Confirmar split original</SelectItem>
                  <SelectItem value="adjust">Ajustar porcentajes</SelectItem>
                  <SelectItem value="split5050">Split 50/50 automático</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {resolveAction === "adjust" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Captador %</Label>
                  <Input type="number" min={0} max={80} value={adjustCapturing} onChange={e => setAdjustCapturing(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Corredor cliente %</Label>
                  <Input type="number" min={0} max={80} value={adjustClient} onChange={e => setAdjustClient(Number(e.target.value))} />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">Plataforma: {100 - adjustCapturing - adjustClient}%</p>
              </div>
            )}

            <div>
              <Label>Notas de resolución</Label>
              <Textarea placeholder="Notas..." value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>Cancelar</Button>
            <Button onClick={submitResolve}>Resolver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function SplitBar({ capturing, client, platform }: { capturing: number; client: number; platform: number }) {
  return (
    <div className="flex h-5 w-full max-w-[160px] rounded overflow-hidden text-[10px] font-medium">
      {capturing > 0 && (
        <div className="bg-primary text-primary-foreground flex items-center justify-center" style={{ width: `${capturing}%` }}>
          {capturing}%
        </div>
      )}
      {client > 0 && (
        <div className="bg-accent text-accent-foreground flex items-center justify-center" style={{ width: `${client}%` }}>
          {client}%
        </div>
      )}
      <div className="bg-muted text-muted-foreground flex items-center justify-center" style={{ width: `${platform}%` }}>
        {platform}%
      </div>
    </div>
  );
}
