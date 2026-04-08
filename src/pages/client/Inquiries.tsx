import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MessageSquare, Phone, Lock } from "lucide-react";
import LeadChat from "@/components/chat/LeadChat";

const STAGE_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  VISIT_SCHEDULED: "Visita agendada",
  VISITED: "Visitado",
  OFFER: "Oferta",
  RESERVED: "Reservado",
  CLOSED: "Cerrado",
  LOST: "Perdido",
};

interface InquiryLead {
  id: string;
  stage: string;
  created_at: string;
  property: { id: string; title: string; price: number; currency: string; address_street: string | null; address_city: string | null; cover_url?: string } | null;
  broker: { id: string; full_name: string; avatar_url: string | null; phone_mobile: string | null; email: string } | null;
  hasCompletedVisit: boolean;
}

export default function Inquiries() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<InquiryLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<InquiryLead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, stage, created_at, property_id, capturing_broker_id")
        .eq("client_id", user.id)
        .neq("stage", "LOST")
        .order("created_at", { ascending: false });

      if (!leadsData?.length) { setLoading(false); return; }

      const propertyIds = [...new Set(leadsData.map(l => l.property_id))];
      const brokerIds = [...new Set(leadsData.map(l => l.capturing_broker_id).filter(Boolean))];
      const leadIds = leadsData.map(l => l.id);

      const [{ data: props }, { data: brokers }, { data: covers }, { data: completedVisits }] = await Promise.all([
        supabase.from("properties").select("id, title, price, currency, address_street, address_city").in("id", propertyIds),
        brokerIds.length ? supabase.from("users").select("id, full_name, avatar_url, phone_mobile, email").in("id", brokerIds) : Promise.resolve({ data: [] }),
        supabase.from("property_photos").select("property_id, url").in("property_id", propertyIds).eq("is_cover", true),
        supabase.from("visits").select("lead_id").in("lead_id", leadIds).eq("status", "COMPLETED"),
      ]);

      const propsMap = new Map((props || []).map(p => [p.id, p]));
      const brokersMap = new Map((brokers || []).map(b => [b.id, b]));
      const coversMap = new Map((covers || []).map(c => [c.property_id, c.url]));
      const completedLeadIds = new Set((completedVisits || []).map(v => v.lead_id));

      const enriched: InquiryLead[] = leadsData.map(l => {
        const prop = propsMap.get(l.property_id);
        return {
          id: l.id,
          stage: l.stage,
          created_at: l.created_at,
          property: prop ? { ...prop, cover_url: coversMap.get(prop.id) } : null,
          broker: l.capturing_broker_id ? brokersMap.get(l.capturing_broker_id) || null : null,
          hasCompletedVisit: completedLeadIds.has(l.id),
        };
      });

      setLeads(enriched);
      setLoading(false);
    };
    load();
  }, [user]);

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
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/buscar")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Mis Consultas</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          {/* Lead list */}
          <div className="space-y-3 overflow-y-auto lg:col-span-1">
            {leads.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No tenés consultas activas.</p>
            )}
            {leads.map(lead => (
              <Card
                key={lead.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${selectedLead?.id === lead.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSelectedLead(lead)}
              >
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {lead.property?.cover_url ? (
                      <img src={lead.property.cover_url} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs flex-shrink-0">
                        Sin foto
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{lead.property?.title || "Propiedad"}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.property?.address_city}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{STAGE_LABELS[lead.stage] || lead.stage}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chat / Detail */}
          <div className="lg:col-span-2 flex flex-col border rounded-lg bg-card overflow-hidden">
            {selectedLead ? (
              <>
                {/* Header */}
                <div className="border-b p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedLead.broker?.avatar_url || undefined} />
                    <AvatarFallback>{selectedLead.broker?.full_name?.charAt(0) || "C"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{selectedLead.broker?.full_name || "Corredor"}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedLead.property?.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedLead.hasCompletedVisit && selectedLead.broker?.phone_mobile ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${selectedLead.broker.phone_mobile}`}>
                          <Phone className="h-4 w-4 mr-1" /> Llamar
                        </a>
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Contacto bloqueado
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Chat */}
                <LeadChat leadId={selectedLead.id} className="flex-1 min-h-0" />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40" />
                  <p className="text-sm">Seleccioná una consulta para ver el chat</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
