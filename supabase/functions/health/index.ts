import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { getPublicKey } from "../_shared/env.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors });
  const url = Deno.env.get("SUPABASE_URL");
  const key = getPublicKey();
  if (!url || !key) return new Response(JSON.stringify({ ok: false, error: "Supabase environment is incomplete" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  const client = createClient(url, key);
  const { error } = await client.from("profiles").select("id").limit(1);
  return new Response(JSON.stringify({ ok: !error, database: !error, timestamp: new Date().toISOString() }), { status: error ? 503 : 200, headers: { ...cors, "Content-Type": "application/json" } });
});
