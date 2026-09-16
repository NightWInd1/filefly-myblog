import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { getPublicKey, getSecretKey } from "../_shared/env.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = getPublicKey();
  const serviceKey = getSecretKey();
  if (!url || !anonKey || !serviceKey) return new Response(JSON.stringify({ error: "Function environment is incomplete" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const auth = request.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Authorization required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const body = await request.json().catch(() => ({}));
  const filename = String(body.filename || "upload.bin").replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${user.id}/${crypto.randomUUID()}-${filename}`;
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.storage.from("user-uploads").createSignedUploadUrl(path);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ path, token: data.token }), { headers: { ...cors, "Content-Type": "application/json" } });
});
