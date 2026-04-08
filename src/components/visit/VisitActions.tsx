import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar, CheckCircle, XCircle, Clock, MapPin } from "lucide-react";
import type { Visit, VisitStatus } from "@/types/database";

const STATUS_CONFIG: Record<VisitStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  CONFIRMED: { label: "Confirmada", variant: "default" },
  COMPLETED: { label: "Realizada", variant: "outline" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
};

interface VisitActionsProps {
  visits: Visit[];
  leadId: string;
  isBroker: boolean;
  onUpdate: () => void;
}

export default function VisitActions({ visits, leadId, isBroker, onUpdate }: VisitActionsProps) {
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelVisitId, setCancelVisitId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackVisitId, setFeedbackVisitId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [processing, setProcessing] = useState(false);

  const confirmVisit = async (visit: Visit) => {
    setProcessing(true);
    const { error } = await supabase.from("visits").update({
      status: "CONFIRMED",
      confirmed_at: new Date().toISOString(),
    }).eq("id", visit.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Advance lead to VISIT_SCHEDULED
      await supabase.from("leads").update({ stage: "VISIT_SCHEDULED", updated_at: new Date().toISOString() }).eq("id", leadId);
      // Create notification for client
      const { data: lead } = await supabase.from("leads").select("client_id").eq("id", leadId).single();
      if (lead) {
        await supabase.from("notifications").insert({
          user_id: lead.client_id,
          type: "VISIT_CONFIRMED",
          title: "Visita confirmada",
          body: `Tu visita fue confirmada para el ${format(new Date(visit.scheduled_at), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}`,
          data: { lead_id: leadId, visit_id: visit.id },
        });
      }
      toast({ title: "Visita confirmada" });
      onUpdate();
    }
    setProcessing(false);
  };

  const completeVisit = async (visitId: string) => {
    setProcessing(true);
    const feedbackField = isBroker ? "feedback_broker" : "feedback_client";
    const update: any = {
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
    };
    if (feedback.trim()) update[feedbackField] = feedback.trim();

    const { error } = await supabase.from("visits").update(update).eq("id", visitId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Advance lead to VISITED
      await supabase.from("leads").update({ stage: "VISITED", updated_at: new Date().toISOString() }).eq("id", leadId);
      toast({ title: "Visita marcada como realizada", description: "Se desbloqueó la información de contacto del corredor." });
      onUpdate();
    }
    setFeedbackOpen(false);
    setFeedback("");
    setProcessing(false);
  };

  const cancelVisit = async () => {
    if (!cancelVisitId || !cancelReason.trim()) return;
    setProcessing(true);
    const { error } = await supabase.from("visits").update({
      status: "CANCELLED",
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason.trim(),
    }).eq("id", cancelVisitId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Notify the other party
      const { data: lead } = await supabase.from("leads").select("client_id, capturing_broker_id").eq("id", leadId).single();
      if (lead) {
        const recipientId = isBroker ? lead.client_id : lead.capturing_broker_id;
        if (recipientId) {
          await supabase.from("notifications").insert({
            user_id: recipientId,
            type: "VISIT_CANCELLED",
            title: isBroker ? "El corredor canceló la visita" : "El cliente canceló la visita",
            body: `Motivo: ${cancelReason.trim()}`,
            data: { lead_id: leadId, visit_id: cancelVisitId },
          });
        }
      }
      toast({ title: "Visita cancelada" });
      onUpdate();
    }
    setCancelOpen(false);
    setCancelReason("");
    setCancelVisitId(null);
    setProcessing(false);
  };

  const addFeedback = async (visitId: string) => {
    if (!feedback.trim()) return;
    setProcessing(true);
    const feedbackField = isBroker ? "feedback_broker" : "feedback_client";
    await supabase.from("visits").update({ [feedbackField]: feedback.trim() }).eq("id", visitId);
    toast({ title: "Feedback guardado" });
    setFeedbackOpen(false);
    setFeedback("");
    setProcessing(false);
    onUpdate();
  };

  if (visits.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Visitas</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Sin visitas registradas</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Visitas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {visits.map(v => {
            const cfg = STATUS_CONFIG[v.status];
            return (
              <div key={v.id} className="p-3 rounded-lg bg-muted space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {format(new Date(v.scheduled_at), "EEEE d MMM, HH:mm", { locale: es })}
                    </span>
                  </div>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                </div>

                {v.confirmed_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Confirmada {format(new Date(v.confirmed_at), "d MMM HH:mm", { locale: es })}
                  </p>
                )}
                {v.completed_at && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Realizada {format(new Date(v.completed_at), "d MMM HH:mm", { locale: es })}
                  </p>
                )}
                {v.cancel_reason && (
                  <p className="text-xs text-destructive">Motivo cancelación: {v.cancel_reason}</p>
                )}
                {v.feedback_broker && (
                  <p className="text-xs text-muted-foreground">Feedback corredor: "{v.feedback_broker}"</p>
                )}
                {v.feedback_client && (
                  <p className="text-xs text-muted-foreground">Feedback cliente: "{v.feedback_client}"</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap pt-1">
                  {isBroker && v.status === "PENDING" && (
                    <Button size="sm" onClick={() => confirmVisit(v)} disabled={processing}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Confirmar
                    </Button>
                  )}
                  {isBroker && v.status === "CONFIRMED" && (
                    <Button size="sm" onClick={() => { setFeedbackVisitId(v.id); setFeedbackOpen(true); }} disabled={processing}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Marcar realizada
                    </Button>
                  )}
                  {!isBroker && v.status === "COMPLETED" && !v.feedback_client && (
                    <Button size="sm" variant="outline" onClick={() => { setFeedbackVisitId(v.id); setFeedbackOpen(true); }}>
                      Dejar feedback
                    </Button>
                  )}
                  {(v.status === "PENDING" || v.status === "CONFIRMED") && (
                    <Button size="sm" variant="destructive" onClick={() => { setCancelVisitId(v.id); setCancelOpen(true); }} disabled={processing}>
                      <XCircle className="h-3 w-3 mr-1" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar visita</DialogTitle>
            <DialogDescription>Indicá el motivo de la cancelación.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Motivo..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Volver</Button>
            <Button variant="destructive" onClick={cancelVisit} disabled={!cancelReason.trim() || processing}>Confirmar cancelación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete / Feedback dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBroker ? "Marcar visita como realizada" : "Feedback de la visita"}</DialogTitle>
            <DialogDescription>
              {isBroker
                ? "Se registrará la visita como completada y se desbloqueará tu contacto para el cliente."
                : "Contanos cómo fue la visita."
              }
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Comentarios..." value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancelar</Button>
            {isBroker ? (
              <Button onClick={() => feedbackVisitId && completeVisit(feedbackVisitId)} disabled={processing}>
                Confirmar realizada
              </Button>
            ) : (
              <Button onClick={() => feedbackVisitId && addFeedback(feedbackVisitId)} disabled={!feedback.trim() || processing}>
                Enviar feedback
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
