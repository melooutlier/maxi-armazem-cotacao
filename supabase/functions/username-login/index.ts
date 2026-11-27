import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Método não permitido." }, { status: 405, headers: corsHeaders });

  try {
    const { username, password } = await req.json();
    const normalizedUsername = String(username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(normalizedUsername) || typeof password !== "string" || !password) {
      return Response.json({ error: "Nome de utilizador ou palavra-passe inválidos." }, { status: 400, headers: corsHeaders });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from("user_profiles").select("user_id").eq("username", normalizedUsername).maybeSingle();
    if (!profile) return Response.json({ error: "Credenciais inválidas." }, { status: 401, headers: corsHeaders });

    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
    if (userError || !authUser.user?.email || authUser.user.banned_until && new Date(authUser.user.banned_until) > new Date()) {
      return Response.json({ error: "Credenciais inválidas." }, { status: 401, headers: corsHeaders });
    }

    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: authUser.user.email, password });
    if (error || !data.session) return Response.json({ error: "Credenciais inválidas." }, { status: 401, headers: corsHeaders });

    return Response.json({ session: data.session }, { headers: corsHeaders });
  } catch {
    return Response.json({ error: "Não foi possível iniciar sessão." }, { status: 500, headers: corsHeaders });
  }
});
