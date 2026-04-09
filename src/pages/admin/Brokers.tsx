import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, ShieldOff } from "lucide-react";

interface BrokerRow {
  id: string;
  full_name: string;
  email: string;
  license_number: string | null;
  is_active: boolean;
  properties_count: number;
  active_leads: number;
  closed_ops: number;
  bypass_attempts: number;
}

export default function AdminBrokers() {
  const { toast } = useToast();
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name, email, license_number, is_active")
        .eq("role", "BROKER")
        .order("created_at", { ascending: false });
      if (!users) { setLoading(false); return; }

      const brokerIds = users.map(u => u.id);

      const [{ data: props }, { data: leads }, { data: audits }] = await Promise.all([
        supabase.from("properties").select("id, broker_id").in("broker_id", brokerIds),
        supabase.from("leads").select("id, capturing_broker_id, stage").in("capturing_broker_id", brokerIds),
        supabase.from("audit_log").select("id, record_id").eq("action", "BRIDGE_ATTEMPT").in("record_id", brokerIds),
      ]);

      const propCount = new Map<string, number>();
      (props || []).forEach(p => propCount.set(p.broker_id!, (propCount.get(p.broker_id!) || 0) + 1));

      const leadActive = new Map<string, number>();
      const leadClosed = new Map<string, number>();
      (leads || []).forEach(l => {
        if (l.stage === "CLOSED") leadClosed.set(l.capturing_broker_id!, (leadClosed.get(l.capturing_broker_id!) || 0) + 1);
        else if (!["LOST"].includes(l.stage)) leadActive.set(l.capturing_broker_id!, (leadActive.get(l.capturing_broker_id!) || 0) + 1);
      });

      const bypassCount = new Map<string, number>();
      (audits || []).forEach(a => bypassCount.set(a.record_id!, (bypassCount.get(a.record_id!) || 0) + 1));

      setBrokers(users.map(u => ({
        ...u,
        properties_count: propCount.get(u.id) || 0,
        active_leads: leadActive.get(u.id) || 0,
        closed_ops: leadClosed.get(u.id) || 0,
        bypass_attempts: bypassCount.get(u.id) || 0,
      })));
      setLoading(false);
    })();
  }, []);

  const toggleLicense = async (b: BrokerRow) => {
    const newLicense = b.license_number ? null : "VERIFICADO";
    const { error } = await supabase.from("users").update({ license_number: newLicense }).eq("id", b.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: b.license_number ? "Verificación revocada" : "Matrícula verificada" });
    setBrokers(brokers.map(br => br.id === b.id ? { ...br, license_number: newLicense } : br));
  };

  const filtered = brokers.filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return b.full_name.toLowerCase().includes(s) || b.email.toLowerCase().includes(s);
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Gestión de Corredores</h1>

        <Input placeholder="Buscar corredor..." value={search} onChange={e => setSearch(e.target.value)} className="w-64" />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Propiedades</TableHead>
                  <TableHead>Leads activos</TableHead>
                  <TableHead>Cierres</TableHead>
                  <TableHead>Puenteos</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin corredores</TableCell></TableRow>
                ) : (
                  filtered.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-foreground">{b.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{b.email}</TableCell>
                      <TableCell>
                        {b.license_number ? (
                          <Badge className="bg-primary/10 text-primary"><ShieldCheck className="h-3 w-3 mr-1" /> Verificada</Badge>
                        ) : (
                          <Badge variant="outline">Sin verificar</Badge>
                        )}
                      </TableCell>
                      <TableCell>{b.properties_count}</TableCell>
                      <TableCell>{b.active_leads}</TableCell>
                      <TableCell>{b.closed_ops}</TableCell>
                      <TableCell>
                        {b.bypass_attempts > 0 ? (
                          <Badge variant="destructive">{b.bypass_attempts}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => toggleLicense(b)}>
                          {b.license_number ? <><ShieldOff className="h-3 w-3 mr-1" /> Revocar</> : <><ShieldCheck className="h-3 w-3 mr-1" /> Verificar</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
