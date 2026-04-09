import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, DollarSign, AlertTriangle, CheckCircle, FileText } from "lucide-react";
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
  client_name?: string;
}

export default function BrokerCommissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [commissions, setCommissions] = useState<EnrichedCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [selectedComm, setSelectedComm] = useState<EnrichedCommission | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const fetchCommissions = async () => {
    if (!user) return;
    // Get leads where this broker is involved
    const { data: leads } = await supabase
      .from("leads")
      .select("id")
      .or(`capturing_broker_id.eq.${user.id},client_broker_id.eq.${user.id}`);

    if (!leads || leads.length === 0) { setLoading(false); return; }

    const leadIds = leads.map(l => l.id);
    const { data: comms } = await supabase
      .from("commissions")
      .select("*")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });

    if (!comms) { setLoading(false); return; }

    // Enrich with property and client data
    const propertyIds = [...new Set(comms.map(c => c.property_id))];
    const leadIdsForClients = [...new Set(comms.map(c => c.lead_id))];

    const [{ data: props }, { data: leadsData }] = await Promise.all([
      supabase.from("properties").select("id, title, currency").in("id", propertyIds),
      supabase.from("leads").select("id, client_id").in("id", leadIdsForClients),
    ]);

    const clientIds = [...new Set((leadsData || []).map(l => l.client_id))];
    const { data: clients } = await supabase.from("users").select("id, full_name").in("id", clientIds);

    const propsMap = new Map((props || []).map(p => [p.id, p]));
    const leadsMap = new Map((leadsData || []).map(l => [l.id, l.client_id]));
    const clientsMap = new Map((clients || []).map(c => [c.id, c.full_name]));

    const enriched: EnrichedCommission[] = comms.map(c => {
      const prop = propsMap.get(c.property_id);
      const clientId = leadsMap.get(c.lead_id);
      return {
        ...c,
        property_title: prop?.title || "—",
        property_currency: prop?.currency || "USD",
        client_name: clientId ? clientsMap.get(clientId) || "—" : "—",
      };
    });

    setCommissions(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchCommissions(); }, [user]);

  const openDispute = (comm: EnrichedCommission) => {
    setSelectedComm(comm);
    setDisputeReason("");
    setDisputeOpen(true);
  };

  const submitDispute = async () => {
    if (!selectedComm || !disputeReason.trim()) return;
    const { error } = await supabase.from("commissions").update({
      status: "DISPUTED",
      disputed_by: user?.id,
      dispute_reason: disputeReason.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", selectedComm.id);

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    await supabase.from("audit_log").insert({
      user_id: user?.id,
      action: "COMMISSION_DISPUTED",
      table_name: "commissions",
      record_id: selectedComm.id,
      new_data: { dispute_reason: disputeReason },
    });

    toast({ title: "Disputa registrada" });
    setDisputeOpen(false);
    fetchCommissions();
  };

  // KPIs
  const now = new Date();
  const thisMonth = commissions.filter(c => new Date(c.created_at).getMonth() === now.getMonth() && new Date(c.created_at).getFullYear() === now.getFullYear());
  const paidThisMonth = thisMonth.filter(c => c.status === "PAID").reduce((sum, c) => sum + (c.capturing_broker_amount || 0) + (c.client_broker_amount || 0), 0);
  const pendingTotal = commissions.filter(c => c.status === "PENDING" || c.status === "CONFIRMED").reduce((sum, c) => sum + (c.capturing_broker_amount || 0) + (c.client_broker_amount || 0), 0);
  const disputeCount = commissions.filter(c => c.status === "DISPUTED").length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-card px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/corredor/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Mis Comisiones</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">$ {paidThisMonth.toLocaleString("es-AR")}</p>
                <p className="text-xs text-muted-foreground">Cobradas este mes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">$ {pendingTotal.toLocaleString("es-AR")}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{disputeCount}</p>
                <p className="text-xs text-muted-foreground">En disputa</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Liquidaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay comisiones registradas</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Propiedad</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Regla</TableHead>
                    <TableHead>Bruto</TableHead>
                    <TableHead>Reparto</TableHead>
                    <TableHead>Neto corredor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map(c => {
                    const brokerNet = (c.capturing_broker_amount || 0) + (c.client_broker_amount || 0);
                    const statusInfo = STATUS_LABELS[c.status] || { label: c.status, variant: "secondary" as const };
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.property_title}</TableCell>
                        <TableCell>{c.client_name}</TableCell>
                        <TableCell><Badge variant="outline">{RULE_LABELS[c.rule] || c.rule}</Badge></TableCell>
                        <TableCell>{c.property_currency} {c.total_amount.toLocaleString("es-AR")}</TableCell>
                        <TableCell>
                          <SplitBar
                            capturing={c.capturing_broker_pct}
                            client={c.client_broker_pct}
                            platform={c.platform_pct}
                          />
                        </TableCell>
                        <TableCell className="font-bold">{c.property_currency} {brokerNet.toLocaleString("es-AR")}</TableCell>
                        <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(c.status === "PENDING" || c.status === "CONFIRMED") && (
                              <Button variant="outline" size="sm" onClick={() => openDispute(c)}>
                                <AlertTriangle className="h-3 w-3 mr-1" /> Disputar
                              </Button>
                            )}
                            {c.status === "CONFIRMED" || c.status === "PAID" ? (
                              <Button variant="ghost" size="sm" onClick={() => toast({ title: "PDF generado (demo)" })}>
                                <FileText className="h-3 w-3 mr-1" /> PDF
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dispute dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disputar comisión</DialogTitle>
            <DialogDescription>Explicá el motivo de la disputa. Un administrador revisará el caso.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Motivo de la disputa..." value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={submitDispute} disabled={!disputeReason.trim()}>Enviar disputa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
