import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Scale, Save } from "lucide-react";

interface RuleConfig {
  key: string;
  label: string;
  description: string;
  capturing: number;
  client: number;
  platform: number;
  editable: boolean;
}

const DEFAULT_RULES: RuleConfig[] = [
  { key: "A", label: "Regla A", description: "Un solo corredor (captó y trajo cliente)", capturing: 50, client: 30, platform: 20, editable: true },
  { key: "B", label: "Regla B", description: "Dos corredores distintos", capturing: 40, client: 40, platform: 20, editable: true },
  { key: "C_EXCLUSIVE", label: "C – Exclusiva", description: "Mandato exclusivo, un corredor", capturing: 50, client: 30, platform: 20, editable: true },
  { key: "C_OPEN", label: "C – Abierta", description: "Sin mandato exclusivo, variable", capturing: 10, client: 70, platform: 20, editable: true },
  { key: "D", label: "Regla D", description: "Operación fuera de plataforma", capturing: 0, client: 0, platform: 0, editable: false },
];

export default function AdminRules() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<RuleConfig[]>(DEFAULT_RULES);

  const updateRule = (key: string, field: "capturing" | "client", value: number) => {
    setRules(rules.map(r => {
      if (r.key !== key) return r;
      const updated = { ...r, [field]: value };
      updated.platform = 100 - updated.capturing - updated.client;
      return updated;
    }));
  };

  const saveRules = async () => {
    // Log changes to audit_log
    await supabase.from("audit_log").insert({
      user_id: user?.id,
      action: "COMMISSION_RULES_UPDATED",
      table_name: "commission_rules",
      new_data: Object.fromEntries(rules.map(r => [r.key, { capturing: r.capturing, client: r.client, platform: r.platform }])),
    });
    toast({ title: "Reglas guardadas", description: "Los cambios se aplicarán a nuevas comisiones." });
  };

  const valid = rules.every(r => !r.editable || (r.capturing + r.client + r.platform === 100 && r.platform >= 0));

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-6 w-6" /> Reglas de Comisión
          </h1>
          <Button onClick={saveRules} disabled={!valid}>
            <Save className="h-4 w-4 mr-2" /> Guardar cambios
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regla</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Captador %</TableHead>
                  <TableHead>Corredor cliente %</TableHead>
                  <TableHead>Plataforma %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(r => (
                  <TableRow key={r.key}>
                    <TableCell><Badge>{r.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.description}</TableCell>
                    <TableCell>
                      {r.editable ? (
                        <Input
                          type="number"
                          value={r.capturing}
                          onChange={e => updateRule(r.key, "capturing", Number(e.target.value))}
                          className="w-20"
                          min={0}
                          max={80}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.editable ? (
                        <Input
                          type="number"
                          value={r.client}
                          onChange={e => updateRule(r.key, "client", Number(e.target.value))}
                          className="w-20"
                          min={0}
                          max={80}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.platform < 0 ? "destructive" : "outline"}>
                        {r.editable ? `${r.platform}%` : "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Los porcentajes deben sumar 100%. La plataforma se calcula automáticamente. Los cambios se aplican solo a comisiones nuevas.
        </p>
      </div>
    </AdminLayout>
  );
}
