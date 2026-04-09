import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, X, Merge } from "lucide-react";

interface DuplicatePair {
  id: string;
  propA: { id: string; title: string; price: number; currency: string; address_street: string | null };
  propB: { id: string; title: string; price: number; currency: string; address_street: string | null };
  score: number;
}

export default function AdminDuplicates() {
  const { toast } = useToast();
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: props } = await supabase
        .from("properties")
        .select("id, title, price, currency, address_street, address_city, status")
        .in("status", ["ACTIVE", "DRAFT"]);

      if (!props || props.length < 2) { setLoading(false); return; }

      // Simple deduplication: same address + ±10% price
      const duplicates: DuplicatePair[] = [];
      for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
          const a = props[i];
          const b = props[j];
          if (!a.address_street || !b.address_street) continue;
          const addrMatch = a.address_street.toLowerCase().trim() === b.address_street.toLowerCase().trim()
            && (a.address_city || "").toLowerCase() === (b.address_city || "").toLowerCase();
          if (!addrMatch) continue;

          const priceDiff = Math.abs(a.price - b.price) / Math.max(a.price, b.price, 1);
          if (priceDiff > 0.1) continue;

          const score = Math.round((1 - priceDiff) * 100);
          duplicates.push({
            id: `${a.id}-${b.id}`,
            propA: a,
            propB: b,
            score,
          });
        }
      }

      setPairs(duplicates);
      setLoading(false);
    })();
  }, []);

  const markDuplicate = async (pair: DuplicatePair, hideId: string) => {
    const { error } = await supabase.from("properties").update({ status: "PAUSED" as any }).eq("id", hideId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("audit_log").insert({
      action: "DUPLICATE_MARKED",
      table_name: "properties",
      record_id: hideId,
      new_data: { kept: pair.propA.id === hideId ? pair.propB.id : pair.propA.id },
    });
    toast({ title: "Propiedad ocultada como duplicado" });
    setPairs(pairs.filter(p => p.id !== pair.id));
  };

  const dismiss = (pairId: string) => {
    setPairs(pairs.filter(p => p.id !== pairId));
    toast({ title: "Descartado" });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Copy className="h-6 w-6" /> Detección de Duplicados
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : pairs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No se detectaron propiedades duplicadas
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pairs.map(pair => (
              <Card key={pair.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Similitud: {pair.score}%</span>
                    <Badge variant={pair.score >= 95 ? "destructive" : "secondary"}>
                      {pair.score >= 95 ? "Muy probable" : "Posible"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {[pair.propA, pair.propB].map(p => (
                      <div key={p.id} className="p-3 rounded-md bg-muted/50 border border-border">
                        <p className="font-medium text-foreground text-sm">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.address_street}</p>
                        <p className="text-sm font-medium text-primary mt-1">{p.currency} {p.price.toLocaleString("es-AR")}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="destructive" size="sm" onClick={() => markDuplicate(pair, pair.propB.id)}>
                      Ocultar segunda
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => markDuplicate(pair, pair.propA.id)}>
                      Ocultar primera
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => dismiss(pair.id)}>
                      <X className="h-3 w-3 mr-1" /> No son duplicados
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
