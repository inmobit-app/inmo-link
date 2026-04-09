import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import { Shield } from "lucide-react";

export default function Profile() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneMobile, setPhoneMobile] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("full_name, phone, phone_mobile, license_number, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || "");
          setPhone(data.phone || "");
          setPhoneMobile(data.phone_mobile || "");
          setLicenseNumber(data.license_number || "");
          setAvatarUrl(data.avatar_url);
        }
      });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const filePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ variant: "destructive", title: "Error al subir imagen", description: uploadError.message });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
    setAvatarUrl(publicUrl);
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const updates: Record<string, string | null> = {
      full_name: fullName,
      phone,
      phone_mobile: phoneMobile,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    };
    if (userRole === "BROKER") {
      updates.license_number = licenseNumber;
    }

    const { error } = await supabase.from("users").update(updates).eq("id", user.id);
    setSaving(false);

    if (error) {
      toast({ variant: "destructive", title: "Error al guardar", description: error.message });
    } else {
      toast({ title: "Perfil actualizado" });
    }
  };

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Mi perfil</CardTitle>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback>{initials || "?"}</AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar" className="cursor-pointer text-sm text-primary hover:underline">
                  {uploading ? "Subiendo..." : "Cambiar foto"}
                </Label>
                <input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneMobile">Celular</Label>
                <Input id="phoneMobile" type="tel" value={phoneMobile} onChange={(e) => setPhoneMobile(e.target.value)} />
              </div>
            </div>

            {userRole === "BROKER" && (
              <div className="space-y-2">
                <Label htmlFor="license">Número de matrícula</Label>
                <Input id="license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
