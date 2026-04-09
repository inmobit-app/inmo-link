import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Gavel, DollarSign } from "lucide-react";

interface DisputeRow {
  id: string;
  property_title: string;
  property_currency: string;
  total_amount: number;
  capturing_broker_pct: number;
  client_broker_pct: number;
  platform_pct: number;
  dispute_reason: string | null;
  disputed_by_name: string;
  broker_captador: string;
  broker_cliente: string;
  created_at: string;
}

export default function AdminDisputes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [selected, setSelected] = useState<DisputeRow | null>(null);
  const [action, setAction] = useState<"confirm" | "adjust" | "split5050">("confirm");
  const [adjCapt, setAdjCapt] = useState(40);
  const [adjClient, setAdjClient] = useState(40);
  const [notes, setNotes] = useState("");

  const fetchDisputes = async () => {
    setLoading(true);
    const { data: comms } = await supabase
      .from("commissions")
      .select("*")
      .eq("status", "DISPUTED")
      .order("created_at", { ascending: false });
    if (!comms || comms.length === 0) { setDisputes([]); setLoading(false); return; }

    const propIds = [...new Set(comms.map(c => c.property_id))];
    const leadIds = [...new Set(comms.map(c => c.lead_id))];
    const disputedByIds = comms.map(c => c.disputed_by).filter(Boolean) as string[];

    const [{ data: props }, { data: leads }, { data: disputors }] = await Promise.all([
      supabase.from("properties").select("id, title, currency").in("id", propIds),
      supabase.from("leads").select("id, capturing_broker_id, client_broker_id").in("id", leadIds),
      supabase.from("users").select("id, full_name").in("id", [...new Set(disputedByIds)]),
    ]);

    const brokerIds = new Set<string>();
    (leads || []).forEach(l => { if (l.capturing_broker_id) brokerIds.add(l.capturing_broker_id); if (l.client_broker_id) brokerIds.add(l.client_broker_id); });
    const { data: brokers } = await supabase.from("users").select("id, full_name").in("id", Array.from(brokerIds));

    const propMap = new Map((props || []).map(p => [p.id, p]));
    const leadMap = new Map((leads || []).map(l => [l.id, l]));
    const brokerMap = new Map((brokers || []).map(b => [b.id, b.full_name]));
    const disputorMap = new Map((disputors || []).map(d => [d.id, d.full_name]));

    setDisputes(comms.map(c => {
      const prop = propMap.get(c.property_id);
      const lead = leadMap.get(c.lead_id);
      return {
        id: c.id,
        property_title: prop?.title || "—",
        property_currency: prop?.currency || "USD",
        total_amount: c.total_amount,
        capturing_broker_pct: c.capturing_broker_pct,
        client_broker_pct: c.client_broker_pct,
        platform_pct: c.platform_pct,
        dispute_reason: c.dispute_reason,
        disputed_by_name: c.disputed_by ? disputorMap.get(c.disputed_by) || "—" : "—",
        broker_captador: lead?.capturing_broker_id ? brokerMap.get(lead.capturing_broker_id) || "—" : "—",
        broker_cliente: lead?.client_broker_id ? brokerMap.get(lead.client_broker_id) || "—" : "—",
        created_at: c.created_at,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { fetchDisputes(); }, []);

  const openResolve = (d: DisputeRow) => {
    setSelected(d);
    setAction("confirm");
    setAdjCapt(d.capturing_broker_pct);
    setAdjClient(d.client_broker_pct);
    setNotes("");
    setResolveOpen(true);
  };

  const submitResolve = async () => {
    if (!selected) return;
    let updates: any = {
      status: "RESOLVED",
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
      updated_at: new Date().toISOString(),
    };

    if (action === "split5050") {
      updates.capturing_broker_pct = 40;
      updates.client_broker_pct = 40;
      updates.platform_pct = 20;
      updates.capturing_broker_amount = (selected.total_amount * 40) / 100;
      updates.client_broker_amount = (selected.total_amount * 40) / 100;
      updates.platform_amount = (selected.total_amount * 20) / 100;
    } else if (action === "adjust") {
      const plat = 100 - adjCapt - adjClient;
      updates.capturing_broker_pct = adjCapt;
      updates.client_broker_pct = adjClient;
      updates.platform_pct = plat;
      updates.capturing_broker_amount = (selected.total_amount * adjCapt) / 100;
      updates.client_broker_amount = (selected.total_amount * adjClient) / 100;
      updates.platform_amount = (selected.total_amount * plat) / 100;
    }

    const { error } = await supabase.from("commissions").update(updates).eq("id", selected.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    await supabase.from("audit_log").insert({
      user_id: user?.id,
      action: "COMMISSION_DISPUTE_RESOLVED",
      table_name: "commissions",
      record_id: selected.id,
      new_data: { action, notes, ...updates },
    });

    toast({ title: "Disputa resuelta" });
    setResolveOpen(false);
    fetchDisputes();
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-6 w-6" /> Disputas de Comisión
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : disputes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay disputas activas
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {disputes.map(d => (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Gavel className="h-4 w-4 text-destructive" />
                      {d.property_title}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {d.property_currency} {d.total_amount.toLocaleString("es-AR")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Disputado por</p>
                      <p className="font-medium text-foreground">{d.disputed_by_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Captador</p>
                      <p className="font-medium text-foreground">{d.broker_captador} ({d.capturing_broker_pct}%)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Corredor cliente</p>
                      <p className="font-medium text-foreground">{d.broker_cliente} ({d.client_broker_pct}%)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plataforma</p>
                      <p className="font-medium text-foreground">{d.platform_pct}%</p>
                    </div>
                  </div>
                  {d.dispute_reason && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded p-3">
                      <p className="text-sm font-medium text-foreground">Motivo:</p>
                      <p className="text-sm text-muted-foreground mt-1">{d.dispute_reason}</p>
                    </div>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => openResolve(d)}>
                    <Gavel className="h-4 w-4 mr-1" /> Resolver disputa
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={resolveOpen} onOpenChange={() => setResolveOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolver disputa — {selected?.property_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={action} onValueChange={v => setAction(v as any)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="confirm" id="rc" />
                <Label htmlFor="rc">Confirmar split original</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="adjust" id="ra" />
                <Label htmlFor="ra">Ajustar manualmente</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="split5050" id="rs" />
                <Label htmlFor="rs">Split 50/50 (40/40/20)</Label>
              </div>
            </RadioGroup>

            {action === "adjust" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Captador %</Label>
                  <Input type="number" value={adjCapt} onChange={e => setAdjCapt(Number(e.target.value))} min={0} max={80} />
                </div>
                <div>
                  <Label>Corredor cliente %</Label>
                  <Input type="number" value={adjClient} onChange={e => setAdjClient(Number(e.target.value))} min={0} max={80} />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">Plataforma: {100 - adjCapt - adjClient}%</p>
              </div>
            )}

            <div>
              <Label>Notas de resolución</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Justificación de la decisión..." />
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
