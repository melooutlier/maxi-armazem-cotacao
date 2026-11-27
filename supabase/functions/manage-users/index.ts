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
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Não autorizado." }, { status: 401, headers: corsHeaders });

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = authorization.slice(7);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return Response.json({ error: "Não autorizado." }, { status: 401, headers: corsHeaders });

    const { data: adminRole } = await admin.from("user_roles").select("id").eq("user_id", authData.user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) return Response.json({ error: "Apenas administradores podem gerir contas." }, { status: 403, headers: corsHeaders });

    const body = await req.json();
    const action = String(body.action ?? "");
    if (action === "create") {
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const isAdmin = body.isAdmin === true;
      if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) return Response.json({ error: "O nome de utilizador deve ter 3 a 40 caracteres e usar apenas letras, números, ponto, hífen ou underscore." }, { status: 400, headers: corsHeaders });
      if (password.length < 8) return Response.json({ error: "A palavra-passe inicial deve ter pelo menos 8 caracteres." }, { status: 400, headers: corsHeaders });

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: username + "@users.maxi.local",
        password,
        email_confirm: true,
        user_metadata: { username, display_name: username },
      });
      if (createError || !created.user) return Response.json({ error: createError?.message ?? "Não foi possível criar a conta." }, { status: 400, headers: corsHeaders });

      const { error: profileError } = await admin.from("user_profiles").insert({ user_id: created.user.id, username });
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return Response.json({ error: profileError.message }, { status: 400, headers: corsHeaders });
      }
      const roles = [{ user_id: created.user.id, role: "staff" }];
      if (isAdmin) roles.push({ user_id: created.user.id, role: "admin" });
      const { error: roleError } = await admin.from("user_roles").insert(roles);
      if (roleError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return Response.json({ error: roleError.message }, { status: 400, headers: corsHeaders });
      }
      return Response.json({ user: { id: created.user.id, username, isAdmin, active: true } }, { headers: corsHeaders });
    }

    if (action === "update") {
      const userId = String(body.userId ?? "");
      const username = String(body.username ?? "").trim().toLowerCase();
      const isAdmin = body.isAdmin === true;
      const active = body.active !== false;
      if (!userId || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) return Response.json({ error: "Dados da conta inválidos." }, { status: 400, headers: corsHeaders });
      if (userId === authData.user.id && !isAdmin) return Response.json({ error: "Não pode retirar as próprias permissões administrativas." }, { status: 400, headers: corsHeaders });

      const { data: targetRole } = await admin.from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (targetRole && !isAdmin) {
        const { count } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
        if ((count ?? 0) <= 1) return Response.json({ error: "O sistema precisa de pelo menos um administrador." }, { status: 400, headers: corsHeaders });
      }

      const { error: profileError } = await admin.from("user_profiles").update({ username }).eq("user_id", userId);
      if (profileError) return Response.json({ error: profileError.message }, { status: 400, headers: corsHeaders });

      const { data: existingUser, error: getUserError } = await admin.auth.admin.getUserById(userId);
      if (getUserError || !existingUser.user) return Response.json({ error: "Conta não encontrada." }, { status: 404, headers: corsHeaders });
      const { error: metadataError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: { ...existingUser.user.user_metadata, username, display_name: username },
        ban_duration: active ? "none" : "876000h",
      });
      if (metadataError) return Response.json({ error: metadataError.message }, { status: 400, headers: corsHeaders });

      if (isAdmin && !targetRole) {
        const { error } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
      } else if (!isAdmin && targetRole) {
        const { error } = await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
      }
      return Response.json({ user: { id: userId, username, isAdmin, active } }, { headers: corsHeaders });
    }

    return Response.json({ error: "Acção inválida." }, { status: 400, headers: corsHeaders });
  } catch {
    return Response.json({ error: "Não foi possível gerir a conta." }, { status: 500, headers: corsHeaders });
  }
});
