import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INVALID_CREDENTIALS, setupCredentialsSchema, verifyExactLogin, type LoginResult } from "./login-credentials";

export async function administratorCount(): Promise<number | null> {
  const { count, error } = await supabaseAdmin.from("user_roles")
    .select("id", { count: "exact", head: true }).eq("role", "admin");
  return error ? null : count;
}

export async function authenticateUsername(
  input: unknown,
  url: string,
  key: string,
): Promise<LoginResult> {
  // Isolated per-request client: no sessions, passwords, or tokens in globals.
  const auth = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (request, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
        headers.delete("Authorization");
      }
      headers.set("apikey", key);
      return fetch(request, { ...init, headers });
    } },
  });

  return verifyExactLogin(input, async (username) => {
    const { data: profile, error } = await supabaseAdmin.from("user_profiles")
      .select("user_id, username").eq("username", username).maybeSingle();
    if (error || !profile || profile.username !== username) return null;
    const { data, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
    const user = data.user;
    if (userError || !user?.email) return null;
    const bannedUntil = user.banned_until;
    const active = !bannedUntil || Date.parse(bannedUntil) <= Date.now();
    return { username: profile.username, email: user.email, active };
  }, async (email, password) => {
    // Keep the provider's secure hash verification and built-in throttling.
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) return { error: INVALID_CREDENTIALS };
    return { session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    } };
  });
}

export async function bootstrapAdministrator(input: unknown, url: string, key: string): Promise<LoginResult> {
  const parsed = setupCredentialsSchema.safeParse(input);
  if (!parsed.success || await administratorCount() !== 0) return { error: INVALID_CREDENTIALS };
  const { username, password } = parsed.data;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: `${crypto.randomUUID()}@users.maxi.local`,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: username },
  });
  if (error || !data.user) return { error: INVALID_CREDENTIALS };
  // Preserve the existing atomic claim: concurrent bootstrap attempts cannot
  // create multiple first administrators; failed claims remove their account.
  const { error: claimError } = await supabaseAdmin.rpc("claim_first_admin", {
    _user_id: data.user.id, _username: username,
  });
  if (claimError) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    return { error: INVALID_CREDENTIALS };
  }
  return authenticateUsername(parsed.data, url, key);
}