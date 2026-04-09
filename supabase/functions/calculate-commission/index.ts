import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommissionInput {
  lead_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), { status: 401, headers: corsHeaders });
    }
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    }).auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { lead_id }: CommissionInput = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id is required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), { status: 404, headers: corsHeaders });
    }

    // Verify lead is CLOSED
    if (lead.stage !== "CLOSED") {
      return new Response(JSON.stringify({ error: "Lead must be in CLOSED stage" }), { status: 400, headers: corsHeaders });
    }

    // Check existing commission
    const { data: existingComm } = await supabase
      .from("commissions")
      .select("id")
      .eq("lead_id", lead_id)
      .maybeSingle();
    if (existingComm) {
      return new Response(JSON.stringify({ error: "Commission already exists for this lead" }), { status: 409, headers: corsHeaders });
    }

    // Verify completed visit exists
    const { data: completedVisit } = await supabase
      .from("visits")
      .select("id")
      .eq("lead_id", lead_id)
      .eq("status", "COMPLETED")
      .limit(1)
      .maybeSingle();
    if (!completedVisit) {
      return new Response(JSON.stringify({ error: "No completed visit found. A visit must be completed before calculating commission." }), { status: 400, headers: corsHeaders });
    }

    // Fetch property
    const { data: property } = await supabase
      .from("properties")
      .select("id, price, currency")
      .eq("id", lead.property_id)
      .single();
    if (!property) {
      return new Response(JSON.stringify({ error: "Property not found" }), { status: 404, headers: corsHeaders });
    }

    // Fetch active mandate
    const { data: mandate } = await supabase
      .from("mandates")
      .select("*")
      .eq("property_id", lead.property_id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const commissionPct = mandate?.commission_pct || 3;
    const totalAmount = (property.price * commissionPct) / 100;

    // Determine rule
    let rule = lead.commission_rule || "C_OPEN";
    let capturingPct = 0;
    let clientPct = 0;
    const platformPct = 20;

    const singleBroker = !lead.client_broker_id || lead.capturing_broker_id === lead.client_broker_id;

    if (rule === "C_EXCLUSIVE" || (mandate?.type === "EXCLUSIVE" && singleBroker)) {
      rule = "C_EXCLUSIVE";
      capturingPct = 50;
      clientPct = 30; // same broker gets both = 80%
    } else if (rule === "A" || (!singleBroker && mandate?.type !== "EXCLUSIVE")) {
      // Rule A or B: two distinct brokers
      rule = singleBroker ? "B" : "A";
      if (singleBroker) {
        // Rule B - same as Rule A single broker
        capturingPct = 50;
        clientPct = 30;
        rule = "C_OPEN";
      } else {
        capturingPct = 40;
        clientPct = 40;
      }
    } else if (rule === "C_OPEN") {
      if (singleBroker) {
        capturingPct = 50;
        clientPct = 30;
      } else {
        capturingPct = 40;
        clientPct = 40;
      }
    } else if (rule === "D") {
      // External operation detected - log only
      capturingPct = 0;
      clientPct = 0;
    }

    // Recalculate based on final rule mapping from spec
    switch (rule) {
      case "C_EXCLUSIVE":
        capturingPct = 50;
        clientPct = 30;
        break;
      case "A":
        capturingPct = 40;
        clientPct = 40;
        break;
      case "C_OPEN":
        capturingPct = 50;
        clientPct = 30;
        break;
      case "D":
        capturingPct = 0;
        clientPct = 0;
        break;
    }

    const capturingAmount = (totalAmount * capturingPct) / 100;
    const clientAmount = (totalAmount * clientPct) / 100;
    const platformAmount = (totalAmount * platformPct) / 100;

    // Insert commission
    const { data: commission, error: insertErr } = await supabase
      .from("commissions")
      .insert({
        lead_id,
        property_id: lead.property_id,
        rule,
        total_amount: totalAmount,
        capturing_broker_pct: capturingPct,
        client_broker_pct: clientPct,
        platform_pct: platformPct,
        capturing_broker_amount: capturingAmount,
        client_broker_amount: clientAmount,
        platform_amount: platformAmount,
        status: "PENDING",
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: corsHeaders });
    }

    // Update lead commission_rule
    await supabase.from("leads").update({ commission_rule: rule }).eq("id", lead_id);

    // Notify admins
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("role", "ADMIN");

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin: any) => ({
        user_id: admin.id,
        type: "COMMISSION_PENDING",
        title: "Nueva comisión pendiente de revisión",
        body: `Se generó una comisión de ${property.currency} ${totalAmount.toLocaleString()} (Regla ${rule}) para revisión.`,
        data: { commission_id: commission.id, lead_id },
      }));
      await supabase.from("notifications").insert(notifications);
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "COMMISSION_CREATED",
      table_name: "commissions",
      record_id: commission.id,
      new_data: commission,
    });

    return new Response(JSON.stringify({ commission }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
