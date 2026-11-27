import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { INVALID_CREDENTIALS, loginCredentialsSchema, setupCredentialsSchema, type LoginResult } from "./login-credentials";

export const loginStatus = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store");
  try {
    const { administratorCount } = await import("./username-login.server");
    return { adminCount: await administratorCount() };
  } catch {
    return { adminCount: null };
  }
});

export const usernameLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    // Return a generic denial rather than serialize schema details containing
    // credentials in an error. Do not coerce non-string JSON values.
    const parsed = z.object({
      action: z.enum(["login", "bootstrap"]),
      username: z.unknown(), password: z.unknown(),
    }).strict().safeParse(input);
    if (!parsed.success) return null;
    const schema = parsed.data.action === "bootstrap" ? setupCredentialsSchema : loginCredentialsSchema;
    const credentials = schema.safeParse({ username: parsed.data.username, password: parsed.data.password });
    return credentials.success ? { action: parsed.data.action, ...credentials.data } : null;
  })
  .handler(async ({ data }): Promise<LoginResult> => {
    setResponseHeader("Cache-Control", "no-store");
    if (!data) return { error: INVALID_CREDENTIALS };
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) return { error: INVALID_CREDENTIALS };
    try {
      const { authenticateUsername, bootstrapAdministrator } = await import("./username-login.server");
      const credentials = { username: data.username, password: data.password };
      return data.action === "bootstrap"
        ? await bootstrapAdministrator(credentials, url, key)
        : await authenticateUsername(credentials, url, key);
    } catch {
      // Never log input, provider payloads, passwords, hashes, or sessions.
      return { error: INVALID_CREDENTIALS };
    }
  });