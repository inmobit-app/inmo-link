import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { VisitStatus } from "@/types/database";

const STATUS_COLOR: Record<VisitStatus, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-700 border-yellow-400",
  CONFIRMED: "bg-primary/15 text-primary border-primary/40",
  COMPLETED: "bg-green-500/20 text-green-700 border-green-400",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/40",
};

const STATUS_LABEL: Record<VisitStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
};

interface EnrichedVisit {
  id: string;
  scheduled_at: string;
  status: VisitStatus;
  confirmed_at: string | null;
  lead_id: string;
  client_name: string;
  client_avatar: string | null;
  property_title: string;
  property_address: string;
}

export default function Agenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [visits, setVisits] = useState<EnrichedVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState<EnrichedVisit | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 7);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      // Get leads for this broker
      const { data: leads } = await supabase
        .from("leads")
        .select("id, client_id, property_id")
        .eq("capturing_broker_id", user.id);
      if (!leads?.length) { setVisits([]); setLoading(false); return; }

      const leadIds = leads.map(l => l.id);
      const { data: visitsData } = await supabase
        .from("visits")
        .select("*")
        .in("lead_id", leadIds)
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at");

      if (!visitsData?.length) { setVisits([]); setLoading(false); return; }

      const clientIds = [...new Set(leads.map(l => l.client_id))];
      const propertyIds = [...new Set(leads.map(l => l.property_id))];

      const [{ data: clients }, { data: properties }] = await Promise.all([
        supabase.from("users").select("id, full_name, avatar_url").in("id", clientIds),
        supabase.from("properties").select("id, title, address_street, address_city").in("id", propertyIds),
      ]);

      const clientMap = new Map((clients || []).map(c => [c.id, c]));
      const propMap = new Map((properties || []).map(p => [p.id, p]));
      const leadMap = new Map(leads.map(l => [l.id, l]));

      const enriched: EnrichedVisit[] = visitsData.map(v => {
        const lead = leadMap.get(v.lead_id);
        const client = lead ? clientMap.get(lead.client_id) : null;
        const prop = lead ? propMap.get(lead.property_id) : null;
        return {
          id: v.id,
          scheduled_at: v.scheduled_at,
          status: v.status as VisitStatus,
          confirmed_at: v.confirmed_at,
          lead_id: v.lead_id,
          client_name: client?.full_name || "Cliente",
          client_avatar: client?.avatar_url || null,
          property_title: prop?.title || "Propiedad",
          property_address: [prop?.address_street, prop?.address_city].filter(Boolean).join(", "),
        };
      });

      setVisits(enriched);
      setLoading(false);
    };
    load();
  }, [user, weekStart]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b bg-card px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/corredor/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Agenda
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(prev => addDays(prev, -7))}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Semana anterior
          </Button>
          <span className="text-sm font-medium text-foreground">
            {format(weekStart, "d MMM", { locale: es })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(prev => addDays(prev, 7))}>
            Semana siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayVisits = visits.filter(v => isSameDay(new Date(v.scheduled_at), day));
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className={`rounded-lg border p-2 min-h-[120px] ${isToday ? "border-primary bg-primary/5" : "bg-card"}`}>
                  <p className={`text-xs font-semibold mb-2 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "EEE d", { locale: es })}
                  </p>
                  <div className="space-y-1">
                    {dayVisits.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVisit(v)}
                        className={`w-full text-left p-1.5 rounded text-xs border ${STATUS_COLOR[v.status]} hover:opacity-80 transition-opacity`}
                      >
                        <p className="font-medium truncate">{format(new Date(v.scheduled_at), "HH:mm")}</p>
                        <p className="truncate opacity-80">{v.client_name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          {(Object.entries(STATUS_LABEL) as [VisitStatus, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm border ${STATUS_COLOR[key]}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Visit detail sheet */}
      <Sheet open={!!selectedVisit} onOpenChange={open => !open && setSelectedVisit(null)}>
        <SheetContent className="sm:max-w-md">
          {selectedVisit && (
            <>
              <SheetHeader>
                <SheetTitle>Detalle de visita</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={selectedVisit.client_avatar || undefined} />
                    <AvatarFallback>{selectedVisit.client_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{selectedVisit.client_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedVisit.property_title}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Fecha</span>
                    <span className="text-sm font-medium text-foreground">
                      {format(new Date(selectedVisit.scheduled_at), "EEEE d MMM, HH:mm", { locale: es })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Estado</span>
                    <Badge variant="secondary">{STATUS_LABEL[selectedVisit.status]}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Dirección</span>
                    <span className="text-sm text-foreground text-right max-w-[60%]">
                      {selectedVisit.confirmed_at ? selectedVisit.property_address : "Zona aproximada (se revela al confirmar)"}
                    </span>
                  </div>
                </div>

                <Button className="w-full" onClick={() => { navigate(`/corredor/leads/${selectedVisit.lead_id}`); setSelectedVisit(null); }}>
                  Ver detalle del lead
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
