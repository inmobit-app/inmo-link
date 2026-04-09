import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Home,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  FileText,
  Shield,
} from "lucide-react";

interface KPIs {
  activeUsers: number;
  activeProperties: number;
  monthLeads: number;
  closedOps: number;
  commissionsGenerated: number;
}

interface RecentClose {
  id: string;
  property_title: string;
  amount: number;
  currency: string;
  closed_at: string;
  rule: string;
}

interface Alert {
  id: string;
  type: "mandate_expiring" | "dispute" | "bypass";
  message: string;
  date: string;
}

export default function AdminDashboard() {
  const [kpis, setKpis] = useState<KPIs>({ activeUsers: 0, activeProperties: 0, monthLeads: 0, closedOps: 0, commissionsGenerated: 0 });
  const [recentCloses, setRecentCloses] = useState<RecentClose[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthISO = monthStart.toISOString();

      const [
        { count: usersCount },
        { count: propsCount },
        { count: leadsCount },
        { data: closedLeads },
        { data: comms },
        { data: expiringMandates },
        { data: disputes },
        { data: bypassLogs },
      ] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("properties").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
        supabase.from("leads").select("*", { count: "exact", head: true }).gte("created_at", monthISO),
        supabase.from("leads").select("id, property_id, updated_at").eq("stage", "CLOSED").order("updated_at", { ascending: false }).limit(10),
        supabase.from("commissions").select("id, total_amount, property_id, rule, created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("mandates").select("id, property_id, end_date, status").eq("status", "ACTIVE").not("end_date", "is", null),
        supabase.from("commissions").select("id, property_id, created_at").eq("status", "DISPUTED"),
        supabase.from("audit_log").select("id, action, created_at, record_id").eq("action", "BRIDGE_ATTEMPT").order("created_at", { ascending: false }).limit(5),
      ]);

      // KPIs
      const totalCommissions = (comms || []).reduce((s, c) => s + c.total_amount, 0);
      setKpis({
        activeUsers: usersCount || 0,
        activeProperties: propsCount || 0,
        monthLeads: leadsCount || 0,
        closedOps: (closedLeads || []).length,
        commissionsGenerated: totalCommissions,
      });

      // Recent closes with property titles
      if (comms && comms.length > 0) {
        const propIds = [...new Set(comms.map(c => c.property_id))];
        const { data: props } = await supabase.from("properties").select("id, title, currency").in("id", propIds);
        const propMap = new Map((props || []).map(p => [p.id, p]));
        setRecentCloses(comms.map(c => {
          const prop = propMap.get(c.property_id);
          return {
            id: c.id,
            property_title: prop?.title || "—",
            amount: c.total_amount,
            currency: prop?.currency || "USD",
            closed_at: c.created_at,
            rule: c.rule,
          };
        }));
      }

      // Alerts
      const alertList: Alert[] = [];
      const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString();
      (expiringMandates || []).forEach(m => {
        if (m.end_date && m.end_date <= thirtyDaysLater) {
          alertList.push({
            id: `mandate-${m.id}`,
            type: "mandate_expiring",
            message: `Mandato por vencer el ${new Date(m.end_date).toLocaleDateString("es-AR")}`,
            date: m.end_date,
          });
        }
      });
      (disputes || []).forEach(d => {
        alertList.push({
          id: `dispute-${d.id}`,
          type: "dispute",
          message: "Disputa de comisión abierta",
          date: d.created_at,
        });
      });
      (bypassLogs || []).forEach(b => {
        alertList.push({
          id: `bypass-${b.id}`,
          type: "bypass",
          message: "Intento de puenteo detectado",
          date: b.created_at,
        });
      });
      setAlerts(alertList.slice(0, 10));
      setLoading(false);
    })();
  }, []);

  const alertIcon = (type: string) => {
    if (type === "mandate_expiring") return <FileText className="h-4 w-4 text-yellow-600" />;
    if (type === "dispute") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <Shield className="h-4 w-4 text-destructive" />;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { icon: Users, label: "Usuarios activos", value: kpis.activeUsers },
            { icon: Home, label: "Propiedades activas", value: kpis.activeProperties },
            { icon: TrendingUp, label: "Leads del mes", value: kpis.monthLeads },
            { icon: DollarSign, label: "Operaciones cerradas", value: kpis.closedOps },
            { icon: DollarSign, label: "Comisiones generadas", value: `$${kpis.commissionsGenerated.toLocaleString("es-AR")}` },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-4 text-center">
                <Icon className="mx-auto h-5 w-5 text-primary mb-1" />
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent closings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Operaciones recientes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Propiedad</TableHead>
                    <TableHead>Regla</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCloses.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin operaciones</TableCell></TableRow>
                  ) : (
                    recentCloses.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-foreground">{c.property_title}</TableCell>
                        <TableCell><Badge variant="outline">{c.rule}</Badge></TableCell>
                        <TableCell>{c.currency} {c.amount.toLocaleString("es-AR")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(c.closed_at).toLocaleDateString("es-AR")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin alertas</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-2 rounded-md bg-muted/50">
                      {alertIcon(a.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{a.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.date).toLocaleDateString("es-AR")}
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
    </AdminLayout>
  );
}
