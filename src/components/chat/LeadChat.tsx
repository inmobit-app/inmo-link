import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Check, CheckCheck, ShieldAlert } from "lucide-react";

interface Message {
  id: string;
  lead_id: string;
  sender_id: string;
  body: string;
  is_filtered: boolean;
  filter_reason: string | null;
  read_at: string | null;
  created_at: string;
}

interface LeadChatProps {
  leadId: string;
  className?: string;
}

export default function LeadChat({ leadId, className = "" }: LeadChatProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    if (!leadId) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      // Filter out filtered messages that aren't from current user
      const visible = (data || []).filter(
        (m: any) => !m.is_filtered || m.sender_id === user?.id
      );
      setMessages(visible as Message[]);
    };
    load();
  }, [leadId, user?.id]);

  // Mark messages as read
  useEffect(() => {
    if (!user?.id || !messages.length) return;
    const unread = messages.filter(m => m.sender_id !== user.id && !m.read_at && !m.is_filtered);
    if (unread.length === 0) return;
    
    const ids = unread.map(m => m.id);
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .then(() => {
        setMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m));
      });
  }, [messages, user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`messages:${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only show if it's not filtered OR is from current user
          if (!newMsg.is_filtered || newMsg.sender_id === user?.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, read_at: updated.read_at } : m));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leadId, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !session?.access_token || sending) return;
    setSending(true);

    try {
      const res = await supabase.functions.invoke("filter-message", {
        body: { lead_id: leadId, body: text.trim() },
      });

      if (res.error) throw new Error(res.error.message);

      const data = res.data;
      if (data.filtered) {
        toast({
          title: "Mensaje bloqueado",
          description: data.message,
          variant: "destructive",
        });
      }
      setText("");
    } catch (e: any) {
      toast({ title: "Error al enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay mensajes aún. ¡Iniciá la conversación!
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  msg.is_filtered
                    ? "bg-destructive/10 border border-destructive/30"
                    : isMine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                }`}
              >
                {msg.is_filtered && (
                  <div className="flex items-center gap-1 mb-1">
                    <ShieldAlert className="h-3 w-3 text-destructive" />
                    <span className="text-xs text-destructive font-medium">Bloqueado</span>
                  </div>
                )}
                <p className={msg.is_filtered ? "text-muted-foreground line-through" : ""}>{msg.body}</p>
                <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
                  <span className={`text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isMine && !msg.is_filtered && (
                    msg.read_at ? (
                      <CheckCheck className={`h-3 w-3 text-primary-foreground/60`} />
                    ) : (
                      <Check className={`h-3 w-3 text-primary-foreground/40`} />
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3 flex gap-2 bg-card">
        <Input
          placeholder="Escribí un mensaje..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          className="flex-1"
        />
        <Button size="icon" onClick={sendMessage} disabled={!text.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
