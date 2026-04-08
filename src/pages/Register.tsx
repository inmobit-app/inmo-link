import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "@/types/database";

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: "CLIENT", label: "Cliente", description: "Buscá propiedades, agendá visitas y chateá con tu corredor asignado." },
  { value: "BROKER", label: "Corredor", description: "Gestioná leads, propiedades, pipeline de ventas y comisiones." },
  { value: "OWNER", label: "Dueño", description: "Publicá tus propiedades, firmá mandatos y seguí métricas básicas." },
];

export default function Register() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("CLIENT");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone_mobile: phone, role },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);

    if (error) {
      toast({ variant: "destructive", title: "Error al registrarse", description: error.message });
    } else {
      toast({ title: "Cuenta creada", description: "Revisá tu email para confirmar tu cuenta." });
      navigate("/login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Crear cuenta</CardTitle>
          <CardDescription>Paso {step} de 2</CardDescription>
        </CardHeader>

        {step === 1 ? (
          <form onSubmit={handleNext}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Juan Pérez" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 11 1234-5678" />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full">Siguiente</Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
                ¿Ya tenés cuenta? Iniciá sesión
              </Link>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              <Label>¿Cuál es tu perfil?</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as UserRole)} className="space-y-3">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <RadioGroupItem value={r.value} className="mt-1" />
                    <div>
                      <p className="font-medium">{r.label}</p>
                      <p className="text-sm text-muted-foreground">{r.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                Atrás
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Creando..." : "Crear cuenta"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
