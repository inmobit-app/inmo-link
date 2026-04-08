import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Bed, Bath, Car, Maximize, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import VisitRequestModal from "@/components/visit/VisitRequestModal";
import type { Property, PropertyPhoto, User } from "@/types/database";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "En venta",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  RENTED: "Alquilado",
  DRAFT: "Borrador",
  PAUSED: "Pausado",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-primary/10 text-primary",
  RESERVED: "bg-accent text-accent-foreground",
  SOLD: "bg-destructive/10 text-destructive",
  RENTED: "bg-secondary text-secondary-foreground",
};

const AMENITY_LABELS: Record<string, string> = {
  pool: "Pileta",
  gym: "Gimnasio",
  security: "Seguridad 24h",
  sum: "SUM",
  grill: "Parrilla",
  garden: "Jardín",
};

function PropertyMap({ lat, lng, token, approximate }: { lat: number; lng: number; token: string; approximate?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let map: any;
    import("mapbox-gl").then((mapboxgl) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      (mapboxgl as any).accessToken = token;
      map = new mapboxgl.default.Map({
        container: ref.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lng, lat],
        zoom: approximate ? 13 : 15,
        interactive: false,
      });
      if (approximate) {
        // Show approximate circle instead of exact marker
        map.on("load", () => {
          map.addSource("approx", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "Point", coordinates: [lng, lat] },
              properties: {},
            },
          });
          map.addLayer({
            id: "approx-circle",
            type: "circle",
            source: "approx",
            paint: {
              "circle-radius": 80,
              "circle-color": "hsl(222, 47%, 11%)",
              "circle-opacity": 0.15,
              "circle-stroke-width": 2,
              "circle-stroke-color": "hsl(222, 47%, 11%)",
              "circle-stroke-opacity": 0.4,
            },
          });
        });
      } else {
        new mapboxgl.default.Marker().setLngLat([lng, lat]).addTo(map);
      }
    });
    return () => map?.remove();
  }, [lat, lng, token, approximate]);

  return <div ref={ref} className="h-56 rounded-lg border border-border" />;
}

