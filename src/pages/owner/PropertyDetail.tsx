import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Home,
  Edit,
  Users,
  Eye,
  Calendar,
  Clock,
  FileText,
  MapPin,
  Bath,
  Car,
  Maximize,
  Save,
} from "lucide-react";
import type { Property, PropertyPhoto, MandateStatus, VisitStatus } from "@/types/database";

interface TimelineEvent {
  id: string;
  type: "lead" | "visit" | "status_change";
  description: string;
  date: string;
}

interface PendingVisit {
  id: string;
  scheduled_at: string;
  lead_id: string;
  status: VisitStatus;
}

export default function OwnerPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [property, setProperty] = useState<Property | null>(null);
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [pendingVisits, setPendingVisits] = useState<PendingVisit[]>([]);
  const [mandateStatus, setMandateStatus] = useState<MandateStatus | null>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [visitCount, setVisitCount] = useState(0);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoading(true);

      const { data: prop } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .eq("owner_id", user.id)
        .single();

      if (!prop) {
        setLoading(false);
        return;
      }
      setProperty(prop as Property);
      setDescription(prop.description || "");

      // Parallel fetches
      const [
        { data: pPhotos },
        { data: mandates },
        { data: leads },
      ] = await Promise.all([
        supabase
          .from("property_photos")
          .select("*")
          .eq("property_id", id)
          .order("order_index"),
        supabase
          .from("mandates")
          .select("status")
          .eq("property_id", id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("leads")
          .select("id, stage, created_at")
          .eq("property_id", id),
      ]);

      setPhotos((pPhotos as PropertyPhoto[]) || []);
      setMandateStatus(
        mandates && mandates.length > 0
          ? (mandates[0].status as MandateStatus)
          : null
      );

      const propLeads = leads || [];
      setLeadCount(propLeads.filter((l: any) => !["CLOSED", "LOST"].includes(l.stage)).length);

      // Build timeline events from leads
      const events: TimelineEvent[] = propLeads.map((l: any) => ({
        id: `lead-${l.id}`,
        type: "lead" as const,
        description: `Nuevo lead (etapa: ${l.stage})`,
        date: l.created_at,
      }));

      // Fetch visits for these leads
      if (propLeads.length > 0) {
        const leadIds = propLeads.map((l: any) => l.id);
        const { data: allVisits } = await supabase
          .from("visits")
          .select("id, lead_id, scheduled_at, status, completed_at")
          .in("lead_id", leadIds);

        if (allVisits) {
          const completed = allVisits.filter((v: any) => v.status === "COMPLETED");
          setVisitCount(completed.length);

          const pending = allVisits.filter((v: any) =>
            ["PENDING", "CONFIRMED"].includes(v.status)
          );
          setPendingVisits(
            pending.map((v: any) => ({
              id: v.id,
              scheduled_at: v.scheduled_at,
              lead_id: v.lead_id,
              status: v.status as VisitStatus,
            }))
          );

          for (const v of allVisits) {
            events.push({
              id: `visit-${v.id}`,
              type: "visit",
              description:
                v.status === "COMPLETED"
                  ? "Visita realizada"
                  : v.status === "CANCELLED"
                  ? "Visita cancelada"
                  : `Visita ${v.status === "CONFIRMED" ? "confirmada" : "pendiente"}`,
              date: v.completed_at || v.scheduled_at,
            });
          }
        }
      }

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimeline(events.slice(0, 20));
      setLoading(false);
    })();
  }, [id, user]);

  const handleSaveDescription = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("properties")
      .update({ description })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Guardado", description: "Descripción actualizada." });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground">Propiedad no encontrada</p>
        <Button variant="outline" onClick={() => navigate("/dueno/portal")}>
          Volver al portal
        </Button>
      </div>
    );
  }

  const daysOnMarket = Math.floor(
    (Date.now() - new Date(property.created_at).getTime()) / 86400000
  );

  const eventIcon = (type: string) => {
    if (type === "lead") return <Users className="h-4 w-4 text-primary" />;
    if (type === "visit") return <Eye className="h-4 w-4 text-primary" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/dueno/portal")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al portal
        </Button>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6 rounded-lg overflow-hidden">
            {photos.slice(0, 6).map((photo) => (
              <div key={photo.id} className="aspect-video bg-muted">
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Title & badges */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{property.title}</h1>
            {property.address_street && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" />
                {property.address_street}, {property.address_city}
              </p>
            )}
            <p className="text-xl font-semibold text-primary mt-1">
              {property.currency} {property.price.toLocaleString("es-AR")}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={
              property.status === "ACTIVE"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }
          >
            {property.status}
          </Badge>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: "Leads activos", value: leadCount },
            { icon: Eye, label: "Visitas realizadas", value: visitCount },
            { icon: Clock, label: "Días en mercado", value: daysOnMarket },
            {
              icon: FileText,
              label: "Mandato",
              value: mandateStatus
                ? mandateStatus === "ACTIVE"
                  ? "Activo"
                  : mandateStatus === "EXPIRED"
                  ? "Vencido"
                  : mandateStatus
                : "Sin mandato",
            },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="py-3 text-center">
                <Icon className="mx-auto h-4 w-4 text-primary mb-1" />
                <p className="text-lg font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Details */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Características</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {property.rooms != null && (
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{property.rooms} ambiente{property.rooms !== 1 && "s"}</span>
                </div>
              )}
              {property.bathrooms != null && (
                <div className="flex items-center gap-2">
                  <Bath className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{property.bathrooms} baño{property.bathrooms !== 1 && "s"}</span>
                </div>
              )}
              {property.parking != null && (
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{property.parking} cochera{property.parking !== 1 && "s"}</span>
                </div>
              )}
              {property.surface_total != null && (
                <div className="flex items-center gap-2">
                  <Maximize className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{property.surface_total} m² totales</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Editable description */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit className="h-4 w-4" /> Descripción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Escribí una descripción de tu propiedad..."
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Podés editar la descripción y fotos. Para cambios de precio, contactá a tu corredor.
              </p>
              <Button
                size="sm"
                onClick={handleSaveDescription}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pending visits */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Visitas pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay visitas pendientes</p>
              ) : (
                <div className="space-y-2">
                  {pendingVisits.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                    >
                      <span className="text-foreground">
                        {new Date(v.scheduled_at).toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          v.status === "CONFIRMED"
                            ? "bg-primary/10 text-primary"
                            : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {v.status === "CONFIRMED" ? "Confirmada" : "Pendiente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" /> Actividad reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin actividad aún</p>
              ) : (
                <div className="space-y-3">
                  {timeline.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="mt-0.5">{eventIcon(event.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
