import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Clock, User, MessageSquare, Calendar, XCircle } from "lucide-react";
import type { LeadStage } from "@/types/database";

const STAGES: { key: LeadStage; label: string }[] = [
  { key: "NEW", label: "Nuevo" },
  { key: "CONTACTED", label: "Contactado" },
  { key: "VISIT_SCHEDULED", label: "Visita agendada" },
  { key: "VISITED", label: "Visitó" },
  { key: "OFFER", label: "Oferta" },
  { key: "RESERVED", label: "Reservado" },
  { key: "CLOSED", label: "Cerrado" },
];

interface LeadRow {
  id: string;
  property_id: string;
  client_id: string;
  stage: LeadStage;
  commission_rule: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  source: string | null;
  client_broker_id: string | null;
  property: { id: string; title: string; price: number; currency: string; cover_url?: string } | null;
  client: { id: string; full_name: string; email: string; phone_mobile: string | null; avatar_url: string | null } | null;
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function LeadCard({ lead, onClick }: { lead: LeadRow; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow" onClick={onClick}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            {lead.property?.cover_url ? (
              <img src={lead.property.cover_url} alt="" className="w-10 h-10 rounded object-cover" />
            ) : (
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{lead.property?.title || "Propiedad"}</p>
              <p className="text-xs text-muted-foreground truncate">{lead.client?.full_name || "Cliente"}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {daysSince(lead.updated_at)}d en etapa
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KanbanColumn({ stage, leads, onCardClick }: { stage: { key: LeadStage; label: string }; leads: LeadRow[]; onCardClick: (lead: LeadRow) => void }) {
  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
        <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
      </div>
      <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 min-h-[200px] p-1 rounded-lg bg-muted/50">
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function Pipeline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [filterProperty, setFilterProperty] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchLeads = async () => {
    if (!user) return;
    const { data: leadsData } = await supabase
      .from("leads")
      .select("*")
      .or(`capturing_broker_id.eq.${user.id},client_broker_id.eq.${user.id}`)
      .neq("stage", "LOST")
      .order("updated_at", { ascending: false });

    if (!leadsData) { setLoading(false); return; }

    const propertyIds = [...new Set(leadsData.map(l => l.property_id))];
    const clientIds = [...new Set(leadsData.map(l => l.client_id))];

    const [{ data: props }, { data: clients }, { data: covers }] = await Promise.all([
      supabase.from("properties").select("id, title, price, currency").in("id", propertyIds),
      supabase.from("users").select("id, full_name, email, phone_mobile, avatar_url").in("id", clientIds),
      supabase.from("property_photos").select("property_id, url").in("property_id", propertyIds).eq("is_cover", true),
    ]);

    const propsMap = new Map((props || []).map(p => [p.id, p]));
    const clientsMap = new Map((clients || []).map(c => [c.id, c]));
    const coversMap = new Map((covers || []).map(c => [c.property_id, c.url]));

    const enriched: LeadRow[] = leadsData.map(l => {
      const prop = propsMap.get(l.property_id);
      return {
        ...l,
        property: prop ? { ...prop, cover_url: coversMap.get(prop.id) } : null,
        client: clientsMap.get(l.client_id) || null,
      } as LeadRow;
    });

    setLeads(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, [user]);

  const loadLeadDetail = async (lead: LeadRow) => {
    setSelectedLead(lead);
    const [{ data: msgs }, { data: vis }] = await Promise.all([
      supabase.from("messages").select("*").eq("lead_id", lead.id).order("created_at"),
      supabase.from("visits").select("*").eq("lead_id", lead.id).order("scheduled_at"),
    ]);
    setMessages(msgs || []);
    setVisits(vis || []);
  };

  const updateStage = async (leadId: string, newStage: LeadStage) => {
    const { error } = await supabase.from("leads").update({ stage: newStage, updated_at: new Date().toISOString() }).eq("id", leadId);
    if (error) {
      toast({ title: "Error al mover lead", description: error.message, variant: "destructive" });
      return;
    }
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage, updated_at: new Date().toISOString() } : l));
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => prev ? { ...prev, stage: newStage } : null);
    }
  };

  const markLost = async () => {
    if (!selectedLead || !lostReason.trim()) return;
    const { error } = await supabase.from("leads").update({
      stage: "LOST" as any,
      notes: `${selectedLead.notes || ""}\n[PERDIDO] ${lostReason}`.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", selectedLead.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setLeads(prev => prev.filter(l => l.id !== selectedLead.id));
    setSelectedLead(null);
    setLostOpen(false);
    setLostReason("");
    toast({ title: "Lead marcado como perdido" });
  };

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(event.active.id as string);
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Find target column by checking which column's area it was dropped over
    const overLead = leads.find(l => l.id === over.id);
    if (overLead && overLead.stage !== lead.stage) {
      updateStage(leadId, overLead.stage);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (filterProperty && l.property_id !== filterProperty) return false;
      if (filterClient && !l.client?.full_name.toLowerCase().includes(filterClient.toLowerCase())) return false;
      return true;
    });
  }, [leads, filterProperty, filterClient]);

  const properties = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach(l => { if (l.property) map.set(l.property.id, l.property.title); });
    return Array.from(map.entries());
  }, [leads]);

  // KPIs
  const totalLeads = leads.length;
  const visitRate = totalLeads ? Math.round(leads.filter(l => ["VISIT_SCHEDULED", "VISITED", "OFFER", "RESERVED", "CLOSED"].includes(l.stage)).length / totalLeads * 100) : 0;
  const closeRate = totalLeads ? Math.round(leads.filter(l => l.stage === "CLOSED").length / totalLeads * 100) : 0;

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
        <div className="max-w-[1400px] mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/corredor/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Pipeline de Leads</h1>
        </div>
      </div>

      {/* KPIs */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{totalLeads}</p><p className="text-xs text-muted-foreground">Total leads</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{visitRate}%</p><p className="text-xs text-muted-foreground">Tasa visita</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{closeRate}%</p><p className="text-xs text-muted-foreground">Tasa cierre</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <Select value={filterProperty} onValueChange={setFilterProperty}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Todas las propiedades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {properties.map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Buscar cliente..." value={filterClient} onChange={e => setFilterClient(e.target.value)} className="w-48" />
        </div>

        {/* Kanban */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                leads={filteredLeads.filter(l => l.stage === stage.key)}
                onCardClick={loadLeadDetail}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDragId ? (() => {
              const lead = leads.find(l => l.id === activeDragId);
              return lead ? (
                <Card className="w-64 shadow-lg">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-foreground">{lead.property?.title || "Propiedad"}</p>
                    <p className="text-xs text-muted-foreground">{lead.client?.full_name || "Cliente"}</p>
                  </CardContent>
                </Card>
              ) : null;
            })() : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Lead detail sheet */}
      <Sheet open={!!selectedLead} onOpenChange={open => { if (!open) setSelectedLead(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedLead?.property?.title || "Lead"}</SheetTitle>
            <SheetDescription>
              {selectedLead?.property?.currency} {Number(selectedLead?.property?.price || 0).toLocaleString("es-AR")}
            </SheetDescription>
          </SheetHeader>

          {selectedLead && (
            <div className="mt-6 space-y-6">
              {/* Stage selector */}
              <div>
                <label className="text-sm font-medium text-foreground">Etapa</label>
                <Select value={selectedLead.stage} onValueChange={val => updateStage(selectedLead.id, val as LeadStage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Client info */}
              <div>
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2"><User className="h-4 w-4" /> Cliente</h4>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedLead.client?.avatar_url || undefined} />
                    <AvatarFallback>{selectedLead.client?.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedLead.client?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedLead.client?.email}</p>
                    {selectedLead.client?.phone_mobile && (
                      <p className="text-xs text-muted-foreground">{selectedLead.client.phone_mobile}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Commission */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Comisión</h4>
                <Badge variant="outline">{selectedLead.commission_rule || "Sin regla"}</Badge>
              </div>

              <Separator />

              {/* Visits timeline */}
              <div>
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2"><Calendar className="h-4 w-4" /> Visitas</h4>
                {visits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin visitas</p>
                ) : (
                  <div className="space-y-2">
                    {visits.map((v: any) => (
                      <div key={v.id} className="flex items-center gap-2 text-sm">
                        <Badge variant={v.status === "COMPLETED" ? "default" : "secondary"} className="text-xs">{v.status}</Badge>
                        <span className="text-muted-foreground">{new Date(v.scheduled_at).toLocaleDateString("es-AR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Messages */}
              <div>
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2"><MessageSquare className="h-4 w-4" /> Mensajes</h4>
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin mensajes</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {messages.map((m: any) => (
                      <div key={m.id} className="p-2 rounded bg-muted text-sm">
                        <p className="text-foreground">{m.body}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("es-AR")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={() => navigate(`/corredor/leads/${selectedLead.id}`)}>
                  Ver detalle completo
                </Button>
                <Button variant="destructive" onClick={() => setLostOpen(true)}>
                  <XCircle className="mr-2 h-4 w-4" /> Marcar como perdido
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
    </div>
  );
}