export default function PropertyDetail() {
  const { id } = useParams();
  const { session, userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [broker, setBroker] = useState<User | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [visitOpen, setVisitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasConfirmedVisit, setHasConfirmedVisit] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: prop } = await supabase.from("properties").select("*").eq("id", id).single();
      if (!prop) { setLoading(false); return; }
      setProperty(prop as Property);

      const { data: ph } = await supabase.from("property_photos").select("*").eq("property_id", id).order("order_index");
      setPhotos((ph || []) as PropertyPhoto[]);
      const coverIdx = (ph || []).findIndex((p: any) => p.is_cover);
      if (coverIdx >= 0) setCurrentPhoto(coverIdx);

      if (prop.broker_id) {
        const { data: b } = await supabase.from("users").select("id, full_name, avatar_url").eq("id", prop.broker_id).single();
        if (b) setBroker(b as User);
      }

      // Check if current user has a confirmed visit for this property
      if (session?.user) {
        const { data: lead } = await supabase
          .from("leads")
          .select("id")
          .eq("property_id", id)
          .eq("client_id", session.user.id)
          .maybeSingle();
        if (lead) {
          const { data: confirmedV } = await supabase
            .from("visits")
            .select("id")
            .eq("lead_id", lead.id)
            .eq("status", "CONFIRMED")
            .limit(1);
          if (confirmedV?.length) setHasConfirmedVisit(true);
          // Also check completed
          const { data: completedV } = await supabase
            .from("visits")
            .select("id")
            .eq("lead_id", lead.id)
            .eq("status", "COMPLETED")
            .limit(1);
          if (completedV?.length) setHasConfirmedVisit(true);
        }
      }

      setLoading(false);
    };
    load();
  }, [id, session?.user?.id]);

  const determineCommissionRule = async (propertyId: string): Promise<string> => {
    const { data: mandate } = await supabase
      .from("mandates")
      .select("type")
      .eq("property_id", propertyId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (mandate?.type === "EXCLUSIVE") return "C_EXCLUSIVE";
    return "C_OPEN";
  };

  const requestVisit = async (slots: Date[], note: string) => {
    if (!session?.user || !property) return;
    setSubmitting(true);
    try {
      // Check for existing lead
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("property_id", property.id)
        .eq("client_id", session.user.id)
        .maybeSingle();

      let leadId: string;

      if (existingLead) {
        leadId = existingLead.id;
      } else {
        const commissionRule = await determineCommissionRule(property.id);
        const { data: newLead, error } = await supabase
          .from("leads")
          .insert({
            property_id: property.id,
            client_id: session.user.id,
            capturing_broker_id: property.broker_id,
            client_broker_id: property.broker_id,
            stage: "NEW",
            commission_rule: commissionRule,
            source: "organic",
          })
          .select("id")
          .single();
        if (error) throw error;
        leadId = newLead.id;
      }

      // Create visit entries for each proposed slot
      const visitInserts = slots.map(s => ({
        lead_id: leadId,
        scheduled_at: s.toISOString(),
        status: "PENDING" as const,
      }));
      await supabase.from("visits").insert(visitInserts);

      // Advance lead stage
      await supabase.from("leads").update({ stage: "VISIT_SCHEDULED", updated_at: new Date().toISOString() }).eq("id", leadId);

      // Send message with proposed times
      const slotsText = slots.map((s, i) => `Opción ${i + 1}: ${s.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} a las ${s.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`).join("\n");
      const body = `📅 Solicitud de visita\n${slotsText}${note ? `\n\nNota: ${note}` : ""}`;
      await supabase.from("messages").insert({ lead_id: leadId, sender_id: session.user.id, body });

      // Notify broker
      if (property.broker_id) {
        await supabase.from("notifications").insert({
          user_id: property.broker_id,
          type: "VISIT_REQUEST",
          title: "Nueva solicitud de visita",
          body: `Un cliente propuso ${slots.length} horario${slots.length > 1 ? "s" : ""} para visitar ${property.title}`,
          data: { lead_id: leadId, property_id: property.id },
        });
      }

      toast({ title: "Solicitud enviada", description: `Propusiste ${slots.length} horario${slots.length > 1 ? "s" : ""}. El corredor te confirmará pronto.` });
      setVisitOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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
        <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    );
  }

  const amenities = Object.entries(property.amenities || {}).filter(([, v]) => v);
  const mapToken = import.meta.env.VITE_MAPBOX_TOKEN;
  // Anti-bypass: show approximate location unless visit confirmed
  const showExactLocation = hasConfirmedVisit || userRole === "BROKER" || userRole === "OWNER" || userRole === "ADMIN";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Gallery */}
      <div className="relative bg-card">
        <div className="mx-auto max-w-5xl">
          {photos.length > 0 ? (
            <div className="relative">
              <img src={photos[currentPhoto]?.url} alt={property.title} className="w-full h-72 sm:h-96 object-cover" />
              {photos.length > 1 && (
                <>
                  <button onClick={() => setCurrentPhoto((c) => (c - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background text-foreground">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={() => setCurrentPhoto((c) => (c + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background text-foreground">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button key={i} onClick={() => setCurrentPhoto(i)} className={`w-2 h-2 rounded-full transition-all ${i === currentPhoto ? "bg-primary scale-125" : "bg-background/60"}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full h-72 bg-muted flex items-center justify-center text-muted-foreground">Sin fotos</div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={STATUS_COLORS[property.status] || ""}>{STATUS_LABELS[property.status] || property.status}</Badge>
                <span className="text-sm text-muted-foreground">{property.operation === "SALE" ? "Venta" : "Alquiler"}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{property.title}</h1>
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" />
                {showExactLocation
                  ? [property.address_street, property.address_city, property.address_province].filter(Boolean).join(", ")
                  : `${property.address_city || ""}${property.address_province ? `, ${property.address_province}` : ""} (zona aproximada)`
                }
              </p>
              <p className="text-3xl font-bold text-primary mt-3">{property.currency} {Number(property.price).toLocaleString("es-AR")}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {property.rooms != null && property.rooms > 0 && (
                <div className="flex items-center gap-2 text-foreground"><Bed className="h-5 w-5 text-muted-foreground" /><span>{property.rooms} amb.</span></div>
              )}
              {property.bathrooms != null && property.bathrooms > 0 && (
                <div className="flex items-center gap-2 text-foreground"><Bath className="h-5 w-5 text-muted-foreground" /><span>{property.bathrooms} baño{property.bathrooms > 1 ? "s" : ""}</span></div>
              )}
              {property.parking != null && property.parking > 0 && (
                <div className="flex items-center gap-2 text-foreground"><Car className="h-5 w-5 text-muted-foreground" /><span>{property.parking} cochera{property.parking > 1 ? "s" : ""}</span></div>
              )}
              {property.surface_total != null && (
                <div className="flex items-center gap-2 text-foreground"><Maximize className="h-5 w-5 text-muted-foreground" /><span>{property.surface_total} m² tot.</span></div>
              )}
              {property.surface_covered != null && (
                <div className="flex items-center gap-2 text-foreground"><Maximize className="h-5 w-5 text-muted-foreground" /><span>{property.surface_covered} m² cub.</span></div>
              )}
            </div>

            {amenities.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">Amenities</h3>
                  <div className="flex flex-wrap gap-2">{amenities.map(([k]) => <Badge key={k} variant="secondary">{AMENITY_LABELS[k] || k}</Badge>)}</div>
                </div>
              </>
            )}

            {property.description && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">Descripción</h3>
                  <p className="text-muted-foreground whitespace-pre-line">{property.description}</p>
                </div>
              </>
            )}

            {mapToken && property.address_lat && property.address_lng && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">Ubicación</h3>
                  {!showExactLocation && (
                    <p className="text-xs text-muted-foreground mb-2">📍 Zona aproximada — la dirección exacta se revela después de confirmar la visita.</p>
                  )}
                  <PropertyMap lat={property.address_lat} lng={property.address_lng} token={mapToken} approximate={!showExactLocation} />
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {broker && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={broker.avatar_url || undefined} />
                      <AvatarFallback>{broker.full_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">{broker.full_name}</p>
                      <p className="text-sm text-muted-foreground">Corredor asignado</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Los datos de contacto se revelan una vez que se confirma una visita.</p>
                </CardContent>
              </Card>
            )}

            {property.status === "ACTIVE" && (
              <Button className="w-full" size="lg" onClick={() => {
                if (!session) { navigate(`/login?redirect=/propiedad/${property.id}`); return; }
                if (userRole !== "CLIENT") { toast({ title: "Solo clientes pueden solicitar visitas", variant: "destructive" }); return; }
                setVisitOpen(true);
              }}>
                <Calendar className="mr-2 h-4 w-4" />
                Quiero visitar esta propiedad
              </Button>
            )}
          </div>
        </div>
      </div>

      <VisitRequestModal open={visitOpen} onOpenChange={setVisitOpen} onSubmit={requestVisit} submitting={submitting} />
    </div>
  );
}
