import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Home,
  User,
  LogOut,
  Plus,
  Eye,
  Users,
  Calendar,
  Clock,
  TrendingUp,
} from "lucide-react";
import type { PropertyStatus, MandateStatus } from "@/types/database";

interface PropertyMetrics {
  id: string;
  title: string;
  status: PropertyStatus;
  price: number;
  currency: string;
  cover_url: string | null;
  created_at: string;
  active_leads: number;
  completed_visits: number;
  recent_inquiries: number;
  mandate_status: MandateStatus | null;
  mandate_end_date: string | null;
  days_on_market: number;
}

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
  RESERVED: "bg-yellow-100 text-yellow-800",
  SOLD: "bg-green-100 text-green-800",
  RENTED: "bg-green-100 text-green-800",
  PAUSED: "bg-muted text-muted-foreground",
};

const MANDATE_LABELS: Record<MandateStatus, string> = {
  PENDING: "Pendiente",
  ACTIVE: "Activo",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado",
};

const MANDATE_COLORS: Record<MandateStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-primary/10 text-primary",
  EXPIRED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default function OwnerPortal() {
  const { user, userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // 1. Fetch owner properties
      const { data: props } = await supabase
        .from("properties")
        .select("id, title, status, price, currency, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (!props || props.length === 0) {
        setProperties([]);
        setLoading(false);
        return;
      }

      const propIds = props.map((p: any) => p.id);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      // 2. Batch fetch related data
      const [
        { data: photos },
        { data: mandates },
        { data: leads },
        { data: visits },
      ] = await Promise.all([
        supabase
          .from("property_photos")
          .select("property_id, url")
          .in("property_id", propIds)
          .eq("is_cover", true),
        supabase
          .from("mandates")
          .select("property_id, status, end_date")
          .in("property_id", propIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("leads")
          .select("id, property_id, stage, created_at")
          .in("property_id", propIds),
        supabase
          .from("visits")
          .select("id, lead_id, status")
          .eq("status", "COMPLETED"),
      ]);

      // Build lookup maps
      const coverMap = new Map(
        (photos || []).map((p: any) => [p.property_id, p.url])
      );

      // mandate: latest per property
      const mandateMap = new Map<string, { status: MandateStatus; end_date: string | null }>();
      for (const m of mandates || []) {
        if (!mandateMap.has(m.property_id)) {
          mandateMap.set(m.property_id, { status: m.status as MandateStatus, end_date: m.end_date });
        }
      }

      // leads per property
      const leadsPerProperty = new Map<string, any[]>();
      for (const l of leads || []) {
        const arr = leadsPerProperty.get(l.property_id) || [];
        arr.push(l);
        leadsPerProperty.set(l.property_id, arr);
      }

      // visit lead ids for completed visits
      const completedVisitLeadIds = new Set((visits || []).map((v: any) => v.lead_id));

      const metrics: PropertyMetrics[] = props.map((p: any) => {
        const propLeads = leadsPerProperty.get(p.id) || [];
        const activeLeads = propLeads.filter(
          (l: any) => !["CLOSED", "LOST"].includes(l.stage)
        ).length;
        const recentInquiries = propLeads.filter(
          (l: any) => l.created_at >= thirtyDaysAgo
        ).length;

        // completed visits: count visits whose lead belongs to this property
        const propLeadIds = propLeads.map((l: any) => l.id);
        const completedVisits = propLeadIds.filter((id: string) =>
          completedVisitLeadIds.has(id)
        ).length;

        const mandate = mandateMap.get(p.id);
        const daysOnMarket = Math.floor(
          (Date.now() - new Date(p.created_at).getTime()) / 86400000
        );

        return {
          id: p.id,
          title: p.title,
          status: p.status as PropertyStatus,
          price: p.price,
          currency: p.currency,
          cover_url: coverMap.get(p.id) || null,
          created_at: p.created_at,
          active_leads: activeLeads,
          completed_visits: completedVisits,
          recent_inquiries: recentInquiries,
          mandate_status: mandate?.status || null,
          mandate_end_date: mandate?.end_date || null,
          days_on_market: daysOnMarket,
        };
      });

      setProperties(metrics);
      setLoading(false);
    })();
  }, [user]);

  const totalLeads = properties.reduce((s, p) => s + p.active_leads, 0);
  const totalVisits = properties.reduce((s, p) => s + p.completed_visits, 0);
  const activeProps = properties.filter((p) => p.status === "ACTIVE").length;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Portal del Dueño
            </h1>
            {userProfile && (
              <p className="text-muted-foreground">
                Hola, {userProfile.full_name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/perfil">
                <User className="mr-2 h-4 w-4" /> Perfil
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Home className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{activeProps}</p>
              <p className="text-xs text-muted-foreground">Activas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Users className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
              <p className="text-xs text-muted-foreground">Leads activos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Calendar className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{totalVisits}</p>
              <p className="text-xs text-muted-foreground">Visitas realizadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="mx-auto h-5 w-5 text-primary mb-1" />
              <p className="text-2xl font-bold text-foreground">{properties.length}</p>
              <p className="text-xs text-muted-foreground">Total propiedades</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <Button asChild>
            <Link to="/dueno/propiedades/nueva">
              <Plus className="mr-2 h-4 w-4" /> Publicar propiedad
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dueno/mandatos">
              <FileText className="mr-2 h-4 w-4" /> Mis mandatos
            </Link>
          </Button>
        </div>

        {/* Property List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Home className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                Todavía no tenés propiedades publicadas
              </p>
              <Button asChild>
                <Link to="/dueno/propiedades/nueva">Publicar mi primera propiedad</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {properties.map((p) => (
              <Card
                key={p.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/dueno/propiedades/${p.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-28 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {p.cover_url ? (
                        <img
                          src={p.cover_url}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground truncate">
                            {p.title}
                          </h3>
                          <p className="text-sm font-medium text-primary">
                            {p.currency} {p.price.toLocaleString("es-AR")}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Badge
                            variant="secondary"
                            className={STATUS_COLORS[p.status]}
                          >
                            {STATUS_LABELS[p.status]}
                          </Badge>
                          {p.mandate_status && (
                            <Badge
                              variant="secondary"
                              className={MANDATE_COLORS[p.mandate_status]}
                            >
                              Mandato: {MANDATE_LABELS[p.mandate_status]}
                            </Badge>
                          )}
                          {!p.mandate_status && (
                            <Badge variant="outline">Sin mandato</Badge>
                          )}
                        </div>
                      </div>

                      {/* Metrics row */}
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {p.active_leads} lead{p.active_leads !== 1 && "s"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {p.completed_visits} visita{p.completed_visits !== 1 && "s"}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {p.recent_inquiries} consulta{p.recent_inquiries !== 1 && "s"} (30d)
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {p.days_on_market} día{p.days_on_market !== 1 && "s"} en mercado
                        </span>
                        {p.mandate_end_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Vence: {new Date(p.mandate_end_date).toLocaleDateString("es-AR")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
