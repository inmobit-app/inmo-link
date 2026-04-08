import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Bed, Bath, Car, Maximize, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
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

function PropertyMap({ lat, lng, token }: { lat: number; lng: number; token: string }) {
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
        zoom: 15,
        interactive: false,
      });
      new mapboxgl.default.Marker().setLngLat([lng, lat]).addTo(map);
    });
    return () => map?.remove();
  }, [lat, lng, token]);

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
  const [visitNote, setVisitNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    };
    load();
  }, [id]);

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

  const requestVisit = async () => {
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

      if (existingLead) {
        toast({ title: "Ya solicitaste una visita para esta propiedad" });
        setVisitOpen(false);
        return;
      }

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

      await supabase.from("visits").insert({
        lead_id: newLead.id,
        scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(),
        status: "PENDING",
      });

      if (visitNote.trim()) {
        await supabase.from("messages").insert({
          lead_id: newLead.id,
          sender_id: session.user.id,
          body: visitNote.trim(),
        });
      }

      toast({ title: "Solicitud enviada", description: "El corredor te contactará pronto." });
      setVisitOpen(false);
      setVisitNote("");
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

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Gallery */}
      <div className="relative bg-card">
        <div className="mx-auto max-w-5xl">
          {photos.length > 0 ? (
            <div className="relative">
              <img
                src={photos[currentPhoto]?.url}
                alt={property.title}
                className="w-full h-72 sm:h-96 object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhoto((c) => (c - 1 + photos.length) % photos.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background text-foreground"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPhoto((c) => (c + 1) % photos.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background text-foreground"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPhoto(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === currentPhoto ? "bg-primary scale-125" : "bg-background/60"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full h-72 bg-muted flex items-center justify-center text-muted-foreground">
              Sin fotos
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={STATUS_COLORS[property.status] || ""}>{STATUS_LABELS[property.status] || property.status}</Badge>
                <span className="text-sm text-muted-foreground">
                  {property.operation === "SALE" ? "Venta" : "Alquiler"}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{property.title}</h1>
              {property.address_street && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" />
                  {[property.address_street, property.address_city, property.address_province].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="text-3xl font-bold text-primary mt-3">
                {property.currency} {Number(property.price).toLocaleString("es-AR")}
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {property.rooms != null && property.rooms > 0 && (
                <div className="flex items-center gap-2 text-foreground">
                  <Bed className="h-5 w-5 text-muted-foreground" />
                  <span>{property.rooms} amb.</span>
                </div>
              )}
              {property.bathrooms != null && property.bathrooms > 0 && (
                <div className="flex items-center gap-2 text-foreground">
                  <Bath className="h-5 w-5 text-muted-foreground" />
                  <span>{property.bathrooms} baño{property.bathrooms > 1 ? "s" : ""}</span>
                </div>
              )}
              {property.parking != null && property.parking > 0 && (
                <div className="flex items-center gap-2 text-foreground">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  <span>{property.parking} cochera{property.parking > 1 ? "s" : ""}</span>
                </div>
              )}
              {property.surface_total != null && (
                <div className="flex items-center gap-2 text-foreground">
                  <Maximize className="h-5 w-5 text-muted-foreground" />
                  <span>{property.surface_total} m² tot.</span>
                </div>
              )}
              {property.surface_covered != null && (
                <div className="flex items-center gap-2 text-foreground">
                  <Maximize className="h-5 w-5 text-muted-foreground" />
                  <span>{property.surface_covered} m² cub.</span>
                </div>
              )}
            </div>

            {amenities.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {amenities.map(([k]) => (
                      <Badge key={k} variant="secondary">{AMENITY_LABELS[k] || k}</Badge>
                    ))}
                  </div>
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
                  <PropertyMap lat={property.address_lat} lng={property.address_lng} token={mapToken} />
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
                  <p className="text-xs text-muted-foreground">
                    Los datos de contacto se revelan una vez que agendás una visita.
                  </p>
                </CardContent>
              </Card>
            )}

            {property.status === "ACTIVE" && (
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  if (!session) {
                    navigate(`/login?redirect=/propiedad/${property.id}`);
                    return;
                  }
                  if (userRole !== "CLIENT") {
                    toast({ title: "Solo clientes pueden solicitar visitas", variant: "destructive" });
                    return;
                  }
                  setVisitOpen(true);
                }}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Quiero visitar esta propiedad
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar visita</DialogTitle>
            <DialogDescription>Dejale un mensaje al corredor con tu disponibilidad.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ej: Me gustaría visitar el sábado por la tarde..."
            value={visitNote}
            onChange={(e) => setVisitNote(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitOpen(false)}>Cancelar</Button>
            <Button onClick={requestVisit} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
