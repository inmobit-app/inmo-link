import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import LeadChat from "@/components/chat/LeadChat";
import VisitActions from "@/components/visit/VisitActions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, User, MessageSquare, DollarSign, XCircle, UserPlus } from "lucide-react";
import type { LeadStage, Visit } from "@/types/database";

const STAGES: { key: LeadStage; label: string }[] = [
  { key: "NEW", label: "Nuevo" },
  { key: "CONTACTED", label: "Contactado" },
  { key: "VISIT_SCHEDULED", label: "Visita agendada" },
  { key: "VISITED", label: "Visitó" },
  { key: "OFFER", label: "Oferta" },
  { key: "RESERVED", label: "Reservado" },
  { key: "CLOSED", label: "Cerrado" },
];

const COMMISSION_RULES: Record<string, { label: string; platform: number; capturing: number; client: number }> = {
  C_EXCLUSIVE: { label: "C – Exclusiva", platform: 20, capturing: 80, client: 0 },
  C_OPEN: { label: "C – Abierta", platform: 20, capturing: 60, client: 20 },
  A: { label: "A – Captador + Cliente", platform: 20, capturing: 40, client: 40 },
  B: { label: "B – Solo cliente", platform: 20, capturing: 0, client: 80 },
  D: { label: "D – Especial", platform: 20, capturing: 40, client: 40 },
};

export default function LeadDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [mandate, setMandate] = useState<any>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");

  const loadData = async () => {
    if (!id) return;
    const { data: l } = await supabase.from("leads").select("*").eq("id", id).single();
    if (!l) { setLoading(false); return; }
    setLead(l);

    const [{ data: p }, { data: c }, { data: vis }, { data: m }] = await Promise.all([
      supabase.from("properties").select("*").eq("id", l.property_id).single(),
      supabase.from("users").select("*").eq("id", l.client_id).single(),
      supabase.from("visits").select("*").eq("lead_id", id).order("scheduled_at"),
      supabase.from("mandates").select("*").eq("property_id", l.property_id).eq("status", "ACTIVE").maybeSingle(),
    ]);
    setProperty(p);
    setClient(c);
    setVisits((vis || []) as Visit[]);
    setMandate(m);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const updateStage = async (newStage: LeadStage) => {
    const { error } = await supabase.from("leads").update({ stage: newStage, updated_at: new Date().toISOString() }).eq("id", lead.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setLead((prev: any) => ({ ...prev, stage: newStage }));
    toast({ title: `Etapa actualizada a ${STAGES.find(s => s.key === newStage)?.label}` });
  };

  const markLost = async () => {
    if (!lostReason.trim()) return;
    await supabase.from("leads").update({
      stage: "LOST" as any,
      notes: `${lead.notes || ""}\n[PERDIDO] ${lostReason}`.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", lead.id);
    toast({ title: "Lead marcado como perdido" });
    navigate("/corredor/pipeline");
  };

  const assignClientBroker = async () => {
    if (!assignEmail.trim()) return;
    const { data: broker } = await supabase.from("users").select("id, full_name").eq("email", assignEmail.trim()).eq("role", "BROKER").maybeSingle();
    if (!broker) { toast({ title: "Corredor no encontrado", variant: "destructive" }); return; }
    const { error } = await supabase.from("leads").update({ client_broker_id: broker.id, commission_rule: "A", updated_at: new Date().toISOString() }).eq("id", lead.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setLead((prev: any) => ({ ...prev, client_broker_id: broker.id, commission_rule: "A" }));
    setAssignOpen(false);
    setAssignEmail("");
    toast({ title: `Corredor cliente asignado: ${broker.full_name}` });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Lead no encontrado</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    );
  }

  const rule = COMMISSION_RULES[lead.commission_rule] || null;
  const commissionPct = mandate?.commission_pct || 3;
  const estimatedTotal = property ? (property.price * commissionPct) / 100 : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-card px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/corredor/pipeline")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Detalle del Lead</h1>
          <Badge variant={lead.stage === "CLOSED" ? "default" : "secondary"} className="ml-auto">
            {STAGES.find(s => s.key === lead.stage)?.label || lead.stage}
          </Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Propiedad</CardTitle></CardHeader>
            <CardContent>
              <p className="font-medium text-foreground">{property?.title}</p>
              <p className="text-sm text-muted-foreground">{property?.address_street}, {property?.address_city}</p>
              <p className="text-lg font-bold text-primary mt-2">{property?.currency} {Number(property?.price || 0).toLocaleString("es-AR")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Cliente</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={client?.avatar_url || undefined} />
                  <AvatarFallback>{client?.full_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{client?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{client?.email}</p>
                  {client?.phone_mobile && <p className="text-sm text-muted-foreground">{client.phone_mobile}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stage & Actions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Etapa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={lead.stage} onValueChange={val => updateStage(val as LeadStage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
                <UserPlus className="mr-1 h-4 w-4" /> Asignar corredor cliente
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setLostOpen(true)}>
                <XCircle className="mr-1 h-4 w-4" /> Marcar perdido
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Visits with actions */}
        <VisitActions visits={visits} leadId={lead.id} isBroker={true} onUpdate={loadData} />

        {/* Commission */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Comisión esperada</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Regla</p>
                <p className="font-medium text-foreground">{rule?.label || lead.commission_rule || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total estimado</p>
                <p className="font-bold text-foreground">{property?.currency} {estimatedTotal.toLocaleString("es-AR")}</p>
              </div>
              {rule && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Plataforma ({rule.platform}%)</p>
                    <p className="text-foreground">{property?.currency} {(estimatedTotal * rule.platform / 100).toLocaleString("es-AR")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Captador ({rule.capturing}%)</p>
                    <p className="text-foreground">{property?.currency} {(estimatedTotal * rule.capturing / 100).toLocaleString("es-AR")}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat con cliente</CardTitle></CardHeader>
          <CardContent className="p-0">
            <LeadChat leadId={lead.id} className="h-96" />
          </CardContent>
        </Card>
      </div>

      {/* Lost dialog */}
      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como perdido</DialogTitle>
            <DialogDescription>Indicá el motivo por el cual se perdió este lead.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Motivo..." value={lostReason} onChange={e => setLostReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={markLost} disabled={!lostReason.trim()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign client broker dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar corredor del cliente</DialogTitle>
            <DialogDescription>Ingresá el email del corredor que trajo al cliente.</DialogDescription>
          </DialogHeader>
          <Input placeholder="corredor@email.com" value={assignEmail} onChange={e => setAssignEmail(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={assignClientBroker} disabled={!assignEmail.trim()}>Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
