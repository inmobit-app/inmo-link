import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import StepTypeOperation from "./steps/StepTypeOperation";
import StepLocation from "./steps/StepLocation";
import StepCharacteristics from "./steps/StepCharacteristics";
import StepPhotosDescription from "./steps/StepPhotosDescription";
import type { PropertyType, OperationType } from "@/types/database";
import { ArrowLeft, ArrowRight } from "lucide-react";

export interface PropertyFormData {
  type: PropertyType | "";
  operation: OperationType | "";
  address_street: string;
  address_city: string;
  address_province: string;
  address_lat: number | null;
  address_lng: number | null;
  price: number | "";
  currency: string;
  surface_total: number | "";
  surface_covered: number | "";
  rooms: number;
  bathrooms: number;
  parking: number;
  amenities: Record<string, boolean>;
  description: string;
  title: string;
  photos: File[];
  coverIndex: number;
}

const INITIAL: PropertyFormData = {
  type: "",
  operation: "",
  address_street: "",
  address_city: "",
  address_province: "",
  address_lat: null,
  address_lng: null,
  price: "",
  currency: "USD",
  surface_total: "",
  surface_covered: "",
  rooms: 1,
  bathrooms: 1,
  parking: 0,
  amenities: {},
  description: "",
  title: "",
  photos: [],
  coverIndex: 0,
};

const STEP_LABELS = ["Tipo y operación", "Ubicación", "Características", "Fotos y descripción"];

export default function PropertyWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PropertyFormData>(INITIAL);
  const [saving, setSaving] = useState(false);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const update = (partial: Partial<PropertyFormData>) => setForm((p) => ({ ...p, ...partial }));

  const canNext = () => {
    if (step === 0) return form.type !== "" && form.operation !== "";
    if (step === 1) return form.address_street && form.address_city && form.address_province;
    if (step === 2) return form.price !== "" && Number(form.price) > 0 && form.title;
    return true;
  };

  const uploadPhotos = async (propertyId: string) => {
    const urls: { url: string; is_cover: boolean; order_index: number }[] = [];
    for (let i = 0; i < form.photos.length; i++) {
      const file = form.photos[i];
      const ext = file.name.split(".").pop();
      const path = `${propertyId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("property-photos").upload(path, file);
      if (error) {
        console.error("Upload error:", error);
        continue;
      }
      const { data: urlData } = supabase.storage.from("property-photos").getPublicUrl(path);
      urls.push({ url: urlData.publicUrl, is_cover: i === form.coverIndex, order_index: i });
    }
    if (urls.length) {
      await supabase.from("property_photos").insert(
        urls.map((u) => ({ property_id: propertyId, ...u }))
      );
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        title: form.title,
        description: form.description || null,
        type: form.type || null,
        operation: form.operation || null,
        price: Number(form.price),
        currency: form.currency,
        address_street: form.address_street || null,
        address_city: form.address_city || null,
        address_province: form.address_province || null,
        address_lat: form.address_lat,
        address_lng: form.address_lng,
        surface_total: form.surface_total ? Number(form.surface_total) : null,
        surface_covered: form.surface_covered ? Number(form.surface_covered) : null,
        rooms: form.rooms,
        bathrooms: form.bathrooms,
        parking: form.parking,
        amenities: form.amenities,
        status: publish ? "ACTIVE" : "DRAFT",
      };

      if (userRole === "BROKER") payload.broker_id = user.id;
      if (userRole === "OWNER") payload.owner_id = user.id;

      const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
      if (error) throw error;

      if (form.photos.length > 0) await uploadPhotos(data.id);

      toast({ title: publish ? "Propiedad publicada" : "Borrador guardado" });
      navigate(userRole === "BROKER" ? "/corredor/propiedades" : "/dueno/portal");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Nueva propiedad</h1>
        <Progress value={((step + 1) / 4) * 100} className="mb-2" />
        <p className="text-sm text-muted-foreground mb-6">
          Paso {step + 1} de 4 — {STEP_LABELS[step]}
        </p>

        <Card>
          <CardHeader>
            <CardTitle>{STEP_LABELS[step]}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 0 && <StepTypeOperation form={form} update={update} />}
            {step === 1 && <StepLocation form={form} update={update} />}
            {step === 2 && <StepCharacteristics form={form} update={update} />}
            {step === 3 && <StepPhotosDescription form={form} update={update} />}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
              Siguiente <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                Guardar borrador
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving || !form.title || !form.price}>
                Publicar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
