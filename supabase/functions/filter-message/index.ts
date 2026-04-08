import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Detection regexes ---
const PHONE_PATTERNS = [
  /(\+?54)?[\s\-.]?9?[\s\-.]?(\d{2,4})[\s\-.]?(\d{6,8})/g,
  /\b\d[\s.]?\d[\s.]?\d[\s.]?\d[\s.]?\d[\s.]?\d[\s.]?\d[\s.]?\d[\s.]?\d[\s.]?\d\b/g,
  /(?:cel|whatsapp|wa\.me\/|wa:|tel|fono|teléfono|telefono)\s*[:\-]?\s*[\d\s\-+().]{7,}/gi,
];

const EMAIL_PATTERNS = [
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  /[a-zA-Z0-9._%+\-]+\s*(?:arroba|\(at\)|\[at\]|@)\s*[a-zA-Z0-9.\-]+\s*(?:punto|\(dot\)|\[dot\]|\.)\s*[a-zA-Z]{2,}/gi,
];

const BRIDGE_KEYWORDS = [
  "encontrémonos",
  "encontremonos",
  "nos vemos fuera",
  "por otro lado",
  "por privado",
  "mandame al",
  "escribime al",
  "contactame por",
  "hablame por",
  "pasame tu",
  "dame tu numero",
  "dame tu mail",
  "te paso mi",
  "mi numero es",
  "mi mail es",
  "fuera de la plataforma",
  "fuera de inmobit",
];

function detectViolation(text: string): { detected: boolean; reason: string | null } {
  const lower = text.toLowerCase();

  for (const pat of PHONE_PATTERNS) {
    pat.lastIndex = 0;
    if (pat.test(text)) return { detected: true, reason: "PHONE_DETECTED" };
  }
  for (const pat of EMAIL_PATTERNS) {
    pat.lastIndex = 0;
    if (pat.test(text)) return { detected: true, reason: "EMAIL_DETECTED" };
  }
  for (const kw of BRIDGE_KEYWORDS) {
    if (lower.includes(kw)) return { detected: true, reason: "BRIDGE_ATTEMPT" };
  }
  return { detected: false, reason: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { lead_id, body } = await req.json();
    if (!lead_id || !body?.trim()) {
      return new Response(JSON.stringify({ error: "lead_id and body are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check user is participant in this lead
    const { data: lead } = await supabase
      .from("leads")
      .select("id, client_id, capturing_broker_id, client_broker_id")
      .eq("id", lead_id)
      .single();

    if (!lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const participants = [lead.client_id, lead.capturing_broker_id, lead.client_broker_id].filter(Boolean);
    if (!participants.includes(userId)) {
      return new Response(JSON.stringify({ error: "Not a participant" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Detect violations
    const { detected, reason } = detectViolation(body);

    // Use service role to insert (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: msg, error: insertErr } = await adminClient
      .from("messages")
      .insert({
        lead_id,
        sender_id: userId,
        body: body.trim(),
        is_filtered: detected,
        filter_reason: reason,
      })
      .select("id, created_at, is_filtered, filter_reason")
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If filtered, log to audit_log and check for 3rd violation
    if (detected) {
      await adminClient.from("audit_log").insert({
        user_id: userId,
        action: "MESSAGE_FILTERED",
        table_name: "messages",
        record_id: msg.id,
        new_data: { reason, lead_id },
      });

      // Count violations by this user in this lead
      const { count } = await adminClient
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead_id)
        .eq("sender_id", userId)
        .eq("is_filtered", true);

      if (count && count >= 3) {
        // Notify admins
        const { data: admins } = await adminClient
          .from("users")
          .select("id")
          .eq("role", "ADMIN");

        if (admins?.length) {
          const notifications = admins.map((a: any) => ({
            user_id: a.id,
            type: "BRIDGE_ALERT",
            title: "Alerta: intentos de puenteo reiterados",
            body: `El usuario ${userId} tiene ${count} mensajes filtrados en el lead ${lead_id}`,
            data: { lead_id, sender_id: userId, count },
          }));
          await adminClient.from("notifications").insert(notifications);
        }
      }

      return new Response(JSON.stringify({
        filtered: true,
        reason,
        message: "Tu mensaje fue bloqueado. La comunicación debe mantenerse dentro de InmoBit para proteger la operación.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      filtered: false,
      message_id: msg.id,
      created_at: msg.created_at,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
