import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings, Save, Shield, Mail, Map } from "lucide-react";

export default function AdminConfig() {
  const { toast } = useToast();
  const [platformPct, setPlatformPct] = useState(20);
  const [bypassKeywords, setBypassKeywords] = useState(
    "whatsapp, telegram, por privado, pasame tu numero, te paso mi cel, mi mail es, escribime a, te dejo mi, contactame por fuera"
  );
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    // In production these would be saved to a config table
    setTimeout(() => {
      setSaving(false);
      toast({ title: "Configuración guardada" });
    }, 500);
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6" /> Configuración
          </h1>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>

        {/* Platform commission */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Comisión de plataforma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-w-xs">
              <Label>Porcentaje de la plataforma (%)</Label>
              <Input
                type="number"
                value={platformPct}
                onChange={e => setPlatformPct(Number(e.target.value))}
                min={5}
                max={50}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default: 20%. La plataforma retiene este porcentaje de cada comisión.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Anti-bypass keywords */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Filtro anti-puenteo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Palabras clave (separadas por coma)</Label>
              <Textarea
                value={bypassKeywords}
                onChange={e => setBypassKeywords(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Los mensajes que contengan estas palabras serán filtrados automáticamente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Keys info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> Variables de entorno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Las claves de API se gestionan de forma segura en Lovable Cloud → Secrets. Las siguientes variables deben estar configuradas:
            </p>
            <div className="space-y-2 text-sm">
              {[
                { name: "RESEND_API_KEY", desc: "API key de Resend para envío de emails" },
                { name: "MAPBOX_TOKEN", desc: "Token de Mapbox para mapas" },
                { name: "SUPABASE_SERVICE_ROLE_KEY", desc: "Clave de servicio de Supabase (autogenerada)" },
              ].map(v => (
                <div key={v.name} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div>
                    <code className="text-xs font-mono text-foreground">{v.name}</code>
                    <p className="text-xs text-muted-foreground">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
