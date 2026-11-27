import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,39}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Método não permitido." }, { status: 405, headers: corsHeaders });

  try {
    const body = await req.json();
    const action = String(body.action ?? "login");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (action === "status") {
      const { count, error } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if (error) return Response.json({ error: "Não foi possível verificar o primeiro acesso." }, { status: 500, headers: corsHeaders });
      return Response.json({ adminCount: count ?? 0 }, { headers: corsHeaders });
    }

    const normalizedUsername = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (action === "bootstrap") {
      if (!usernamePattern.test(normalizedUsername)) {
        return Response.json({ error: "O nome de utilizador deve ter 3 a 40 caracteres e usar apenas letras, números, ponto, hífen ou underscore." }, { headers: corsHeaders });
      }
      if (password.length < 8) {
        return Response.json({ error: "A palavra-passe deve ter pelo menos 8 caracteres." }, { headers: corsHeaders });
      }

      const { count } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) > 0) {
        return Response.json({ error: "O primeiro administrador já foi criado. Entre com a sua conta." }, { headers: corsHeaders });
      }

      const email = `${normalizedUsername}@users.maxi.local`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: normalizedUsername, display_name: normalizedUsername },
      });
      if (createError || !created.user) {
        return Response.json({ error: createError?.message ?? "Não foi possível criar o primeiro administrador." }, { headers: corsHeaders });
      }

      const { error: claimError } = await admin.rpc("claim_first_admin", {
        _user_id: created.user.id,
        _username: normalizedUsername,
      });
      if (claimError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return Response.json({ error: "O primeiro administrador já foi criado. Entre com a sua conta." }, { headers: corsHeaders });
      }

      const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        return Response.json({ error: "A conta foi criada. Entre agora com o seu nome de utilizador e palavra-passe." }, { headers: corsHeaders });
      }

      return Response.json({ session: data.session, firstAdmin: true }, { headers: corsHeaders });
    }

    if (!usernamePattern.test(normalizedUsername) || !password) {
      return Response.json({ error: "Nome de utilizador ou palavra-passe inválidos." }, { status: 400, headers: corsHeaders });
    }

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
